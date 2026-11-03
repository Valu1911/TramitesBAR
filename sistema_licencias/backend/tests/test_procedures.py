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
