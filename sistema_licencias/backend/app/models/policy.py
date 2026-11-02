"""Políticas versionadas y aceptaciones con evidencia."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BigIntPK, TimestampMixin


class Policy(Base, TimestampMixin):
    """Documento legal versionado. Cambiar el texto exige una versión nueva."""

    __tablename__ = "policies"
    __table_args__ = (UniqueConstraint("slug", "version", name="uq_policies_slug_version"),)

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(60), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    body_md: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    mandatory: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    applies_to: Mapped[str] = mapped_column(String(30), default="all", nullable=False)
    effective_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)


class PolicyAcceptance(Base):
    """Registro inmutable de aceptación de una política por un usuario."""

    __tablename__ = "policy_acceptances"
    __table_args__ = (
        UniqueConstraint("user_id", "policy_id", name="uq_policy_acceptance_user_policy"),
    )

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    policy_id: Mapped[int] = mapped_column(
        BigIntPK, ForeignKey("policies.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    accepted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)

    policy: Mapped[Policy] = relationship()


__all__ = ["Policy", "PolicyAcceptance"]
