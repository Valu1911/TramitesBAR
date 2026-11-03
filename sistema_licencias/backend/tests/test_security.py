"""Tests de las primitivas de seguridad y de la cadena de auditoría."""

from __future__ import annotations

import base64
import secrets

import pytest

from app.core.security import (
    FieldCipher,
    blind_index,
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.services.audit import record_audit, verify_audit_chain


def test_password_hash_is_argon2id_and_verifies() -> None:
    """El hash no contiene la contraseña y usa Argon2id."""
    hashed = hash_password("ClaveSegura123!")

    assert hashed.startswith("$argon2id$")
    assert "ClaveSegura123!" not in hashed
    assert verify_password("ClaveSegura123!", hashed) is True
    assert verify_password("OtraClave123!", hashed) is False


def test_password_policy_rejects_short_and_common_values() -> None:
    """La política mínima se aplica antes de guardar."""
    with pytest.raises(ValueError):
        validate_password_strength("corta")
    with pytest.raises(ValueError):
        validate_password_strength("123456789012")


def test_field_cipher_roundtrip_and_tamper_detection() -> None:
    """AES-256-GCM descifra lo propio y detecta alteraciones."""
    key = base64.b64encode(secrets.token_bytes(32)).decode("ascii")
    cipher = FieldCipher(key, "k-test")
    encrypted = cipher.encrypt("30111222")

    assert encrypted is not None
    assert encrypted.startswith("v1.k-test.")
    assert cipher.decrypt(encrypted) == "30111222"

    tampered = encrypted[:-4] + "AAAA"
    with pytest.raises(ValueError):
        cipher.decrypt(tampered)


def test_blind_index_is_deterministic_and_keyed() -> None:
    """El índice ciego permite buscar sin guardar el DNI en claro."""
    key_a = secrets.token_urlsafe(32)
    key_b = secrets.token_urlsafe(32)

    assert blind_index("30.111.222", key_a) == blind_index("30111222", key_a)
    assert blind_index("30111222", key_a) != blind_index("30111222", key_b)
    assert "30111222" not in blind_index("30111222", key_a)


def test_audit_chain_detects_manual_alteration(db) -> None:  # type: ignore[no-untyped-def]
    """La cadena de auditoría queda invalidada si se cambia una fila."""
    record_audit(
        db,
        action="test.first",
        entity_type="test",
        entity_id=1,
        actor_role="test",
    )
    second = record_audit(
        db,
        action="test.second",
        entity_type="test",
        entity_id=2,
        actor_role="test",
    )
    db.commit()

    valid, total, broken, _message = verify_audit_chain(db)
    assert valid is True
    assert total == 2
    assert broken is None

    second.action = "test.alterado"
    db.commit()

    valid, _total, broken, message = verify_audit_chain(db)
    assert valid is False
    assert broken == second.id
    assert "alterada" in message
