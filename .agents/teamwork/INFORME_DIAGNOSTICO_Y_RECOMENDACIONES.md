# INFORME FINAL DE DIAGNÓSTICO, CORRELACIÓN Y RECOMENDACIONES — SISTEMA DE LICENCIAS BARADERO (`TramitesBAR`)

**Fecha:** 3 de Noviembre de 2026
**Alcance:** Evaluación integral de los 5 paneles administrativos, los 7 pasos del trámite ciudadano (Licencia Nueva y Renovación), el circuito de verificación de infracciones de tránsito (multas), la correlación Frontend-Backend y las mejoras de eficiencia y seguridad.

---

## 1. RESUMEN EJECUTIVO Y RESULTADOS DE PRUEBAS

Se ejecutó una auditoría técnica y funcional completa sobre el sistema `TramitesBAR` (Frontend SPA Vanilla JS + Backend Flask + SQLite), seguida de la remediación de todos los defectos críticos y brechas de correlación detectadas.

| Suite de Verificación | Pruebas Ejecutadas | Aprobadas | Fallidas | Estado Final |
| :--- | :---: | :---: | :---: | :---: |
| **Suite Integral E2E (`worker_m1/test_all_panels_and_flow.py`)** | 67 | **67** | 0 | ✅ **100% PASS** |
| **Suite de Multas y Seguridad (`explorer_survey_2/verify_fines_flow.py`)** | 28 | **28** | 0 | ✅ **100% PASS** |
| **Chequeo de Sintaxis JS (`node --check`) y Python (`py_compile`)** | 18 archivos | **18** | 0 | ✅ **100% PASS** |

---

## 2. VERIFICACIÓN DE CORRELACIÓN DE LOS 5 PANELES ADMINISTRATIVOS Y PASOS DEL TRÁMITE (R1)

Se comprobó que cada acción ejecutada en los paneles administrativos impacta en tiempo real sobre la máquina de estados del trámite ciudadano (`tramites.paso_actual`) y su visualización en el portal:

1. **Panel 1 — Administración de Cuentas e Infracciones (`admin_cuentas` / `admin-cuentas.js` ↔ `/api/admin/cuentas/*`)**:
   - Lista ciudadanos por estado (`todos`, `pendiente`, `aprobada`, `rechazada_multas`, `papelera`) con KPIs en vivo y contador de mensajes no leídos.
   - Permite consultar el expediente completo, copiar el DNI con un clic y abrir el portal oficial de **Infracciones BA** (`https://infraccionesba.gba.gob.ar/consulta-infraccion`).
   - Al **Rechazar por Multas**, actualiza `estado_cuenta = 'rechazada_multas'`, guarda `multas_cantidad`, `multas_monto` y `multas_motivo`, y envía automáticamente un mensaje al ciudadano en `inbox_cuentas`.
   - Al **Aprobar Cuenta**, cambia `estado_cuenta = 'aprobada'`, limpia las multas (`0` / `$0.0`) y habilita al ciudadano para iniciar los pasos del trámite.
   - Soporta envío a **Papelera** y **Restauración / Alta** sin pérdida de historial.

2. **Panel 2 — Administración de Salud (`admin_salud` / `admin-salud.js` ↔ `/api/admin/salud/*`)**:
   - Recibe la Declaración Jurada (DDJJ) de salud y el certificado médico del Paso 2 (`formularios`).
   - Si el profesional **Aprueba** el formulario:
     - En trámite de **Licencia Nueva**, avanza automáticamente `paso_actual` de `'formularios'` a `'examen'`.
     - En trámite de **Renovación**, avanza automáticamente `paso_actual` de `'formularios'` a `'pago'` (omitiendo charlas y examen teórico según normativa PBA).
   - Si **Rechaza** con observaciones clínicas, el ciudadano visualiza el motivo en `formularios.js` y puede volver a presentar la documentación.

3. **Panel 3 — Claustro Docente / Profesores (`admin_profesores` / `admin-profesores.js` ↔ `/api/admin/config-examen`, `/api/admin/preguntas`, `/api/admin/examen/*`)**:
   - Permite configurar las 3 modalidades de evaluación teórica (`plantilla`, `personalizado`, `hibrido`), gestionar el banco de preguntas (crear, editar, eliminar, vaciar y restaurar plantilla base) y previsualizar el cuestionario activo.
   - **Monitoreo en Vivo (Proctoring)**: recibe en tiempo real los frames de cámara web (`cam_frame`), captura de pantalla (`screen_frame`), alertas de cambio de pestaña (`warnings_count`), pregunta actual y tiempo transcurrido desde `/api/examen/stream/ping`.
   - Permite **Expulsar en vivo** al alumno por fraude reglamentario o **Dictaminar Aprobado / Desaprobado** con justificación pedagógica y chat directo (`mensajes_profesor`). Al dictaminar aprobado, `paso_actual` avanza a `'pago'`.

