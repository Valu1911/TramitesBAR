"""Tests de alta, login, sesión, CSRF y control de acceso."""

from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domain.enums import Role
from app.models.policy import PolicyAcceptance
from app.models.user import User


def _register_payload(**overrides: object) -> dict[str, object]:
    """Arma un alta válida y permite cambiar campos puntuales."""
    payload: dict[str, object] = {
        "email": "nueva@example.com",
        "password": "ClaveSegura123!",
        "first_name": "Ana",
        "last_name": "Pérez",
        "dni": "30111222",
        "birth_date": "1990-04-12",
        "locality": "Baradero",
        "accepted_policies": [
            "terminos-de-uso",
            "politica-de-privacidad",
            "tratamiento-de-datos",
        ],
    }
    payload.update(overrides)
    return payload


def test_register_creates_account_and_policy_acceptances(
    client: TestClient, db: Session, seeded: Session
) -> None:
    """El alta guarda usuario, perfil y aceptaciones de las políticas."""
    response = client.post("/api/v1/auth/register", json=_register_payload())

    assert response.status_code == 201, response.text
    user = db.execute(select(User).where(User.email == "nueva@example.com")).scalar_one()
    assert user.role == Role.CITIZEN.value
    assert user.email_verified_at is None
    assert user.profile is not None
    assert user.profile.dni_encrypted != "30111222"
    accepted = db.execute(
        select(func.count(PolicyAcceptance.id)).where(PolicyAcceptance.user_id == user.id)
    ).scalar_one()
    assert accepted == 3


def test_register_rejects_weak_password(client: TestClient, seeded: Session) -> None:
    """La política de contraseñas se aplica antes de crear la cuenta."""
    # Doce caracteres o más para pasar la validación de longitud del schema y
    # llegar a la política de contraseñas del servicio, que exige un número.
    response = client.post(
        "/api/v1/auth/register",
        json=_register_payload(password="SinNumerosPeroLarga"),
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "weak_password"


def test_register_rejects_minor_without_enabled_feature(
    client: TestClient, seeded: Session
) -> None:
    """Los menores quedan deshabilitados hasta que el municipio lo defina."""
    response = client.post(
        "/api/v1/auth/register",
        json=_register_payload(
            birth_date=date.today().replace(year=date.today().year - 15).isoformat()
        ),
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "minors_online_disabled"


def test_login_sets_httponly_session_and_readable_csrf(
    client: TestClient, make_user, login
) -> None:
    """La sesión viaja en cookie httpOnly y el CSRF en cookie legible."""
    make_user(email="login@example.com")
    csrf, user_id = login("login@example.com")

    assert csrf
    assert user_id > 0
    cookies = client.cookies
    assert cookies.get("tb_session")
    assert cookies.get("tb_csrf") == csrf


def test_login_does_not_reveal_whether_account_exists(
    client: TestClient, make_user
) -> None:
    """Usuario inexistente y contraseña incorrecta devuelven el mismo error."""
    make_user(email="existe@example.com")

    wrong_password = client.post(
        "/api/v1/auth/login",
        json={"identifier": "existe@example.com", "password": "OtraClave123!"},
    )
    unknown_user = client.post(
        "/api/v1/auth/login",
        json={"identifier": "no-existe@example.com", "password": "OtraClave123!"},
    )

    assert wrong_password.status_code == unknown_user.status_code == 401
    assert wrong_password.json()["error"]["message"] == unknown_user.json()["error"]["message"]


def test_me_requires_session(client: TestClient) -> None:
    """Sin cookie de sesión no se puede leer el perfil."""
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"


def test_mutation_requires_csrf(client: TestClient, make_user, login) -> None:
    """Un POST autenticado sin cabecera CSRF se rechaza."""
    make_user(email="csrf@example.com")
    login("csrf@example.com")

    response = client.post("/api/v1/auth/logout")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "csrf_missing"


def test_mutation_rejects_wrong_csrf(client: TestClient, make_user, login) -> None:
    """Una cabecera CSRF distinta de la cookie no sirve."""
    make_user(email="csrf2@example.com")
    login("csrf2@example.com")

    response = client.post(
        "/api/v1/auth/logout",
        headers={"X-CSRF-Token": "token-inventado"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "csrf_invalid"


def test_logout_with_valid_csrf_revokes_session(
    client: TestClient, make_user, login
) -> None:
    """El logout válido borra cookies y revoca la sesión del servidor."""
    make_user(email="logout@example.com")
    csrf, _ = login("logout@example.com")

    response = client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})

    assert response.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401


def test_procedure_idor_returns_not_found(
    client: TestClient, make_user, login, seeded: Session, csrf_headers
) -> None:
    """Un ciudadano no puede leer el expediente de otro."""
    make_user(email="duena@example.com")
    csrf, _ = login("duena@example.com")
    created = client.post(
        "/api/v1/procedures",
        headers=csrf_headers(csrf),
        json={"procedure_type": "nueva", "license_category": "B", "data": {}},
    )
    assert created.status_code == 201, created.text
    procedure_id = created.json()["id"]

    client.post("/api/v1/auth/logout", headers=csrf_headers(csrf))
    make_user(email="intruso@example.com")
    csrf_intruso, _ = login("intruso@example.com")

    response = client.get(
        f"/api/v1/procedures/{procedure_id}",
        headers={"X-CSRF-Token": csrf_intruso},
    )
    assert response.status_code == 404


def test_staff_without_mfa_cannot_operate(client: TestClient, make_user, login) -> None:
    """El personal municipal sin segundo factor solo puede enrolarse."""
    make_user(email="admin@example.com", role=Role.ADMIN.value, mfa_enabled=False)
    login("admin@example.com")

    response = client.get("/api/v1/admin/dashboard")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "mfa_enrollment_required"
