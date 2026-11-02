"""Contratos del backoffice."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class DashboardOut(BaseModel):
    """Resumen operativo para administración."""

    procedures_by_status: dict[str, int]
    payments_pending: int
    documents_pending: int
    appointments_upcoming: int
    licenses_active: int
    users_total: int
    questions_reviewed: int
    questions_pending: int


class UserAdminOut(BaseModel):
    """Usuario visible para administración, con DNI enmascarado."""

    id: int
    email: str
    role: str
    status: str
    email_verified: bool
    mfa_enabled: bool
    name: str | None
    dni_masked: str | None
    created_at: datetime
    last_login_at: datetime | None


class UserAdminUpdate(BaseModel):
    """Cambio de estado o rol. El rol solo lo puede cambiar un superadmin."""

    status: Literal["active", "suspended", "pending"] | None = None
    role: str | None = None


class AppointmentCreateIn(BaseModel):
    """Alta de un cupo para examen práctico."""

    scheduled_at: datetime
    location: str = Field(min_length=3, max_length=255)
    kind: str = Field(default="practical", max_length=20)
    capacity: int = Field(default=1, ge=1, le=20)
    instructor: str | None = Field(default=None, max_length=120)


class AppointmentUpdateIn(BaseModel):
    """Actualización de un turno y su resultado."""

    status: Literal["available", "booked", "completed", "no_show", "cancelled"] | None = None
    result: Literal["passed", "failed"] | None = None
    notes: str | None = Field(default=None, max_length=2000)
    instructor: str | None = Field(default=None, max_length=120)


class AdminAppointmentOut(BaseModel):
    """Turno con contexto del trámite para el backoffice."""

    id: int
    scheduled_at: datetime
    location: str
    kind: str
    capacity: int
    status: str
    instructor: str | None
    result: str | None
    notes: str | None
    procedure_id: int | None
    procedure_code: str | None
    citizen_name: str | None


class PolicyCreateIn(BaseModel):
    """Nueva versión de una política."""

    slug: str = Field(min_length=3, max_length=60)
    title: str = Field(min_length=3, max_length=160)
    body_md: str = Field(min_length=50)
    mandatory: bool = True
    applies_to: str = Field(default="all", max_length=30)


class AuditOut(BaseModel):
    """Entrada de auditoría."""

    id: int
    actor_user_id: int | None
    actor_role: str | None
    action: str
    entity_type: str
    entity_id: str | None
    before: dict | None
    after: dict | None
    ip: str | None
    created_at: datetime
    entry_hash: str


class AuditVerifyOut(BaseModel):
    """Resultado de verificar la cadena de auditoría."""

    valid: bool
    checked: int
    broken_at: int | None
    message: str
