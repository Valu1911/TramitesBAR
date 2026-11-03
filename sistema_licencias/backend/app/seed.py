"""Contenido inicial de TramitesBAR.

El seed carga la estructura mínima para operar: tipos de trámite, matriz
provisoria, materiales de seguridad vial, políticas y un banco de preguntas en
borrador. No carga usuarios, pagos ni trámites de ejemplo.

La matriz y las preguntas quedan marcadas para revisión municipal. El sistema no
inventa aranceles: los valores iniciales son cero y la etapa de pago se activa
cuando el municipio configura el arancel correspondiente.
"""

from __future__ import annotations

import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import utcnow
from app.domain.enums import LICENSE_CATEGORIES, StepCode
from app.models.exam import Question
from app.models.policy import Policy
from app.models.procedure import LearningMaterial, ProcedureMatrix, ProcedureType
from app.services.policies import policy_hash

logger = logging.getLogger(__name__)

PROCEDURE_TYPES: list[dict[str, object]] = [
    {
        "code": "nueva",
        "name": "Licencia nueva",
        "short_description": "Primera licencia de conducir",
        "description": (
            "Trámite para obtener la primera licencia de conducir. Incluye la "
            "capacitación en seguridad vial, la revisión de salud, el examen "
            "teórico y el examen práctico."
        ),
        "icon": "license",
        "sort_order": 10,
    },
    {
        "code": "renovacion",
        "name": "Renovación",
        "short_description": "Renovación de una licencia vigente",
        "description": (
            "Renovación de una licencia que todavía está vigente. La matriz "
            "define si requiere examen teórico, práctico o ambos."
        ),
        "icon": "refresh",
        "sort_order": 20,
    },
    {
        "code": "vencida",
        "name": "Licencia vencida",
        "short_description": "Renovación fuera de término",
        "description": (
            "Trámite para una licencia vencida. La matriz municipal define los "
            "requisitos adicionales y los exámenes que correspondan."
        ),
        "icon": "clock",
        "sort_order": 30,
    },
    {
        "code": "categoria",
        "name": "Cambio de categoría",
        "short_description": "Ampliación a otra categoría",
        "description": (
            "Trámite para agregar o cambiar la categoría de la licencia. La "
            "matriz define las exigencias según la categoría solicitada."
        ),
        "icon": "layers",
        "sort_order": 40,
    },
    {
        "code": "profesional",
        "name": "Licencia profesional",
        "short_description": "Habilitación para conducir profesionalmente",
        "description": (
            "Trámite para licencias profesionales. La matriz municipal define "
            "los requisitos, la vigencia y los exámenes aplicables."
        ),
        "icon": "briefcase",
        "sort_order": 50,
    },
    {
        "code": "extravio",
        "name": "Extravío o robo",
        "short_description": "Duplicado por pérdida o robo",
        "description": (
            "Trámite para solicitar un duplicado cuando la licencia se perdió o "
            "fue robada. Requiere la denuncia o declaración que defina el "
            "municipio."
        ),
        "icon": "alert",
        "sort_order": 60,
    },
]

# Etapas comunes de la v1. La etapa de pago se agrega cuando el municipio
# configura un arancel mayor a cero. Los valores de la matriz son provisorios y
# se validan en la oficina de licencias antes de la puesta en marcha.
SEED_STEPS = [
    StepCode.CHARLAS.value,
    StepCode.HEALTH.value,
    StepCode.THEORY.value,
    StepCode.PRACTICAL.value,
    StepCode.DELIVERY.value,
]

MATRIX_NOTES = (
    "Matriz provisoria cargada por el seed. El municipio tiene que validar "
    "requisitos, aranceles, vigencias y exámenes antes de la puesta en marcha."
)

