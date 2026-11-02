"""Dependencias compartidas de la API.

Acá se resuelve quién es el usuario, si la sesión sigue viva, si el token CSRF
coincide y si el rol tiene el permiso que pide la ruta. Las rutas no deberían
implementar estas reglas por su cuenta: si cambian, se cambian una sola vez.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.db import get_db
from app.core.errors import api_error
from app.core.permissions import has_permission, is_staff
from app.core.rate_limit import client_ip, enforce_rate_limit
from app.core.security import constant_time_equals, hash_token, utcnow
from app.models.user import User, UserSession

# Solo se refresca la marca de actividad cada tanto para no escribir en cada request.
_ACTIVITY_WRITE_INTERVAL = timedelta(minutes=5)


@dataclass(frozen=True)
class RequestMeta:
    """IP y user agent normalizados para auditoría y notificaciones."""

    ip: str
    user_agent: str | None


def request_meta(request: Request) -> RequestMeta:
    """Extrae los metadatos del request sin confiar en cabeceras no configuradas."""
    user_agent = request.headers.get("user-agent")
    return RequestMeta(
        ip=client_ip(request),
        user_agent=(user_agent or "")[:255] or None,
    )


def _session_cookie(request: Request) -> str | None:
    """Lee la cookie de sesión configurada."""
    return request.cookies.get(get_settings().session_cookie_name)


def _load_session(db: Session, token: str) -> UserSession:
    """Busca una sesión por el hash de su token y valida vigencia."""
    stmt = (
        select(UserSession)
        .where(UserSession.token_hash == hash_token(token))
        .options(
            selectinload(UserSession.user).selectinload(User.profile),
        )
    )
    session = db.execute(stmt).scalar_one_or_none()
    if session is None:
        raise api_error(401, "not_authenticated", "Iniciá sesión para continuar")

    now = utcnow()
    if session.revoked_at is not None or session.expires_at <= now:
        raise api_error(401, "session_expired", "Tu sesión venció. Volvé a iniciar sesión")

    # Una sesión inactiva más de lo permitido se cierra aunque no haya vencido.
    idle_limit = timedelta(minutes=get_settings().session_idle_minutes)
    if session.last_seen_at < now - idle_limit:
        session.revoked_at = now
        db.commit()
        raise api_error(401, "session_idle", "Cerramos la sesión por inactividad")

    if session.user.status != "active":
        raise api_error(403, "account_inactive", "Tu cuenta no está habilitada")

    if session.last_seen_at < now - _ACTIVITY_WRITE_INTERVAL:
        session.last_seen_at = now
        db.commit()

    return session


def current_session(
    request: Request,
    db: Session = Depends(get_db),
) -> UserSession:
    """Devuelve la sesión autenticada o corta con 401."""
    token = _session_cookie(request)
    if not token:
        raise api_error(401, "not_authenticated", "Iniciá sesión para continuar")
    return _load_session(db, token)


def _verify_csrf(request: Request, session: UserSession) -> None:
    """Valida el patrón double-submit: cabecera, cookie y hash en base.

    La cookie CSRF no es httpOnly a propósito: el frontend necesita leerla para
    mandar la cabecera. No sirve por sí sola porque también se exige el hash
    guardado del lado del servidor.
    """
    settings = get_settings()
    header = request.headers.get("x-csrf-token") or ""
    cookie = request.cookies.get(settings.csrf_cookie_name) or ""
    if not header or not cookie:
        raise api_error(403, "csrf_missing", "Falta el token de seguridad de la solicitud")
    if not constant_time_equals(header, cookie):
        raise api_error(403, "csrf_invalid", "El token de seguridad no coincide")
    if not constant_time_equals(hash_token(header), session.csrf_hash):
        raise api_error(403, "csrf_invalid", "El token de seguridad no es válido")


def current_user(
    request: Request,
    session: UserSession = Depends(current_session),
) -> User:
    """Devuelve el usuario autenticado y exige CSRF en métodos que mutan."""
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        _verify_csrf(request, session)
    return session.user


def optional_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    """Devuelve el usuario si hay sesión válida; nunca corta la solicitud."""
    token = _session_cookie(request)
    if not token:
        return None
    try:
        return _load_session(db, token).user
    except Exception:  # noqa: BLE001 - en rutas públicas la sesión inválida se ignora
        return None


def require_permission(permission: str):  # type: ignore[no-untyped-def]
    """Crea una dependencia que exige un permiso concreto.

    El personal municipal además tiene que tener MFA activo. Si todavía no lo
    configuró, solo puede usar las rutas de enrolamiento de MFA.
    """

    def dependency(user: User = Depends(current_user)) -> User:
        if not has_permission(user.role, permission):
            raise api_error(403, "forbidden", "No tenés permisos para esta acción")
        if is_staff(user.role) and not user.mfa_enabled:
            raise api_error(
                403,
                "mfa_enrollment_required",
                "El personal municipal debe activar el segundo factor antes de operar",
            )
        return user

    return dependency


def require_staff(user: User = Depends(current_user)) -> User:
    """Exige que el usuario pertenezca al personal municipal."""
    if not is_staff(user.role):
        raise api_error(403, "forbidden", "Esta sección es solo para personal municipal")
    if not user.mfa_enabled:
        raise api_error(
            403,
            "mfa_enrollment_required",
            "El personal municipal debe activar el segundo factor antes de operar",
        )
    return user


def rate_limit(action: str, limit: int, window_seconds: int, extra: str = ""):  # type: ignore[no-untyped-def]
    """Crea una dependencia de rate limiting para una acción."""

    def dependency(request: Request) -> None:
        enforce_rate_limit(
            request,
            action=action,
            limit=limit,
            window_seconds=window_seconds,
            extra=extra,
        )

    return dependency
