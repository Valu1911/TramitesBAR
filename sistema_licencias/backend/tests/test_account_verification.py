"""Tests del circuito de auditoría de cuentas e infracciones de tránsito."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.domain.enums import AccountStatus, Role


def test_account_starts_pending_and_blocks_procedure(
    client: TestClient, make_user, login, csrf_headers, seeded: Session
) -> None:
    """Una cuenta recién creada nace en estado pendiente y no puede iniciar trámites."""
    user = make_user(
        email="ciudadano@example.com",
        role=Role.CITIZEN.value,
        account_status=AccountStatus.PENDING.value,
    )
    assert user.profile.account_status == AccountStatus.PENDING.value

    csrf, _ = login("ciudadano@example.com")
    response = client.post(
        "/api/v1/procedures",
        headers=csrf_headers(csrf),
        json={"procedure_type": "nueva", "license_category": "B", "data": {}},
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "account_pending_verification"


def test_admin_cuentas_flow(
    client: TestClient, make_user, login, csrf_headers, db: Session, seeded: Session
) -> None:
    """Circuito completo de admin_cuentas: lista, consulta, rechazo por multas y aprobación."""
    # 1. Crear ciudadano en estado pendiente
    citizen = make_user(
        email="multado@example.com",
        role=Role.CITIZEN.value,
        account_status=AccountStatus.PENDING.value,
    )
    # 2. Crear admin de cuentas
    make_user(
        email="admin_cuentas@baradero.gob.ar",
        role=Role.ADMIN_CUENTAS.value,
        mfa_enabled=True,
    )

    # Login como admin_cuentas
    csrf_admin, _ = login("admin_cuentas@baradero.gob.ar")

    # Listar cuentas
    res_list = client.get("/api/v1/admin/accounts?filtro=todos")
    assert res_list.status_code == 200
    data = res_list.json()
    assert data["kpis"]["pending"] >= 1
    assert any(item["user_id"] == citizen.id for item in data["items"])

    # Detalle con DNI descifrado para consulta en Infracciones BA
    res_detail = client.get(f"/api/v1/admin/accounts/{citizen.id}")
    assert res_detail.status_code == 200
    assert res_detail.json()["account"]["dni_full"] is not None

    # Rechazar por multas
    res_reject = client.post(
        f"/api/v1/admin/accounts/{citizen.id}/reject-fines",
        headers=csrf_headers(csrf_admin),
        json={"fines_count": 2, "fines_amount": 35000.50, "reason": "Exceso de velocidad en RP41"},
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["account_status"] == AccountStatus.REJECTED_FINES.value
    assert res_reject.json()["fines_count"] == 2

    # Verificar que el ciudadano bloqueado no puede iniciar trámite
    client.post("/api/v1/auth/logout", headers=csrf_headers(csrf_admin))
    csrf_citizen, _ = login("multado@example.com")

    res_proc = client.post(
        "/api/v1/procedures",
        headers=csrf_headers(csrf_citizen),
        json={"procedure_type": "nueva", "license_category": "B", "data": {}},
    )
    assert res_proc.status_code == 403
    assert res_proc.json()["error"]["code"] == "fines_pending"

    # El ciudadano notifica "Ya pagué"
    res_paid = client.post(
        "/api/v1/auth/account/notify-paid",
        headers=csrf_headers(csrf_citizen),
        json={"message": "Adjunto comprobante de pago del Banco Provincia."},
    )
    assert res_paid.status_code == 200

    # Leer mensajes del ciudadano
    res_msgs = client.get("/api/v1/auth/account/messages")
    assert res_msgs.status_code == 200
    assert len(res_msgs.json()) >= 2  # Notificación de multa y notificación de pago

    # Admin vuelve a ingresar y aprueba la cuenta
    client.post("/api/v1/auth/logout", headers=csrf_headers(csrf_citizen))
    csrf_admin2, _ = login("admin_cuentas@baradero.gob.ar")

    res_approve = client.post(
        f"/api/v1/admin/accounts/{citizen.id}/approve",
        headers=csrf_headers(csrf_admin2),
    )
    assert res_approve.status_code == 200
    assert res_approve.json()["account_status"] == AccountStatus.APPROVED.value
    assert res_approve.json()["fines_count"] == 0

    # Ciudadano ahora sí puede iniciar el trámite
    client.post("/api/v1/auth/logout", headers=csrf_headers(csrf_admin2))
    csrf_citizen2, _ = login("multado@example.com")

    res_proc_ok = client.post(
        "/api/v1/procedures",
        headers=csrf_headers(csrf_citizen2),
        json={"procedure_type": "nueva", "license_category": "B", "data": {}},
    )
    assert res_proc_ok.status_code == 201
    assert res_proc_ok.json()["public_code"].startswith("TB-")
