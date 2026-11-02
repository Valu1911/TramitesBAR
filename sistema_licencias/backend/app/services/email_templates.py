"""Plantillas de correo transaccional en español rioplatense.

No incluyen datos sensibles en el asunto. El HTML es simple y compatible con
clientes de correo: una columna, sin fuentes externas, sin imágenes remotas.
"""

from __future__ import annotations

from typing import Any


def _layout(title: str, body: str, footer: str = "") -> str:
    """Envuelve el contenido en el layout institucional mínimo."""
    return f"""<!doctype html>
<html lang="es-AR">
  <body style="margin:0;padding:0;background:#f3f0e8;font-family:Arial,Helvetica,sans-serif;color:#14232b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f0e8;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #d9d2c3;">
          <tr><td style="background:#0b2a33;padding:20px 24px;color:#ffffff;font-size:20px;font-weight:bold;">TramitesBAR</td></tr>
          <tr><td style="padding:28px 24px;">
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0b2a33;">{title}</h1>
            {body}
          </td></tr>
          <tr><td style="padding:18px 24px;border-top:1px solid #e7e1d5;color:#5b6a70;font-size:12px;line-height:1.5;">
            Municipalidad de Baradero. Este mensaje se generó automáticamente; no respondas a esta dirección.
            {footer}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""


def _p(text: str) -> str:
    """Párrafo HTML seguro para textos controlados por el sistema."""
    return f'<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">{text}</p>'


def _button(label: str, url: str) -> str:
    """Botón de acción sin imágenes."""
    return (
        f'<p style="margin:22px 0;"><a href="{url}" '
        'style="display:inline-block;background:#1f6f5c;color:#ffffff;text-decoration:none;'
        'padding:12px 20px;font-size:15px;font-weight:bold;">'
        f"{label}</a></p>"
    )


def render_email(template: str, context: dict[str, Any]) -> tuple[str, str, str]:
    """Devuelve (asunto, texto plano, HTML) para una plantilla."""
    name = context.get("first_name", "vecino/a")
    procedure = context.get("procedure_code", "tu trámite")
    frontend = context.get("frontend_url", "http://127.0.0.1:5173")

    templates: dict[str, tuple[str, str, str]] = {
        "verify_email": (
            "Verificá tu correo en TramitesBAR",
            f"Hola {name}:\n\nPara activar tu cuenta ingresá a este enlace:\n{context.get('verify_url')}\n\nSi no creaste la cuenta, ignorá este mensaje.",
            _layout(
                "Verificá tu correo",
                _p(f"Hola {name}: para activar tu cuenta hacé clic en el botón.")
                + _button("Verificar correo", context.get("verify_url", frontend))
                + _p("El enlace vence en 24 horas. Si no creaste la cuenta, ignorá este mensaje."),
            ),
        ),
        "reset_password": (
            "Recuperación de contraseña de TramitesBAR",
            f"Hola {name}:\n\nPara elegir una contraseña nueva ingresá a:\n{context.get('reset_url')}\n\nEl enlace vence en 30 minutos.",
            _layout(
                "Recuperá tu contraseña",
                _p("Pediste recuperar el acceso a TramitesBAR. El enlace vence en 30 minutos.")
                + _button("Elegir contraseña", context.get("reset_url", frontend))
                + _p("Si no lo pediste, no hagas nada: tu contraseña actual sigue vigente."),
            ),
        ),
        "procedure_created": (
            f"Trámite {procedure} iniciado",
            f"Registramos tu trámite {procedure}. Podés seguir el estado desde el portal.",
            _layout(
                "Trámite iniciado",
                _p(f"Registramos el trámite <strong>{procedure}</strong>.")
                + _p("Ya podés completar los pasos desde tu panel. Cada avance te va a llegar por correo y al portal.")
                + _button("Ver mi trámite", f"{frontend}/panel/tramites"),
            ),
        ),
        "step_completed": (
            f"Avance en el trámite {procedure}",
            f"Se completó la etapa: {context.get('step_label')}.",
            _layout(
                "Etapa completada",
                _p(f"El trámite <strong>{procedure}</strong> avanzó.")
                + _p(f"Etapa completada: <strong>{context.get('step_label')}</strong>.")
                + _button("Continuar", f"{frontend}/panel/tramites/{context.get('procedure_id')}"),
            ),
        ),
        "document_approved": (
            f"Documento aprobado en el trámite {procedure}",
            "Revisamos tu documentación y fue aprobada.",
            _layout(
                "Documentación aprobada",
                _p(f"El documento <strong>{context.get('document_kind')}</strong> del trámite {procedure} fue aprobado.")
                + _p("Podés continuar con el siguiente paso desde el portal.")
                + _button("Ver trámite", f"{frontend}/panel/tramites/{context.get('procedure_id')}"),
            ),
        ),
        "document_rejected": (
            f"Documento observado en el trámite {procedure}",
            "Tu documentación necesita una corrección.",
            _layout(
                "Documentación observada",
                _p(f"El documento <strong>{context.get('document_kind')}</strong> del trámite {procedure} fue observado.")
                + _p(f"Motivo: {context.get('notes', 'Consultá el detalle en el portal.')}")
                + _button("Ver y corregir", f"{frontend}/panel/tramites/{context.get('procedure_id')}"),
            ),
        ),
        "payment_approved": (
            f"Pago acreditado del trámite {procedure}",
            "El pago fue aprobado.",
            _layout(
                "Pago acreditado",
                _p(f"El pago del trámite <strong>{procedure}</strong> fue aprobado.")
                + _p("Ya podés continuar con las etapas siguientes.")
                + _button("Continuar", f"{frontend}/panel/tramites/{context.get('procedure_id')}"),
            ),
        ),
        "payment_rejected": (
            f"Pago observado del trámite {procedure}",
            "El comprobante necesita una corrección.",
            _layout(
                "Pago observado",
                _p(f"El pago del trámite <strong>{procedure}</strong> fue observado.")
                + _p(f"Motivo: {context.get('notes', 'Consultá el detalle en el portal.')}")
                + _button("Ver y corregir", f"{frontend}/panel/tramites/{context.get('procedure_id')}"),
            ),
        ),
        "exam_result": (
            f"Resultado del examen teórico del trámite {procedure}",
            f"Resultado: {context.get('result_label')}",
            _layout(
                "Resultado del examen",
                _p(f"Trámite <strong>{procedure}</strong>.")
                + _p(f"Resultado: <strong>{context.get('result_label')}</strong>.")
                + _p(f"Puntaje: {context.get('score')} de {context.get('total')}.")
                + _button("Ver detalle", f"{frontend}/panel/tramites/{context.get('procedure_id')}"),
            ),
        ),
        "appointment_scheduled": (
            f"Turno reservado para el trámite {procedure}",
            "Tu turno quedó registrado.",
            _layout(
                "Turno reservado",
                _p(f"Trámite <strong>{procedure}</strong>.")
                + _p(f"Fecha y hora: <strong>{context.get('scheduled_at')}</strong>.")
                + _p(f"Lugar: {context.get('location')}.")
                + _button("Ver turno", f"{frontend}/panel/tramites/{context.get('procedure_id')}"),
            ),
        ),
        "license_issued": (
            "Tu credencial TramitesBAR está lista",
            f"Se emitió la credencial del trámite {procedure}.",
            _layout(
                "Credencial emitida",
                _p(f"Se emitió la credencial del trámite <strong>{procedure}</strong>.")
                + _p(f"Número: <strong>{context.get('license_number')}</strong>.")
                + _p(f"Vencimiento: {context.get('expires_at')}.")
                + _button("Ver credencial", f"{frontend}/panel/credencial"),
            ),
        ),
        "account_suspended": (
            "Cuenta suspendida en TramitesBAR",
            "Tu cuenta fue suspendida. Contactá al municipio para más información.",
            _layout(
                "Cuenta suspendida",
                _p("Tu cuenta fue suspendida por el municipio.")
                + _p("Si creés que es un error, comunicate con la Oficina de Licencias de Baradero."),
            ),
        ),
        "generic": (
            context.get("subject", "Novedad en TramitesBAR"),
            context.get("body", "Tenés una novedad en TramitesBAR."),
            _layout(
                context.get("subject", "Novedad en TramitesBAR"),
                _p(context.get("body", "Tenés una novedad en TramitesBAR.")),
            ),
        ),
    }

    if template not in templates:
        template = "generic"
    return templates[template]
