#!/usr/bin/env bash
# Repara HTTPS 443: raiz = site corporativo; /login = painel React.
# Uso: bash scripts/fix-nginx-corporate-root.sh
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  if [[ -n "${SUDO_USER:-}" ]] && [[ "${SUDO_USER}" != "root" ]]; then
    exec sudo -u "$SUDO_USER" -H bash "$0" "$@"
  fi
  echo "[ERRO] Nao execute como root. Use: bash scripts/fix-nginx-corporate-root.sh"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[INFO] Reaplicando Nginx HTTPS unificado (site corporativo em / , painel em /login)..."
bash "$ROOT/scripts/apply-https-unified-443.sh"

echo ""
echo "[OK] Esperado:"
echo "  https://totemdigital.app.br/       → site corporativo"
echo "  https://totemdigital.app.br/login  → painel"
echo "  http://totemdigital.app.br:8080/   → painel HTTP auxiliar"
echo ""
echo "Verificar:"
echo "  curl -sI https://totemdigital.app.br/ | head -10"
echo "  sudo grep -A3 'location / {' /etc/nginx/sites-available/smart-signage | head -20"
