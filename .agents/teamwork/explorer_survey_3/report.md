# Informe de Investigación Técnica: Infraestructura de Pruebas y Ejecución Local

**Proyecto**: Sistema de Trámites de Licencias de Conducir — Municipalidad de Baradero  
**Agente**: `explorer_survey_3`  
**Fecha**: 2026-11-02  
**Modo**: Auditoría de solo lectura (sin modificación de código fuente)  

---

## 1. Resumen Ejecutivo y Arquitectura del Sistema

El sistema es una plataforma integral municipal orientada a la autogestión de trámites de licencias de conducir (alta, renovación, ampliación, duplicado) y a la auditoría operativa distribuida en 5 paneles administrativos.

### Componentes Arquitecturales
- **Backend**: API REST desarrollada en Python 3 con **Flask 3.1.1**, autenticación stateless mediante **JWT** (`PyJWT 2.10.1`), procesamiento biométrico de DNI (`opencv-python-headless`, `pdf417decoder`, `zxing-cpp`, `Pillow`).
- **Base de Datos**: **SQLite 3** (`database/licencias.db`), con migraciones automáticas y seeders de datos iniciales definidos en `backend/db.py` y `database/schema.sql`.
- **Frontend**: Single Page Application (SPA) construida en **Vanilla JavaScript (ES6+)**, HTML5 y CSS3 moderno (con sistema de diseño glassmorphism y componentes accesibles inspirados en Shadcn UI). No requiere empaquetadores (Node/Webpack/Vite) y es servido directamente como archivos estáticos desde `backend/app.py` (`static_folder='../frontend'`).

---

## 2. Inventario de Infraestructura y Suites de Prueba Existentes

Se realizó una auditoría exhaustiva de los archivos de prueba presentes en el repositorio:

| Archivo | Tipo de Prueba | Mecanismo de Ejecución | Cobertura Funcional |
|---|---|---|---|
| `sistema_licencias/test_suite.py` (525 líneas) | Integración HTTP E2E | Cliente HTTP nativo (`urllib.request`) contra `http://localhost:5000/api` | Cubre 20 bloques: registro ciudadano, DNI duplicado, check DNI, login, videos de charlas, formularios de salud, aprobación Admin Salud, examen teórico (4/5 aprobado), pago demo, reserva de turnos, aprobación Admin Turnos con biometría, solicitud de entrega, licencia digital, renovación simplificada PBA, menores de edad (16-17 años vigencia 1 año), estadísticas admin, CUD dinámico, configuración de preguntas de profesor (modo híbrido), streaming/ping de proctoring. |
| `sistema_licencias/test_api.py` (223 líneas) | Integración API Básica | Cliente HTTP nativo (`urllib.request`) contra `http://localhost:5000/api` | Verificación de ciclo de vida básico de endpoints: autenticación, progreso de pasos, videos, formularios, examen teórico, login de admin salud/pagos/turnos y estadísticas. |
| `sistema_licencias/test_dni_api_flow.py` (131 líneas) | Integración en Memoria / WSGI | `app.test_client()` de Flask (sin necesidad de servidor HTTP en puerto externo) | 6 pasos de integración: procesamiento de imagen sintética y PDF417 en `/api/dni/procesar`, persistencia de avatar facial en registro, reconocimiento de usuario existente en login, validación de avatar en dashboard y actualización de foto de perfil. |
| `sistema_licencias/test_dni_scanner.py` (69 líneas) | Unitaria / Procesamiento DNI | Funciones directas de `dni_processor.py` | Parseo de código de barras PDF417 (formato moderno, antiguo y delimitado por comas) y procesamiento de imagen sintética. |
| `sistema_licencias/backend/test_mysql.py` (17 líneas) | Conectividad heredada | Script residual | Script exploratorio de prueba de conexión a MySQL previo a la migración definitiva a SQLite. |

