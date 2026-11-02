"""Configuración de logs estructurados y correlación de requests."""

from __future__ import annotations

import contextvars
import json
import logging
import sys
from datetime import datetime, timezone

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


class JsonFormatter(logging.Formatter):
    """Formatea cada línea como JSON para poder ingerirla en un colector."""

    def format(self, record: logging.LogRecord) -> str:
        """Devuelve una línea JSON con los campos mínimos."""
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_var.get(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    """Configura el logger raíz sin duplicar handlers."""
    root = logging.getLogger()
    root.setLevel(level.upper())
    if root.handlers:
        root.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)

    # Bajar ruido de librerías que loguean cada request.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