MATERIALS: list[dict[str, object]] = [
    {
        "code": "seguridad-vial-basica",
        "title": "Seguridad vial: conceptos básicos",
        "description": "Velocidad, distancia de frenado y uso del cinturón.",
        "kind": "text",
        "sort_order": 10,
        "body_md": (
            "# Seguridad vial: conceptos básicos\n\n"
            "La seguridad vial depende de tres factores: la persona que conduce, "
            "el vehículo y el entorno.\n\n"
            "## Velocidad y distancia\n\n"
            "A mayor velocidad, la distancia de frenado crece más rápido que la "
            "velocidad. Mantené una distancia prudente y reducí la marcha en "
            "zonas escolares, lluvia o niebla.\n\n"
            "## Cinturón de seguridad\n\n"
            "El cinturón reduce lesiones graves. Todos los ocupantes deben "
            "usarlo, también en los asientos traseros.\n\n"
            "## Distracciones\n\n"
            "El teléfono celular y las pantallas aumentan el tiempo de reacción. "
            "No las uses mientras conducís."
        ),
    },
    {
        "code": "senales-y-prioridades",
        "title": "Señales y prioridades de paso",
        "description": "Lectura de señales, semáforos y cruces.",
        "kind": "text",
        "sort_order": 20,
        "body_md": (
            "# Señales y prioridades de paso\n\n"
            "## Señales verticales\n\n"
            "Las señales de reglamentación indican obligaciones y prohibiciones. "
            "Las de prevención advierten un peligro y las informativas orientan.\n\n"
            "## Semáforos\n\n"
            "La luz roja exige detenerse antes de la línea de pare. La amarilla "
            "indica que el cambio a rojo es inminente: si todavía podés frenar "
            "con seguridad, hacelo.\n\n"
            "## Cruces\n\n"
            "En un cruce sin señalización, la prioridad es de quien viene por la "
            "derecha. Aun así, verificá siempre antes de avanzar."
        ),
    },
    {
        "code": "documentacion-y-convivencia",
        "title": "Documentación y convivencia",
        "description": "Documentos obligatorios y conducta en la vía pública.",
        "kind": "text",
        "sort_order": 30,
        "body_md": (
            "# Documentación y convivencia\n\n"
            "## Documentos\n\n"
            "Llevá la licencia, la cédula del vehículo y el seguro vigente. Si "
            "el municipio exige la revisión técnica, también tenés que llevarla.\n\n"
            "## Convivencia\n\n"
            "Respetá la prioridad del peatón, no bloquees rampas ni ochavas y "
            "usá las luces de giro con anticipación.\n\n"
            "## Alcohol y medicamentos\n\n"
            "No conduzcas después de consumir alcohol. Algunos medicamentos "
            "afectan los reflejos: consultá a tu médico o farmacéutico."
        ),
    },
    {
        "code": "emergencias",
        "title": "Qué hacer ante un siniestro",
        "description": "Protección, aviso y asistencia a las personas.",
        "kind": "text",
        "sort_order": 40,
        "body_md": (
            "# Qué hacer ante un siniestro\n\n"
            "1. Detenete en un lugar seguro y encendé las balizas.\n"
            "2. Verificá si hay personas heridas. No las muevas salvo peligro "
            "inmediato.\n"
            "3. Llamá al número de emergencias que indique el municipio.\n"
            "4. No abandones el lugar y colaborá con la autoridad que intervenga.\n\n"
            "Si el siniestro es grave, priorizá la atención de las personas."
        ),
    },
]

