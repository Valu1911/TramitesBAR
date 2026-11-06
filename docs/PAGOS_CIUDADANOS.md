# Pago ciudadano por transferencia

## Recorrido disponible

La ruta ciudadana `/tramites/:id/pago` se abre desde **Gestionar pago del arancel** en el panel, cuando `current_step` es `payment`. El indicador de etapas usa los pasos reales del expediente, ordenados por `position`; no agrega exámenes ni omite el pago por asumir un circuito fijo.

1. La página consulta el expediente propio y sus instrucciones de pago. Monto, referencia, alias, CBU, titular y banco vienen de API; no se generan ni reemplazan en React.
2. El ciudadano puede copiar referencia/alias/CBU. Si el navegador deniega el portapapeles, los datos quedan visibles para copiar manualmente, sin anunciar una copia exitosa falsa.
3. Después de transferir, informa nombre y apellido del ordenante, DNI y comprobante (`*`). Fecha y observaciones son opcionales, como en `PaymentClaimIn`.
4. Se sube el archivo como `payment_receipt` y luego se declara el pago mediante el ID recibido del servidor. El cliente no envía un monto ni una aprobación.
5. La respuesta `claimed` se presenta como **Comprobante en revisión**, no como pago aprobado ni etapa completada. **Actualizar estado** consulta nuevamente al servidor; el panel ofrece el siguiente paso solo cuando la API lo habilita.

Si no hay alias ni CBU configurados, se informa la falta sin inventar datos. Se indica confirmar el destino con la oficina antes de transferir. Quien ya transfirió con datos confirmados puede informar su operación: no se inventa una prohibición de declarar pagos previos.

## Estados y reenvíos

| Estado | Interfaz | Declaración por API |
|---|---|---|
| `pending` | Permite informar la transferencia si corresponde a la etapa actual | Admite declaración |
| `rejected` | Muestra observación y pide otro comprobante; no reutiliza el anterior automáticamente | Admite corrección con documento válido |
| `claimed` | Comprobante en revisión, sin formulario de reenvío | `409 payment_not_claimable` |
| `pending_second` | Espera segundo control, sin volver a pagar ni enviar | `409 payment_not_claimable` |
| `approved` | Pago aprobado; volver al panel | Conserva `409 payment_already_approved` si se alcanza esa guarda |
| `refunded` | Pago reintegrado; consultar con oficina | `409 payment_not_claimable` |
| Desconocido | No habilita declarar y pide actualizar/consultar | No se convierte a un estado conocido por el cliente |

Las guardas de etapa y propiedad se ejecutan antes de declarar. El servidor refresca el pago precargado por SQLAlchemy al leerlo bajo el bloqueo existente: un estado viejo en la sesión no puede sobrescribir una revisión iniciada por otra sesión. Se conserva todo control previo antes de modificar comprobante o revisores. La prueba con SQLite verifica el refresco ORM, **no certifica aislamiento ni concurrencia de MySQL**.

Si falla la respuesta de la declaración, la página exige actualizar estado antes de reintentar: el servidor podría haber recibido la operación. Si el archivo se guardó y la declaración sigue pendiente, puede reutilizarse ese adjunto confirmado sin otra subida. La interfaz no hace reintentos automáticos, no encola pagos offline y no habilita reenviar un pago ya en revisión. Un bloqueo inmediato evita dos envíos desde el mismo formulario.

## Archivos y privacidad

- Ayuda previa en el navegador: PDF, JPG, PNG o WEBP, archivo no vacío, hasta 10 MB en el portal. No reemplaza la validación por contenido real en el servidor; `MAX_UPLOAD_MB` puede imponer otro límite y la API informa el error.
- Se usan el cliente `api`, cookies de sesión y cabecera CSRF existentes. No se guardan tarjetas, tokens, DNI ni adjuntos en `localStorage`.
- El formulario se reinicia al cambiar de expediente; la consulta está separada por usuario/expediente, sin persistencia de caché y con `gcTime: 0`. Las solicitudes se cancelan al salir. Cancelar el navegador no deshace un archivo u operación ya recibida por el servidor.
- El DNI escrito se limpia del estado del formulario tras la respuesta de declaración exitosa. No se envía a Bari ni se imprime en logs desde esta página.
- Observaciones y nombres se presentan con escape de React, sin HTML del usuario ni estilos/handlers inline nuevos.
- **Se solicita revisión de seguridad de pagos y archivos antes del merge.** Antes de producción también hay que verificar cifrado, antivirus, retención y controles de almacenamiento del pipeline existente; esta unidad no certifica ese pipeline.

