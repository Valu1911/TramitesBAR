"""Pagos por transferencia, revisión y conciliación de extractos.

No se guardan datos de tarjeta. La conciliación es por referencia, monto y
fecha. Los montos altos requieren dos personas distintas (doble control).
"""

from __future__ import annotations

import csv
import io
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.errors import api_error
from app.core.security import utcnow
from app.domain.enums import PaymentStatus, StepCode, StepStatus
from app.models.payment import Payment, PaymentImport
from app.models.procedure import Procedure
from app.models.user import User
from app.services.audit import record_audit
from app.services.notifications import notify_user
from app.services.procedures import _advance_after_completed, get_procedure_or_404


def get_payment_or_404(db: Session, payment_id: int) -> Payment:
    """Busca un pago con trámite, ciudadano y pasos cargados."""
    stmt = (
        select(Payment)
        .where(Payment.id == payment_id)
        .options(
            selectinload(Payment.procedure)
            .selectinload(Procedure.steps),
            selectinload(Payment.procedure)
            .selectinload(Procedure.user)
            .selectinload(User.profile),
        )
    )
    payment = db.execute(stmt).scalar_one_or_none()
    if payment is None:
        raise api_error(404, "payment_not_found", "No encontramos ese pago")
    return payment


def list_payments(
    db: Session,
    *,
    status: str | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Payment], int]:
    """Lista pagos para el backoffice."""
    stmt = select(Payment).options(
        selectinload(Payment.procedure).selectinload(Procedure.user).selectinload(User.profile)
    )
    conditions = []
    if status:
        conditions.append(Payment.status == status)
    if q:
        like = f"%{q.strip()}%"
        conditions.append(
            Payment.reference.ilike(like)
            | Payment.procedure.has(Procedure.public_code.ilike(like))
            | Payment.procedure.has(Procedure.user.has(User.email.ilike(like)))
        )
    if conditions:
        stmt = stmt.where(*conditions)

    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()
    rows = (
        db.execute(stmt.order_by(Payment.created_at.desc()).limit(limit).offset(offset))
        .scalars()
        .all()
    )
    return list(rows), int(total)


