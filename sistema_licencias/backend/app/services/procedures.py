"""Motor de trámites: creación, pasos, documentos y transiciones.

Este módulo concentra las reglas de negocio. Las rutas solo validan permisos y
traducen a HTTP; así el flujo se puede testear sin levantar FastAPI.
"""

from __future__ import annotations

import secrets
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.errors import api_error
from app.core.security import mask_dni, utcnow
from app.domain.enums import (
    AppointmentResult,
    AppointmentStatus,
    DocumentKind,
    DocumentStatus,
    GuardianStatus,
    PaymentStatus,
    ProcedureStatus,
    StepCode,
    StepStatus,
)
from app.models.payment import Payment
from app.models.procedure import (
    Appointment,
    Document,
    LearningMaterial,
    Procedure,
    ProcedureMatrix,
    ProcedureStep,
    ProcedureType,
)
from app.models.user import CitizenProfile, GuardianConsent, User
from app.core.security import blind_index
from app.services.audit import record_audit
from app.services.notifications import notify_user
from app.services.policies import pending_policies as _pending_policies


def age_at(birth_date: date, on_date: date | None = None) -> int:
    """Calcula la edad cumplida a una fecha."""
    today = on_date or date.today()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


def get_procedure_or_404(
    db: Session, procedure_id: int, *, user: User | None = None, staff: bool = False
) -> Procedure:
    """Busca un expediente con todas sus relaciones.

    Si se pasa un ciudadano, se exige que sea el dueño. Para staff se asume que
    el permiso ya fue validado en la ruta.
    """
    stmt = (
        select(Procedure)
        .where(Procedure.id == procedure_id)
        .options(
            selectinload(Procedure.procedure_type).selectinload(ProcedureType.matrix),
            selectinload(Procedure.matrix),
            selectinload(Procedure.steps),
            selectinload(Procedure.documents),
            selectinload(Procedure.payment),
            selectinload(Procedure.license),
            selectinload(Procedure.user).selectinload(User.profile),
            selectinload(Procedure.exam_attempts),
            selectinload(Procedure.appointments),
        )
    )
    procedure = db.execute(stmt).scalar_one_or_none()
    if procedure is None:
        raise api_error(404, "procedure_not_found", "No encontramos ese trámite")
    if user is not None and procedure.user_id != user.id:
        # No revelamos que el trámite existe.
        raise api_error(404, "procedure_not_found", "No encontramos ese trámite")
    if not staff and user is None:
        raise api_error(403, "forbidden", "No tenés acceso a ese trámite")
    return procedure


def list_user_procedures(db: Session, user: User) -> list[Procedure]:
    """Lista los trámites de un ciudadano."""
    stmt = (
        select(Procedure)
        .where(Procedure.user_id == user.id)
        .options(
            selectinload(Procedure.procedure_type).selectinload(ProcedureType.matrix),
            selectinload(Procedure.matrix),
        )
        .order_by(Procedure.created_at.desc())
    )
    return list(db.execute(stmt).scalars().all())


def pending_policy_slugs(db: Session, user: User) -> list[str]:
    """Devuelve los slugs pendientes para el frontend."""
    from app.services.policies import pending_policy_slugs as _pending_slugs

    return _pending_slugs(db, user)


def _generate_public_code(db: Session) -> str:
    """Genera un código público único y legible."""
    for _ in range(20):
        code = f"TB-{date.today().year}-{secrets.token_hex(3).upper()}"
        exists = db.execute(select(Procedure.id).where(Procedure.public_code == code)).first()
        if not exists:
            return code
    raise api_error(500, "code_generation_failed", "No se pudo generar el código del trámite")


