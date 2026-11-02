"""Acceso a las claves de cifrado y utilidades de serialización sensibles."""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.core.security import FieldCipher


@lru_cache
def get_cipher() -> FieldCipher:
    """Devuelve el cifrador AES configurado."""
    settings = get_settings()
    return FieldCipher(settings.encryption_key, settings.encryption_key_id)
