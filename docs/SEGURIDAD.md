# Seguridad y Controles Criptográficos — TramitesBAR

Este documento detalla los controles de seguridad implementados en `sistema_licencias` y su correspondencia con OWASP ASVS 4.0.3 Nivel 2, Ley 25.326 de Protección de Datos Personales y criterios de preparación SOC 2 (*SOC 2 readiness*).

---

## Registro: disponibilidad de políticas (2026-11-06)

El frontend bloquea el registro mientras se consultan las políticas, si falla la consulta o si la API devuelve una lista vacía. No fabrica políticas, versiones ni consentimientos de reemplazo. El usuario puede reintentar la consulta sin perder sus datos. Los consentimientos se marcan explícitamente y los controles del backend siguen siendo la autoridad; la validación del navegador no los reemplaza.

La suite aislada de [QA responsive](QA_RESPONSIVE.md) verifica fallo/recuperación y el payload de consentimiento. No acredita aceptación persistida ni constituye aprobación de seguridad. **Se solicita revisión de seguridad de este cambio antes de integrar**, junto con regresión de registro/políticas en un entorno de integración controlado.

---

## 1. Hashing de contraseñas y política de credenciales

Implementado en `sistema_licencias/backend/app/core/security.py`:

- **Algoritmo:** Argon2id (`argon2-cffi`) con parámetros:
  - Memoria (`m`): `64 MiB` (`65536 KiB`)
  - Iteraciones (`t`): `3`
  - Paralelismo (`p`): `4`
  - Longitud de hash: `32 bytes`
  - Longitud de sal: `16 bytes` aleatorios por contraseña
- **Rehash transparente:** al iniciar sesión (`app/services/auth.py`), si `password_needs_rehash` detecta parámetros antiguos, regenera el hash automáticamente.
- **Política de fortaleza (`validate_password_strength`):** mínimo 12 caracteres, máximo 128, al menos una letra y un número, y bloqueo de contraseñas triviales o vinculadas al dominio (`admin123`, `tramitesbar`, `baradero123`, etc.).
- **Bloqueo progresivo:** tras 5 intentos fallidos consecutivos (`failed_login_count >= 5`), la cuenta se bloquea durante 15 minutos (`locked_until`) y se registra el evento en auditoría.
- **Prevención de enumeración:** el inicio de sesión y la recuperación de contraseña devuelven mensajes uniformes sin revelar si un correo o DNI está registrado.

---

## 2. Cifrado de datos sensibles e índice ciego

### 2.1 Sobre AES-256-GCM (`FieldCipher`)
Los campos sensibles en reposo (`citizen_profiles.dni_encrypted`, `citizen_profiles.phone_encrypted`, `guardian_consents.*_encrypted`, `users.mfa_secret_enc`, `users.mfa_pending_secret_enc`) se cifran mediante AES-256-GCM autenticado:

- **Clave maestra (`ENCRYPTION_KEY`):** 32 bytes codificados en Base64, leídos exclusivamente desde el entorno y validados al arrancar.
- **Identificador de clave (`ENCRYPTION_KEY_ID`):** etiqueta de versión (por defecto `k1`) usada como *Additional Authenticated Data* (AAD) de GCM.
- **Formato almacenado:**
  ```text
  v1.<key_id>.<base64(nonce_12_bytes + ciphertext + gcm_tag_16_bytes)>
  ```
- Si el texto cifrado, el `nonce`, el `tag` o el `key_id` son alterados en la base de datos, la verificación de etiqueta GCM falla y aborta la lectura.

### 2.2 Índice ciego de DNI (`blind_index`)
Para buscar un ciudadano por DNI y garantizar que no existan cuentas duplicadas sin guardar el DNI en texto plano:

- Se normaliza el valor dejando únicamente dígitos y letras en mayúsculas (`30.123.456` -> `30123456`).
- Se calcula `HMAC-SHA-256(key=DNI_HMAC_KEY, msg=normalized)`.
- El resultado hexadecimal de 64 caracteres se guarda en `citizen_profiles.dni_hmac` con restricción `UNIQUE`.
- `DNI_HMAC_KEY` es independiente de `SECRET_KEY` y de `ENCRYPTION_KEY`.

---

## 3. Modelo de sesión y protección CSRF

1. **Sesión opaca del lado del servidor:** al autenticar, el servidor genera un token aleatorio de 256 bits (`secrets.token_urlsafe(32)`) y guarda únicamente su hash `SHA-256` en `sessions.token_hash`.
2. **Cookies seguras:**
   - `tb_session`: `httpOnly=True`, `SameSite` configurable (`lax` o `strict`), `Secure=True` obligatorio en producción.
   - `tb_csrf`: `httpOnly=False` (para lectura por el cliente SPA), `SameSite` y `Secure` idénticos a la sesión.
3. **Validación CSRF de triple control (`_verify_csrf`):** en cada solicitud `POST`, `PATCH`, `PUT` o `DELETE`, la dependencia `current_user` verifica en tiempo constante (`hmac.compare_digest`):
   - Que la cabecera `X-CSRF-Token` y la cookie `tb_csrf` existan y sean idénticas.
   - Que `SHA-256(X-CSRF-Token)` coincida con `sessions.csrf_hash` almacenado en la base de datos para esa sesión.
4. **Caducidad doble:** cada sesión vence a las `SESSION_TTL_HOURS` (12 horas por defecto) o tras `SESSION_IDLE_MINUTES` (60 minutos por defecto) de inactividad.
5. **Revocación ante cambios críticos:** cambiar o restablecer la contraseña, o suspender un usuario desde el backoffice, revoca todas sus sesiones activas en la base de datos.