QUESTIONS: list[dict[str, object]] = [
    {
        "category": "B",
        "prompt": "¿Qué indica una luz roja del semáforo?",
        "options": [
            "Que se puede avanzar si no viene nadie",
            "Que hay que detenerse antes de la línea de pare",
            "Que hay que acelerar para cruzar",
            "Que solo deben detenerse los peatones",
        ],
        "correct_index": 1,
        "explanation": "La luz roja obliga a detenerse antes de la línea de pare.",
    },
    {
        "category": "B",
        "prompt": "¿Cuál es la distancia de seguridad recomendada en condiciones normales?",
        "options": [
            "Un metro",
            "La suficiente para detenerse sin chocar al vehículo de adelante",
            "Cualquier distancia si se va despacio",
            "No hace falta dejar distancia",
        ],
        "correct_index": 1,
        "explanation": "La distancia debe permitir frenar con seguridad ante una detención repentina.",
    },
    {
        "category": "B",
        "prompt": "¿Quiénes deben usar el cinturón de seguridad?",
        "options": [
            "Solo quien conduce",
            "Solo los ocupantes del asiento delantero",
            "Todos los ocupantes del vehículo",
            "Nadie si el trayecto es corto",
        ],
        "correct_index": 2,
        "explanation": "El cinturón es obligatorio para todos los ocupantes.",
    },
    {
        "category": "B",
        "prompt": "En un cruce sin señalización, ¿quién tiene prioridad?",
        "options": [
            "El vehículo más grande",
            "El que viene por la derecha",
            "El que toca bocina primero",
            "El que circula más rápido",
        ],
        "correct_index": 1,
        "explanation": "La regla general otorga prioridad a quien viene por la derecha.",
    },
    {
        "category": "B",
        "prompt": "¿Qué documentación debe llevar quien conduce?",
        "options": [
            "Solo la licencia",
            "Licencia, cédula del vehículo y seguro vigente",
            "Ninguna si el vehículo es propio",
            "Solo el DNI",
        ],
        "correct_index": 1,
        "explanation": "La licencia, la cédula y el seguro son documentos exigibles.",
    },
    {
        "category": "B",
        "prompt": "¿Qué hacer si empieza a llover intensamente?",
        "options": [
            "Mantener la misma velocidad",
            "Reducir la velocidad y aumentar la distancia",
            "Apagar las luces",
            "Frenar bruscamente",
        ],
        "correct_index": 1,
        "explanation": "La lluvia reduce la adherencia y la visibilidad.",
    },
    {
        "category": "B",
        "prompt": "¿Cuál es el efecto del alcohol en la conducción?",
        "options": [
            "Mejora los reflejos",
            "No afecta si se toma poco",
            "Reduce los reflejos y la capacidad de reacción",
            "Solo afecta de noche",
        ],
        "correct_index": 2,
        "explanation": "El alcohol disminuye reflejos, atención y coordinación.",
    },
    {
        "category": "B",
        "prompt": "Ante un siniestro con personas heridas, ¿qué corresponde hacer primero?",
        "options": [
            "Mover a las personas heridas",
            "Proteger el lugar y llamar a emergencias",
            "Irse para no complicarse",
            "Discutir con la otra parte",
        ],
        "correct_index": 1,
        "explanation": "Primero se protege el lugar y se pide ayuda.",
    },
    {
        "category": "B",
        "prompt": "¿Para qué sirven las luces de giro?",
        "options": [
            "Para adornar el vehículo",
            "Para avisar con anticipación una maniobra",
            "Para pedir paso a los peatones",
            "Para indicar que el vehículo está detenido",
        ],
        "correct_index": 1,
        "explanation": "Las luces de giro comunican la maniobra a los demás.",
    },
    {
        "category": "B",
        "prompt": "¿Qué significa una señal de prevención?",
        "options": [
            "Una obligación",
            "Una prohibición",
            "Un peligro o situación a tener en cuenta",
            "Una recomendación comercial",
        ],
        "correct_index": 2,
        "explanation": "Las señales de prevención advierten riesgos.",
    },
    {
        "category": "B",
        "prompt": "¿Cuándo se debe ceder el paso a un peatón?",
        "options": [
            "Solo si está en una senda peatonal",
            "Siempre que esté cruzando o por cruzar",
            "Solo de día",
            "Nunca, el vehículo tiene prioridad",
        ],
        "correct_index": 1,
        "explanation": "El peatón tiene prioridad en los cruces.",
    },
    {
        "category": "B",
        "prompt": "¿Qué revisar antes de iniciar la marcha?",
        "options": [
            "Solo el combustible",
            "Espejos, asiento, cinturón y alrededores del vehículo",
            "Nada, el vehículo se revisa una vez al año",
            "Solo la radio",
        ],
        "correct_index": 1,
        "explanation": "La revisión previa evita maniobras inseguras.",
    },
]

POLICIES: list[dict[str, str]] = [
    {
        "slug": "terminos-de-uso",
        "title": "Términos de uso del portal",
        "body_md": (
            "# Términos de uso\n\n"
            "Este portal permite iniciar y seguir trámites de licencias de "
            "conducir de la Municipalidad de Baradero.\n\n"
            "## Uso responsable\n\n"
            "La persona usuaria se compromete a brindar información veraz y a no "
            "usar el portal para fines ajenos al trámite.\n\n"
            "## Cuenta personal\n\n"
            "Las credenciales son personales e intransferibles. Si detectás un "
            "acceso no autorizado, tenés que cambiar la contraseña y avisar a la "
            "oficina de licencias.\n\n"
            "## Disponibilidad\n\n"
            "El municipio puede interrumpir el servicio por mantenimiento o por "
            "motivos de seguridad. Los plazos del trámite se informan en cada "
            "etapa.\n\n"
            "## Documentación\n\n"
            "La documentación presentada queda sujeta a revisión. La aprobación "
            "de un paso no implica la aprobación automática de los demás."
        ),
    },
    {
        "slug": "politica-de-privacidad",
        "title": "Política de privacidad",
        "body_md": (
            "# Política de privacidad\n\n"
            "La Municipalidad de Baradero trata los datos personales necesarios "
            "para gestionar el trámite de licencia de conducir.\n\n"
            "## Datos que se recogen\n\n"
            "Identificación, contacto, documentación respaldatoria, datos del "
            "trámite, comprobantes de pago y registros de auditoría.\n\n"
            "## Finalidad\n\n"
            "Los datos se usan para verificar la identidad, evaluar los "
            "requisitos, emitir la credencial y cumplir obligaciones legales.\n\n"
            "## Conservación\n\n"
            "Se conservan durante el plazo necesario para el trámite y los plazos "
            "legales aplicables. La auditoría no se elimina.\n\n"
            "## Derechos\n\n"
            "Podés solicitar acceso, rectificación o actualización de tus datos "
            "en la oficina de licencias.\n\n"
            "## Seguridad\n\n"
            "Los datos sensibles se cifran y los accesos quedan registrados."
        ),
    },
    {
        "slug": "tratamiento-de-datos",
        "title": "Consentimiento para el tratamiento de datos",
        "body_md": (
            "# Consentimiento para el tratamiento de datos\n\n"
            "Al aceptar esta política autorizás a la Municipalidad de Baradero a "
            "tratar los datos personales y la documentación que presentás para "
            "tramitar la licencia de conducir.\n\n"
            "## Alcance\n\n"
            "El tratamiento incluye la verificación de identidad, la revisión de "
            "documentos, la programación de exámenes, la emisión de la credencial "
            "y las comunicaciones relacionadas con el trámite.\n\n"
            "## Datos sensibles\n\n"
            "La información de salud se usa únicamente para evaluar la aptitud "
            "psicofísica y se trata con acceso restringido.\n\n"
            "## Retiro del consentimiento\n\n"
            "Podés consultar cómo ejercer tus derechos en la oficina de "
            "licencias. El retiro no afecta los tratamientos ya realizados ni "
            "las obligaciones legales de conservación."
        ),
    },
]


