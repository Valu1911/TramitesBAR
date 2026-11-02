"""Alta, login, sesiones, tokens y segundo factor.

Reglas que concentra este módulo:
- No se revela si un correo o DNI existe.
- Las contraseñas se verifican con Argon2id y los errores son genéricos.
- La sesión es opaca y del lado del servidor; el token nunca se guarda en claro.
- El personal municipal no puede operar sin MFA.
"""

from __future__ import annotations

from datetime import date, timedelta
from functools import lru_cache

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.errors import api_error
from app.core.security import (
    blind_index,
    generate_recovery_codes,
    generate_totp_secret,
    hash_password,
    hash_recovery_code,
    hash_token,
    hash_token as _hash_token,
    mask_email,
    new_token,
    password_needs_rehash,
    totp_uri,
    utcnow,
    validate_password_strength,
    verify_password,
    verify_totp,
)
from app.domain.enums import GuardianStatus, Role, TokenPurpose, UserStatus
from app.models.user import AuthToken, CitizenProfile, GuardianConsent, User, UserSession
from app.schemas.auth import GuardianIn, RegisterIn, SessionOut
from app.services.audit import record_audit
from app.services.crypto import get_cipher
from app.services.notifications import queue_email
from app.services.policies import accept_for_registration
from app.services.procedures import age_at
from app.services.serializers import user_out

_EMAIL_TOKEN_TTL = timedelta(hours=24)
_RESET_TOKEN_TTL = timedelta(minutes=30)
_MAX_FAILED_LOGINS = 5
_LOCK_MINUTES = 15


@lru_cache
def _dummy_hash() -> str:
    """Hash de relleno para igualar el tiempo cuando el usuario no existe."""
    return hash_password(new_token(24))


def normalize_email(email: str) -> str:
    """Normaliza el correo para almacenarlo y compararlo."""
    return email.strip().lower()


def _email_verified_link(token: str) -> str:
    """Arma el enlace de verificación que recibe el ciudadano."""
    base = get_settings().frontend_url.rstrip("/")
    return f"{base}/verificar-correo?token={token}"


def _reset_link(token: str) -> str:
    """Arma el enlace de recuperación de contraseña."""
    base = get_settings().frontend_url.rstrip("/")
    return f"{base}/recuperar?token={token}"


def find_user_by_identifier(db: Session, identifier: str) -> User | None:
    """Busca por correo o por DNI usando el índice ciego."""
    value = identifier.strip()
    stmt = select(User).options(selectinload(User.profile))
    if "@" in value:
        return db.execute(stmt.where(User.email == normalize_email(value))).scalar_one_or_none()

    digits = "".join(ch for ch in value if ch.isdigit())
    if len(digits) not in {7, 8}:
        return None
    digest = blind_index(digits, get_settings().dni_hmac_key)
    return db.execute(
        stmt.join(CitizenProfile, CitizenProfile.user_id == User.id).where(
            CitizenProfile.dni_hmac == digest
        )
    ).scalar_one_or_none()


def _issue_token(
    db: Session,
    *,
    user: User,
    purpose: str,
    ttl: timedelta,
) -> str:
    """Invalida tokens anteriores del mismo propósito y crea uno nuevo."""
    now = utcnow()
    db.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == purpose,
            AuthToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    token = new_token(32)
    db.add(
        AuthToken(
            user_id=user.id,
            purpose=purpose,
            token_hash=hash_token(token),
            expires_at=now + ttl,
            created_at=now,
        )
    )
    db.flush()
    return token


