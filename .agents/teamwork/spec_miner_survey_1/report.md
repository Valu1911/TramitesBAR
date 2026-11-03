# Informe de Relevamiento de Arquitectura, Paneles de Administración y Flujo de Trámites — TramitesBAR

**Fecha:** 2026-11-02  
**Agente:** `spec_miner_survey_1`  
**Objetivo:** Mapear la arquitectura completa, todos los paneles de administración, permisos de roles, ciclo de vida secuencial del trámite, transiciones administrativas y diagnóstico de bloqueos / superposiciones en TramitesBAR.

---

## 1. Arquitectura General del Sistema

El sistema **TramitesBAR** (MuniDigital Baradero) está construido con una arquitectura desacoplada monolítica liviana:

- **Frontend:** Single Page Application (SPA) construida en HTML5, CSS3 modular (con diseño Glassmorphism, temas claro/oscuro institucional SUBI Baradero) y JavaScript moderno (ES6+ modular sin frameworks pesados). El enrutador SPA se basa en `window.location.hash` (`Router` en `frontend/js/app.js`).
- **Backend:** API RESTful en Python 3 + Flask (`backend/app.py`), con autenticación basada en JWT (`PyJWT`), encriptación de contraseñas con Werkzeug (`generate_password_hash`, `check_password_hash`), y utilidades biométricas / OCR para DNI (`dni_processor.py`).
- **Base de Datos:** SQLite 3 relacional (`database/licencias.db`), inicializada vía `database/schema.sql`, con soporte WAL (`PRAGMA journal_mode=WAL;`) y claves foráneas habilitadas (`PRAGMA foreign_keys=ON;`).
- **Integraciones:** Consulta externa a Infracciones BA (`infraccionesba.gba.gob.ar`), escaneo de código PDF417 de DNI argentino, monitoreo WebRTC/Canvas Ping para proctoring docente de exámenes, e interoperabilidad con CUD (Certificado Único de Discapacidad).

---

## 2. Paneles de Administración, Roles y Permisos

El sistema implementa 5 roles administrativos principales más el rol de Ciudadano:

| Rol | Usuario por Defecto | Password | Módulo / Responsabilidad Principal | Endpoints Principales | Vistas Frontend Asociadas |
|---|---|---|---|---|---|
| **Ciudadano** | DNI numérico (7-8 dígitos) | Definida en registro (>=6 cars) | Portal de autogestión, realización de pasos del trámite, pago, turno e inbox | `/api/auth/*`, `/api/tramite/*`, `/api/charlas/*`, `/api/examen/*`, `/api/formularios/*`, `/api/pagos/*`, `/api/turnos/*`, `/api/entrega/*`, `/api/licencia/*` | `login.js`, `registro.js`, `dashboard.js`, `charlas.js`, `examen.js`, `formularios.js`, `pago.js`, `practico.js`, `entrega.js` |
| **Admin Cuentas** (`cuentas`) | `admin_cuentas` | `admin123` | Auditoría de identidad y antecedentes de tránsito (multas impagas). Gestión de bandeja Inbox, aprobación de cuentas, rechazo por multas y papelera. | `GET/POST /api/admin/cuentas/*`, `GET/POST /api/inbox/*` | `admin-cuentas.js` |
| **Admin Salud** (`salud`) | `admin_salud` | `admin123` | Revisión clínica de declaraciones juradas psicofísicas, certificados médicos adjuntos y dictamen de Apto Médico. | `GET /api/admin/salud`, `PUT /api/admin/salud/<id>/revisar` | `admin-salud.js` |
| **Admin Pagos** (`pagos`) | `admin_pagos` | `admin123` | Auditoría de transferencias bancarias y tarjetas por arancel municipal ($12.500 ARS). Aprobación o rechazo con observaciones. | `GET /api/admin/pagos`, `PUT /api/admin/pagos/<id>/revisar` | `admin-pagos.js` |
| **Admin Turnos** (`turnos`) | `admin_turnos` | `admin123` | Gestión de agenda en Circuito Municipal, registro presencial de examen práctico de manejo, toma de foto oficial y huella dactilar. | `GET /api/admin/turnos`, `PUT /api/admin/turnos/<id>/revisar` | `admin-turnos.js` |
| **Admin Profesores** (`profesores`) | `admin_profesores` | `admin123` | Configuración del examen teórico (plantilla, personalizado, híbrido), banco de preguntas, monitoreo en vivo (cámara/pantalla), expulsión y dictamen de examen. | `GET/POST /api/admin/config-examen`, `/api/admin/preguntas/*`, `/api/admin/examen/*`, `/api/admin/profesor/chat/*` | `admin-profesores.js` |

