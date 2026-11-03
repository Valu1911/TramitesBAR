# Informe Técnico de Auditoría e Investigación: Alta de Usuario, Control de Multas y Panel Admin Cuentas

**Fecha de Ejecución**: 2026-11-02  
**Módulo / Área**: Sistema de Licencias de Conducir — Municipio de Baradero  
**Investigador / Agente**: `explorer_survey_2`  
**Directorio Base**: `c:\Users\PC\Desktop\marconecangrejodejaderobarenmiclub\TramitesBAR`  
**Modalidad**: Solo Lectura / Diagnóstico e Investigación Técnica (Zero Source Modifications)

---

## 1. Resumen Ejecutivo

El sistema implementa un esquema de alta ciudadana y auditoría de antecedentes viales de **dos etapas**: una etapa inicial de registro libre donde se crea la cuenta en estado `pendiente`, y una etapa secundaria donde el operador del panel `admin_cuentas` consulta externamente la base oficial de **Infracciones BA** y dictamina si la cuenta se aprueba (`aprobada`) o se rechaza por infracciones impagas (`rechazada_multas`).

Desde la perspectiva del **flujo de interfaz de usuario (UI)**, la regla de negocio fundamental se cumple en el panel principal (`dashboard.js`): un usuario con multas registradas ve bloqueada la vista de sus trámites y solo tiene acceso a un panel rojo de regularización con el botón *"¡Ya Pagué!"* y el Inbox con el Municipio.

Sin embargo, desde la perspectiva de **seguridad y arquitectura backend**, se detectó una **vulnerabilidad crítica de control de acceso (Broken Access Control - OWASP A01)**: el token JWT emitido al registrarse no valida el `estado_cuenta` en los endpoints operativos de la API (`/api/charlas/marcar-visto`, `/api/examen/preguntas`, `/api/examen/entregar`, `/api/tramite/saltar-paso`), ni el enrutador del frontend (`Router.render`) posee *route guards* para rutas directas (`#charlas`, `#examen`). En consecuencia, **un usuario con multas pendientes puede eludir el bloqueo visual y avanzar o completar etapas del trámite mediante llamadas directas a la API o manipulando el hash de navegación.**

---

## 2. Flujo de Registro y Alta de Usuario

### 2.1 Componente Frontend: Formulario de Alta (`frontend/js/pages/registro.js`)
* **Ubicación**: `c:\Users\PC\Desktop\marconecangrejodejaderobarenmiclub\TramitesBAR\sistema_licencias\frontend\js\pages\registro.js`
* **Campos recolectados**:
  * DNI (7 u 8 dígitos numéricos, filtrado por regex `replace(/\D/g, '')`).
  * Nombre y Apellido (obligatorios).
  * Fecha de nacimiento (`DD/MM/AAAA` formateada a `YYYY-MM-DD`).
  * Email y Teléfono (opcionales).
  * Dirección física en Baradero.
  * Certificado CUD (opcional, con verificación local en UI).
  * Tipo de trámite (`nueva`, `renovacion`, `vencida`, `categoria`, `profesional`, `extravio`).
  * Contraseña (mínimo 6 caracteres).
  * Foto de perfil / rostro extraído del DNI (`foto_rostro` vía `DniScanner`).
* **Lógica de envío**: El método `handleSubmit` (líneas 285-364) recopila la carga útil y ejecuta `ApiService.registro(formData)`. **No realiza ninguna validación previa de antecedentes o multas en el cliente.**

### 2.2 Endpoint Backend: Registro Ciudadano (`backend/app.py:272-350`)
* **Ruta**: `POST /api/auth/registro`
* **Validaciones del Servidor**:
  1. Longitud y formato del DNI (`7 <= len(dni) <= 8 and dni.isdigit()`, línea 277). Retorna HTTP 400 si es inválido.
  2. Unicidad del DNI (`SELECT id FROM usuarios WHERE dni=?`, línea 280). Retorna HTTP 409 si ya existe.
  3. Obligatoriedad de Nombre y Apellido (línea 298). Retorna HTTP 400.
  4. Longitud de contraseña (`len(password) >= 6`, línea 304). Retorna HTTP 400.
* **Persistencia Inicial**:
  Inserta al usuario en la tabla `usuarios` (líneas 309-313):
  ```sql
  INSERT INTO usuarios (
      dni, nombre, apellido, email, telefono, fecha_nacimiento, direccion,
      tiene_cud, numero_cud, password_hash, foto_rostro, dni_frente, dni_dorso,
      estado_cuenta, multas_cantidad, multas_monto, multas_motivo,
      bienvenida_mostrada, infracciones_pagadas_solicitadas
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', 0, 0.0, '', 0, 0)
  ```
