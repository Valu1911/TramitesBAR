"""Motor y sesiones de SQLAlchemy.

Usamos SQLAlchemy sincrónico porque el volumen municipal no justifica la
complejidad de async y porque simplifica las transacciones de auditoría. FastAPI
ejecuta los endpoints sincrónicos en un pool de hilos.
"""

from __future__ import annotations

from collections.abc import Generator
from typing import Any

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Base declarativa de todos los modelos."""


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def _build_engine() -> Engine:
    """Crea el engine a partir de DATABASE_URL.

    SQLite se usa solo en tests unitarios. MySQL es el motor de desarrollo y
    producción. El pool se configura para sobrevivir caídas breves de la base.
    """
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL no está configurada")

    kwargs: dict[str, Any] = {"pool_pre_ping": True, "future": True}
    if settings.database_url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs.update({"pool_recycle": 1800, "pool_size": 10, "max_overflow": 20})

    engine = create_engine(settings.database_url, **kwargs)

    # SQLite no respeta las claves foráneas si no se activan explícitamente.
    if settings.database_url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _sqlite_foreign_keys(dbapi_connection, _connection_record):  # type: ignore[no-untyped-def]
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


def get_engine() -> Engine:
    """Devuelve el engine singleton, creándolo la primera vez."""
    global _engine
    if _engine is None:
        _engine = _build_engine()
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    """Devuelve la fábrica de sesiones singleton."""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(
            bind=get_engine(),
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )
    return _session_factory


def get_db() -> Generator[Session, None, None]:
    """Dependencia de FastAPI que entrega una sesión y la cierra al final."""
    db = get_session_factory()()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def reset_engine() -> None:
    """Descarta el engine y la fábrica. Se usa en tests."""
    global _engine, _session_factory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _session_factory = None