### Mecanismo de Seguridad y Control de Acceso (Backend)
- Decorador `@token_required`: Valida token JWT de ciudadano en header `Authorization: Bearer <token>`.
- Decorador `@admin_required(rol=...)`: Valida JWT con `tipo == 'admin'`.
  - **Hallazgo Crítico de Seguridad/Permisos:** En `backend/app.py` línea 78:
    `if rol and user_rol != rol and user_rol not in ('profesores', 'superadmin', 'admin', 'cuentas'):`
    Esto provoca que cualquier administrador con rol `cuentas` o `profesores` tenga privilegios elevados implícitos y pueda consumir endpoints de los otros módulos (como pagos, salud o turnos).

---

## 3. Ciclo de Vida del Trámite y Pasos Secuenciales

### 3.1. Variantes de Trámite Soportadas
1. **Licencia Nueva (`nueva`):** Requiere curso vial, apto médico, examen teórico anti-cheat, pago, examen práctico en circuito con biometría, y entrega/emisión de credencial digital PBA.
2. **Renovación (`renovacion`):** Flujo abreviado legal: Declaración de salud -> Pago de arancel -> Entrega/Licencia.
3. **Licencia Vencida (`vencida`):** Para licencias con más de 90 días de vencimiento; reactiva instancias de evaluación teórica.
4. **Subir de Categoría (`categoria`):** Ampliación de clases (ej. de B1 a profesional o motovehículos).
5. **Profesional (`profesional`):** Clases comerciales C, D y E con exámenes específicos.
6. **Extravío / Robo (`extravio`):** Duplicado simplificado.

### 3.2. Ciclo Secuencial Paso a Paso (Trámite "Licencia Nueva")

```
[ Registro de Usuario ] 
         ↓
[ Auditoría Admin Cuentas (Multas / Antecedentes) ]
         ↓ (Aprobado)
[ Paso 1: Charlas en Video ] (4 módulos obligatorios en orden)
         ↓ (Todos vistos)
[ Paso 2: Formularios de Salud ] (Declaración médica + Certificado)
         ↓ (Auditoría Admin Salud / Apto)
[ Paso 3: Examen Teórico ] (5 preguntas aleatorias, mínimo 4/5, Anti-Cheat proctoring)
         ↓ (Aprobado por sistema o Profesor)
[ Paso 4: Pago del Arancel ] ($12.500 ARS por transferencia o débito)
         ↓ (Auditoría Admin Pagos)
[ Paso 5: Examen Práctico ] (Turnero en circuito + Huella Dactilar + Foto carnet)
         ↓ (Dictamen Admin Turnos)
[ Paso 6: Entrega ] (Retiro presencial o Envío a domicilio)
         ↓
[ Paso 7: Finalizado / Licencia Digital PBA ] (Credencial QR emitida)
```

### 3.3. Ciclo Secuencial Paso a Paso (Trámite "Renovación")

```
[ Registro de Usuario / Login ] 
         ↓ (Estado cuenta 'aprobada')
[ Paso 1: Formularios de Salud ] (Antecedentes + Certificado)
         ↓ (Aprobado)
[ Paso 2: Pago del Arancel ] ($12.500 ARS)
         ↓ (Aprobado por Tesorería)
[ Paso 3: Entrega ] (Domicilio o retiro presencial)
         ↓
[ Paso 4: Finalizado / Licencia Digital Emitida ]
```

