"""Rutas del ciudadano: trámites, documentos, pagos, exámenes y turnos."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import RequestMeta, current_user, rate_limit, request_meta
from app.core.config import get_settings
from app.core.db import get_db
from app.core.errors import api_error
from app.core.security import safe_filename
from app.domain.enums import DocumentKind, ExamStatus, StepCode
from app.models.exam import ExamAttempt
from app.models.payment import Payment
from app.models.user import User
from app.schemas.common import MessageOut
from app.schemas.exam import (
    AttemptResultOut,
    AttemptStartOut,
    AttemptSummaryOut,
    ExamProctoringTokenOut,
    ExamSubmitIn,
)
from app.schemas.payment import PaymentInstructionsOut, PaymentOut
from app.schemas.procedure import (
    AppointmentOut,
    BookAppointmentIn,
    DeliveryIn,
    DocumentOut,
    HealthFormIn,
    LearningCompleteIn,
    PaymentClaimIn,
    ProcedureCreateIn,
    ProcedureListItem,
    ProcedureOut,
)
from app.services import exams as exam_service
from app.services import procedures as procedure_service
from app.services.audit import record_audit
from app.services.serializers import (
    appointment_out,
    document_out,
    payment_out,
    procedure_list_item,
    procedure_out,
)
from app.services.storage import read_file, save_upload

router = APIRouter(tags=["procedures"])

# Solo estos documentos tienen un paso asociado en la v1.
_DOCUMENT_STEP = {
    DocumentKind.HEALTH_CERTIFICATE.value: StepCode.HEALTH.value,
    DocumentKind.PAYMENT_RECEIPT.value: StepCode.PAYMENT.value,
}


@router.post(
    "/procedures",
    response_model=ProcedureOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("procedure_create", 10, 3600))],
)
def create_procedure(
    data: ProcedureCreateIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> ProcedureOut:
    """Inicia un expediente a partir de la matriz configurada."""
    procedure = procedure_service.create_procedure(
        db,
        user,
        procedure_type_code=data.procedure_type,
        license_category=data.license_category,
        data=data.data,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return procedure_out(procedure)


@router.get("/procedures/mine", response_model=list[ProcedureListItem])
def list_my_procedures(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[ProcedureListItem]:
    """Lista los trámites del ciudadano autenticado."""
    return [
        procedure_list_item(item)
        for item in procedure_service.list_user_procedures(db, user)
    ]


@router.get("/procedures/{procedure_id}", response_model=ProcedureOut)
def get_procedure(
    procedure_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ProcedureOut:
    """Devuelve el expediente completo del ciudadano."""
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, user=user)
    return procedure_out(procedure)


@router.post("/procedures/{procedure_id}/learning/complete", response_model=ProcedureOut)
def complete_learning(
    procedure_id: int,
    data: LearningCompleteIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> ProcedureOut:
    """Registra que el ciudadano vio los materiales obligatorios."""
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, user=user)
    procedure = procedure_service.complete_learning(
        db,
        procedure,
        material_ids=data.material_ids,
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return procedure_out(procedure)


@router.post("/procedures/{procedure_id}/health", response_model=ProcedureOut)
def submit_health(
    procedure_id: int,
    data: HealthFormIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> ProcedureOut:
    """Registra la declaración de salud y deja el certificado a revisión."""
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, user=user)
    procedure = procedure_service.submit_health(
        db,
        procedure,
        form=data.model_dump(),
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return procedure_out(procedure)


@router.post(
    "/procedures/{procedure_id}/documents",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("document_upload", 20, 3600))],
)
def upload_document(
    procedure_id: int,
    kind: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> DocumentOut:
    """Sube un documento validando el paso y el tipo real del archivo."""
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, user=user)
    if kind not in {item.value for item in DocumentKind}:
        raise api_error(422, "invalid_document_kind", "Tipo de documento no permitido")

    expected_step = _DOCUMENT_STEP.get(kind)
    if expected_step is not None:
        if procedure.current_step != expected_step:
            raise api_error(
                409,
                "step_out_of_order",
                "Ese documento no corresponde a la etapa actual del trámite",
            )
    elif kind == DocumentKind.GUARDIAN_AUTHORIZATION.value:
        if not get_settings().features_minors:
            raise api_error(
                403,
                "minors_online_disabled",
                "La autorización digital de tutores todavía no está habilitada",
            )
    else:
        raise api_error(
            422,
            "document_kind_not_allowed",
            "Por ahora solo aceptamos certificados de salud y comprobantes de pago",
        )

    stored = save_upload(file, kind)
    document = procedure_service.upload_document(
        db,
        procedure,
        stored=stored,
        kind=kind,
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return document_out(document)


@router.get("/procedures/{procedure_id}/documents/{document_id}/download")
def download_document(
    procedure_id: int,
    document_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> Response:
    """Entrega un documento propio con validación de permisos y auditoría."""
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, user=user)
    document = next(
        (item for item in procedure.documents if item.id == document_id),
        None,
    )
    if document is None:
        raise api_error(404, "document_not_found", "No encontramos ese documento")

    content = read_file(document.storage_key)
    record_audit(
        db,
        action="document.downloaded",
        entity_type="document",
        entity_id=document.id,
        actor_user_id=user.id,
        actor_role=user.role,
        after={"procedure_id": procedure.id, "kind": document.kind},
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    db.commit()
    headers = {
        "Content-Disposition": f'inline; filename="{safe_filename(document.original_name)}"',
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
    }
    return Response(content=content, media_type=document.mime, headers=headers)


@router.get(
    "/procedures/{procedure_id}/payment/instructions",
    response_model=PaymentInstructionsOut,
)
def payment_instructions(
    procedure_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PaymentInstructionsOut:
    """Devuelve referencia, monto y datos de transferencia configurados."""
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, user=user)
    payment = db.execute(
        select(Payment).where(Payment.procedure_id == procedure.id)
    ).scalar_one_or_none()
    reference = payment.reference if payment else f"PAGO-{procedure.public_code}"
    amount = payment.amount if payment else procedure.matrix.fee_amount
    payment_status = payment.status if payment else "pending"
    settings = get_settings()

    if settings.payment_alias or settings.payment_cbu:
        message = "Transferí el monto exacto e incluí la referencia en el concepto."
    else:
        message = (
            "Los datos de transferencia están pendientes de configuración municipal. "
            "Consultá en la oficina de licencias antes de pagar."
        )

    return PaymentInstructionsOut(
        reference=reference,
        amount=amount,
        status=payment_status,
        alias=settings.payment_alias or None,
        cbu=settings.payment_cbu or None,
        holder=settings.payment_holder or None,
        bank=settings.payment_bank or None,
        message=message,
    )


@router.post(
    "/procedures/{procedure_id}/payment/claim",
    response_model=PaymentOut,
    dependencies=[Depends(rate_limit("payment_claim", 10, 3600))],
)
def claim_payment(
    procedure_id: int,
    data: PaymentClaimIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> PaymentOut:
    """Declara una transferencia con su comprobante."""
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, user=user)
    payment = procedure_service.claim_payment(
        db,
        procedure,
        receipt_document_id=data.receipt_document_id,
        payer_name=data.payer_name,
        payer_dni=data.payer_dni,
        transfer_date=data.transfer_date,
        notes=data.notes,
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return payment_out(payment)


@router.get(
    "/procedures/{procedure_id}/exam/attempts",
    response_model=list[AttemptSummaryOut],
)
def list_attempts(
    procedure_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[AttemptSummaryOut]:
    """Lista los intentos de examen teórico del expediente."""
    procedure_service.get_procedure_or_404(db, procedure_id, user=user)
    rows = db.execute(
        select(ExamAttempt)
        .where(
            ExamAttempt.procedure_id == procedure_id,
            ExamAttempt.user_id == user.id,
        )
        .order_by(ExamAttempt.attempt_number.asc())
    ).scalars()
    return [
        AttemptSummaryOut(
            id=item.id,
            attempt_number=item.attempt_number,
            status=item.status,
            score=item.score,
            total=item.total,
            started_at=item.started_at,
            expires_at=item.expires_at,
            submitted_at=item.submitted_at,
        )
        for item in rows
    ]



@router.post(
    "/procedures/{procedure_id}/exam/proctoring-token",
    response_model=ExamProctoringTokenOut,
    dependencies=[Depends(rate_limit("exam_token", 30, 3600))],
)
def get_exam_proctoring_token(
    procedure_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ExamProctoringTokenOut:
    """Obtiene el token de conexión LiveKit para la sesión supervisada de examen."""
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, user=user)
    if procedure.current_step != StepCode.THEORY.value:
        raise api_error(409, "step_not_current", "El examen teórico no es la etapa actual del trámite")
    return exam_service.create_proctoring_token(procedure, user)


@router.post(
    "/procedures/{procedure_id}/exam/start",
    response_model=AttemptStartOut,
    dependencies=[Depends(rate_limit("exam_start", 10, 3600))],
)
def start_exam(
    procedure_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> AttemptStartOut:
    """Inicia o retoma el intento de examen teórico."""
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, user=user)
    attempt = exam_service.start_attempt(
        db,
        procedure,
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return exam_service.attempt_start_out(attempt, procedure)


@router.post(
    "/procedures/{procedure_id}/exam/{attempt_id}/submit",
    response_model=AttemptResultOut,
    dependencies=[Depends(rate_limit("exam_submit", 20, 3600))],
)
def submit_exam(
    procedure_id: int,
    attempt_id: int,
    data: ExamSubmitIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> AttemptResultOut:
    """Corrige el examen en el servidor y avanza el trámite si aprueba."""
    procedure_service.get_procedure_or_404(db, procedure_id, user=user)
    attempt = exam_service.get_attempt_or_404(db, attempt_id, user=user)
    if attempt.procedure_id != procedure_id:
        raise api_error(404, "attempt_not_found", "No encontramos ese intento")
    if attempt.status != ExamStatus.IN_PROGRESS.value:
        raise api_error(409, "attempt_closed", "Ese intento ya fue entregado")
    return exam_service.submit_attempt(
        db,
        attempt,
        answers=data.answers,
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )


@router.get("/appointments/available", response_model=list[AppointmentOut])
def available_appointments(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[AppointmentOut]:
    """Lista cupos disponibles para el examen práctico."""
    # Los cupos públicos no exponen las notas internas que carga el municipio.
    return [
        appointment_out(item).model_copy(update={"notes": None})
        for item in procedure_service.available_appointments(db)
    ]


@router.post(
    "/procedures/{procedure_id}/appointment",
    response_model=AppointmentOut,
    dependencies=[Depends(rate_limit("appointment_book", 10, 3600))],
)
@router.post(
    "/procedures/{procedure_id}/appointments/{appointment_id}/book",
    response_model=AppointmentOut,
    dependencies=[Depends(rate_limit("appointment_book", 10, 3600))],
)
def book_appointment(
    procedure_id: int,
    appointment_id: int | None = None,
    data: BookAppointmentIn | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> AppointmentOut:
    """Reserva un cupo de examen práctico."""
    app_id = appointment_id if appointment_id is not None else (data.appointment_id if data else None)
    if app_id is None:
        raise api_error(422, "missing_appointment_id", "Falta el identificador del turno")
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, user=user)
    appointment = procedure_service.book_appointment(
        db,
        procedure,
        appointment_id=app_id,
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return appointment_out(appointment)


@router.post("/procedures/{procedure_id}/delivery", response_model=ProcedureOut)
def submit_delivery(
    procedure_id: int,
    data: DeliveryIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> ProcedureOut:
    """Registra cómo quiere recibir la credencial el ciudadano."""
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, user=user)
    procedure = procedure_service.submit_delivery(
        db,
        procedure,
        method=data.method,
        address=data.address,
        notes=data.notes,
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return procedure_out(procedure)


@router.post("/procedures/{procedure_id}/cancel", response_model=MessageOut)
def cancel_procedure(
    procedure_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> MessageOut:
    """Cancela un trámite propio que todavía no fue completado."""
    from app.domain.enums import ProcedureStatus

    procedure = procedure_service.get_procedure_or_404(db, procedure_id, user=user)
    if procedure.status not in {
        ProcedureStatus.IN_PROGRESS.value,
        ProcedureStatus.UNDER_REVIEW.value,
    }:
        raise api_error(409, "procedure_not_cancellable", "Ese trámite ya no se puede cancelar")

    before = procedure.status
    procedure.status = ProcedureStatus.CANCELLED.value
    procedure.current_step = None
    record_audit(
        db,
        action="procedure.cancelled",
        entity_type="procedure",
        entity_id=procedure.id,
        actor_user_id=user.id,
        actor_role=user.role,
        before={"status": before},
        after={"status": procedure.status},
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    db.commit()
    return MessageOut(message="Trámite cancelado")
