@echo off
echo ============================================================
echo   SISTEMA DE LICENCIAS DE CONDUCIR - BARADERO
echo   Instalando dependencias e iniciando servidor...
echo ============================================================
echo.

cd /d "%~dp0backend"

echo [1/3] Instalando dependencias de Python...
pip install -r requirements.txt

echo.
echo [2/3] IMPORTANTE: Antes de continuar, asegurate de:
echo   - Tener WAMP Server corriendo
echo   - MySQL activo en localhost:3306
echo   - Haber importado el archivo database\schema.sql en phpMyAdmin
echo.

echo [3/3] Iniciando servidor Flask...
echo   Frontend: http://localhost:5000
echo   API:      http://localhost:5000/api
echo.

python app.py

pause
