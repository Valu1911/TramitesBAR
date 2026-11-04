# Handoff — TramitesBAR

Este archivo se actualiza al terminar cada tanda de trabajo. Sirve para que la próxima persona o agente sepa dónde quedó todo sin adivinar.

---

## Fecha

2026-11-04

## Rama

`fase-0-base`

## Responsable

Senior Architect / Antigravity Agent & Frontend Subagents

## Qué se hizo

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

## Qué falta

- Configuración de servidor LiveKit de producción (URL y API Secret en variables de entorno `.env`).
- Automatización de conciliación bancaria masiva para cobro presencial y transferencias de aranceles.

## Decisiones tomadas

- **Avance de etapas en backend**: Se respetó la máquina de estados del dominio: al aprobar el certificado médico se transiciona de `health` a `theory`; al aprobar el práctico se transiciona a `delivery`; y al confirmar entrega se invoca `issue_license` generando el número oficial y el QR criptográfico.
- **Backoffice unificado**: Se integraron las tres etapas operativas (`salud`, `turnos`, `entrega/licencias`) en `AdminProcedures.tsx` para permitir que el personal municipal califique y emita licencias sin requerir consultas de base de datos directas.
- **Sin efectos de estado síncronos**: Se eliminaron llamadas a `setState` síncronas antes de límites asíncronos en `useEffect`, cumpliendo la regla de React 19 / eslint-plugin-react-hooks.

## Riesgos y bloqueos

- Ninguno. El sistema funciona de punta a punta tanto para el ciudadano como para el personal administrativo.

## Cómo probar

```powershell
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
```

## Archivos tocados

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

## Migraciones

- `alembic/versions/e27f0525b8ab_verificacion_cuentas_e_infracciones.py`: Incorpora columnas de estado de cuenta y multas a `citizen_profiles` y crea la tabla `account_messages`.

## Variables de entorno nuevas

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (opcionales; si no están configuradas, se activa el modo simulado de proctoring seguro).

## Próximo paso

- Probar en entorno de staging y coordinar con el equipo de infraestructura municipal el despliegue del servidor LiveKit.
