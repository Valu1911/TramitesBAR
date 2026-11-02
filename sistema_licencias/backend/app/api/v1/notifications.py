"""Notificaciones internas del portal."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.db import get_db
from app.core.errors import api_error
from app.core.security import utcnow
from app.models.notification import Notification
from app.schemas.common import MessageOut
from app.schemas.notification import NotificationListOut, NotificationOut
from app.services.serializers import notification_out

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListOut)
def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user=Depends(current_user),
    db: Session = Depends(get_db),
) -> NotificationListOut:
    """Lista las notificaciones del usuario y cuántas quedan sin leer."""
    conditions = [Notification.user_id == user.id]
    if unread_only:
        conditions.append(Notification.read_at.is_(None))

    items = list(
        db.execute(
            select(Notification)
            .where(*conditions)
            .order_by(Notification.created_at.desc())
            .limit(limit)
            .offset(offset)
        ).scalars()
    )
    unread = db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user.id,
            Notification.read_at.is_(None),
        )
    ).scalar_one()
    return NotificationListOut(
        items=[notification_out(item) for item in items],
        unread=int(unread),
    )


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: int,
    user=Depends(current_user),
    db: Session = Depends(get_db),
) -> NotificationOut:
    """Marca una notificación propia como leída."""
    notification = db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
    ).scalar_one_or_none()
    if notification is None:
        raise api_error(404, "notification_not_found", "No encontramos esa notificación")
    if notification.read_at is None:
        notification.read_at = utcnow()
        db.commit()
    return notification_out(notification)


@router.post("/read-all", response_model=MessageOut)
def mark_all_read(
    user=Depends(current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    """Marca todas las notificaciones del usuario como leídas."""
    rows = db.execute(
        select(Notification).where(
            Notification.user_id == user.id,
            Notification.read_at.is_(None),
        )
    ).scalars()
    count = 0
    for item in rows:
        item.read_at = utcnow()
        count += 1
    db.commit()
    return MessageOut(message=f"Notificaciones marcadas como leídas: {count}")
