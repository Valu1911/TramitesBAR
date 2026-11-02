"""Políticas versionadas: consulta, aceptación y control de pendientes.

La aceptación se guarda con el hash del texto que el usuario vio. Si mañana se
publica una versión nueva, la aceptación anterior no cubre el texto nuevo.
"""

from __future__ import annotations

import hashlib

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.core.security import utcnow
from app.models.policy import Policy, PolicyAcceptance
from app.models.user import User
from app.services.audit import record_audit


def policy_hash(body_md: str) -> str:
    """Calcula el hash canónico del cuerpo de una política."""
    return hashlib.sha256(body_md.encode("utf-8")).hexdigest()


def active_policies(db: Session) -> list[Policy]:
    """Devuelve la versión activa más reciente de cada política."""
    rows = list(
        db.execute(
            select(Policy)
            .where(Policy.active.is_(True))
            .order_by(Policy.slug.asc(), Policy.version.desc())
        ).scalars()
    )
    latest: dict[str, Policy] = {}
    for policy in rows:
        latest.setdefault(policy.slug, policy)
    return sorted(latest.values(), key=lambda item: (not item.mandatory, item.slug))


def get_policy_or_404(db: Session, slug: str) -> Policy:
    """Busca la versión activa de una política por slug."""
    policy = db.execute(
        select(Policy)
        .where(Policy.slug == slug, Policy.active.is_(True))
        .order_by(Policy.version.desc())
        .limit(1)
    ).scalar_one_or_none()
    if policy is None:
        raise api_error(404, "policy_not_found", "La política no existe")
    return policy


def accepted_policy_ids(db: Session, user: User) -> set[int]:
    """Devuelve los IDs de políticas ya aceptadas por el usuario."""
    rows = db.execute(
        select(PolicyAcceptance.policy_id).where(PolicyAcceptance.user_id == user.id)
    ).scalars()
    return set(rows)


def pending_policies(db: Session, user: User) -> list[Policy]:
    """Devuelve las políticas obligatorias que el usuario todavía no aceptó."""
    accepted = accepted_policy_ids(db, user)
    return [
        policy
        for policy in active_policies(db)
        if policy.mandatory and policy.id not in accepted
    ]


def pending_policy_slugs(db: Session, user: User) -> list[str]:
    """Slugs pendientes, en el orden en que conviene mostrarlos."""
    return [policy.slug for policy in pending_policies(db, user)]


def _record_acceptance(
    db: Session,
    *,
    user: User,
    policy: Policy,
    ip: str | None,
    user_agent: str | None,
) -> PolicyAcceptance:
    """Crea la aceptación si no existe y devuelve la existente si ya estaba."""
    existing = db.execute(
        select(PolicyAcceptance).where(
            PolicyAcceptance.user_id == user.id,
            PolicyAcceptance.policy_id == policy.id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    acceptance = PolicyAcceptance(
        user_id=user.id,
        policy_id=policy.id,
        content_hash=policy.content_hash,
        accepted_at=utcnow(),
        ip=ip,
        user_agent=(user_agent or "")[:255] or None,
    )
    db.add(acceptance)
    db.flush()
    record_audit(
        db,
        action="policy.accepted",
        entity_type="policy",
        entity_id=policy.id,
        actor_user_id=user.id,
        actor_role=user.role,
        after={"slug": policy.slug, "version": policy.version, "hash": policy.content_hash},
        ip=ip,
        user_agent=user_agent,
    )
    return acceptance


def accept_policy(
    db: Session,
    *,
    user: User,
    slug: str,
    ip: str | None,
    user_agent: str | None,
) -> Policy:
    """Registra la aceptación explícita de una política vigente."""
    policy = get_policy_or_404(db, slug)
    _record_acceptance(db, user=user, policy=policy, ip=ip, user_agent=user_agent)
    db.commit()
    return policy


def accept_for_registration(
    db: Session,
    *,
    user: User,
    slugs: list[str],
    ip: str | None,
    user_agent: str | None,
) -> None:
    """Valida y registra las políticas aceptadas en el alta de cuenta.

    No hace commit: la aceptación se confirma junto con el usuario.
    """
    active = active_policies(db)
    by_slug = {policy.slug: policy for policy in active}
    mandatory = [policy for policy in active if policy.mandatory]

    missing = [policy.slug for policy in mandatory if policy.slug not in set(slugs)]
    if missing:
        raise api_error(
            422,
            "policies_required",
            "Tenés que aceptar todas las políticas obligatorias",
            missing=missing,
        )

    unknown = [slug for slug in slugs if slug not in by_slug]
    if unknown:
        raise api_error(
            422,
            "policy_unknown",
            "Una de las políticas indicadas no está vigente",
            unknown=unknown,
        )

    for slug in dict.fromkeys(slugs):
        _record_acceptance(
            db,
            user=user,
            policy=by_slug[slug],
            ip=ip,
            user_agent=user_agent,
        )
