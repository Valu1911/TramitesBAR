"""Auditoría append-only con cadena de hashes y configuración del sistema."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntPK, TimestampMixin


class AuditLog(Base):
    """Registro de acciones. No se actualiza ni se borra desde la aplicación.

    `entry_hash` encadena el registro anterior con el actual. Si alguien altera
    una fila, la verificación de cadena falla. El anclaje externo (WORM/S3
    Object Lock) queda documentado como paso operativo.
    """

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    actor_user_id: Mapped[int | None] = mapped_column(
        BigIntPK, ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    actor_role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    action: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(50), index=True, nullable=True)
    before: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    prev_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entry_hash: Mapped[str] = mapped_column(String(64), nullable=False)


class Setting(Base, TimestampMixin):
    """Configuración editable por administración. Los secretos no van acá."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, nullable=False)
    updated_by: Mapped[int | None] = mapped_column(BigIntPK, nullable=True)


__all__ = ["AuditLog", "Setting"]
