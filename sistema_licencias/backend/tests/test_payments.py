"""Tests de pagos: doble control y conciliación de extractos."""

from __future__ import annotations

import io
from decimal import Decimal

import pytest
from fastapi import HTTPException, UploadFile
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.domain.enums import PaymentStatus, Role
from app.models.payment import Payment
from app.models.procedure import Document, Procedure, ProcedureMatrix, ProcedureStep, ProcedureType
from app.services import payments as payment_service
from app.services import procedures as procedure_service


def _procedure_with_payment(db: Session, user) -> tuple[Procedure, Payment]:
    """Crea un expediente mínimo con paso de pago y un pago declarado."""
    procedure_type = db.execute(
        select(ProcedureType).where(ProcedureType.code == "nueva")
    ).scalar_one()
    matrix = db.execute(
        select(ProcedureMatrix).where(
            ProcedureMatrix.procedure_type_id == procedure_type.id,
            ProcedureMatrix.license_category == "B",
        )
    ).scalar_one()
    procedure = Procedure(
        public_code="TRAMITE-PAGO-1",
        user_id=user.id,
        procedure_type_id=procedure_type.id,
        matrix_id=matrix.id,
        license_category="B",
        status="in_progress",
        current_step="payment",
        data={},
    )
    db.add(procedure)
    db.flush()
    db.add_all(
        [
            ProcedureStep(
                procedure_id=procedure.id,
                code="payment",
                position=1,
                status="submitted",
                data={},
            ),
            ProcedureStep(
                procedure_id=procedure.id,
                code="delivery",
                position=2,
                status="pending",
                data={},
            ),
        ]
    )
    payment = Payment(
        procedure_id=procedure.id,
        user_id=user.id,
        amount=Decimal("150000.00"),
        reference="PAGO-TRAMITE-PAGO-1",
        method="transfer",
        status=PaymentStatus.CLAIMED.value,
    )
    db.add(payment)
    db.commit()
    db.refresh(procedure)
    db.refresh(payment)
    return procedure, payment


def test_high_amount_payment_requires_two_different_reviewers(
    db: Session, seeded: Session, make_user
) -> None:
    """El doble control exige dos personas distintas para montos altos."""
    citizen = make_user(email="pagador@example.com")
    first = make_user(email="pagos1@example.com", role=Role.ADMIN_PAGOS.value)
    second = make_user(email="pagos2@example.com", role=Role.ADMIN.value)
    _procedure, payment = _procedure_with_payment(db, citizen)

    payment_service.review_payment(
        db,
        payment,
        decision="approve",
        notes=None,
        actor=first,
        ip="127.0.0.1",
        user_agent="test",
    )
    assert payment.status == PaymentStatus.PENDING_SECOND.value
    assert payment.reviewed_by == first.id

    try:
        payment_service.review_payment(
            db,
            payment,
            decision="approve",
            notes=None,
            actor=first,
            ip="127.0.0.1",
            user_agent="test",
        )
    except Exception as exc:  # la API traduce el error a HTTP 409
        assert getattr(exc, "status_code", None) == 409
    else:
        raise AssertionError("La misma persona no puede dar la segunda aprobación")

    payment_service.review_payment(
        db,
        payment,
        decision="approve",
        notes=None,
        actor=second,
        ip="127.0.0.1",
        user_agent="test",
    )
    assert payment.status == PaymentStatus.APPROVED.value
    assert payment.second_reviewed_by == second.id