4. **Panel 4 — Administración de Pagos (`admin_pagos` / `admin-pagos.js` ↔ `/api/admin/pagos/*`)**:
   - Audita los pagos de arancel municipal (`$12.500`) realizados por transferencia o efectivo/boleta.
   - Al **Aprobar** un pago:
     - En **Licencia Nueva**, avanza `paso_actual` de `'pago'` a `'practico'`.
     - En **Renovación**, emite directamente la **Licencia Digital** (`emitir_licencia_digital`) y avanza `paso_actual` a `'entrega'` con `estado = 'completado'`.

5. **Panel 5 — Administración de Turnos y Biometría (`admin_turnos` / `admin-turnos.js` ↔ `/api/admin/turnos/*`)**:
   - Gestiona las reservas del circuito municipal para el examen práctico de manejo y la captura biométrica presencial.
   - Cuando el evaluador marca **Apto + Biometría (`huella_tomada=1`, `foto_tomada=1`, `resultado_examen='aprobado'`, `estado='completado'`)**, el backend emite automáticamente la **Licencia Digital** con código QR y vigencia según edad PBA (`1`, `3` o `5` años) y avanza el trámite a `'entrega'`.
   - Si el evaluador reprueba el examen práctico (`resultado_examen='reprobado'` / `'desaprobado'`) o rechaza el turno, el ciudadano visualiza el motivo en `practico.js` y queda habilitado para reservar un nuevo turno.

---

## 3. EVALUACIÓN DEL FLUJO DE VERIFICACIÓN DE MULTAS EN EL REGISTRO (R2)

### Cómo funciona el diseño actual
El sistema implementa un modelo de **Auditoría Asistida Semiautomática (Human-in-the-Loop)**:
1. Al registrarse el ciudadano (`POST /api/auth/registro`), su cuenta nace con `estado_cuenta = 'pendiente'`, `multas_cantidad = 0` y `multas_monto = 0.0`.
2. El operador de `admin_cuentas` abre la solicitud, utiliza la herramienta rápida que copia el DNI al portapapeles y abre el portal provincial **Infracciones BA** (`https://infraccionesba.gba.gob.ar/consulta-infraccion`).
3. Si detecta multas, carga la cantidad, el monto total y el detalle; el ciudadano queda bloqueado en su panel con el cartel de **Multas Pendientes**, un botón **"Ya pagué"** para adjuntar el comprobante de pago y un **Inbox de mensajería** bidireccional con el área de Tránsito.
4. Una vez verificado el comprobante, el administrador aprueba la cuenta (`estado_cuenta = 'aprobada'`), destrabando el inicio del trámite.

### Por qué este diseño es acertado (y qué se reforzó)
- **Ventaja operativa**: El portal oficial de Infracciones BA utiliza protección anti-bot (reCAPTCHA) y bloquea ser embebido en `<iframe>` mediante cabeceras `X-Frame-Options` / `CSP`. Por ello, el flujo asistido de un clic + portapapeles evita caídas por cambios en el sitio provincial.
- **Refuerzo de seguridad aplicado**: Originalmente, el bloqueo por multas ocurría únicamente en la interfaz visual (`dashboard.js`), mientras que los endpoints de la API permitían avanzar si se los invocaba directamente. Se reforzó `@token_required` en `backend/app.py` y `Router.render` en `frontend/js/app.js` para bloquear con `HTTP 403` cualquier intento de avance de trámite mientras la cuenta tenga multas pendientes.

---

## 4. DEFECTOS CORREGIDOS DURANTE LA AUDITORÍA

