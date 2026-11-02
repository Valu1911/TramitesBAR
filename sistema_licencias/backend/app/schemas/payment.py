"""Contratos de pagos y conciliación."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PaymentOut(BaseModel):
    """Pago visible para el ciudadano."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    reference: str
    amount: Decimal
    method: str
    status: str
    receipt_document_id: int | None
    payer_name: str | None
    claimed_at: datetime | None
    reviewed_at: datetime | None
    review_notes: str | None


class PaymentAdminOut(PaymentOut):
    """Pago con contexto para el backoffice."""

    procedure_code: str
    citizen_email: str
    citizen_name: str
    second_reviewed_by: int | None


class PaymentReviewIn(BaseModel):
    """Aprobación o rechazo de un pago."""

    decision: Literal["approve", "reject"]
    notes: str | None = Field(default=None, max_length=2000)


class PaymentImportOut(BaseModel):
    """Resultado de importar un extracto."""

    id: int
    filename: str
    total_rows: int
    matched_rows: int
    exception_rows: int
    created_at: datetime
    details: dict


class PaymentInstructionsOut(BaseModel):
    """Datos para transferir el arancel. No incluye datos de tarjeta."""

    reference: str
    amount: Decimal
    status: str
    alias: str | None = None
    cbu: str | None = None
    holder: str | None = None
    bank: str | None = None
    message: str