---

## 4. Auditoría Especial: Control de Multas en el Alta de Usuario (Requisito R2)

### 4.1. Regla de Negocio Solicitada
> *"Verificar paso por paso, sin saltear nada, la funcionalidad de comprobación de multas (conforme a las directivas del panel admin cuentas), validando de forma rigurosa la regla de negocio fundamental: si una persona tiene multas pendientes no se le debe permitir terminar de crear el usuario."*

### 4.2. Comportamiento Observado en el Código Fuente
1. **En el Registro (`POST /api/auth/registro`):**
   - El código en `backend/app.py` (líneas 273-348) **NO consulta infracciones ni ejecuta comprobación de multas** antes de insertar el usuario en la base de datos.
   - Todo ciudadano que envía el formulario de registro es insertado inmediatamente en la tabla `usuarios` con:
     - `estado_cuenta = 'pendiente'`
     - `multas_cantidad = 0`
     - `multas_monto = 0.0`
     - `multas_motivo = ''`
   - La API responde inmediatamente con código HTTP **201 Created**, emitiendo un token JWT de autenticación válido.
2. **En el Acceso Ciudadano (`dashboard.js`):**
   - El ciudadano puede iniciar sesión normalmente.
   - Al ingresar con `estado_cuenta == 'pendiente'`, la interfaz bloquea el acceso a la hoja de ruta y muestra la pantalla amarilla: *"Tu cuenta está en proceso de verificación. Serás avisado cuando la misma esté activa. Nuestro equipo de Tránsito e Infracciones está revisando tus antecedentes..."*.
3. **En el Panel Administrativo (`admin-cuentas.js` y `app.py`):**
   - El usuario aparece en la pestaña **"Pendientes Auditoría"** del oficial de cuentas.
   - El operador presiona *"Abrir Infracciones BA y Copiar DNI"*, consultando manualmente el portal provincial externo (`https://infraccionesba.gba.gob.ar/consulta-infraccion`).
   - Si el operador detecta multas, hace clic en *"Rechazar por Multas"* (`POST /api/admin/cuentas/<id>/rechazar`), ingresando la cantidad de multas, monto adeudado y motivo.
   - El backend cambia `estado_cuenta = 'rechazada_multas'`.
   - Al recargar el dashboard ciudadano, el usuario ve el panel rojo *"Tienes Multas Pendientes"* con el monto adeudado, acceso al Inbox oficial y el botón verde *"¡Ya Pagué!"* para adjuntar el comprobante de regularización.
4. **Dictamen de Cumplimiento:**
   - **Discrepancia arquitectónica clave:** Actualmente el alta en la base de datos **sí se concreta** (el usuario se crea con estado `pendiente`), y el rechazo por multas se aplica de forma asincrónica / manual a posteriori mediante el cambio de estado de cuenta a `rechazada_multas`. No existe una traba previa en el endpoint de registro que aborte la creación de la fila en `usuarios` si el DNI tiene multas previas.

---

## 5. Análisis de Superposiciones, Saltos de Paso y Condiciones de Carrera

Durante la inspección profunda de la lógica de negocio se detectaron los siguientes puntos críticos de orden secuencial:

### 5.1. Bypass del Control de Pasos en Backend (`puede_acceder_paso`)
- **Archivo:** `sistema_licencias/backend/app.py`, línea 142.
- **Código:**
  ```python
  def puede_acceder_paso(paso_actual, paso_solicitado):
      return True
  ```
- **Impacto:** Aunque cada endpoint del trámite invoca `puede_acceder_paso(tramite['paso_actual'], '<paso>')`, al retornar siempre `True`, cualquier llamada directa vía API REST permite saltear pasos o ejecutarlos en desorden (ej. pagar sin haber aprobado el teórico o solicitar entrega sin turno práctico).

