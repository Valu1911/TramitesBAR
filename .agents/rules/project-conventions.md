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
│       ├── app.js       # Router SPA + Toast system + renderNavbar
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
- **Icons**: Acceder mediante `Icons.nombreIcono` (strings SVG inline)
- **HTML en JS**: Template literals con backticks, HTML embebido directamente
- **No usar frameworks**: ni React, ni Vue, ni Angular. Todo vanilla JS.

### CSS
- **Archivo único**: `css/styles.css` contiene todo el design system
- **Variables**: Definidas en `:root` con prefijos semánticos (`--primary`, `--bg`, `--text-primary`)
- **Naming**: Kebab-case BEM-like (`glass-card`, `btn-primary`, `form-input`, `step-card--completed`)
- **Dark mode**: Clase `.dark` en body, override de variables en `.dark { ... }`
- **Responsive**: Media queries al final de cada sección de componente
- **Animaciones**: Clases utilitarias (`animate-fadeIn`, `animate-slideUp`)

### Python (Backend)
- **Encoding**: `# -*- coding: utf-8 -*-` en la primera línea
- **Decoradores de auth**: `@token_required` para endpoints protegidos, `@admin_required` para admin
- **Respuestas**: Siempre `jsonify()` con códigos HTTP apropiados
- **Queries**: Usar `execute_query()` del módulo `db.py`

### General
- **Idioma**: Todo en español (labels, mensajes, comentarios, variables descriptivas)
- **Sin build step**: Los archivos se sirven directamente, sin bundler ni transpilador
- **Versionado**: Query params en los scripts (`?v=4`, `?v=5`) para cache-busting
