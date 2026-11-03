# Runbook de Incidentes y Procedimientos Operativos — TramitesBAR

Este documento contiene los procedimientos paso a paso para responder ante incidentes operativos y de seguridad en `sistema_licencias` (TramitesBAR).

---

## 1. Cuenta de personal municipal comprometida o pérdida de dispositivo MFA

**Síntoma:** un agente municipal reporta el robo de su teléfono con la app autenticadora, sospecha de exposición de su contraseña o se detectan acciones anómalas bajo su `actor_user_id` en `audit_log`.

### Procedimiento
1. **Suspender inmediatamente la cuenta desde el backoffice** (con un usuario `admin` o `superadmin` distinto):
   - Ir a `/admin/usuarios`, localizar la cuenta y cambiar su estado a `Suspendida` (`PATCH /api/v1/admin/users/{id}` con `{"status": "suspended"}`).
   - Esto revoca en el acto todas sus sesiones activas (`sessions.revoked_at = utcnow()`).
2. **Rotar la contraseña por CLI** desde el servidor:
   ```bash
   cd sistema_licencias/backend
   python -m app.cli reset-password --email agente@baradero.gob.ar
   ```
3. **Auditar las acciones recientes del usuario:**
   - En `/admin/auditoria` (`/api/v1/admin/audit?actor_user_id=<ID>`), revisar todas las entradas emitidas desde esa cuenta y verificar la integridad general con **Verificar cadena** (`GET /api/v1/admin/audit/verify`).
4. **Re-enrolamiento de MFA (si corresponde reactivar al agente):**
   - Limpiar `mfa_secret_enc`, `mfa_pending_secret_enc`, `mfa_recovery_hashes` y poner `mfa_enabled = 0` para ese `user_id` en una ventana de mantenimiento autorizada, reactivar la cuenta y exigir que el agente configure un nuevo TOTP en su primer ingreso.

---

## 2. Falla en la verificación de la cadena de auditoría (`audit_log`)

**Síntoma:** `GET /api/v1/admin/audit/verify` devuelve `valid: false` e informa un `broken_at` (ID de la fila donde el hash calculado no coincide con `entry_hash` o `prev_hash`).

### Procedimiento
1. **No borrar ni editar ninguna fila de `audit_log`.**
2. Consultar la fila indicada en `broken_at` y las filas inmediatamente anterior y posterior:
   ```sql
   SELECT id, actor_user_id, actor_role, action, entity_type, entity_id, created_at, prev_hash, entry_hash
   FROM audit_log
   WHERE id BETWEEN (<BROKEN_AT> - 2) AND (<BROKEN_AT> + 2);
   ```
3. Comparar esas filas contra el último backup diario de MySQL para determinar si hubo una modificación directa sobre la base de datos fuera de la aplicación.
4. Revisar credenciales de acceso directo al motor MySQL (`tramites_app` y cuentas de administración) y rotarlas.
5. Preservar un volcado completo de la tabla `audit_log` actual como evidencia antes de cualquier restauración.

---

## 3. Excepciones en la conciliación de extractos bancarios

**Síntoma:** al importar un archivo CSV o XLSX en `/admin/pagos` (`POST /api/v1/admin/payments/import`), el resumen devuelve `exception_rows > 0`.

### Causas posibles registradas en `details.exceptions`
- `"sin referencia o monto"`: la fila del archivo no tiene columnas `referencia`/`concepto` o `monto`/`importe` válidas.
- `"referencia no encontrada"`: el código `PAGO-...` no corresponde a ningún registro en `payments`.
- `"monto inválido"`: el importe no pudo convertirse a `Decimal`.
- `"monto no coincide"`: el importe transferido difiere del arancel registrado en `payments.amount`.

### Procedimiento
1. Revisar el detalle de la importación en `/admin/pagos` (o `GET /api/v1/admin/payments/imports`).
2. Para los casos de `"monto no coincide"` o `"referencia no encontrada"`, buscar el expediente en `/admin/tramites` por DNI o correo del vecino y descargar el comprobante subido (`GET /api/v1/admin/procedures/{id}/documents/{doc_id}/download`).
3. Si el comprobante es válido y el área de Tesorería confirma la acreditación manual:
   - Aprobar el pago desde `/admin/pagos` (`POST /api/v1/admin/payments/{id}/review` con `decision: "approve"` y nota explicativa en `notes`).
   - Si el monto iguala o supera `PAYMENT_SECOND_APPROVAL_THRESHOLD` (`$100.000` por defecto), el pago quedará en `pending_second`: un **segundo revisor distinto** debe ingresar y confirmar la segunda aprobación.

---

## 4. Revocación inmediata de una credencial emitida

**Síntoma:** orden judicial, inhabilitación vial, error material detectado tras la emisión o denuncia de uso indebido de una credencial municipal.

### Procedimiento
1. Ingresar a `/admin/licencias` con una cuenta con permiso `licenses.revoke` (`admin_turnos`, `admin` o `superadmin` con MFA activo).
2. Localizar la credencial por número (`BAR-...`) o correo del titular.
3. Ejecutar **Revocar** (`POST /api/v1/admin/licenses/{id}/revoke`) indicando el motivo formal (mínimo 5 caracteres).
4. **Efecto inmediato:**
   - La credencial pasa a estado `revoked` con fecha `revoked_at`.
   - Cualquier escaneo del código QR en `/verificar/{token}` (`GET /api/v1/public/licenses/{token}`) informa inmediatamente que la credencial **no es válida** (`status: "revoked"`).
   - El ciudadano recibe notificación en el portal y correo electrónico, y la acción queda encadenada en `audit_log`.

---

## 5. Cola de correo detenida o fallos de SMTP (`email_outbox`)

**Síntoma:** los usuarios no reciben correos de verificación o avisos de trámite.

### Diagnóstico y resolución
1. Verificar que el proceso `python -m app.worker` esté en ejecución.
2. Consultar el estado de la cola en MySQL:
   ```sql
   SELECT status, COUNT(*), MAX(last_error)
   FROM email_outbox
   GROUP BY status;
   ```
3. Si hay registros en `pending` con `attempts > 0` o en `failed`, revisar `last_error` (credenciales SMTP vencidas, puerto bloqueado o límite del proveedor).
4. Una vez corregida la configuración SMTP en `.env` y reiniciado `app.worker`, para reencolar correos que hayan agotado sus 5 intentos (`status = 'failed'`):
   ```sql
   UPDATE email_outbox
   SET status = 'pending', attempts = 0, available_at = UTC_TIMESTAMP()
   WHERE status = 'failed';
   ```

---

## 6. Rotación de claves de sesión (`SECRET_KEY`) o revocación global

Si se requiere cerrar de inmediato todas las sesiones activas del sistema (por ejemplo, tras un incidente de red o cambio de configuración de seguridad):

```sql
UPDATE sessions
SET revoked_at = UTC_TIMESTAMP()
WHERE revoked_at IS NULL;
```

Todos los usuarios (ciudadanos y personal municipal) deberán volver a autenticarse en su siguiente solicitud.
