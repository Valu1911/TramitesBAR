"""Errores de API con formato estable y sin filtrar detalles internos."""

from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def api_error(status_code: int, code: str, message: str, **extra: object) -> HTTPException:
    """Crea una HTTPException con el contrato de error de TramitesBAR."""
    detail: dict[str, object] = {"code": code, "message": message}
    detail.update(extra)
    return HTTPException(status_code=status_code, detail=detail)


def install_exception_handlers(app: FastAPI) -> None:
    """Registra los handlers globales de errores."""

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
        """Normaliza los errores controlados."""
        detail = exc.detail
        if isinstance(detail, dict) and "code" in detail:
            payload = {"error": detail}
        else:
            payload = {
                "error": {
                    "code": "http_error",
                    "message": str(detail) if detail else "Error de la solicitud",
                }
            }
        return JSONResponse(status_code=exc.status_code, content=payload, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Devuelve qué campo falló sin exponer trazas internas."""
        fields = []
        for error in exc.errors():
            location = ".".join(str(part) for part in error.get("loc", []) if part != "body")
            fields.append({"field": location, "message": error.get("msg", "Valor inválido")})
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Revisá los datos enviados",
                    "fields": fields,
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
        """Loguea el error real y devuelve un mensaje genérico al cliente."""
        logger.exception("Error no controlado", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "Ocurrió un error interno. Intentalo de nuevo o contactá al municipio.",
                }
            },
        )