### Hallazgos Clave sobre Herramientas de Test
1. **Ausencia de frameworks pesados de terceros**: No se detectaron configuraciones de `pytest`, `unittest.TestCase`, `jest`, `vitest` o `playwright`.
2. **Independencia de dependencias de testing**: Las suites existentes (`test_suite.py`, `test_api.py`) están escritas con módulos de la biblioteca estándar de Python (`urllib.request`, `json`, `sys`, `random`). No requieren instalar paquetes adicionales para el test runner una vez que la API está operativa.
3. **Mecanismo TestClient**: `test_dni_api_flow.py` demuestra que es posible ejecutar pruebas completas de integración mediante `app.test_client()`, permitiendo pruebas deterministas en memoria sin colisiones de sockets ni puertos de red.

---

## 3. Entorno de Ejecución Local y Comandos Operativos

### Runtimes Detectados en el Sistema Anfitrión
- **Python**: **Python 3.14.5** instalado en:
  `C:\Users\PC\AppData\Local\Programs\Python\Python314\python.exe`
  *(Nota crítica: El comando genérico `python` invoca el alias de Microsoft Store `C:\Users\PC\AppData\Local\Microsoft\WindowsApps\python.exe`, el cual falla con "Acceso Denegado / ResourceUnavailable" en entornos restringidos. Debe invocarse la ruta absoluta o mediante el launcher).*
- **Node.js**: `v22.16.0` (npm `10.9.2`) disponible globalmente. Dado que el frontend es Vanilla JS, Node.js no es requerido para compilar ni servir la aplicación.

### Dependencias de Backend (`sistema_licencias/backend/requirements.txt`)
```text
Flask==3.1.1
flask-cors==5.0.1
Werkzeug==3.1.3
PyJWT==2.10.1
opencv-python-headless
numpy
Pillow
pdf417decoder
zxing-cpp
```

### Comandos de Ejecución Local
1. **Instalación de dependencias**:
   ```powershell
   & "C:\Users\PC\AppData\Local\Programs\Python\Python314\python.exe" -m pip install -r "c:\Users\PC\Desktop\marconecangrejodejaderobarenmiclub\TramitesBAR\sistema_licencias\backend\requirements.txt"
   ```
2. **Inicio del Servidor API y Frontend**:
   ```powershell
   cd "c:\Users\PC\Desktop\marconecangrejodejaderobarenmiclub\TramitesBAR\sistema_licencias\backend"
   & "C:\Users\PC\AppData\Local\Programs\Python\Python314\python.exe" app.py
   ```
   *El archivo `app.py` incluye una función de saneamiento `liberar_puerto(5000)` que finaliza automáticamente cualquier proceso huérfano que retenga el puerto 5000 en Windows antes de levantar el listener.*
3. **Acceso Web**:
   - Frontend SPA: `http://localhost:5000/`
   - API Endpoints: `http://localhost:5000/api`

---

## 4. Auditoría de Paneles de Administración y Endpoints

