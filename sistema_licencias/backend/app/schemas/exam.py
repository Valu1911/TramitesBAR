"""Contratos del examen teórico."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AttemptQuestionOut(BaseModel):
    """Pregunta durante el examen. Nunca incluye la respuesta correcta."""

    index: int
    prompt: str
    options: list[str]


class AttemptStartOut(BaseModel):
    """Intento iniciado."""

    attempt_id: int
    questions: list[AttemptQuestionOut]
    total: int
    pass_score: int
    started_at: datetime
    expires_at: datetime


class ExamAnswerIn(BaseModel):
    """Respuesta elegida."""

    index: int = Field(ge=0)
    selected_index: int = Field(ge=0)


class ExamSubmitIn(BaseModel):
    """Entrega completa del examen."""

    answers: list[ExamAnswerIn]


class AttemptResultOut(BaseModel):
    """Resultado corregido en el servidor."""

    attempt_id: int
    status: str
    score: int
    total: int
    pass_score: int
    passed: bool
    submitted_at: datetime | None


class AttemptSummaryOut(BaseModel):
    """Resumen de un intento para el panel del ciudadano."""

    id: int
    attempt_number: int
    status: str
    score: int | None
    total: int
    started_at: datetime
    expires_at: datetime
    submitted_at: datetime | None


class QuestionIn(BaseModel):
    """Pregunta para el banco administrado."""

    category: str = Field(default="B", max_length=10)
    prompt: str = Field(min_length=10, max_length=1000)
    options: list[str] = Field(min_length=2, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    explanation: str | None = Field(default=None, max_length=2000)
    source: str | None = Field(default=None, max_length=160)


class QuestionUpdateIn(BaseModel):
    """Edición parcial de una pregunta."""

    category: str | None = Field(default=None, max_length=10)
    prompt: str | None = Field(default=None, min_length=10, max_length=1000)
    options: list[str] | None = Field(default=None, min_length=2, max_length=4)
    correct_index: int | None = Field(default=None, ge=0, le=3)
    explanation: str | None = Field(default=None, max_length=2000)
    source: str | None = Field(default=None, max_length=160)
    active: bool | None = None


class QuestionOut(BaseModel):
    """Pregunta completa para administración."""

    id: int
    category: str
    prompt: str
    options: list[str]
    correct_index: int
    explanation: str | None
    active: bool
    reviewed: bool
    source: str | None


class QuestionReviewIn(BaseModel):
    """Revisión de una pregunta."""

    reviewed: bool = True


class QuestionImportIn(BaseModel):
    """Importación de varias preguntas."""

    questions: list[QuestionIn] = Field(min_length=1, max_length=500)


class AttemptAdminOut(BaseModel):
    """Intento visible para auditoría y soporte."""

    id: int
    procedure_code: str
    citizen_email: str
    status: str
    score: int | None
    total: int
    started_at: datetime
    submitted_at: datetime | None


class RetryAuthorizationOut(BaseModel):
    """Confirmación de intento extra."""

    procedure_id: int
    extra_attempts: int
    message: str
