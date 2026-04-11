#!/bin/sh
set -e

echo "[APP] Iniciando SmartSignage (Node + Nginx)"

# Validar frontend
if [ ! -f /usr/share/nginx/html/index.html ]; then
  echo "[APP] ERRO: Frontend não encontrado em /usr/share/nginx/html/index.html"
  exit 1
fi

# Subir API Node
echo "[APP] Iniciando API Node na porta ${PORT:-3000}"
node /app/backend/dist/index.js &
NODE_PID=$!

sleep 1
if ! kill -0 "$NODE_PID" 2>/dev/null; then
  echo "[APP] ERRO: API Node não iniciou"
  exit 1
fi

# Subir Nginx em foreground
echo "[APP] Iniciando Nginx (porta 80)"
exec nginx -g 'daemon off;'