---

## 4. Segundo factor (MFA TOTP) obligatorio para personal municipal

- Todas las cuentas con rol administrativo (`admin`, `admin_pagos`, `admin_salud`, `admin_turnos`, `admin_cuentas`, `superadmin`) están obligadas a enrolar TOTP (RFC 6238, ventana de 30 segundos con tolerancia `valid_window=1`).
- Al activar MFA (`/api/v1/auth/mfa/enable`), el sistema entrega por única vez 10 códigos de recuperación de un solo uso y persiste únicamente sus hashes `SHA-256` en `users.mfa_recovery_hashes`.
- La dependencia `require_permission` y `require_staff` (`app/api/deps.py`) bloquea cualquier operación de backoffice con `403 mfa_enrollment_required` si `user.mfa_enabled` es `False`.
- El endpoint `/api/v1/auth/mfa/disable` rechaza la desactivación si el usuario pertenece a `STAFF_ROLES`.

---

## 5. Control de acceso (RBAC), anti-IDOR y doble control

### Navegación de interfaz por rol (2026-11-06)

`frontend/src/lib/navigation.ts` determina destinos y enlaces a partir del rol y `mfa_enrollment_required` de la sesión devuelta por API. No cambia la autorización: se preservan las allowlists existentes de `App.tsx` y todo el mapa de permisos del backend. El frontend no debe mostrar Cuentas a Salud, Turnos o Pagos, ni montar vistas operativas cuando el servidor informa que falta enrolar MFA; el perfil sigue disponible. Se usan exclusivamente destinos locales fijos, sin return URL arbitraria.

Pruebas unitarias cubren los siete roles, anónimos, carga de sesión, rechazos y MFA en ambos logins; Playwright verifica redirecciones reales y ausencia de consultas administrativas no previstas. Estas pruebas usan API interceptada, no reemplazan una regresión de RBAC/IDOR con el servidor. **Se solicita revisión de seguridad de login/navegación/MFA antes de integrar.** No hay aprobación de seguridad ni certificación de autorización integral por pasar estas pruebas.

- **Mapa de permisos en código (`app/core/permissions.py`):** los permisos por rol no se leen de tablas editables por un administrador común, evitando escaladas de privilegios por manipulación de datos.
- **Protección anti-IDOR:** todas las consultas de trámites (`get_procedure_or_404`), documentos, intentos de examen, credenciales y notificaciones del ciudadano filtran explícitamente por `user_id == current_user.id`.
- **Protección contra auto-escalada (`PATCH /api/v1/admin/users/{id}`):**
  - Ningún usuario puede modificar su propio rol o estado (`409 self_edit_forbidden`).
  - Solo el rol `superadmin` puede asignar o cambiar roles.
  - No se permite desactivar ni quitar el rol al último `superadmin` activo (`409 last_superadmin`).
- **Doble control en pagos de alto monto (`app/services/payments.py`):** cuando el monto de un pago es mayor o igual a `PAYMENT_SECOND_APPROVAL_THRESHOLD` (`100000.00` por defecto), la primera aprobación deja el pago en estado `pending_second` y guarda `reviewed_by`. Para pasar a `approved`, debe intervenir un segundo usuario distinto con permiso `payments.review` (`second_reviewed_by != reviewed_by`).

---

## 6. Validación y almacenamiento seguro de archivos

En `app/services/storage.py`:

- **Tamaño máximo:** limitado a `MAX_UPLOAD_MB` (10 MB por defecto), leyendo como máximo `max_bytes + 1` antes de rechazar con `413 Payload Too Large`.
- **Detección de MIME por magic bytes (`detect_mime`):** se inspecciona la firma binaria real del archivo (`%PDF`, `\xff\xd8\xff` para JPEG, `\x89PNG\r\n\x1a\n` para PNG, `RIFF....WEBP` para WebP). Se ignora el `Content-Type` y la extensión declarada por el cliente.
- **Nombre aleatorio fuera del webroot:** el archivo se guarda bajo `<kind>/<YYYY>/<MM>/<uuid4>.<ext>`. El nombre original se sanea con `safe_filename` solo para la cabecera de descarga.
- **Integridad:** se calcula y almacena el hash `SHA-256` de cada archivo en `documents.sha256`.
- **Descarga controlada:** los archivos nunca se exponen como estáticos; se entregan a través de endpoints autenticados con `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store` y registro en `audit_log`.

---

## 7. Cabeceras HTTP y protección de IA (Bari)

- **Cabeceras en cada respuesta (`SecurityHeadersMiddleware`):**
  - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'` en todas las rutas de la API.
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: same-origin`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (en producción)
- **Filtro de PII en Bari (`scrub_pii`):** antes de procesar cualquier mensaje en Bari o enviarlo a una instancia local de Ollama, se reemplazan correos electrónicos, secuencias telefónicas y números de 7 u 8 dígitos por marcadores (`[correo]`, `[teléfono]`, `[documento]`).

---

## 8. Cadena de auditoría y preparación SOC 2 (*SOC 2 Readiness*)

- **Nota de cumplimiento:** TramitesBAR implementa controles de *SOC 2 readiness* desde su diseño. La certificación SOC 2 Type II solo puede ser emitida por un auditor independiente tras un período de observación operativa de 3 a 6 meses.
- **Bitácora encadenada (`audit_log`):** cada registro calcula `entry_hash = SHA-256((prev_hash or "") + canonical_json(payload))` bloqueando la última fila con `FOR UPDATE`. Cualquier modificación o borrado manual de una fila rompe la cadena y es detectado por `GET /api/v1/admin/audit/verify`.
