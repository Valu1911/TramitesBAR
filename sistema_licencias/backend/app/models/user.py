"""Usuarios, perfiles, sesiones, tokens y autorizaciones de tutor."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm import relationship as orm_relationship

from app.domain.enums import AccountStatus, GuardianStatus, Role, TokenPurpose, UserStatus
from app.models.base import Base, BigIntPK, TimestampMixin


class User(Base, TimestampMixin):
    """Cuenta de acceso. El rol y el estado se validan en cada request."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default=Role.CITIZEN.value, index=True)
    status: Mapped[str] = mapped_column(String(20), default=UserStatus.ACTIVE.value, index=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    mfa_secret_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    mfa_pending_secret_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mfa_recovery_hashes: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    profile: Mapped[CitizenProfile | None] = orm_relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    guardian_consents: Mapped[list[GuardianConsent]] = orm_relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def email_verified(self) -> bool:
        """Indica si el correo fue verificado."""
        return self.email_verified_at is not None


class CitizenProfile(Base, TimestampMixin):
    """Datos personales del ciudadano. El DNI se guarda cifrado y con índice ciego."""

    __tablename__ = "citizen_profiles"

    user_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    dni_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    dni_hmac: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    phone_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    locality: Mapped[str] = mapped_column(String(100), default="Baradero", nullable=False)
    account_status: Mapped[str] = mapped_column(String(20), default=AccountStatus.PENDING.value, index=True)
    fines_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fines_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    fines_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    fines_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fines_payment_claimed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    welcome_dismissed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped[User] = orm_relationship(back_populates="profile")


class UserSession(Base):
    """Sesión opaca del lado del servidor.

    El token viaja en una cookie httpOnly; acá se guarda solo su hash. El token
    CSRF también se guarda hasheado y se valida en cada mutación.
    """

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    csrf_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped[User] = orm_relationship()


class AuthToken(Base):
    """Token de un solo uso para verificar correo o recuperar contraseña."""

    __tablename__ = "auth_tokens"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    purpose: Mapped[str] = mapped_column(String(30), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    user: Mapped[User] = orm_relationship()


class GuardianConsent(Base):
    """Autorización del tutor para el trámite de una persona menor de edad.

    La función está desactivada por defecto hasta que exista dictamen legal.
    El registro existe para no bloquear la implementación futura.
    """

    __tablename__ = "guardian_consents"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    guardian_name: Mapped[str] = mapped_column(String(150), nullable=False)
    guardian_dni_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    guardian_dni_hmac: Mapped[str] = mapped_column(String(64), nullable=False)
    relationship: Mapped[str] = mapped_column(String(60), nullable=False)
    guardian_email_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    guardian_phone_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=GuardianStatus.PENDING.value, index=True)
    evidence_document_id: Mapped[int | None] = mapped_column(BigIntPK, nullable=True)
    accepted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(BigIntPK, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    user: Mapped[User] = orm_relationship(back_populates="guardian_consents")


Index("ix_sessions_user_revoked", UserSession.user_id, UserSession.revoked_at)
Index("ix_auth_tokens_user_purpose", AuthToken.user_id, AuthToken.purpose)



class AccountMessage(Base):
    """Mensajería bidireccional entre el ciudadano y el área de Tránsito para infracciones."""

    __tablename__ = "account_messages"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    admin_id: Mapped[int | None] = mapped_column(
        BigIntPK, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    sender: Mapped[str] = mapped_column(String(10), nullable=False)  # "citizen" | "admin"
    message: Mapped[str] = mapped_column(Text, nullable=False)
    attachment_storage_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    attachment_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    user: Mapped[User] = orm_relationship(foreign_keys=[user_id])
    admin: Mapped[User | None] = orm_relationship(foreign_keys=[admin_id])


__all__ = [
    "AccountMessage",
    "User",
    "CitizenProfile",
    "UserSession",
    "AuthToken",
    "GuardianConsent",
    "Role",
    "TokenPurpose",
]
