# Project: TramitesBAR — Auditoría Integral de Paneles, Flujo de Trámites y Control de Multas

## Architecture
- **Monolito Desacoplado**: Flask 3 REST API (`sistema_licencias/backend/app.py`), Vanilla JS SPA (`sistema_licencias/frontend/`), SQLite 3 con WAL (`sistema_licencias/database/licencias.db`).
- **Autenticación**: JWT (`PyJWT`) con roles `usuario` y `admin` (subroles: `cuentas`, `salud`, `pagos`, `turnos`, `profesores`).
- **Paneles de Administración**:
  1. `admin_cuentas`: Auditoría de DNI, antecedentes de tránsito e infracciones, inbox oficial, aprobación de cuentas y papelera.
  2. `admin_salud`: Declaraciones juradas de salud, antecedentes psicofísicos, certificados médicos adjuntos y dictamen de Apto Médico.
  3. `admin_pagos`: Aranceles municipales ($12.500), transferencias/débito, comprobantes y validación fiscal.
  4. `admin_turnos`: Agenda de turnos prácticos en circuito, examen práctico, registro de huella dactilar y captura de foto carnet oficial.
  5. `admin_profesores`: Configuración de exámenes teóricos, banco de preguntas, monitoreo en vivo (WebRTC/Canvas Ping), proctoring anti-fraude y dictámenes.
- **Flujo de Trámite del Ciudadano**:
  - *Licencia Nueva*: Registro/Verificación Cuentas -> Paso 1 (Videos charlas) -> Paso 2 (Formularios salud) -> Paso 3 (Examen teórico) -> Paso 4 (Pago) -> Paso 5 (Turno práctico & biometría) -> Paso 6 (Entrega) -> Paso 7 (Licencia digital emitada).
  - *Renovación*: Registro/Verificación -> Formularios de salud -> Pago -> Entrega / Licencia digital emitida.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Registro de Ciudadano | Alta con DNI, datos personales, CUD y generación de JWT | M2 | Survey (app.py:273) |
| 2 | Verificación de Multas en Alta | Comprobación de multas en alta / directivas de admin cuentas | M2 | Survey (app.py:310, dashboard.js) |
| 3 | Panel Admin Cuentas - Pendientes | Listado y expediente de ciudadanos pendientes | M1 | Survey (admin-cuentas.js) |
| 4 | Panel Admin Cuentas - Rechazo Multas | Asignación de cantidad, monto, motivo de infracción y notificación | M2 | Survey (app.py:2061) |
| 5 | Panel Admin Cuentas - Notificación "Ya Pagué" | Envío y recepción de comprobante de pago de multas | M2 | Survey (app.py:2140) |
| 6 | Panel Admin Cuentas - Aprobación | Aprobación de cuenta y habilitación para iniciar trámites | M2 | Survey (app.py:2034) |
| 7 | Inbox de Cuentas / Mensajería | Comunicación bidireccional entre administración y ciudadano | M1 | Survey (app.py:2172) |
| 8 | Paso 1: Charlas en Video | 4 videos de seguridad vial con tracking de visualización | M1 | Survey (app.py:757) |
| 9 | Paso 2: Declaración Jurada de Salud | Cuestionario psicofísico y carga de certificado médico | M1 | Survey (app.py:1018) |
| 10 | Panel Admin Salud | Auditoría de apto médico y observaciones clínicas | M1 | Survey (app.py:1474) |
| 11 | Paso 3: Examen Teórico | 5 preguntas aleatorias, mínimo 4/5, temporizador, anti-fraude | M1 | Survey (app.py:833) |
| 12 | Panel Admin Profesores | Configuración de examen, gestión de preguntas y monitoreo en vivo | M1 | Survey (app.py:1628) |
| 13 | Paso 4: Pago de Arancel | Selección de método (transferencia, tarjeta, demo) y comprobante | M1 | Survey (app.py:1095) |
| 14 | Panel Admin Pagos | Revisión contable, confirmación o rechazo de pago | M1 | Survey (app.py:1399) |
| 15 | Paso 5: Turno Examen Práctico | Selección de fecha y franja horaria en Circuito Municipal | M1 | Survey (app.py:1210) |
| 16 | Panel Admin Turnos | Toma de huella dactilar, foto carnet y calificación práctica | M1 | Survey (app.py:1547) |
| 17 | Paso 6: Selección de Entrega | Retiro presencial en Dirección de Tránsito o Envío a Domicilio | M1 | Survey (app.py:1330) |
| 18 | Paso 7: Emisión de Licencia Digital | Generación de credencial digital con QR y vigencia legal | M1 | Survey (app.py:176, 1374) |
| 19 | Flujo Abreviado Renovación | Flujo de salud -> pago -> entrega sin charlas ni exámenes | M1 | Survey (tramites-architecture) |
| 20 | Integridad de Máquina de Estados | Enforzamiento secuencial y prevención de saltos de paso | M1 | Survey (app.py:142) |
| 21 | Diagnóstico Integral y Recomendaciones | Informe de fallas, puntos críticos y eficiencia | M3 | ORIGINAL_REQUEST R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Testing Integral de Paneles Admin y Flujo de Trámite | Ejecución de suite de pruebas E2E no destructivas sobre los 5 paneles admin y todas las etapas del trámite (Nueva y Renovación) | Survey completado | IN_PROGRESS |
| M2 | Verificación Estricta de Control de Multas en Alta de Usuario | Validación empírica rigurosa del flujo de multas, directivas de admin cuentas, bloqueo de trámite y vectores de bypass | M1 | PLANNED |
| M3 | Informe de Diagnóstico, Evaluación y Recomendaciones de Eficiencia | Redacción del informe consolidado con estado funcional de cada panel/etapa, puntos críticos y recomendaciones de optimización sin tocar código | M1, M2 | PLANNED |

## Interface Contracts
- **Test Runner Contract**: Las pruebas se ejecutan mediante Python 3 (`C:\Users\PC\AppData\Local\Programs\Python\Python314\python.exe`) utilizando `app.test_client()` contra SQLite o servidor local, alojando los scripts de prueba estrictamente en `.agents/teamwork/`.
- **Database Safety Contract**: Se realiza copia de seguridad previa de `licencias.db` (`licencias.db.audit_backup`). Todos los datos de prueba usan DNIs dinámicos aislados (rango `90000000`-`99999999`) y se limpia la base o se preserva el estado original.
- **Reporting Contract**: El informe final debe cumplir rigurosamente los Acceptance Criteria de ORIGINAL_REQUEST.md sin modificar archivos de código fuente existentes.

## Code Layout
- Backend: `sistema_licencias/backend/app.py`
- Frontend: `sistema_licencias/frontend/` (`js/app.js`, `js/pages/*.js`, `index.html`)
- Base de datos: `sistema_licencias/database/licencias.db`, `schema.sql`
- Tests existentes: `sistema_licencias/test_suite.py`, `sistema_licencias/test_api.py`, `sistema_licencias/test_dni_api_flow.py`
- Metadata de agentes y pruebas de auditoría: `.agents/teamwork/`