## Contratos utilizados

- `GET /api/v1/procedures/:id`.
- `GET /api/v1/procedures/:id/payment/instructions`.
- `POST /api/v1/procedures/:id/documents`, multipart `kind=payment_receipt` y `file`.
- `POST /api/v1/procedures/:id/payment/claim`: `receipt_document_id`, `payer_name`, `payer_dni`, `transfer_date`, `notes`.

No hay endpoints, tablas, migraciones ni dependencias nuevos. Cambia la guarda de estado del endpoint existente de declaración. Ver [API.md](API.md).

## Pruebas

Desde `sistema_licencias/frontend`:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Solo pago: `npm test -- src/lib/payment.test.ts` y `npm run test:e2e -- e2e/payment.spec.ts`. Playwright usa API interceptada y datos controlados, cuatro tamaños y Chromium; no mueve dinero ni valida una transferencia bancaria real. Ver [QA_RESPONSIVE.md](QA_RESPONSIVE.md).

Backend: `tests/test_payments.py` contiene 12 casos: tres previos de revisión/conciliación y nueve nuevos de declaración, rechazos sin mutación, propiedad, CSRF, etapa y refresco de estado ORM. Para ejecutarlos sin `.env`, bases ni servicios reales, desde `sistema_licencias/backend`:

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD = '1'
$env:TMP = Join-Path $env:LOCALAPPDATA 'Temp/opencode'
$env:TEMP = $env:TMP
@'
import os, runpy, sys
from app.core.config import Settings
Settings.model_config['env_file'] = None
for name in Settings.model_fields:
    os.environ.pop(name.upper(), None)
os.environ.update(APP_ENV='test', DATABASE_URL='sqlite://', REDIS_URL='', STORAGE_BACKEND='local', EMAIL_TRANSPORT='console', OLLAMA_URL='', LIVEKIT_URL='', LIVEKIT_API_KEY='', LIVEKIT_API_SECRET='', FEATURES_PROCTORING='false', FEATURES_MINORS='false', FEATURES_DNI_OCR='false', SENTRY_DSN='')
sys.argv = ['pytest', '-o', 'addopts=', 'tests/test_payments.py', '-q', '--tb=short', '--show-capture=no']
runpy.run_module('pytest', run_name='__main__')
'@ | .\.venv\Scripts\python.exe -
```

Usar una carpeta temporal existente y aprobada. Para la suite completa, reemplazar `tests/test_payments.py` por `tests` dentro del mismo runner. `conftest.py` crea únicamente SQLite en memoria, claves aleatorias y archivos temporales. Ruff: `.\.venv\Scripts\python.exe -m ruff check app tests`; Mypy: `.\.venv\Scripts\python.exe -m mypy app tests`.

### Evidencia y límites de esta sesión

- Backend completo: **40/40**; frontend: **162 unitarias y 164 de navegador**, sin omitir casos. Incluye reinicio de datos del ordenante al cambiar de cuenta sin recargar la ruta. Tipos/lint y build aprobados según el handoff.
- El venv observado usa Python 3.13.14 y ya tenía PyJWT 2.15.1 instalado. **PyJWT sigue sin declararse en `requirements.txt`**. Por eso no se reprodujeron localmente los dos fallos históricos de `jwt`; no se corrigió el manifiesto ni el proctoring. Una instalación limpia/CI todavía puede fallar y el examen sigue bloqueado por política de supervisión.
- Falta consola de revisión/conciliación de pagos por rol y recorrido conjunto ciudadano–municipio con MySQL, archivos y correo en staging. No se accedió a producción, no se ejecutaron migraciones ni se comprobó una transferencia real.

Si se revierte la UI, conservar las guardas del servidor; no reabrir reenvíos de pagos en revisión como arreglo operativo. Integración y rollback siempre mediante PR revisado.
