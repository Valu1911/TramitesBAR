"""Configuración central de TramitesBAR.

Todas las variables se leen del entorno o del archivo `.env`. No hay secretos
embebidos en el código. En producción, `validate_runtime()` aborta el arranque
si falta una variable crítica o si una configuración es insegura.
"""

from __future__ import annotations

import base64
import binascii
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Rutas base: config.py -> core -> app -> backend -> sistema_licencias.
BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Configuración tipada de la aplicación."""

    model_config = SettingsConfigDict(
        env_file=(PROJECT_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Identidad de la aplicación.
    app_name: str = "TramitesBAR"
    app_version: str = "1.0.0"
    app_env: str = "development"
    app_url: str = "http://127.0.0.1:8000"
    frontend_url: str = "http://127.0.0.1:5173"
    log_level: str = "INFO"

    # Persistencia.
    database_url: str = ""
    redis_url: str = ""

    # Claves. Se generan con scripts/generate_env.py.
    secret_key: str = ""
    encryption_key: str = ""
    encryption_key_id: str = "k1"
    dni_hmac_key: str = ""

    # Sesión y cookies.
    session_cookie_name: str = "tb_session"
    csrf_cookie_name: str = "tb_csrf"
    session_ttl_hours: int = 12
    session_idle_minutes: int = 60
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    # Red.
    trusted_hosts: str = "127.0.0.1,localhost"
    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173"
    trust_proxy_headers: bool = False

    # Archivos.
    upload_dir: str = str(PROJECT_DIR / "storage")
    max_upload_mb: int = 10
    storage_backend: str = "local"
    s3_endpoint: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "tramitesbar"
    s3_region: str = "us-east-1"
    s3_secure: bool = False

    # Correo.
    email_transport: str = "console"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "TramitesBAR <no-reply@baradero.gob.ar>"
    smtp_tls: bool = True

    # Reglas de negocio configurables.
    payment_second_approval_threshold: Decimal = Decimal("100000.00")
    exam_pass_ratio: float = 0.8

    # Datos de transferencia que carga el municipio. No se inventan.
    payment_alias: str = ""
    payment_cbu: str = ""
    payment_holder: str = ""
    payment_bank: str = ""

    # Funciones que requieren infraestructura o aprobación externa.
    features_minors: bool = False
    features_proctoring: bool = False
    features_dni_ocr: bool = False

    # Bari / Ollama. Ollama es opcional; el bot determinista no depende de él.
    ollama_url: str = ""
    ollama_model: str = "qwen2.5:3b"
    ollama_timeout_seconds: float = 8.0

    # LiveKit (fase de proctoring).
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""

    # Observabilidad.
    sentry_dsn: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        """Devuelve los orígenes CORS como lista limpia."""
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def trusted_host_list(self) -> list[str]:
        """Devuelve los hosts permitidos como lista limpia."""
        return [item.strip() for item in self.trusted_hosts.split(",") if item.strip()]

    @property
    def is_production(self) -> bool:
        """Indica si la aplicación corre en producción."""
        return self.app_env.lower() == "production"

    @property
    def is_test(self) -> bool:
        """Indica si la aplicación corre bajo tests."""
        return self.app_env.lower() == "test"

    def validate_runtime(self) -> None:
        """Valida claves y configuración antes de levantar la aplicación.

        En desarrollo exigimos las claves mínimas para no arrancar con valores
        vacíos. En producción, además, rechazamos cualquier configuración que
        exponga cookies, use SQLite, no tenga Redis o no tenga correo real.
        """
        errors: list[str] = []

        if not self.database_url:
            errors.append("DATABASE_URL es obligatoria")
        if len(self.secret_key) < 32:
            errors.append("SECRET_KEY debe tener al menos 32 caracteres")
        if len(self.dni_hmac_key) < 32:
            errors.append("DNI_HMAC_KEY debe tener al menos 32 caracteres")

        # La clave AES debe ser base64 de exactamente 32 bytes.
        try:
            decoded = base64.b64decode(self.encryption_key, validate=True)
            if len(decoded) != 32:
                errors.append("ENCRYPTION_KEY debe decodificar a 32 bytes")
        except (ValueError, binascii.Error):
            errors.append("ENCRYPTION_KEY debe ser base64 válido de 32 bytes")

        if self.is_production:
            if self.database_url.startswith("sqlite"):
                errors.append("Producción no puede usar SQLite")
            if not self.redis_url:
                errors.append("Producción requiere REDIS_URL para rate limiting")
            if not self.cookie_secure:
                errors.append("Producción requiere COOKIE_SECURE=true")
            if not self.app_url.startswith("https://"):
                errors.append("APP_URL debe usar HTTPS en producción")
            if not self.frontend_url.startswith("https://"):
                errors.append("FRONTEND_URL debe usar HTTPS en producción")
            if self.email_transport != "smtp":
                errors.append("Producción requiere EMAIL_TRANSPORT=smtp")
            if not all(
                [
                    self.smtp_host,
                    self.smtp_user,
                    self.smtp_password,
                    self.smtp_from,
                ]
            ):
                errors.append("Producción requiere SMTP_HOST, SMTP_USER, SMTP_PASSWORD y SMTP_FROM")
            if self.storage_backend != "s3":
                errors.append("Producción requiere STORAGE_BACKEND=s3 (MinIO o S3)")
            if self.storage_backend == "s3" and not all(
                [
                    self.s3_endpoint,
                    self.s3_access_key,
                    self.s3_secret_key,
                    self.s3_bucket,
                ]
            ):
                errors.append("STORAGE_BACKEND=s3 requiere S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY y S3_BUCKET")
            if "*" in self.cors_origin_list:
                errors.append("CORS no puede usar comodín en producción")
            if "*" in self.trusted_host_list:
                errors.append("TRUSTED_HOSTS no puede usar comodín en producción")

        if errors:
            detalle = "\n- ".join(errors)
            raise RuntimeError(
                "Configuración inválida. Corregí estas variables antes de arrancar:\n- "
                + detalle
            )

    def ensure_directories(self) -> None:
        """Crea las carpetas locales que la aplicación necesita."""
        Path(self.upload_dir).mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    """Devuelve la configuración cacheada para toda la aplicación."""
    return Settings()