* **Creación de Trámite y Token**:
  * Inserta un registro en `tramites` (`usuario_id`, `tipo`, `paso_actual = 'charlas'` o `'formularios'`, línea 318).
  * Emite un token JWT con expiración de 24 horas que contiene `{'usuario_id': user_id, 'dni': dni, 'tipo': 'usuario', 'tramite_id': tramite_id}` (línea 322).
  * Retorna HTTP 201 con los datos del usuario y token.

---

## 3. Mecanismo de Verificación de Multas e Infracciones

### 3.1 Modelo de Datos en Base de Datos (`database/schema.sql`)
La tabla `usuarios` administra los campos de control de infracciones:
| Campo | Tipo | Valor por Defecto | Descripción |
|---|---|---|---|
| `estado_cuenta` | `TEXT` | `'pendiente'` | Estados: `'pendiente'`, `'aprobada'`, `'rechazada_multas'`, `'papelera'` |
| `multas_cantidad` | `INTEGER` | `0` | Número de infracciones detectadas |
| `multas_monto` | `REAL` | `0.0` | Importe total liquidado de las multas adeudadas |
| `multas_motivo` | `TEXT` | `''` | Descripción oficial del motivo / juzgado interviniente |
| `multas_fecha_revision` | `TEXT` | `NULL` | Timestamp de la última auditoría administrativa |
| `infracciones_pagadas_solicitadas` | `INTEGER` | `0` | Indicador de si el ciudadano presionó "¡Ya Pagué!" |

Adicionalmente, la tabla `inbox_cuentas` almacena la correspondencia bidireccional y comprobantes adjuntos entre el área de Tránsito (`admin_cuentas`) y el ciudadano.

### 3.2 Panel de Control: Admin Cuentas (`admin-cuentas.js` y `backend/app.py:1958-2115`)
El operador administrativo con rol `cuentas` dispone de una vista especializada:
* **KPIs en tiempo real**: Muestra contadores de expedientes: `Total Solicitudes`, `Pendientes Auditoría`, `Con Infracciones`, `Cuentas Aprobadas` y `Papelera`.
* **Filtros por pestaña**: Permite segmentar usuarios según su `estado_cuenta`.
* **Expediente Ciudadano y Auditoría de Infracciones**:
  Al abrir una solicitud, el modal (`AdminCuentasPage.abrirModalVerificacion`, línea 221) presenta:
  1. Barra de asistencia rápida con el DNI del postulante y botón de copiado al portapapeles.
  2. Enlace directo a la plataforma provincial oficial: `https://infraccionesba.gba.gob.ar/consulta-infraccion`.
  3. Guía operativa para el operador:
     * Si no registra multas en el sistema provincial $\rightarrow$ Presionar **"Aprobar Cuenta (Sin Multas)"**.
     * Si registra multas impagas $\rightarrow$ Presionar **"Rechazar por Multas"**.

### 3.3 Endpoints Administrativos de Control de Multas
1. **Rechazo por Multas**: `POST /api/admin/cuentas/<int:user_id>/rechazar` (`app.py:2061-2093`)
   * Recibe `{cantidad_multas, monto_total, mensaje}`.
   * Ejecuta:
     ```sql
     UPDATE usuarios 
     SET estado_cuenta='rechazada_multas', multas_cantidad=?, multas_monto=?, 
         multas_motivo=?, infracciones_pagadas_solicitadas=0,
         multas_fecha_revision=datetime('now','localtime'), updated_at=datetime('now','localtime')
     WHERE id=?
     ```
   * Inserta un mensaje automático en `inbox_cuentas` notificando el monto exacto y solicitando regularización.
2. **Aprobación de Cuenta (Sin Multas)**: `POST /api/admin/cuentas/<int:user_id>/aprobar` (`app.py:2034-2059`)
   * Ejecuta:
     ```sql
     UPDATE usuarios 
     SET estado_cuenta='aprobada', multas_cantidad=0, multas_monto=0.0, 
         multas_motivo='', infracciones_pagadas_solicitadas=0, bienvenida_mostrada=0,
         multas_fecha_revision=datetime('now','localtime'), updated_at=datetime('now','localtime')
     WHERE id=?
     ```
   * Envía un mensaje formal de confirmación y bienvenida al Inbox del ciudadano.
