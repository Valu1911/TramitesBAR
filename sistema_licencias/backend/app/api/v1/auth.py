"""Rutas de autenticación, perfil, sesiones y segundo factor."""

from __future__ import annotations

import hashlib

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import (
    RequestMeta,
    current_session,
    current_user,
    rate_limit,
    request_meta,
)
from app.core.config import get_settings
from app.core.db import get_db
from app.core.errors import api_error
from app.core.rate_limit import enforce_rate_limit
from app.core.security import hash_token, new_token
from app.models.user import AccountMessage, User, UserSession
from app.schemas.auth import (
    AccountMessageIn,
    AccountMessageOut,
    ChangePasswordIn,
    ClaimFinesPaymentIn,
    ForgotPasswordIn,
    LoginIn,
    MfaDisableIn,
    MfaEnableIn,
    MfaRecoveryOut,
    MfaSetupOut,
    ProfileUpdateIn,
    RegisterIn,
    ResetPasswordIn,
    SessionInfoOut,
    SessionOut,
    UserOut,
    VerifyEmailIn,
)
from app.schemas.common import MessageOut
from app.services import auth as auth_service
from app.services.crypto import get_cipher
from app.services.serializers import account_message_out, user_out

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookies(response: Response, token: str, csrf: str) -> None:
    """Escribe la cookie de sesión httpOnly y la cookie CSRF legible."""
    settings = get_settings()
    max_age = settings.session_ttl_hours * 3600
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf,
        max_age=max_age,
        httponly=False,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )


def _clear_session_cookies(response: Response) -> None:
    """Borra ambas cookies de sesión."""
    settings = get_settings()
    response.delete_cookie(settings.session_cookie_name, path="/")
    response.delete_cookie(settings.csrf_cookie_name, path="/")


def _identifier_key(identifier: str) -> str:
    """Deriva una clave corta para rate limiting sin guardar el identificador."""
    return hashlib.sha256(identifier.strip().lower().encode("utf-8")).hexdigest()[:16]


