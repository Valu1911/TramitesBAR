"""Enumeraciones y constantes de dominio compartidas."""

from __future__ import annotations

from enum import Enum


class Role(str, Enum):
    """Roles del sistema. Los permisos se resuelven en core/permissions.py."""

    CITIZEN = "citizen"
    ADMIN_PAGOS = "admin_pagos"
    ADMIN_SALUD = "admin_salud"
    ADMIN_TURNOS = "admin_turnos"
    ADMIN_CUENTAS = "admin_cuentas"
    ADMIN = "admin"
    SUPERADMIN = "superadmin"


class UserStatus(str, Enum):
    """Estados posibles de una cuenta."""

    ACTIVE = "active"
    SUSPENDED = "suspended"
    PENDING = "pending"

class AccountStatus(str, Enum):
    """Estados de verificación ciudadana y antecedentes viales."""

    PENDING = "pendiente"
    APPROVED = "aprobada"
    REJECTED_FINES = "rechazada_multas"
    TRASH = "papelera"


class ProcedureStatus(str, Enum):
    """Estados del trámite."""

    IN_PROGRESS = "in_progress"
    UNDER_REVIEW = "under_review"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class StepCode(str, Enum):
    """Códigos de pasos que entiende el motor de trámites."""

    CHARLAS = "charlas"
    HEALTH = "health"
    THEORY = "theory"
    PAYMENT = "payment"
    PRACTICAL = "practical"
    DELIVERY = "delivery"


class StepStatus(str, Enum):
    """Estados de un paso."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SCHEDULED = "scheduled"
    SUBMITTED = "submitted"
    COMPLETED = "completed"
    REJECTED = "rejected"


class DocumentKind(str, Enum):
    """Tipos de documento aceptados."""

    HEALTH_CERTIFICATE = "health_certificate"
    PAYMENT_RECEIPT = "payment_receipt"
    DNI_FRONT = "dni_front"
    DNI_BACK = "dni_back"
    PROOF_ADDRESS = "proof_address"
    PHOTO = "photo"
    GUARDIAN_AUTHORIZATION = "guardian_authorization"
    OTHER = "other"


class DocumentStatus(str, Enum):
    """Estados de revisión de un documento."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class PaymentStatus(str, Enum):
    """Estados de un pago por transferencia."""

    PENDING = "pending"
    CLAIMED = "claimed"
    PENDING_SECOND = "pending_second"
    APPROVED = "approved"
    REJECTED = "rejected"
    REFUNDED = "refunded"


class AppointmentStatus(str, Enum):
    """Estados de un turno."""

    AVAILABLE = "available"
    BOOKED = "booked"
    COMPLETED = "completed"
    NO_SHOW = "no_show"
    CANCELLED = "cancelled"


class AppointmentResult(str, Enum):
    """Resultado de un examen práctico."""

    PASSED = "passed"
    FAILED = "failed"


class ExamStatus(str, Enum):
    """Estados de un intento de examen teórico."""

    IN_PROGRESS = "in_progress"
    PASSED = "passed"
    FAILED = "failed"
    EXPIRED = "expired"


class LicenseStatus(str, Enum):
    """Estados de una credencial."""

    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"


class TokenPurpose(str, Enum):
    """Propósitos de los tokens de autenticación."""

    VERIFY_EMAIL = "verify_email"
    RESET_PASSWORD = "reset_password"


class GuardianStatus(str, Enum):
    """Estados de la autorización de tutor."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# Etiquetas visibles para la interfaz y las notificaciones.
STEP_LABELS: dict[str, str] = {
    StepCode.CHARLAS.value: "Charlas de seguridad vial",
    StepCode.HEALTH.value: "Formulario de salud",
    StepCode.THEORY.value: "Examen teórico",
    StepCode.PAYMENT.value: "Pago del arancel",
    StepCode.PRACTICAL.value: "Examen práctico",
    StepCode.DELIVERY.value: "Entrega de la credencial",
}

PROCEDURE_TYPE_LABELS: dict[str, str] = {
    "nueva": "Licencia nueva",
    "renovacion": "Renovación",
    "vencida": "Licencia vencida",
    "categoria": "Cambio de categoría",
    "profesional": "Licencia profesional",
    "extravio": "Extravío o robo",
}

LICENSE_CATEGORIES = ["A", "B", "C", "D", "E", "G"]