### 5.2. Auto-Aprobación por Defecto en Formularios de Salud
- **Archivo:** `sistema_licencias/backend/app.py`, líneas 1049-1066.
- **Código:**
  ```python
  estado_form = data.get('estado', 'aprobado')
  siguiente_paso = 'pago' if tramite['tipo'] == 'renovacion' else 'examen'
  if estado_form == 'aprobado' and tramite['paso_actual'] == 'formularios':
      execute_query("UPDATE tramites SET paso_actual=? WHERE id=?", (siguiente_paso, tramite_id))
  ```
- **Impacto:** Como el frontend del ciudadano (`formularios.js`) no envía el campo `estado`, el backend asume por defecto `'aprobado'` y transiciona automáticamente el trámite a `examen` (o `pago`), eludiendo la revisión médica obligatoria del rol `admin_salud`, a menos que se fuerce explícitamente `estado='pendiente'`.

### 5.3. Navegación en Frontend sin Bloqueo de Pasos Bloqueados
- **Archivo:** `sistema_licencias/frontend/js/pages/dashboard.js`, línea 411 y `frontend/js/app.js`, línea 421.
- **Impacto:** En las tarjetas de paso de la hoja de ruta y en el menú lateral, los elementos tienen `onclick="Router.navigate('${paso.id}')"` sin evaluar si `paso.status === 'locked'`. Además, si la API responde error 403, el frontend activa un "Modo Demo" local (`localStorage`), simulando la continuidad del flujo.

### 5.4. Emisión Prematura de Licencia en Renovación
- **Archivo:** `sistema_licencias/backend/app.py`, líneas 1152-1156.
- **Impacto:** Al registrar un pago en renovación con `auto_aprobar` (o método `demo`), la licencia digital se genera inmediatamente y el trámite salta a `paso_actual='entrega'` con `estado='completado'`, antes de que el ciudadano seleccione el método de entrega (`domicilio` o `presencial`).

---

