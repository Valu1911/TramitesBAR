"""Punto de entrada de la API de TramitesBAR.

La aplicación no arranca si falta configuración crítica. Los middlewares aplican
las cabeceras de seguridad y el identificador de correlación a todas las
respuestas, incluidas las de error.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.api.v1 import (
    admin,
    auth,
    bari,
    catalog,
    exams,
    health,
    licenses,
    notifications,
    payments,
    procedures,
)
from app.core.config import get_settings
from app.core.errors import install_exception_handlers
from app.core.logging import configure_logging, request_id_var

logger = logging.getLogger(__name__)

API_PREFIX = "/api/v1"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Agrega cabeceras de seguridad y correlación a cada respuesta."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Procesa la solicitud y completa las cabeceras antes de devolverla."""
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        request_id_var.set(request_id[:64])
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id[:64]
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"

        settings = get_settings()
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        # La documentación interactiva necesita cargar recursos propios; el
        # resto de la API no debe interpretar HTML ni scripts.
        if request.url.path in {"/docs", "/redoc", "/openapi.json"}:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; img-src 'self' data:; "
                "style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"
            )
        else:
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
            )

        if "server" in response.headers:
            del response.headers["server"]
        return response


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Valida la configuración y prepara carpetas al iniciar."""
    settings = get_settings()
    settings.validate_runtime()
    settings.ensure_directories()
    configure_logging(settings.log_level)
    logger.info("TramitesBAR iniciado", extra={"env": settings.app_env})
    yield
    logger.info("TramitesBAR detenido")


def create_app() -> FastAPI:
    """Arma la aplicación con routers y middlewares."""
    settings = get_settings()
    configure_logging(settings.log_level)
    docs_enabled = not settings.is_production

    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Sistema municipal de licencias de conducir de Baradero.",
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
    )

    if settings.trusted_host_list:
        application.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.trusted_host_list,
        )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-CSRF-Token", "X-Request-ID"],
        expose_headers=["X-Request-ID", "Retry-After"],
        max_age=600,
    )
    application.add_middleware(SecurityHeadersMiddleware)

    install_exception_handlers(application)

    for router in (
        auth.router,
        catalog.router,
        procedures.router,
        payments.router,
        exams.router,
        licenses.router,
        notifications.router,
        bari.router,
        admin.router,
    ):
        application.include_router(router, prefix=API_PREFIX)

    # Los health checks quedan fuera del prefijo para que el orquestador no
    # dependa de la versión de la API.
    application.include_router(health.router)

    return application


app = create_app()
