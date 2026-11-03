"""Banco de preguntas, intentos y respuestas del examen teórico."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.enums import ExamStatus
from app.models.base import Base, BigIntPK, TimestampMixin

if TYPE_CHECKING:
    from app.models.procedure import Procedure


class Question(Base, TimestampMixin):
    """Pregunta del banco. Solo las revisadas se usan en exámenes."""

    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(String(10), default="B", index=True, nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    correct_index: Mapped[int] = mapped_column(Integer, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)
    reviewed: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    source: Mapped[str | None] = mapped_column(String(160), nullable=True)


class ExamAttempt(Base, TimestampMixin):
    """Intento de examen.

    Las preguntas se congelan en `questions` al iniciar para que una edición
    posterior del banco no altere un intento en curso ni su corrección.
    """

    __tablename__ = "exam_attempts"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    procedure_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("procedures.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    attempt_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=ExamStatus.IN_PROGRESS.value, index=True, nullable=False
    )
    questions: Mapped[list[dict]] = mapped_column(JSON, nullable=False)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    procedure: Mapped[Procedure] = relationship(back_populates="exam_attempts")  # noqa: F821
    answers: Mapped[list[ExamAnswer]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan"
    )


class ExamAnswer(Base):
    """Respuesta elegida por el ciudadano, con corrección del servidor."""

    __tablename__ = "exam_answers"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    attempt_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("exam_attempts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    question_index: Mapped[int] = mapped_column(Integer, nullable=False)
    selected_index: Mapped[int] = mapped_column(Integer, nullable=False)
    correct: Mapped[bool] = mapped_column(Boolean, nullable=False)

    attempt: Mapped[ExamAttempt] = relationship(back_populates="answers")


__all__ = ["Question", "ExamAttempt", "ExamAnswer"]
