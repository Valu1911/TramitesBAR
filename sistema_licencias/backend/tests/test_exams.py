"""Tests del examen teórico corregido en el servidor."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.security import utcnow
from app.models.exam import ExamAttempt, Question
from app.models.procedure import Procedure, ProcedureStep


def _prepare_theory_step(client: TestClient, db: Session, csrf: str) -> int:
    """Crea un expediente y lo deja en la etapa teórica."""
    response = client.post(
        "/api/v1/procedures",
        headers={"X-CSRF-Token": csrf},
        json={"procedure_type": "nueva", "license_category": "B", "data": {}},
    )
    assert response.status_code == 201, response.text
    procedure_id = response.json()["id"]

    db.execute(
        update(ProcedureStep)
        .where(
            ProcedureStep.procedure_id == procedure_id,
            ProcedureStep.code.in_(["charlas", "health"]),
        )
        .values(status="completed", completed_at=utcnow())
    )
    db.execute(
        update(ProcedureStep)
        .where(
            ProcedureStep.procedure_id == procedure_id,
            ProcedureStep.code == "theory",
        )
        .values(status="in_progress")
    )
    db.execute(
        update(Procedure)
        .where(Procedure.id == procedure_id)
        .values(current_step="theory")
    )
    db.execute(update(Question).values(reviewed=True))
    db.commit()
    return procedure_id


def test_exam_start_does_not_expose_correct_answers(
    client: TestClient, make_user, login, seeded: Session, db: Session
) -> None:
    """El navegador recibe preguntas y opciones, nunca el índice correcto."""
    make_user(email="examen@example.com")
    csrf, _ = login("examen@example.com")
    procedure_id = _prepare_theory_step(client, db, csrf)

    response = client.post(
        f"/api/v1/procedures/{procedure_id}/exam/start",
        headers={"X-CSRF-Token": csrf},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["total"] == 10
    assert len(payload["questions"]) == 10
    for question in payload["questions"]:
        assert "correct_index" not in question
        assert question["options"]


def test_exam_submit_scores_on_server_and_advances_procedure(
    client: TestClient, make_user, login, seeded: Session, db: Session
) -> None:
    """La corrección usa la base, no el cliente, y avanza al aprobar."""
    make_user(email="aprueba@example.com")
    csrf, _ = login("aprueba@example.com")
    procedure_id = _prepare_theory_step(client, db, csrf)

    started = client.post(
        f"/api/v1/procedures/{procedure_id}/exam/start",
        headers={"X-CSRF-Token": csrf},
    )
    assert started.status_code == 200, started.text
    attempt_id = started.json()["attempt_id"]

    attempt = db.execute(select(ExamAttempt).where(ExamAttempt.id == attempt_id)).scalar_one()
    answers = [
        {"index": index, "selected_index": int(question["correct_index"])}
        for index, question in enumerate(attempt.questions)
    ]
    submitted = client.post(
        f"/api/v1/procedures/{procedure_id}/exam/{attempt_id}/submit",
        headers={"X-CSRF-Token": csrf},
        json={"answers": answers},
    )

    assert submitted.status_code == 200, submitted.text
    result = submitted.json()
    assert result["score"] == result["total"] == 10
    assert result["passed"] is True

    db.expire_all()
    procedure = db.execute(select(Procedure).where(Procedure.id == procedure_id)).scalar_one()
    assert procedure.current_step == "practical"


def test_exam_submit_rejects_incomplete_answers(
    client: TestClient, make_user, login, seeded: Session, db: Session
) -> None:
    """No se puede entregar un examen con respuestas faltantes."""
    make_user(email="incompleto@example.com")
    csrf, _ = login("incompleto@example.com")
    procedure_id = _prepare_theory_step(client, db, csrf)
    started = client.post(
        f"/api/v1/procedures/{procedure_id}/exam/start",
        headers={"X-CSRF-Token": csrf},
    )
    attempt_id = started.json()["attempt_id"]

    response = client.post(
        f"/api/v1/procedures/{procedure_id}/exam/{attempt_id}/submit",
        headers={"X-CSRF-Token": csrf},
        json={"answers": [{"index": 0, "selected_index": 0}]},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "answers_incomplete"


def test_exam_proctoring_token_and_step_validation(
    client: TestClient, make_user, login, seeded: Session, db: Session
) -> None:
    """El token de proctoring LiveKit solo se emite cuando el trámite está en la etapa teórica."""
    make_user(email="proctoring@example.com")
    csrf, _ = login("proctoring@example.com")

    # 1. Trámite recién creado (etapa 'charlas') -> debe rechazar con 409
    res_proc = client.post(
        "/api/v1/procedures",
        headers={"X-CSRF-Token": csrf},
        json={"procedure_type": "nueva", "license_category": "B", "data": {}},
    )
    assert res_proc.status_code == 201
    procedure_id = res_proc.json()["id"]

    res_early = client.post(
        f"/api/v1/procedures/{procedure_id}/exam/proctoring-token",
        headers={"X-CSRF-Token": csrf},
    )
    assert res_early.status_code == 409
    assert res_early.json()["error"]["code"] == "step_not_current"

    # 2. Dejar en etapa 'theory' -> emite el token LiveKit
    db.execute(
        update(ProcedureStep)
        .where(
            ProcedureStep.procedure_id == procedure_id,
            ProcedureStep.code.in_(["charlas", "health"]),
        )
        .values(status="completed", completed_at=utcnow())
    )
    db.execute(
        update(ProcedureStep)
        .where(
            ProcedureStep.procedure_id == procedure_id,
            ProcedureStep.code == "theory",
        )
        .values(status="in_progress")
    )
    db.execute(
        update(Procedure)
        .where(Procedure.id == procedure_id)
        .values(current_step="theory")
    )
    db.commit()
    db.expire_all()
    procedure = db.execute(select(Procedure).where(Procedure.id == procedure_id)).scalar_one()

    res_token = client.post(
        f"/api/v1/procedures/{procedure_id}/exam/proctoring-token",
        headers={"X-CSRF-Token": csrf},
    )
    assert res_token.status_code == 200, res_token.text
    data = res_token.json()
    assert data["room_name"] == f"exam-{procedure.public_code}"
    assert "token" in data
    assert "server_url" in data
    assert "participant_name" in data


def test_complete_learning_materials_flow(
    client: TestClient, make_user, login, seeded: Session, db: Session
) -> None:
    """Completar charlas viales exige todos los materiales y avanza el expediente."""
    make_user(email="charlas@example.com")
    csrf, _ = login("charlas@example.com")

    res_proc = client.post(
        "/api/v1/procedures",
        headers={"X-CSRF-Token": csrf},
        json={"procedure_type": "nueva", "license_category": "B", "data": {}},
    )
    assert res_proc.status_code == 201
    proc_id = res_proc.json()["id"]

    # Faltan materiales -> 422
    res_fail = client.post(
        f"/api/v1/procedures/{proc_id}/learning/complete",
        headers={"X-CSRF-Token": csrf},
        json={"material_ids": [1]},
    )
    assert res_fail.status_code == 422
    assert res_fail.json()["error"]["code"] == "materials_incomplete"

    # Enviar todos los materiales requeridos
    res_materials = client.get("/api/v1/catalog/materials")
    assert res_materials.status_code == 200
    all_ids = [m["id"] for m in res_materials.json()]

    res_ok = client.post(
        f"/api/v1/procedures/{proc_id}/learning/complete",
        headers={"X-CSRF-Token": csrf},
        json={"material_ids": all_ids},
    )
    assert res_ok.status_code == 200
    db.expire_all()
    proc = db.execute(select(Procedure).where(Procedure.id == proc_id)).scalar_one()
    assert proc.current_step == "health"
