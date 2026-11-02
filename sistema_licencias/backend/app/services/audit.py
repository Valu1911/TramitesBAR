"""Auditoría append-only con cadena de hashes.

Cada entrada incluye el hash de la anterior. Si una fila se modifica o se
borra, la verificación de cadena lo detecta. La aplicación nunca actualiza ni
borra `audit_log`.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import json_safe, utcnow
from app.models.audit import AuditLog


def _entry_payload(entry: AuditLog) -> dict:
    """Arma el payload canónico que se hashea."""
    return {
        "actor_user_id": entry.actor_user_id,
        "actor_role": entry.actor_role,
        "action": entry.action,
        "entity_type": entry.entity_type,
        "entity_id": entry.entity_id,
        "before": entry.before,
        "after": entry.after,
        "ip": entry.ip,
        "user_agent": entry.user_agent,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


def _hash_entry(prev_hash: str | None, entry: AuditLog) -> str:
    """Calcula el hash encadenado de una entrada."""
    payload = json.dumps(_entry_payload(entry), sort_keys=True, default=str, ensure_ascii=False)
    return hashlib.sha256(((prev_hash or "") + payload).encode("utf-8")).hexdigest()


def record_audit(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: str | int | None = None,
    actor_user_id: int | None = None,
    actor_role: str | None = None,
    before: dict | None = None,
    after: dict | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    created_at: datetime | None = None,
) -> AuditLog:
    """Agrega una entrada de auditoría a la transacción actual.

    No hace commit: la entrada se confirma junto con el cambio que audita. Si
    el cambio falla, la auditoría también se revierte, evitando registros
    huérfanos.
    """
    previous = db.execute(
        select(AuditLog).order_by(AuditLog.id.desc()).limit(1).with_for_update()
    ).scalar_one_or_none()
    entry = AuditLog(
        actor_user_id=actor_user_id,
        actor_role=actor_role,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        before=json_safe(before) if before is not None else None,
        after=json_safe(after) if after is not None else None,
        ip=ip,
        user_agent=(user_agent or "")[:255] or None,
        created_at=created_at or utcnow(),
        prev_hash=previous.entry_hash if previous else None,
        entry_hash="",
    )
    entry.entry_hash = _hash_entry(entry.prev_hash, entry)
    db.add(entry)
    db.flush()
    return entry


def verify_audit_chain(db: Session) -> tuple[bool, int, int | None, str]:
    """Recorre la cadena y devuelve si es válida y dónde se rompió."""
    entries = db.execute(select(AuditLog).order_by(AuditLog.id.asc())).scalars().all()
    previous_hash: str | None = None
    for entry in entries:
        expected = _hash_entry(previous_hash, entry)
        if entry.prev_hash != previous_hash or entry.entry_hash != expected:
            return False, len(entries), entry.id, "La cadena de auditoría fue alterada"
        previous_hash = entry.entry_hash
    return True, len(entries), None, "Cadena de auditoría íntegra"
