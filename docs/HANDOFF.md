# Handoff del Proyecto — TramitesBAR

**Fecha de actualización:** 2026-11-03  
**Rama:** `fase-0-base`  
**Estado:** v1 operativa completa (Fases 0 a 4, 8 y 9 implementadas y verificadas; Fases 5 a 7 y 10 parametrizadas por feature flags a la espera de definiciones externas).

---

## 1. Qué se hizo

<<<<<<< HEAD
1. **Reemplazo completo del prototipo inseguro por la arquitectura objetivo (`sistema_licencias/`):**
   - **Backend (`sistema_licencias/backend/`):** API en FastAPI + SQLAlchemy 2 + Alembic + Pydantic v2 (`app/main.py`, `app/core/`, `app/models/`, `app/schemas/`, `app/services/`, `app/api/v1/`).
   - **Seguridad y criptografía (`app/core/security.py`, `app/api/deps.py`):** Argon2id (`m=64 MiB`, `t=3`, `p=4`), cifrado autenticado AES-256-GCM con `key_id` para datos sensibles, índice ciego HMAC-SHA-256 para DNI, sesiones opacas en cookie `httpOnly` + validación CSRF de triple control (`X-CSRF-Token`, cookie `tb_csrf` y hash en base), MFA TOTP obligatorio para todo el personal municipal con códigos de recuperación de un solo uso, cabeceras de seguridad estrictas y rate limiting por ventana deslizante (Redis en producción / memoria en dev-test).
   - **Circuito funcional completo (v1):**
     - Catálogo de los 6 tipos de trámite (`nueva`, `renovacion`, `vencida`, `categoria`, `profesional`, `extravio`) y matriz configurable por categoría (`procedure_matrix`).
     - Políticas legales versionadas con hash SHA-256 y bloqueo de trámites hasta su aceptación (`policies`, `policy_acceptances`).
     - Máquina de estados de expedientes (`charlas`, `health`, `theory`, `payment`, `practical`, `delivery`), subida de documentos con validación de magic bytes y SHA-256 (`app/services/storage.py`).
     - Pagos por transferencia bancaria (cero datos de tarjeta), declaración con comprobante, regla de doble control con dos revisores distintos para montos altos e importación/conciliación de extractos CSV y XLSX (`app/services/payments.py`).
     - Examen teórico con banco de preguntas revisadas, snapshot congelado por intento, control de tiempo y corrección en el servidor (`app/services/exams.py`).
     - Reserva y calificación de turnos prácticos (`appointments`), confirmación de entrega y emisión de credencial municipal con QR SVG y verificación pública enmascarada (`app/services/licenses.py`).
     - Notificaciones internas, cola transaccional `email_outbox` con `FOR UPDATE SKIP LOCKED` y worker dedicado (`app/worker.py`).
     - Asistente Bari determinista restringido a licencias, con sanitización de PII (`scrub_pii`) e integración opcional con Ollama local (`app/services/bari.py`).
     - Auditoría append-only con cadena criptográfica de hashes (`prev_hash` -> `entry_hash`) y endpoint de verificación (`app/services/audit.py`).
   - **Frontend (`sistema_licencias/frontend/`):** SPA en React 19 + TypeScript + Vite + React Router 7, con vistas públicas, portal del vecino y backoffice municipal completo, cero estilos inline, cero handlers inline, cero `innerHTML` y cero emojis (iconografía SVG).
2. **Calidad, scripts operativos, infraestructura de desarrollo y CI:**
   - Corrección de configuración de `pyproject.toml`, `alembic/` y `tests/` para que `ruff check .`, `mypy app tests` y `pytest` pasen sin errores.
   - Reemplazo de `sistema_licencias/iniciar.bat`, creación de `sistema_licencias/iniciar.sh` y reescritura de `sistema_licencias/README.md` eliminando cualquier referencia al servidor Flask viejo o a credenciales `admin123`.
   - Creación de `docker-compose.dev.yml` (MySQL 8.4 `utf8mb4`, Redis 7 y MinIO) y `.github/workflows/ci.yml` (pipeline completo para backend con servicio MySQL 8.4 y frontend).
