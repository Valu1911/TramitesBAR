# Referencia de API (`/api/v1`) — TramitesBAR

Este documento describe el contrato HTTP expuesto por el backend FastAPI en `sistema_licencias/backend/app/api/v1/`. En entornos no productivos, la especificación OpenAPI interactiva está disponible en `/docs` y `/openapi.json`.

---

## 1. Convenciones del contrato

### 1.1 Autenticación y CSRF
- **Cookie de sesión (`tb_session`):** cookie `httpOnly`, enviada automáticamente por el navegador (`credentials: "include"`). En base de datos solo se guarda su hash `SHA-256`.
- **Cookie y cabecera CSRF (`tb_csrf` + `X-CSRF-Token`):** toda solicitud con método `POST`, `PATCH`, `PUT` o `DELETE` que dependa de una sesión autenticada debe enviar la cabecera `X-CSRF-Token` con el mismo valor que la cookie `tb_csrf`. El servidor verifica además que `SHA-256(X-CSRF-Token)` coincida con `sessions.csrf_hash`.
- **Segundo factor para personal municipal:** cualquier cuenta con rol de staff (`admin`, `admin_pagos`, `admin_salud`, `admin_turnos`, `admin_cuentas`, `superadmin`) recibe `403 mfa_enrollment_required` en las rutas administrativas hasta que complete `/api/v1/auth/mfa/setup` y `/api/v1/auth/mfa/enable`.

### 1.2 Formato de errores
Todos los errores responden con la estructura uniforme definida en `app/core/errors.py`:

```json
{
  "error": {
    "code": "codigo_estable",
    "message": "Descripción clara para mostrar al usuario"
  }
}
```

En errores de validación (`422 Unprocessable Entity`), se incluye la lista `fields`:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Revisá los datos enviados",
    "fields": [
      { "field": "password", "message": "La contraseña debe tener al menos 12 caracteres" }
    ]
  }
}
```

### 1.3 Paginación administrativa
Los listados de backoffice devuelven el esquema `PageOut`:

```json
{
  "items": [],
  "total": 42,
  "page": 1,
  "page_size": 50
}
```

---

## 2. Salud y disponibilidad (`app/api/v1/health.py`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/health` | Pública | Liveness check. Devuelve `200 OK` con nombre, versión y hora UTC sin tocar la base de datos. |
| `GET` | `/health/ready` | Pública | Readiness check. Ejecuta `SELECT 1` contra MySQL; devuelve `200` si responde o `503` si falla. |

---

## 3. Autenticación, perfil y MFA (`/api/v1/auth`)

| Método | Ruta | Auth | Rate Limit | Descripción |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Pública | 5 / hora por IP | Registra un ciudadano con perfil, cifra su DNI con AES-256-GCM, calcula `dni_hmac` y encola el correo de verificación. |
| `POST` | `/api/v1/auth/verify-email` | Pública | 10 / hora por IP | Confirma el correo mediante el token de un solo uso (`VerifyEmailIn`). |
| `POST` | `/api/v1/auth/resend-verification` | Sesión | 3 / hora por IP | Reenvía el enlace de verificación si la cuenta aún no fue confirmada. |
| `POST` | `/api/v1/auth/login` | Pública | 10 / 15 min por IP+cuenta | Valida email o DNI, contraseña Argon2id y código TOTP/recuperación (si `mfa_enabled`). Emite cookies `tb_session` y `tb_csrf` y devuelve `SessionOut`. |
| `POST` | `/api/v1/auth/logout` | Sesión + CSRF | — | Revoca la sesión actual en base de datos y elimina las cookies. |
| `GET` | `/api/v1/auth/me` | Sesión | — | Devuelve `SessionOut` (`user`, `csrf_token`, `pending_policies`, `mfa_enrollment_required`). |
| `PATCH` | `/api/v1/auth/me` | Sesión + CSRF | — | Actualiza teléfono (cifrado), domicilio y localidad del perfil del ciudadano. |
| `POST` | `/api/v1/auth/change-password` | Sesión + CSRF | — | Valida la clave actual, actualiza el hash Argon2id y revoca todas las sesiones del usuario. |
| `POST` | `/api/v1/auth/forgot-password` | Pública | 5 / hora por IP | Inicia recuperación de contraseña sin revelar si el correo existe. |
| `POST` | `/api/v1/auth/reset-password` | Pública | 5 / hora por IP | Aplica nueva contraseña con el token de un solo uso y revoca las sesiones activas. |
| `GET` | `/api/v1/auth/sessions` | Sesión | — | Lista las sesiones activas del usuario indicando cuál es la actual. |
| `DELETE` | `/api/v1/auth/sessions/{session_id}` | Sesión + CSRF | — | Revoca una sesión propia por su identificador. |
| `POST` | `/api/v1/auth/mfa/setup` | Sesión + CSRF | — | Genera secreto TOTP pendiente (cifrado) y devuelve `secret` + `otpauth_uri`. |
| `POST` | `/api/v1/auth/mfa/enable` | Sesión + CSRF | — | Verifica el primer código TOTP, activa MFA y devuelve los 10 códigos de recuperación por única vez. |
| `POST` | `/api/v1/auth/mfa/disable` | Sesión + CSRF | — | Desactiva MFA validando contraseña y código TOTP (prohibido para cuentas de personal municipal). |

