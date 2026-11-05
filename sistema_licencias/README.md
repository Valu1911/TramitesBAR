<<<<<<< HEAD
# TramitesBAR — Módulo de Licencias de Conducir (`sistema_licencias`)

Módulo municipal para la gestión de licencias de conducir de la Municipalidad de Baradero. Está diseñado como componente independiente integrable al portal SUBI (`guia-tramites-Baradero`).

## Stack técnico

| Capa | Tecnología |
|---|---|
| Backend | Python 3.12+, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| Base de datos | MySQL 8.4 (`InnoDB`, `utf8mb4`) |
| Autenticación y seguridad | Argon2id (`m=64 MiB`, `t=3`, `p=4`), sesiones opacas en cookie `httpOnly` + CSRF double-submit, MFA TOTP obligatorio para personal municipal, cifrado AES-256-GCM e índice ciego HMAC-SHA-256 para DNI |
| Rate limiting y colas | Redis (ventana deslizante en producción) + worker de correo transaccional (`app.worker`) |
| Almacenamiento | Local fuera del webroot en desarrollo (`storage/`) y S3/MinIO en producción |
| Frontend | React 19, TypeScript, Vite, React Router 7, CSS institucional propio |

## Estructura del módulo

```text
sistema_licencias/
├── .env.example          # Plantilla de variables de entorno (sin secretos)
├── iniciar.bat           # Arranque rápido para Windows
├── iniciar.sh            # Arranque rápido para Linux / macOS
├── backend/
│   ├── alembic/          # Migraciones de esquema relacional
│   ├── app/
│   │   ├── api/v1/       # Rutas HTTP (/api/v1/* y /health*)
│   │   ├── core/         # Configuración, base de datos, seguridad, permisos y rate limit
│   │   ├── domain/       # Enumeraciones y constantes de negocio
│   │   ├── models/       # Modelos SQLAlchemy 2
│   │   ├── schemas/      # Contratos Pydantic de entrada y salida
│   │   ├── services/     # Lógica de dominio, pagos, exámenes, auditoría y Bari
│   │   ├── cli.py        # Comandos administrativos por consola
│   │   ├── main.py       # Punto de entrada FastAPI y middlewares
│   │   ├── seed.py       # Catálogo inicial (sin usuarios ni datos demo)
│   │   └── worker.py     # Proceso de envío de correo y purga de sesiones/tokens
│   ├── scripts/
│   │   └── generate_env.py
│   └── tests/            # Suite de tests con pytest
└── frontend/
    ├── src/
    │   ├── api/          # Cliente HTTP tipado con soporte CSRF
    │   ├── auth/         # Contexto de sesión y guardas de ruta/políticas
    │   ├── components/   # Layout, iconos SVG y widget de Bari
    │   └── pages/        # Vistas públicas, del ciudadano y del backoffice
    └── package.json
```

## Puesta en marcha local

### 1. Requisitos previos

- Python 3.12 o superior
- Node.js 20 o superior y npm
- MySQL 8.4 (local en WAMP o mediante `docker compose -f ../docker-compose.dev.yml up -d`)

### 2. Configurar variables de entorno

Desde `sistema_licencias/backend`:

```bash
python scripts/generate_env.py
```

Esto genera `sistema_licencias/.env` con claves criptográficas aleatorias (`SECRET_KEY`, `ENCRYPTION_KEY`, `DNI_HMAC_KEY`). Ajustar `DATABASE_URL` con las credenciales locales de MySQL (`tramites_bar`).

### 3. Migrar base de datos y poblar catálogo inicial

```bash
cd sistema_licencias/backend
alembic upgrade head
python -m app.cli seed
```

El comando `seed` carga únicamente tipos de trámite, matriz inicial configurable, materiales de lectura, políticas legales versión 1 y banco base de preguntas. **No crea cuentas por defecto ni contraseñas predefinidas.**

### 4. Crear cuentas operativas

Las cuentas del personal municipal se crean por consola y exigen enrolar MFA TOTP en el primer inicio de sesión:

```bash
cd sistema_licencias/backend

# Crear superadministrador inicial
python -m app.cli create-superadmin --email sistemas@baradero.gob.ar

# Crear personal municipal por rol (admin, admin_pagos, admin_salud, admin_turnos, admin_cuentas)
python -m app.cli create-staff --email pagos@baradero.gob.ar --role admin_pagos
```

### 5. Levantar servicios

Backend (puerto `8000`):

```bash
cd sistema_licencias/backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Worker de correo y mantenimiento (opcional en desarrollo si `EMAIL_TRANSPORT=console`):

```bash
cd sistema_licencias/backend
python -m app.worker
```

Frontend (puerto `5173`):

```bash
cd sistema_licencias/frontend
=======
# TramitesBAR — Sistema de Trámites de Licencias de Conducir

Módulo municipal oficial de emisión y renovación de licencias de conducir de la Municipalidad de Baradero (`sistema_licencias`).

## Arquitectura y Stack Tecnológico

- **Backend**: Python 3.12+ / FastAPI / SQLAlchemy 2.0 / Alembic / Pydantic v2
- **Base de Datos**: MySQL 8.4 InnoDB `utf8mb4` (cifrado AES-256-GCM para PII, HMAC-SHA-256 para índices ciegos de DNI)
- **Frontend**: React 19 / TypeScript / Vite / Tailwind CSS / Lucide SVGs (WCAG 2.1 AA)
- **Seguridad**: Autenticación Argon2id, tokens CSRF double-submit con hash en servidor, RBAC con MFA (TOTP) obligatorio para staff municipal, auditoría inmutable encadenada SHA-256

## Requisitos Previos

- Python 3.12+
- Node.js 20+ y npm
- MySQL 8.4 (o SQLite en entorno local de pruebas con migraciones compatibles)

## Puesta en Marcha

### 1. Backend

```bash
cd backend
python -m pip install -r requirements.txt
python -m pip install -r requirements-dev.txt
python scripts/generate_env.py > .env
python -m alembic upgrade head
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

O ejecutá `iniciar.bat` en Windows.

### 2. Frontend

```bash
cd frontend
>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984
npm install
npm run dev
```

<<<<<<< HEAD
También se puede usar `iniciar.bat` (Windows) o `./iniciar.sh` (Linux) desde la carpeta `sistema_licencias/`.

## Verificación de calidad

Backend:

```bash
cd sistema_licencias/backend
ruff check .
mypy app tests
pytest
```

Frontend:

```bash
cd sistema_licencias/frontend
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

## Documentación relacionada

La documentación de arquitectura, modelo de datos, API, seguridad, operación y runbooks está en la carpeta [`../docs/`](../docs/) en la raíz del repositorio.
=======
O ejecutá `iniciar_frontend.bat` en Windows.

## Verificación de Calidad

- **Backend Tests**: `cd backend && python -m pytest tests`
- **Backend Lint**: `cd backend && python -m ruff check .`
- **Backend Tipos**: `cd backend && python -m mypy app`
- **Frontend Tipos**: `cd frontend && npm run typecheck`
- **Frontend Lint**: `cd frontend && npm run lint`
- **Frontend Build**: `cd frontend && npm run build`

>>>>>>> 375601f98034ff3fad8c977a1bdcea7ff8dc8984
