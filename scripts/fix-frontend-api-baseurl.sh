#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILES=("$ROOT/.env" "$ROOT/backend/.env")

domain=""
for f in "${ENV_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    domain="$(grep -E '^DOMAIN_NAME=' "$f" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)"
    [[ -n "$domain" ]] && break
  fi
done

if [[ -z "$domain" ]]; then
  echo "[ERRO] DOMAIN_NAME não encontrado em .env/backend/.env"
  exit 1
fi

for f in "${ENV_FILES[@]}"; do
  [[ -f "$f" ]] || continue
  tmp="$(mktemp "${TMPDIR:-/tmp}/smartsignage-env.XXXXXX")"
  grep -vE '^REACT_APP_API_URL=|^PUBLIC_API_BASE_URL=' "$f" > "$tmp" || true
  {
    echo "REACT_APP_API_URL=https://${domain}/api"
    echo "PUBLIC_API_BASE_URL=https://${domain}/api"
  } >> "$tmp"
  cp "$tmp" "$f"
  rm -f "$tmp"
  echo "[OK] URLs de API corrigidas em $f"
done

cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then
  echo "[ERRO] frontend/node_modules não existe. Reinstale dependências antes do rebuild."
  exit 1
fi

echo "[INFO] Rebuild do frontend com REACT_APP_API_URL=https://${domain}/api"
REACT_APP_API_URL="https://${domain}/api" \
PUBLIC_API_BASE_URL="https://${domain}/api" \
NODE_OPTIONS="--max-old-space-size=4096" \
  npm run build

if [[ -d "$ROOT/frontend/build" ]]; then
  sudo mkdir -p /opt/smart-signage/frontend/build
  sudo rsync -a --delete "$ROOT/frontend/build/" /opt/smart-signage/frontend/build/
  sudo systemctl reload nginx
  echo "[OK] Build publicado e Nginx recarregado."
fi

echo "[INFO] Teste rápido sugerido:"
echo "curl -i -X POST https://${domain}/api/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"admin123\"}'"