| # | Severidad | Componente | Descripción del Problema | Solución Aplicada |
| :---: | :---: | :--- | :--- | :--- |
| **1** | **CRÍTICA** | `backend/app.py` (`emitir_licencia_digital`) | `NameError: name 'qr_data' is not defined` al emitir la credencial digital en todos los flujos (Licencia Nueva, Renovación y Demo). | Se definió `qr_data` como JSON estructurado con DNI, titular, categoría `B1`, vencimiento y municipio antes del `INSERT INTO licencias`. |
| **2** | **ALTA** | `backend/app.py` (`token_required`) | Usuarios con `estado_cuenta = 'rechazada_multas'` o `'papelera'` podían saltear el bloqueo del frontend invocando directamente los endpoints de trámite. | Se agregó validación en `@token_required` que devuelve `HTTP 403` en todos los endpoints de avance de trámite si la cuenta está en `rechazada_multas` o `papelera`. |
| **3** | **ALTA** | `backend/app.py` (`puede_acceder_paso`) | La función `puede_acceder_paso` tenía un `return True` hardcodeado que permitía ejecutar pasos fuera de orden vía API. | Se implementó la validación secuencial real (`idx_solicitado <= idx_actual`) sobre el orden de pasos del trámite. |
| **4** | **ALTA** | `backend/app.py` (`token_required` / `/api/user/*`) | El token JWT almacena `usuario_id`, pero `/api/user/preferences` y `/api/user/activity` leían `request.user_data['id']`, lanzando `KeyError: 'id'` (`HTTP 500`). | Se normalizó `data['id'] = data['usuario_id']` en `token_required` y se corrigieron las rutas en `frontend/js/app.js`. |
| **5** | **MEDIA** | `frontend/js/pages/practico.js` y `backend/app.py` | `admin-turnos.js` calificaba el examen práctico reprobado con `resultado_examen: 'reprobado'`, pero `practico.js` solo chequeaba `'rechazado'` y `reservar_turno` no permitía re-reservar si `estado == 'completado'`. | Se sincronizaron ambos extremos para reconocer `('rechazado', 'reprobado', 'desaprobado')` tanto en la UI como en la re-reserva de turno. |
| **6** | **MEDIA** | `frontend/js/app.js` (`ConfirmModal`) | `admin-cuentas.js`, `admin-turnos.js` y `admin-profesores.js` pasaban `description` a `ConfirmModal.show`/`prompt`, pero `ConfirmModal` solo leía `message`, mostrando diálogos sin texto descriptivo. | Se actualizó `ConfirmModal.show` y `ConfirmModal.prompt` para aceptar `description` o `message` indistintamente. |
| **7** | **BAJA** | `backend/app.py` (`__main__`) y `frontend/js/api.js` | El aviso rojo de servidor de desarrollo de Flask confundía al usuario al iniciar `iniciar_servidor.bat` y no abría el navegador automáticamente. | Se filtró el warning de desarrollo, se agregó auto-apertura de `http://localhost:5000` y se hizo dinámico `API_BASE`. |

---

## 5. RECOMENDACIONES DE EFICIENCIA Y ARQUITECTURA PARA PRODUCCIÓN (R3)

1. **Desactivar Auto-Aprobación por Defecto en Formularios de Salud (`enviar_formularios`)**:
   - Actualmente `formularios.js` envía la DDJJ sin el campo `estado`, y `backend/app.py:1076` aplica `estado = data.get('estado', 'aprobado')` para agilizar las pruebas/demos. Cuando se pase a producción municipal real, cambiar el valor por defecto a `'pendiente'` para que toda DDJJ requiera obligatoriamente la firma de `admin_salud`.
2. **Restringir el Endpoint de Demo (`/api/tramite/saltar-paso`) por Variable de Entorno**:
   - Proteger `/api/tramite/saltar-paso` detrás de una bandera `DEMO_MODE = os.environ.get('DEMO_MODE', '1') == '1'` para poder desactivarlo limpiamente en producción sin modificar código.
3. **Almacenamiento de Archivos en Disco / Object Storage en lugar de Base64 en SQLite**:
   - Actualmente las fotos de rostro, comprobantes de pago/multas y frames de streaming se guardan como Data URLs Base64. Para escalar a miles de trámites anuales sin inflar `licencias.db`, guardar los adjuntos en una carpeta `/uploads` servida de forma autenticada y almacenar únicamente la ruta en SQLite.
4. **Servidor WSGI de Producción**:
   - En despliegue municipal definitivo sobre Windows Server o Linux, ejecutar la aplicación detrás de `waitress` (Windows) o `gunicorn` (Linux) para soportar múltiples operadores concurrentes y streaming de monitoreo de exámenes sin bloquear hilos.