---

## 4. Catálogo público y políticas (`/api/v1/catalog` y `/api/v1/policies`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/catalog/procedure-types` | Pública | Lista los 6 tipos de trámite activos junto con su matriz de categorías, aranceles, edades y pasos. |
| `GET` | `/api/v1/catalog/procedure-types/{code}` | Pública | Devuelve el detalle de un tipo de trámite por su código (`nueva`, `renovacion`, etc.). |
| `GET` | `/api/v1/catalog/materials` | Pública | Lista los materiales educativos activos para las charlas de seguridad vial. |
| `GET` | `/api/v1/policies` | Pública | Lista el resumen de las políticas vigentes (`privacidad`, `terminos`, `declaracion-jurada`). |
| `GET` | `/api/v1/policies/pending` | Sesión | Devuelve la lista de `slug` de políticas obligatorias que el usuario aún no aceptó en su versión vigente. |
| `GET` | `/api/v1/policies/{slug}` | Pública | Devuelve el texto completo en Markdown y el `content_hash` de una política activa. |
| `POST` | `/api/v1/policies/{slug}/accept` | Sesión + CSRF | Registra la aceptación inmutable de la política con fecha, IP, user agent y hash SHA-256. |

---

## 5. Trámites del ciudadano (`/api/v1/procedures` y `/api/v1/appointments`)

Todas las rutas de trámites exigen correo verificado y todas las políticas obligatorias aceptadas.