def test_statement_import_matches_reference_and_amount(
    db: Session, seeded: Session, make_user
) -> None:
    """Un extracto con referencia y monto correctos aprueba el pago."""
    citizen = make_user(email="conciliado@example.com")
    reviewer = make_user(email="conciliador@example.com", role=Role.ADMIN_PAGOS.value)
    procedure, payment = _procedure_with_payment(db, citizen)
    payment.amount = Decimal("5000.00")
    db.commit()

    content = (
        "referencia,monto,descripcion\n"
        f"{payment.reference},5000.00,Transferencia bancaria\n"
    ).encode()
    statement = UploadFile(filename="extracto.csv", file=io.BytesIO(content))

    summary = payment_service.import_statement(
        db,
        file=statement,
        actor=reviewer,
        ip="127.0.0.1",
        user_agent="test",
    )

    assert summary.total_rows == 1
    assert summary.matched_rows == 1
    assert summary.exception_rows == 0
    db.refresh(payment)
    assert payment.status == PaymentStatus.APPROVED.value
    db.refresh(procedure)
    assert procedure.current_step == "delivery"


def test_statement_import_reports_amount_mismatch(
    db: Session, seeded: Session, make_user
) -> None:
    """Un monto distinto no aprueba nada y queda como excepción."""
    citizen = make_user(email="descuadrado@example.com")
    reviewer = make_user(email="conciliador2@example.com", role=Role.ADMIN_PAGOS.value)
    _procedure, payment = _procedure_with_payment(db, citizen)
    payment.amount = Decimal("5000.00")
    db.commit()

    content = f"referencia,monto\n{payment.reference},4500.00\n".encode()
    statement = UploadFile(filename="extracto.csv", file=io.BytesIO(content))

    summary = payment_service.import_statement(
        db,
        file=statement,
        actor=reviewer,
        ip="127.0.0.1",
        user_agent="test",
    )

    assert summary.matched_rows == 0
    assert summary.exception_rows == 1
    assert summary.details["exceptions"][0]["reason"] == "monto no coincide"
    db.refresh(payment)
    assert payment.status == PaymentStatus.CLAIMED.value


@pytest.mark.parametrize("payment_status", ["claimed", "pending_second", "refunded"])
def test_citizen_claim_does_not_restart_review(
    client, db: Session, seeded: Session, make_user, login, payment_status: str
) -> None:
    """Reenviar por API no puede borrar los revisores ni reiniciar la conciliación."""
    citizen = make_user(email="ordenante@example.com")
    reviewer = make_user(email="revisor@example.com", role=Role.ADMIN_PAGOS.value)
    procedure, payment = _procedure_with_payment(db, citizen)
    csrf, _ = login(citizen.email)
    document = client.post(
        f"/api/v1/procedures/{procedure.id}/documents",
        headers={"X-CSRF-Token": csrf},
        data={"kind": "payment_receipt"},
        files={"file": ("comprobante.pdf", b"%PDF-1.4\nPrueba aislada", "application/pdf")},
    )
    assert document.status_code == 201, document.text
    payment.status = payment_status
    payment.reviewed_by = reviewer.id
    payment.payer_name = "Ordenante original"
    payment.review_notes = "Control original"
    db.commit()

    response = client.post(
        f"/api/v1/procedures/{procedure.id}/payment/claim",
        headers={"X-CSRF-Token": csrf},
        json={"receipt_document_id": document.json()["id"], "payer_name": "Otro ordenante", "payer_dni": "1234567"},
    )

    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "payment_not_claimable"
    db.refresh(payment)
    assert payment.status == payment_status
    assert payment.reviewed_by == reviewer.id
    assert payment.review_notes == "Control original"
    assert payment.payer_name == "Ordenante original"
    assert payment.receipt_document_id is None


def test_review_rechecks_state_from_other_session(db: Session, seeded: Session, make_user) -> None:
    """Una aprobación anterior no puede reabrirse desde una instancia ORM precargada."""
    citizen = make_user(email="pago.anterior@example.com")
    reviewer = make_user(email="revision.nueva@example.com", role=Role.ADMIN_PAGOS.value)
    _procedure, payment = _procedure_with_payment(db, citizen)
    assert payment.status == "claimed"
    with Session(db.get_bind()) as other_session:
        other_session.execute(update(Payment).where(Payment.id == payment.id).values(status="approved"))
        other_session.commit()
    assert payment.status == "claimed"

    with pytest.raises(HTTPException) as raised:
        payment_service.review_payment(
            db, payment, decision="approve", notes=None, actor=reviewer,
            ip="127.0.0.1", user_agent="test",
        )
    assert raised.value.status_code == 409
    db.refresh(payment)
    assert payment.status == "approved"
    assert payment.reviewed_by is None


