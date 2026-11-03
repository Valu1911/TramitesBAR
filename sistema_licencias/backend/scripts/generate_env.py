"""Genera un `.env` local con claves aleatorias.

Uso:
    python scripts/generate_env.py

No imprime las claves en pantalla. Si el archivo existe, pide confirmación antes
de reemplazarlo.
"""

from __future__ import annotations

import base64
import secrets
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT / ".env"


def main() -> int:
    """Crea el archivo de entorno con secretos nuevos."""
    if ENV_PATH.exists():
        answer = input(".env ya existe. ¿Reemplazar? (s/N): ").strip().lower()
        if answer != "s":
            print("No se modificó nada.")
            return 0

    database_url = input(
        "DATABASE_URL [mysql+pymysql://tramites_app:CAMBIAR@127.0.0.1:3306/tramites_bar?charset=utf8mb4]: "
    ).strip()
    if not database_url:
        database_url = (
            "mysql+pymysql://tramites_app:CAMBIAR@127.0.0.1:3306/"
            "tramites_bar?charset=utf8mb4"
        )

    content = f"""# Archivo local generado por scripts/generate_env.py.
# No se sube al repositorio.
APP_NAME=TramitesBAR
APP_VERSION=1.0.0
APP_ENV=development
APP_URL=http://127.0.0.1:8000
FRONTEND_URL=http://127.0.0.1:5173
LOG_LEVEL=INFO

DATABASE_URL={database_url}
REDIS_URL=

SECRET_KEY={secrets.token_urlsafe(48)}
ENCRYPTION_KEY={base64.b64encode(secrets.token_bytes(32)).decode("ascii")}
ENCRYPTION_KEY_ID=k1
DNI_HMAC_KEY={secrets.token_urlsafe(48)}

SESSION_COOKIE_NAME=tb_session
CSRF_COOKIE_NAME=tb_csrf
SESSION_TTL_HOURS=12
SESSION_IDLE_MINUTES=60
COOKIE_SECURE=false
COOKIE_SAMESITE=lax

TRUSTED_HOSTS=127.0.0.1,localhost
CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
TRUST_PROXY_HEADERS=false

UPLOAD_DIR=storage
MAX_UPLOAD_MB=10
STORAGE_BACKEND=local

EMAIL_TRANSPORT=console
OUTBOX_POLL_SECONDS=5
MAINTENANCE_INTERVAL_MINUTES=60

PAYMENT_SECOND_APPROVAL_THRESHOLD=100000.00
EXAM_PASS_RATIO=0.8

FEATURES_MINORS=false
FEATURES_PROCTORING=false
FEATURES_DNI_OCR=false
"""
    ENV_PATH.write_text(content, encoding="utf-8")
    print(f"Archivo creado: {ENV_PATH}")
    print("Revisá DATABASE_URL y completá los datos municipales antes de operar.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
