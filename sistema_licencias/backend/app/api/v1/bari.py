"""Bari: chat restringido y guías visuales de los trámites."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import rate_limit
from app.core.db import get_db
from app.schemas.catalog import BariChatIn, BariChatOut, BariGuideOut
from app.services import bari as bari_service

router = APIRouter(prefix="/bari", tags=["bari"])


@router.post(
    "/chat",
    response_model=BariChatOut,
    dependencies=[Depends(rate_limit("bari_chat", 20, 60))],
)
def chat(
    data: BariChatIn,
    db: Session = Depends(get_db),
) -> BariChatOut:
    """Responde una consulta sin recibir datos personales."""
    return bari_service.chat(db, message=data.message, context=data.context)


@router.get("/guide/{procedure_code}", response_model=BariGuideOut)
def guide(
    procedure_code: str,
    db: Session = Depends(get_db),
) -> BariGuideOut:
    """Devuelve los pasos y materiales de un tipo de trámite."""
    return bari_service.guide(db, procedure_code)
