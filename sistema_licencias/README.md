# TramitesBAR — Sistema de Trámites de Licencias de Conducir

Módulo municipal oficial de emisión y renovación de licencias de conducir de la Municipalidad de Baradero (`sistema_licencias`).

## Arquitectura y Stack Tecnológico

- **Backend**: Python 3.12+ / FastAPI / SQLAlchemy 2.0 / Alembic / Pydantic v2
- **Base de Datos**: MySQL 8.4 InnoDB `utf8mb4` (cifrado AES-256-GCM para PII, HMAC-SHA-256 para índices ciegos de DNI)
- **Frontend**: React 19 / TypeScript / Vite / Tailwind CSS / Lucide SVGs (WCAG 2.1 AA)
- **Seguridad**: Autenticación Argon2id, tokens CSRF double-submit con hash en servidor, RBAC con MFA (TOTP) obligatorio para staff municipal, auditoría inmutable encadenada SHA-256

## Requisitos Previos

- Python 3.12+
- Node.js 24 LTS y npm
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
npm install
npm run dev
```

O ejecutá `iniciar_frontend.bat` en Windows.

## Verificación de Calidad

- **Backend Tests**: `cd backend && python -m pytest tests`
- **Backend Lint**: `cd backend && python -m ruff check .`
- **Backend Tipos**: `cd backend && python -m mypy app`
- **Frontend Tipos**: `cd frontend && npm run typecheck`
- **Frontend Lint**: `cd frontend && npm run lint`
- **Frontend Build**: `cd frontend && npm run build`
- **Responsive y accesibilidad**: desde `frontend`, instalar Chromium con `npx playwright install chromium` y ejecutar `npm run test:e2e`. [Alcance y pendientes](../docs/QA_RESPONSIVE.md).

