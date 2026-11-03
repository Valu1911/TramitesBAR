"""Comandos operativos de TramitesBAR.

No hay contraseñas por defecto. Los usuarios se crean por consola, con una
contraseña escrita por el operador y validada con la misma política que usa la
API. El personal municipal queda obligado a enrolar MFA en el primer ingreso.
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_session_factory
from app.core.security import hash_password, utcnow, validate_password_strength
from app.domain.enums import Role, UserStatus
from app.models.user import User
from app.seed import seed_all
from app.services.audit import record_audit
from app.services.auth import normalize_email
from app.services.notifications import purge_expired

STAFF_ROLES = [
    Role.ADMIN.value,
    Role.ADMIN_PAGOS.value,
    Role.ADMIN_SALUD.value,
    Role.ADMIN_TURNOS.value,
    Role.ADMIN_CUENTAS.value,
    Role.SUPERADMIN.value,
]


def _read_password() -> str:
    """Lee una contraseña por consola o desde TB_PASSWORD para automatización."""
    from_env = os.environ.get("TB_PASSWORD")
    if from_env:
        return from_env
    first = getpass.getpass("Contraseña: ")
    second = getpass.getpass("Repetir contraseña: ")
    if first != second:
        raise SystemExit("Las contraseñas no coinciden")
    return first


def _create_user(
    db: Session,
    *,
    email: str,
    role: str,
    password: str,
) -> User:
    """Crea una cuenta operativa verificada y sin MFA enrolado."""
    try:
        validate_password_strength(password)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    normalized = normalize_email(email)
    existing = db.execute(select(User).where(User.email == normalized)).scalar_one_or_none()
    if existing is not None:
        raise SystemExit("Ya existe una cuenta con ese correo")

    user = User(
        email=normalized,
        password_hash=hash_password(password),
        role=role,
        status=UserStatus.ACTIVE.value,
        email_verified_at=utcnow(),
        mfa_enabled=False,
    )
    # Las cuentas operativas se crean ya verificadas: el alta la hizo un
    # administrador, no el ciudadano.
    db.add(user)
    db.flush()
    record_audit(
        db,
        action="user.created_by_cli",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=None,
        actor_role="cli",
        after={"email": normalized, "role": role},
        ip=None,
        user_agent="cli",
    )
    db.commit()
    return user


def command_seed(_args: argparse.Namespace) -> int:
    """Carga el contenido inicial sin usuarios ni datos de ejemplo."""
    settings = get_settings()
    settings.validate_runtime()
    db = get_session_factory()()
    try:
        result = seed_all(db)
    finally:
        db.close()
    for key, value in result.items():
        print(f"{key}: {value}")
    return 0


def command_create_superadmin(args: argparse.Namespace) -> int:
    """Crea la primera cuenta de superadministración."""
    settings = get_settings()
    settings.validate_runtime()
    db = get_session_factory()()
    try:
        password = _read_password()
        user = _create_user(db, email=args.email, role=Role.SUPERADMIN.value, password=password)
        print(f"Superadministrador creado: {user.email}")
        print("Al ingresar, el sistema va a pedir el enrolamiento de MFA.")
    finally:
        db.close()
    return 0


def command_create_staff(args: argparse.Namespace) -> int:
    """Crea una cuenta de personal municipal con rol acotado."""
    if args.role not in STAFF_ROLES:
        raise SystemExit(f"Rol inválido. Opciones: {', '.join(STAFF_ROLES)}")
    settings = get_settings()
    settings.validate_runtime()
    db = get_session_factory()()
    try:
        password = _read_password()
        user = _create_user(db, email=args.email, role=args.role, password=password)
        print(f"Cuenta creada: {user.email} ({user.role})")
        print("Al ingresar, el sistema va a pedir el enrolamiento de MFA.")
    finally:
        db.close()
    return 0


def command_reset_password(args: argparse.Namespace) -> int:
    """Cambia la contraseña de una cuenta y revoca sus sesiones."""
    from sqlalchemy import update

    from app.models.user import UserSession

    settings = get_settings()
    settings.validate_runtime()
    db = get_session_factory()()
    try:
        user = db.execute(
            select(User).where(User.email == normalize_email(args.email))
        ).scalar_one_or_none()
        if user is None:
            raise SystemExit("No existe una cuenta con ese correo")
        password = _read_password()
        try:
            validate_password_strength(password)
        except ValueError as exc:
            raise SystemExit(str(exc)) from exc
        user.password_hash = hash_password(password)
        user.failed_login_count = 0
        user.locked_until = None
        db.execute(
            update(UserSession)
            .where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
            .values(revoked_at=utcnow())
        )
        record_audit(
            db,
            action="user.password_reset_by_cli",
            entity_type="user",
            entity_id=user.id,
            actor_user_id=None,
            actor_role="cli",
            ip=None,
            user_agent="cli",
        )
        db.commit()
        print(f"Contraseña actualizada para {user.email}. Se cerraron sus sesiones.")
    finally:
        db.close()
    return 0


def command_purge(_args: argparse.Namespace) -> int:
    """Limpia tokens y sesiones vencidas."""
    settings = get_settings()
    settings.validate_runtime()
    db = get_session_factory()()
    try:
        removed = purge_expired(db)
        print(f"Registros eliminados: {removed}")
    finally:
        db.close()
    return 0


def build_parser() -> argparse.ArgumentParser:
    """Arma el parser de la CLI."""
    parser = argparse.ArgumentParser(description="Comandos operativos de TramitesBAR")
    sub = parser.add_subparsers(dest="command", required=True)

    seed_parser = sub.add_parser("seed", help="Carga tipos, matriz, materiales, políticas y preguntas")
    seed_parser.set_defaults(func=command_seed)

    super_parser = sub.add_parser("create-superadmin", help="Crea la cuenta de superadministración")
    super_parser.add_argument("--email", required=True)
    super_parser.set_defaults(func=command_create_superadmin)

    staff_parser = sub.add_parser("create-staff", help="Crea una cuenta de personal municipal")
    staff_parser.add_argument("--email", required=True)
    staff_parser.add_argument("--role", required=True, choices=STAFF_ROLES)
    staff_parser.set_defaults(func=command_create_staff)

    reset_parser = sub.add_parser("reset-password", help="Cambia la contraseña de una cuenta")
    reset_parser.add_argument("--email", required=True)
    reset_parser.set_defaults(func=command_reset_password)

    purge_parser = sub.add_parser("purge", help="Limpia tokens y sesiones vencidas")
    purge_parser.set_defaults(func=command_purge)

    return parser


def main(argv: list[str] | None = None) -> int:
    """Ejecuta el comando indicado."""
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
