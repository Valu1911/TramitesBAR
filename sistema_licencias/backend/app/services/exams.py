"""Examen teórico: banco de preguntas, intentos y corrección en servidor.

El ciudadano nunca recibe las respuestas correctas antes de entregar. La
puntuación se calcula acá, no en el navegador.
"""

from __future__ import annotations

import math
from datetime import timedelta

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import api_error
from app.core.security import utcnow
from app.domain.enums import ExamStatus, StepCode, StepStatus
from app.models.exam import ExamAnswer, ExamAttempt, Question
from app.models.procedure import Procedure
from app.models.user import User
from app.schemas.exam import (
    AttemptQuestionOut,
    AttemptResultOut,
    AttemptStartOut,
    ExamAnswerIn,
)
from app.services.audit import record_audit
from app.services.notifications import notify_user
from app.services.procedures import (
    _advance_after_completed,
    get_procedure_or_404,
)


def pass_score_for(procedure: Procedure) -> int:
    """Calcula el puntaje mínimo a partir de la matriz y el total de preguntas."""
    total = int(procedure.matrix.theory_questions)
    ratio = float(procedure.matrix.theory_pass_ratio)
    return max(1, math.ceil(total * ratio))


def _random_order(db: Session):  # type: ignore[no-untyped-def]
    """Devuelve la función de orden aleatorio según el motor."""
    bind = db.get_bind()
    dialect = bind.dialect.name if bind is not None else "sqlite"
    return func.rand() if dialect == "mysql" else func.random()


def get_attempt_or_404(
    db: Session, attempt_id: int, *, user: User | None = None, staff: bool = False
) -> ExamAttempt:
    """Busca un intento con su trámite y respuestas."""
    stmt = (
        select(ExamAttempt)
        .where(ExamAttempt.id == attempt_id)
        .options(
            selectinload(ExamAttempt.answers),
            selectinload(ExamAttempt.procedure).selectinload(Procedure.steps),
            selectinload(ExamAttempt.procedure).selectinload(Procedure.user),
        )
    )
    attempt = db.execute(stmt).scalar_one_or_none()
    if attempt is None:
        raise api_error(404, "attempt_not_found", "No encontramos ese intento")
    if user is not None and attempt.user_id != user.id:
        raise api_error(404, "attempt_not_found", "No encontramos ese intento")
    if not staff and user is None:
        raise api_error(403, "forbidden", "No tenés acceso a ese intento")
    return attempt


