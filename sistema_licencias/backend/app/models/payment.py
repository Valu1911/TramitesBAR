"""Pagos por transferencia, comprobantes e importaciones de extractos."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.enums import PaymentStatus
from app.models.base import Base, BigIntPK, TimestampMixin


class Payment(Base, TimestampMixin):
    """Pago declarado por el ciudadano. Nunca guarda datos de tarjeta."""

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    procedure_id: Mapped[int] = mapped_column(
        BigIntPK,
        ForeignKey("procedures.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reference: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    method: Mapped[str] = mapped_column(String(20), default="transfer", nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=PaymentStatus.PENDING.value, index=True, nullable=False
    )
    receipt_document_id: Mapped[int | None] = mapped_column(
        BigIntPK, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    payer_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    payer_dni_masked: Mapped[str | None] = mapped_column(String(20), nullable=True)
    transfer_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(BigIntPK, nullable=True)
    second_reviewed_by: Mapped[int | None] = mapped_column(BigIntPK, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    procedure: Mapped["Procedure"] = relationship(back_populates="payment")  # noqa: F821
    receipt_document: Mapped["Document | None"] = relationship()  # noqa: F821


class PaymentImport(Base):
    """Resumen de una importación de extracto bancario."""

    __tablename__ = "payment_imports"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    total_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    matched_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    exception_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    imported_by: Mapped[int] = mapped_column(BigIntPK, ForeignKey("users.id"), nullable=False)
    details: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


__all__ = ["Payment", "PaymentImport"]
