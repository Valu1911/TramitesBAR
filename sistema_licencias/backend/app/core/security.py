"""Primitivas de seguridad: contraseñas, cifrado, tokens, TOTP y QR.

Reglas que aplica este módulo:
- Contraseñas con Argon2id, nunca SHA-256.
- Datos sensibles con AES-256-GCM y clave fuera de la base.
- Índice ciego de DNI con HMAC-SHA-256 y clave separada.
- Tokens opacos de 256 bits; en base se guarda solo su hash.
- Comparaciones en tiempo constante.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import io
import secrets
from datetime import UTC, datetime
from typing import Any

import pyotp
import qrcode
import qrcode.image.svg
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Parámetros de Argon2id acordados en el plan (64 MiB, 3 pasadas, 4 hilos).
_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=64 * 1024,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)

# Lista mínima de contraseñas obvias. No reemplaza a un verificador zxcvbn,
# pero bloquea lo que nunca debe llegar a producción.
_COMMON_PASSWORDS = {
    "admin123",
    "password",
    "123456789012",
    "tramitesbar",
    "baradero123",
    "qwertyuiop",
    "administrador",
}


def utcnow() -> datetime:
    """Devuelve la hora actual en UTC sin zona, para columnas MySQL DateTime."""
    return datetime.now(UTC).replace(tzinfo=None)


def hash_password(password: str) -> str:
    """Genera el hash Argon2id de una contraseña."""
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verifica una contraseña sin filtrar si el usuario existe."""
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    """Indica si el hash usa parámetros viejos y conviene regenerarlo."""
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


def validate_password_strength(password: str) -> None:
    """Valida una contraseña nueva y lanza ValueError con un mensaje claro."""
    if len(password) < 12:
        raise ValueError("La contraseña debe tener al menos 12 caracteres")
    if len(password) > 128:
        raise ValueError("La contraseña no puede superar los 128 caracteres")
    if not any(c.isalpha() for c in password):
        raise ValueError("La contraseña debe incluir al menos una letra")
    if not any(c.isdigit() for c in password):
        raise ValueError("La contraseña debe incluir al menos un número")
    if password.lower() in _COMMON_PASSWORDS:
        raise ValueError("Esa contraseña es demasiado común. Elegí otra")


class FieldCipher:
    """Cifra y descifra campos sensibles con AES-256-GCM.

    El formato almacenado es `v1.<key_id>.<base64(nonce + ciphertext + tag)>`.
    El `key_id` permite rotar claves sin perder los datos viejos.
    """

    def __init__(self, key_b64: str, key_id: str) -> None:
        """Carga la clave maestra desde base64 y valida su longitud."""
        key = base64.b64decode(key_b64, validate=True)
        if len(key) != 32:
            raise ValueError("La clave AES debe tener 32 bytes")
        self._aes = AESGCM(key)
        self._key_id = key_id

    def encrypt(self, value: str | None) -> str | None:
        """Cifra un texto. Devuelve None si el valor es None."""
        if value is None:
            return None
        nonce = secrets.token_bytes(12)
        ciphertext = self._aes.encrypt(nonce, value.encode("utf-8"), self._key_id.encode("utf-8"))
        payload = base64.b64encode(nonce + ciphertext).decode("ascii")
        return f"v1.{self._key_id}.{payload}"

    def decrypt(self, value: str | None) -> str | None:
        """Descifra un texto almacenado. Lanza ValueError si fue alterado."""
        if value is None:
            return None
        try:
            version, key_id, payload = value.split(".", 2)
            if version != "v1":
                raise ValueError("Versión de cifrado desconocida")
            raw = base64.b64decode(payload, validate=True)
            nonce, ciphertext = raw[:12], raw[12:]
            plain = self._aes.decrypt(nonce, ciphertext, key_id.encode("utf-8"))
            return plain.decode("utf-8")
        except Exception as exc:  # noqa: BLE001 - se traduce a un error de dominio
            raise ValueError("No se pudo descifrar el campo") from exc


