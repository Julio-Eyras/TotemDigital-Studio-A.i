#!/usr/bin/env bash
# Verificacao rapida pos-instalacao do Player Oficial V3x (Linux kiosk).
# Nao modifica o sistema; apenas imprime OK / WARN / FAIL e sai com codigo 0, 1 ou 2.
set -euo pipefail

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/totemdigital"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/totemdigital"
ENV_FILE="$CONFIG_DIR/player-v3x.env"
RUNNER="${HOME}/.local/bin/totemdigital-player-v3x-kiosk"
AUTOSTART="${XDG_CONFIG_HOME:-$HOME/.config}/autostart/totemdigital-player-v3x.desktop"
SYSTEMD_UNIT="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/totemdigital-player-v3x.service"
LOG_FILE="$STATE_DIR/player-v3x-kiosk.log"

SEVERITY=0

ok() { echo "[OK]   $*"; }
warn() { echo "[WARN] $*"; SEVERITY=$((SEVERITY > 1 ? SEVERITY : 1)); }
fail() { echo "[FAIL] $*"; SEVERITY=2; }

usage() {
  cat <<'EOF'
Uso: scripts/verify-player-v3x-kiosk.sh

Verifica ficheiros do provisionador install-player-v3x-linux-kiosk.sh,
autostart ou systemd user, e (se curl existir) resposta HTTP de /player.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

echo "TotemDigital — verificacao Player V3x kiosk (utilizador: $(id -un))"
echo ""

if [[ -f "$ENV_FILE" ]]; then
  ok "Config: $ENV_FILE"
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  if [[ -n "${SERVER_URL:-}" ]]; then
    ok "SERVER_URL definido"
    if command -v curl >/dev/null 2>&1; then
      code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "${SERVER_URL}/player" 2>/dev/null || echo 000)"
      if [[ "$code" =~ ^(200|301|302|304)$ ]]; then
        ok "GET ${SERVER_URL}/player → HTTP $code"
      else
        warn "GET ${SERVER_URL}/player → HTTP $code (esperado 200/301/302)"
      fi
    else
      warn "curl nao instalado; nao foi testado /player"
    fi
  else
    warn "SERVER_URL vazio no env"
  fi
  if [[ -n "${PLAYER_URL:-}" ]]; then
    ok "PLAYER_URL definido no env"
  else
    warn "PLAYER_URL vazio no env"
  fi
else
  fail "Ficheiro de config ausente: $ENV_FILE (corra o instalador kiosk)"
fi

if [[ -x "$RUNNER" ]]; then
  ok "Runner executavel: $RUNNER"
else
  fail "Runner ausente ou nao executavel: $RUNNER"
fi

if [[ -f "$AUTOSTART" ]]; then
  ok "Autostart XDG: $AUTOSTART"
fi

if [[ -f "$SYSTEMD_UNIT" ]]; then
  ok "Unidade systemd user presente: $SYSTEMD_UNIT"
  if command -v systemctl >/dev/null 2>&1; then
    if systemctl --user is-enabled totemdigital-player-v3x.service &>/dev/null; then
      ok "systemd --user: totemdigital-player-v3x.service enabled"
    else
      warn "systemd: unidade presente mas nao enabled (ou user session sem loginctl)"
    fi
  fi
fi

if [[ ! -f "$AUTOSTART" ]] && [[ ! -f "$SYSTEMD_UNIT" ]]; then
  warn "Nem autostart nem unidade systemd encontrados"
fi

if [[ -f "$LOG_FILE" ]]; then
  sz=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
  ok "Log existe ($LOG_FILE, ${sz} bytes)"
else
  warn "Log ainda nao criado: $LOG_FILE (normal antes da primeira execucao)"
fi

for p in /etc/chromium/policies/managed/totemdigital-v3x.json \
         /etc/chromium-browser/policies/managed/totemdigital-v3x.json; do
  if [[ -f "$p" ]]; then
    ok "Politica Chromium gerida: $p"
  fi
done
if [[ -f "${HOME}/snap/chromium/common/chromium/policies/managed/totemdigital-v3x.json" ]]; then
  ok "Politica Chromium snap presente"
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