def review_payment(
    db: Session,
    payment: Payment,
    *,
    decision: str,
    notes: str | None,
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> Payment:
    """Aprueba o rechaza un pago, aplicando doble control si corresponde."""
    if payment.status not in {
        PaymentStatus.CLAIMED.value,
        PaymentStatus.PENDING_SECOND.value,
    }:
        raise api_error(409, "payment_not_reviewable", "Ese pago no está pendiente de revisión")

    procedure = get_procedure_or_404(db, payment.procedure_id, staff=True)
    step = next((item for item in procedure.steps if item.code == StepCode.PAYMENT.value), None)
    if step is None:
        raise api_error(500, "payment_step_missing", "El trámite no tiene paso de pago")

    if decision == "reject":
        if notes is None or len(notes.strip()) < 5:
            raise api_error(422, "notes_required", "Indicá el motivo del rechazo")
        payment.status = PaymentStatus.REJECTED.value
        payment.reviewed_by = actor.id
        payment.reviewed_at = utcnow()
        payment.review_notes = notes
        step.status = StepStatus.REJECTED.value
        step.review_notes = notes
        procedure.current_step = StepCode.PAYMENT.value
        notify_user(
            db,
            user=procedure.user,
            title="Pago observado",
            body=f"El pago del trámite {procedure.public_code} fue observado.",
            link=f"/panel/tramites/{procedure.id}",
            email_template="payment_rejected",
            email_context={
                "procedure_code": procedure.public_code,
                "procedure_id": procedure.id,
                "notes": notes,
            },
            idempotency_key=f"payment-rejected-{payment.id}",
        )
        record_audit(
            db,
            action="payment.rejected",
            entity_type="payment",
            entity_id=payment.id,
            actor_user_id=actor.id,
            actor_role=actor.role,
            after={"status": payment.status, "notes": notes},
            ip=ip,
            user_agent=user_agent,
        )
        db.commit()
        return payment

    threshold = get_settings().payment_second_approval_threshold
    requiere_doble_control = payment.amount >= threshold

    if requiere_doble_control:
        if payment.reviewed_by is None:
            payment.reviewed_by = actor.id
            payment.status = PaymentStatus.PENDING_SECOND.value
            payment.review_notes = notes
            record_audit(
                db,
                action="payment.first_approval",
                entity_type="payment",
                entity_id=payment.id,
                actor_user_id=actor.id,
                actor_role=actor.role,
                after={"status": payment.status, "threshold": str(threshold)},
                ip=ip,
                user_agent=user_agent,
            )
            db.commit()
            return payment
        if payment.reviewed_by == actor.id:
            raise api_error(
                409,
                "second_approval_required",
                "Este pago necesita la aprobación de otra persona",
            )
        payment.second_reviewed_by = actor.id
    else:
        payment.reviewed_by = actor.id

    payment.status = PaymentStatus.APPROVED.value
    payment.reviewed_at = utcnow()
    payment.review_notes = notes
    _advance_after_completed(
        db,
        procedure,
        step,
        actor_id=actor.id,
        actor_role=actor.role,
        ip=ip,
        user_agent=user_agent,
    )
    notify_user(
        db,
        user=procedure.user,
        title="Pago acreditado",
        body=f"Aprobamos el pago del trámite {procedure.public_code}.",
        link=f"/panel/tramites/{procedure.id}",
        email_template="payment_approved",
        email_context={
            "procedure_code": procedure.public_code,
            "procedure_id": procedure.id,
        },
        idempotency_key=f"payment-approved-{payment.id}",
    )
    record_audit(
        db,
        action="payment.approved",
        entity_type="payment",
        entity_id=payment.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        before={"status": PaymentStatus.CLAIMED.value},
        after={
            "status": payment.status,
            "second_reviewed_by": payment.second_reviewed_by,
        },
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return payment


def _parse_amount(raw: str) -> Decimal:
    """Interpreta montos con formato argentino o internacional."""
    cleaned = (raw or "").replace("$", "").replace(" ", "").strip()
    if not cleaned:
        raise ValueError("monto vacío")
    if "," in cleaned and "." in cleaned:
        # Formato 12.500,00
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")
    value = Decimal(cleaned)
    if value <= 0:
        raise ValueError("monto inválido")
    return value.quantize(Decimal("0.01"))


def _parse_date(raw: str) -> date | None:
    """Interpreta fechas habituales de un extracto."""
    text = (raw or "").strip()
    if not text:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _read_statement(file: UploadFile) -> list[dict[str, str]]:
    """Lee un CSV o XLSX y devuelve filas normalizadas."""
    content = file.file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise api_error(413, "file_too_large", "El extracto no puede superar 5 MB")
    if not content:
        raise api_error(422, "empty_file", "El extracto está vacío")

    filename = (file.filename or "").lower()
    rows: list[dict[str, str]] = []

    if filename.endswith(".xlsx"):
        from openpyxl import load_workbook

        workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        sheet = workbook.active
        iterator = sheet.iter_rows(values_only=True)
        headers = [str(cell or "").strip().lower() for cell in next(iterator)]
        for values in iterator:
            row = {
                headers[index]: str(values[index]).strip() if values[index] is not None else ""
                for index in range(min(len(headers), len(values)))
            }
            if any(row.values()):
                rows.append(row)
    else:
        text = content.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            rows.append(
                {str(key or "").strip().lower(): (value or "").strip() for key, value in row.items()}
            )

    if not rows:
        raise api_error(422, "empty_statement", "El extracto no tiene filas")
    return rows


def import_statement(
    db: Session,
    *,
    file: UploadFile,
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> PaymentImport:
    """Concilia un extracto bancario contra los pagos declarados.

    Las filas que no coinciden no se descartan: quedan en `details` para que
    una persona las revise. Nunca se aprueba un pago por un monto distinto.
    """
    rows = _read_statement(file)
    settings = get_settings()
    matched = 0
    exceptions: list[dict] = []
    processed_ids: set[int] = set()

    for index, row in enumerate(rows, start=2):
        reference = (
            row.get("referencia")
            or row.get("reference")
            or row.get("codigo")
            or row.get("código")
            or ""
        ).strip().upper()
        amount_raw = row.get("monto") or row.get("amount") or ""
        description = row.get("descripcion") or row.get("descripción") or row.get("detalle") or ""
        try:
            amount = _parse_amount(amount_raw)
        except (ValueError, InvalidOperation):
            exceptions.append({"row": index, "reason": "monto inválido", "reference": reference})
            continue

        payment = db.execute(
            select(Payment).where(Payment.reference == reference).with_for_update()
        ).scalar_one_or_none()
        if payment is None:
            exceptions.append({"row": index, "reason": "referencia desconocida", "reference": reference})
            continue
        if payment.amount != amount:
            exceptions.append(
                {
                    "row": index,
                    "reason": "monto no coincide",
                    "reference": reference,
                    "expected": str(payment.amount),
                    "received": str(amount),
                }
            )
            continue
        if payment.status not in {PaymentStatus.CLAIMED.value, PaymentStatus.PENDING_SECOND.value}:
            exceptions.append(
                {
                    "row": index,
                    "reason": f"estado no conciliable: {payment.status}",
                    "reference": reference,
                }
            )
            continue
        if payment.id in processed_ids:
            exceptions.append({"row": index, "reason": "pago duplicado en el extracto", "reference": reference})
            continue

        processed_ids.add(payment.id)
        procedure = get_procedure_or_404(db, payment.procedure_id, staff=True)
        step = next(
            (item for item in procedure.steps if item.code == StepCode.PAYMENT.value), None
        )
        if step is None:
            exceptions.append({"row": index, "reason": "trámite sin paso de pago", "reference": reference})
            continue

        if payment.amount >= settings.payment_second_approval_threshold:
            payment.reviewed_by = payment.reviewed_by or actor.id
            payment.status = PaymentStatus.PENDING_SECOND.value
            payment.review_notes = f"Importado desde {file.filename}. Requiere segundo control."
            exceptions.append(
                {
                    "row": index,
                    "reason": "requiere segundo control",
                    "reference": reference,
                }
            )
        else:
            payment.status = PaymentStatus.APPROVED.value
            payment.reviewed_by = actor.id
            payment.reviewed_at = utcnow()
            payment.review_notes = f"Conciliado desde {file.filename}"
            _advance_after_completed(
                db,
                procedure,
                step,
                actor_id=actor.id,
                actor_role=actor.role,
                ip=ip,
                user_agent=user_agent,
            )
            notify_user(
                db,
                user=procedure.user,
                title="Pago acreditado",
                body=f"Conciliamos el pago del trámite {procedure.public_code}.",
                link=f"/panel/tramites/{procedure.id}",
                email_template="payment_approved",
                email_context={
                    "procedure_code": procedure.public_code,
                    "procedure_id": procedure.id,
                },
                idempotency_key=f"payment-import-approved-{payment.id}",
            )
            matched += 1

        record_audit(
            db,
            action="payment.imported",
            entity_type="payment",
            entity_id=payment.id,
            actor_user_id=actor.id,
            actor_role=actor.role,
            after={"status": payment.status, "file": file.filename, "description": description},
            ip=ip,
            user_agent=user_agent,
        )

    summary = PaymentImport(
        filename=file.filename or "extracto",
        total_rows=len(rows),
        matched_rows=matched,
        exception_rows=len(exceptions),
        imported_by=actor.id,
        details={
            "exceptions": exceptions[:200],
            "threshold": str(settings.payment_second_approval_threshold),
        },
        created_at=utcnow(),
    )
    db.add(summary)
    db.flush()
    record_audit(
        db,
        action="payment.import_completed",
        entity_type="payment_import",
        entity_id=summary.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        after={
            "total": summary.total_rows,
            "matched": summary.matched_rows,
            "exceptions": summary.exception_rows,
        },
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return summary


def list_imports(db: Session, limit: int = 50) -> list[PaymentImport]:
    """Lista importaciones recientes."""
    return list(
        db.execute(
            select(PaymentImport).order_by(PaymentImport.created_at.desc()).limit(limit)
        ).scalars()
    )