El sistema provee 5 paneles de administración diferenciados por rol en la tabla `admins`:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PANELES DE ADMINISTRACIÓN BARADERO                   │
├──────────────────┬─────────────────┬───────────────────────────────────┤
│ Rol / Usuario    │ Credencial      │ Responsabilidad Operativa         │
├──────────────────┼─────────────────┼───────────────────────────────────┤
│ admin_cuentas    │ admin123        │ Verificación inicial y multas     │
│ admin_profesores │ admin123        │ Banco de preguntas y proctoring   │
│ admin_pagos      │ admin123        │ Tesorería y comprobantes de pago  │
│ admin_salud      │ admin123        │ Auditoría médica psicofísica      │
│ admin_turnos     │ admin123        │ Circuito práctico y biometría     │
└──────────────────┴─────────────────┴───────────────────────────────────┘
```

### 1. Panel de Cuentas e Infracciones (`admin_cuentas`)
- **Controlador**: `backend/app.py` (Líneas 1962–2220)
- **Frontend**: `frontend/js/pages/admin-cuentas.js`
- **Endpoints Clave**:
  - `GET /api/admin/cuentas?filtro={pendiente|aprobada|rechazada_multas|papelera|todos}`: Lista ciudadanos según su estado de cuenta.
  - `GET /api/admin/cuentas/<id>`: Detalle del ciudadano, trámite asociado e historial de mensajes.
  - `POST /api/admin/cuentas/<id>/aprobar`: Aprueba la cuenta (`estado_cuenta = 'aprobada'`), resetea multas y habilita al ciudadano a tramitar.
  - `POST /api/admin/cuentas/<id>/rechazar`: Bloquea al ciudadano (`estado_cuenta = 'rechazada_multas'`), asigna cantidad de multas, monto total y motivo, e inserta notificación en el inbox.
  - `POST /api/admin/cuentas/<id>/mover-papelera` y `POST /api/admin/cuentas/<id>/dar-alta`: Gestión de archivo.
  - `GET /api/inbox/mensajes` y `POST /api/inbox/enviar`: Mensajería bidireccional ciudadano-municipio con soporte de comprobantes adjuntos.
  - `POST /api/usuario/notificar-ya-pague`: Envío de comprobante por parte del ciudadano solicitando re-verificación.

### 2. Panel de Tesorería y Pagos (`admin_pagos`)
- **Controlador**: `backend/app.py` (Líneas 1399–1469)
- **Frontend**: `frontend/js/pages/admin-pagos.js`
- **Endpoints Clave**:
  - `GET /api/admin/pagos?estado={todos|pendiente|aprobado|rechazado}`
  - `PUT /api/admin/pagos/<id>/revisar`: Aprueba/rechaza el pago del arancel ($12.500). Si aprueba en trámite de renovación, emite automáticamente la Licencia Digital; si es nueva, avanza a `practico`.

### 3. Panel de Salud y Aptitud Psicofísica (`admin_salud`)
- **Controlador**: `backend/app.py` (Líneas 1474–1541)
- **Frontend**: `frontend/js/pages/admin-salud.js`
- **Endpoints Clave**:
  - `GET /api/admin/salud?estado={todos|pendiente|aprobado|rechazado}`
  - `PUT /api/admin/salud/<id>/revisar`: Aprueba/rechaza el examen psicofísico. Al aprobar, avanza al paso `examen` (o `pago` si es renovación).

### 4. Panel de Turnos y Biometría (`admin_turnos`)
- **Controlador**: `backend/app.py` (Líneas 1547–1623)
- **Frontend**: `frontend/js/pages/admin-turnos.js`
- **Endpoints Clave**:
  - `GET /api/admin/turnos?estado={todos|reservado|completado|cancelado}`
  - `PUT /api/admin/turnos/<id>/revisar`: Registra resultado del examen práctico, toma de huella digital (`huella_tomada=1`) y fotografía facial (`foto_tomada=1`). Al completarse exitosamente, emite la Licencia Digital y avanza a `entrega`.

### 5. Panel de Claustro Docente (`admin_profesores`)
- **Controlador**: `backend/app.py` (Líneas 1628–1956)
- **Frontend**: `frontend/js/pages/admin-profesores.js`
- **Endpoints Clave**:
  - `GET / POST /api/admin/config-examen`: Configura modos `plantilla`, `personalizado` o `hibrido`.
  - `GET / POST /api/admin/preguntas` y `PUT / DELETE /api/admin/preguntas/<id>`: CRUD del banco de preguntas.
  - `POST /api/admin/preguntas/vaciar` y `POST /api/admin/preguntas/restaurar-plantilla`.
  - `GET /api/admin/examen/monitoreo`: Supervisión en tiempo real de aspirantes rindiendo con proctoring.
  - `POST /api/admin/examen/expulsar`: Expulsión disciplinaria por infracción de proctoring.
  - `POST /api/admin/examen/revisar`: Calificación manual y justificación docente de exámenes.

---

## 5. Análisis del Flujo Secuencial y Reglas de Negocio

### A. Secuencia Estricta de Etapas (Sin Superposiciones)

```
[1. Registro DNI] ──> [2. Verificación Multas (Admin Cuentas)]
                                  │
                   ┌──────────────┴──────────────┐
                   ▼                             ▼
         [Rechazado: MULTAS]             [Cuenta APROBADA]
      (Bloqueo estricto; Inbox)                  │
                                                 ▼
                                        [3. Charlas en Video]
                                                 │
                                                 ▼
                                      [4. Formulario de Salud]
                                                 │ (Aprobado por Admin Salud)
                                                 ▼
                                        [5. Examen Teórico]
                                                 │ (4/5 Aciertos)
                                                 ▼
                                        [6. Pago Arancel]
                                                 │ (Aprobado por Admin Pagos)
                                                 ▼
                                      [7. Práctico + Biometría]
                                                 │ (Aprobado por Admin Turnos)
                                                 ▼
                                     [8. Emisión Licencia y Entrega]
