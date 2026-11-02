"""Backoffice de pagos: revisión, doble control y conciliación de extractos."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import RequestMeta, rate_limit, request_meta, require_permission
from app.core.db import get_db
from app.models.user import User
from app.schemas.common import PageOut
from app.schemas.payment import PaymentAdminOut, PaymentImportOut, PaymentReviewIn
from app.services import payments as payment_service
from app.services.serializers import payment_admin_out

router = APIRouter(prefix="/admin/payments", tags=["admin-payments"])


@router.get("", response_model=PageOut)
def list_payments(
    status: str | None = Query(default=None, max_length=20),
    q: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _user: User = Depends(require_permission("payments.read")),
    db: Session = Depends(get_db),
) -> PageOut:
    """Lista pagos con filtros por estado y búsqueda."""
    rows, total = payment_service.list_payments(
        db, status=status, q=q, limit=limit, offset=offset
    )
    return PageOut(
        items=[payment_admin_out(item) for item in rows],
        total=total,
        page=(offset // limit) + 1,
        page_size=limit,
    )


@router.get("/imports", response_model=list[PaymentImportOut])
def list_imports(
    limit: int = Query(default=50, ge=1, le=100),
    _user: User = Depends(require_permission("payments.import")),
    db: Session = Depends(get_db),
) -> list[PaymentImportOut]:
    """Lista las importaciones de extractos recientes."""
    return [
        PaymentImportOut.model_validate(item)
        for item in payment_service.list_imports(db, limit=limit)
    ]


@router.get("/{payment_id}", response_model=PaymentAdminOut)
def get_payment(
    payment_id: int,
    _user: User = Depends(require_permission("payments.read")),
    db: Session = Depends(get_db),
) -> PaymentAdminOut:
    """Devuelve un pago con su trámite y ciudadano."""
    return payment_admin_out(payment_service.get_payment_or_404(db, payment_id))


@router.post("/{payment_id}/review", response_model=PaymentAdminOut)
def review_payment(
    payment_id: int,
    data: PaymentReviewIn,
    user: User = Depends(require_permission("payments.review")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> PaymentAdminOut:
    """Aprueba o rechaza un pago. Los montos altos piden otra persona."""
    payment = payment_service.get_payment_or_404(db, payment_id)
    payment = payment_service.review_payment(
        db,
        payment,
        decision=data.decision,
        notes=data.notes,
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return payment_admin_out(payment)


@router.post(
    "/import",
    response_model=PaymentImportOut,
    dependencies=[Depends(rate_limit("payment_import", 10, 3600))],
)
def import_statement(
    file: UploadFile = File(...),
    user: User = Depends(require_permission("payments.import")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> PaymentImportOut:
    """Concilia un extracto CSV o XLSX contra los pagos declarados."""
    summary = payment_service.import_statement(
        db,
        file=file,
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return PaymentImportOut.model_validate(summary)