3. **Mover a Papelera**: `POST /api/admin/cuentas/<int:user_id>/mover-papelera` (`app.py:2095-2104`) $\rightarrow$ Pasa a `estado_cuenta='papelera'`.
4. **Dar de Alta / Restaurar**: `POST /api/admin/cuentas/<int:user_id>/dar-alta` (`app.py:2106-2115`) $\rightarrow$ Pasa a `estado_cuenta='aprobada'`.

---

## 4. Experiencia del Ciudadano y Ciclo "¡Ya Pagué!"

En `frontend/js/pages/dashboard.js`, la visualización se bifurca según `estado_cuenta`:

1. **Estado `pendiente` (Verificación Inicial, líneas 50-91)**:
   * Exhibe una tarjeta amarilla con ícono de reloj: *"Tu cuenta está en proceso de verificación. Nuestro equipo de Tránsito e Infracciones está revisando tus antecedentes e identidad en las bases oficiales. Mientras tanto, el acceso a los trámites permanece temporalmente reservado."*
   * Oculta completamente el catálogo de trámites y la barra de pasos.
2. **Estado `rechazada_multas` (Multas Pendientes, líneas 96-163)**:
   * Exhibe una tarjeta roja de alerta máxima: *"Tienes Multas Pendientes. Se detectaron infracciones impagas asociadas a tu DNI."*
   * Muestra el número de infracciones registradas y el monto total en pesos con formato regional (`$XX.XXX,XX`).
   * Proporciona el botón verde **"¡Ya Pagué! Adjuntar Comprobante $\rightarrow$"**, el cual abre el Inbox y permite cargar un comprobante en PDF/imagen.
3. **Notificación de Pago**:
   * Endpoint `POST /api/usuario/notificar-ya-pague` (`app.py:2190-2212`).
   * Actualiza `infracciones_pagadas_solicitadas = 1` y genera el registro en `inbox_cuentas`.
   * En el panel de `admin_cuentas`, el usuario aparece con una insignia amarilla destacada: `[🔔 Notificó Pago]`, permitiendo al auditor revisar el comprobante y proceder a la aprobación.

---

## 5. Validación Rigurosa de la Regla de Negocio (Requisito R2)

> **Regla Evaluada**: *"si una persona tiene multas pendientes no se le debe permitir terminar de crear el usuario / completar el alta de usuario."*

### Diagnóstico de Cumplimiento:
* **En el Flujo Administrativo Formal (UI / Proceso de Tránsito)**: **APROBADO CON CONDICIÓN**.  
  El término formal *"alta de usuario"* en la administración municipal corresponde a la activación definitiva de la cuenta (`estado_cuenta = 'aprobada'`). Una persona con multas queda bloqueada en `rechazada_multas`, su expediente se retiene y no puede iniciar trámites desde la interfaz web.
* **En la Capa de Enforzamiento Técnico (Backend & Routing)**: **NO CUMPLE / VULNERABLE**.  
  Técnicamente, el usuario se crea en la base de datos durante la solicitud inicial de registro (`/api/auth/registro`), recibiendo un token JWT válido. El backend **no aplica ningún bloqueo sobre los endpoints del trámite**, lo cual permite un bypass completo si el usuario no depende exclusivamente de la vista principal del dashboard.

---

## 6. Vulnerabilidades Críticas y Brechas Arquitectónicas Detectadas

### 🚨 Brecha 1: Ausencia de Control de Autorización en Endpoints de Trámites (Bypass de Multas)
* **Archivo afectado**: `c:\Users\PC\Desktop\marconecangrejodejaderobarenmiclub\TramitesBAR\sistema_licencias\backend\app.py`
* **Descripción**: El decorador `@token_required` (líneas 50-61) únicamente verifica la firma del token JWT y carga `request.user_data`. Ninguno de los endpoints operativos de la API consulta el campo `estado_cuenta` del usuario en la base de datos.
* **Impacto**: Un usuario en estado `rechazada_multas` puede enviar peticiones HTTP directas a:
  * `POST /api/charlas/marcar-visto` $\rightarrow$ Marca charlas y avanza el trámite.
  * `GET /api/examen/preguntas` y `POST /api/examen/entregar` $\rightarrow$ Rinde el examen teórico.
  * `POST /api/formularios/enviar` $\rightarrow$ Carga ficha médica.
  * `POST /api/pagos/registrar` $\rightarrow$ Registra el pago del arancel.
  * `POST /api/tramite/saltar-paso` $\rightarrow$ Altera el estado del trámite sin restricciones.

