#!/usr/bin/env bash
# Repara Nginx HTTPS: site na / + painel em /login + painel HTTP :8080
# Uso (utilizador normal, NÃO root):
#   cd ~/TotemDigital-Studio && bash scripts/apply-https-unified-443.sh
set -euo pipefail

# install-smartsignage.sh recusa EUID=0 — se veio com sudo, reexecuta como o user real.
if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  if [[ -n "${SUDO_USER:-}" ]] && [[ "${SUDO_USER}" != "root" ]]; then
    echo "[INFO] A reexecutar como ${SUDO_USER} (o install nao corre como root)..."
    exec sudo -u "$SUDO_USER" -H bash "$0" "$@"
  fi
  echo "[ERRO] Nao execute com sudo/root. Use:"
  echo "  bash scripts/apply-https-unified-443.sh"
  exit 1
fi

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
