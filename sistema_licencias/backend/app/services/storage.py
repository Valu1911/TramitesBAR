"""Almacenamiento de archivos con validación real de MIME y hash.

En desarrollo guarda en `storage/`; en producción usa MinIO/S3. Nunca se sirve
un archivo directamente desde el webroot: la API valida permisos y audita cada
descarga.
"""

from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from fastapi import UploadFile

from app.core.config import get_settings
from app.core.errors import api_error
from app.core.security import detect_mime, file_extension_for_mime, safe_filename, utcnow

ALLOWED_MIME = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
}


@dataclass
class StoredFile:
    """Resultado de guardar un archivo."""

    storage_key: str
    mime: str
    size_bytes: int
    sha256: str
    original_name: str


def _s3_client():  # type: ignore[no-untyped-def]
    """Crea el cliente de MinIO/S3 bajo demanda."""
    import boto3
    from botocore.config import Config

    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        use_ssl=settings.s3_secure,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def save_upload(file: UploadFile, kind: str) -> StoredFile:
    """Valida y guarda un archivo con nombre aleatorio.

    Se lee el contenido completo (máximo 10 MB por defecto), se detecta el MIME
    por magic bytes y se calcula SHA-256. No se confía en el nombre ni en el
    content-type que manda el navegador.
    """
    settings = get_settings()
    max_bytes = settings.max_upload_mb * 1024 * 1024

    content = file.file.read(max_bytes + 1)
    if not content:
        raise api_error(422, "empty_file", "El archivo está vacío")
    if len(content) > max_bytes:
        raise api_error(
            413,
            "file_too_large",
            f"El archivo supera el máximo de {settings.max_upload_mb} MB",
        )

    mime = detect_mime(content[:16])
    if mime not in ALLOWED_MIME:
        raise api_error(
            415,
            "unsupported_file",
            "Solo se aceptan PDF, JPG, PNG o WEBP",
        )

    extension = file_extension_for_mime(mime)
    key = f"{kind}/{utcnow():%Y/%m}/{uuid.uuid4().hex}{extension}"
    digest = hashlib.sha256(content).hexdigest()

    if settings.storage_backend == "local":
        destination = Path(settings.upload_dir) / key
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
    elif settings.storage_backend == "s3":
        client = _s3_client()
        client.put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=content,
            ContentType=mime,
            Metadata={"sha256": digest, "kind": kind},
        )
    else:
        raise RuntimeError(f"STORAGE_BACKEND desconocido: {settings.storage_backend}")

    return StoredFile(
        storage_key=key,
        mime=mime,
        size_bytes=len(content),
        sha256=digest,
        original_name=safe_filename(file.filename or "archivo"),
    )


def read_file(storage_key: str) -> bytes:
    """Lee un archivo desde el backend configurado."""
    settings = get_settings()
    if settings.storage_backend == "local":
        path = Path(settings.upload_dir) / storage_key
        if not path.exists():
            raise api_error(404, "file_not_found", "El archivo no está disponible")
        return path.read_bytes()
    if settings.storage_backend == "s3":
        client = _s3_client()
        response = client.get_object(Bucket=settings.s3_bucket, Key=storage_key)
        return response["Body"].read()
    raise RuntimeError(f"STORAGE_BACKEND desconocido: {settings.storage_backend}")


def delete_file(storage_key: str) -> None:
    """Borra un archivo de almacenamiento. Se usa para retención o reemplazo."""
    settings = get_settings()
    if settings.storage_backend == "local":
        path = Path(settings.upload_dir) / storage_key
        if path.exists():
            path.unlink()
        return
    if settings.storage_backend == "s3":
        _s3_client().delete_object(Bucket=settings.s3_bucket, Key=storage_key)
        return
    raise RuntimeError(f"STORAGE_BACKEND desconocido: {settings.storage_backend}")
