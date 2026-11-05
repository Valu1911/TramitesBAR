"""Tests del motor de trámites y de los cupos de examen práctico."""

from __future__ import annotations

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import utcnow
from app.models.procedure import Appointment


def _create_procedure(
    client: TestClient,
    csrf: str,
    *,
    procedure_type: str = "nueva",
    category: str = "B",
) -> dict:
    """Crea un expediente por API y devuelve la respuesta."""
    response = client.post(
        "/api/v1/procedures",
        headers={"X-CSRF-Token": csrf},
        json={
            "procedure_type": procedure_type,
            "license_category": category,
            "data": {"observaciones": "sin observaciones"},
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_create_procedure_builds_steps_from_matrix(
    client: TestClient, make_user, login, seeded: Session
) -> None:
    """El alta toma los pasos de la matriz y arranca en el primero."""
    make_user(email="tramite@example.com")
    csrf, _ = login("tramite@example.com")

    payload = _create_procedure(client, csrf)

    assert payload["procedure_type"]["code"] == "nueva"
    assert payload["license_category"] == "B"
    assert payload["current_step"] == "charlas"
    assert [step["code"] for step in payload["steps"]] == [
        "charlas",
        "health",
        "theory",
        "practical",
        "delivery",
    ]
    assert payload["steps"][0]["status"] == "in_progress"
    assert payload["steps"][1]["status"] == "pending"


def test_duplicate_active_procedure_is_rejected(
    client: TestClient, make_user, login, seeded: Session
) -> None:
    """No se permite abrir dos expedientes iguales en paralelo."""
    make_user(email="duplicado@example.com")
    csrf, _ = login("duplicado@example.com")
    first = _create_procedure(client, csrf)

    response = client.post(
        "/api/v1/procedures",
        headers={"X-CSRF-Token": csrf},
        json={"procedure_type": "nueva", "license_category": "B", "data": {}},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "procedure_already_active"
    assert response.json()["error"]["procedure_id"] == first["id"]


def test_cancel_procedure_requires_csrf_and_is_idempotent_guard(
    client: TestClient, make_user, login, seeded: Session
) -> None:
    """Cancelar exige CSRF y no se puede repetir sobre un trámite cerrado."""
    make_user(email="cancelar@example.com")
    csrf, _ = login("cancelar@example.com")
    procedure = _create_procedure(client, csrf)

    without_csrf = client.post(f"/api/v1/procedures/{procedure['id']}/cancel")
    assert without_csrf.status_code == 403

    cancelled = client.post(
        f"/api/v1/procedures/{procedure['id']}/cancel",
        headers={"X-CSRF-Token": csrf},
    )
    assert cancelled.status_code == 200, cancelled.text

    again = client.post(
        f"/api/v1/procedures/{procedure['id']}/cancel",
        headers={"X-CSRF-Token": csrf},
    )
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "procedure_not_cancellable"


def test_available_appointments_do_not_expose_internal_notes(
    client: TestClient, make_user, login, db: Session
) -> None:
    """Las notas internas del municipio no salen en el listado público."""
    db.add(
        Appointment(
            scheduled_at=utcnow() + timedelta(days=2),
            location="Predio municipal",
            status="available",
            notes="Coordinar con el instructor interno",
        )
    )
    db.commit()
    make_user(email="turnos@example.com")
    login("turnos@example.com")

    response = client.get("/api/v1/appointments/available")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["notes"] is None


def test_full_procedure_lifecycle_from_start_to_license_issued(
    client: TestClient, make_user, login, seeded: Session, db: Session
) -> None:
    """Circuito completo: charlas, salud, examen con token, turnos, entrega y verificación pública QR."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import select, update
    from app.models.exam import ExamAttempt, Question

    # 1. El ciudadano inicia su trámite de licencia
    make_user(email="ciudadano.completo@baradero.gob.ar")
    csrf_citizen, _ = login("ciudadano.completo@baradero.gob.ar")
    proc = _create_procedure(client, csrf_citizen)
    proc_id = proc["id"]
    assert proc["current_step"] == "charlas"

    # 2. El ciudadano completa las charlas viales
    materials = client.get("/api/v1/catalog/materials").json()
    assert len(materials) > 0
    material_ids = [m["id"] for m in materials]
    res_charlas = client.post(
        f"/api/v1/procedures/{proc_id}/learning/complete",
        headers={"X-CSRF-Token": csrf_citizen},
        json={"material_ids": material_ids},
    )
    assert res_charlas.status_code == 200
    assert res_charlas.json()["current_step"] == "health"

    # 3. El ciudadano sube el certificado médico y envía la declaración de salud
    pdf_content = b"%PDF-1.4\nCertificado Medico Psico-fisico Baradero"
    doc_res = client.post(
        f"/api/v1/procedures/{proc_id}/documents",
        headers={"X-CSRF-Token": csrf_citizen},
        data={"kind": "health_certificate"},
        files={"file": ("certificado_medico.pdf", pdf_content, "application/pdf")},
    )
    assert doc_res.status_code == 201
    doc_id = doc_res.json()["id"]

    health_res = client.post(
        f"/api/v1/procedures/{proc_id}/health",
        headers={"X-CSRF-Token": csrf_citizen},
        json={
            "blood_type": "0+",
            "emergency_contact_name": "Maria Gonzalez",
            "emergency_contact_phone": "3329123456",
            "declares_apt": True,
        },
    )
    assert health_res.status_code == 200

    # 4. El auditor de salud aprueba el certificado médico
    make_user(email="admin.salud@baradero.gob.ar", role="admin", mfa_enabled=True)
    csrf_admin, _ = login("admin.salud@baradero.gob.ar")
    rev_res = client.post(
        f"/api/v1/admin/procedures/{proc_id}/documents/{doc_id}/review",
        headers={"X-CSRF-Token": csrf_admin},
        json={"decision": "approve"},
    )
    assert rev_res.status_code == 200
    assert rev_res.json()["status"] == "approved"

    # El ciudadano vuelve a consultar su trámite y ve que avanzó automáticamente a teoría
    csrf_citizen, _ = login("ciudadano.completo@baradero.gob.ar")
    proc_state = client.get(f"/api/v1/procedures/{proc_id}").json()
    assert proc_state["current_step"] == "theory"

    # 5. El ciudadano pide token de supervisión LiveKit e inicia el examen
    token_res = client.post(
        f"/api/v1/procedures/{proc_id}/exam/proctoring-token",
        headers={"X-CSRF-Token": csrf_citizen},
    )
    assert token_res.status_code == 200
    assert "token" in token_res.json()

    # Marcamos preguntas revisadas para habilitar el examen
    db.execute(update(Question).values(reviewed=True))
    db.commit()

    started = client.post(
        f"/api/v1/procedures/{proc_id}/exam/start",
        headers={"X-CSRF-Token": csrf_citizen},
    )
    assert started.status_code == 200
    attempt_id = started.json()["attempt_id"]

    # Envía respuestas correctas y aprueba el examen
    attempt = db.execute(select(ExamAttempt).where(ExamAttempt.id == attempt_id)).scalar_one()
    answers = [
        {"index": idx, "selected_index": int(q["correct_index"])}
        for idx, q in enumerate(attempt.questions)
    ]
    submit_res = client.post(
        f"/api/v1/procedures/{proc_id}/exam/{attempt_id}/submit",
        headers={"X-CSRF-Token": csrf_citizen},
        json={"answers": answers},
    )
    assert submit_res.status_code == 200
    assert submit_res.json()["passed"] is True

    # El trámite avanza automáticamente a práctico
    proc_state = client.get(f"/api/v1/procedures/{proc_id}").json()
    assert proc_state["current_step"] == "practical"

    # 6. Tránsito publica cupo práctico y el ciudadano lo reserva
    csrf_admin, _ = login("admin.salud@baradero.gob.ar")
    slot_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    slot_res = client.post(
        "/api/v1/admin/appointments",
        headers={"X-CSRF-Token": csrf_admin},
        json={
            "scheduled_at": slot_time,
            "location": "Pista Municipal Baradero",
            "instructor": "Inspector Vial",
            "capacity": 1,
            "kind": "practical",
        },
    )
    assert slot_res.status_code == 201
    appointment_id = slot_res.json()["id"]

    csrf_citizen, _ = login("ciudadano.completo@baradero.gob.ar")
    book_res = client.post(
        f"/api/v1/procedures/{proc_id}/appointments/{appointment_id}/book",
        headers={"X-CSRF-Token": csrf_citizen},
    )
    assert book_res.status_code == 200

    # 7. El examinador evalúa el práctico como aprobado
    csrf_admin, _ = login("admin.salud@baradero.gob.ar")
    grade_res = client.patch(
        f"/api/v1/admin/appointments/{appointment_id}",
        headers={"X-CSRF-Token": csrf_admin},
        json={"status": "completed", "result": "passed"},
    )
    assert grade_res.status_code == 200

    # El trámite avanza automáticamente a entrega
    csrf_citizen, _ = login("ciudadano.completo@baradero.gob.ar")
    proc_state = client.get(f"/api/v1/procedures/{proc_id}").json()
    assert proc_state["current_step"] == "delivery"

    # 8. El ciudadano indica opción de entrega
    deliv_res = client.post(
        f"/api/v1/procedures/{proc_id}/delivery",
        headers={"X-CSRF-Token": csrf_citizen},
        json={"delivery_method": "branch"},
    )
    assert deliv_res.status_code == 200

    # 9. Personal municipal confirma la entrega y emite la licencia
    csrf_admin, _ = login("admin.salud@baradero.gob.ar")
    complete_res = client.post(
        f"/api/v1/admin/procedures/{proc_id}/delivery/complete",
        headers={"X-CSRF-Token": csrf_admin},
        json={"notes": "Credencial física emitida y entregada"},
    )
    assert complete_res.status_code == 200
    assert complete_res.json()["status"] == "completed"

    # 10. El ciudadano consulta su licencia emitida
    csrf_citizen, _ = login("ciudadano.completo@baradero.gob.ar")
    licenses_res = client.get("/api/v1/licenses/mine")
    assert licenses_res.status_code == 200
    my_licenses = licenses_res.json()
    assert len(my_licenses) == 1
    license_data = my_licenses[0]
    assert license_data["status"] == "active"
    assert license_data["category"] == "B"
    qr_token = license_data["qr_token"]

    # 11. Validación pública vía código QR
    public_res = client.get(f"/api/v1/public/licenses/{qr_token}")
    assert public_res.status_code == 200
    public_payload = public_res.json()
    assert public_payload["found"] is True
    assert public_payload["status"] == "active"
    assert public_payload["category"] == "B"
    assert public_payload["municipality"] == "Municipalidad de Baradero"