def _matrix_for(
    db: Session, procedure_type_code: str, license_category: str
) -> tuple[ProcedureType, ProcedureMatrix]:
    """Busca el tipo y la fila de matriz aplicable."""
    stmt = (
        select(ProcedureType)
        .where(ProcedureType.code == procedure_type_code, ProcedureType.active.is_(True))
        .options(selectinload(ProcedureType.matrix))
    )
    procedure_type = db.execute(stmt).scalar_one_or_none()
    if procedure_type is None:
        raise api_error(404, "procedure_type_not_found", "El tipo de trámite no existe")

    matrix = next(
        (
            item
            for item in procedure_type.matrix
            if item.active and item.license_category.upper() == license_category.upper()
        ),
        None,
    )
    if matrix is None:
        raise api_error(
            404,
            "matrix_not_found",
            "No hay una configuración vigente para esa categoría. Consultá en la oficina de licencias.",
        )
    return procedure_type, matrix


def create_procedure(
    db: Session,
    user: User,
    *,
    procedure_type_code: str,
    license_category: str,
    data: dict,
    ip: str | None,
    user_agent: str | None,
) -> Procedure:
    """Crea un expediente y sus pasos a partir de la matriz configurada."""
    settings = get_settings()

    if not user.email_verified:
        raise api_error(
            403,
            "email_not_verified",
            "Primero verificá tu correo electrónico para iniciar un trámite",
        )
    if user.profile is None:
        raise api_error(403, "profile_incomplete", "Completá tus datos personales")

    pendientes = _pending_policies(db, user)
    if pendientes:
        raise api_error(
            403,
            "policies_pending",
            "Tenés que aceptar las políticas vigentes antes de iniciar un trámite",
            policies=[policy.slug for policy in pendientes],
        )

    procedure_type, matrix = _matrix_for(db, procedure_type_code, license_category)
    age = age_at(user.profile.birth_date)
    if age < matrix.min_age:
        raise api_error(
            403,
            "age_not_allowed",
            f"Para este trámite necesitás tener al menos {matrix.min_age} años",
        )
    if matrix.max_age is not None and age > matrix.max_age:
        raise api_error(
            403,
            "age_not_allowed",
            f"Este trámite tiene un máximo de {matrix.max_age} años",
        )

    # Los menores requieren autorización de tutor y revisión legal previa.
    if age < 18:
        if not settings.features_minors:
            raise api_error(
                403,
                "minors_online_disabled",
                "Por ahora los trámites de menores se inician de forma presencial. "
                "La autorización digital del tutor está pendiente de aprobación legal.",
            )
        consent = db.execute(
            select(GuardianConsent)
            .where(
                GuardianConsent.user_id == user.id,
                GuardianConsent.status == GuardianStatus.APPROVED.value,
            )
            .order_by(GuardianConsent.id.desc())
            .limit(1)
        ).scalar_one_or_none()
        if consent is None:
            raise api_error(
                403,
                "guardian_required",
                "Necesitás una autorización del tutor aprobada para continuar",
            )

    # Evitamos duplicados activos del mismo tipo y categoría.
    existing = db.execute(
        select(Procedure).where(
            Procedure.user_id == user.id,
            Procedure.procedure_type_id == procedure_type.id,
            Procedure.license_category == license_category.upper(),
            Procedure.status.in_(
                [ProcedureStatus.IN_PROGRESS.value, ProcedureStatus.UNDER_REVIEW.value]
            ),
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise api_error(
            409,
            "procedure_already_active",
            "Ya tenés un trámite en curso de este tipo y categoría",
            procedure_id=existing.id,
        )

    steps = [code for code in matrix.steps if code in {item.value for item in StepCode}]
    if not steps:
        raise api_error(500, "invalid_matrix", "La matriz no tiene pasos configurados")

    procedure = Procedure(
        public_code=_generate_public_code(db),
        user_id=user.id,
        procedure_type_id=procedure_type.id,
        matrix_id=matrix.id,
        license_category=license_category.upper(),
        status=ProcedureStatus.IN_PROGRESS.value,
        current_step=steps[0],
        data={**data, "origin": "web", "matrix_version": matrix.id},
    )
    db.add(procedure)
    db.flush()

    for position, code in enumerate(steps, start=1):
        db.add(
            ProcedureStep(
                procedure_id=procedure.id,
                code=code,
                position=position,
                status=(
                    StepStatus.IN_PROGRESS.value
                    if position == 1
                    else StepStatus.PENDING.value
                ),
                data={},
            )
        )

    record_audit(
        db,
        action="procedure.created",
        entity_type="procedure",
        entity_id=procedure.id,
        actor_user_id=user.id,
        actor_role=user.role,
        after={
            "public_code": procedure.public_code,
            "type": procedure_type_code,
            "category": license_category.upper(),
            "matrix_id": matrix.id,
        },
        ip=ip,
        user_agent=user_agent,
    )
    notify_user(
        db,
        user=user,
        title="Trámite iniciado",
        body=f"Registramos tu trámite {procedure.public_code}. Ya podés completar los pasos.",
        link=f"/panel/tramites/{procedure.id}",
        email_template="procedure_created",
        email_context={"procedure_code": procedure.public_code},
        idempotency_key=f"procedure-created-{procedure.id}",
    )
    db.commit()

    return get_procedure_or_404(db, procedure.id, user=user)


def _get_step(procedure: Procedure, code: str) -> ProcedureStep:
    """Busca un paso del expediente o lanza 404."""
    step = next((item for item in procedure.steps if item.code == code), None)
    if step is None:
        raise api_error(404, "step_not_found", "Ese paso no forma parte del trámite")
    return step


def require_current_step(procedure: Procedure, code: str) -> ProcedureStep:
    """Exige que el paso sea el actual y no esté cerrado."""
    step = _get_step(procedure, code)
    if procedure.current_step != code:
        raise api_error(
            409,
            "step_out_of_order",
            "Primero tenés que completar la etapa anterior",
        )
    if step.status == StepStatus.COMPLETED.value:
        raise api_error(409, "step_already_completed", "Esa etapa ya está completada")
    return step


def _advance_after_completed(
    db: Session,
    procedure: Procedure,
    step: ProcedureStep,
    *,
    actor_id: int,
    actor_role: str,
    ip: str | None,
    user_agent: str | None,
) -> None:
    """Marca el paso como completado y habilita el siguiente."""
    step.status = StepStatus.COMPLETED.value
    step.completed_at = utcnow()

    siguiente = next(
        (item for item in procedure.steps if item.status != StepStatus.COMPLETED.value),
        None,
    )
    if siguiente is not None:
        siguiente.status = StepStatus.IN_PROGRESS.value
        procedure.current_step = siguiente.code
    else:
        procedure.current_step = None
        procedure.status = ProcedureStatus.UNDER_REVIEW.value

    record_audit(
        db,
        action="procedure.step_completed",
        entity_type="procedure_step",
        entity_id=f"{procedure.id}:{step.code}",
        actor_user_id=actor_id,
        actor_role=actor_role,
        before={"status": StepStatus.SUBMITTED.value},
        after={"status": step.status, "next": procedure.current_step},
        ip=ip,
        user_agent=user_agent,
    )
    notify_user(
        db,
        user=procedure.user,
        title="Etapa completada",
        body=f"El trámite {procedure.public_code} avanzó. Etapa completada: {step.code}.",
        link=f"/panel/tramites/{procedure.id}",
        email_template="step_completed",
        email_context={
            "procedure_code": procedure.public_code,
            "procedure_id": procedure.id,
            "step_label": step.code,
        },
        idempotency_key=f"step-completed-{procedure.id}-{step.code}-{step.completed_at.isoformat()}",
    )
    db.flush()


def complete_learning(
    db: Session,
    procedure: Procedure,
    *,
    material_ids: list[int],
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> Procedure:
    """Registra que el ciudadano completó los materiales de seguridad vial."""
    step = require_current_step(procedure, StepCode.CHARLAS.value)
    materials = db.execute(
        select(LearningMaterial).where(LearningMaterial.active.is_(True))
    ).scalars().all()
    required = {item.id for item in materials}
    if not required:
        raise api_error(409, "materials_not_configured", "La etapa de charlas no tiene contenido cargado")
    missing = required - set(material_ids)
    if missing:
        raise api_error(
            422,
            "materials_incomplete",
            "Faltan materiales por completar",
            missing=sorted(missing),
        )

    step.data = {"material_ids": sorted(required), "completed_at": utcnow().isoformat()}
    step.status = StepStatus.SUBMITTED.value
    _advance_after_completed(
        db,
        procedure,
        step,
        actor_id=actor.id,
        actor_role=actor.role,
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return get_procedure_or_404(db, procedure.id, user=actor)


def submit_health(
    db: Session,
    procedure: Procedure,
    *,
    form: dict,
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> Procedure:
    """Registra la declaración de salud y deja el certificado a revisión."""
    step = require_current_step(procedure, StepCode.HEALTH.value)
    document = db.execute(
        select(Document)
        .where(
            Document.procedure_id == procedure.id,
            Document.kind == DocumentKind.HEALTH_CERTIFICATE.value,
            Document.status.in_(
                [DocumentStatus.PENDING.value, DocumentStatus.APPROVED.value]
            ),
        )
        .order_by(Document.id.desc())
        .limit(1)
    ).scalar_one_or_none()
    if document is None:
        raise api_error(
            422,
            "health_certificate_required",
            "Primero subí el certificado de salud en PDF o imagen",
        )

    step.data = {**form, "certificate_document_id": document.id}
    step.status = StepStatus.SUBMITTED.value
    record_audit(
        db,
        action="procedure.health_submitted",
        entity_type="procedure_step",
        entity_id=f"{procedure.id}:health",
        actor_user_id=actor.id,
        actor_role=actor.role,
        after={"document_id": document.id},
        ip=ip,
        user_agent=user_agent,
    )
    notify_user(
        db,
        user=actor,
        title="Certificado de salud recibido",
        body="Recibimos tu declaración y tu certificado. El área de salud lo va a revisar.",
        link=f"/panel/tramites/{procedure.id}",
        idempotency_key=f"health-submitted-{procedure.id}-{document.id}",
    )
    db.commit()
    return get_procedure_or_404(db, procedure.id, user=actor)


def upload_document(
    db: Session,
    procedure: Procedure,
    *,
    stored,  # type: ignore[no-untyped-def]
    kind: str,
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> Document:
    """Registra un documento ya guardado en almacenamiento."""
    allowed_kinds = {item.value for item in DocumentKind}
    if kind not in allowed_kinds:
        raise api_error(422, "invalid_document_kind", "Tipo de documento no permitido")

    document = Document(
        procedure_id=procedure.id,
        user_id=actor.id,
        kind=kind,
        original_name=stored.original_name,
        storage_key=stored.storage_key,
        mime=stored.mime,
        size_bytes=stored.size_bytes,
        sha256=stored.sha256,
        status=DocumentStatus.PENDING.value,
    )
    db.add(document)
    db.flush()
    record_audit(
        db,
        action="document.uploaded",
        entity_type="document",
        entity_id=document.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        after={
            "procedure_id": procedure.id,
            "kind": kind,
            "mime": stored.mime,
            "size": stored.size_bytes,
            "sha256": stored.sha256,
        },
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return document


def review_document(
    db: Session,
    document: Document,
    *,
    decision: str,
    notes: str | None,
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> Document:
    """Aprueba o rechaza un documento y avanza el paso de salud si corresponde."""
    if document.status != DocumentStatus.PENDING.value:
        raise api_error(409, "document_already_reviewed", "Ese documento ya fue revisado")

    procedure = document.procedure
    if decision == "approve":
        document.status = DocumentStatus.APPROVED.value
        if (
            document.kind == DocumentKind.HEALTH_CERTIFICATE.value
            and procedure is not None
            and procedure.current_step == StepCode.HEALTH.value
        ):
            step = _get_step(procedure, StepCode.HEALTH.value)
            if step.status == StepStatus.SUBMITTED.value:
                _advance_after_completed(
                    db,
                    procedure,
                    step,
                    actor_id=actor.id,
                    actor_role=actor.role,
                    ip=ip,
                    user_agent=user_agent,
                )
        if (
            document.kind == DocumentKind.GUARDIAN_AUTHORIZATION.value
            and procedure is not None
        ):
            consent = db.execute(
                select(GuardianConsent)
                .where(GuardianConsent.user_id == procedure.user_id)
                .order_by(GuardianConsent.id.desc())
                .limit(1)
            ).scalar_one_or_none()
            if consent is not None:
                consent.status = GuardianStatus.APPROVED.value
                consent.reviewed_by = actor.id
                consent.reviewed_at = utcnow()
                consent.review_notes = notes
        if procedure is not None:
            notify_user(
                db,
                user=procedure.user,
                title="Documento aprobado",
                body=f"Aprobamos el documento del trámite {procedure.public_code}.",
                link=f"/panel/tramites/{procedure.id}",
                email_template="document_approved",
                email_context={
                    "procedure_code": procedure.public_code,
                    "procedure_id": procedure.id,
                    "document_kind": document.kind,
                },
                idempotency_key=f"document-approved-{document.id}",
            )
    else:
        document.status = DocumentStatus.REJECTED.value
        if document.kind == DocumentKind.HEALTH_CERTIFICATE.value and procedure is not None:
            step = _get_step(procedure, StepCode.HEALTH.value)
            step.status = StepStatus.REJECTED.value
            step.review_notes = notes
            procedure.current_step = StepCode.HEALTH.value
        if procedure is not None:
            notify_user(
                db,
                user=procedure.user,
                title="Documento observado",
                body=f"El documento del trámite {procedure.public_code} necesita una corrección.",
                link=f"/panel/tramites/{procedure.id}",
                email_template="document_rejected",
                email_context={
                    "procedure_code": procedure.public_code,
                    "procedure_id": procedure.id,
                    "document_kind": document.kind,
                    "notes": notes or "Consultá el detalle en el portal.",
                },
                idempotency_key=f"document-rejected-{document.id}",
            )

    document.review_notes = notes
    document.reviewed_by = actor.id
    document.reviewed_at = utcnow()
    record_audit(
        db,
        action="document.reviewed",
        entity_type="document",
        entity_id=document.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        before={"status": DocumentStatus.PENDING.value},
        after={"status": document.status, "notes": notes},
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return document


def complete_delivery(
    db: Session,
    procedure: Procedure,
    *,
    actor: User,
    notes: str | None,
    ip: str | None,
    user_agent: str | None,
) -> Procedure:
    """Cierra el trámite, emite la credencial y notifica."""
    step = _get_step(procedure, StepCode.DELIVERY.value)
    if procedure.current_step != StepCode.DELIVERY.value:
        raise api_error(409, "step_out_of_order", "Todavía hay etapas pendientes")
    if step.status not in {StepStatus.SUBMITTED.value, StepStatus.IN_PROGRESS.value}:
        raise api_error(409, "delivery_not_ready", "La entrega todavía no fue confirmada por el ciudadano")

    from app.services.licenses import issue_license

    step.status = StepStatus.COMPLETED.value
    step.completed_at = utcnow()
    step.review_notes = notes
    procedure.current_step = None
    procedure.status = ProcedureStatus.COMPLETED.value
    procedure.completed_at = utcnow()

    license_obj = issue_license(
        db,
        procedure,
        actor=actor,
        ip=ip,
        user_agent=user_agent,
    )
    record_audit(
        db,
        action="procedure.completed",
        entity_type="procedure",
        entity_id=procedure.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        before={"status": ProcedureStatus.UNDER_REVIEW.value},
        after={"status": procedure.status, "license_id": license_obj.id},
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return get_procedure_or_404(db, procedure.id, staff=True)


def authorize_retry(
    db: Session,
    procedure: Procedure,
    *,
    actor: User,
    reason: str,
    ip: str | None,
    user_agent: str | None,
) -> Procedure:
    """Habilita un intento extra de examen teórico con justificación."""
    step = _get_step(procedure, StepCode.THEORY.value)
    data = dict(procedure.data or {})
    data["_extra_attempts"] = int(data.get("_extra_attempts", 0)) + 1
    procedure.data = data
    step.status = StepStatus.IN_PROGRESS.value
    step.review_notes = reason
    procedure.current_step = StepCode.THEORY.value
    record_audit(
        db,
        action="procedure.retry_authorized",
        entity_type="procedure",
        entity_id=procedure.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        after={"reason": reason, "extra_attempts": data["_extra_attempts"]},
        ip=ip,
        user_agent=user_agent,
    )
    notify_user(
        db,
        user=procedure.user,
        title="Intento extra habilitado",
        body=f"Habilitamos un nuevo intento de examen teórico para el trámite {procedure.public_code}.",
        link=f"/panel/tramites/{procedure.id}",
        idempotency_key=f"retry-authorized-{procedure.id}-{data['_extra_attempts']}",
    )
    db.commit()
    return get_procedure_or_404(db, procedure.id, staff=True)


def submit_delivery(
    db: Session,
    procedure: Procedure,
    *,
    method: str,
    address: str | None,
    notes: str | None,
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> Procedure:
    """Registra la preferencia de entrega y la deja a revisión."""
    step = require_current_step(procedure, StepCode.DELIVERY.value)
    if method == "home" and not address:
        raise api_error(422, "address_required", "Para envío a domicilio necesitamos una dirección")
    step.data = {"method": method, "address": address, "notes": notes}
    step.status = StepStatus.SUBMITTED.value
    record_audit(
        db,
        action="procedure.delivery_requested",
        entity_type="procedure_step",
        entity_id=f"{procedure.id}:delivery",
        actor_user_id=actor.id,
        actor_role=actor.role,
        after={"method": method},
        ip=ip,
        user_agent=user_agent,
    )
    notify_user(
        db,
        user=actor,
        title="Entrega registrada",
        body="Registramos cómo querés recibir tu credencial. El municipio va a confirmar la entrega.",
        link=f"/panel/tramites/{procedure.id}",
        idempotency_key=f"delivery-requested-{procedure.id}",
    )
    db.commit()
    return get_procedure_or_404(db, procedure.id, user=actor)


def claim_payment(
    db: Session,
    procedure: Procedure,
    *,
    receipt_document_id: int,
    payer_name: str,
    payer_dni: str,
    transfer_date: date | None,
    notes: str | None,
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> Payment:
    """Declara una transferencia con su comprobante."""
    step = require_current_step(procedure, StepCode.PAYMENT.value)
    document = db.get(Document, receipt_document_id)
    if (
        document is None
        or document.procedure_id != procedure.id
        or document.kind != DocumentKind.PAYMENT_RECEIPT.value
    ):
        raise api_error(422, "invalid_receipt", "El comprobante no corresponde a este trámite")
    if document.status == DocumentStatus.REJECTED.value:
        raise api_error(422, "receipt_rejected", "Ese comprobante fue observado. Subí uno nuevo")

    payment = db.execute(
        select(Payment).where(Payment.procedure_id == procedure.id).with_for_update()
    ).scalar_one_or_none()
    if payment is None:
        payment = Payment(
            procedure_id=procedure.id,
            user_id=procedure.user_id,
            amount=procedure.matrix.fee_amount,
            reference=f"PAGO-{procedure.public_code}",
            method="transfer",
            status=PaymentStatus.PENDING.value,
        )
        db.add(payment)
        db.flush()

    if payment.status == PaymentStatus.APPROVED.value:
        raise api_error(409, "payment_already_approved", "El pago ya está aprobado")

    before = {"status": payment.status}
    payment.receipt_document_id = document.id
    payment.payer_name = payer_name
    payment.payer_dni_masked = mask_dni(payer_dni)
    payment.transfer_date = (
        utcnow().replace(year=transfer_date.year, month=transfer_date.month, day=transfer_date.day)
        if transfer_date
        else None
    )
    payment.status = PaymentStatus.CLAIMED.value
    payment.claimed_at = utcnow()
    payment.reviewed_by = None
    payment.second_reviewed_by = None
    payment.reviewed_at = None
    payment.review_notes = notes

    step.data = {
        "payment_id": payment.id,
        "reference": payment.reference,
        "amount": str(payment.amount),
        "receipt_document_id": document.id,
    }
    step.status = StepStatus.SUBMITTED.value

    record_audit(
        db,
        action="payment.claimed",
        entity_type="payment",
        entity_id=payment.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        before=before,
        after={
            "status": payment.status,
            "amount": str(payment.amount),
            "reference": payment.reference,
        },
        ip=ip,
        user_agent=user_agent,
    )
    notify_user(
        db,
        user=actor,
        title="Comprobante recibido",
        body="Recibimos tu comprobante. El área de pagos lo va a revisar.",
        link=f"/panel/tramites/{procedure.id}",
        idempotency_key=f"payment-claimed-{payment.id}-{document.id}",
    )
    db.commit()
    return payment


def book_appointment(
    db: Session,
    procedure: Procedure,
    *,
    appointment_id: int,
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> Appointment:
    """Reserva un cupo de examen práctico con bloqueo de fila."""
    step = require_current_step(procedure, StepCode.PRACTICAL.value)
    appointment = db.execute(
        select(Appointment).where(Appointment.id == appointment_id).with_for_update()
    ).scalar_one_or_none()
    if appointment is None:
        raise api_error(404, "appointment_not_found", "El turno no existe")
    if appointment.status != AppointmentStatus.AVAILABLE.value:
        raise api_error(409, "appointment_taken", "Ese turno ya no está disponible")

    appointment.status = AppointmentStatus.BOOKED.value
    appointment.procedure_id = procedure.id
    step.data = {
        "appointment_id": appointment.id,
        "scheduled_at": appointment.scheduled_at.isoformat(),
        "location": appointment.location,
    }
    step.status = StepStatus.SCHEDULED.value
    record_audit(
        db,
        action="appointment.booked",
        entity_type="appointment",
        entity_id=appointment.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        after={
            "procedure_id": procedure.id,
            "scheduled_at": appointment.scheduled_at.isoformat(),
        },
        ip=ip,
        user_agent=user_agent,
    )
    notify_user(
        db,
        user=actor,
        title="Turno reservado",
        body=f"Reservamos tu turno para el {appointment.scheduled_at:%d/%m/%Y %H:%M}.",
        link=f"/panel/tramites/{procedure.id}",
        email_template="appointment_scheduled",
        email_context={
            "procedure_code": procedure.public_code,
            "procedure_id": procedure.id,
            "scheduled_at": appointment.scheduled_at.strftime("%d/%m/%Y %H:%M"),
            "location": appointment.location,
        },
        idempotency_key=f"appointment-booked-{appointment.id}",
    )
    db.commit()
    return appointment


def review_appointment(
    db: Session,
    appointment: Appointment,
    *,
    result: str | None,
    status: str | None,
    notes: str | None,
    instructor: str | None,
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> Appointment:
    """Registra el resultado del examen práctico y avanza el trámite."""
    procedure = appointment.procedure
    if procedure is None:
        raise api_error(409, "appointment_without_procedure", "El turno no tiene un trámite asociado")

    appointment.result = result or appointment.result
    appointment.status = status or appointment.status
    appointment.notes = notes or appointment.notes
    appointment.instructor = instructor or appointment.instructor

    if result is not None:
        step = _get_step(procedure, StepCode.PRACTICAL.value)
        if result == AppointmentResult.PASSED.value:
            appointment.status = AppointmentStatus.COMPLETED.value
            if step.status != StepStatus.COMPLETED.value:
                _advance_after_completed(
                    db,
                    procedure,
                    step,
                    actor_id=actor.id,
                    actor_role=actor.role,
                    ip=ip,
                    user_agent=user_agent,
                )
        else:
            appointment.status = AppointmentStatus.COMPLETED.value
            step.status = StepStatus.REJECTED.value
            step.review_notes = notes
            procedure.current_step = StepCode.PRACTICAL.value

    record_audit(
        db,
        action="appointment.reviewed",
        entity_type="appointment",
        entity_id=appointment.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        after={"status": appointment.status, "result": appointment.result, "notes": notes},
        ip=ip,
        user_agent=user_agent,
    )
    notify_user(
        db,
        user=procedure.user,
        title="Resultado del examen práctico",
        body=(
            "Aprobaste el examen práctico."
            if result == AppointmentResult.PASSED.value
            else "El examen práctico quedó pendiente. Revisá el detalle en el portal."
        ),
        link=f"/panel/tramites/{procedure.id}",
        idempotency_key=f"appointment-reviewed-{appointment.id}-{appointment.status}",
    )
    db.commit()
    return appointment


def available_appointments(db: Session) -> list[Appointment]:
    """Lista cupos disponibles desde ahora."""
    stmt = (
        select(Appointment)
        .where(
            Appointment.status == AppointmentStatus.AVAILABLE.value,
            Appointment.scheduled_at >= utcnow(),
        )
        .order_by(Appointment.scheduled_at.asc())
    )
    return list(db.execute(stmt).scalars().all())


def admin_list_procedures(
    db: Session,
    *,
    status: str | None = None,
    procedure_type: str | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Procedure], int]:
    """Lista expedientes para el backoffice con filtros básicos."""
    from sqlalchemy import func

    stmt = select(Procedure).options(
        selectinload(Procedure.procedure_type).selectinload(ProcedureType.matrix),
        selectinload(Procedure.matrix),
        selectinload(Procedure.steps),
        selectinload(Procedure.documents),
        selectinload(Procedure.payment),
        selectinload(Procedure.license),
        selectinload(Procedure.user).selectinload(User.profile),
    )
    conditions = []
    if status:
        conditions.append(Procedure.status == status)
    if procedure_type:
        conditions.append(Procedure.procedure_type.has(ProcedureType.code == procedure_type))
    if q:
        search = q.strip()
        like = f"%{search}%"
        conditions.append(
            Procedure.public_code.ilike(like)
            | Procedure.user.has(User.email.ilike(like))
        )
        # El nombre y el DNI están cifrados, así que no se pueden buscar con LIKE.
        # El DNI se resuelve por su índice ciego y el nombre queda fuera del
        # buscador hasta que exista un índice de búsqueda dedicado.
        digits = "".join(ch for ch in search if ch.isdigit())
        if len(digits) in {7, 8}:
            from app.core.config import get_settings

            dni_hmac = blind_index(digits, get_settings().dni_hmac_key)
            conditions.append(
                Procedure.user.has(
                    User.profile.has(CitizenProfile.dni_hmac == dni_hmac)
                )
            )
    if conditions:
        stmt = stmt.where(*conditions)

    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()
    rows = (
        db.execute(
            stmt.order_by(Procedure.created_at.desc()).limit(limit).offset(offset)
        )
        .scalars()
        .all()
    )
    return list(rows), int(total)


def payment_amount_display(amount: Decimal) -> str:
    """Formatea un monto para logs y notificaciones."""
    return f"${amount:,.2f}".replace(",", ".")
