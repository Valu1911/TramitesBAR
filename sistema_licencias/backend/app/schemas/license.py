"""Contratos de credenciales y verificación pública."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LicenseOut(BaseModel):
    """Credencial del ciudadano."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    license_number: str
    category: str
    issued_at: datetime
    expires_at: datetime
    status: str
    qr_token: str
    verify_path: str = ""


class PublicLicenseOut(BaseModel):
    """Respuesta de verificación pública. No expone DNI ni datos de contacto."""

    found: bool
    license_number: str | None = None
    holder: str | None = None
    category: str | None = None
    status: str | None = None
    issued_at: datetime | None = None
    expires_at: datetime | None = None
    municipality: str = "Municipalidad de Baradero"
    message: str
    verified_at: datetime


class LicenseRevokeIn(BaseModel):
    """Revocación de credencial."""

    reason: str = Field(min_length=10, max_length=1000)


class LicenseAdminItem(BaseModel):
    """Credencial con contexto para el backoffice."""

    id: int
    license_number: str
    category: str
    issued_at: datetime
    expires_at: datetime
    status: str
    citizen_email: str
    citizen_name: str
    procedure_code: str