@router.post(
    "/register",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("register", 5, 3600))],
)
def register(
    data: RegisterIn,
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> MessageOut:
    """Crea una cuenta y envía el correo de verificación."""
    auth_service.register_user(db, data=data, ip=meta.ip, user_agent=meta.user_agent)
    return MessageOut(
        message="Te enviamos un correo para verificar la cuenta. Revisá también el spam."
    )


@router.post(
    "/verify-email",
    response_model=MessageOut,
    dependencies=[Depends(rate_limit("verify_email", 10, 3600))],
)
def verify_email(
    data: VerifyEmailIn,
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> MessageOut:
    """Confirma el correo con el token de un solo uso."""
    auth_service.verify_email(
        db,
        token=data.token,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return MessageOut(message="Correo verificado. Ya podés iniciar sesión y comenzar un trámite.")


@router.post(
    "/resend-verification",
    response_model=MessageOut,
    dependencies=[Depends(rate_limit("resend_verification", 3, 3600))],
)
def resend_verification(
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
    meta: RequestMeta = Depends(request_meta),
) -> MessageOut:
    """Reenvía el correo de verificación a una cuenta que todavía no lo confirmó."""
    auth_service.resend_verification_email(
        db,
        user=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return MessageOut(message="Te enviamos un correo nuevo para verificar la cuenta.")


@router.post("/login", response_model=SessionOut)
def login(
    data: LoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> SessionOut:
    """Valida credenciales, segundo factor y abre una sesión."""
    enforce_rate_limit(request, "login", 10, 900, extra=_identifier_key(data.identifier))
    user, session, token, csrf = auth_service.authenticate(
        db,
        identifier=data.identifier,
        password=data.password,
        mfa_code=data.mfa_code,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    _set_session_cookies(response, token, csrf)
    return auth_service.session_payload(user, session, csrf)


@router.post("/logout", response_model=MessageOut)
def logout(
    response: Response,
    session: UserSession = Depends(current_session),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> MessageOut:
    """Cierra la sesión actual y borra las cookies."""
    auth_service.logout(db, session, ip=meta.ip, user_agent=meta.user_agent)
    _clear_session_cookies(response)
    return MessageOut(message="Sesión cerrada")


@router.get("/me", response_model=SessionOut)
def me(
    request: Request,
    response: Response,
    session: UserSession = Depends(current_session),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> SessionOut:
    """Devuelve el usuario autenticado y garantiza una cookie CSRF válida."""
    settings = get_settings()
    csrf = request.cookies.get(settings.csrf_cookie_name)
    if not csrf:
        csrf = new_token(24)
        session.csrf_hash = hash_token(csrf)
        db.commit()
        response.set_cookie(
            key=settings.csrf_cookie_name,
            value=csrf,
            max_age=settings.session_ttl_hours * 3600,
            httponly=False,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
            path="/",
        )
    return auth_service.session_payload(user, session, csrf)


@router.patch("/me", response_model=UserOut)
def update_profile(
    data: ProfileUpdateIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    """Actualiza los datos de contacto del ciudadano."""
    if user.profile is None:
        raise api_error(404, "profile_not_found", "No encontramos tu perfil")
    if data.phone is not None:
        user.profile.phone_encrypted = get_cipher().encrypt(data.phone) if data.phone else None
    if data.address is not None:
        user.profile.address = data.address
    if data.locality is not None:
        user.profile.locality = data.locality
    db.commit()
    return user_out(user)


@router.post("/change-password", response_model=MessageOut)
def change_password(
    data: ChangePasswordIn,
    response: Response,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> MessageOut:
    """Cambia la contraseña y cierra todas las sesiones."""
    auth_service.change_password(
        db,
        user=user,
        current_password=data.current_password,
        new_password=data.new_password,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    _clear_session_cookies(response)
    return MessageOut(message="Contraseña actualizada. Volvé a iniciar sesión.")


@router.post(
    "/forgot-password",
    response_model=MessageOut,
    dependencies=[Depends(rate_limit("forgot_password", 5, 3600))],
)
def forgot_password(
    data: ForgotPasswordIn,
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> MessageOut:
    """Envía el enlace de recuperación sin confirmar si el correo existe."""
    auth_service.request_password_reset(
        db,
        email=str(data.email),
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return MessageOut(
        message="Si existe una cuenta con ese correo, te enviamos un enlace para recuperar el acceso."
    )


@router.post(
    "/reset-password",
    response_model=MessageOut,
    dependencies=[Depends(rate_limit("reset_password", 5, 3600))],
)
def reset_password(
    data: ResetPasswordIn,
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> MessageOut:
    """Cambia la contraseña con un token de recuperación."""
    auth_service.reset_password(
        db,
        token=data.token,
        new_password=data.new_password,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return MessageOut(message="Contraseña actualizada. Ya podés iniciar sesión.")


@router.get("/sessions", response_model=list[SessionInfoOut])
def list_sessions(
    session: UserSession = Depends(current_session),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[SessionInfoOut]:
    """Lista las sesiones activas del usuario."""
    return [
        SessionInfoOut(**item)
        for item in auth_service.list_sessions(db, user=user, current_id=session.id)
    ]


@router.delete("/sessions/{session_id}", response_model=MessageOut)
def revoke_session(
    session_id: int,
    session: UserSession = Depends(current_session),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> MessageOut:
    """Revoca una sesión propia."""
    auth_service.revoke_session(
        db,
        user=user,
        session_id=session_id,
        current_id=session.id,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return MessageOut(message="Sesión revocada")


@router.post("/mfa/setup", response_model=MfaSetupOut)
def mfa_setup(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> MfaSetupOut:
    """Genera el secreto TOTP para cargar en la aplicación autenticadora."""
    secret, uri = auth_service.start_mfa_setup(db, user=user)
    return MfaSetupOut(secret=secret, otpauth_uri=uri)


@router.post("/mfa/enable", response_model=MfaRecoveryOut)
def mfa_enable(
    data: MfaEnableIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> MfaRecoveryOut:
    """Activa MFA y devuelve los códigos de recuperación una sola vez."""
    codes = auth_service.enable_mfa(
        db,
        user=user,
        code=data.code,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return MfaRecoveryOut(recovery_codes=codes)


@router.post("/mfa/disable", response_model=MessageOut)
def mfa_disable(
    data: MfaDisableIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> MessageOut:
    """Desactiva MFA para ciudadanos. El personal no puede hacerlo."""
    auth_service.disable_mfa(
        db,
        user=user,
        password=data.password,
        code=data.code,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return MessageOut(message="Segundo factor desactivado")



# ============================================================
# ESTADO DE CUENTA CIUDADANA Y MENSAJERÍA DE INFRACCIONES
# ============================================================

@router.post("/account/notify-paid", response_model=MessageOut)
def notify_fines_paid(
    data: ClaimFinesPaymentIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> MessageOut:
    """Notifica al área de Tránsito que se pagaron las multas ('Ya pagué')."""
    from app.core.security import utcnow
    from app.services.audit import record_audit

    if user.profile is None:
        raise api_error(404, "profile_not_found", "No encontramos tu perfil")

    user.profile.fines_payment_claimed = True

    body_text = "📌 [NOTIFICACIÓN DE PAGO]: El ciudadano marcó 'Ya pagué' y solicita revisión de sus antecedentes viales."
    if data.message:
        body_text += f"\nMensaje: {data.message.strip()}"

    msg = AccountMessage(
        user_id=user.id,
        admin_id=None,
        sender="citizen",
        message=body_text,
        created_at=utcnow(),
    )
    db.add(msg)

    record_audit(
        db,
        action="account.fines_payment_claimed",
        entity_type="citizen_profile",
        entity_id=user.profile.user_id,
        actor_user_id=user.id,
        actor_role=user.role,
        after={"claimed": True},
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    db.commit()

    return MessageOut(message="Notificación de pago enviada. El área de Tránsito revisará tu comprobante a la brevedad.")


@router.get("/account/messages", response_model=list[AccountMessageOut])
def list_account_messages(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[AccountMessageOut]:
    """Lista los mensajes de verificación e infracciones con el área de Tránsito."""
    from sqlalchemy import select, update

    from app.core.security import utcnow

    # Marcar como leídos los mensajes que envió el admin
    db.execute(
        update(AccountMessage)
        .where(AccountMessage.user_id == user.id, AccountMessage.sender == "admin", AccountMessage.read_at.is_(None))
        .values(read_at=utcnow())
    )
    db.commit()

    rows = db.execute(
        select(AccountMessage).where(AccountMessage.user_id == user.id).order_by(AccountMessage.created_at.asc())
    ).scalars().all()

    return [account_message_out(m) for m in rows]


@router.post("/account/messages", response_model=AccountMessageOut)
def send_account_message(
    data: AccountMessageIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> AccountMessageOut:
    """Envía un mensaje o respuesta al área de Tránsito."""
    from app.core.security import utcnow
    from app.services.audit import record_audit

    msg = AccountMessage(
        user_id=user.id,
        admin_id=None,
        sender="citizen",
        message=data.message.strip(),
        created_at=utcnow(),
    )
    db.add(msg)
    db.flush()

    record_audit(
        db,
        action="account_message.sent_by_citizen",
        entity_type="account_message",
        entity_id=msg.id,
        actor_user_id=user.id,
        actor_role=user.role,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    db.commit()

    return account_message_out(msg)


@router.post("/account/welcome-dismiss", response_model=MessageOut)
def dismiss_welcome(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    """Marca la tarjeta de bienvenida inicial como vista."""
    if user.profile is not None:
        user.profile.welcome_dismissed = True
        db.commit()
    return MessageOut(message="Bienvenida marcada como vista")
