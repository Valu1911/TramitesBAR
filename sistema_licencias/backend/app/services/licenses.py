"""Emisión, verificación y revocación de credenciales municipales."""

from __future__ import annotations

import secrets
from datetime import date, datetime

from sqlalchemy import select, text, update
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.errors import api_error
from app.core.security import utcnow
from app.domain.enums import LicenseStatus, ProcedureStatus, StepCode, StepStatus
from app.models.license import License
from app.models.procedure import LicenseCounter, Procedure
from app.models.user import User
from app.services.audit import record_audit
from app.services.notifications import notify_user


def _add_years(value: datetime, years: int) -> datetime:
    """Suma años manejando el 29 de febrero."""
    try:
        return value.replace(year=value.year + years)
    except ValueError:
        return value.replace(year=value.year + years, day=28)


def _next_license_number(db: Session, issued_at: datetime) -> str:
    """Incrementa el contador anual de forma atómica y arma el número."""
    year = issued_at.year
    name = str(year)
    dialect = db.get_bind().dialect.name if db.get_bind() is not None else "sqlite"

    if dialect == "mysql":
        db.execute(
            text(
                "INSERT INTO license_counters (name, counter_value) VALUES (:name, 1) "
                "ON DUPLICATE KEY UPDATE counter_value = counter_value + 1"
            ),
            {"name": name},
        )
    else:
        db.execute(
            text(
                "INSERT INTO license_counters (name, counter_value) VALUES (:name, 1) "
                "ON CONFLICT(name) DO UPDATE SET counter_value = counter_value + 1"
            ),
            {"name": name},
        )
    value = db.execute(
        select(LicenseCounter.counter_value).where(LicenseCounter.name == name)
    ).scalar_one()
    return f"BAR-{year}-{int(value):06d}"


def issue_license(
    db: Session,
    procedure: Procedure,
    *,
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> License:
    """Emite la credencial si el trámite está completo. No hace commit.

    El llamador confirma la transacción junto con el cierre del trámite.
    """
    if procedure.license is not None:
        return procedure.license
    if procedure.status != ProcedureStatus.COMPLETED.value:
        raise api_error(409, "procedure_not_completed", "El trámite todavía no está completo")

    pending = [
        step
        for step in procedure.steps
        if step.status != StepStatus.COMPLETED.value
    ]
    if pending:
        raise api_error(
            409,
            "steps_pending",
            "Todavía hay pasos sin completar",
            steps=[step.code for step in pending],
        )

    issued_at = utcnow()
    license_obj = License(
        procedure_id=procedure.id,
        user_id=procedure.user_id,
        license_number=_next_license_number(db, issued_at),
        category=procedure.license_category,
        issued_at=issued_at,
        expires_at=_add_years(issued_at, int(procedure.matrix.validity_years)),
        status=LicenseStatus.ACTIVE.value,
        qr_token=secrets.token_urlsafe(24),
    )
    db.add(license_obj)
    db.flush()

    notify_user(
        db,
        user=procedure.user,
        title="Credencial emitida",
        body=f"Ya está disponible la credencial del trámite {procedure.public_code}.",
        link="/panel/credencial",
        email_template="license_issued",
        email_context={
            "procedure_code": procedure.public_code,
            "license_number": license_obj.license_number,
            "expires_at": license_obj.expires_at.strftime("%d/%m/%Y"),
        },
        idempotency_key=f"license-issued-{license_obj.id}",
    )
    record_audit(
        db,
        action="license.issued",
        entity_type="license",
        entity_id=license_obj.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        after={
            "license_number": license_obj.license_number,
            "category": license_obj.category,
            "expires_at": license_obj.expires_at.isoformat(),
        },
        ip=ip,
        user_agent=user_agent,
    )
    return license_obj


def get_license_or_404(db: Session, license_id: int, *, user: User | None = None) -> License:
    """Busca una credencial con su dueño y perfil."""
    stmt = (
        select(License)
        .where(License.id == license_id)
        .options(selectinload(License.user).selectinload(User.profile))
    )
    license_obj = db.execute(stmt).scalar_one_or_none()
    if license_obj is None:
        raise api_error(404, "license_not_found", "No encontramos esa credencial")
    if user is not None and license_obj.user_id != user.id:
        raise api_error(404, "license_not_found", "No encontramos esa credencial")
    return license_obj


def list_user_licenses(db: Session, user: User) -> list[License]:
    """Lista las credenciales de un ciudadano."""
    return list(
        db.execute(
            select(License).where(License.user_id == user.id).order_by(License.issued_at.desc())
        ).scalars()
    )


def verify_public(db: Session, token: str) -> License | None:
    """Verifica un token QR y actualiza el estado si venció."""
    stmt = (
        select(License)
        .where(License.qr_token == token)
        .options(selectinload(License.user).selectinload(User.profile))
    )
    license_obj = db.execute(stmt).scalar_one_or_none()
    if license_obj is None:
        return None
    if (
        license_obj.status == LicenseStatus.ACTIVE.value
        and license_obj.expires_at < utcnow()
    ):
        license_obj.status = LicenseStatus.EXPIRED.value
        db.commit()
    return license_obj


def revoke_license(
    db: Session,
    license_obj: License,
    *,
    reason: str,
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> License:
    """Revoca una credencial con motivo y auditoría."""
    if license_obj.status == LicenseStatus.REVOKED.value:
        raise api_error(409, "license_already_revoked", "La credencial ya está revocada")
    license_obj.status = LicenseStatus.REVOKED.value
    license_obj.revoked_at = utcnow()
    license_obj.revocation_reason = reason
    record_audit(
        db,
        action="license.revoked",
        entity_type="license",
        entity_id=license_obj.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        after={"reason": reason},
        ip=ip,
        user_agent=user_agent,
    )
    notify_user(
        db,
        user=license_obj.user,
        title="Credencial revocada",
        body="La Municipalidad revocó tu credencial. Contactá a la oficina de licencias.",
        idempotency_key=f"license-revoked-{license_obj.id}",
    )
    db.commit()
    return license_obj


def mark_expired(db: Session) -> int:
    """Marca como vencidas las credenciales activas cuya fecha pasó."""
    result = db.execute(
        update(License)
        .where(
            License.status == LicenseStatus.ACTIVE.value,
            License.expires_at < utcnow(),
        )
        .values(status=LicenseStatus.EXPIRED.value)
    )
    db.commit()
    return int(result.rowcount or 0)


def qr_payload(license_obj: License) -> str:
    """Arma la URL pública que codifica el QR."""
    return f"{get_settings().frontend_url.rstrip('/')}/verificar/{license_obj.qr_token}"