### 🚨 Brecha 2: Ausencia de Route Guards en el Enrutador de Frontend SPA
* **Archivo afectado**: `c:\Users\PC\Desktop\marconecangrejodejaderobarenmiclub\TramitesBAR\sistema_licencias\frontend\js\app.js` (líneas 285-323)
* **Descripción**: `Router.render(page)` solo evalúa si existe un token en `ApiService.getToken()`. No verifica si el usuario autenticado tiene `estado_cuenta === 'aprobada'`.
* **Impacto**: Aunque `dashboard.js` bloquee la pantalla inicial, si el usuario escribe en la barra de direcciones `http://localhost:5000/#charlas`, `#formularios` o `#examen`, la SPA renderiza directamente la página del paso correspondiente, puenteando la pantalla de multas.

### ⚠️ Brecha 3: Verificación de Multas Desconectada / Manual
* **Descripción**: No existe una integración programática (API, scraping o webhook) con el servicio de Infracciones BA ni una tabla interna de deudores viales para cotejo síncrono durante el registro.
* **Impacto**: Depende al 100% de la pericia y disponibilidad del operador administrativo de `admin_cuentas`. Un retraso u omisión en la revisión humana permite que cuentas con infracciones queden pendientes de resolución.

### 🐛 Brecha 4: Bug Crítico en Función de Emisión de Licencia Digital
* **Archivo afectado**: `backend/app.py`, línea 176 (`emitir_licencia_digital`)
* **Evidencia**:
  ```python
  lic_id = execute_query(
      """INSERT INTO licencias 
         (usuario_id, tramite_id, numero_licencia, categoria, jurisdiccion, fecha_emision, fecha_vencimiento, estado, foto_rostro, qr_code_data)
         VALUES (?, ?, ?, 'B1', 'Provincia de Buenos Aires - Baradero', ?, ?, 'vigente', ?, ?)""",
      (usuario_id, tramite_id, usuario['dni'], fecha_emision, fecha_vencimiento, foto_rostro, qr_data)
  )
  ```
  La variable `qr_data` **no está definida** dentro del ámbito de la función. Esto desencadena un error no controlado:
  `NameError: name 'qr_data' is not defined (HTTP 500)` cuando un usuario intenta completar el trámite o emitir su credencial.

### ⚠️ Brecha 5: Función de Validación de Pasos Inoperante
* **Archivo afectado**: `backend/app.py`, líneas 142-143:
  ```python
  def puede_acceder_paso(paso_actual, paso_solicitado):
      return True
  ```
  La función que debería impedir que un ciudadano salte de pasos o acceda a pasos fuera de orden está configurada como un `stub` que siempre retorna `True`.

---

## 7. Resultados de Pruebas Empíricas Automatizadas

Para validar de forma fehaciente el comportamiento del sistema, se desarrolló y ejecutó el script de pruebas automatizadas `verify_fines_flow.py` ejecutado sobre Python 3.12 con el cliente de pruebas nativo de Flask.

### Matriz de Resultados