## 6. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth | Registro Ciudadano | Crea cuenta de usuario y asigna trámite inicial | `dni`, `nombre`, `apellido`, `fecha_nacimiento`, `email`, `telefono`, `direccion`, `password`, `tipo_tramite`, `tiene_cud`, `numero_cud`, `foto_rostro` | HTTP 201, JWT token, datos de usuario | DNI inválido (400), DNI duplicado (409), password corta (400) | `app.py:272`, `registro.js` |
| 2 | Auth | Login Ciudadano | Autenticación con DNI y contraseña | `dni`, `password` | HTTP 200, JWT token, trámite activo | DNI no registrado (404, `needs_register: true`), password errónea (401) | `app.py:372`, `login.js` |
| 3 | Auth | Check DNI Previo | Verifica si un DNI ya posee cuenta registrada | `dni` | HTTP 200, `{exists, nombre, apellido, foto_rostro, tiene_cud}` | DNI inválido (400) | `app.py:449` |
| 4 | Auth | Scanner / Lector DNI | Decodifica OCR y PDF417 de DNI argentino, extrae foto de rostro | `image` (base64) o `raw_text` (cadena PDF417) | HTTP 200, `{success, dni, nombre, apellido, fecha_nac, foto_rostro, user_exists}` | Formato no reconocido (400 / 500) | `app.py:210`, `dni_processor.py` |
| 5 | Auth / Admin | Login Administrativo | Autenticación de funcionarios por usuario y clave | `usuario`, `password` | HTTP 200, JWT admin, `{id, usuario, nombre, rol}` | Usuario no encontrado (404), clave inválida (401) | `app.py:560`, `admin-login.js` |
| 6 | Trámite | Consulta de Progreso | Retorna estado del trámite, porcentaje y pasos según tipo | Header `Authorization` | HTTP 200, `{tramite_id, tipo, paso_actual, progreso_porcentaje, pasos, usuario, licencia}` | No autenticado (401), sin trámite (404) | `app.py:599`, `dashboard.js` |
| 7 | Trámite | Selector de Trámite | Cambia o inicia trámite (`nueva`, `renovacion`, `vencida`, etc.) | `tipo` | HTTP 200, nuevo JWT con `tramite_id` actualizado | Tipo inválido (400) | `app.py:492`, `dashboard.js` |
| 8 | Charlas | Listado de Videos | Lista videos de seguridad vial y estado de visualización | Header `Authorization` | HTTP 200, lista de videos con bandera `visto`, `todos_vistos` | No autenticado (401) | `app.py:748`, `charlas.js` |
| 9 | Charlas | Marcar Video Visto | Registra video visto verificando orden secuencial estricto | `video_id` | HTTP 200, `{todos_vistos: bool}` | Video no encontrado (404), videos anteriores no vistos (400) | `app.py:774`, `charlas.js` |
| 10 | Examen | Obtención de Preguntas | Entrega 5 preguntas según configuración (plantilla/personalizado/híbrido) | Header `Authorization`, query `force` | HTTP 200, `{preguntas: [...], ya_rendido: bool}` | Paso no alcanzado (403 si `puede_acceder_paso` validara) | `app.py:833`, `examen.js` |
| 11 | Examen | Proctoring Ping | Recibe fotograma webcam y pantalla para supervisión docente | `cam_frame`, `screen_frame`, `warnings_count`, `elapsed_seconds` | HTTP 200, `{status: 'ok'}` | No autenticado (401) | `app.py:902`, `examen.js` |
| 12 | Examen | Entrega y Evaluación | Corrige respuestas teóricas, calcula porcentaje y estado | `respuestas` (dict id:letra), `auto_aprobar` | HTTP 200, `{aprobado, puntaje, total, porcentaje}` | No autenticado (401) | `app.py:935`, `examen.js` |
| 13 | Formularios | Estado Declaración Salud | Consulta ficha médica y estado de aptitud | Header `Authorization` | HTTP 200, `{enviado: bool, formulario: {...}}` | No autenticado (401) | `app.py:1003`, `formularios.js` |
| 14 | Formularios | Enviar Declaración Salud | Registra ficha médica y certificado adjunto | `grupo_sanguineo`, `usa_lentes`, `contacto_emergencia`, `telefono_emergencia`, `certificado_archivo` | HTTP 200, `{id, siguiente_paso}` | Campos obligatorios vacíos (400), ya enviado (400) | `app.py:1027`, `formularios.js` |
| 15 | Pagos | Info de Pago | Retorna arancel vigente ($12.500), Alias y CBU bancario | Header `Authorization` | HTTP 200, `{pago, monto, alias, cbu}` | No autenticado (401) | `app.py:1076`, `pago.js` |
| 16 | Pagos | Registrar Pago | Envía comprobante de transferencia o datos de débito | `metodo`, `comprobante`, `numero_tarjeta`, `nombre_titular`, `auto_aprobar` | HTTP 200, `{id, estado, licencia}` | Método inválido (400), pago previo existente (400) | `app.py:1114`, `pago.js` |
| 17 | Pagos | Reiniciar Pago | Limpia comprobante previo para permitir reintento de pago | Header `Authorization` | HTTP 200, `{message: '...'}` | No autenticado (401) | `app.py:1106`, `pago.js` |
| 18 | Turnos | Turnos Disponibles | Consulta fechas disponibles con cupo en circuito | Header `Authorization` | HTTP 200, `{turnos: [...], reserva: {...}}` | No autenticado (401) | `app.py:1172`, `practico.js` |
| 19 | Turnos | Reservar Turno | Reserva turno presencial en circuito municipal | `turno_id` | HTTP 200, `{id: reserva_id}` | Turno sin cupo o inactivo (400), ya reservado (400) | `app.py:1202`, `practico.js` |
| 20 | Entrega | Solicitar Entrega | Elige retiro presencial o entrega a domicilio | `metodo` ('domicilio'/'presencial'), `direccion` | HTTP 200, `{id: entrega_id}` | Método inválido (400), dirección vacía en domicilio (400), ya solicitado (400) | `app.py:1265`, `entrega.js` |
| 21 | Licencia | Licencia Digital Oficial | Emite y recupera credencial con QR y vigencia por edad | Header `Authorization` | HTTP 200, `{usuario, licencia, documentos}` | Usuario no encontrado (404) | `app.py:1308`, `dashboard.js` |
| 22 | Admin Cuentas | Listar Cuentas | Lista ciudadanos con conteos de pendientes, multas y papelera | `filtro` ('todos', 'pendiente', 'rechazada_multas', 'aprobada', 'papelera') | HTTP 200, `{usuarios, pendientes, con_multas, aprobados, papelera}` | No admin cuentas (403) | `app.py:1962`, `admin-cuentas.js` |
| 23 | Admin Cuentas | Detalle de Cuenta | Obtiene datos de usuario, trámite e historial de mensajes | URL param `user_id` | HTTP 200, `{usuario, tramite, mensajes}` | Usuario inexistente (404) | `app.py:2010`, `admin-cuentas.js` |
| 24 | Admin Cuentas | Aprobar Cuenta | Habilita cuenta ciudadana eliminando marcas de infracción | URL param `user_id` | HTTP 200, `{message: '...'}` | Usuario no encontrado (404) | `app.py:2034`, `admin-cuentas.js` |
| 25 | Admin Cuentas | Rechazar por Multas | Bloquea cuenta indicando cantidad, monto y motivo de multas | URL param `user_id`, `cantidad_multas`, `monto_total`, `mensaje` | HTTP 200, notificación agregada al inbox | Usuario no encontrado (404) | `app.py:2061`, `admin-cuentas.js` |
| 26 | Admin Cuentas | Mover a Papelera | Archiva usuario inactivo | URL param `user_id` | HTTP 200, `{message: '...'}` | Usuario no encontrado (404) | `app.py:2095`, `admin-cuentas.js` |
| 27 | Inbox | Mensajería Ciudadano-Admin | Envía y recibe mensajes y adjuntos entre vecino y municipio | `mensaje`, `adjunto_url`, `adjunto_nombre`, `usuario_id` | HTTP 201, mensaje persistido | Mensaje o adjunto vacío (400) | `app.py:2121`, `app.py:2151` |
| 28 | Inbox | Notificar "¡Ya Pagué!" | Avisa al oficial de cuentas que se regularizó la deuda de multas | `mensaje`, `adjunto_url`, `adjunto_nombre` | HTTP 200, bandera `infracciones_pagadas_solicitadas=1` | No autenticado (401) | `app.py:2190`, `dashboard.js` |
| 29 | Admin Salud | Listar Declaraciones | Lista fichas médicas filtradas por estado | `estado` ('todos', 'pendiente', 'aprobado', 'rechazado') | HTTP 200, `{formularios, pendientes}` | No admin salud (403) | `app.py:1474`, `admin-salud.js` |
| 30 | Admin Salud | Revisar Dictamen Salud | Dictamina apto médico u observaciones | `estado` ('aprobado'/'rechazado'), `observaciones` | HTTP 200, avanza paso a `examen` o `pago` | Estado inválido (400) | `app.py:1512`, `admin-salud.js` |
| 31 | Admin Pagos | Listar Pagos | Lista pagos pendientes y procesados | `estado` ('todos', 'pendiente', 'aprobado', 'rechazado') | HTTP 200, `{pagos, pendientes}` | No admin pagos (403) | `app.py:1399`, `admin-pagos.js` |
| 32 | Admin Pagos | Auditar Pago | Aprueba o rechaza comprobante de pago | `estado` ('aprobado'/'rechazado'), `observaciones` | HTTP 200, avanza paso a `practico` o emite licencia | Estado inválido (400) | `app.py:1437`, `admin-pagos.js` |
| 33 | Admin Turnos | Listar Turnos | Lista reservas prácticas con datos de evaluado | `estado` ('todos', 'reservado', 'completado', 'rechazado') | HTTP 200, `{reservas, pendientes}` | No admin turnos (403) | `app.py:1547`, `admin-turnos.js` |
| 34 | Admin Turnos | Auditar Turno y Biometría | Registra resultado práctico, huella dactilar y foto carnet | `estado`, `resultado_examen`, `huella_tomada`, `foto_tomada`, `observaciones` | HTTP 200, avanza paso a `entrega` y emite licencia digital | Estado inválido (400) | `app.py:1587`, `admin-turnos.js` |
| 35 | Admin Profesores | Config Examen | Configura modo de examen (`plantilla`, `personalizado`, `hibrido`) | `modo`, `cant_plantilla`, `cant_profesor` | HTTP 200, `{message: '...'}` | Modo no válido (400) | `app.py:1628`, `admin-profesores.js` |
| 36 | Admin Profesores | ABM Preguntas | Crea, edita y elimina preguntas teóricas | `pregunta`, `opcion_a`..`d`, `respuesta_correcta`, `es_plantilla` | HTTP 200, `{id: qid}` | Campos incompletos (400) | `app.py:1652`, `app.py:1681` |
| 37 | Admin Profesores | Monitoreo en Vivo | Supervisa transmisión en vivo de alumnos rindiendo | Header `Authorization` | HTTP 200, `{estudiantes: [...]}` | No admin (403) | `app.py:1788`, `admin-profesores.js` |
| 38 | Admin Profesores | Expulsar Alumno | Expulsa postulante por trampas (Alt-Tab / fuga de foco) | `tramite_id`, `motivo` | HTTP 200, `{message: '...'}` | Trámite inexistente (404) | `app.py:1820`, `admin-profesores.js` |
| 39 | Admin Profesores | Revisión de Exámenes | Dictamina manualmente sobre exámenes rendidos | `tramite_id`, `decision` ('aprobar'/'desaprobar'), `motivo` | HTTP 200, avanza a `pago` o desaprueba | Parámetros inválidos (400) | `app.py:1878`, `admin-profesores.js` |
| 40 | Gentle AI / Memoria | Log y Preferencias | Almacena y recupera actividad y preferencias de UI | `action`, `detail`, `theme`, `last_page`, `sidebar_collapsed` | HTTP 200/201, `{ok: true, preferences}` | Acción no informada (400) | `app.py:2251`, `app.py:2319` |

