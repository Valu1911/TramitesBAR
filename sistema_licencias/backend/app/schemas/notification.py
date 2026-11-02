"""Contratos de notificaciones internas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    """Notificación del portal."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    body: str
    link: str | None
    read_at: datetime | None
    created_at: datetime


class NotificationListOut(BaseModel):
    """Listado con contador de no leídas."""

    items: list[NotificationOut]
    unread: int
