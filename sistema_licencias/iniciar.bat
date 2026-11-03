@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo   TramitesBAR - Sistema Municipal de Licencias (Baradero)
echo ============================================================
echo.

if not exist "backend\.venv\Scripts\python.exe" (
    echo [1/5] Creando entorno virtual en backend\.venv...
    python -m venv backend\.venv
    if errorlevel 1 (
        echo Error al crear el entorno virtual. Verifica que Python 3.12+ este instalado.
        exit /b 1
    )
)

set "PYTHON=%~dp0backend\.venv\Scripts\python.exe"
set "ALEMBIC=%~dp0backend\.venv\Scripts\alembic.exe"
set "UVICORN=%~dp0backend\.venv\Scripts\uvicorn.exe"

echo [2/5] Instalando dependencias del backend...
"%PYTHON%" -m pip install --disable-pip-version-check -q -r backend\requirements.txt
if errorlevel 1 (
    echo Error al instalar dependencias.
    exit /b 1
)

if not exist ".env" (
    echo [3/5] Generando archivo .env local...
    "%PYTHON%" backend\scripts\generate_env.py
    if errorlevel 1 (
        echo Error al generar .env.
        exit /b 1
    )
) else (
    echo [3/5] Archivo .env detectado.
)

cd /d "%~dp0backend"

echo [4/5] Aplicando migraciones y semilla base...
"%ALEMBIC%" upgrade head
if errorlevel 1 (
    echo Error al aplicar migraciones. Verifica DATABASE_URL y que MySQL 8.4 este corriendo.
    exit /b 1
)

"%PYTHON%" -m app.cli seed
if errorlevel 1 (
    echo Error al cargar el catalogo inicial.
    exit /b 1
)

echo.
echo [5/5] Iniciando API FastAPI...
echo   API:      http://127.0.0.1:8000
echo   Docs:     http://127.0.0.1:8000/docs
echo   Frontend: En otra terminal ejecuta:
echo             cd sistema_licencias\frontend ^&^& npm install ^&^& npm run dev
echo             (http://127.0.0.1:5173)
echo.

"%UVICORN%" app.main:app --host 127.0.0.1 --port 8000 --reload
