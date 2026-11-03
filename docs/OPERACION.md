# Guía de Operación — TramitesBAR

Este documento explica cómo configurar, inicializar, operar y respaldar `sistema_licencias` (TramitesBAR) en entornos de desarrollo y producción.

---

## 1. Configuración de variables de entorno

La aplicación lee su configuración desde `sistema_licencias/.env` (o variables de entorno del sistema) a través de `app/core/config.py`. Nunca se versiona el archivo `.env`.

### 1.1 Generación inicial en desarrollo
Desde `sistema_licencias/backend`:

```bash
python scripts/generate_env.py
```

El script solicita la cadena `DATABASE_URL` y genera automáticamente claves criptográficas aleatorias de alta entropía:
- `SECRET_KEY`: 48 bytes aleatorios URL-safe.
- `ENCRYPTION_KEY`: 32 bytes aleatorios codificados en Base64 para AES-256-GCM.
- `ENCRYPTION_KEY_ID`: identificador de la clave activa (`k1`).
- `DNI_HMAC_KEY`: 48 bytes aleatorios URL-safe para el índice ciego de DNI.

### 1.2 Validaciones obligatorias en producción (`APP_ENV=production`)
Al iniciar la API o el worker con `APP_ENV=production`, `Settings.validate_runtime()` aborta el arranque si no se cumplen todas estas condiciones:
- `DATABASE_URL` apunta a MySQL (`mysql+pymysql://...`), nunca a SQLite.
- `REDIS_URL` está configurada para el rate limiting distribuido.
- `COOKIE_SECURE=true`, `APP_URL` y `FRONTEND_URL` usan `https://`.
- `EMAIL_TRANSPORT=smtp` con `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM` definidos.
- `STORAGE_BACKEND=s3` con `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` y `S3_BUCKET` definidos.
- `CORS_ORIGINS` y `TRUSTED_HOSTS` contienen dominios explícitos (sin comodín `*`).

---

## 2. Base de datos y servicios auxiliares

### 2.1 Con Docker Compose (desarrollo local)
En la raíz del repositorio existe `docker-compose.dev.yml` con MySQL 8.4 (`utf8mb4`), Redis 7 y MinIO:

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 2.2 Con MySQL 8.4 existente (por ejemplo WAMP en Windows)
Crear la base y el usuario con privilegios acotados (nunca usar `root` desde la aplicación):

```sql
CREATE DATABASE IF NOT EXISTS tramites_bar
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'tramites_app'@'127.0.0.1' IDENTIFIED BY 'REEMPLAZAR_POR_CLAVE_LOCAL';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON tramites_bar.* TO 'tramites_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

### 2.3 Aplicación de migraciones Alembic
Desde `sistema_licencias/backend`:

```bash
alembic upgrade head
```

---

## 3. Comandos operativos de la CLI (`python -m app.cli`)

Todos los comandos se ejecutan desde `sistema_licencias/backend` con el entorno virtual activo. Ningún comando crea contraseñas por defecto: el operador ingresa la contraseña por teclado (o mediante la variable efímera `TB_PASSWORD` en automatizaciones controladas) y cada acción queda registrada en `audit_log`.

### 3.1 Carga del catálogo base (`seed`)
```bash
python -m app.cli seed
```
Carga de manera idempotente:
- Políticas iniciales (`privacidad`, `terminos`, `declaracion-jurada`).
- Los 6 tipos de trámite (`nueva`, `renovacion`, `vencida`, `categoria`, `profesional`, `extravio`).
- Matriz inicial configurable (`procedure_matrix`).
- Materiales de charlas de seguridad vial (`learning_materials`).
- Banco inicial de preguntas revisadas (`questions`).

### 3.2 Alta del primer superadministrador (`create-superadmin`)
```bash
python -m app.cli create-superadmin --email sistemas@baradero.gob.ar
```

### 3.3 Alta de personal municipal (`create-staff`)
Roles permitidos: `admin`, `admin_pagos`, `admin_salud`, `admin_turnos`, `admin_cuentas`, `superadmin`.

```bash
python -m app.cli create-staff --email pagos@baradero.gob.ar --role admin_pagos
```
En su primer ingreso web, el sistema exigirá configurar el segundo factor TOTP antes de habilitar cualquier pantalla de backoffice.

### 3.4 Restablecimiento administrativo de contraseña (`reset-password`)
```bash
python -m app.cli reset-password --email usuario@baradero.gob.ar
```
Actualiza el hash Argon2id, limpia bloqueos por intentos fallidos y **revoca todas las sesiones activas** de esa cuenta.

### 3.5 Limpieza manual de registros vencidos (`purge`)
```bash
python -m app.cli purge
```
Elimina tokens de un solo uso vencidos y sesiones antiguas ya expiradas.

---

## 4. Ejecución de procesos

1. **Servidor HTTP (API):**
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```
2. **Worker de correo y mantenimiento:**
   ```bash
   python -m app.worker
   ```
   Procesa la tabla `email_outbox` cada `OUTBOX_POLL_SECONDS` y ejecuta la purga periódica cada `MAINTENANCE_INTERVAL_MINUTES`. Recibe `SIGINT` y `SIGTERM` para cierre ordenado.
3. **Verificación de salud:**
   - Liveness: `GET http://127.0.0.1:8000/health` -> `200 {"status": "ok", ...}`
   - Readiness: `GET http://127.0.0.1:8000/health/ready` -> `200 {"status": "ready", "database": "ok"}`

---

## 5. Respaldos y restauración (Backup & Restore)

### 5.1 Respaldo de MySQL
Generar dump consistente (`--single-transaction`) y cifrarlo fuera del servidor:

```bash
mysqldump --single-transaction --routines --triggers \
  -h 127.0.0.1 -u tramites_app -p tramites_bar > backup_tramites_bar.sql
```

### 5.2 Respaldo de documentos (`storage/` o MinIO)
- En desarrollo (`STORAGE_BACKEND=local`), respaldar la carpeta `sistema_licencias/storage/`.
- En producción (`STORAGE_BACKEND=s3`), habilitar versionado del bucket `tramitesbar` y replicación periódica a almacenamiento secundario.

### 5.3 Verificación posterior a una restauración
Tras restaurar una copia de base de datos, ejecutar siempre:
1. `alembic current` para confirmar que el esquema coincide con la versión del código.
2. `GET /api/v1/admin/audit/verify` desde una cuenta con permiso `audit.read` para comprobar que la cadena de hashes de `audit_log` se mantiene íntegra.