def blind_index(value: str, key: str) -> str:
    """Calcula el índice ciego HMAC-SHA-256 de un DNI u otro identificador.

    Normaliza a dígitos para que `30.123.456` y `30123456` sean equivalentes.
    """
    normalized = "".join(ch for ch in value if ch.isdigit() or ch.isalpha()).upper()
    return hmac.new(key.encode("utf-8"), normalized.encode("utf-8"), hashlib.sha256).hexdigest()


def new_token(nbytes: int = 32) -> str:
    """Genera un token opaco URL-safe."""
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """Guarda en base solo el hash SHA-256 del token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def constant_time_equals(left: str, right: str) -> bool:
    """Compara dos textos en tiempo constante."""
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))


def generate_totp_secret() -> str:
    """Genera un secreto TOTP base32."""
    return pyotp.random_base32()


def totp_uri(secret: str, email: str, issuer: str = "TramitesBAR") -> str:
    """Devuelve el URI otpauth para cargar en una app autenticadora."""
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)


def verify_totp(secret: str, code: str) -> bool:
    """Verifica un código TOTP aceptando un desfase de 30 segundos."""
    if not code or not code.isdigit():
        return False
    return pyotp.TOTP(secret).verify(code, valid_window=1)


def generate_recovery_codes(cantidad: int = 10) -> list[str]:
    """Genera códigos de recuperación de un solo uso."""
    return [secrets.token_hex(5).upper() for _ in range(cantidad)]


def hash_recovery_code(code: str) -> str:
    """Hashea un código de recuperación para almacenarlo."""
    return hashlib.sha256(code.upper().encode("utf-8")).hexdigest()


def mask_email(email: str) -> str:
    """Enmascara un correo para mostrarlo sin exponerlo completo."""
    if "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        return f"{local[0]}***@{domain}"
    return f"{local[0]}***{local[-1]}@{domain}"


def mask_dni(dni: str) -> str:
    """Muestra solo los últimos tres dígitos de un DNI."""
    digits = "".join(ch for ch in dni if ch.isdigit())
    return f"***{digits[-3:]}" if digits else "***"


def mask_name(first_name: str, last_name: str) -> str:
    """Muestra nombre y apellido con iniciales, para verificación pública."""
    inicial_nombre = first_name[:1].upper() if first_name else ""
    inicial_apellido = last_name[:1].upper() if last_name else ""
    return f"{inicial_nombre}*** {inicial_apellido}***".strip()


def qr_svg(data: str) -> bytes:
    """Genera un QR en SVG sin depender de Pillow."""
    factory = qrcode.image.svg.SvgPathImage
    image = qrcode.make(data, image_factory=factory, box_size=10, border=2)
    buffer = io.BytesIO()
    image.save(buffer)
    return buffer.getvalue()


def scrub_pii(text: str) -> str:
    """Reemplaza correos, teléfonos y DNI antes de enviar texto a un modelo.

    Bari nunca debe recibir datos personales. Esta función es una red de
    seguridad, no una autorización para mandar PII.
    """
    import re

    text = re.sub(r"[\w.+-]+@[\w-]+\.[\w.]+", "[correo]", text)
    text = re.sub(r"(?<!\d)(?:\d{2,4}[-\s]?){2,4}\d{2,4}(?!\d)", "[teléfono]", text)
    text = re.sub(r"(?<!\d)\d{7,8}(?!\d)", "[documento]", text)
    return text.strip()[:500]


def safe_filename(name: str) -> str:
    """Limpia un nombre de archivo para usarlo en cabeceras."""
    cleaned = "".join(ch for ch in name if ch.isalnum() or ch in "._- ").strip()
    return cleaned[:120] or "archivo"


def file_extension_for_mime(mime: str) -> str:
    """Devuelve una extensión segura a partir del MIME real."""
    mapping: dict[str, str] = {
        "application/pdf": ".pdf",
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }
    return mapping.get(mime, ".bin")


def detect_mime(header: bytes) -> str | None:
    """Detecta el MIME real por magic bytes. No confía en la extensión."""
    if header.startswith(b"%PDF"):
        return "application/pdf"
    if header.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "image/webp"
    return None


def json_safe(value: Any) -> Any:
    """Convierte valores raros a algo serializable para auditoría."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)