def start_attempt(
    db: Session,
    procedure: Procedure,
    *,
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> ExamAttempt:
    """Inicia un intento nuevo o devuelve el que está en curso."""
    from app.services.procedures import require_current_step as require_step

    step = require_step(procedure, StepCode.THEORY.value)

    attempts = list(
        db.execute(
            select(ExamAttempt)
            .where(ExamAttempt.procedure_id == procedure.id)
            .order_by(ExamAttempt.attempt_number.asc())
        ).scalars()
    )
    active = next(
        (item for item in attempts if item.status == ExamStatus.IN_PROGRESS.value), None
    )
    if active is not None:
        if active.expires_at > utcnow():
            return active
        active.status = ExamStatus.EXPIRED.value
        db.flush()

    max_attempts = int(procedure.matrix.max_theory_attempts) + int(
        (procedure.data or {}).get("_extra_attempts", 0)
    )
    if len(attempts) >= max_attempts:
        raise api_error(
            409,
            "no_attempts_left",
            "No te quedan intentos de examen. Pedí autorización en la oficina de licencias.",
            attempts=len(attempts),
            max_attempts=max_attempts,
        )

    total = int(procedure.matrix.theory_questions)
    stmt = (
        select(Question)
        .where(
            Question.active.is_(True),
            Question.reviewed.is_(True),
            or_(Question.category == procedure.license_category, Question.category == "all"),
        )
        .order_by(_random_order(db))
        .limit(total)
    )
    questions = list(db.execute(stmt).scalars().all())
    if len(questions) < total:
        raise api_error(
            409,
            "questions_not_available",
            "El banco de preguntas todavía no tiene suficientes preguntas revisadas para esta categoría",
            available=len(questions),
            required=total,
        )

    now = utcnow()
    attempt = ExamAttempt(
        procedure_id=procedure.id,
        user_id=procedure.user_id,
        attempt_number=len(attempts) + 1,
        status=ExamStatus.IN_PROGRESS.value,
        questions=[
            {
                "id": question.id,
                "prompt": question.prompt,
                "options": question.options,
                "correct_index": question.correct_index,
            }
            for question in questions
        ],
        total=total,
        started_at=now,
        expires_at=now + timedelta(minutes=int(procedure.matrix.theory_minutes)),
    )
    db.add(attempt)
    db.flush()

    step.status = StepStatus.IN_PROGRESS.value
    step.data = {
        **(step.data or {}),
        "attempt_id": attempt.id,
        "attempt_number": attempt.attempt_number,
        "total": total,
    }

    record_audit(
        db,
        action="exam.started",
        entity_type="exam_attempt",
        entity_id=attempt.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        after={"procedure_id": procedure.id, "attempt_number": attempt.attempt_number},
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return attempt


def attempt_start_out(attempt: ExamAttempt, procedure: Procedure) -> AttemptStartOut:
    """Convierte un intento en la respuesta pública sin respuestas correctas."""
    questions = [
        AttemptQuestionOut(
            index=index,
            prompt=item["prompt"],
            options=item["options"],
        )
        for index, item in enumerate(attempt.questions)
    ]
    return AttemptStartOut(
        attempt_id=attempt.id,
        questions=questions,
        total=attempt.total,
        pass_score=pass_score_for(procedure),
        started_at=attempt.started_at,
        expires_at=attempt.expires_at,
    )


def submit_attempt(
    db: Session,
    attempt: ExamAttempt,
    *,
    answers: list[ExamAnswerIn],
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> AttemptResultOut:
    """Corrige el examen en el servidor y avanza el trámite si aprueba."""
    if attempt.user_id != actor.id:
        raise api_error(404, "attempt_not_found", "No encontramos ese intento")
    if attempt.status != ExamStatus.IN_PROGRESS.value:
        raise api_error(409, "attempt_closed", "Ese intento ya fue entregado")

    # Damos 30 segundos de gracia por latencia de red, nunca más.
    if utcnow() > attempt.expires_at + timedelta(seconds=30):
        attempt.status = ExamStatus.EXPIRED.value
        attempt.submitted_at = utcnow()
        db.commit()
        raise api_error(409, "attempt_expired", "El tiempo del examen terminó")

    procedure = get_procedure_or_404(db, attempt.procedure_id, staff=True)
    total = len(attempt.questions)
    if len(answers) != total:
        raise api_error(
            422,
            "answers_incomplete",
            "Tenés que responder todas las preguntas",
            expected=total,
            received=len(answers),
        )

    by_index = {answer.index: answer for answer in answers}
    if set(by_index) != set(range(total)):
        raise api_error(422, "answers_invalid", "Las respuestas no corresponden al examen")

    score = 0
    for index, question in enumerate(attempt.questions):
        answer = by_index[index]
        if answer.selected_index < 0 or answer.selected_index >= len(question["options"]):
            raise api_error(422, "answer_out_of_range", "Una respuesta quedó fuera de rango")
        correct = answer.selected_index == int(question["correct_index"])
        score += 1 if correct else 0
        db.add(
            ExamAnswer(
                attempt_id=attempt.id,
                question_index=index,
                selected_index=answer.selected_index,
                correct=correct,
            )
        )

    minimum = pass_score_for(procedure)
    passed = score >= minimum
    attempt.score = score
    attempt.submitted_at = utcnow()
    attempt.status = ExamStatus.PASSED.value if passed else ExamStatus.FAILED.value

    step = next((item for item in procedure.steps if item.code == StepCode.THEORY.value), None)
    if step is not None:
        step.data = {
            **(step.data or {}),
            "score": score,
            "total": total,
            "pass_score": minimum,
            "result": "passed" if passed else "failed",
        }
        if passed:
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
            step.status = StepStatus.IN_PROGRESS.value
            procedure.current_step = StepCode.THEORY.value

    notify_user(
        db,
        user=procedure.user,
        title="Resultado del examen teórico",
        body=(
            f"Aprobaste el examen con {score} de {total} respuestas correctas."
            if passed
            else f"Obtuviste {score} de {total}. Necesitás {minimum} para aprobar."
        ),
        link=f"/panel/tramites/{procedure.id}",
        email_template="exam_result",
        email_context={
            "procedure_code": procedure.public_code,
            "procedure_id": procedure.id,
            "result_label": "Aprobado" if passed else "Desaprobado",
            "score": score,
            "total": total,
        },
        idempotency_key=f"exam-result-{attempt.id}",
    )
    record_audit(
        db,
        action="exam.submitted",
        entity_type="exam_attempt",
        entity_id=attempt.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        after={
            "score": score,
            "total": total,
            "pass_score": minimum,
            "result": attempt.status,
        },
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return AttemptResultOut(
        attempt_id=attempt.id,
        status=attempt.status,
        score=score,
        total=total,
        pass_score=minimum,
        passed=passed,
        submitted_at=attempt.submitted_at,
    )


def list_questions(
    db: Session,
    *,
    reviewed: bool | None = None,
    active: bool | None = None,
    category: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[Question], int]:
    """Lista preguntas con filtros para administración."""
    stmt = select(Question)
    conditions: list[ColumnElement[bool]] = []
    if reviewed is not None:
        conditions.append(Question.reviewed.is_(reviewed))
    if active is not None:
        conditions.append(Question.active.is_(active))
    if category:
        conditions.append(Question.category == category)
    if conditions:
        stmt = stmt.where(*conditions)
    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()
    rows = (
        db.execute(stmt.order_by(Question.id.desc()).limit(limit).offset(offset))
        .scalars()
        .all()
    )
    return list(rows), int(total)


def create_question(
    db: Session,
    *,
    data: dict,
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> Question:
    """Agrega una pregunta al banco. Nace sin revisar."""
    options = data["options"]
    if data["correct_index"] >= len(options):
        raise api_error(422, "invalid_correct_index", "La respuesta correcta no existe")
    question = Question(
        category=data.get("category", "B"),
        prompt=data["prompt"].strip(),
        options=[option.strip() for option in options],
        correct_index=data["correct_index"],
        explanation=data.get("explanation"),
        source=data.get("source"),
        active=True,
        reviewed=False,
    )
    db.add(question)
    db.flush()
    record_audit(
        db,
        action="question.created",
        entity_type="question",
        entity_id=question.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return question


def update_question(
    db: Session,
    question: Question,
    *,
    data: dict,
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> Question:
    """Edita una pregunta. Si cambia el contenido, vuelve a revisión."""
    before = {
        "prompt": question.prompt,
        "options": question.options,
        "correct_index": question.correct_index,
    }
    content_changed = False
    for field in ("category", "prompt", "options", "correct_index", "explanation", "source", "active"):
        if field not in data or data[field] is None:
            continue
        if field in {"prompt", "options", "correct_index"} and data[field] != getattr(question, field):
            content_changed = True
        setattr(question, field, data[field])

    if question.correct_index >= len(question.options):
        raise api_error(422, "invalid_correct_index", "La respuesta correcta no existe")
    if content_changed:
        question.reviewed = False

    record_audit(
        db,
        action="question.updated",
        entity_type="question",
        entity_id=question.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        before=before,
        after={
            "prompt": question.prompt,
            "options": question.options,
            "correct_index": question.correct_index,
        },
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return question


def review_question(
    db: Session,
    question: Question,
    *,
    reviewed: bool,
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> Question:
    """Marca una pregunta como revisada o la saca de circulación."""
    question.reviewed = reviewed
    record_audit(
        db,
        action="question.reviewed",
        entity_type="question",
        entity_id=question.id,
        actor_user_id=actor.id,
        actor_role=actor.role,
        after={"reviewed": reviewed},
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return question


def import_questions(
    db: Session,
    *,
    questions: list[dict],
    actor: User,
    ip: str | None,
    user_agent: str | None,
) -> int:
    """Importa un lote de preguntas sin revisar."""
    inserted = 0
    for index, data in enumerate(questions, start=1):
        options = data.get("options") or []
        correct = int(data.get("correct_index", -1))
        if len(options) < 2 or not (0 <= correct < len(options)):
            raise api_error(
                422,
                "invalid_question",
                f"La pregunta {index} tiene opciones o respuesta correcta inválida",
            )
        db.add(
            Question(
                category=data.get("category", "B"),
                prompt=str(data["prompt"]).strip(),
                options=[str(option).strip() for option in options],
                correct_index=correct,
                explanation=data.get("explanation"),
                source=data.get("source"),
                active=True,
                reviewed=False,
            )
        )
        inserted += 1
    record_audit(
        db,
        action="question.imported",
        entity_type="question",
        actor_user_id=actor.id,
        actor_role=actor.role,
        after={"inserted": inserted},
        ip=ip,
        user_agent=user_agent,
    )
    db.commit()
    return inserted