| Método | Ruta | Auth | Rate Limit | Descripción |
|---|---|---|---|---|
| `POST` | `/api/v1/procedures` | Sesión + CSRF | 10 / hora | Crea un expediente nuevo validando edad contra la matriz, unicidad de trámite abierto y bandera `FEATURES_MINORS`. |
| `GET` | `/api/v1/procedures/mine` | Sesión | — | Lista los expedientes del ciudadano autenticado. |
| `GET` | `/api/v1/procedures/{procedure_id}` | Sesión | — | Devuelve el expediente completo (pasos, documentos, pago, intentos de examen, turnos y credencial). Valida propiedad (anti-IDOR). |
| `POST` | `/api/v1/procedures/{procedure_id}/learning/complete` | Sesión + CSRF | — | Completa el paso `charlas` verificando que se hayan leído todos los materiales obligatorios activos. |
| `POST` | `/api/v1/procedures/{procedure_id}/health` | Sesión + CSRF | — | Guarda la declaración jurada de salud en el paso `health` (requiere subir además el certificado médico). |
| `POST` | `/api/v1/procedures/{procedure_id}/documents` | Sesión + CSRF | 20 / hora | Sube un archivo (`multipart/form-data`: `kind` + `file`). Valida etapa actual, tamaño máximo y MIME real por magic bytes. |
| `GET` | `/api/v1/procedures/{procedure_id}/documents/{document_id}/download` | Sesión | — | Descarga un documento propio dejando constancia en `audit_log`. |
| `GET` | `/api/v1/procedures/{procedure_id}/payment/instructions` | Sesión | — | Devuelve código de referencia (`PAGO-...`), monto y datos bancarios municipales configurados. |
| `POST` | `/api/v1/procedures/{procedure_id}/payment/claim` | Sesión + CSRF | 10 / hora | Declara el pago por transferencia asociando el comprobante subido y datos del ordenante. |
| `GET` | `/api/v1/procedures/{procedure_id}/exam/attempts` | Sesión | — | Lista el historial de intentos de examen teórico del expediente. |
| `POST` | `/api/v1/procedures/{procedure_id}/exam/start` | Sesión + CSRF | 10 / hora | Inicia o retoma un intento en el paso `theory`, congelando las preguntas sorteadas sin enviar el índice correcto al cliente. |
| `POST` | `/api/v1/procedures/{procedure_id}/exam/{attempt_id}/submit` | Sesión + CSRF | 20 / hora | Corrige el intento en el servidor, calcula el puntaje y avanza el paso si alcanza `theory_pass_ratio`. |
| `GET` | `/api/v1/appointments/available` | Sesión | — | Lista los cupos futuros disponibles para el examen práctico. |
| `POST` | `/api/v1/procedures/{procedure_id}/appointment` | Sesión + CSRF | 10 / hora | Reserva un cupo disponible para el paso `practical`. |
| `POST` | `/api/v1/procedures/{procedure_id}/delivery` | Sesión + CSRF | — | Registra la preferencia de entrega (`retiro` presencial o `domicilio`) en el paso `delivery`. |
| `POST` | `/api/v1/procedures/{procedure_id}/cancel` | Sesión + CSRF | — | Cancela un trámite propio en curso. |

### Declaración de pago: estado y prevención de reenvíos

`payment/claim` admite un pago nuevo/pendiente o la corrección de uno `rejected`. Si el pago existente está `claimed`, `pending_second`, `refunded` o en otro estado no habilitado, devuelve `409 payment_not_claimable` **sin borrar comprobante, notas ni revisores**. Conserva `payment_already_approved` para la guarda de aprobado. Las guardas previas de propiedad, CSRF y etapa siguen vigentes; pueden rechazar primero una operación fuera de orden.

La lectura del pago bajo `FOR UPDATE` refresca la instancia ORM precargada antes de validar el estado. El monto sigue calculado en el servidor. Declarar deja el pago `claimed` y el paso `submitted`; no acredita la transferencia ni habilita la siguiente etapa. La interfaz disponible en `/tramites/:id/pago` y sus límites están en [PAGOS_CIUDADANOS.md](PAGOS_CIUDADANOS.md).

---

## 6. Credenciales y verificación pública (`/api/v1/licenses` y `/api/v1/public`)

| Método | Ruta | Auth | Rate Limit | Descripción |
|---|---|---|---|---|
| `GET` | `/api/v1/licenses/mine` | Sesión | — | Lista las credenciales emitidas al ciudadano autenticado. |
| `GET` | `/api/v1/licenses/{license_id}` | Sesión | — | Devuelve el detalle de una credencial propia. |
| `GET` | `/api/v1/licenses/{license_id}/qr.svg` | Sesión | — | Genera el código QR en formato `image/svg+xml` para la credencial. |
| `GET` | `/api/v1/public/licenses/{token}` | Pública | 30 / min por IP | Verifica públicamente una credencial por su `qr_token`, devolviendo estado, vigencia, categoría e iniciales/DNI enmascarados (`***123`). |

---

## 7. Notificaciones y Bari (`/api/v1/notifications` y `/api/v1/bari`)

