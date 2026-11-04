"""Contratos de autenticación, perfil y MFA."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class GuardianIn(BaseModel):
    """Datos del tutor para personas menores de edad."""

    full_name: str = Field(min_length=3, max_length=150)
    dni: str = Field(pattern=r"^\d{7,8}$")
    relationship: str = Field(min_length=3, max_length=60)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)


class RegisterIn(BaseModel):
    """Alta de ciudadano."""

    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    first_name: str = Field(min_length=2, max_length=100)
    last_name: str = Field(min_length=2, max_length=100)
    dni: str = Field(pattern=r"^\d{7,8}$")
    birth_date: date
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=255)
    locality: str = Field(default="Baradero", max_length=100)
    accepted_policies: list[str] = Field(min_length=1)
    guardian: GuardianIn | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        """Normaliza espacios y rechaza nombres vacíos."""
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("El nombre no puede estar vacío")
        return cleaned


class LoginIn(BaseModel):
    """Login por correo o DNI. El segundo factor es opcional en el primer paso."""

    identifier: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)
    mfa_code: str | None = Field(default=None, max_length=10)


class ProfileOut(BaseModel):
    """Perfil público para el propio ciudadano."""

    model_config = ConfigDict(from_attributes=True)

    first_name: str
    last_name: str
    dni_masked: str
    birth_date: date
    phone: str | None = None
    address: str | None = None
    locality: str
    account_status: str = "pendiente"
    fines_count: int = 0
    fines_amount: str = "0.00"
    fines_reason: str | None = None
    fines_payment_claimed: bool = False
    welcome_dismissed: bool = False


class UserOut(BaseModel):
    """Datos de la cuenta autenticada."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    role: str
    status: str
    email_verified: bool
    mfa_enabled: bool
    profile: ProfileOut | None = None
    created_at: datetime


class SessionOut(BaseModel):
    """Respuesta de login o de consulta de sesión."""

    user: UserOut
    csrf_token: str
    mfa_enrollment_required: bool = False


class MfaSetupOut(BaseModel):
    """Datos para configurar TOTP."""

    secret: str
    otpauth_uri: str


class MfaEnableIn(BaseModel):
    """Código de verificación para activar MFA."""

    code: str = Field(min_length=6, max_length=10)


class MfaRecoveryOut(BaseModel):
    """Códigos de recuperación de un solo uso."""

    recovery_codes: list[str]


class MfaDisableIn(BaseModel):
    """Confirmación de contraseña y código para desactivar MFA."""

    password: str
    code: str


class ForgotPasswordIn(BaseModel):
    """Solicitud de recuperación."""

    email: EmailStr


class ResetPasswordIn(BaseModel):
    """Cambio de contraseña con token."""

    token: str = Field(min_length=20)
    new_password: str = Field(min_length=12, max_length=128)


class VerifyEmailIn(BaseModel):
    """Token de verificación de correo."""

    token: str = Field(min_length=20)


class ChangePasswordIn(BaseModel):
    """Cambio de contraseña autenticado."""

    current_password: str
    new_password: str = Field(min_length=12, max_length=128)


class ProfileUpdateIn(BaseModel):
    """Datos de contacto editables."""

    phone: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=255)
    locality: str | None = Field(default=None, max_length=100)


class SessionInfoOut(BaseModel):
    """Sesión activa del usuario."""

    id: int
    ip: str | None
    user_agent: str | None
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    is_current: bool = False


class ClaimFinesPaymentIn(BaseModel):
    """Notificación de pago de multas del ciudadano ('Ya pagué')."""

    message: str | None = Field(default=None, max_length=1000)


class AccountMessageIn(BaseModel):
    """Mensaje del ciudadano para el área de Tránsito."""

    message: str = Field(min_length=1, max_length=2000)


class AccountMessageOut(BaseModel):
    """Mensaje del hilo de verificación de antecedentes."""

    id: int
    sender: str
    message: str
    attachment_name: str | None = None
    attachment_url: str | None = None
    read: bool
    created_at: datetime
