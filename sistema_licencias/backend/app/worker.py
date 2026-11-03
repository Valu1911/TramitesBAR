"""Worker de correo y mantenimiento.

Procesa la cola `email_outbox` y limpia tokens vencidos. Se ejecuta como
proceso aparte para que un SMTP lento no bloquee las respuestas de la API.
"""

from __future__ import annotations

import logging
import signal
import threading
import time

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_session_factory
from app.core.logging import configure_logging
from app.services.notifications import process_outbox_once, purge_expired

logger = logging.getLogger(__name__)

_stop = threading.Event()


def _handle_signal(signum: int, _frame: object) -> None:
    """Pide un cierre ordenado al recibir SIGINT o SIGTERM."""
    logger.info("Señal recibida, cerrando worker", extra={"signal": signum})
    _stop.set()


def run() -> None:
    """Bucle principal del worker. No procesa datos personales en los logs."""
    settings = get_settings()
    settings.validate_runtime()
    configure_logging(settings.log_level)

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    last_maintenance = 0.0
    maintenance_seconds = max(1, settings.maintenance_interval_minutes) * 60
    logger.info("Worker de TramitesBAR iniciado")

    while not _stop.is_set():
        try:
            db: Session = get_session_factory()()
            try:
                processed = 0
                while process_outbox_once(db, settings):
                    processed += 1
                    if processed >= 100:
                        break
                if processed:
                    logger.info("Correos procesados", extra={"count": processed})

                if time.monotonic() - last_maintenance >= maintenance_seconds:
                    removed = purge_expired(db)
                    last_maintenance = time.monotonic()
                    if removed:
                        logger.info("Registros vencidos eliminados", extra={"count": removed})
            finally:
                db.close()
        except Exception:  # noqa: BLE001 - el worker no debe morir por un error transitorio
            logger.exception("Error en el ciclo del worker")

        _stop.wait(settings.outbox_poll_seconds)

    logger.info("Worker de TramitesBAR detenido")


if __name__ == "__main__":
    run()
