"""Esquemas comunes de respuesta."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class MessageOut(BaseModel):
    """Mensaje simple para operaciones sin cuerpo."""

    message: str


class ErrorOut(BaseModel):
    """Contrato de error de la API."""

    code: str
    message: str
    fields: list[dict[str, Any]] | None = None


class PageOut(BaseModel):
    """Respuesta paginada genérica."""

    items: list[Any]
    total: int
    page: int
    page_size: int
