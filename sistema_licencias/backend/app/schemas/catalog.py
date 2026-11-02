"""Contratos del catálogo público, políticas y Bari."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class MatrixOut(BaseModel):
    """Reglas visibles de un tipo de trámite y categoría."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    license_category: str
    min_age: int
    max_age: int | None
    fee_amount: Decimal
    validity_years: int
    steps: list[str]
    required_documents: list[str]
    theory_questions: int
    theory_pass_ratio: float
    theory_minutes: int
    max_theory_attempts: int
    requires_health: bool
    requires_practical: bool
    notes: str | None


class ProcedureTypeOut(BaseModel):
    """Tipo de trámite con su matriz."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    short_description: str
    description: str
    icon: str
    sort_order: int
    matrix: list[MatrixOut]


class PolicySummaryOut(BaseModel):
    """Política sin el cuerpo completo."""

    model_config = ConfigDict(from_attributes=True)

    slug: str
    title: str
    version: int
    mandatory: bool
    content_hash: str
    effective_at: datetime


class PolicyOut(PolicySummaryOut):
    """Política completa."""

    body_md: str


class PolicyAcceptIn(BaseModel):
    """Aceptación explícita de una política."""

    accept: bool = Field(default=True)


class LearningMaterialOut(BaseModel):
    """Contenido de la etapa de charlas."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    title: str
    description: str
    kind: str
    url: str | None
    body_md: str | None
    sort_order: int


class BariChatIn(BaseModel):
    """Consulta libre a Bari. Se limpia de PII antes de cualquier modelo."""

    message: str = Field(min_length=2, max_length=500)
    context: str | None = Field(default=None, max_length=40)


class BariChatOut(BaseModel):
    """Respuesta de Bari con enlaces útiles."""

    answer: str
    intent: str
    links: list[dict[str, str]] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    source: str = "deterministic"


class BariGuideOut(BaseModel):
    """Guía visual de un trámite."""

    procedure_code: str
    procedure_name: str
    steps: list[dict]
    materials: list[LearningMaterialOut]
