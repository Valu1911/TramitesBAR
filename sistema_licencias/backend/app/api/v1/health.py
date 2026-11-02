"""Chequeos de vida y disponibilidad para el orquestador."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import utcnow

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    """Liveness: la app responde sin tocar dependencias."""
    settings = get_settings()
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
        "time": utcnow().isoformat(),
    }


@router.get("/health/ready")
def readiness(db: Session = Depends(get_db)) -> JSONResponse:
    """Readiness: verifica que la base responda."""
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - el health debe informar, no romper
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "database": "error", "detail": type(exc).__name__},
        )
    return JSONResponse(
        status_code=200,
        content={"status": "ready", "database": "ok"},
    )