---

## 7. Edge Cases y Comportamiento Observado

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Registro de Ciudadano | DNI con puntos o guiones (ej: `35.123.456` o `35-123456`) | Se limpian caracteres no numéricos y se almacena `35123456`. |
| 2 | Registro de Ciudadano | DNI con menos de 7 o más de 8 dígitos numéricos | Falla con HTTP 400: `"DNI inválido (7 u 8 dígitos)"`. |
| 3 | Registro de Ciudadano | Contraseña de menos de 6 caracteres | Falla con HTTP 400: `"La contraseña debe tener al menos 6 caracteres"`. |
| 4 | Registro de Ciudadano | Ciudadano con multas registradas en provincia | **Falla de regla de negocio R2:** El usuario se crea exitosamente en la base de datos (HTTP 201) en lugar de ser bloqueado en el alta. |
| 5 | Login de Ciudadano | Cuenta con estado `pendiente` | Login exitoso (HTTP 200). En dashboard muestra pantalla de espera bloqueando trámites. |
| 6 | Login de Ciudadano | Cuenta con estado `rechazada_multas` | Login exitoso (HTTP 200). En dashboard muestra panel rojo de multas con botón "¡Ya pagué!". |
| 7 | Charlas en Video | Intento de marcar video 3 sin haber visto video 1 o 2 | Falla con HTTP 400: `"Debés ver los videos anteriores primero"`. |
| 8 | Charlas en Video | Re-marcado de un video previamente visto | Ejecuta `ON CONFLICT DO UPDATE` y mantiene estado sin errores (idempotente). |
| 9 | Examen Teórico | Intento de rendir examen por segunda vez (`force=0`) | Retorna `{ya_rendido: true, aprobado: bool, puntaje: n, total: m}` evitando duplicar examen. |
| 10 | Examen Teórico | Banco de preguntas vacío en modo personalizado | Frontend renderiza aviso institucional: `"No hay preguntas en el banco de examen"` y redirige a dashboard. |
| 11 | Formularios de Salud | Envío sin especificar estado de auditoría | Backend asume `estado = 'aprobado'` por defecto y avanza inmediatamente al siguiente paso. |
| 12 | Formularios de Salud | Reenvío de declaración médica ya ingresada | Falla con HTTP 400: `"Ya enviaste los formularios de salud"`. |
| 13 | Pago de Arancel | Envío con método no contemplado (ej. `efectivo`) | Falla con HTTP 400: `"Método de pago inválido"`. |
| 14 | Pago de Arancel | Pago en modo renovación con auto-aprobación | Emite la licencia digital automáticamente y coloca `paso_actual = 'entrega'`, omitiendo revisión de pagos. |
| 15 | Reserva de Turno | Reserva en turno con `cupo_actual >= cupo_maximo` | Falla con HTTP 400: `"Turno no disponible"`. |
| 16 | Reserva de Turno | Usuario con turno activo intenta reservar otro | Falla con HTTP 400: `"Ya tenés un turno reservado"`. |
| 17 | Entrega de Licencia | Selección de `domicilio` con campo `direccion` vacío | Falla con HTTP 400: `"Dirección requerida para envío a domicilio"`. |
| 18 | Vigencia PBA | Conductor de 16 o 17 años | Emite licencia con vigencia de 1 año (`calcular_vigencia_licencia`). |
| 19 | Vigencia PBA | Conductor de 18 a 65 años | Emite licencia con vigencia de 5 años. |
| 20 | Vigencia PBA | Conductor mayor a 70 años | Emite licencia con vigencia de 1 año. |
| 21 | Transición de Paso | Invocación de endpoint de paso no habilitado vía API | **Vulnerabilidad de orden:** `puede_acceder_paso` retorna `True`, permitiendo saltos de paso no autorizados a nivel API. |
| 22 | Control de Roles | Acceso a `/api/admin/pagos` con token de `admin_cuentas` | Acceso concedido (HTTP 200) debido a la excepción abierta en `admin_required`. |

