"""Notificaciones internas, cola de correo y envío SMTP.

El correo se encola en MySQL y lo procesa un worker aparte. Si SMTP falla, el
error queda registrado y se reintenta con backoff. En desarrollo se puede usar
`EMAIL_TRANSPORT=console`, que imprime el mensaje en la consola; en producción
el arranque exige SMTP real.
"""

from __future__ import annotations

import smtplib
import ssl
from datetime import timedelta
from email.message import EmailMessage

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import utcnow
from app.models.notification import EmailOutbox, Notification
from app.models.user import User
from app.services.email_templates import render_email


def queue_email(
    db: Session,
    *,
    to_email: str,
    template: str,
    context: dict,
    idempotency_key: str,
) -> EmailOutbox | None:
    """Encola un correo una sola vez por clave de idempotencia."""
    existing = db.execute(
        select(EmailOutbox).where(EmailOutbox.idempotency_key == idempotency_key)
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    context = {**context, "frontend_url": get_settings().frontend_url}
    subject, text, html = render_email(template, context)
    row = EmailOutbox(
        to_email=to_email,
        subject=subject,
        body_text=text,
        body_html=html,
        template=template,
        status="pending",
        attempts=0,
        available_at=utcnow(),
        idempotency_key=idempotency_key,
        payload={k: str(v) for k, v in context.items() if k not in {"frontend_url"}},
        created_at=utcnow(),
    )
    db.add(row)
    db.flush()
    return row


def notify_user(
    db: Session,
    *,
    user: User,
    title: str,
    body: str,
    link: str | None = None,
    email_template: str | None = None,
    email_context: dict | None = None,
    idempotency_key: str | None = None,
) -> Notification:
    """Crea una notificación interna y, si corresponde, encola el correo."""
    notification = Notification(
        user_id=user.id,
        title=title,
        body=body,
        link=link,
        created_at=utcnow(),
    )
    db.add(notification)
    db.flush()

    if email_template is not None and idempotency_key:
        context = {"first_name": _first_name(user), **(email_context or {})}
        queue_email(
            db,
            to_email=user.email,
            template=email_template,
            context=context,
            idempotency_key=idempotency_key,
        )
    return notification


def _first_name(user: User) -> str:
    """Obtiene el nombre para saludar sin exponer el apellido."""
    if user.profile and user.profile.first_name:
        return user.profile.first_name
    return "vecino/a"


def send_email(settings: Settings, row: EmailOutbox) -> None:
    """Envía un correo por consola o SMTP. Lanza excepción si falla."""
    if settings.email_transport == "console":
        # Adaptador de desarrollo: no se usa en producción.
        print(
            "\n=== CORREO TRAMITESBAR (desarrollo) ===\n"
            f"Para: {row.to_email}\nAsunto: {row.subject}\n\n{row.body_text}\n"
            "=== FIN DEL CORREO ===\n"
        )
        return

    if settings.email_transport != "smtp":
        raise RuntimeError(f"EMAIL_TRANSPORT desconocido: {settings.email_transport}")

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = row.to_email
    message["Subject"] = row.subject
    message.set_content(row.body_text)
    if row.body_html:
        message.add_alternative(row.body_html, subtype="html")

    context = ssl.create_default_context()
    if settings.smtp_port == 465:
        with smtplib.SMTP_SSL(
            settings.smtp_host, settings.smtp_port, context=context, timeout=20
        ) as smtp:
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
        return

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        smtp.ehlo()
        if settings.smtp_tls:
            smtp.starttls(context=context)
            smtp.ehlo()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)


def process_outbox_once(db: Session, settings: Settings | None = None) -> bool:
    """Procesa un correo pendiente. Devuelve True si procesó alguno."""
    settings = settings or get_settings()
    bind = db.get_bind()
    dialect = bind.dialect.name if bind is not None else "sqlite"

    stmt = (
        select(EmailOutbox)
        .where(
            EmailOutbox.status.in_(["pending", "sending"]),
            EmailOutbox.available_at <= utcnow(),
        )
        .order_by(EmailOutbox.id.asc())
        .limit(1)
    )
    if dialect != "sqlite":
        stmt = stmt.with_for_update(skip_locked=True)

    row = db.execute(stmt).scalar_one_or_none()
    if row is None:
        return False

    # Un envío que quedó "sending" por más de 10 minutos se considera colgado.
    if row.status == "sending" and row.created_at > utcnow() - timedelta(minutes=10):
        return False

    row.status = "sending"
    db.commit()

    try:
        send_email(settings, row)
    except Exception as exc:  # noqa: BLE001 - se registra para reintento
        row.attempts += 1
        row.last_error = str(exc)[:2000]
        if row.attempts >= 5:
            row.status = "failed"
        else:
            row.status = "pending"
            row.available_at = utcnow() + timedelta(minutes=2**row.attempts)
        db.commit()
        return True

    row.status = "sent"
    row.sent_at = utcnow()
    row.last_error = None
    db.commit()
    return True


def purge_expired(db: Session) -> int:
    """Limpia tokens y sesiones vencidas. No toca auditoría ni pagos."""
    from app.models.user import AuthToken, UserSession

    now = utcnow()
    sessions = db.execute(
        select(UserSession).where(UserSession.expires_at < now - timedelta(days=30))
    ).scalars().all()
    tokens = db.execute(select(AuthToken).where(AuthToken.expires_at < now)).scalars().all()
    removed = 0
    for item in [*sessions, *tokens]:
        db.delete(item)
        removed += 1
    if removed:
        db.commit()
    return removed
