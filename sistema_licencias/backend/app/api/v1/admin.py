"""Backoffice municipal: tablero, expedientes, usuarios, turnos y auditoría."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from app.api.deps import (
    RequestMeta,
    current_user,
    rate_limit,
    request_meta,
    require_permission,
    require_staff,
)
from app.core.db import get_db
from app.core.errors import api_error
from app.core.permissions import has_permission
from app.core.security import blind_index, safe_filename, utcnow
from app.domain.enums import (
    DocumentKind,
    DocumentStatus,
    PaymentStatus,
    ProcedureStatus,
    Role,
    UserStatus,
)
from app.models.audit import AuditLog
from app.models.exam import Question
from app.models.license import License
from app.models.payment import Payment
from app.models.policy import Policy
from app.models.procedure import Appointment, Document, Procedure, ProcedureType
from app.models.user import CitizenProfile, User, UserSession
from app.schemas.admin import (
    AdminAppointmentOut,
    AppointmentCreateIn,
    AppointmentUpdateIn,
    AuditOut,
    AuditVerifyOut,
    DashboardOut,
    PolicyCreateIn,
    UserAdminOut,
    UserAdminUpdate,
)
from app.schemas.common import MessageOut, PageOut
from app.schemas.policy import PolicyOut if False else None  # noqa: F401 - placeholder removed
from app.schemas.procedure import AdminProcedureOut, DocumentOut
from app.services import procedures as procedure_service
from app.services.audit import record_audit, verify_audit_chain
from app.services.notifications import notify_user, queue_email
from app.services.policies import policy_hash
from app.services.serializers import (
    admin_procedure_out,
    appointment_out,
    audit_out,
    document_out,
    user_admin_out,
)
from app.services.storage import read_file

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    _user: User = Depends(require_permission("reports.read")),
    db: Session = Depends(get_db),
) -> DashboardOut:
    """Resume el estado operativo para el tablero municipal."""
    by_status = {
        status: int(count)
        for status, count in db.execute(
            select(Procedure.status, func.count(Procedure.id)).group_by(Procedure.status)
        ).all()
    }
    payments_pending = db.execute(
        select(func.count(Payment.id)).where(
            Payment.status.in_(
                [
                    PaymentStatus.PENDING.value,
                    PaymentStatus.CLAIMED.value,
                    PaymentStatus.PENDING_SECOND.value,
                ]
            )
        )
    ).scalar_one()
    documents_pending = db.execute(
        select(func.count(Document.id)).where(
            Document.status == DocumentStatus.PENDING.value
        )
    ).scalar_one()
    appointments_upcoming = db.execute(
        select(func.count(Appointment.id)).where(
            Appointment.status.in_(["available", "booked"]),
            Appointment.scheduled_at >= utcnow(),
        )
    ).scalar_one()
    licenses_active = db.execute(
        select(func.count(License.id)).where(License.status == "active")
    ).scalar_one()
    users_total = db.execute(select(func.count(User.id))).scalar_one()
    questions_reviewed = db.execute(
        select(func.count(Question.id)).where(Question.reviewed.is_(True))
    ).scalar_one()
    questions_pending = db.execute(
        select(func.count(Question.id)).where(Question.reviewed.is_(False))
    ).scalar_one()

    return DashboardOut(
        procedures_by_status=by_status,
        payments_pending=int(payments_pending),
        documents_pending=int(documents_pending),
        appointments_upcoming=int(appointments_upcoming),
        licenses_active=int(licenses_active),
        users_total=int(users_total),
        questions_reviewed=int(questions_reviewed),
        questions_pending=int(questions_pending),
    )


@router.get("/procedures", response_model=PageOut)
def list_procedures(
    status: str | None = Query(default=None, max_length=20),
    procedure_type: str | None = Query(default=None, max_length=30),
    q: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _user: User = Depends(require_permission("procedures.read")),
    db: Session = Depends(get_db),
) -> PageOut:
    """Lista expedientes con búsqueda por código, correo o DNI."""
    rows, total = procedure_service.admin_list_procedures(
        db,
        status=status,
        procedure_type=procedure_type,
        q=q,
        limit=limit,
        offset=offset,
    )
    return PageOut(
        items=[admin_procedure_out(item) for item in rows],
        total=total,
        page=(offset // limit) + 1,
        page_size=limit,
    )


@router.get("/procedures/{procedure_id}", response_model=AdminProcedureOut)
def get_procedure(
    procedure_id: int,
    _user: User = Depends(require_permission("procedures.read")),
    db: Session = Depends(get_db),
) -> AdminProcedureOut:
    """Devuelve un expediente con los datos mínimos del ciudadano."""
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, staff=True)
    return admin_procedure_out(procedure)


@router.post(
    "/procedures/{procedure_id}/documents/{document_id}/review",
    response_model=DocumentOut,
)
def review_document(
    procedure_id: int,
    document_id: int,
    data,  # type: ignore[no-untyped-def]
    user: User = Depends(require_staff),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> DocumentOut:
    """Aprueba o rechaza un documento del expediente."""
    from app.schemas.procedure import DocumentReviewIn

    if not isinstance(data, DocumentReviewIn):
        data = DocumentReviewIn.model_validate(data)

    procedure = procedure_service.get_procedure_or_404(db, procedure_id, staff=True)
    document = next((item for item in procedure.documents if item.id == document_id), None)
    if document is None:
        raise api_error(404, "document_not_found", "No encontramos ese documento")

    can_review = has_permission(user.role, "documents.review") or (
        document.kind == DocumentKind.HEALTH_CERTIFICATE.value
        and has_permission(user.role, "documents.review_health")
    )
    if not can_review:
        raise api_error(403, "forbidden", "No tenés permisos para revisar ese documento")

    document = procedure_service.review_document(
        db,
        document,
        decision=data.decision,
        notes=data.notes,
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return document_out(document)


@router.post("/procedures/{procedure_id}/delivery/complete", response_model=AdminProcedureOut)
def complete_delivery(
    procedure_id: int,
    user: User = Depends(require_permission("licenses.issue")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> AdminProcedureOut:
    """Confirma la entrega, cierra el trámite y emite la credencial."""
    from app.schemas.procedure import DeliveryCompleteIn

    procedure = procedure_service.get_procedure_or_404(db, procedure_id, staff=True)
    procedure = procedure_service.complete_delivery(
        db,
        procedure,
        actor=user,
        notes=None,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return admin_procedure_out(procedure)


@router.post("/procedures/{procedure_id}/reject", response_model=AdminProcedureOut)
def reject_procedure(
    procedure_id: int,
    user: User = Depends(require_permission("procedures.manage")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> AdminProcedureOut:
    """Rechaza un expediente con motivo y libera los turnos reservados."""
    from app.schemas.procedure import ProcedureRejectIn

    reason = ProcedureRejectIn.model_validate(
        getattr(reject_procedure, "_pending", None) or {"reason": "Sin motivo"}
    )
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, staff=True)
    if procedure.status not in {
        ProcedureStatus.IN_PROGRESS.value,
        ProcedureStatus.UNDER_REVIEW.value,
    }:
        raise api_error(409, "procedure_not_rejectable", "Ese trámite ya está cerrado")

    procedure.status = ProcedureStatus.REJECTED.value
    procedure.current_step = None
    procedure.rejection_reason = reason.reason
    for appointment in procedure.appointments:
        if appointment.status == "booked":
            appointment.status = "cancelled"
    record_audit(
        db,
        action="procedure.rejected",
        entity_type="procedure",
        entity_id=procedure.id,
        actor_user_id=user.id,
        actor_role=user.role,
        after={"reason": reason.reason},
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    notify_user(
        db,
        user=procedure.user,
        title="Trámite rechazado",
        body=f"El trámite {procedure.public_code} fue rechazado. Motivo: {reason.reason}",
        link=f"/panel/tramites/{procedure.id}",
        idempotency_key=f"procedure-rejected-{procedure.id}",
    )
    db.commit()
    return admin_procedure_out(
        procedure_service.get_procedure_or_404(db, procedure.id, staff=True)
    )


@router.get("/procedures/{procedure_id}/documents/{document_id}/download")
def download_document(
    procedure_id: int,
    document_id: int,
    user: User = Depends(require_permission("procedures.read")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> Response:
    """Descarga un documento con permiso de staff y auditoría."""
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, staff=True)
    document = next((item for item in procedure.documents if item.id == document_id), None)
    if document is None:
        raise api_error(404, "document_not_found", "No encontramos ese documento")
    content = read_file(document.storage_key)
    record_audit(
        db,
        action="document.staff_downloaded",
        entity_type="document",
        entity_id=document.id,
        actor_user_id=user.id,
        actor_role=user.role,
        after={"procedure_id": procedure.id, "kind": document.kind},
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    db.commit()
    return Response(
        content=content,
        media_type=document.mime,
        headers={
            "Content-Disposition": f'inline; filename="{safe_filename(document.original_name)}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.get("/users", response_model=PageOut)
def list_users(
    q: str | None = Query(default=None, max_length=80),
    role: str | None = Query(default=None, max_length=30),
    status: str | None = Query(default=None, max_length=20),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _user: User = Depends(require_permission("users.read")),
    db: Session = Depends(get_db),
) -> PageOut:
    """Lista cuentas con búsqueda por correo o DNI."""
    stmt = select(User).options(selectinload(User.profile))
    conditions = []
    if role:
        conditions.append(User.role == role)
    if status:
        conditions.append(User.status == status)
    if q:
        search = q.strip()
        like = f"%{search}%"
        conditions.append(User.email.ilike(like))
        digits = "".join(ch for ch in search if ch.isdigit())
        if len(digits) in {7, 8}:
            from app.core.config import get_settings

            digest = blind_index(digits, get_settings().dni_hmac_key)
            conditions.append(
                User.profile.has(CitizenProfile.dni_hmac == digest)
            )
    if conditions:
        stmt = stmt.where(*conditions)

    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()
    rows = (
        db.execute(stmt.order_by(User.created_at.desc()).limit(limit).offset(offset))
        .scalars()
        .all()
    )
    return PageOut(
        items=[user_admin_out(item) for item in rows],
        total=int(total),
        page=(offset // limit) + 1,
        page_size=limit,
    )


@router.patch("/users/{user_id}", response_model=UserAdminOut)
def update_user(
    user_id: int,
    data: UserAdminUpdate,
    actor: User = Depends(require_permission("users.manage")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> UserAdminOut:
    """Cambia estado o rol con reglas para no escalar privilegios."""
    target = db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.profile))
    ).scalar_one_or_none()
    if target is None:
        raise api_error(404, "user_not_found", "No encontramos ese usuario")
    if target.id == actor.id:
        raise api_error(409, "self_edit_forbidden", "No podés cambiar tu propio rol o estado")

    before = {"role": target.role, "status": target.status}
    if data.role is not None and data.role != target.role:
        if actor.role != Role.SUPERADMIN.value:
            raise api_error(403, "forbidden", "Solo un superadministrador puede cambiar roles")
        if data.role not in {item.value for item in Role}:
            raise api_error(422, "invalid_role", "El rol indicado no existe")
        if target.role == Role.SUPERADMIN.value:
            remaining = db.execute(
                select(func.count(User.id)).where(
                    User.role == Role.SUPERADMIN.value,
                    User.status == UserStatus.ACTIVE.value,
                    User.id != target.id,
                )
            ).scalar_one()
            if int(remaining) == 0:
                raise api_error(
                    409,
                    "last_superadmin",
                    "No podés dejar al sistema sin un superadministrador activo",
                )
        target.role = data.role

    if data.status is not None and data.status != target.status:
        target.status = data.status
        if data.status == UserStatus.SUSPENDED.value:
            db.execute(
                update(UserSession)
                .where(UserSession.user_id == target.id, UserSession.revoked_at.is_(None))
                .values(revoked_at=utcnow())
            )
            queue_email(
                db,
                to_email=target.email,
                template="account_suspended",
                context={"first_name": target.profile.first_name if target.profile else "vecino/a"},
                idempotency_key=f"account-suspended-{target.id}-{utcnow().isoformat()}",
            )

    record_audit(
        db,
        action="user.admin_updated",
        entity_type="user",
        entity_id=target.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        before=before,
        after={"role": target.role, "status": target.status},
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    db.commit()
    return user_admin_out(target)


@router.get("/appointments", response_model=PageOut)
def list_appointments(
    status: str | None = Query(default=None, max_length=20),
    only_upcoming: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _user: User = Depends(require_permission("appointments.read")),
    db: Session = Depends(get_db),
) -> PageOut:
    """Lista turnos con su trámite y ciudadano."""
    stmt = select(Appointment).options(
        selectinload(Appointment.procedure).selectinload(Procedure.user).selectinload(User.profile)
    )
    conditions = []
    if status:
        conditions.append(Appointment.status == status)
    if only_upcoming:
        conditions.append(Appointment.scheduled_at >= utcnow())
    if conditions:
        stmt = stmt.where(*conditions)

    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()
    rows = (
        db.execute(
            stmt.order_by(Appointment.scheduled_at.asc()).limit(limit).offset(offset)
        )
        .scalars()
        .all()
    )
    items = []
    for item in rows:
        procedure = item.procedure
        profile = procedure.user.profile if procedure and procedure.user else None
        items.append(
            AdminAppointmentOut(
                **appointment_out(item).model_dump(),
                kind=item.kind,
                capacity=item.capacity,
                procedure_id=procedure.id if procedure else None,
                procedure_code=procedure.public_code if procedure else None,
                citizen_name=(
                    f"{profile.first_name} {profile.last_name}".strip()
                    if profile
                    else None
                ),
            )
        )
    return PageOut(
        items=items,
        total=int(total),
        page=(offset // limit) + 1,
        page_size=limit,
    )


@router.post("/appointments", response_model=AdminAppointmentOut, status_code=201)
def create_appointment(
    data: AppointmentCreateIn,
    user: User = Depends(require_permission("appointments.manage")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> AdminAppointmentOut:
    """Crea un cupo de examen práctico."""
    if data.scheduled_at <= utcnow():
        raise api_error(422, "appointment_in_past", "El turno tiene que ser en el futuro")
    appointment = Appointment(
        kind=data.kind,
        scheduled_at=data.scheduled_at,
        location=data.location,
        capacity=data.capacity,
        status="available",
        instructor=data.instructor,
        created_by=user.id,
    )
    db.add(appointment)
    db.flush()
    record_audit(
        db,
        action="appointment.created",
        entity_type="appointment",
        entity_id=appointment.id,
        actor_user_id=user.id,
        actor_role=user.role,
        after={
            "scheduled_at": appointment.scheduled_at.isoformat(),
            "location": appointment.location,
        },
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    db.commit()
    return AdminAppointmentOut(
        **appointment_out(appointment).model_dump(),
        kind=appointment.kind,
        capacity=appointment.capacity,
        procedure_id=None,
        procedure_code=None,
        citizen_name=None,
    )


@router.patch("/appointments/{appointment_id}", response_model=AdminAppointmentOut)
def update_appointment(
    appointment_id: int,
    data: AppointmentUpdateIn,
    user: User = Depends(require_permission("appointments.manage")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> AdminAppointmentOut:
    """Registra el resultado del práctico o cambia el estado del turno."""
    appointment = db.execute(
        select(Appointment)
        .where(Appointment.id == appointment_id)
        .options(
            selectinload(Appointment.procedure)
            .selectinload(Procedure.user)
            .selectinload(User.profile)
        )
    ).scalar_one_or_none()
    if appointment is None:
        raise api_error(404, "appointment_not_found", "No encontramos ese turno")

    appointment = procedure_service.review_appointment(
        db,
        appointment,
        result=data.result,
        status=data.status,
        notes=data.notes,
        instructor=data.instructor,
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    procedure = appointment.procedure
    profile = procedure.user.profile if procedure and procedure.user else None
    return AdminAppointmentOut(
        **appointment_out(appointment).model_dump(),
        kind=appointment.kind,
        capacity=appointment.capacity,
        procedure_id=procedure.id if procedure else None,
        procedure_code=procedure.public_code if procedure else None,
        citizen_name=(
            f"{profile.first_name} {profile.last_name}".strip() if profile else None
        ),
    )


@router.get("/audit", response_model=PageOut)
def list_audit(
    action: str | None = Query(default=None, max_length=80),
    entity_type: str | None = Query(default=None, max_length=50),
    actor_user_id: int | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _user: User = Depends(require_permission("audit.read")),
    db: Session = Depends(get_db),
) -> PageOut:
    """Lista entradas de auditoría, sin permitir modificarlas."""
    stmt = select(AuditLog)
    conditions = []
    if action:
        conditions.append(AuditLog.action == action)
    if entity_type:
        conditions.append(AuditLog.entity_type == entity_type)
    if actor_user_id:
        conditions.append(AuditLog.actor_user_id == actor_user_id)
    if conditions:
        stmt = stmt.where(*conditions)

    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()
    rows = (
        db.execute(stmt.order_by(AuditLog.id.desc()).limit(limit).offset(offset))
        .scalars()
        .all()
    )
    return PageOut(
        items=[audit_out(item) for item in rows],
        total=int(total),
        page=(offset // limit) + 1,
        page_size=limit,
    )


@router.get("/audit/verify", response_model=AuditVerifyOut)
def verify_audit(
    _user: User = Depends(require_permission("audit.read")),
    db: Session = Depends(get_db),
) -> AuditVerifyOut:
    """Verifica la cadena de hashes de la auditoría."""
    valid, checked, broken_at, message = verify_audit_chain(db)
    return AuditVerifyOut(
        valid=valid,
        checked=checked,
        broken_at=broken_at,
        message=message,
    )


@router.get("/policies", response_model=list[dict])
def list_admin_policies(
    _user: User = Depends(require_permission("policies.manage")),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Lista todas las versiones de políticas, incluidas las históricas."""
    rows = db.execute(select(Policy).order_by(Policy.slug, Policy.version.desc())).scalars()
    return [
        {
            "id": item.id,
            "slug": item.slug,
            "title": item.title,
            "version": item.version,
            "mandatory": item.mandatory,
            "active": item.active,
            "effective_at": item.effective_at,
            "content_hash": item.content_hash,
        }
        for item in rows
    ]


@router.post("/policies", response_model=dict, status_code=201)
def create_policy(
    data: PolicyCreateIn,
    user: User = Depends(require_permission("policies.manage")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> dict:
    """Publica una versión nueva y desactiva la anterior."""
    previous = db.execute(
        select(func.max(Policy.version)).where(Policy.slug == data.slug)
    ).scalar_one()
    version = int(previous or 0) + 1
    db.execute(
        update(Policy).where(Policy.slug == data.slug).values(active=False)
    )
    policy = Policy(
        slug=data.slug,
        title=data.title,
        version=version,
        body_md=data.body_md,
        content_hash=policy_hash(data.body_md),
        mandatory=data.mandatory,
        applies_to=data.applies_to,
        effective_at=utcnow(),
        active=True,
    )
    db.add(policy)
    db.flush()
    record_audit(
        db,
        action="policy.published",
        entity_type="policy",
        entity_id=policy.id,
        actor_user_id=user.id,
        actor_role=user.role,
        after={"slug": policy.slug, "version": version},
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    db.commit()
    return {
        "id": policy.id,
        "slug": policy.slug,
        "version": policy.version,
        "content_hash": policy.content_hash,
    }
