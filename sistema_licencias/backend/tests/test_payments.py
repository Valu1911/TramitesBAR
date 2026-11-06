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
