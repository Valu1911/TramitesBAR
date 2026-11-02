"""Consultas públicas del catálogo de trámites."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import api_error
from app.models.procedure import LearningMaterial, ProcedureType


def list_procedure_types(db: Session) -> list[ProcedureType]:
    """Lista los tipos de trámite activos con su matriz vigente."""
    return list(
        db.execute(
            select(ProcedureType)
            .where(ProcedureType.active.is_(True))
            .options(selectinload(ProcedureType.matrix))
            .order_by(ProcedureType.sort_order.asc(), ProcedureType.name.asc())
        ).scalars()
    )


def get_procedure_type(db: Session, code: str) -> ProcedureType:
    """Busca un tipo de trámite activo por código."""
    procedure_type = db.execute(
        select(ProcedureType)
        .where(ProcedureType.code == code, ProcedureType.active.is_(True))
        .options(selectinload(ProcedureType.matrix))
    ).scalar_one_or_none()
    if procedure_type is None:
        raise api_error(404, "procedure_type_not_found", "El tipo de trámite no existe")
    return procedure_type


def list_materials(db: Session) -> list[LearningMaterial]:
    """Lista los materiales activos de seguridad vial."""
    return list(
        db.execute(
            select(LearningMaterial)
            .where(LearningMaterial.active.is_(True))
            .order_by(LearningMaterial.sort_order.asc())
        ).scalars()
    )