def register_user(
    db: Session,
    *,
    data: RegisterIn,
    ip: str | None,
    user_agent: str | None,
) -> User:
    """Crea la cuenta, el perfil y las aceptaciones de políticas."""
    settings = get_settings()
    email = normalize_email(str(data.email))

    try:
        validate_password_strength(data.password)
    except ValueError as exc:
        raise api_error(422, "weak_password", str(exc)) from exc

    existing = db.execute(select(User.id).where(User.email == email)).first()
    if existing is not None:
        raise api_error(409, "email_taken", "Ya existe una cuenta con ese correo")

    dni_digest = blind_index(data.dni, settings.dni_hmac_key)
    dni_taken = db.execute(
        select(CitizenProfile.user_id).where(CitizenProfile.dni_hmac == dni_digest)
    ).first()
    if dni_taken is not None:
        raise api_error(409, "dni_taken", "Ya existe una cuenta con ese DNI")

    age = age_at(data.birth_date)
    if age < 18:
        if not settings.features_minors:
            raise api_error(
                403,
                "minors_online_disabled",
                "Por ahora los trámites de menores se inician de forma presencial",
            )
        if data.guardian is None:
            raise api_error(
                422,
                "guardian_required",
                "Para una persona menor de edad necesitamos los datos del tutor",
            )

    cipher = get_cipher()
    user = User(
        email=email,
        password_hash=hash_password(data.password),
        role=Role.CITIZEN.value,
        status=UserStatus.ACTIVE.value,
        mfa_enabled=False,
    )
    db.add(user)
    db.flush()

    db.add(
        CitizenProfile(
            user_id=user.id,
            first_name=data.first_name,
            last_name=data.last_name,
            dni_encrypted=cipher.encrypt(data.dni) or "",
            dni_hmac=dni_digest,
            birth_date=data.birth_date,
            phone_encrypted=cipher.encrypt(data.phone) if data.phone else None,
            address=data.address,
            locality=data.locality,
        )
    )

    # El consentimiento del tutor queda pendiente de revisión humana.
    if age < 18 and data.guardian is not None:
        _create_guardian_consent(
            db,
            user=user,
            guardian=data.guardian,
            ip=ip,
            user_agent=user_agent,
        )

    accept_for_registration(
        db,
        user=user,
        slugs=data.accepted_policies,
        ip=ip,
        user_agent=user_agent,
    )

    token = _issue_token(
        db,
        user=user,
        purpose=TokenPurpose.VERIFY_EMAIL.value,
        ttl=_EMAIL_TOKEN_TTL,
    )
    queue_email(
        db,
        to_email=user.email,
        template="verify_email",
        context={
            "first_name": data.first_name,
            "verify_url": _email_verified_link(token),
        },
        idempotency_key=f"verify-email-{user.id}-{token[:8]}",
    )
    record_audit(
        db,
        action="user.registered",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=user.id,
        actor_role=user.role,
        after={"email_masked": mask_email(user.email)},
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return user


def _create_guardian_consent(
    db: Session,
    *,
    user: User,
    guardian: GuardianIn,
    ip: str | None,
    user_agent: str | None,
) -> GuardianConsent:
    """Guarda la autorización del tutor pendiente de revisión."""
    settings = get_settings()
    cipher = get_cipher()
    consent = GuardianConsent(
        user_id=user.id,
        guardian_name=guardian.full_name,
        guardian_dni_encrypted=cipher.encrypt(guardian.dni) or "",
        guardian_dni_hmac=blind_index(guardian.dni, settings.dni_hmac_key),
        relationship=guardian.relationship,
        guardian_email_encrypted=cipher.encrypt(str(guardian.email)) if guardian.email else None,
        guardian_phone_encrypted=cipher.encrypt(guardian.phone) if guardian.phone else None,
        status=GuardianStatus.PENDING.value,
        accepted_at=utcnow(),
        ip=ip,
        user_agent=(user_agent or "")[:255] or None,
        created_at=utcnow(),
    )
    db.add(consent)
    db.flush()
    return consent


def verify_email(db: Session, *, token: str, ip: str | None, user_agent: str | None) -> User:
    """Consume el token de verificación y habilita el correo."""
    now = utcnow()
    row = db.execute(
        select(AuthToken)
        .where(
            AuthToken.token_hash == hash_token(token),
            AuthToken.purpose == TokenPurpose.VERIFY_EMAIL.value,
        )
        .options(selectinload(AuthToken.user))
    ).scalar_one_or_none()
    if row is None or row.used_at is not None or row.expires_at <= now:
        raise api_error(400, "invalid_token", "El enlace no es válido o ya venció")

    user = row.user
    row.used_at = now
    if user.email_verified_at is None:
        user.email_verified_at = now
    record_audit(
        db,
        action="user.email_verified",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=user.id,
        actor_role=user.role,
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return user


def resend_verification_email(
    db: Session,
    *,
    user: User,
    ip: str | None,
    user_agent: str | None,
) -> None:
    """Emite un token nuevo y reenvía el correo de verificación."""
    if user.email_verified:
        raise api_error(409, "email_already_verified", "El correo ya está verificado")

    token = _issue_token(
        db,
        user=user,
        purpose=TokenPurpose.VERIFY_EMAIL.value,
        ttl=_EMAIL_TOKEN_TTL,
    )
    queue_email(
        db,
        to_email=user.email,
        template="verify_email",
        context={
            "first_name": user.profile.first_name if user.profile else "vecino/a",
            "verify_url": _email_verified_link(token),
        },
        idempotency_key=f"verify-email-resend-{user.id}-{token[:8]}",
    )
    record_audit(
        db,
        action="user.email_verification_resent",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=user.id,
        actor_role=user.role,
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()


def _verify_mfa_code(user: User, code: str) -> bool:
    """Valida TOTP o un código de recuperación de un solo uso."""
    if user.mfa_secret_enc:
        secret = get_cipher().decrypt(user.mfa_secret_enc)
        if secret and verify_totp(secret, code):
            return True

    hashes = list(user.mfa_recovery_hashes or [])
    code_hash = hash_recovery_code(code)
    if code_hash in hashes:
        hashes.remove(code_hash)
        user.mfa_recovery_hashes = hashes
        return True
    return False


def authenticate(
    db: Session,
    *,
    identifier: str,
    password: str,
    mfa_code: str | None,
    ip: str | None,
    user_agent: str | None,
) -> tuple[User, UserSession, str, str]:
    """Valida credenciales y crea una sesión nueva.

    Devuelve `(usuario, sesión, token_plano, csrf_plano)`.
    """
    now = utcnow()
    user = find_user_by_identifier(db, identifier)

    if user is None:
        # Verificamos contra un hash de relleno para no filtrar por tiempo.
        verify_password(password, _dummy_hash())
        raise api_error(401, "invalid_credentials", "Correo, DNI o contraseña incorrectos")

    if user.locked_until is not None and user.locked_until > now:
        raise api_error(
            423,
            "account_locked",
            "La cuenta está bloqueada temporalmente por intentos fallidos. Probá más tarde.",
        )
    if user.status == UserStatus.SUSPENDED.value:
        raise api_error(403, "account_suspended", "La cuenta está suspendida")

    if not verify_password(password, user.password_hash):
        user.failed_login_count += 1
        if user.failed_login_count >= _MAX_FAILED_LOGINS:
            user.locked_until = now + timedelta(minutes=_LOCK_MINUTES)
            user.failed_login_count = 0
        db.commit()
        raise api_error(401, "invalid_credentials", "Correo, DNI o contraseña incorrectos")

    if user.mfa_enabled:
        if not mfa_code:
            raise api_error(401, "mfa_required", "Ingresá el código del segundo factor")
        if not _verify_mfa_code(user, mfa_code.strip()):
            user.failed_login_count += 1
            if user.failed_login_count >= _MAX_FAILED_LOGINS:
                user.locked_until = now + timedelta(minutes=_LOCK_MINUTES)
                user.failed_login_count = 0
            db.commit()
            raise api_error(401, "mfa_invalid", "El código del segundo factor no es válido")

    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)

    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now

    session, token, csrf = _create_session(db, user=user, ip=ip, user_agent=user_agent)
    record_audit(
        db,
        action="auth.login",
        entity_type="session",
        entity_id=session.id,
        actor_user_id=user.id,
        actor_role=user.role,
        after={"mfa": user.mfa_enabled},
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return user, session, token, csrf


def _create_session(
    db: Session,
    *,
    user: User,
    ip: str | None,
    user_agent: str | None,
) -> tuple[UserSession, str, str]:
    """Crea una sesión opaca y devuelve los tokens en claro una sola vez."""
    settings = get_settings()
    now = utcnow()
    token = new_token(32)
    csrf = new_token(24)
    session = UserSession(
        user_id=user.id,
        token_hash=hash_token(token),
        csrf_hash=hash_token(csrf),
        ip=ip,
        user_agent=(user_agent or "")[:255] or None,
        created_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(hours=settings.session_ttl_hours),
    )
    db.add(session)
    db.flush()
    return session, token, csrf


def session_payload(user: User, session: UserSession, csrf: str) -> SessionOut:
    """Arma la respuesta de login con el estado de enrolamiento de MFA."""
    from app.core.permissions import is_staff

    return SessionOut(
        user=user_out(user),
        csrf_token=csrf,
        mfa_enrollment_required=is_staff(user.role) and not user.mfa_enabled,
    )


def logout(db: Session, session: UserSession, *, ip: str | None, user_agent: str | None) -> None:
    """Revoca la sesión actual."""
    if session.revoked_at is None:
        session.revoked_at = utcnow()
        record_audit(
            db,
            action="auth.logout",
            entity_type="session",
            entity_id=session.id,
            actor_user_id=session.user_id,
            actor_role=session.user.role,
            ip=ip,
            user_agent=user_agent,
        )
        db.commit()


def change_password(
    db: Session,
    *,
    user: User,
    current_password: str,
    new_password: str,
    ip: str | None,
    user_agent: str | None,
) -> None:
    """Cambia la contraseña y cierra todas las sesiones abiertas."""
    if not verify_password(current_password, user.password_hash):
        raise api_error(401, "invalid_password", "La contraseña actual no es correcta")
    try:
        validate_password_strength(new_password)
    except ValueError as exc:
        raise api_error(422, "weak_password", str(exc)) from exc
    if verify_password(new_password, user.password_hash):
        raise api_error(422, "password_reused", "La contraseña nueva tiene que ser distinta")

    user.password_hash = hash_password(new_password)
    _revoke_all_sessions(db, user_id=user.id)
    record_audit(
        db,
        action="auth.password_changed",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=user.id,
        actor_role=user.role,
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()


def _revoke_all_sessions(db: Session, *, user_id: int) -> None:
    """Marca como revocadas todas las sesiones activas de un usuario."""
    db.execute(
        update(UserSession)
        .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )


def request_password_reset(
    db: Session,
    *,
    email: str,
    ip: str | None,
    user_agent: str | None,
) -> None:
    """Encola el correo de recuperación solo si la cuenta existe y está activa."""
    user = db.execute(
        select(User).where(User.email == normalize_email(email))
    ).scalar_one_or_none()
    if user is None or user.status != UserStatus.ACTIVE.value:
        return

    token = _issue_token(
        db,
        user=user,
        purpose=TokenPurpose.RESET_PASSWORD.value,
        ttl=_RESET_TOKEN_TTL,
    )
    queue_email(
        db,
        to_email=user.email,
        template="reset_password",
        context={"first_name": user.profile.first_name if user.profile else "vecino/a",
                 "reset_url": _reset_link(token)},
        idempotency_key=f"reset-password-{user.id}-{token[:8]}",
    )
    record_audit(
        db,
        action="auth.password_reset_requested",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=user.id,
        actor_role=user.role,
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()


def reset_password(
    db: Session,
    *,
    token: str,
    new_password: str,
    ip: str | None,
    user_agent: str | None,
) -> User:
    """Consume el token, cambia la contraseña y revoca las sesiones."""
    now = utcnow()
    row = db.execute(
        select(AuthToken)
        .where(
            AuthToken.token_hash == hash_token(token),
            AuthToken.purpose == TokenPurpose.RESET_PASSWORD.value,
        )
        .options(selectinload(AuthToken.user))
    ).scalar_one_or_none()
    if row is None or row.used_at is not None or row.expires_at <= now:
        raise api_error(400, "invalid_token", "El enlace no es válido o ya venció")

    try:
        validate_password_strength(new_password)
    except ValueError as exc:
        raise api_error(422, "weak_password", str(exc)) from exc

    user = row.user
    user.password_hash = hash_password(new_password)
    user.failed_login_count = 0
    user.locked_until = None
    row.used_at = now
    _revoke_all_sessions(db, user_id=user.id)
    record_audit(
        db,
        action="auth.password_reset",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=user.id,
        actor_role=user.role,
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return user


def start_mfa_setup(db: Session, *, user: User) -> tuple[str, str]:
    """Genera un secreto TOTP pendiente y devuelve secreto y URI."""
    if user.mfa_enabled:
        raise api_error(409, "mfa_already_enabled", "El segundo factor ya está activo")
    secret = generate_totp_secret()
    user.mfa_pending_secret_enc = get_cipher().encrypt(secret)
    db.commit()
    return secret, totp_uri(secret, user.email)


def enable_mfa(
    db: Session,
    *,
    user: User,
    code: str,
    ip: str | None,
    user_agent: str | None,
) -> list[str]:
    """Activa MFA tras verificar el código y entrega códigos de recuperación."""
    if user.mfa_enabled:
        raise api_error(409, "mfa_already_enabled", "El segundo factor ya está activo")
    if not user.mfa_pending_secret_enc:
        raise api_error(409, "mfa_setup_required", "Primero generá el secreto del segundo factor")
    secret = get_cipher().decrypt(user.mfa_pending_secret_enc)
    if not verify_totp(secret, code.strip()):
        raise api_error(422, "mfa_code_invalid", "El código no es válido")

    recovery = generate_recovery_codes(10)
    user.mfa_secret_enc = user.mfa_pending_secret_enc
    user.mfa_pending_secret_enc = None
    user.mfa_enabled = True
    user.mfa_recovery_hashes = [hash_recovery_code(item) for item in recovery]
    record_audit(
        db,
        action="auth.mfa_enabled",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=user.id,
        actor_role=user.role,
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return recovery


def disable_mfa(
    db: Session,
    *,
    user: User,
    password: str,
    code: str,
    ip: str | None,
    user_agent: str | None,
) -> None:
    """Desactiva MFA. El personal municipal no puede hacerlo."""
    from app.core.permissions import is_staff

    if is_staff(user.role):
        raise api_error(
            403,
            "mfa_required_for_staff",
            "El personal municipal no puede desactivar el segundo factor",
        )
    if not user.mfa_enabled:
        raise api_error(409, "mfa_not_enabled", "El segundo factor no está activo")
    if not verify_password(password, user.password_hash):
        raise api_error(401, "invalid_password", "La contraseña no es correcta")
    if not _verify_mfa_code(user, code.strip()):
        raise api_error(422, "mfa_code_invalid", "El código no es válido")

    user.mfa_enabled = False
    user.mfa_secret_enc = None
    user.mfa_pending_secret_enc = None
    user.mfa_recovery_hashes = None
    record_audit(
        db,
        action="auth.mfa_disabled",
        entity_type="user",
        entity_id=user.id,
        actor_user_id=user.id,
        actor_role=user.role,
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()


def list_sessions(db: Session, *, user: User, current_id: int) -> list[dict]:
    """Lista sesiones activas del usuario, marcando la actual."""
    rows = db.execute(
        select(UserSession)
        .where(
            UserSession.user_id == user.id,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > utcnow(),
        )
        .order_by(UserSession.last_seen_at.desc())
    ).scalars()
    return [
        {
            "id": row.id,
            "ip": row.ip,
            "user_agent": row.user_agent,
            "created_at": row.created_at,
            "last_seen_at": row.last_seen_at,
            "expires_at": row.expires_at,
            "is_current": row.id == current_id,
        }
        for row in rows
    ]


def revoke_session(
    db: Session,
    *,
    user: User,
    session_id: int,
    current_id: int,
    ip: str | None,
    user_agent: str | None,
) -> None:
    """Revoca una sesión propia. No permite tocar sesiones de otros."""
    row = db.execute(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.user_id == user.id,
        )
    ).scalar_one_or_none()
    if row is None:
        raise api_error(404, "session_not_found", "No encontramos esa sesión")
    if row.revoked_at is None:
        row.revoked_at = utcnow()
        record_audit(
            db,
            action="auth.session_revoked",
            entity_type="session",
            entity_id=row.id,
            actor_user_id=user.id,
            actor_role=user.role,
            after={"current": row.id == current_id},
            ip=ip,
            user_agent=user_agent,
        )
        db.commit()


__all__ = [
    "authenticate",
    "change_password",
    "disable_mfa",
    "enable_mfa",
    "find_user_by_identifier",
    "list_sessions",
    "logout",
    "normalize_email",
    "register_user",
    "request_password_reset",
    "reset_password",
    "revoke_session",
    "session_payload",
    "start_mfa_setup",
    "verify_email",
]
