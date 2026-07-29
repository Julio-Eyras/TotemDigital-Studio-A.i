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

# .env muitas vezes fica root:root após installs com sudo — corrigir ownership.
ENVF="${ROOT}/.env"
if [[ -f "$ENVF" ]] && [[ ! -w "$ENVF" ]]; then
  echo "[INFO] .env sem permissao de escrita — a corrigir ownership com sudo..."
  sudo chown "$(id -u):$(id -g)" "$ENVF" 2>/dev/null || true
fi
if [[ -f "${ROOT}/backend/.env" ]] && [[ ! -w "${ROOT}/backend/.env" ]]; then
  sudo chown "$(id -u):$(id -g)" "${ROOT}/backend/.env" 2>/dev/null || true
fi

# Garantir painel auxiliar na 8080 (Contabo) mesmo se .env tiver 80
env_set_system_port_8080() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local tmp
  tmp=$(mktemp "${TMPDIR:-/tmp}/ssp-env.XXXXXX")
  if grep -qE '^SMARTSIGNAGE_SYSTEM_HTTP_PORT=80$' "$f" 2>/dev/null; then
    grep -vE '^SMARTSIGNAGE_SYSTEM_HTTP_PORT=' "$f" > "$tmp" || true
    echo 'SMARTSIGNAGE_SYSTEM_HTTP_PORT=8080' >> "$tmp"
    if [[ -w "$f" ]]; then
      mv -f "$tmp" "$f"
    else
      sudo cp -f "$tmp" "$f"
      sudo chown "$(id -u):$(id -g)" "$f" 2>/dev/null || true
      rm -f "$tmp"
    fi
    echo "[INFO] SMARTSIGNAGE_SYSTEM_HTTP_PORT corrigido para 8080 em $f"
  elif ! grep -qE '^SMARTSIGNAGE_SYSTEM_HTTP_PORT=' "$f" 2>/dev/null; then
    if [[ -w "$f" ]]; then
      echo 'SMARTSIGNAGE_SYSTEM_HTTP_PORT=8080' >> "$f"
    else
      echo 'SMARTSIGNAGE_SYSTEM_HTTP_PORT=8080' | sudo tee -a "$f" >/dev/null
      sudo chown "$(id -u):$(id -g)" "$f" 2>/dev/null || true
    fi
    echo "[INFO] SMARTSIGNAGE_SYSTEM_HTTP_PORT=8080 adicionado em $f"
    rm -f "$tmp"
  else
    rm -f "$tmp"
  fi
}

env_set_system_port_8080 "$ENVF"

export SMARTSIGNAGE_SYSTEM_HTTP_PORT="${SMARTSIGNAGE_SYSTEM_HTTP_PORT:-8080}"
exec bash "$ROOT/scripts/install-smartsignage.sh" --apply-le-https-only "$@"
