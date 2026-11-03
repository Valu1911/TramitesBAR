"""Credenciales, QR, verificación pública y revocación."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import (
    RequestMeta,
    current_user,
    rate_limit,
    request_meta,
    require_permission,
)
from app.core.db import get_db
from app.core.security import qr_svg
from app.models.license import License
from app.models.user import User
from app.schemas.common import MessageOut, PageOut
from app.schemas.license import (
    LicenseAdminItem,
    LicenseOut,
    LicenseRevokeIn,
    PublicLicenseOut,
)
from app.services import licenses as license_service
from app.services.serializers import license_out, public_license_out

router = APIRouter(tags=["licenses"])


@router.get("/licenses/mine", response_model=list[LicenseOut])
def my_licenses(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[LicenseOut]:
    """Lista las credenciales del ciudadano autenticado."""
    return [license_out(item) for item in license_service.list_user_licenses(db, user)]


@router.get("/licenses/{license_id}", response_model=LicenseOut)
def get_license(
    license_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> LicenseOut:
    """Devuelve una credencial propia."""
    license_obj = license_service.get_license_or_404(db, license_id, user=user)
    return license_out(license_obj)


@router.get("/licenses/{license_id}/qr.svg")
def get_license_qr(
    license_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Genera el QR de una credencial propia en SVG."""
    license_obj = license_service.get_license_or_404(db, license_id, user=user)
    payload = license_service.qr_payload(license_obj)
    return Response(
        content=qr_svg(payload),
        media_type="image/svg+xml",
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get(
    "/public/licenses/{token}",
    response_model=PublicLicenseOut,
    dependencies=[Depends(rate_limit("public_verify", 30, 60))],
)
def verify_license(
    token: str,
    db: Session = Depends(get_db),
) -> PublicLicenseOut:
    """Verifica públicamente una credencial sin exponer DNI ni contactos."""
    license_obj = license_service.verify_public(db, token)
    return public_license_out(license_obj)


@router.get("/admin/licenses", response_model=PageOut)
def list_licenses(
    status: str | None = Query(default=None, max_length=20),
    q: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _user: User = Depends(require_permission("licenses.issue")),
    db: Session = Depends(get_db),
) -> PageOut:
    """Lista credenciales para el backoffice."""
    stmt = select(License).options(
        selectinload(License.user).selectinload(User.profile),
        selectinload(License.procedure),
    )
    conditions = []
    if status:
        conditions.append(License.status == status)
    if q:
        like = f"%{q.strip()}%"
        conditions.append(
            License.license_number.ilike(like)
            | License.user.has(User.email.ilike(like))
        )
    if conditions:
        stmt = stmt.where(*conditions)

    total = db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    ).scalar_one()
    rows = (
        db.execute(
            stmt.order_by(License.issued_at.desc()).limit(limit).offset(offset)
        )
        .scalars()
        .all()
    )
    items = []
    for item in rows:
        profile = item.user.profile if item.user else None
        items.append(
            LicenseAdminItem(
                id=item.id,
                license_number=item.license_number,
                category=item.category,
                issued_at=item.issued_at,
                expires_at=item.expires_at,
                status=item.status,
                citizen_email=item.user.email if item.user else "",
                citizen_name=(
                    f"{profile.first_name} {profile.last_name}".strip()
                    if profile
                    else ""
                ),
                procedure_code=item.procedure.public_code if item.procedure else "",
            )
        )
    return PageOut(
        items=items,
        total=int(total),
        page=(offset // limit) + 1,
        page_size=limit,
    )


@router.post("/admin/licenses/{license_id}/revoke", response_model=MessageOut)
def revoke_license(
    license_id: int,
    data: LicenseRevokeIn,
    user: User = Depends(require_permission("licenses.revoke")),
    db: Session = Depends(get_db),
    meta: RequestMeta = Depends(request_meta),
) -> MessageOut:
    """Revoca una credencial con motivo y auditoría."""
    license_obj = license_service.get_license_or_404(db, license_id)
    license_service.revoke_license(
        db,
        license_obj,
        reason=data.reason,
        actor=user,
        ip=meta.ip,
        user_agent=meta.user_agent,
    )
    return MessageOut(message="Credencial revocada")