| N° | Caso de Prueba / Escenario | Resultado | Código / Detalle Observado |
|---|---|:---:|---|
| 1 | Registro con DNI inválido (<7 dígitos) | **PASS** | HTTP 400 (`DNI inválido (7 u 8 dígitos)`) |
| 2 | Registro con DNI alfanumérico | **PASS** | HTTP 400 |
| 3 | Registro exitoso de ciudadano válido | **PASS** | HTTP 201, token generado |
| 4 | Asignación de estado inicial de cuenta | **PASS** | `estado_cuenta = 'pendiente'` |
| 5 | Contadores iniciales de multas | **PASS** | `multas_cantidad = 0`, `multas_monto = 0.0` |
| 6 | Rechazo de registro duplicado | **PASS** | HTTP 409 (`Ya existe una cuenta con este DNI`) |
| 7 | Autenticación de operador `admin_cuentas` | **PASS** | HTTP 200, rol `cuentas` verificado |
| 8 | Visibilidad del usuario en bandeja de pendientes | **PASS** | Usuario listado en filtro `pendiente` |
| 9 | Obtención de expediente y detalle en backoffice | **PASS** | HTTP 200 con datos de DNI, teléfono y CUD |
| 10 | Rechazo formal por multas desde el panel admin | **PASS** | HTTP 200, 2 multas por $48.500,50 asignadas |
| 11 | Persistencia en base de datos tras rechazo | **PASS** | `estado_cuenta = 'rechazada_multas'`, motivo guardado |
| 12 | Generación automática de notificación en Inbox | **PASS** | Mensaje formal municipal generado en `inbox_cuentas` |
| 13 | Consulta de progreso del ciudadano con multas | **PASS** | Endpoint `/api/tramite/progreso` refleja `rechazada_multas` |
| 14 | Envío de notificación "¡Ya Pagué!" con comprobante | **PASS** | HTTP 200, mensaje con base64 adjunto |
| 15 | Actualización de bandera de revisión de pago | **PASS** | `infracciones_pagadas_solicitadas = 1` |
| 16 | Consulta del historial de mensajes del Inbox | **PASS** | Historial de mensajes recuperado correctamente |
| 17 | Aprobación de cuenta por admin tras pago verificado | **PASS** | HTTP 200, reseteo de multas a 0 |
| 18 | Persistencia de aprobación en base de datos | **PASS** | `estado_cuenta = 'aprobada'`, multas reseteadas |
| 19 | **[AUDITORÍA SEGURIDAD]** Acceso a videos con multas | **FAIL (VULN)** | HTTP 200: Usuario con multas obtiene videos |
| 20 | **[AUDITORÍA SEGURIDAD]** Avanzar videos con multas | **FAIL (VULN)** | HTTP 200: Usuario con multas marca video como visto |
| 21 | **[AUDITORÍA SEGURIDAD]** Saltar paso con multas | **FAIL (VULN)** | HTTP 200: Usuario con multas salta a `formularios` |
| 22 | **[AUDITORÍA SEGURIDAD]** Acceder a examen con multas | **FAIL (VULN)** | HTTP 200: Usuario con multas recibe preguntas de examen |
| 23 | **[AUDITORÍA SEGURIDAD]** Rendir examen con multas | **FAIL (VULN)** | HTTP 200: Usuario con multas entrega examen teórico |
| 24 | **[AUDITORÍA ESTABILIDAD]** Emisión final de credencial | **FAIL (BUG)** | HTTP 500: `NameError: name 'qr_data' is not defined` |

---

## 8. Recomendaciones de Arquitectura y Remediación

Sin modificar el código existente en esta fase de Survey, se recomienda implementar las siguientes medidas correctivas:

1. **Implementar Decorador Backend de Verificación de Cuenta**:
   Crear un decorador `@cuenta_aprobada_required` en `backend/app.py`:
   ```python
   def cuenta_aprobada_required(f):
       @wraps(f)
       def decorated(*args, **kwargs):
           user_id = request.user_data.get('usuario_id')
           user = execute_query("SELECT estado_cuenta FROM usuarios WHERE id=?", (user_id,), fetch_one=True)
           if not user or user.get('estado_cuenta') != 'aprobada':
               return jsonify({
                   'error': 'Tu cuenta no está aprobada para realizar trámites. Verificá tu estado de multas.',
                   'estado_cuenta': user.get('estado_cuenta') if user else 'desconocido'
               }), 403
           return f(*args, **kwargs)
       return decorated
   ```
   Aplicar este decorador en todas las rutas de: `charlas`, `formularios`, `examen`, `pagos`, `turnos` y `tramite`.

2. **Implementar Route Guard en el Enrutador SPA**:
   En `frontend/js/app.js` (`Router.render`), verificar el estado del usuario consultando `ApiService.getProgreso()` o el objeto de sesión antes de autorizar la navegación hacia vistas de trámites:
   ```javascript
   if (!publicPages.includes(page) && !adminPages.includes(page) && page !== 'dashboard') {
       const user = ApiService.getUser();
       if (user && user.estado_cuenta !== 'aprobada') {
           this.navigate('dashboard');
           return;
       }
   }
   ```

3. **Subsanar el Bug de Emisión de Licencia (`qr_data`)**:
   En `backend/app.py:165-177`, inicializar `qr_data`:
   ```python
   qr_data = f"MUNI-BARADERO-LICENCIA-{usuario['dni']}-{tramite_id}"
   ```

4. **Restaurar Validación Secuencial de Pasos**:
   Reemplazar el `return True` en `puede_acceder_paso(paso_actual, paso_solicitado)` por una comparación de índices con base en `get_paso_index(paso_solicitado, tipo) <= get_paso_index(paso_actual, tipo)`.

5. **Módulo de Consulta Preliminar de Infracciones en Registro**:
   Incorporar una tabla local de multas preexistentes o un servicio mock configurable que consulte el DNI al momento del registro para alertar de inmediato al ciudadano antes de completar el formulario.
