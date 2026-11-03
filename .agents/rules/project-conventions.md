# Project Conventions — TramitesBAR

## Stack Tecnológico
- **Backend**: Python 3 + Flask, API REST con JWT
- **Frontend**: HTML5 + Vanilla CSS + JavaScript ES6+ (SPA sin framework)
- **Base de Datos**: SQLite (integrada, sin configuración externa)
- **Auth**: JWT Bearer tokens en header `Authorization`

## Estructura del Proyecto
```
sistema_licencias/
├── backend/
│   ├── app.py           # Servidor Flask (toda la API)
│   ├── config.py        # Constantes y configuración
│   ├── db.py            # Módulo conexión SQLite
│   └── dni_processor.py # Procesamiento de DNI
├── frontend/
│   ├── index.html       # SPA entry point
│   ├── css/styles.css   # Un solo archivo CSS con design system completo
│   ├── img/             # Assets estáticos
│   └── js/
│       ├── api.js       # ApiService (comunicación con backend)
│       ├── app.js       # Router SPA + Toast system + ConfirmModal + renderNavbar
│       ├── icons.js     # SVG icons como strings
│       ├── dni-scanner.js
│       ├── tutorial.js
│       └── pages/       # Una clase por página
│           ├── login.js
│           ├── registro.js
│           ├── dashboard.js
│           ├── charlas.js
│           ├── examen.js
│           ├── formularios.js
│           ├── pago.js
│           ├── practico.js
│           ├── entrega.js
│           ├── admin-login.js
│           ├── admin-pagos.js
│           ├── admin-salud.js
│           ├── admin-turnos.js
│           ├── admin-profesores.js
│           └── admin-cuentas.js
└── database/
    └── schema.sql
```

## Convenciones de Código

### JavaScript
- **Clases de página**: PascalCase, una por archivo (`LoginPage`, `DashboardPage`, `AdminPagosPage`)
- **Método principal**: `static render(app)` — recibe el div `#app` y renderiza el HTML
- **Routing**: Hash-based (`Router.navigate('pagina')`, `window.location.hash`)
- **API calls**: Siempre usar `ApiService.método()` — nunca fetch directo
- **Toasts**: `Toast.success()`, `Toast.error()`, `Toast.warning()`, `Toast.info()`
- **Modales de Confirmación**: Usar `await ConfirmModal.show({...})` y `await ConfirmModal.prompt({...})` en lugar de `window.confirm()`, `window.prompt()` o `window.alert()`, especialmente para cerrar sesión (`logout` / `adminLogout`) y acciones de administración.
- **Icons**: Acceder exclusivamente mediante `Icons.nombreIcono` (strings SVG inline de trazo limpio Lucide). Prohibido el uso de emojis o símbolos Unicode improvisados en la interfaz.
- **HTML en JS**: Template literals con backticks, HTML embebido directamente
- **No usar frameworks**: ni React, ni Vue, ni Angular. Todo vanilla JS.

### CSS
- **Archivo único**: `css/styles.css` contiene todo el design system
- **Variables**: Definidas en `:root` con prefijos semánticos (`--primary`, `--bg`, `--text-primary`)
- **Naming**: Kebab-case BEM-like (`glass-card`, `btn-primary`, `form-input`, `step-card--completed`)
- **Dark mode**: Clase `.dark` en body disponible únicamente para vistas ciudadanas. **En todas las cuentas de administrador (`admin-*`), el modo oscuro está deshabilitado** y se fuerza el modo claro institucional (`document.body.classList.remove('dark')`).
- **Admin Sidebar**: El encabezado lateral administrativo usa `.sidebar__admin-header` sobrio (`MUNICIPIO DE BARADERO · Panel Administrativo`), sin el bloque cuadrado blanco de logo sobre la sección "Gestión".
- **Responsive**: Media queries al final de cada sección de componente
- **Animaciones**: Clases utilitarias (`animate-fadeIn`, `animate-slideUp`)

### Python (Backend)
- **Encoding**: `# -*- coding: utf-8 -*-` en la primera línea
- **Decoradores de auth**: `@token_required` para endpoints protegidos, `@admin_required` para admin
- **Respuestas**: Siempre `jsonify()` con códigos HTTP apropiados
- **Queries**: Usar `execute_query()` del módulo `db.py`
- **Puerto 5000**: El servidor en `app.py` incluye `liberar_puerto(5000)` al iniciar para asegurar que el puerto `5000` quede libre si otro proceso local lo estaba ocupando, y corre con `use_reloader=False` en Windows para evitar reinicios infinitos de `watchdog`.

### General
- **Idioma**: Todo en español (labels, mensajes, comentarios, variables descriptivas)
- **Sin build step**: Los archivos se sirven directamente, sin bundler ni transpilador
- **Versionado**: Query params en los scripts (`?v=4`, `?v=5`, `?v=6`) para cache-busting
