# 🚗 Sistema de Trámites de Licencias de Conducir - Baradero

Sistema web completo para automatizar el proceso de obtención y renovación de licencias de conducir de la Municipalidad de Baradero.

## 📋 Características

### Para Ciudadanos
- **Login por DNI** (cuentas únicas, sin duplicados)
- **Proceso secuencial** obligatorio (no se pueden saltear pasos):
  1. 🎬 **Charlas en video** - Videos de seguridad vial (deben verse en orden)
  2. 🏥 **Formularios de salud** - Datos médicos y certificados
  3. 📝 **Examen teórico** - 5 preguntas aleatorias, un solo intento
  4. 💳 **Pago del arancel** - Transferencia bancaria o tarjeta de débito
  5. 🚗 **Examen práctico** - Selección y reserva de turno
  6. 📦 **Entrega** - Domicilio o retiro presencial

### Para Administradores
- **Panel de Pagos** (`admin_pagos`) - Aprobar/rechazar comprobantes de pago
- **Panel de Salud** (`admin_salud`) - Verificar certificados de salud
- **Panel de Turnos** (`admin_turnos`) - Gestionar turnos y registrar resultados de exámenes prácticos

## 🛠️ Tecnologías

| Componente | Tecnología |
|-----------|-----------|
| Frontend  | HTML5, CSS3 (vanilla), JavaScript (ES6+) |
| Backend   | Python 3 + Flask |
| Base de datos | SQLite (integrada, sin configuración) |
| Auth      | JWT (JSON Web Tokens) |

## 🚀 Instalación y Ejecución

### Requisitos previos
- **Python 3.8+** instalado
- **pip** (gestor de paquetes de Python)

### Paso 1: Dependencias Python
```bash
cd sistema_licencias/backend
pip install -r requirements.txt
```

### Paso 2: Ejecutar
**Opción A** - Doble clic en `iniciar.bat`

**Opción B** - Manual:
```bash
cd sistema_licencias/backend
python app.py
```

### Paso 3: Acceder
- **Frontend**: http://localhost:5000
- **API**: http://localhost:5000/api

## 👤 Credenciales

### Usuarios (ciudadanos)
- Ingresá cualquier DNI de 7-8 dígitos
- Si no existe, se te pedirá completar el registro

### Administradores
| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `admin_pagos` | `admin123` | Gestión de pagos |
| `admin_salud` | `admin123` | Verificación de certificados |
| `admin_turnos` | `admin123` | Gestión de turnos y exámenes |

## 📁 Estructura del Proyecto

```
sistema_licencias/
├── database/
│   └── schema.sql          # Schema MySQL completo
├── backend/
│   ├── app.py              # Servidor Flask (API)
│   ├── config.py           # Configuración
│   ├── db.py               # Módulo de conexión MySQL
│   └── requirements.txt    # Dependencias Python
├── frontend/
│   ├── index.html          # Página principal (SPA)
│   ├── css/
│   │   └── styles.css      # Diseño completo
│   └── js/
│       ├── api.js           # Servicio de comunicación con API
│       ├── app.js           # Router SPA + Toasts + Navbar
│       └── pages/
│           ├── login.js         # Login por DNI
│           ├── registro.js      # Registro de nuevo usuario
│           ├── dashboard.js     # Panel principal
│           ├── charlas.js       # Videos de seguridad vial
│           ├── examen.js        # Examen teórico
│           ├── formularios.js   # Formularios de salud
│           ├── pago.js          # Pago del arancel
│           ├── practico.js      # Examen práctico (turnos)
│           ├── entrega.js       # Entrega de licencia
│           ├── admin-login.js   # Login administrador
│           ├── admin-pagos.js   # Panel admin pagos
│           ├── admin-salud.js   # Panel admin salud
│           └── admin-turnos.js  # Panel admin turnos
├── iniciar.bat              # Script de inicio rápido
└── README.md                # Este archivo
```

## ⚙️ Configuración

Editá `backend/config.py` para ajustar:
- **Conexión MySQL**: host, puerto, usuario, contraseña
- **Monto del arancel**: `MONTO_LICENCIA`
- **Datos bancarios**: alias y CBU
- **Examen**: cantidad de preguntas y mínimo para aprobar

## 🎨 Diseño

- Paleta de colores **azules y celestes** armónicos
- Efecto **glassmorphism** en tarjetas
- **Micro-animaciones** y transiciones suaves
- Diseño **responsive** (móvil y escritorio)
- Tipografía **Inter** de Google Fonts