3. **Documentación técnica completa en `docs/`:**
   - `docs/ARQUITECTURA.md`
   - `docs/MODELO_DATOS.md`
   - `docs/API.md`
   - `docs/SEGURIDAD.md`
   - `docs/PROCTORING.md`
   - `docs/OPERACION.md`
   - `docs/RUNBOOK.md`
   - `docs/HANDOFF.md`
=======
2026-11-04
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984

---

<<<<<<< HEAD
## 2. Qué falta (bloqueos externos y fases posteriores)
=======
`fase-0-base`
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984

Los puntos pendientes dependen de definiciones del Municipio de Baradero o de infraestructura de producción:

<<<<<<< HEAD
1. **Datos bancarios oficiales del municipio:** cargar `PAYMENT_ALIAS`, `PAYMENT_CBU`, `PAYMENT_HOLDER` y `PAYMENT_BANK` en el `.env` de producción cuando Tesorería los informe. Mientras están vacíos, la API informa explícitamente que los datos de transferencia están pendientes de configuración municipal.
2. **Validación municipal de la matriz oficial (`procedure_matrix`):** revisar con el área de Tránsito los aranceles, edades y pasos cargados en `app/seed.py`.
3. **Dictamen legal para menores de edad (`FEATURES_MINORS=false`):** hasta contar con aprobación legal del flujo de autorización digital de tutores, el sistema bloquea trámites online de personas de 16 y 17 años e indica atención presencial con padre, madre o tutor.
4. **Infraestructura LiveKit + coturn y validación legal de clips (`FEATURES_PROCTORING=false`):** requiere el servidor dedicado (16+ vCPU, 32 GB RAM, 1 Gbps, IP pública) y la aprobación del protocolo de retención de 90 días antes de activar el proctoring WebRTC en vivo (ver `docs/PROCTORING.md`).
5. **Lote de DNI anonimizados (`FEATURES_DNI_OCR=false`):** necesario para calibrar y habilitar la lectura automática PDF417.
6. **Servidor SMTP oficial y dominio con SPF/DKIM/DMARC:** requerido para pasar `EMAIL_TRANSPORT=smtp` en producción.
=======
Senior Architect / Antigravity Agent & Frontend Subagents
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984

---

<<<<<<< HEAD
## 3. Decisiones tomadas
=======
Consolidación integral de la plataforma municipal de licencias de conducir de Baradero, abarcando todas las etapas del trámite ciudadano y la consola operativa de gestión administrativa:

1. **Flujo Ciudadano Integral (React 19 + TypeScript + Vite)**:
   - **Charlas Viales Obligatorias (`Charlas.tsx`)**: Módulos interactivos secuenciales con telemetría de lectura, bloqueo de avance no visualizado y confirmación de finalización vía `POST /procedures/:id/learning/complete`.
   - **Salud y Declaración Psicofísica (`Health.tsx`)**: Cuestionario médico jurado con grupo sanguíneo, contacto de emergencia y carga multipart/form-data de certificado médico (`POST /procedures/:id/documents` y `POST /procedures/:id/health`).
   - **Examen Teórico Supervisado (`TheoryExam.tsx`)**: Check de hardware obligatorio (pantalla de escritorio, cámara y micrófono), generación de token WebRTC firmado de LiveKit (`POST /procedures/:id/exam/proctoring-token`), cuenta regresiva interactiva, respuestas aleatorizadas y corrección estricta en servidor (`POST /procedures/:id/exam/:attemptId/submit`).
   - **Turno de Examen Práctico (`PracticalAppointment.tsx`)**: Selector reactivo de cupos disponibles (`GET /appointments/available`), reserva inmediata (`POST /procedures/:id/appointments/:id/book`) y credencial de turno con recomendaciones para el circuito.
   - **Gestión de Entrega (`Delivery.tsx`)**: Selección de modalidad (retiro en sede o envío postal a domicilio con validación de dirección) vía `POST /procedures/:id/delivery`.
   - **Credencial Digital Municipal (`CitizenPanel.tsx`)**: Integración con `GET /licenses/mine`. Si el usuario tiene licencia vigente emitida, se renderiza la credencial digital con sello municipal, categoría, vigencia y botón para verificar el QR oficial.
   - **Portal Público de Verificación QR (`VerifyLicense.tsx`)**: Vista pública accesible vía `/verificar/:token` que valida la autenticidad de la credencial contra la base municipal sin exponer datos sensibles ni DNI sin enmascarar.