def seed_procedure_types(db: Session) -> int:
    """Carga los seis tipos de trámite si no existen."""
    created = 0
    for item in PROCEDURE_TYPES:
        exists = db.execute(
            select(ProcedureType.id).where(ProcedureType.code == str(item["code"]))
        ).first()
        if exists is not None:
            continue
        db.add(ProcedureType(**item))
        created += 1
    db.flush()
    return created


def seed_matrix(db: Session) -> int:
    """Carga una matriz provisoria por tipo y categoría.

    No pisa filas existentes: si el municipio ya ajustó una categoría, el seed
    no la revierte.
    """
    created = 0
    types = db.execute(select(ProcedureType)).scalars().all()
    for procedure_type in types:
        for category in LICENSE_CATEGORIES:
            exists = db.execute(
                select(ProcedureMatrix.id).where(
                    ProcedureMatrix.procedure_type_id == procedure_type.id,
                    ProcedureMatrix.license_category == category,
                )
            ).first()
            if exists is not None:
                continue
            db.add(
                ProcedureMatrix(
                    procedure_type_id=procedure_type.id,
                    license_category=category,
                    min_age=18,
                    max_age=None,
                    fee_amount=Decimal("0.00"),
                    validity_years=5,
                    steps=list(SEED_STEPS),
                    required_documents=["health_certificate"],
                    theory_questions=10,
                    theory_pass_ratio=0.8,
                    theory_minutes=20,
                    max_theory_attempts=1,
                    requires_health=True,
                    requires_practical=True,
                    notes=MATRIX_NOTES,
                    active=True,
                )
            )
            created += 1
    db.flush()
    return created


def seed_materials(db: Session) -> int:
    """Carga los materiales de la etapa de charlas."""
    created = 0
    for item in MATERIALS:
        exists = db.execute(
            select(LearningMaterial.id).where(LearningMaterial.code == str(item["code"]))
        ).first()
        if exists is not None:
            continue
        db.add(LearningMaterial(active=True, **item))
        created += 1
    db.flush()
    return created


def seed_questions(db: Session) -> int:
    """Carga preguntas en borrador. No se usan hasta la revisión municipal."""
    created = 0
    for item in QUESTIONS:
        exists = db.execute(
            select(Question.id).where(Question.prompt == str(item["prompt"]))
        ).first()
        if exists is not None:
            continue
        db.add(
            Question(
                **item,
                active=True,
                reviewed=False,
                source="Borrador inicial para revisión municipal",
            )
        )
        created += 1
    db.flush()
    return created


def seed_policies(db: Session) -> int:
    """Publica la versión inicial de cada política obligatoria."""
    created = 0
    for item in POLICIES:
        exists = db.execute(select(Policy.id).where(Policy.slug == item["slug"])).first()
        if exists is not None:
            continue
        db.add(
            Policy(
                slug=item["slug"],
                title=item["title"],
                version=1,
                body_md=item["body_md"],
                content_hash=policy_hash(item["body_md"]),
                mandatory=True,
                applies_to="all",
                effective_at=utcnow(),
                active=True,
            )
        )
        created += 1
    db.flush()
    return created


def seed_all(db: Session) -> dict[str, int]:
    """Ejecuta el seed completo y devuelve cuántas filas creó cada bloque."""
    result = {
        "procedure_types": seed_procedure_types(db),
        "matrix": seed_matrix(db),
        "materials": seed_materials(db),
        "questions": seed_questions(db),
        "policies": seed_policies(db),
    }
    db.commit()
    logger.info("Seed completado", extra=result)
    return result