| Método | Ruta | Auth | Rate Limit | Descripción |
|---|---|---|---|---|
| `GET` | `/api/v1/notifications` | Sesión | — | Lista notificaciones del usuario y el contador de no leídas (`unread`). |
| `POST` | `/api/v1/notifications/{notification_id}/read` | Sesión + CSRF | — | Marca una notificación propia como leída. |
| `POST` | `/api/v1/notifications/read-all` | Sesión + CSRF | — | Marca todas las notificaciones del usuario como leídas. |
| `POST` | `/api/v1/bari/chat` | Pública | 20 / min por IP | Consulta al asistente Bari. Sanitiza PII de entrada y responde solo sobre trámites de licencias. |
| `GET` | `/api/v1/bari/guide/{procedure_code}` | Pública | — | Devuelve la guía visual de pasos, requisitos y materiales para un trámite. |

---

## 8. Backoffice municipal (`/api/v1/admin`)

Todas las rutas bajo `/api/v1/admin` exigen cuenta de personal municipal con MFA TOTP activo y el permiso específico del recurso.

### 8.1 Tablero, expedientes y documentos (`app/api/v1/admin.py`)
| Método | Ruta | Permiso requerido | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/admin/dashboard` | `reports.read` | Indicadores operativos: trámites por estado, pagos y documentos pendientes, turnos próximos, licencias activas y preguntas revisadas. |
| `GET` | `/api/v1/admin/procedures` | `procedures.read` | Busca expedientes por estado, tipo, código público, email o DNI (mediante índice ciego `dni_hmac`). |
| `GET` | `/api/v1/admin/procedures/{procedure_id}` | `procedures.read` | Detalle completo del expediente para revisión administrativa. |
| `POST` | `/api/v1/admin/procedures/{procedure_id}/documents/{document_id}/review` | `documents.review` o `documents.review_health` | Aprueba o rechaza un documento adjunto y avanza el paso correspondiente si corresponde. |
| `GET` | `/api/v1/admin/procedures/{procedure_id}/documents/{document_id}/download` | `procedures.read` | Descarga un documento adjunto registrando `document.staff_downloaded` en auditoría. |
| `POST` | `/api/v1/admin/procedures/{procedure_id}/delivery/complete` | `licenses.issue` | Confirma la entrega, cierra el expediente en `completed` y emite la credencial municipal con QR. |
| `POST` | `/api/v1/admin/procedures/{procedure_id}/reject` | `procedures.manage` | Rechaza el expediente con motivo fundamentado, libera turnos reservados y notifica al ciudadano. |

### 8.2 Pagos y conciliación (`app/api/v1/payments.py`)
| Método | Ruta | Permiso requerido | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/admin/payments` | `payments.read` | Lista pagos por `status`, búsqueda `q` por referencia, código de trámite o correo (máx. 80 caracteres), `limit` 1–100 y `offset` desde 0. |
| `GET` | `/api/v1/admin/payments/imports` | `payments.import` | Lista el historial de importaciones de extractos bancarios. |
| `GET` | `/api/v1/admin/payments/{payment_id}` | `payments.read` | Devuelve el detalle de un pago. |
| `POST` | `/api/v1/admin/payments/{payment_id}/review` | `payments.review` | Aprueba o rechaza un pago. Si el monto alcanza `PAYMENT_SECOND_APPROVAL_THRESHOLD`, pasa a `pending_second` y exige un segundo revisor distinto. |
| `POST` | `/api/v1/admin/payments/import` | `payments.import` | Importa un archivo CSV o XLSX (máx. 10 / hora), concilia por referencia y monto exacto, y reporta excepciones. |

`payments.read` y `payments.review` están restringidos a `admin_pagos`, `admin` y `superadmin`, con MFA. Listado, detalle y revisión devuelven `PaymentAdminOut`: además del pago ciudadano, contexto `procedure_code`, `citizen_email`, `citizen_name`, `second_reviewed_by` y los nuevos campos `procedure_id` (entero) y `reviewed_by` (entero o null). Estos dos campos no se agregan a `PaymentOut` ciudadano. Los esquemas de detalle/revisión se reflejan en OpenAPI.

