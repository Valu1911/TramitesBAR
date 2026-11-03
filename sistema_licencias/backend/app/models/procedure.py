"""Catálogo de trámites, matriz configurable, expedientes, pasos y documentos."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import MYSQL_TABLE_OPTIONS
from app.domain.enums import DocumentStatus, ProcedureStatus, StepStatus
from app.models.base import Base, BigIntPK, TimestampMixin

if TYPE_CHECKING:
    from app.models.exam import ExamAttempt
    from app.models.license import License
    from app.models.payment import Payment
    from app.models.user import User


class ProcedureType(Base, TimestampMixin):
    """Tipo de trámite: nueva, renovación, vencida, categoría, profesional o extravío."""

    __tablename__ = "procedure_types"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    short_description: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[str] = mapped_column(String(40), default="license", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)

    matrix: Mapped[list[ProcedureMatrix]] = relationship(
        back_populates="procedure_type", cascade="all, delete-orphan"
    )
    procedures: Mapped[list[Procedure]] = relationship(back_populates="procedure_type")


class ProcedureMatrix(Base):
    """Reglas configurables por tipo de trámite y categoría de licencia.

    Es la fuente de verdad para arancel, vigencia, pasos y exigencias. El
    municipio puede cambiarla sin tocar código (con la validación que corresponda).
    """

    __tablename__ = "procedure_matrix"
    __table_args__ = (
        UniqueConstraint(
            "procedure_type_id", "license_category", name="uq_matrix_type_category"
        ),
        MYSQL_TABLE_OPTIONS,
    )

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    procedure_type_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("procedure_types.id", ondelete="CASCADE"), index=True, nullable=False
    )
    license_category: Mapped[str] = mapped_column(String(10), nullable=False)
    min_age: Mapped[int] = mapped_column(Integer, default=17, nullable=False)
    max_age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fee_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    validity_years: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    steps: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    required_documents: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    theory_questions: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    theory_pass_ratio: Mapped[float] = mapped_column(Numeric(4, 2), default=0.8, nullable=False)
    theory_minutes: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    max_theory_attempts: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    requires_health: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    requires_practical: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)

    procedure_type: Mapped[ProcedureType] = relationship(back_populates="matrix")
    procedures: Mapped[list[Procedure]] = relationship(back_populates="matrix")


class LearningMaterial(Base, TimestampMixin):
    """Contenido de la etapa de charlas de seguridad vial."""

    __tablename__ = "learning_materials"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), default="text", nullable=False)
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)


class Procedure(Base, TimestampMixin):
    """Expediente de un trámite. El código público es el que usa el ciudadano."""

    __tablename__ = "procedures"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    public_code: Mapped[str] = mapped_column(String(24), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    procedure_type_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("procedure_types.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    matrix_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("procedure_matrix.id", ondelete="RESTRICT"), nullable=False
    )
    license_category: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=ProcedureStatus.IN_PROGRESS.value, index=True, nullable=False
    )
    current_step: Mapped[str | None] = mapped_column(String(30), nullable=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped[User] = relationship()  # noqa: F821
    procedure_type: Mapped[ProcedureType] = relationship(back_populates="procedures")
    matrix: Mapped[ProcedureMatrix] = relationship(back_populates="procedures")
    steps: Mapped[list[ProcedureStep]] = relationship(
        back_populates="procedure", cascade="all, delete-orphan", order_by="ProcedureStep.position"
    )
    documents: Mapped[list[Document]] = relationship(
        back_populates="procedure", cascade="all, delete-orphan", order_by="Document.id.desc()"
    )
    payment: Mapped[Payment | None] = relationship(  # noqa: F821
        back_populates="procedure", uselist=False, cascade="all, delete-orphan"
    )
    exam_attempts: Mapped[list[ExamAttempt]] = relationship(  # noqa: F821
        back_populates="procedure", cascade="all, delete-orphan", order_by="ExamAttempt.id.desc()"
    )
    appointments: Mapped[list[Appointment]] = relationship(  # noqa: F821
        back_populates="procedure", order_by="Appointment.scheduled_at"
    )
    license: Mapped[License | None] = relationship(  # noqa: F821
        back_populates="procedure", uselist=False, cascade="all, delete-orphan"
    )


class ProcedureStep(Base, TimestampMixin):
    """Paso secuencial del expediente."""

    __tablename__ = "procedure_steps"
    __table_args__ = (
        UniqueConstraint("procedure_id", "code", name="uq_step_procedure_code"),
        MYSQL_TABLE_OPTIONS,
    )

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    procedure_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("procedures.id", ondelete="CASCADE"), index=True, nullable=False
    )
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=StepStatus.PENDING.value, index=True, nullable=False
    )
    data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(BigIntPK, nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    procedure: Mapped[Procedure] = relationship(back_populates="steps")


class Document(Base, TimestampMixin):
    """Archivo subido por el ciudadano, con hash y estado de revisión."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    procedure_id: Mapped[int | None] = mapped_column(
        BigIntPK, ForeignKey("procedures.id", ondelete="CASCADE"), index=True, nullable=True
    )
    user_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    kind: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    mime: Mapped[str] = mapped_column(String(80), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=DocumentStatus.PENDING.value, index=True, nullable=False
    )
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(BigIntPK, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    procedure: Mapped[Procedure | None] = relationship(back_populates="documents")
    user: Mapped[User] = relationship()  # noqa: F821


class Appointment(Base, TimestampMixin):
    """Turno para el examen práctico. Cada fila es un cupo."""

    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    procedure_id: Mapped[int | None] = mapped_column(
        BigIntPK, ForeignKey("procedures.id", ondelete="SET NULL"), index=True, nullable=True
    )
    kind: Mapped[str] = mapped_column(String(20), default="practical", nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="available", index=True, nullable=False)
    instructor: Mapped[str | None] = mapped_column(String(120), nullable=True)
    result: Mapped[str | None] = mapped_column(String(20), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(BigIntPK, nullable=True)

    procedure: Mapped[Procedure | None] = relationship(back_populates="appointments")


class LicenseCounter(Base):
    """Contador atómico para números de credencial legibles."""

    __tablename__ = "license_counters"

    name: Mapped[str] = mapped_column(String(40), primary_key=True)
    counter_value: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


Index("ix_procedures_user_status", Procedure.user_id, Procedure.status)
Index("ix_procedures_type_status", Procedure.procedure_type_id, Procedure.status)
Index("ix_appointments_status_date", Appointment.status, Appointment.scheduled_at)
Index("ix_documents_procedure_kind", Document.procedure_id, Document.kind)


__all__ = [
    "ProcedureType",
    "ProcedureMatrix",
    "LearningMaterial",
    "Procedure",
    "ProcedureStep",
    "Document",
    "Appointment",
    "LicenseCounter",
]