@pytest.mark.parametrize("procedure_status", ["cancelled", "rejected", "completed"])
def test_review_does_not_reopen_closed_procedure(
    db: Session, seeded: Session, make_user, procedure_status: str
) -> None:
    """Revisar un comprobante no resucita un expediente que ya está cerrado."""
    citizen = make_user(email="pago.cerrado@example.com")
    reviewer = make_user(email="revision.cierre@example.com", role=Role.ADMIN_PAGOS.value)
    procedure, payment = _procedure_with_payment(db, citizen)
    procedure.status = procedure_status
    procedure.current_step = None
    db.commit()
    with pytest.raises(HTTPException) as raised:
        payment_service.review_payment(
            db, payment, decision="approve", notes=None, actor=reviewer,
            ip="127.0.0.1", user_agent="test",
        )
    assert raised.value.status_code == 409
    db.refresh(payment)
    db.refresh(procedure)
    assert payment.status == "claimed"
    assert payment.reviewed_by is None
    assert procedure.status == procedure_status
    assert procedure.current_step is None


@pytest.mark.parametrize("role", [
    "citizen", "admin_cuentas", "admin_salud", "admin_turnos", "admin_pagos", "admin", "superadmin",
])
def test_staff_payment_api_permissions_and_metadata(
    client, db: Session, seeded: Session, make_user, login, role: str
) -> None:
    """El contrato de revisión expone contexto solo a los roles autorizados por la API."""
    citizen = make_user(email="titular.revision@example.com")
    procedure, payment = _procedure_with_payment(db, citizen)
    actor = citizen if role == "citizen" else make_user(
        email="revision.rol@example.com", role=role, mfa_enabled=True,
    )
    csrf, _ = login(actor.email)
    expected = 200 if role in {"admin_pagos", "admin", "superadmin"} else 403
    listing = client.get("/api/v1/admin/payments")
    detail = client.get(f"/api/v1/admin/payments/{payment.id}")
    assert listing.status_code == expected
    assert detail.status_code == expected
    review = client.post(
        f"/api/v1/admin/payments/{payment.id}/review",
        headers={"X-CSRF-Token": csrf}, json={"decision": "approve", "notes": None},
    )
    assert review.status_code == expected
    if expected == 200:
        assert detail.json()["procedure_id"] == procedure.id
        assert detail.json()["reviewed_by"] is None
        assert review.json()["status"] == "pending_second"
        assert review.json()["reviewed_by"] == actor.id
    else:
        db.refresh(payment)
        assert payment.status == "claimed"
        assert payment.reviewed_by is None
    if role == "citizen":
        own = client.get(f"/api/v1/procedures/{procedure.id}").json()["payment"]
        assert "reviewed_by" not in own
        assert "procedure_id" not in own


def test_staff_review_api_requires_other_reviewer_for_second_approval(
    client, db: Session, seeded: Session, make_user, login
) -> None:
    """El doble control se exige también al confirmar desde la consola HTTP."""
    citizen = make_user(email="doble.control@example.com")
    first = make_user(email="primer.control@example.com", role="admin_pagos", mfa_enabled=True)
    second = make_user(email="segundo.control@example.com", role="admin", mfa_enabled=True)
    procedure, payment = _procedure_with_payment(db, citizen)
    csrf, _ = login(first.email)
    path = f"/api/v1/admin/payments/{payment.id}/review"
    first_response = client.post(path, headers={"X-CSRF-Token": csrf}, json={"decision": "approve"})
    assert first_response.status_code == 200
    assert first_response.json()["status"] == "pending_second"
    repeated = client.post(path, headers={"X-CSRF-Token": csrf}, json={"decision": "approve"})
    assert repeated.status_code == 409
    assert repeated.json()["error"]["code"] == "second_approval_required"
    db.refresh(payment)
    assert payment.reviewed_by == first.id
    assert payment.second_reviewed_by is None
    csrf, _ = login(second.email)
    approved = client.post(path, headers={"X-CSRF-Token": csrf}, json={"decision": "approve"})
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    assert approved.json()["second_reviewed_by"] == second.id
    db.refresh(procedure)
    assert procedure.current_step == "delivery"