---

## 8. Diagnóstico y Recomendaciones Preliminares

1. **Cumplimiento Estricto de R2 (Control de Multas en Alta de Usuario):**
   - Actualmente, el sistema no bloquea el alta de usuario si tiene multas; solo bloquea su progreso tras la creación de la cuenta mediante el estado `pendiente` / `rechazada_multas`.
   - Se recomienda desacoplar la validación de multas hacia un pre-chequeo obligatorio en el formulario de registro (`/api/auth/verificar-infracciones-dni` o pre-validación sincrónica en `/api/auth/registro`), rechazando la creación de la cuenta (`HTTP 403 Forbidden` / `"Registro no permitido: registra infracciones impagas"`) si el DNI figura con deuda.
2. **Restauración del Validador de Orden Secuencial (`puede_acceder_paso`):**
   - Implementar la lógica real comparando los índices de `PASOS_NUEVA` o `PASOS_RENOVACION` (`get_paso_index`), verificando que el usuario no pueda llamar a un paso `idx_solicitado > idx_actual`.
3. **Flujo de Auditoría de Salud:**
   - Fijar `estado_form = 'pendiente'` por defecto en `enviar_formularios`, obligando a que el oficial médico (`admin_salud`) dictamine la aptitud antes de habilitar el examen teórico.
4. **Principio de Mínimo Privilegio en Roles Administrativos:**
   - Eliminar el bypass genérico de `admin_required` que otorga acceso total cruzado a `cuentas` y `profesores`.
