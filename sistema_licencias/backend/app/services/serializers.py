"""Serialización de modelos a contratos de API.

Acá se descifran los datos personales y se enmascaran. Ningún endpoint armado
a mano debe devolver un DNI completo.
"""

from __future__ import annotations

from app.core.security import mask_dni, mask_name
from app.domain.enums import STEP_LABELS
from app.models.exam import Question
from app.models.license import License
from app.models.notification import Notification
from app.models.payment import Payment
from app.models.procedure import (
    Appointment,
    Document,
    Procedure,
    ProcedureMatrix,
    ProcedureStep,
    ProcedureType,
)
from app.models.user import CitizenProfile, User
from app.schemas.admin import AuditOut, UserAdminOut
from app.schemas.catalog import MatrixOut, ProcedureTypeOut
from app.schemas.exam import QuestionOut
from app.schemas.license import LicenseOut, PublicLicenseOut
from app.schemas.notification import NotificationOut
from app.schemas.payment import PaymentAdminOut, PaymentOut
from app.schemas.procedure import (
    AdminProcedureOut,
    AppointmentOut,
    DocumentOut,
    LicenseSummaryOut,
    ProcedureListItem,
    ProcedureOut,
    StepOut,
    UserSummaryOut,
)
from app.services.crypto import get_cipher


def _decrypt(value: str | None) -> str | None:
    """Descifra un campo o devuelve None si no se puede."""
    if value is None:
        return None
    try:
        return get_cipher().decrypt(value)
    except ValueError:
        return None


def profile_out(profile: CitizenProfile):  # type: ignore[no-untyped-def]
    """Serializa el perfil descifrando DNI y teléfono solo para su dueño."""
    from app.schemas.auth import ProfileOut

    dni = _decrypt(profile.dni_encrypted) or ""
    return ProfileOut(
        first_name=profile.first_name,
        last_name=profile.last_name,
        dni_masked=mask_dni(dni),
        birth_date=profile.birth_date,
        phone=_decrypt(profile.phone_encrypted),
        address=profile.address,
        locality=profile.locality,
    )


def user_out(user: User):  # type: ignore[no-untyped-def]
    """Serializa la cuenta autenticada."""
    from app.schemas.auth import UserOut

    return UserOut(
        id=user.id,
        email=user.email,
        role=user.role,
        status=user.status,
        email_verified=user.email_verified,
        mfa_enabled=user.mfa_enabled,
        profile=profile_out(user.profile) if user.profile else None,
        created_at=user.created_at,
    )


def citizen_summary(user: User) -> UserSummaryOut:
    """Resumen del ciudadano para el backoffice, sin datos completos."""
    profile = user.profile
    if profile is None:
        return UserSummaryOut(id=user.id, email=user.email, name=user.email.split("@")[0], dni_masked="***")
    dni = _decrypt(profile.dni_encrypted) or ""
    return UserSummaryOut(
        id=user.id,
        email=user.email,
        name=f"{profile.first_name} {profile.last_name}".strip(),
        dni_masked=mask_dni(dni),
    )


