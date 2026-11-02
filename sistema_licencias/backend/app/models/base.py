"""Base declarativa y tipos comunes de los modelos."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

# BIGINT en MySQL, INTEGER en SQLite para que el autoincremental funcione en tests.
BigIntPK = BigInteger().with_variant(Integer, "sqlite")


class TimestampMixin:
    """Agrega fecha de creación y de última modificación."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


__all__ = ["Base", "BigIntPK", "TimestampMixin"]
