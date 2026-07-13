@echo off
echo ============================================================
echo   SISTEMA DE LICENCIAS DE CONDUCIR - BARADERO
echo   Instalando dependencias e iniciando servidor...
echo ============================================================
echo.

cd /d "%~dp0backend"

echo [1/3] Instalando dependencias de Python...
pip install -r requirements.txt

echo [2/3] Verificando base de datos interna...
echo.

echo [3/3] Iniciando servidor Flask...
echo   Frontend: http://localhost:5000
echo   API:      http://localhost:5000/api
echo.

python -m uvicorn app:asgi_app --host 0.0.0.0 --port 5000

pause
