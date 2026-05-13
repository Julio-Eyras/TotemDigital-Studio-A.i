#!/usr/bin/env bash
# Provisionador opcional: Player V3x via Electron (alternativa experimental ao Chromium kiosk).
# Piloto suportado continua a ser install-player-v3x-linux-kiosk.sh — ver docs/PLAYER_OFICIAL_V3X.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ELECTRON_DIR="$REPO_ROOT/electron-player"

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/totemdigital"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/totemdigital"
BIN_DIR="$HOME/.local/bin"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

ENV_FILE="$CONFIG_DIR/player-v3x-electron.env"
RUNNER_FILE="$BIN_DIR/totemdigital-player-v3x-electron"
SYSTEMD_UNIT_FILE="$SYSTEMD_USER_DIR/totemdigital-player-v3x-electron.service"

SERVER_URL="${SERVER_URL:-}"
TOTEM_UIN="${TOTEM_UIN:-}"
REGISTER_ON_START=false
INSTALL_DEPS=false
DRY_RUN=false
USE_SYSTEMD_USER=false

usage() {
  cat <<'EOF'
Uso:
  scripts/install-player-v3x-electron.sh --server URL --uin CODIGO [opcoes]

Requisitos: Node.js 18+ e npm no PATH (para npm install em electron-player/).

Opcoes:
  --server URL     URL base do TotemDigital (ex.: http://192.168.1.10)
  --uin CODIGO     Codigo/UIN da tela (ex.: TD-1234-ABCD)
  --register       Adiciona register=1 na URL do player (primeira execucao)
  --install-deps   Instala apenas curl (util para healthchecks manuais)
  --systemd-user   Cria unidade systemd --user
  --dry-run        Mostra o que seria criado
  -h, --help       Ajuda

Exemplo:
  scripts/install-player-v3x-electron.sh \
    --server http://192.168.1.10 \
    --uin TD-1234-ABCD \
    --register

Depois:
  ~/.local/bin/totemdigital-player-v3x-electron

Documentacao: electron-player/README.md e docs/ELECTRON_PLAYER_V3X_NEXT.md
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server) SERVER_URL="${2:-}"; shift 2 ;;
    --uin) TOTEM_UIN="${2:-}"; shift 2 ;;
    --register) REGISTER_ON_START=true; shift ;;
    --install-deps) INSTALL_DEPS=true; shift ;;
    --systemd-user) USE_SYSTEMD_USER=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Opcao desconhecida: $1"; usage; exit 1 ;;
  esac
done

if [[ -z "$SERVER_URL" || -z "$TOTEM_UIN" ]]; then
  echo "Erro: --server e --uin sao obrigatorios."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Erro: npm nao encontrado no PATH. Instale Node.js 18+."
  exit 1
fi

if [[ ! -f "$ELECTRON_DIR/package.json" ]]; then
  echo "Erro: pasta electron-player nao encontrada em $ELECTRON_DIR"
  exit 1
fi

PLAYER_URL="${SERVER_URL}/player?server=${SERVER_URL}&uin=${TOTEM_UIN}"
if [[ "$REGISTER_ON_START" == true ]]; then
  PLAYER_URL="${PLAYER_URL}&register=1"
fi

if [[ "$INSTALL_DEPS" == true && "$DRY_RUN" != true ]]; then
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -qq && sudo apt-get install -y curl || true
  fi
fi

if [[ "$DRY_RUN" == true ]]; then
  echo "[dry-run] PLAYER_URL=$PLAYER_URL"
  echo "[dry-run] npm install em $ELECTRON_DIR"
  echo "[dry-run] escreveria: $ENV_FILE"
  echo "[dry-run] escreveria: $RUNNER_FILE"
  [[ "$USE_SYSTEMD_USER" == true ]] && echo "[dry-run] escreveria: $SYSTEMD_UNIT_FILE"
  exit 0
fi

(cd "$ELECTRON_DIR" && npm install --no-audit --no-fund)

mkdir -p "$CONFIG_DIR" "$BIN_DIR" "$STATE_DIR" "$SYSTEMD_USER_DIR"

umask 077
cat >"$ENV_FILE" <<EOF
# Gerado por install-player-v3x-electron.sh
PLAYER_URL=$PLAYER_URL
TOTEMDIGITAL_KIOSK=1
EOF
umask 022

cat >"$RUNNER_FILE" <<EOF
#!/usr/bin/env bash
set -euo pipefail
set -a
# shellcheck source=/dev/null
[[ -f "$ENV_FILE" ]] && . "$ENV_FILE"
set +a
cd "$ELECTRON_DIR"
mkdir -p "$STATE_DIR"
exec npm start >>"$STATE_DIR/player-v3x-electron.log" 2>&1
EOF
chmod 755 "$RUNNER_FILE"

if [[ "$USE_SYSTEMD_USER" == true ]]; then
  NPM_BIN="$(command -v npm)"
  cat >"$SYSTEMD_UNIT_FILE" <<EOF
[Unit]
Description=TotemDigital Player V3x (Electron)
After=graphical-session.target

[Service]
Type=simple
EnvironmentFile=-$ENV_FILE
WorkingDirectory=$ELECTRON_DIR
ExecStart=$NPM_BIN start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF
  if command -v systemctl >/dev/null 2>&1; then
    systemctl --user daemon-reload || true
    echo "Unidade criada. Ative com: systemctl --user enable --now totemdigital-player-v3x-electron.service"
  fi
fi

echo "Concluido."
echo "  URL: $PLAYER_URL"
echo "  Env: $ENV_FILE"
echo "  Runner: $RUNNER_FILE"
echo "  Log:   $STATE_DIR/player-v3x-electron.log"
[[ "$USE_SYSTEMD_USER" == true ]] && echo "  Systemd user: $SYSTEMD_UNIT_FILE"
echo "Verificacao (no repositorio ou copia do script): scripts/verify-player-v3x-electron.sh"
