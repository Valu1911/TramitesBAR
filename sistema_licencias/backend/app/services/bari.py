"""Bari: guía visual y bot restringido al dominio de licencias.

Primero responde el motor determinista, que no depende de red ni de modelos.
Ollama es opcional: se usa solo para preguntas libres, con timeout, sin PII y
con instrucciones estrictas. Si falla, Bari deriva a un canal humano.
"""

from __future__ import annotations

import logging
import unicodedata

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.security import scrub_pii
from app.domain.enums import STEP_LABELS
from app.models.procedure import LearningMaterial, ProcedureType
from app.schemas.catalog import BariChatOut, BariGuideOut

logger = logging.getLogger(__name__)

LINKS = {
    "tramites": {"label": "Ver trámites", "href": "/tramites"},
    "nueva": {"label": "Licencia nueva", "href": "/tramites/nueva"},
    "renovacion": {"label": "Renovación", "href": "/tramites/renovacion"},
    "vencida": {"label": "Licencia vencida", "href": "/tramites/vencida"},
    "categoria": {"label": "Cambio de categoría", "href": "/tramites/categoria"},
    "profesional": {"label": "Licencia profesional", "href": "/tramites/profesional"},
    "extravio": {"label": "Extravío o robo", "href": "/tramites/extravio"},
    "verificar": {"label": "Verificar credencial", "href": "/verificar"},
    "privacidad": {"label": "Política de privacidad", "href": "/politicas/privacidad"},
    "contacto": {"label": "Contacto municipal", "href": "/contacto"},
}


def _normalize(text: str) -> str:
    """Pasa a minúsculas y quita acentos para comparar palabras clave."""
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def _answer(
    text: str,
    intent: str,
    links: list[str],
    suggestions: list[str],
    source: str = "deterministic",
) -> BariChatOut:
    """Arma una respuesta con enlaces y sugerencias."""
    return BariChatOut(
        answer=text,
        intent=intent,
        links=[LINKS[key] for key in links if key in LINKS],
        suggestions=suggestions,
        source=source,
    )


def _match_intent(message: str, context: str | None) -> str | None:
    """Detecta la intención por palabras clave. No usa IA para esto."""
    text = _normalize(message)
    if context in {"nueva", "renovacion", "vencida", "categoria", "profesional", "extravio"}:
        return context

    rules: list[tuple[str, tuple[str, ...]]] = [
        ("saludo", ("hola", "buen dia", "buenas", "que tal")),
        ("costo", ("cuanto", "precio", "arancel", "sale", "cuesta", "tarifa")),
        ("requisitos", ("requisito", "necesito", "documento", "papel", "que llevo")),
        ("examen", ("examen", "teorico", "practico", "preguntas", "aprobar")),
        ("turno", ("turno", "reservar", "fecha", "horario", "cita")),
        ("pago", ("pago", "transferencia", "comprobante", "alias", "cbu", "deposito")),
        ("renovacion", ("renovacion", "renovar", "vencio", "vencida", "vencimiento")),
        ("extravio", ("extravio", "robe", "robo", "perdi", "perdida", "denuncia")),
        ("categoria", ("categoria", "cambiar de categoria", "profesional")),
        ("licencia", ("licencia", "credencial", "qr", "verificar")),
        ("menores", ("menor", "17", "16", "tutor", "padre", "madre", "autorizacion")),
        ("privacidad", ("privacidad", "datos", "dni", "informacion personal")),
        ("estado", ("estado", "como va", "seguimiento", "pendiente")),
        ("contacto", ("contacto", "telefono", "oficina", "direccion", "hablar")),
        ("gracias", ("gracias", "muchas gracias", "listo")),
    ]
    for intent, keywords in rules:
        if any(keyword in text for keyword in keywords):
            return intent
    return None


