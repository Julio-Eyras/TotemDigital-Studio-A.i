#!/usr/bin/env bash
# Verificacao rapida pos-instalacao do Player V3x (Linux Electron opcional).
# Nao modifica o sistema; apenas imprime OK / WARN / FAIL e sai com codigo 0, 1 ou 2.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ELECTRON_DIR="$REPO_ROOT/electron-player"

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/totemdigital"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/totemdigital"
ENV_FILE="$CONFIG_DIR/player-v3x-electron.env"
RUNNER="${HOME}/.local/bin/totemdigital-player-v3x-electron"
SYSTEMD_UNIT="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/totemdigital-player-v3x-electron.service"
LOG_FILE="$STATE_DIR/player-v3x-electron.log"

SEVERITY=0

ok() { echo "[OK]   $*"; }
warn() { echo "[WARN] $*"; SEVERITY=$((SEVERITY > 1 ? SEVERITY : 1)); }
fail() { echo "[FAIL] $*"; SEVERITY=2; }

usage() {
  cat <<'EOF'
Uso: scripts/verify-player-v3x-electron.sh

Verifica ficheiros do provisionador install-player-v3x-electron.sh,
node_modules em electron-player/, runner, log, systemd user opcional,
e (se curl existir) resposta HTTP do endpoint /player no servidor inferido.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

echo "TotemDigital — verificacao Player V3x Electron (utilizador: $(id -un))"
echo ""

if [[ -f "$ENV_FILE" ]]; then
  ok "Config: $ENV_FILE"
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
  if [[ -n "${PLAYER_URL:-}" ]]; then
    ok "PLAYER_URL definido"
    if command -v curl >/dev/null 2>&1; then
      code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 12 "${PLAYER_URL}" 2>/dev/null || echo 000)"
      if [[ "$code" =~ ^(200|301|302|304)$ ]]; then
        ok "GET PLAYER_URL → HTTP $code"
      else
        warn "GET PLAYER_URL → HTTP $code (esperado 200/301/302; servidor pode estar offline)"
      fi
    else
      warn "curl nao instalado; nao foi testado PLAYER_URL"
    fi
  else
    warn "PLAYER_URL vazio no env"
  fi
else
  fail "Ficheiro de config ausente: $ENV_FILE (corra install-player-v3x-electron.sh)"
fi

if [[ -x "$RUNNER" ]]; then
  ok "Runner executavel: $RUNNER"
else
  fail "Runner ausente ou nao executavel: $RUNNER"
fi

if [[ -d "$ELECTRON_DIR/node_modules/electron" ]]; then
  ok "Dependencias npm em electron-player/ (pacote electron instalado)"
elif [[ -d "$ELECTRON_DIR/node_modules" ]]; then
  warn "node_modules presente mas pacote electron nao detetado — corra npm install em electron-player/"
else
  warn "node_modules ausente em $ELECTRON_DIR — corra install-player-v3x-electron.sh ou npm install"
fi

if [[ -f "$SYSTEMD_UNIT" ]]; then
  ok "Unidade systemd user presente: $SYSTEMD_UNIT"
  if command -v systemctl >/dev/null 2>&1; then
    if systemctl --user is-enabled totemdigital-player-v3x-electron.service &>/dev/null; then
      ok "systemd --user: totemdigital-player-v3x-electron.service enabled"
    else
      warn "systemd: unidade presente mas nao enabled"
    fi
  fi
else
  warn "Unidade systemd Electron nao encontrada (opcional se usa apenas o runner manual)"
fi

if [[ -f "$LOG_FILE" ]]; then
  sz=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
  ok "Log existe ($LOG_FILE, ${sz} bytes)"
else
  warn "Log ainda nao criado: $LOG_FILE (normal antes da primeira execucao)"
fi

echo ""
if [[ "$SEVERITY" -eq 0 ]]; then
  echo "Resumo: sem problemas detetados."
  exit 0
fi
if [[ "$SEVERITY" -eq 1 ]]; then
  echo "Resumo: avisos — reveja antes do piloto."
  exit 1
fi
echo "Resumo: falhas — corrija antes de usar em producao."
exit 2
