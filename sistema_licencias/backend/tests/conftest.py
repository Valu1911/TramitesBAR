"""Configuración común de tests.

La suite usa SQLite en memoria y no toca la base municipal ni el almacenamiento
real. Las variables se definen antes de importar la aplicación para que
`Settings` no lea credenciales de desarrollo.
"""

from __future__ import annotations

import base64
import os
import secrets
import tempfile
from collections.abc import Callable
from datetime import date
from pathlib import Path

# Contraseña única de los usuarios de prueba. No se usa en ningún entorno real.
TEST_PASSWORD = "ClaveSegura123!"

# Entorno de test aislado. No se usan secretos reales.
_TEST_DIR = Path(tempfile.mkdtemp(prefix="tramitesbar-tests-"))
os.environ.update(
    {
        "APP_ENV": "test",
        "DATABASE_URL": "sqlite://",
        "SECRET_KEY": secrets.token_urlsafe(48),
        "ENCRYPTION_KEY": base64.b64encode(secrets.token_bytes(32)).decode("ascii"),
        "DNI_HMAC_KEY": secrets.token_urlsafe(48),
        "UPLOAD_DIR": str(_TEST_DIR / "storage"),
        "EMAIL_TRANSPORT": "console",
        "TRUSTED_HOSTS": "testserver,127.0.0.1,localhost",
        "CORS_ORIGINS": "http://testserver",
        "COOKIE_SECURE": "false",
        "FEATURES_MINORS": "false",
    }
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app import models  # noqa: E402,F401 - registra las tablas
from app.core.db import Base, get_engine, get_session_factory  # noqa: E402
from app.core.rate_limit import _memory  # noqa: E402
from app.core.security import blind_index, hash_password, utcnow  # noqa: E402
from app.domain.enums import Role, UserStatus  # noqa: E402
from app.main import app  # noqa: E402
from app.models.policy import PolicyAcceptance  # noqa: E402
from app.models.user import CitizenProfile, User  # noqa: E402
from app.seed import seed_all, seed_policies  # noqa: E402
from app.services.crypto import get_cipher  # noqa: E402
from app.services.policies import active_policies  # noqa: E402


@pytest.fixture(scope="session")
def engine():  # type: ignore[no-untyped-def]
    """Crea el esquema una vez por sesión de pytest."""
    db_engine = get_engine()
    Base.metadata.create_all(db_engine)
    yield db_engine
    Base.metadata.drop_all(db_engine)


@pytest.fixture(autouse=True)
def clean_state(engine):  # type: ignore[no-untyped-def]
    """Deja la base y el rate limit limpios antes de cada test."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    _memory.clear()
    yield


@pytest.fixture
def db() -> Session:
    """Sesión de base para preparar datos o verificar resultados."""
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client() -> TestClient:
    """Cliente HTTP con el ciclo de vida de la aplicación."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def seeded(db: Session) -> Session:
    """Carga el contenido inicial del sistema."""
    seed_all(db)
    return db


@pytest.fixture
def make_user(db: Session) -> Callable[..., User]:
    """Crea un usuario con perfil listo para operar."""
    counter = {"value": 0}

    def factory(
        *,
        email: str | None = None,
        password: str = TEST_PASSWORD,
        role: str = Role.CITIZEN.value,
        mfa_enabled: bool = False,
        birth_date: date = date(1990, 1, 1),
    ) -> User:
        counter["value"] += 1
        suffix = counter["value"]
        email = email or f"persona{suffix}@example.com"
        dni = f"3{suffix:07d}"
        cipher = get_cipher()
        user = User(
            email=email,
            password_hash=hash_password(password),
            role=role,
            status=UserStatus.ACTIVE.value,
            email_verified_at=utcnow(),
            mfa_enabled=mfa_enabled,
        )
        db.add(user)
        db.flush()
        db.add(
            CitizenProfile(
                user_id=user.id,
                first_name="Persona",
                last_name=f"Prueba {suffix}",
                dni_encrypted=cipher.encrypt(dni) or "",
                dni_hmac=blind_index(dni, os.environ["DNI_HMAC_KEY"]),
                birth_date=birth_date,
                locality="Baradero",
            )
        )

        # Los usuarios de prueba representan cuentas ya onboardeadas. El seed de
        # políticas se ejecuta acá porque el fixture puede pedirse antes que
        # `seeded`; sin aceptaciones, los endpoints de trámites responden 403.
        seed_policies(db)
        db.flush()
        for policy in active_policies(db):
            if policy.mandatory:
                db.add(
                    PolicyAcceptance(
                        user_id=user.id,
                        policy_id=policy.id,
                        content_hash=policy.content_hash,
                        accepted_at=utcnow(),
                    )
                )
        db.commit()
        db.refresh(user)
        return user

    return factory


@pytest.fixture
def login(client: TestClient) -> Callable[..., tuple[str, str]]:
    """Inicia sesión y devuelve el token CSRF y el identificador de sesión."""

    def do_login(email: str, password: str = TEST_PASSWORD) -> tuple[str, str]:
        response = client.post(
            "/api/v1/auth/login",
            json={"identifier": email, "password": password},
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        return payload["csrf_token"], payload["user"]["id"]

    return do_login


@pytest.fixture
def csrf_headers() -> Callable[[str], dict[str, str]]:
    """Arma la cabecera CSRF que exigen las mutaciones."""

    def build(token: str) -> dict[str, str]:
        return {"X-CSRF-Token": token}

    return build
