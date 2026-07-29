# CARPETA DE CAMPO - SISTEMA DE LICENCIAS BARADERO
## Registro de Progreso y Documentación Técnica

---

### 1. Diagnóstico Inicial del Entorno
Al recibir el proyecto, se detectó una discrepancia entre el entorno de ejecución asumido y la arquitectura real del sistema. Se intentaron ejecutar comandos pertenecientes al ecosistema Node.js (`npm install`, `bun install`, `npm run dev`), los cuales resultaron en error ya que la aplicación no depende de `package.json`.
- **Resolución**: Se analizó la estructura de directorios y el archivo `iniciar.bat`, confirmando que el backend está desarrollado en **Python (Flask / Uvicorn)** y la base de datos se aloja en **MySQL (WAMP Server)**. El frontend consta de HTML, CSS y JS clásicos (Vanilla) comunicándose vía API REST.

---

### 2. Migración y Corrección de Base de Datos (SQLite a MySQL)
Durante la importación del esquema SQL en phpMyAdmin, se detectaron y corrigieron múltiples errores de compatibilidad originados por el dialecto de la base de datos original (presumiblemente SQLite). 

Se realizaron las siguientes intervenciones en `database/schema.sql`:

1. **Error #1064 (Sintaxis AUTOINCREMENT)**: 
   - **Problema**: SQLite utiliza la palabra reservada `AUTOINCREMENT`, mientras que MySQL estandariza `AUTO_INCREMENT`.
   - **Solución**: Se reemplazaron todas las instancias (12 tablas afectadas) a `AUTO_INCREMENT` para cumplir con el estándar MySQL.

2. **Error #1046 (Base de datos no seleccionada)**:
   - **Problema**: El script creaba las tablas pero no instanciaba ni seleccionaba la base de datos contenedora.
   - **Solución**: Se insertaron las sentencias `CREATE DATABASE IF NOT EXISTS sistema_licencias` y `USE sistema_licencias` en la cabecera del archivo.

3. **Error #1101 (Valores DEFAULT en campos TEXT/BLOB)**:
   - **Problema**: El modo estricto de MySQL no permite que columnas de tipo `TEXT` tengan valores por defecto (ej. `DEFAULT 'nueva'`).
   - **Solución**: Se refactorizaron estas columnas a tipo `VARCHAR(50)` para campos de estado cortos (ej. 'pendiente', 'en_progreso', 'reservado') y se eliminó la restricción `DEFAULT ''` en campos extensos (ej. descripciones), reemplazándola por campos `TEXT` que admiten nulos o vacíos desde la aplicación.

---

### 3. Configuración del Servidor y Dependencias (Python/Uvicorn)
Se documentó el proceso para arrancar el servidor backend necesario para abastecer la API. 
1. Instalación de dependencias: `pip install -r requirements.txt`.
2. Ejecución mediante `uvicorn` (ASGI): `python -m uvicorn app:asgi_app --host 127.0.0.1 --port 5000 --reload`.
3. **Soporte Técnico**: Se guió en la instalación y configuración del entorno de Python en Windows, resolviendo el error del sistema operativo que no reconocía el comando por falta de agregación al PATH (`ejecutar sin argumentos para instalar desde el Microsoft Store`).
4. **CORS**: Se verificó la implementación de `flask-cors` en `app.py`, lo que permitió habilitar el uso de extensiones de desarrollo front-end como *Live Server*.

---

### 4. Interfaz de Usuario: Implementación de Modo Oscuro (Dark Mode)
Se rediseñó la capa de estilos (CSS) y lógica (JS) para soportar un Modo Oscuro nativo a pedido, respetando la paleta de colores azules importada inicialmente, y mejorando la accesibilidad y contraste general.

**Modificaciones en `styles.css`:**
- Se agregó un bloque de variables CSS asociadas a la clase `.dark` asignada al cuerpo del documento.
- Se mapearon colores oscuros profundos (`#0f172a`, `#1e293b`) para los fondos (`--bg`, `--bg-card`, `--bg-elevated`).
- Se invirtieron las paletas tipográficas para garantizar legibilidad, solucionando el problema de **textos blancos sobre fondos claros** que eran ilegibles en el modo claro estándar.
- Se crearon directivas de anulación (`override`) para elementos específicos (Glass Cards, Navbar, Step Cards, Modales, Formularios y Notificaciones Toast) de modo que se integren armoniosamente a los tonos nocturnos sin perder profundidad ni sombras (`box-shadow`).

**Modificaciones en `icons.js`:**
- Se integraron los íconos vectoriales (SVG) `moon` (luna) y `sun` (sol) a la librería de íconos del sistema.

**Modificaciones en `app.js` (Core Application):**
- Se inyectó el botón interruptor (Toggle) dinámico tanto en la barra de navegación pública ciudadana (`renderNavbar`) como en la de gestión (`renderAdminNavbar`).
- Se desarrolló la función `toggleDarkMode()` para gestionar la conmutación de clases.
- Se implementó persistencia de estado mediante `localStorage` (`initTheme()`), logrando que el sistema recuerde la preferencia visual elegida por el usuario incluso tras recargar la página o volver a ingresar en el futuro.
- Se incorporó soporte responsivo nativo: Si el usuario visita por primera vez y su sistema operativo está en modo oscuro (`prefers-color-scheme: dark`), el sistema lo detecta y adopta la paleta oscura automáticamente.

---

### 5. Estado Actual y Siguientes Pasos
- **Estabilidad Backend**: 100% Funcional. Base de datos MySQL instanciada. API conectada en el puerto 5000.
- **Estabilidad Frontend**: 100% Funcional (compatible con LiveServer y servidor interno). Estética mejorada con Modo Oscuro interactivo y adaptable. Flujos SPA sin errores.
- **Autorización de Cambios**: Todas las correcciones técnicas, de interfaz de usuario y arquitectura fueron implementadas en simultáneo tras la directiva de ejecución sin restricciones.

**Sistema listo para pruebas finales de usuarios y administradores.**