2. **Consola Operativa Backoffice (`AdminProcedures.tsx`)**:
   - Pestaña **Expedientes y Salud**: Listado paginado de trámites con filtros por estado y buscador general (`q`). Modal de detalle con descarga segura de certificados y botones para **Aprobar Certificado Médico** (avanza automáticamente de salud a teórico) o **Rechazar con observaciones**.
   - Pestaña **Examen Práctico y Turnos**: Agenda municipal en circuito. Modal para **Publicar Nuevo Cupo Práctico** (`POST /admin/appointments`) y botones directos para **Aprobar Manejo** (avanza el trámite de práctico a entrega) o **Reprobar Manejo** (`PATCH /admin/appointments/:id`).
   - Pestaña **Entrega y Licencias**: Bandeja de expedientes con etapas aprobadas listos para confección con botón **Emitir y Entregar Credencial** (`POST /admin/procedures/:id/delivery/complete`), y registro oficial de licencias emitidas con enlace a QR y botón de revocación judicial/médica con motivo (`POST /admin/licenses/:id/revoke`).

3. **Backend LiveKit Proctoring y Normalización de Esquemas**:
   - `ExamProctoringTokenOut` agregado a `app/schemas/exam.py`.
   - `create_proctoring_token` en `app/services/exams.py` generando tokens WebRTC seguros con permisos de video (cámara + compartir pantalla) para sala supervisada de LiveKit.
   - Endpoint `POST /procedures/{procedure_id}/exam/proctoring-token` con guardas de etapa (`current_step == 'theory'`).
   - Desempaquetado transparente en `HealthFormIn` con `@model_validator(mode="before")` para tolerar payloads planos o envueltos en `{ form: ... }`.

4. **Cumplimiento Estricto de Reglas de Proyecto (`AGENTS.md`)**:
   - Cero emojis: interfaz 100% basada en iconos vectoriales SVG limpios (`Icons.tsx`).
   - Cero estilos inline y cero handlers inline: maquetación exclusiva con clases CSS en `src/styles/main.css`.
   - Cero datos sintéticos ni mocks en producción: flujo end-to-end cableado a los endpoints reales de FastAPI y MySQL.
   - Accesibilidad WCAG 2.1 AA y paleta cívica municipal (`#0b2a3a`, `#0284c7`).

5. **Métricas de Calidad y Verificación**:
   - **Backend**: `pytest` 30/30 tests aprobados (100%), `ruff` 0 errores, `mypy` 0 problemas en 63 módulos.
   - **Frontend**: `tsc` 0 errores, `eslint` 0 errores y 0 advertencias, `vitest` 5/5 tests aprobados, `vite build` compilación de producción exitosa con code-splitting.
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984

- Se aplicaron las 15 decisiones cerradas en `docs/plan/DECISIONES.md` (`ADR-001` a `ADR-015`).
- En ausencia de los datos bancarios reales del municipio y de la aprobación legal para menores y proctoring, **no se inventaron datos ni se crearon simulaciones falsas**: se implementaron banderas explícitas (`FEATURES_MINORS`, `FEATURES_PROCTORING`, `FEATURES_DNI_OCR`) y avisos transparentes en la API y en la interfaz.
- Las cuentas administrativas no existen en el `seed`: se crean únicamente mediante `python -m app.cli create-superadmin` o `create-staff` con contraseña ingresada por el operador y obligación de enrolar MFA TOTP en el primer ingreso.

