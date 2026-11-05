"""Backoffice municipal: tablero, expedientes, usuarios, turnos y auditoría."""

from __future__ import annotations

from datetime import timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from app.api.deps import (
    RequestMeta,
    request_meta,
    require_permission,
    require_staff,
)
from app.core.db import get_db
from app.core.errors import api_error
from app.core.permissions import has_permission
from app.core.security import blind_index, safe_filename, utcnow
from app.domain.enums import (
    AccountStatus,
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
from app.models.procedure import Appointment, Document, Procedure
from app.models.user import AccountMessage, CitizenProfile, User, UserSession
from app.schemas.admin import (
    AccountDetailOut,
    AccountKpiOut,
    AccountListOut,
    AccountMessageOut,
    AdminAccountMessageIn,
    AdminAppointmentOut,
    AppointmentCreateIn,
    AppointmentUpdateIn,
    AuditVerifyOut,
    CitizenAccountSummaryOut,
    DashboardOut,
    PolicyCreateIn,
    RejectFinesIn,
    UserAdminOut,
    UserAdminUpdate,
)
from app.schemas.common import PageOut
from app.schemas.procedure import (
    AdminProcedureOut,
    DeliveryCompleteIn,
    DocumentOut,
    DocumentReviewIn,
    ProcedureRejectIn,
)
from app.services import procedures as procedure_service
from app.services.audit import record_audit, verify_audit_chain
from app.services.notifications import notify_user, queue_email
from app.services.policies import policy_hash
from app.services.serializers import (
    account_message_out,
    admin_procedure_out,
    appointment_out,
    audit_out,
    citizen_account_summary_out,
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
    data: DocumentReviewIn,
    user: User = Depends(require_staff),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> DocumentOut:
    """Aprueba o rechaza un documento del expediente."""
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
    data: DeliveryCompleteIn,
    user: User = Depends(require_permission("licenses.issue")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> AdminProcedureOut:
    """Confirma la entrega, cierra el trámite y emite la credencial."""
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, staff=True)
    procedure = procedure_service.complete_delivery(
        db,
        procedure,
        actor=user,
        notes=data.notes,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return admin_procedure_out(procedure)


@router.post("/procedures/{procedure_id}/reject", response_model=AdminProcedureOut)
def reject_procedure(
    procedure_id: int,
    data: ProcedureRejectIn,
    user: User = Depends(require_permission("procedures.manage")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> AdminProcedureOut:
    """Rechaza un expediente con motivo y libera los turnos reservados."""
    procedure = procedure_service.get_procedure_or_404(db, procedure_id, staff=True)
    if procedure.status not in {
        ProcedureStatus.IN_PROGRESS.value,
        ProcedureStatus.UNDER_REVIEW.value,
    }:
        raise api_error(409, "procedure_not_rejectable", "Ese trámite ya está cerrado")

    procedure.status = ProcedureStatus.REJECTED.value
    procedure.current_step = None
    procedure.rejection_reason = data.reason
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
        after={"reason": data.reason},
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    notify_user(
        db,
        user=procedure.user,
        title="Trámite rechazado",
        body=f"El trámite {procedure.public_code} fue rechazado. Motivo: {data.reason}",
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
    scheduled = data.scheduled_at
    if scheduled.tzinfo is not None:
        scheduled = scheduled.astimezone(timezone.utc).replace(tzinfo=None)
    if scheduled <= utcnow():
        raise api_error(422, "appointment_in_past", "El turno tiene que ser en el futuro")
    appointment = Appointment(
        kind=data.kind,
        scheduled_at=scheduled,
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



# ============================================================
# AUDITORÍA DE ANTECEDENTES VIALES Y GESTIÓN DE CUENTAS
# ============================================================

@router.get("/accounts", response_model=AccountListOut)
def list_accounts(
    filter_status: str = Query(default="todos", alias="filtro", max_length=30),
    q: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _user: User = Depends(require_permission("users.read")),
    db: Session = Depends(get_db),
) -> AccountListOut:
    """Lista solicitudes ciudadanas y KPIs para el operador de tránsito."""
    # Cálculo de KPIs en tiempo real
    total_citizens = db.execute(
        select(func.count(CitizenProfile.user_id))
        .join(User, User.id == CitizenProfile.user_id)
        .where(CitizenProfile.account_status != AccountStatus.TRASH.value)
    ).scalar_one()

    kpi_pending = db.execute(
        select(func.count(CitizenProfile.user_id))
        .where(CitizenProfile.account_status == AccountStatus.PENDING.value)
    ).scalar_one()

    kpi_fines = db.execute(
        select(func.count(CitizenProfile.user_id))
        .where(CitizenProfile.account_status == AccountStatus.REJECTED_FINES.value)
    ).scalar_one()

    kpi_approved = db.execute(
        select(func.count(CitizenProfile.user_id))
        .where(CitizenProfile.account_status == AccountStatus.APPROVED.value)
    ).scalar_one()

    kpi_trash = db.execute(
        select(func.count(CitizenProfile.user_id))
        .where(CitizenProfile.account_status == AccountStatus.TRASH.value)
    ).scalar_one()

    kpis = AccountKpiOut(
        total=int(total_citizens),
        pending=int(kpi_pending),
        fines=int(kpi_fines),
        approved=int(kpi_approved),
        trash=int(kpi_trash),
    )

    # Filtrado según pestaña seleccionada
    stmt = (
        select(CitizenProfile, User)
        .join(User, User.id == CitizenProfile.user_id)
        .options(selectinload(User.profile))
    )

    conditions = []
    if filter_status == "pendiente":
        conditions.append(CitizenProfile.account_status == AccountStatus.PENDING.value)
    elif filter_status == "aprobada":
        conditions.append(CitizenProfile.account_status == AccountStatus.APPROVED.value)
    elif filter_status == "rechazada_multas":
        conditions.append(CitizenProfile.account_status == AccountStatus.REJECTED_FINES.value)
    elif filter_status == "papelera":
        conditions.append(CitizenProfile.account_status == AccountStatus.TRASH.value)
    else:  # "todos"
        conditions.append(CitizenProfile.account_status != AccountStatus.TRASH.value)

    if q:
        search = q.strip()
        like = f"%{search}%"
        digits = "".join(ch for ch in search if ch.isdigit())
        if len(digits) in {7, 8}:
            from app.core.config import get_settings
            digest = blind_index(digits, get_settings().dni_hmac_key)
            conditions.append(CitizenProfile.dni_hmac == digest)
        else:
            conditions.append(
                (CitizenProfile.first_name.ilike(like)) | (CitizenProfile.last_name.ilike(like)) | (User.email.ilike(like))
            )

    if conditions:
        stmt = stmt.where(*conditions)

    total_filtered = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()

    rows = (
        db.execute(stmt.order_by(CitizenProfile.user_id.desc()).limit(limit).offset(offset))
        .all()
    )

    items = []
    for profile, citizen_user in rows:
        unread = db.execute(
            select(func.count(AccountMessage.id)).where(
                AccountMessage.user_id == citizen_user.id,
                AccountMessage.sender == "citizen",
                AccountMessage.read_at.is_(None),
            )
        ).scalar_one()
        items.append(
            citizen_account_summary_out(
                profile,
                citizen_user,
                unread_messages=int(unread),
                include_full_dni=False,
            )
        )

    return AccountListOut(
        items=items,
        kpis=kpis,
        total=int(total_filtered),
        page=(offset // limit) + 1,
        page_size=limit,
    )


@router.get("/accounts/{user_id}", response_model=AccountDetailOut)
def get_account_detail(
    user_id: int,
    _user: User = Depends(require_permission("users.read")),
    db: Session = Depends(get_db),
) -> AccountDetailOut:
    """Obtiene el expediente ciudadano con DNI descifrado para consulta en Infracciones BA y el chat."""
    citizen_user = db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.profile))
    ).scalar_one_or_none()
    if citizen_user is None or citizen_user.profile is None:
        raise api_error(404, "account_not_found", "No encontramos esa cuenta ciudadana")

    # Marcar mensajes del ciudadano como leídos por el administrador
    db.execute(
        update(AccountMessage)
        .where(AccountMessage.user_id == user_id, AccountMessage.sender == "citizen", AccountMessage.read_at.is_(None))
        .values(read_at=utcnow())
    )
    db.commit()

    messages_rows = db.execute(
        select(AccountMessage).where(AccountMessage.user_id == user_id).order_by(AccountMessage.created_at.asc())
    ).scalars().all()

    messages = [account_message_out(m) for m in messages_rows]
    account_summary = citizen_account_summary_out(
        citizen_user.profile,
        citizen_user,
        unread_messages=0,
        include_full_dni=True,
    )

    return AccountDetailOut(account=account_summary, messages=messages)


@router.post("/accounts/{user_id}/approve", response_model=CitizenAccountSummaryOut)
def approve_account(
    user_id: int,
    actor: User = Depends(require_permission("users.manage")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> CitizenAccountSummaryOut:
    """Aprueba la cuenta ciudadana al no registrar multas pendientes."""
    from decimal import Decimal

    citizen_user = db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.profile))
    ).scalar_one_or_none()
    if citizen_user is None or citizen_user.profile is None:
        raise api_error(404, "account_not_found", "No encontramos esa cuenta ciudadana")

    profile = citizen_user.profile
    before_status = profile.account_status

    profile.account_status = AccountStatus.APPROVED.value
    profile.fines_count = 0
    profile.fines_amount = Decimal("0.00")
    profile.fines_reason = None
    profile.fines_payment_claimed = False
    profile.fines_reviewed_at = utcnow()

    # Mensaje automático para el ciudadano
    msg = AccountMessage(
        user_id=citizen_user.id,
        admin_id=actor.id,
        sender="admin",
        message="¡Tu cuenta ha sido aprobada por el área de Tránsito! Ya podés comenzar con los pasos de tu licencia.",
        created_at=utcnow(),
    )
    db.add(msg)

    record_audit(
        db,
        action="account.approved",
        entity_type="citizen_profile",
        entity_id=profile.user_id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        before={"account_status": before_status},
        after={"account_status": profile.account_status},
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    notify_user(
        db,
        user=citizen_user,
        title="Cuenta Aprobada",
        body="Tu cuenta fue verificada y habilitada para realizar trámites de licencias de conducir.",
        link="/panel",
        idempotency_key=f"account-approved-{citizen_user.id}",
    )
    db.commit()

    return citizen_account_summary_out(profile, citizen_user, include_full_dni=True)


@router.post("/accounts/{user_id}/reject-fines", response_model=CitizenAccountSummaryOut)
def reject_account_fines(
    user_id: int,
    data: RejectFinesIn,
    actor: User = Depends(require_permission("users.manage")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> CitizenAccountSummaryOut:
    """Rechaza la cuenta registrando infracciones de tránsito pendientes."""
    citizen_user = db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.profile))
    ).scalar_one_or_none()
    if citizen_user is None or citizen_user.profile is None:
        raise api_error(404, "account_not_found", "No encontramos esa cuenta ciudadana")

    profile = citizen_user.profile
    before = {
        "account_status": profile.account_status,
        "fines_count": profile.fines_count,
        "fines_amount": str(profile.fines_amount),
    }

    profile.account_status = AccountStatus.REJECTED_FINES.value
    profile.fines_count = data.fines_count
    profile.fines_amount = data.fines_amount
    profile.fines_reason = data.reason
    profile.fines_payment_claimed = False
    profile.fines_reviewed_at = utcnow()

    formatted_amount = f"{data.fines_amount:,.2f}"
    notice_text = (
        f"Se detectaron {data.fines_count} infracción(es) de tránsito pendiente(s) por un monto total de ${formatted_amount}. "
        f"Detalle: {data.reason}. "
        "Por favor regularice su situación y presione el botón 'Ya pagué' adjuntando su comprobante."
    )
    msg = AccountMessage(
        user_id=citizen_user.id,
        admin_id=actor.id,
        sender="admin",
        message=notice_text,
        created_at=utcnow(),
    )
    db.add(msg)

    record_audit(
        db,
        action="account.fines_recorded",
        entity_type="citizen_profile",
        entity_id=profile.user_id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        before=before,
        after={
            "account_status": profile.account_status,
            "fines_count": profile.fines_count,
            "fines_amount": str(profile.fines_amount),
            "reason": data.reason,
        },
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    notify_user(
        db,
        user=citizen_user,
        title="Infracciones de tránsito detectadas",
        body=f"Se detectaron {data.fines_count} multa(s) pendientes. Ingresá al portal para más detalles.",
        link="/panel",
        idempotency_key=f"account-fines-{citizen_user.id}-{utcnow().date().isoformat()}",
    )
    db.commit()

    return citizen_account_summary_out(profile, citizen_user, include_full_dni=True)


@router.post("/accounts/{user_id}/trash", response_model=CitizenAccountSummaryOut)
def move_account_to_trash(
    user_id: int,
    actor: User = Depends(require_permission("users.manage")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> CitizenAccountSummaryOut:
    """Mueve una solicitud ciudadana a la papelera sin eliminar historial."""
    citizen_user = db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.profile))
    ).scalar_one_or_none()
    if citizen_user is None or citizen_user.profile is None:
        raise api_error(404, "account_not_found", "No encontramos esa cuenta ciudadana")

    profile = citizen_user.profile
    profile.account_status = AccountStatus.TRASH.value

    record_audit(
        db,
        action="account.moved_to_trash",
        entity_type="citizen_profile",
        entity_id=profile.user_id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    db.commit()
    return citizen_account_summary_out(profile, citizen_user, include_full_dni=True)


@router.post("/accounts/{user_id}/restore", response_model=CitizenAccountSummaryOut)
def restore_account(
    user_id: int,
    actor: User = Depends(require_permission("users.manage")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> CitizenAccountSummaryOut:
    """Restaura una cuenta ciudadana de la papelera dejándola aprobada."""
    citizen_user = db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.profile))
    ).scalar_one_or_none()
    if citizen_user is None or citizen_user.profile is None:
        raise api_error(404, "account_not_found", "No encontramos esa cuenta ciudadana")

    profile = citizen_user.profile
    profile.account_status = AccountStatus.APPROVED.value

    record_audit(
        db,
        action="account.restored",
        entity_type="citizen_profile",
        entity_id=profile.user_id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    db.commit()
    return citizen_account_summary_out(profile, citizen_user, include_full_dni=True)


@router.post("/accounts/{user_id}/messages", response_model=AccountMessageOut)
def send_admin_account_message(
    user_id: int,
    data: AdminAccountMessageIn,
    actor: User = Depends(require_permission("users.manage")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> AccountMessageOut:
    """Envía un mensaje o indicación oficial al ciudadano."""
    citizen_user = db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.profile))
    ).scalar_one_or_none()
    if citizen_user is None or citizen_user.profile is None:
        raise api_error(404, "account_not_found", "No encontramos esa cuenta ciudadana")

    msg = AccountMessage(
        user_id=citizen_user.id,
        admin_id=actor.id,
        sender="admin",
        message=data.message.strip(),
        created_at=utcnow(),
    )
    db.add(msg)
    db.flush()

    record_audit(
        db,
        action="account_message.sent_by_admin",
        entity_type="account_message",
        entity_id=msg.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    notify_user(
        db,
        user=citizen_user,
        title="Nuevo mensaje de Tránsito",
        body=data.message[:100],
        link="/panel",
        idempotency_key=f"account-msg-{msg.id}",
    )
    db.commit()

    return account_message_out(msg)