Revisión: cuerpo `{ "decision": "approve" | "reject", "notes": string | null }`, observaciones de hasta 2000 caracteres; rechazar exige al menos 5 caracteres al quitar espacios exteriores. Solo admite pagos `claimed`/`pending_second`. Refresca pago y expediente bajo `FOR UPDATE` antes de decidir. Errores: `409 payment_not_reviewable` si el pago ya no admite revisión, `409 payment_step_unavailable` si el expediente no está activo en `payment`, `409 second_approval_required` si repite el primer aprobador, `422 notes_required` si falta un motivo válido de rechazo. No avanza el expediente con la primera aprobación de doble control.

La consola consume el estado retornado y exige consultar detalle tras una respuesta incierta. No calcula el umbral ni reintenta decisiones automáticamente. Operación y límites en [PAGOS_MUNICIPALES.md](PAGOS_MUNICIPALES.md).

### 8.3 Banco de preguntas y exámenes (`app/api/v1/exams.py`)
| Método | Ruta | Permiso requerido | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/admin/questions` | `questions.read` | Lista preguntas filtrando por categoría, estado activo y estado de revisión. |
| `POST` | `/api/v1/admin/questions` | `questions.manage` | Crea una pregunta (nace con `reviewed = false`). |
| `PATCH` | `/api/v1/admin/questions/{question_id}` | `questions.manage` | Edita una pregunta (si cambia el texto o las opciones, vuelve a `reviewed = false`). |
| `POST` | `/api/v1/admin/questions/{question_id}/review` | `questions.manage` | Marca una pregunta como revisada o la retira de los sorteos. |
| `POST` | `/api/v1/admin/questions/import` | `questions.manage` | Importa un lote de preguntas pendientes de revisión. |
| `GET` | `/api/v1/admin/exams/attempts` | `procedures.read` | Lista intentos de examen para soporte y auditoría sin exponer las respuestas. |
| `POST` | `/api/v1/admin/procedures/{procedure_id}/retry` | `procedures.manage` | Autoriza un intento extraordinario de examen teórico con motivo auditado. |

### 8.4 Turnos, credenciales, usuarios, políticas y auditoría
| Método | Ruta | Permiso requerido | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/admin/appointments` | `appointments.read` | Lista turnos de examen práctico con datos del expediente reservado. |
| `POST` | `/api/v1/admin/appointments` | `appointments.manage` | Crea un nuevo cupo futuro de examen práctico. |
| `PATCH` | `/api/v1/admin/appointments/{appointment_id}` | `appointments.manage` | Registra la calificación (`passed` / `failed`) o el estado (`no_show`, `cancelled`) del turno práctico. |
| `GET` | `/api/v1/admin/licenses` | `licenses.issue` | Lista credenciales emitidas con filtros por estado y búsqueda. |
| `POST` | `/api/v1/admin/licenses/{license_id}/revoke` | `licenses.revoke` | Revoca inmediatamente una credencial con motivo y auditoría. |
| `GET` | `/api/v1/admin/users` | `users.read` | Lista cuentas buscando por email o por DNI exacto (vía HMAC). |
| `PATCH` | `/api/v1/admin/users/{user_id}` | `users.manage` | Suspende/activa cuentas (revocando sesiones al suspender). El cambio de rol está restringido a `superadmin` y protege al último superadministrador activo. |
| `GET` | `/api/v1/admin/policies` | `policies.manage` | Lista todas las versiones históricas y vigentes de las políticas. |
| `POST` | `/api/v1/admin/policies` | `policies.manage` | Publica una nueva versión de política, calculando su `content_hash` y desactivando la versión previa. |
| `GET` | `/api/v1/admin/audit` | `audit.read` | Consulta paginada del registro de auditoría (`audit_log`). |
| `GET` | `/api/v1/admin/audit/verify` | `audit.read` | Recorre y verifica la cadena criptográfica completa de `audit_log`. |