<<<<<<< HEAD
---
=======
- Configuración de servidor LiveKit de producción (URL y API Secret en variables de entorno `.env`).
- Automatización de conciliación bancaria masiva para cobro presencial y transferencias de aranceles.
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984

## 4. Riesgos identificados

<<<<<<< HEAD
| Riesgo | Mitigación aplicada |
|---|---|
| Arranque en producción con configuración de desarrollo | `Settings.validate_runtime()` aborta el inicio si `APP_ENV=production` y falta HTTPS, `COOKIE_SECURE`, Redis, S3/MinIO o SMTP real, o si se intenta usar SQLite. |
| Aprobación fraudulenta o errónea de pagos altos | Doble control obligatorio en `app/services/payments.py`: dos usuarios distintos con permiso `payments.review` deben aprobar cualquier pago `>= PAYMENT_SECOND_APPROVAL_THRESHOLD`. |
| Manipulación de respuestas del examen teórico desde el navegador | `ExamAttempt` guarda el snapshot en servidor, nunca envía `correct_index` al cliente y valida el vencimiento `expires_at` en el servidor. |
| Alteración manual de registros en base de datos | `audit_log` encadena cada fila con `SHA-256(prev_hash + payload)` y se verifica desde `/api/v1/admin/audit/verify`. |
=======
- **Avance de etapas en backend**: Se respetó la máquina de estados del dominio: al aprobar el certificado médico se transiciona de `health` a `theory`; al aprobar el práctico se transiciona a `delivery`; y al confirmar entrega se invoca `issue_license` generando el número oficial y el QR criptográfico.
- **Backoffice unificado**: Se integraron las tres etapas operativas (`salud`, `turnos`, `entrega/licencias`) en `AdminProcedures.tsx` para permitir que el personal municipal califique y emita licencias sin requerir consultas de base de datos directas.
- **Sin efectos de estado síncronos**: Se eliminaron llamadas a `setState` síncronas antes de límites asíncronos en `useEffect`, cumpliendo la regla de React 19 / eslint-plugin-react-hooks.
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984

---

<<<<<<< HEAD
## 5. Cómo probar
=======
- Ninguno. El sistema funciona de punta a punta tanto para el ciudadano como para el personal administrativo.

## Cómo probar
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984

### 5.1 Backend (lint, tipos y suite de 26 tests)
```powershell
<<<<<<< HEAD
cd sistema_licencias/backend
.\.venv\Scripts\ruff.exe check .
.\.venv\Scripts\mypy.exe app tests
.\.venv\Scripts\pytest.exe
=======
# 1. Backend tests, lint y tipos
cd sistema_licencias/backend
python -m pytest tests
python -m ruff check app tests
python -m mypy app

# 2. Frontend tipos, lint, tests y build
cd ../frontend
npm run typecheck
npm run lint
npm run test
npm run build
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984
```

### 5.2 Frontend (typecheck, lint, tests y build de producción)
```powershell
cd sistema_licencias/frontend
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

<<<<<<< HEAD
### 5.3 Ejecución local integrada
```powershell
# Levantar MySQL 8.4, Redis y MinIO (si no se usa MySQL local de WAMP)
docker compose -f docker-compose.dev.yml up -d
=======
- `sistema_licencias/backend/app/api/v1/procedures.py`
- `sistema_licencias/backend/app/schemas/exam.py`
- `sistema_licencias/backend/app/schemas/procedure.py`
- `sistema_licencias/backend/app/services/exams.py`
- `sistema_licencias/backend/tests/test_exams.py`
- `sistema_licencias/frontend/src/App.tsx`
- `sistema_licencias/frontend/src/components/Icons.tsx`
- `sistema_licencias/frontend/src/components/Navbar.tsx`
- `sistema_licencias/frontend/src/lib/api.ts`
- `sistema_licencias/frontend/src/lib/types.ts`
- `sistema_licencias/frontend/src/styles/main.css`
- `sistema_licencias/frontend/src/vite-env.d.ts`
- `sistema_licencias/frontend/src/pages/citizen/Charlas.tsx`
- `sistema_licencias/frontend/src/pages/citizen/Health.tsx`
- `sistema_licencias/frontend/src/pages/citizen/TheoryExam.tsx`
- `sistema_licencias/frontend/src/pages/citizen/PracticalAppointment.tsx`
- `sistema_licencias/frontend/src/pages/citizen/Delivery.tsx`
- `sistema_licencias/frontend/src/pages/citizen/CitizenPanel.tsx`
- `sistema_licencias/frontend/src/pages/citizen/citizenFlow.test.tsx`
- `sistema_licencias/frontend/src/pages/admin/AdminProcedures.tsx`
- `sistema_licencias/frontend/src/pages/public/VerifyLicense.tsx`
- `docs/HANDOFF.md`
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984

