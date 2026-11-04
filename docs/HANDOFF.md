# Handoff — TramitesBAR

Este archivo se actualiza al terminar cada tanda de trabajo. Sirve para que la próxima persona o agente sepa dónde quedó todo sin adivinar.

---

## Fecha

2026-11-03

## Rama

`fase-0-base`

## Responsable

Senior Architect / Antigravity Agent & Frontend Subagent

## Qué se hizo

Consolidación completa de **Fase 0: Gestión de Usuarios, Autenticación y Auditoría de Antecedentes Viales (`admin_cuentas`)**, coordinando en paralelo backend y frontend:

1. **Backend Domain & Persistence**:
   - `app/domain/enums.py`: Se incorporó el enum `AccountStatus` (`pendiente`, `aprobada`, `rechazada_multas`, `papelera`).
   - `app/models/user.py`: Se agregaron los campos `account_status`, `fines_count`, `fines_amount`, `fines_reason`, `fines_reviewed_at`, `fines_payment_claimed`, `welcome_dismissed` a `CitizenProfile`. Se creó la entidad `AccountMessage` para el canal bidireccional ciudadano-tránsito.
   - `alembic/versions/e27f0525b8ab_verificacion_cuentas_e_infracciones.py`: Migración con `upgrade` y `downgrade` completos para MySQL 8.4 y SQLite.
2. **Backend Schemas & Serializers**:
   - `app/schemas/auth.py`: `ProfileOut` actualizado; schemas para reclamo de pago de multas y mensajería (`ClaimFinesPaymentIn`, `AccountMessageIn`, `AccountMessageOut`).
   - `app/schemas/admin.py`: Schemas para `admin_cuentas` (`CitizenAccountSummaryOut`, `AccountKpiOut`, `AccountListOut`, `AccountDetailOut`, `RejectFinesIn`, `AdminAccountMessageIn`).
   - `app/services/serializers.py`: Serialización segura tipada para expedientes con DNI descifrado bajo permiso y máscara pública.
3. **Backend Security Gates & Endpoints**:
   - `app/services/procedures.py`: Blindaje en `create_procedure` para rechazar con HTTP 403 (`fines_pending` o `account_pending_verification`) si la cuenta no tiene `AccountStatus.APPROVED`.
   - `app/api/v1/admin.py`: Endpoints para `admin_cuentas` (`GET /admin/accounts`, `GET /admin/accounts/{id}`, `POST /admin/accounts/{id}/approve`, `POST /admin/accounts/{id}/reject-fines`, `POST /admin/accounts/{id}/trash`, `POST /admin/accounts/{id}/restore`, `POST /admin/accounts/{id}/messages`).
   - `app/api/v1/auth.py`: Endpoints ciudadanos para notificar pago (`POST /auth/account/notify-paid`), consultar y enviar mensajes (`GET/POST /auth/account/messages`) y descartar bienvenida (`POST /auth/account/welcome-dismiss`).
4. **Frontend (React 19 + TypeScript + Vite)**:
   - Desplegado mediante subagente en paralelo, cumpliendo con la guía de estilo municipal de Baradero (`#0b2a3a`, `#0284c7`) y WCAG 2.1 AA.
   - Cero emojis: 22+ iconos SVG dedicados en `src/components/Icons.tsx`.
   - Generador offline de QR en SVG para enrolamiento MFA en `src/lib/qr.ts`.
   - `AuthContext` con soporte de cookies de sesión, CSRF double-submit y roles.
   - Vistas ciudadanas: `Login`, `Register`, `ForgotPassword`, `ResetPassword`, `VerifyEmail`, `Profile`, `CitizenPanel` (con banners según estado de cuenta, aviso de multas y diálogo de "Ya pagué").
   - Vistas operativas: `AdminLogin`, `AdminAccounts` (KPIs en vivo, tabs por estado, búsqueda reactiva, copiado de DNI al portapapeles para consulta en Infracciones BA, modal de rechazo con multas y mensajería en tiempo real).
5. **Verificación y Calidad de Código**:
   - `pytest`: 28 tests pasando (100% exitosos, incluyendo circuito completo en `tests/test_account_verification.py`).
   - `ruff`: 0 errores de linting.
   - `mypy`: 0 errores de tipos en los 63 archivos del backend.
   - Frontend `npm run typecheck`, `npm run lint` y `npm run build`: 0 errores, 0 warnings.

## Qué falta

- **Fase 1**: Módulo de charlas viales obligatorias (reproducción secuencial con telemetría anti-adelanto) y módulo de examen teórico con proctoring (LiveKit).
- **Fase 2**: Integración de pagos con conciliación bancaria y aranceles configurables.

## Decisiones tomadas

- **Integración con Infracciones BA**: El portal oficial provincial (`infraccionesba.gba.gob.ar`) no admite incrustación en `iframe` (CSP `frame-ancestors 'none'` y `X-Frame-Options: DENY`) y cuenta con reCAPTCHA. Se diseñó el flujo asistido con copiado de DNI en 1 clic y apertura en pestaña externa para máxima velocidad del operador.
- **Enforcement en el dominio**: El bloqueo de usuarios con multas no se confía únicamente a la interfaz de usuario; se validó a nivel de servicio de dominio en `procedures.create_procedure`.
- **MFA obligatorio para staff**: Los tests de integración ahora prueban el circuito con `mfa_enabled=True` y resolución de código TOTP con desfase seguro.

## Riesgos y bloqueos

- Ninguno. La base de Fase 0 está consolidada, testeada y lista para integración.

## Cómo probar

```powershell
# 1. Backend tests, lint y tipos
cd sistema_licencias/backend
python -m pytest tests
python -m ruff check .
python -m mypy app

# 2. Frontend tipos, lint y build
cd ../frontend
npm run typecheck
npm run lint
npm run build
```

## Archivos tocados

- `sistema_licencias/backend/app/domain/enums.py`
- `sistema_licencias/backend/app/models/user.py`
- `sistema_licencias/backend/app/models/__init__.py`
- `sistema_licencias/backend/alembic/versions/e27f0525b8ab_verificacion_cuentas_e_infracciones.py`
- `sistema_licencias/backend/app/schemas/admin.py`
- `sistema_licencias/backend/app/schemas/auth.py`
- `sistema_licencias/backend/app/services/serializers.py`
- `sistema_licencias/backend/app/services/procedures.py`
- `sistema_licencias/backend/app/api/v1/admin.py`
- `sistema_licencias/backend/app/api/v1/auth.py`
- `sistema_licencias/backend/tests/conftest.py`
- `sistema_licencias/backend/tests/test_account_verification.py`
- `sistema_licencias/frontend/src/` (todas las vistas de auth, panel ciudadano y admin de cuentas)
- `sistema_licencias/README.md`
- `sistema_licencias/iniciar.bat`
- `sistema_licencias/iniciar_frontend.bat`
- `docs/HANDOFF.md`

## Migraciones

- `alembic/versions/e27f0525b8ab_verificacion_cuentas_e_infracciones.py`: Incorpora columnas de estado de cuenta y multas a `citizen_profiles` y crea la tabla `account_messages`.

## Variables de entorno nuevas

- Ninguna obligatoria adicional. Utiliza las claves ya definidas (`SESSION_COOKIE_NAME`, `CSRF_COOKIE_NAME`, `DNI_HMAC_KEY`, `APP_SECRET_KEY`).

## Próximo paso

- Proceder con la implementación de **Fase 1** (Charlas de educación vial obligatorias secuenciales y examen teórico) de acuerdo a `docs/plan/PLAN_MAESTRO.md`.
