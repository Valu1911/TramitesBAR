@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo   SISTEMA DE LICENCIAS DE CONDUCIR - BARADERO
echo   Iniciando Backend FastAPI (Uvicorn)...
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
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