@pytest.mark.parametrize("case,expected", [
    ("missing_csrf", 403), ("pending_mfa", 403),
    ("missing_reason", 422), ("blank_reason", 422),
    ("oversized_reason", 422), ("invalid_decision", 422),
])
def test_staff_review_rejects_unsafe_requests_without_mutation(
    client, db: Session, seeded: Session, make_user, login, case: str, expected: int
) -> None:
    """CSRF, MFA y validación se exigen también fuera del formulario del navegador."""
    citizen = make_user(email="control.seguro@example.com")
    reviewer = make_user(
        email="control.personal@example.com", role="admin_pagos",
        mfa_enabled=case != "pending_mfa",
    )
    procedure, payment = _procedure_with_payment(db, citizen)
    csrf, _ = login(reviewer.email)
    notes = "     " if case == "blank_reason" else "a" * 2001 if case == "oversized_reason" else None
    decision = "other" if case == "invalid_decision" else "reject"
    response = client.post(
        f"/api/v1/admin/payments/{payment.id}/review",
        headers={} if case == "missing_csrf" else {"X-CSRF-Token": csrf},
        json={"decision": decision, "notes": notes},
    )
    assert response.status_code == expected, response.text
    db.refresh(payment)
    db.refresh(procedure)
    assert payment.status == "claimed"
    assert payment.reviewed_by is None
    assert payment.review_notes is None
    assert procedure.current_step == "payment"


def test_review_rechecks_procedure_closed_by_other_session(
    db: Session, seeded: Session, make_user
) -> None:
    """El bloqueo refresca también un cierre de expediente posterior a su precarga."""
    citizen = make_user(email="cierre.titular@example.com")
    reviewer = make_user(email="cierre.revisor@example.com", role="admin_pagos")
    procedure, payment = _procedure_with_payment(db, citizen)
    with Session(db.get_bind()) as other_session:
        other_session.execute(update(Procedure).where(Procedure.id == procedure.id).values(
            status="cancelled", current_step=None,
        ))
        other_session.commit()
    assert procedure.status == "in_progress"
    with pytest.raises(HTTPException) as raised:
        payment_service.review_payment(
            db, payment, decision="reject", notes="Comprobante observado",
            actor=reviewer, ip="127.0.0.1", user_agent="test",
        )
    assert raised.value.status_code == 409
    detail = raised.value.detail
    assert isinstance(detail, dict) and detail.get("code") == "payment_step_unavailable"
    db.refresh(payment)
    db.refresh(procedure)
    assert payment.status == "claimed"
    assert payment.reviewed_by is None
    assert procedure.status == "cancelled"


