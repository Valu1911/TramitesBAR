@echo off
echo ============================================================
echo   SISTEMA DE LICENCIAS DE CONDUCIR - BARADERO
echo   Iniciando Backend FastAPI (Uvicorn)...
echo ============================================================
echo.

cd /d "%~dp0backend"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