def _deterministic(intent: str) -> BariChatOut:
    """Respuestas oficiales del flujo, sin inventar requisitos."""
    settings = get_settings()
    if intent == "saludo":
        return _answer(
            "Hola. Soy Bari, te acompaño con los trámites de licencias de Baradero. "
            "Puedo explicarte requisitos, pagos, exámenes y cómo seguir tu expediente.",
            "saludo",
            ["tramites"],
            ["¿Qué necesito para una licencia nueva?", "¿Cómo renuevo?", "¿Cómo verifico una credencial?"],
        )
    if intent == "costo":
        return _answer(
            "El arancel depende del tipo de trámite y de la categoría. En la ficha de cada trámite "
            "figura el valor vigente de la matriz municipal. No cobramos por esta consulta.",
            "costo",
            ["tramites"],
            ["Ver requisitos de licencia nueva", "Consultar renovación"],
        )
    if intent == "requisitos":
        return _answer(
            "Para iniciar necesitás una cuenta con correo verificado, DNI, aceptar las políticas y elegir "
            "el tipo de trámite. Después se piden los documentos según la matriz: certificado de salud, "
            "comprobante de pago y, cuando corresponde, examen teórico y práctico.",
            "requisitos",
            ["tramites", "privacidad"],
            ["¿Qué documentos pide mi categoría?", "¿Cómo subo el certificado de salud?"],
        )
    if intent == "examen":
        return _answer(
            "El examen teórico se rinde desde el portal, con preguntas aleatorias del banco oficial. "
            "Se corrige en el servidor y necesitás el puntaje mínimo que indica tu matriz. El práctico "
            "se reserva con turno y lo evalúa personal municipal.",
            "examen",
            ["tramites"],
            ["¿Cuántos intentos tengo?", "¿Cómo reservo el práctico?"],
        )
    if intent == "turno":
        return _answer(
            "Los turnos prácticos aparecen en el paso correspondiente de tu trámite. Elegí uno disponible "
            "y quedará reservado. Si no hay cupos, podés volver a mirar más tarde o consultar en la oficina.",
            "turno",
            ["tramites"],
            ["Ver mis trámites", "¿Qué llevo al práctico?"],
        )
    if intent == "pago":
        return _answer(
            "El pago es por transferencia. El sistema te genera una referencia única que empieza con PAGO-. "
            "Transferí el monto exacto, subí el comprobante y el área de pagos lo concilia. No pedimos datos de tarjeta.",
            "pago",
            ["tramites"],
            ["¿Dónde veo mi referencia?", "¿Qué pasa si el monto no coincide?"],
        )
    if intent == "renovacion":
        return _answer(
            "La renovación se inicia desde el portal. Según tu matriz puede pedir certificado de salud, "
            "pago y entrega de la credencial. Si tu licencia está vencida hace mucho, puede corresponder "
            "otro circuito: revisá la ficha de 'Licencia vencida'.",
            "renovacion",
            ["renovacion", "vencida"],
            ["Iniciar renovación", "Ver requisitos"],
        )
    if intent == "extravio":
        return _answer(
            "Si perdiste o te robaron la licencia, iniciá el trámite de extravío o robo. Vas a necesitar "
            "la denuncia si corresponde y el pago del arancel. La credencial anterior se invalida al emitir la nueva.",
            "extravio",
            ["extravio"],
            ["Iniciar extravío", "¿Qué documentación necesito?"],
        )
    if intent == "categoria":
        return _answer(
            "El cambio de categoría y la licencia profesional tienen requisitos adicionales de salud, "
            "examen teórico y práctico según la categoría. La matriz del trámite muestra el detalle antes de empezar.",
            "categoria",
            ["categoria", "profesional"],
            ["Ver cambio de categoría", "Ver licencia profesional"],
        )
    if intent == "licencia":
        return _answer(
            "La credencial se emite cuando completás todas las etapas. Tiene un código QR que permite "
            "verificarla públicamente sin mostrar tu DNI. Si la credencial fue revocada o venció, la "
            "verificación lo indica.",
            "licencia",
            ["verificar"],
            ["Verificar una credencial", "Ver mi credencial"],
        )
    if intent == "menores":
        if settings.features_minors:
            return _answer(
                "Los trámites de menores requieren la autorización de madre, padre o tutor, con verificación "
                "de identidad y evidencia. El sistema no avanza sin esa autorización aprobada.",
                "menores",
                ["tramites", "privacidad"],
                ["¿Cómo se autoriza a un tutor?", "Ver requisitos"],
            )
        return _answer(
            "Por ahora los trámites de menores se inician de forma presencial en la oficina de licencias. "
            "La autorización digital del tutor está pendiente de aprobación legal y todavía no se habilita en el portal.",
            "menores",
            ["contacto"],
            ["Ver contacto", "Ver requisitos generales"],
        )
    if intent == "privacidad":
        return _answer(
            "Tus datos se usan para gestionar el trámite y cumplir obligaciones legales. El DNI se guarda "
            "cifrado y no se muestra en la verificación pública. Podés consultar la política de privacidad "
            "y ejercer tus derechos ante el municipio.",
            "privacidad",
            ["privacidad"],
            ["Leer la política", "¿Quién accede a mis datos?"],
        )
    if intent == "estado":
        return _answer(
            "Podés seguir el estado desde tu panel. Cada etapa muestra si está pendiente, en revisión o completa. "
            "También te avisamos por correo y con notificaciones internas.",
            "estado",
            ["tramites"],
            ["Ir a mi panel", "¿Por qué está en revisión?"],
        )
    if intent == "contacto":
        return _answer(
            "La atención de licencias es en la Municipalidad de Baradero. Los horarios y el teléfono oficial "
            "están en la sección de contacto. Para una consulta sobre tu expediente, tené a mano el código TB-.",
            "contacto",
            ["contacto"],
            ["Ver horarios", "Consultar mi trámite"],
        )
    if intent == "gracias":
        return _answer(
            "De nada. Si te queda otra duda, escribime. Para temas de tu expediente, lo mejor es consultar "
            "en la oficina con el código del trámite.",
            "gracias",
            [],
            ["Volver al inicio", "Ver trámites"],
        )
    return _answer(
        "No tengo esa respuesta confirmada. Para no darte información incorrecta, te derivo a la oficina "
        "de licencias o a la ficha del trámite que te interesa.",
        "unknown",
        ["tramites", "contacto"],
        ["Ver trámites", "Contacto municipal"],
    )


