#!/usr/bin/env bash
# Repara Nginx HTTPS: site na / + painel em /login + painel HTTP :8080
# Uso: cd ~/TotemDigital-Studio && sudo bash scripts/apply-https-unified-443.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Garantir painel auxiliar na 8080 (Contabo) mesmo se .env tiver 80
ENVF="${ROOT}/.env"
if [[ -f "$ENVF" ]]; then
  if grep -qE '^SMARTSIGNAGE_SYSTEM_HTTP_PORT=80$' "$ENVF" 2>/dev/null; then
    tmp=$(mktemp)
    grep -vE '^SMARTSIGNAGE_SYSTEM_HTTP_PORT=' "$ENVF" > "$tmp" || true
    echo 'SMARTSIGNAGE_SYSTEM_HTTP_PORT=8080' >> "$tmp"
    mv -f "$tmp" "$ENVF"
    echo "[INFO] SMARTSIGNAGE_SYSTEM_HTTP_PORT corrigido para 8080"
  fi
  if ! grep -qE '^SMARTSIGNAGE_SYSTEM_HTTP_PORT=' "$ENVF" 2>/dev/null; then
    echo 'SMARTSIGNAGE_SYSTEM_HTTP_PORT=8080' >> "$ENVF"
  fi
fi

export SMARTSIGNAGE_SYSTEM_HTTP_PORT="${SMARTSIGNAGE_SYSTEM_HTTP_PORT:-8080}"
exec bash "$ROOT/scripts/install-smartsignage.sh" --apply-le-https-only "$@"