```

### B. Validación de la Regla de Negocio: Control de Multas (R2)
1. **Momento de Registro**:
   En `/api/auth/registro` (líneas 310–313 de `app.py`), el usuario es registrado con `estado_cuenta = 'pendiente'` y `multas_cantidad = 0`.
2. **Barrera de Acceso Inicial**:
   En el frontend (`frontend/js/pages/dashboard.js`, líneas 50–91), si `estado_cuenta === 'pendiente'`, se bloquea el acceso a todas las pestañas de trámite y se muestra el aviso de "Cuenta en proceso de verificación por el área de Tránsito".
3. **Comprobación de Multas**:
   El operador de `admin_cuentas` consulta las bases de datos (Infracciones BA). Si existen multas pendientes, ejecuta `/api/admin/cuentas/<id>/rechazar`.
4. **Bloqueo Total por Multas**:
   En `dashboard.js` (líneas 96–163), si `estado_cuenta === 'rechazada_multas'`:
   - El ciudadano tiene **completamente bloqueado** el avance de cualquier paso del trámite.
   - Se muestra un panel rojo con el detalle exacto de infracciones, monto total a regularizar y motivo oficial.
   - Las únicas acciones permitidas son interactuar por el Inbox o presionar "¡Ya Pagué! Adjuntar Comprobante".
5. **Completitud del Alta**:
   Solamente tras la resolución de multas y posterior aprobación formal por `admin_cuentas` (`estado_cuenta = 'aprobada'`), el usuario es habilitado para interactuar con los pasos de su trámite.

---

## 6. Estrategia de Validación y Pruebas No Destructivas

Para dar cumplimiento estricto a los requisitos **R1, R2 y R3** respetando la restricción de **no modificar archivos de código fuente existentes**, se diseñó la siguiente estrategia de ejecución técnica:

### Principios de No Destructividad
1. **Aislamiento de Datos por Prefijo de DNI**:
   Generar usuarios de prueba con DNIs reservados en un rango aleatorio no conflictivo (ej. `90.000.000` a `99.999.999`). Esto evita alterar registros existentes de ciudadanos o datos semilla (preguntas oficiales, videos, turnos precargados).
2. **Respaldo Preventivo de Base de Datos**:
   Crear una copia de seguridad local del archivo SQLite (`licencias.db -> licencias.db.audit_backup`) antes de iniciar la corrida de pruebas masivas, permitiendo restauración instantánea al estado inicial al término de la auditoría.
3. **Ubicación Exclusiva de Scripts de Validación**:
   Todos los scripts auxiliares de prueba y reportes deben residir dentro del directorio del agente:
   `.agents/teamwork/<agent_name>/` o ejecutarse en memoria, garantizando cero contaminación del árbol de código fuente productivo.

### Modos de Ejecución Propuestos

#### Modo 1: Suite de Integración API en Memoria (`test_client`)
- **Ventaja**: No requiere abrir puertos TCP/IP, no depende de permisos de firewall ni de procesos demonio.
- **Implementación**: Script Python que importa `app` y `init_db` desde `sistema_licencias/backend/app.py` y ejecuta peticiones simuladas con `client = app.test_client()`.
- **Alcance**: Valida el 100% de los endpoints de backend, tokens JWT, lógica de negocio y transiciones de estado de base de datos.

#### Modo 2: Suite HTTP Local E2E (`urllib.request`)
- **Ventaja**: Valida el servidor en vivo (`http://localhost:5000/api`), cabeceras HTTP reales, serialización JSON y concurrencia.
- **Implementación**: Script Python en la carpeta del agente de testing que se comunica con el servidor local levantado con `app.py`.

