"""Catálogo público, materiales y políticas versionadas."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import RequestMeta, current_user, request_meta
from app.core.db import get_db
from app.models.user import User
from app.schemas.catalog import (
    LearningMaterialOut,
    PolicyOut,
    PolicySummaryOut,
    ProcedureTypeOut,
)
from app.schemas.common import MessageOut
from app.services import catalog as catalog_service
from app.services import policies as policy_service
from app.services.serializers import procedure_type_out

router = APIRouter(tags=["catalog"])


@router.get("/catalog/procedure-types", response_model=list[ProcedureTypeOut])
def list_procedure_types(
    db: Session = Depends(get_db),
) -> list[ProcedureTypeOut]:
    """Lista los trámites disponibles y sus reglas configurables."""
    return [
        procedure_type_out(item)
        for item in catalog_service.list_procedure_types(db)
    ]


@router.get("/catalog/procedure-types/{code}", response_model=ProcedureTypeOut)
def get_procedure_type(
    code: str,
    db: Session = Depends(get_db),
) -> ProcedureTypeOut:
    """Devuelve un trámite con su matriz por categoría."""
    return procedure_type_out(catalog_service.get_procedure_type(db, code))


@router.get("/catalog/materials", response_model=list[LearningMaterialOut])
def list_materials(
    db: Session = Depends(get_db),
) -> list[LearningMaterialOut]:
    """Lista los materiales de las charlas de seguridad vial."""
    return [
        LearningMaterialOut.model_validate(item)
        for item in catalog_service.list_materials(db)
    ]


@router.get("/policies", response_model=list[PolicySummaryOut])
def list_policies(
    db: Session = Depends(get_db),
) -> list[PolicySummaryOut]:
    """Lista la versión vigente de cada política."""
    return [
        PolicySummaryOut.model_validate(item)
        for item in policy_service.active_policies(db)
    ]


@router.get("/policies/pending", response_model=list[str])
def list_pending_policies(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[str]:
    """Lista los slugs de políticas obligatorias que el usuario no aceptó."""
    return policy_service.pending_policy_slugs(db, user)


@router.get("/policies/{slug}", response_model=PolicyOut)
def get_policy(
    slug: str,
    db: Session = Depends(get_db),
) -> PolicyOut:
    """Devuelve el texto completo de una política vigente."""
    return PolicyOut.model_validate(policy_service.get_policy_or_404(db, slug))


@router.post("/policies/{slug}/accept", response_model=MessageOut)
def accept_policy(
    slug: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> MessageOut:
    """Registra la aceptación explícita de una política."""
    policy = policy_service.accept_policy(
        db,
        user=user,
        slug=slug,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return MessageOut(message=f"Política aceptada: {policy.title}")
