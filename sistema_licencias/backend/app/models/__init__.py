"""Importa todos los modelos para que Alembic y SQLAlchemy los registren."""

from app.models.audit import AuditLog, Setting
from app.models.exam import ExamAnswer, ExamAttempt, Question
from app.models.license import License
from app.models.notification import EmailOutbox, Notification
from app.models.payment import Payment, PaymentImport
from app.models.policy import Policy, PolicyAcceptance
from app.models.procedure import (
    Appointment,
    Document,
    LearningMaterial,
    LicenseCounter,
    Procedure,
    ProcedureMatrix,
    ProcedureStep,
    ProcedureType,
)
from app.models.user import AuthToken, CitizenProfile, GuardianConsent, User, UserSession

__all__ = [
    "AuditLog",
    "Setting",
    "ExamAnswer",
    "ExamAttempt",
    "Question",
    "License",
    "EmailOutbox",
    "Notification",
    "Payment",
    "PaymentImport",
    "Policy",
    "PolicyAcceptance",
    "Appointment",
    "Document",
    "LearningMaterial",
    "LicenseCounter",
    "Procedure",
    "ProcedureMatrix",
    "ProcedureStep",
    "ProcedureType",
    "AuthToken",
    "CitizenProfile",
    "GuardianConsent",
    "User",
    "UserSession",
]