def user_admin_out(user: User) -> UserAdminOut:
    """Serializa un usuario para administración."""
    profile = user.profile
    name = None
    dni_masked = None
    if profile is not None:
        name = f"{profile.first_name} {profile.last_name}".strip()
        dni_masked = mask_dni(_decrypt(profile.dni_encrypted) or "")
    return UserAdminOut(
        id=user.id,
        email=user.email,
        role=user.role,
        status=user.status,
        email_verified=user.email_verified,
        mfa_enabled=user.mfa_enabled,
        name=name,
        dni_masked=dni_masked,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


def matrix_out(matrix: ProcedureMatrix) -> MatrixOut:
    """Serializa una fila de la matriz."""
    return MatrixOut(
        id=matrix.id,
        license_category=matrix.license_category,
        min_age=matrix.min_age,
        max_age=matrix.max_age,
        fee_amount=matrix.fee_amount,
        validity_years=matrix.validity_years,
        steps=matrix.steps,
        required_documents=matrix.required_documents,
        theory_questions=matrix.theory_questions,
        theory_pass_ratio=float(matrix.theory_pass_ratio),
        theory_minutes=matrix.theory_minutes,
        max_theory_attempts=matrix.max_theory_attempts,
        requires_health=matrix.requires_health,
        requires_practical=matrix.requires_practical,
        notes=matrix.notes,
    )


def procedure_type_out(procedure_type: ProcedureType) -> ProcedureTypeOut:
    """Serializa un tipo de trámite con toda su matriz."""
    return ProcedureTypeOut(
        id=procedure_type.id,
        code=procedure_type.code,
        name=procedure_type.name,
        short_description=procedure_type.short_description,
        description=procedure_type.description,
        icon=procedure_type.icon,
        sort_order=procedure_type.sort_order,
        matrix=[matrix_out(item) for item in procedure_type.matrix if item.active],
    )


def document_out(document: Document) -> DocumentOut:
    """Serializa un documento sin su ruta interna."""
    return DocumentOut(
        id=document.id,
        kind=document.kind,
        original_name=document.original_name,
        mime=document.mime,
        size_bytes=document.size_bytes,
        status=document.status,
        review_notes=document.review_notes,
        created_at=document.created_at,
    )


def step_out(step: ProcedureStep) -> StepOut:
    """Serializa un paso con su etiqueta visible."""
    return StepOut(
        code=step.code,
        label=STEP_LABELS.get(step.code, step.code),
        position=step.position,
        status=step.status,
        data=step.data or {},
        notes=step.notes,
        completed_at=step.completed_at,
    )


def payment_out(payment: Payment) -> PaymentOut:
    """Serializa un pago."""
    return PaymentOut(
        id=payment.id,
        reference=payment.reference,
        amount=payment.amount,
        method=payment.method,
        status=payment.status,
        receipt_document_id=payment.receipt_document_id,
        payer_name=payment.payer_name,
        claimed_at=payment.claimed_at,
        reviewed_at=payment.reviewed_at,
        review_notes=payment.review_notes,
    )


def payment_admin_out(payment: Payment) -> PaymentAdminOut:
    """Serializa un pago con contexto de trámite y ciudadano."""
    procedure = payment.procedure
    profile = procedure.user.profile if procedure and procedure.user else None
    name = (
        f"{profile.first_name} {profile.last_name}".strip()
        if profile is not None
        else (procedure.user.email if procedure and procedure.user else "")
    )
    return PaymentAdminOut(
        **payment_out(payment).model_dump(),
        procedure_code=procedure.public_code if procedure else "",
        citizen_email=procedure.user.email if procedure and procedure.user else "",
        citizen_name=name,
        second_reviewed_by=payment.second_reviewed_by,
    )


def license_summary(license: License) -> LicenseSummaryOut:
    """Serializa el resumen de una credencial para su dueño."""
    return LicenseSummaryOut(
        id=license.id,
        license_number=license.license_number,
        category=license.category,
        issued_at=license.issued_at,
        expires_at=license.expires_at,
        status=license.status,
        qr_token=license.qr_token,
    )


def license_out(license: License) -> LicenseOut:
    """Serializa una credencial completa."""

    return LicenseOut(
        id=license.id,
        license_number=license.license_number,
        category=license.category,
        issued_at=license.issued_at,
        expires_at=license.expires_at,
        status=license.status,
        qr_token=license.qr_token,
        verify_path=f"/verificar/{license.qr_token}",
    )


def public_license_out(license: License | None):  # type: ignore[no-untyped-def]
    """Serializa la verificación pública sin exponer datos sensibles."""
    from app.core.security import utcnow

    if license is None:
        return PublicLicenseOut(
            found=False,
            message="No encontramos una credencial con ese código",
            verified_at=utcnow(),
        )
    profile = license.user.profile if license.user else None
    holder = mask_name(profile.first_name, profile.last_name) if profile else "***"
    return PublicLicenseOut(
        found=True,
        license_number=license.license_number,
        holder=holder,
        category=license.category,
        status=license.status,
        issued_at=license.issued_at,
        expires_at=license.expires_at,
        message="Credencial válida" if license.status == "active" else "Credencial no vigente",
        verified_at=utcnow(),
    )


def appointment_out(appointment: Appointment) -> AppointmentOut:
    """Serializa un turno."""
    return AppointmentOut(
        id=appointment.id,
        scheduled_at=appointment.scheduled_at,
        location=appointment.location,
        instructor=appointment.instructor,
        status=appointment.status,
        result=appointment.result,
        notes=appointment.notes,
    )


def question_out(question: Question) -> QuestionOut:
    """Serializa una pregunta completa para administración."""
    return QuestionOut(
        id=question.id,
        category=question.category,
        prompt=question.prompt,
        options=question.options,
        correct_index=question.correct_index,
        explanation=question.explanation,
        active=question.active,
        reviewed=question.reviewed,
        source=question.source,
    )


def notification_out(notification: Notification) -> NotificationOut:
    """Serializa una notificación interna."""
    return NotificationOut(
        id=notification.id,
        title=notification.title,
        body=notification.body,
        link=notification.link,
        read_at=notification.read_at,
        created_at=notification.created_at,
    )


def procedure_list_item(procedure: Procedure) -> ProcedureListItem:
    """Serializa un trámite para listados."""
    return ProcedureListItem(
        id=procedure.id,
        public_code=procedure.public_code,
        procedure_type_code=procedure.procedure_type.code,
        procedure_type_name=procedure.procedure_type.name,
        license_category=procedure.license_category,
        status=procedure.status,
        current_step=procedure.current_step,
        created_at=procedure.created_at,
        completed_at=procedure.completed_at,
    )


def procedure_out(procedure: Procedure, *, include_internal: bool = False) -> ProcedureOut:
    """Serializa un expediente completo."""
    data = {
        key: value
        for key, value in (procedure.data or {}).items()
        if include_internal or not key.startswith("_")
    }
    return ProcedureOut(
        id=procedure.id,
        public_code=procedure.public_code,
        procedure_type=procedure_type_out(procedure.procedure_type),
        matrix=matrix_out(procedure.matrix),
        license_category=procedure.license_category,
        status=procedure.status,
        current_step=procedure.current_step,
        steps=[step_out(step) for step in procedure.steps],
        documents=[document_out(doc) for doc in procedure.documents],
        payment=payment_out(procedure.payment) if procedure.payment else None,
        license=license_summary(procedure.license) if procedure.license else None,
        data=data,
        rejection_reason=procedure.rejection_reason,
        created_at=procedure.created_at,
        submitted_at=procedure.submitted_at,
        completed_at=procedure.completed_at,
    )


def admin_procedure_out(procedure: Procedure) -> AdminProcedureOut:
    """Serializa un expediente con datos del ciudadano."""
    base = procedure_out(procedure, include_internal=True)
    return AdminProcedureOut(
        **base.model_dump(),
        citizen=citizen_summary(procedure.user),
    )


def audit_out(entry) -> AuditOut:  # type: ignore[no-untyped-def]
    """Serializa una entrada de auditoría."""
    return AuditOut(
        id=entry.id,
        actor_user_id=entry.actor_user_id,
        actor_role=entry.actor_role,
        action=entry.action,
        entity_type=entry.entity_type,
        entity_id=entry.entity_id,
        before=entry.before,
        after=entry.after,
        ip=entry.ip,
        created_at=entry.created_at,
        entry_hash=entry.entry_hash,
    )
