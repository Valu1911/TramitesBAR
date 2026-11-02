"""Contratos de trámites, pasos, documentos y turnos."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.catalog import MatrixOut, ProcedureTypeOut
from app.schemas.payment import PaymentOut


class DocumentOut(BaseModel):
    """Documento subido, sin exponer la ruta interna."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    original_name: str
    mime: str
    size_bytes: int
    status: str
    review_notes: str | None
    created_at: datetime


class StepOut(BaseModel):
    """Paso del expediente."""

    model_config = ConfigDict(from_attributes=True)

    code: str
    label: str
    position: int
    status: str
    data: dict
    notes: str | None
    completed_at: datetime | None


class LicenseSummaryOut(BaseModel):
    """Credencial asociada al trámite."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    license_number: str
    category: str
    issued_at: datetime
    expires_at: datetime
    status: str
    qr_token: str


class ProcedureListItem(BaseModel):
    """Resumen para el panel del ciudadano."""

    id: int
    public_code: str
    procedure_type_code: str
    procedure_type_name: str
    license_category: str
    status: str
    current_step: str | None
    created_at: datetime
    completed_at: datetime | None


class ProcedureOut(BaseModel):
    """Expediente completo visible para su dueño."""

    id: int
    public_code: str
    procedure_type: ProcedureTypeOut
    matrix: MatrixOut
    license_category: str
    status: str
    current_step: str | None
    steps: list[StepOut]
    documents: list[DocumentOut]
    payment: PaymentOut | None
    license: LicenseSummaryOut | None
    data: dict
    rejection_reason: str | None
    created_at: datetime
    submitted_at: datetime | None
    completed_at: datetime | None


class ProcedureCreateIn(BaseModel):
    """Alta de un trámite."""

    procedure_type: str = Field(min_length=3, max_length=30)
    license_category: str = Field(min_length=1, max_length=10)
    data: dict = Field(default_factory=dict)


class HealthFormIn(BaseModel):
    """Declaración de salud. El certificado se sube como documento aparte."""

    blood_type: str = Field(max_length=10)
    conditions: str | None = Field(default=None, max_length=2000)
    medications: str | None = Field(default=None, max_length=2000)
    allergies: str | None = Field(default=None, max_length=2000)
    emergency_contact_name: str = Field(min_length=3, max_length=150)
    emergency_contact_phone: str = Field(min_length=6, max_length=30)
    declares_apt: bool


class LearningCompleteIn(BaseModel):
    """Materiales que el ciudadano declara haber visto."""

    material_ids: list[int] = Field(min_length=1)


class PaymentClaimIn(BaseModel):
    """Comprobante de transferencia declarado."""

    receipt_document_id: int
    payer_name: str = Field(min_length=3, max_length=150)
    payer_dni: str = Field(pattern=r"^\d{7,8}$")
    transfer_date: date | None = None
    notes: str | None = Field(default=None, max_length=1000)


class DeliveryIn(BaseModel):
    """Preferencia de entrega de la credencial."""

    method: Literal["pickup", "home"]
    address: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=1000)


class BookAppointmentIn(BaseModel):
    """Reserva de un turno práctico."""

    appointment_id: int


class AppointmentOut(BaseModel):
    """Turno disponible o reservado."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    scheduled_at: datetime
    location: str
    instructor: str | None
    status: str
    result: str | None
    notes: str | None


class UserSummaryOut(BaseModel):
    """Datos mínimos del ciudadano para el backoffice."""

    id: int
    email: str
    name: str
    dni_masked: str


class AdminProcedureOut(ProcedureOut):
    """Expediente con datos del ciudadano para el backoffice."""

    citizen: UserSummaryOut


class DocumentReviewIn(BaseModel):
    """Decisión sobre un documento."""

    decision: Literal["approve", "reject"]
    notes: str | None = Field(default=None, max_length=2000)


class ProcedureStepReviewIn(BaseModel):
    """Decisión sobre un paso que requiere revisión humana."""

    decision: Literal["approve", "reject"]
    notes: str | None = Field(default=None, max_length=2000)


class DeliveryCompleteIn(BaseModel):
    """Confirmación de entrega y emisión de credencial."""

    notes: str | None = Field(default=None, max_length=1000)


class ProcedureRejectIn(BaseModel):
    """Rechazo de un expediente con motivo obligatorio."""

    reason: str = Field(min_length=10, max_length=2000)


class RetryAuthorizationIn(BaseModel):
    """Autorización de un intento extra de examen teórico."""

    reason: str = Field(min_length=5, max_length=1000)