### Casos de Prueba Esenciales a Ejecutar en la Auditoría
1. **Flujo de Infracciones y Multas (Requisito R2)**:
   - Registro de Usuario A (con multas asignadas por admin).
   - Verificación de rechazo inmediato y pantalla bloqueante `rechazada_multas`.
   - Verificación de que peticiones directas a `/api/tramite/progreso`, `/api/charlas/videos`, `/api/formularios/enviar` queden bloqueadas o reflejen el estado de cuenta rechazado.
   - Envío de comprobante vía `/api/usuario/notificar-ya-pague`.
   - Aprobación por `admin_cuentas` y verificación de desbloqueo exitoso.
2. **Flujo Completo de Licencia Nueva Paso a Paso**:
   - Registro Usuario B -> Aprobación Admin Cuentas -> Charlas (4/4 videos) -> Envío de Salud -> Aprobación Admin Salud -> Examen Teórico (5 preguntas, validación de score >= 4) -> Pago ($12.500) -> Aprobación Admin Pagos -> Reserva Turno Práctico -> Aprobación Admin Turnos con Huella y Foto -> Emisión Licencia Digital y Entrega.
3. **Flujo de Renovación Abreviada (PBA)**:
   - Usuario C (Renovación) -> Aprobación Admin Cuentas -> Salto directo a Salud -> Aprobación -> Pago -> Emisión automática sin exámenes teórico ni práctico.
4. **Verificación de Reglas de Edad (PBA)**:
   - Menores (16-17 años): vigencia de licencia de 1 año.
   - Adultos (18-65 años): vigencia de 5 años.
5. **Auditoría de Roles y Permisos en Paneles**:
   - Comprobar que un token de `admin_salud` no pueda operar turnos ni pagos.
   - Comprobar que `admin_profesores` pueda gestionar preguntas y proctoring.

---

## 7. Brechas Detectadas y Recomendaciones de Eficiencia

### Brechas en las Pruebas Existentes
1. **Omisión de Admin Cuentas en `test_suite.py`**:
   La suite principal existente (`test_suite.py`) no cubre ningún endpoint de `admin_cuentas` ni el circuito de multas. Es imprescindible que el equipo de testing ejecute una suite complementaria que certifique este circuito de principio a fin.
2. **Falta de Validación de Intentos Múltiples de Examen**:
   El examen teórico está configurado como un único intento, pero no existía una prueba automatizada que valide el rechazo cuando un usuario desaprobado intenta rendir inmediatamente de nuevo sin reasignación docente.
3. **Dependencia de la Ruta de Python en Windows**:
   `iniciar.bat` usa `python app.py`, lo que produce error en equipos donde `python.exe` está vinculado al Store stub. Se recomienda documentar para el entorno local la llamada explícita o mediante entorno virtual (`.venv`).

### Recomendaciones de Eficiencia
1. **Unificación de Runners**:
   Disponer de un runner unificado que ejecute tanto la verificación E2E de la API como la validación de multas con reporte automatizado de aprobados/fallidos.
2. **Aislamiento de Pruebas con Base de Datos Temporal**:
   Para ejecuciones de CI o testing intensivo, permitir inyectar una variable de entorno `TEST_DB_PATH=:memory:` o una ruta temporal para no saturar `licencias.db` con registros de prueba.
