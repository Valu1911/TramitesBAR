"""Tests de pagos: doble control y conciliación de extractos."""

from __future__ import annotations

import io
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.datastructures import UploadFile

from app.domain.enums import PaymentStatus, Role
from app.models.payment import Payment
from app.models.procedure import Procedure, ProcedureMatrix, ProcedureStep, ProcedureType
from app.services import payments as payment_service


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
