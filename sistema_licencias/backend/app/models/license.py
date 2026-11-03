"""Credenciales municipales con verificación pública por QR."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.enums import LicenseStatus
from app.models.base import Base, BigIntPK, TimestampMixin

if TYPE_CHECKING:
    from app.models.procedure import Procedure
    from app.models.user import User


class License(Base, TimestampMixin):
    """Credencial emitida. No se presenta como licencia nacional hasta dictamen legal."""

    __tablename__ = "licenses"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    procedure_id: Mapped[int] = mapped_column(
        BigIntPK,
        ForeignKey("procedures.id", ondelete="RESTRICT"),
        unique=True,
        index=True,
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    license_number: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(10), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=LicenseStatus.ACTIVE.value, index=True, nullable=False
    )
    qr_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revocation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    procedure: Mapped[Procedure] = relationship(back_populates="license")  # noqa: F821
    user: Mapped[User] = relationship()  # noqa: F821


__all__ = ["License"]
