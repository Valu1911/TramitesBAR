#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "  TramitesBAR - Sistema Municipal de Licencias (Baradero)"
echo "============================================================"
echo

if [ ! -x "backend/.venv/bin/python" ]; then
  echo "[1/5] Creando entorno virtual en backend/.venv..."
  python3 -m venv backend/.venv
fi

PYTHON="$SCRIPT_DIR/backend/.venv/bin/python"
ALEMBIC="$SCRIPT_DIR/backend/.venv/bin/alembic"
UVICORN="$SCRIPT_DIR/backend/.venv/bin/uvicorn"

echo "[2/5] Instalando dependencias del backend..."
"$PYTHON" -m pip install --disable-pip-version-check -q -r backend/requirements.txt

if [ ! -f ".env" ]; then
  echo "[3/5] Generando archivo .env local..."
  "$PYTHON" backend/scripts/generate_env.py
else
  echo "[3/5] Archivo .env detectado."
fi

cd "$SCRIPT_DIR/backend"

echo "[4/5] Aplicando migraciones y semilla base..."
"$ALEMBIC" upgrade head
"$PYTHON" -m app.cli seed

echo
echo "[5/5] Iniciando API FastAPI..."
echo "  API:      http://127.0.0.1:8000"
echo "  Docs:     http://127.0.0.1:8000/docs"
echo "  Frontend: En otra terminal ejecutá:"
echo "            cd sistema_licencias/frontend && npm install && npm run dev"
echo "            (http://127.0.0.1:5173)"
echo

exec "$UVICORN" app.main:app --host 127.0.0.1 --port 8000 --reload