def test_claim_refreshes_payment_state_before_overwriting_review(
    db: Session, seeded: Session, make_user
) -> None:
    """Una instancia ORM precargada no puede ocultar un control ya iniciado por otra sesión."""
    citizen = make_user(email="estado.pago@example.com")
    reviewer = make_user(email="revisor.estado@example.com", role=Role.ADMIN_PAGOS.value)
    procedure, payment = _procedure_with_payment(db, citizen)
    payment.status = "pending"
    document = Document(
        procedure_id=procedure.id, user_id=citizen.id, kind="payment_receipt",
        original_name="prueba.pdf", storage_key="test-only/prueba.pdf",
        mime="application/pdf", size_bytes=1, sha256="0" * 64, status="pending",
    )
    db.add(document)
    db.commit()
    document_id = document.id
    assert payment.status == "pending"
    with Session(db.get_bind()) as other_session:
        other_session.execute(
            update(Payment).where(Payment.id == payment.id).values(
                status="pending_second", reviewed_by=reviewer.id,
            )
        )
        other_session.commit()
    assert payment.status == "pending"  # La sesión original todavía conserva su instancia vieja.

    with pytest.raises(HTTPException) as raised:
        procedure_service.claim_payment(
            db, procedure, receipt_document_id=document_id,
            payer_name="Ordenante prueba", payer_dni="1234567", transfer_date=None,
            notes=None, actor=citizen, ip="127.0.0.1", user_agent="test",
        )
    assert raised.value.status_code == 409
    db.refresh(payment)
    assert payment.status == "pending_second"
    assert payment.reviewed_by == reviewer.id


@pytest.mark.parametrize("payment_status", ["pending", "rejected"])
def test_citizen_claim_records_receipt_without_approving(
    client, db: Session, seeded: Session, make_user, login, payment_status: str
) -> None:
    """Declarar o corregir un pago deja el paso pendiente de revisión municipal."""
    citizen = make_user(email="pagador.portal@example.com")
    procedure, payment = _procedure_with_payment(db, citizen)
    payment.status = payment_status
    db.commit()
    csrf, _ = login(citizen.email)
    document = client.post(
        f"/api/v1/procedures/{procedure.id}/documents",
        headers={"X-CSRF-Token": csrf},
        data={"kind": "payment_receipt"},
        files={"file": ("comprobante.pdf", b"%PDF-1.4\nPrueba aislada", "application/pdf")},
    )
    assert document.status_code == 201, document.text
    response = client.post(
        f"/api/v1/procedures/{procedure.id}/payment/claim",
        headers={"X-CSRF-Token": csrf},
        json={"receipt_document_id": document.json()["id"], "payer_name": "Ordenante de prueba", "payer_dni": "1234567"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "claimed"
    assert response.json()["amount"] == "150000.00"
    db.refresh(procedure)
    assert procedure.current_step == "payment"
    assert next(step for step in procedure.steps if step.code == "payment").status == "submitted"
    assert next(step for step in procedure.steps if step.code == "delivery").status == "pending"


@pytest.mark.parametrize("denial", ["owner", "csrf", "step"])
def test_payment_claim_preserves_owner_csrf_and_step_guards(
    client, db: Session, seeded: Session, make_user, login, denial: str
) -> None:
    """La pantalla nueva no reemplaza las guardas del servidor."""
    citizen = make_user(email="titular.pago@example.com")
    other = make_user(email="otra.persona@example.com")
    procedure, payment = _procedure_with_payment(db, citizen)
    payment.status = "pending"
    db.commit()
    csrf, _ = login(citizen.email)
    document = client.post(
        f"/api/v1/procedures/{procedure.id}/documents",
        headers={"X-CSRF-Token": csrf},
        data={"kind": "payment_receipt"},
        files={"file": ("prueba.pdf", b"%PDF-1.4\nPrueba aislada", "application/pdf")},
    )
    assert document.status_code == 201
    if denial == "owner":
        csrf, _ = login(other.email)
    elif denial == "step":
        procedure.current_step = "health"
        db.commit()
    response = client.post(
        f"/api/v1/procedures/{procedure.id}/payment/claim",
        headers={} if denial == "csrf" else {"X-CSRF-Token": csrf},
        json={"receipt_document_id": document.json()["id"], "payer_name": "Ordenante de prueba", "payer_dni": "1234567"},
    )
    assert response.status_code == {"owner": 404, "csrf": 403, "step": 409}[denial]
    db.refresh(payment)
    assert payment.status == "pending"
    assert payment.receipt_document_id is None
