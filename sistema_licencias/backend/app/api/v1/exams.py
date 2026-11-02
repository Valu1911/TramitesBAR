"""Backoffice del banco de preguntas y de los intentos de examen."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import RequestMeta, request_meta, require_permission
from app.core.db import get_db
from app.core.errors import api_error
from app.models.exam import ExamAttempt, Question
from app.models.procedure import Procedure
from app.models.user import User
from app.schemas.common import PageOut
from app.schemas.exam import (
    AttemptAdminOut,
    QuestionImportIn,
    QuestionIn,
    QuestionOut,
    QuestionReviewIn,
    QuestionUpdateIn,
    RetryAuthorizationOut,
)
from app.schemas.procedure import RetryAuthorizationIn
from app.services import exams as exam_service
from app.services import procedures as procedure_service
from app.services.serializers import question_out

router = APIRouter(prefix="/admin", tags=["admin-exams"])


@router.get("/questions", response_model=PageOut)
def list_questions(
    reviewed: bool | None = None,
    active: bool | None = None,
    category: str | None = Query(default=None, max_length=10),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _user: User = Depends(require_permission("questions.read")),
    db: Session = Depends(get_db),
) -> PageOut:
    """Lista el banco de preguntas con filtros de revisión."""
    rows, total = exam_service.list_questions(
        db,
        reviewed=reviewed,
        active=active,
        category=category,
        limit=limit,
        offset=offset,
    )
    return PageOut(
        items=[question_out(item) for item in rows],
        total=total,
        page=(offset // limit) + 1,
        page_size=limit,
    )


@router.post("/questions", response_model=QuestionOut, status_code=201)
def create_question(
    data: QuestionIn,
    user: User = Depends(require_permission("questions.manage")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> QuestionOut:
    """Agrega una pregunta. Nace sin revisar y no se usa en exámenes."""
    question = exam_service.create_question(
        db,
        data=data.model_dump(),
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return question_out(question)


@router.patch("/questions/{question_id}", response_model=QuestionOut)
def update_question(
    question_id: int,
    data: QuestionUpdateIn,
    user: User = Depends(require_permission("questions.manage")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> QuestionOut:
    """Edita una pregunta. Si cambia el contenido, vuelve a revisión."""
    question = db.get(Question, question_id)
    if question is None:
        raise api_error(404, "question_not_found", "No encontramos esa pregunta")
    question = exam_service.update_question(
        db,
        question,
        data=data.model_dump(exclude_unset=True),
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return question_out(question)


@router.post("/questions/{question_id}/review", response_model=QuestionOut)
def review_question(
    question_id: int,
    data: QuestionReviewIn,
    user: User = Depends(require_permission("questions.manage")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> QuestionOut:
    """Marca una pregunta como revisada o la saca de circulación."""
    question = db.get(Question, question_id)
    if question is None:
        raise api_error(404, "question_not_found", "No encontramos esa pregunta")
    question = exam_service.review_question(
        db,
        question,
        reviewed=data.reviewed,
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return question_out(question)


@router.post("/questions/import", response_model=dict)
def import_questions(
    data: QuestionImportIn,
    user: User = Depends(require_permission("questions.manage")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> dict:
    """Importa un lote de preguntas sin revisar."""
    inserted = exam_service.import_questions(
        db,
        questions=[item.model_dump() for item in data.questions],
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return {"inserted": inserted, "message": "Las preguntas quedaron pendientes de revisión"}


@router.get("/exams/attempts", response_model=PageOut)
def list_attempts(
    status: str | None = Query(default=None, max_length=20),
    procedure_id: int | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _user: User = Depends(require_permission("procedures.read")),
    db: Session = Depends(get_db),
) -> PageOut:
    """Lista intentos para soporte y auditoría, sin exponer las respuestas."""
    stmt = select(ExamAttempt).options(
        selectinload(ExamAttempt.procedure).selectinload(Procedure.user)
    )
    conditions = []
    if status:
        conditions.append(ExamAttempt.status == status)
    if procedure_id:
        conditions.append(ExamAttempt.procedure_id == procedure_id)
    if conditions:
        stmt = stmt.where(*conditions)

    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()
    rows = (
        db.execute(
            stmt.order_by(ExamAttempt.started_at.desc()).limit(limit).offset(offset)
        )
        .scalars()
        .all()
    )
    items = [
        AttemptAdminOut(
            id=item.id,
            procedure_code=item.procedure.public_code,
            citizen_email=item.procedure.user.email,
            status=item.status,
            score=item.score,
            total=item.total,
            started_at=item.started_at,
            submitted_at=item.submitted_at,
        )
        for item in rows
    ]
    return PageOut(
        items=items,
        total=int(total),
        page=(offset // limit) + 1,
        page_size=limit,
    )


@router.post(
    "/procedures/{procedure_id}/retry",
    response_model=RetryAuthorizationOut,
)
def authorize_retry(
    procedure_id: int,
    data: RetryAuthorizationIn,
    user: User = Depends(require_permission("procedures.manage")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> RetryAuthorizationOut:
    """Habilita un intento extra de examen teórico con justificación."""
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, staff=True)
    procedure = procedure_service.authorize_retry(
        db,
        procedure,
        actor=user,
        reason=data.reason,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    extra = int((procedure.data or {}).get("_extra_attempts", 0))
    return RetryAuthorizationOut(
        procedure_id=procedure.id,
        extra_attempts=extra,
        message="Intento extra habilitado y ciudadano notificado",
    )