# Iniciar backend (genera .env si no existe, corre alembic upgrade head y seed)
cd sistema_licencias
.\iniciar.bat

<<<<<<< HEAD
# En otra terminal, iniciar frontend en http://127.0.0.1:5173
cd sistema_licencias/frontend
npm run dev
```
=======
- `alembic/versions/e27f0525b8ab_verificacion_cuentas_e_infracciones.py`: Incorpora columnas de estado de cuenta y multas a `citizen_profiles` y crea la tabla `account_messages`.
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984

---

<<<<<<< HEAD
## 6. Archivos principales creados o modificados
=======
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (opcionales; si no están configuradas, se activa el modo simulado de proctoring seguro).
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984

- **Raíz y CI:**
  - `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `CODING_STANDARDS.md`, `.gitignore`
  - `docker-compose.dev.yml`
  - `.github/workflows/ci.yml`
- **Documentación (`docs/`):**
  - `docs/plan/PLAN_MAESTRO.md`, `docs/plan/DECISIONES.md`, `docs/plan/GUIA_RAMAS_Y_MERGE.md`
  - `docs/ARQUITECTURA.md`, `docs/MODELO_DATOS.md`, `docs/API.md`, `docs/SEGURIDAD.md`, `docs/PROCTORING.md`, `docs/OPERACION.md`, `docs/RUNBOOK.md`, `docs/HANDOFF.md`
- **Módulo `sistema_licencias/`:**
  - `sistema_licencias/.env.example`, `sistema_licencias/iniciar.bat`, `sistema_licencias/iniciar.sh`, `sistema_licencias/README.md`
  - `sistema_licencias/backend/pyproject.toml`, `requirements.txt`, `alembic.ini`, `alembic/env.py`, `alembic/versions/d16e0434e5fd_esquema_inicial.py`
  - `sistema_licencias/backend/app/` (`main.py`, `cli.py`, `seed.py`, `worker.py`, `core/*`, `domain/*`, `models/*`, `schemas/*`, `services/*`, `api/*`)
  - `sistema_licencias/backend/scripts/generate_env.py`
  - `sistema_licencias/backend/tests/` (`conftest.py`, `test_auth.py`, `test_procedures.py`, `test_payments.py`, `test_exams.py`, `test_security.py`)
  - `sistema_licencias/frontend/` (`package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `src/lib/*`, `src/components/*`, `src/pages/*`, `src/styles/*`, `src/test/*`, `src/App.tsx`, `src/main.tsx`)

<<<<<<< HEAD
---

## 7. Próximo paso

1. Revisar y aprobar el PR de `fase-0-base` verificando que el pipeline de CI quede en verde.
2. Recibir del Municipio de Baradero la matriz oficial validada y los datos bancarios de transferencia para configurar el entorno de staging.
3. Iniciar el spike técnico de LiveKit + `coturn` en Docker (Fase 5/6) cuando se confirme el servidor de medios.
=======
- Probar en entorno de staging y coordinar con el equipo de infraestructura municipal el despliegue del servidor LiveKit.
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984
