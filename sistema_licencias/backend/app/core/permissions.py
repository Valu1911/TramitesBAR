"""Mapa de permisos por rol.

En esta versión los roles son fijos y los permisos viven en código. La ventaja
es que no se puede escalar privilegios editando una tabla. Cuando haga falta
roles configurables, se migra a tablas manteniendo este mapa como semilla.
"""

from __future__ import annotations

from app.domain.enums import Role

STAFF_ROLES: set[str] = {
    Role.ADMIN.value,
    Role.SUPERADMIN.value,
    Role.ADMIN_PAGOS.value,
    Role.ADMIN_SALUD.value,
    Role.ADMIN_TURNOS.value,
    Role.ADMIN_CUENTAS.value,
}

ADMIN_ROLES: set[str] = {Role.ADMIN.value, Role.SUPERADMIN.value}

ROLE_PERMISSIONS: dict[str, set[str]] = {
    Role.CITIZEN.value: {
        "self.read",
        "self.write",
    },
    Role.ADMIN_CUENTAS.value: {
        "procedures.read",
        "users.read",
        "users.manage",
        "audit.read",
    },
    Role.ADMIN_SALUD.value: {
        "procedures.read",
        "documents.review_health",
        "audit.read",
    },
    Role.ADMIN_PAGOS.value: {
        "procedures.read",
        "payments.read",
        "payments.review",
        "payments.import",
        "audit.read",
    },
    Role.ADMIN_TURNOS.value: {
        "procedures.read",
        "appointments.read",
        "appointments.manage",
        "licenses.issue",
        "licenses.revoke",
        "audit.read",
    },
    Role.ADMIN.value: {
        "procedures.read",
        "procedures.manage",
        "documents.review",
        "payments.read",
        "payments.review",
        "payments.import",
        "appointments.read",
        "appointments.manage",
        "licenses.issue",
        "licenses.revoke",
        "users.read",
        "users.manage",
        "questions.read",
        "questions.manage",
        "policies.manage",
        "audit.read",
        "reports.read",
        "settings.read",
    },
    Role.SUPERADMIN.value: {
        "*",
    },
}


def permissions_for(role: str) -> set[str]:
    """Devuelve el conjunto de permisos de un rol."""
    return ROLE_PERMISSIONS.get(role, set())


def has_permission(role: str, permission: str) -> bool:
    """Verifica si un rol tiene un permiso concreto."""
    permisos = permissions_for(role)
    return "*" in permisos or permission in permisos


def is_staff(role: str) -> bool:
    """Indica si el rol pertenece al personal municipal."""
    return role in STAFF_ROLES