def _ask_ollama(message: str) -> str | None:
    """Consulta Ollama con instrucciones estrictas. Devuelve None si falla."""
    settings = get_settings()
    if not settings.ollama_url:
        return None

    prompt = (
        "Sos Bari, asistente de la Municipalidad de Baradero para licencias de conducir. "
        "Respondé en español rioplatense, claro y breve. Solo hablás de trámites de licencias, "
        "requisitos, pagos, exámenes, credenciales y privacidad. No inventes requisitos, montos ni plazos. "
        "Si no sabés, decí que consulte en la oficina de licencias. No pidas ni repitas datos personales."
    )
    try:
        with httpx.Client(timeout=settings.ollama_timeout_seconds) as client:
            response = client.post(
                f"{settings.ollama_url.rstrip('/')}/api/generate",
                json={
                    "model": settings.ollama_model,
                    "prompt": f"{prompt}\n\nConsulta: {message}",
                    "stream": False,
                    "options": {"temperature": 0.2, "num_predict": 220},
                },
            )
            response.raise_for_status()
            answer = (response.json().get("response") or "").strip()
            return answer or None
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        logger.warning("Ollama no disponible: %s", type(exc).__name__)
        return None


def chat(db: Session, *, message: str, context: str | None = None) -> BariChatOut:
    """Responde una consulta con el motor determinista y, si hace falta, Ollama."""
    clean = scrub_pii(message)
    intent = _match_intent(clean, context)
    if intent is not None:
        return _deterministic(intent)

    answer = _ask_ollama(clean)
    if answer:
        return _answer(
            answer,
            "ollama",
            ["tramites", "contacto"],
            ["Ver trámites", "Contacto municipal"],
            source="ollama",
        )
    logger.info("Bari sin intención determinista; deriva a humano")
    return _answer(
        "No tengo una respuesta confirmada para eso. Para no inventar, te derivo a la oficina de licencias "
        "o a la ficha del trámite. También puedo ayudarte con requisitos, pagos, exámenes y credenciales.",
        "fallback",
        ["tramites", "contacto"],
        ["Ver trámites", "Contacto municipal"],
    )


def guide(db: Session, procedure_code: str) -> BariGuideOut:
    """Devuelve la guía visual de un trámite con sus pasos y materiales."""
    stmt = (
        select(ProcedureType)
        .where(ProcedureType.code == procedure_code, ProcedureType.active.is_(True))
        .options(selectinload(ProcedureType.matrix))
    )
    procedure_type = db.execute(stmt).scalar_one_or_none()
    if procedure_type is None:
        from app.core.errors import api_error

        raise api_error(404, "procedure_type_not_found", "El tipo de trámite no existe")

    matrix = next((item for item in procedure_type.matrix if item.active), None)
    steps = []
    if matrix is not None:
        for position, code in enumerate(matrix.steps, start=1):
            steps.append(
                {
                    "position": position,
                    "code": code,
                    "label": STEP_LABELS.get(code, code),
                }
            )

    materials = list(
        db.execute(
            select(LearningMaterial)
            .where(LearningMaterial.active.is_(True))
            .order_by(LearningMaterial.sort_order)
        ).scalars()
    )
    from app.schemas.catalog import LearningMaterialOut

    return BariGuideOut(
        procedure_code=procedure_type.code,
        procedure_name=procedure_type.name,
        steps=steps,
        materials=[
            LearningMaterialOut(
                id=item.id,
                code=item.code,
                title=item.title,
                description=item.description,
                kind=item.kind,
                url=item.url,
                body_md=item.body_md,
                sort_order=item.sort_order,
            )
            for item in materials
        ],
    )
