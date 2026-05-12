#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/totemdigital"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/totemdigital"
BIN_DIR="$HOME/.local/bin"
AUTOSTART_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

ENV_FILE="$CONFIG_DIR/player-v3x.env"
RUNNER_FILE="$BIN_DIR/totemdigital-player-v3x-kiosk"
AUTOSTART_FILE="$AUTOSTART_DIR/totemdigital-player-v3x.desktop"
SYSTEMD_UNIT_FILE="$SYSTEMD_USER_DIR/totemdigital-player-v3x.service"

SERVER_URL="${SERVER_URL:-}"
TOTEM_UIN="${TOTEM_UIN:-}"
ORIENTATION="${ORIENTATION:-landscape}"
REGISTER_ON_START=false
INSTALL_DEPS=false
DRY_RUN=false
USE_SYSTEMD_USER=false
ENABLE_LINGER=false

usage() {
  cat <<'EOF'
Uso:
  scripts/install-player-v3x-linux-kiosk.sh --server URL --uin CODIGO [opcoes]

Opcoes:
  --server URL       URL base do TotemDigital (ex.: http://192.168.1.10)
  --uin CODIGO      Codigo/UIN da tela (ex.: TD-1234-ABCD)
  --register        Abre o player com register=1 na primeira execucao
  --orientation M   landscape ou portrait (default: landscape)
  --install-deps    Instala dependencias apt basicas (chromium, unclutter, x11-xserver-utils)
  --systemd-user    Usa systemd --user em vez de entrada XDG autostart (nao misture os dois)
  --linger          Executa sudo loginctl enable-linger (user systemd no boot; Chromium ainda exige sessao grafica)
  --dry-run         Mostra o que seria criado sem escrever arquivos
  -h, --help        Mostra esta ajuda

Exemplo:
  scripts/install-player-v3x-linux-kiosk.sh \
    --server http://192.168.1.10 \
    --uin TD-1234-ABCD \
    --register \
    --install-deps

Exemplo com systemd (recomendado em Ubuntu com sessao grafica):
  scripts/install-player-v3x-linux-kiosk.sh \
    --server http://192.168.1.10 \
    --uin TD-1234-ABCD \
    --systemd-user \
    --install-deps

Exemplo piloto com linger (sudo) + systemd user:
  scripts/install-player-v3x-linux-kiosk.sh \
    --server http://192.168.1.10 \
    --uin TD-1234-ABCD \
    --systemd-user \
    --linger \
    --install-deps
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server)
      SERVER_URL="${2:-}"
      shift 2
      ;;
    --uin)
      TOTEM_UIN="${2:-}"
      shift 2
      ;;
    --register)
      REGISTER_ON_START=true
      shift
      ;;
    --orientation)
      ORIENTATION="${2:-landscape}"
      shift 2
      ;;
    --install-deps)
      INSTALL_DEPS=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --systemd-user)
      USE_SYSTEMD_USER=true
      shift
      ;;
    --linger)
      ENABLE_LINGER=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Opcao desconhecida: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Nao execute como root. Use um usuario normal com sudo disponivel para --install-deps."
  exit 1
fi

SERVER_URL="${SERVER_URL%/}"
TOTEM_UIN="$(printf '%s' "$TOTEM_UIN" | tr '[:lower:]' '[:upper:]' | tr -d '[:space:]')"

if [[ -z "$SERVER_URL" || -z "$TOTEM_UIN" ]]; then
  echo "Erro: --server e --uin sao obrigatorios."
  usage
  exit 1
fi

if [[ "$ORIENTATION" != "landscape" && "$ORIENTATION" != "portrait" ]]; then
  echo "Erro: --orientation deve ser landscape ou portrait."
  exit 1
fi

if [[ "$INSTALL_DEPS" == "true" ]]; then
  if ! command -v sudo >/dev/null 2>&1; then
    echo "sudo nao encontrado; instale dependencias manualmente."
    exit 1
  fi
  sudo apt update
  sudo apt install -y chromium-browser unclutter x11-xserver-utils
fi

BROWSER_CMD=""
for candidate in chromium-browser chromium google-chrome-stable google-chrome; do
  if command -v "$candidate" >/dev/null 2>&1; then
    BROWSER_CMD="$(command -v "$candidate")"
    break
  fi
done

if [[ -z "$BROWSER_CMD" ]]; then
  echo "Chromium/Chrome nao encontrado. Use --install-deps ou instale chromium-browser."
  exit 1
fi

PLAYER_URL="${SERVER_URL}/player?server=${SERVER_URL}&uin=${TOTEM_UIN}"
if [[ "$REGISTER_ON_START" == "true" ]]; then
  PLAYER_URL="${PLAYER_URL}&register=1"
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry-run:"
  echo "  ENV_FILE=$ENV_FILE"
  echo "  RUNNER_FILE=$RUNNER_FILE"
  echo "  USE_SYSTEMD_USER=$USE_SYSTEMD_USER"
  if [[ "$USE_SYSTEMD_USER" == "true" ]]; then
    echo "  SYSTEMD_UNIT_FILE=$SYSTEMD_UNIT_FILE"
  else
    echo "  AUTOSTART_FILE=$AUTOSTART_FILE"
  fi
  echo "  BROWSER_CMD=$BROWSER_CMD"
  echo "  PLAYER_URL=$PLAYER_URL"
  echo "  ENABLE_LINGER=$ENABLE_LINGER"
  if [[ "$ENABLE_LINGER" == "true" ]]; then
    echo "  (linger) sudo loginctl enable-linger $(id -un)"
  fi
  exit 0
fi

mkdir -p "$CONFIG_DIR" "$STATE_DIR" "$BIN_DIR"
if [[ "$USE_SYSTEMD_USER" == "true" ]]; then
  mkdir -p "$SYSTEMD_USER_DIR"
else
  mkdir -p "$AUTOSTART_DIR"
fi

cat > "$ENV_FILE" <<EOF
SERVER_URL="$SERVER_URL"
TOTEM_UIN="$TOTEM_UIN"
PLAYER_URL="$PLAYER_URL"
ORIENTATION="$ORIENTATION"
BROWSER_CMD="$BROWSER_CMD"
EOF

cat > "$RUNNER_FILE" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/totemdigital"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/totemdigital"
ENV_FILE="$CONFIG_DIR/player-v3x.env"
LOG_FILE="$STATE_DIR/player-v3x-kiosk.log"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Config nao encontrada: $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$STATE_DIR"
# shellcheck disable=SC1090
source "$ENV_FILE"

if command -v unclutter >/dev/null 2>&1; then
  unclutter -idle 5 -root >/dev/null 2>&1 &
fi

xset s off >/dev/null 2>&1 || true
xset -dpms >/dev/null 2>&1 || true
xset s noblank >/dev/null 2>&1 || true

if [[ "${ORIENTATION:-landscape}" == "portrait" ]] && command -v xrandr >/dev/null 2>&1; then
  output="$(xrandr --query 2>/dev/null | awk '/ connected/{print $1; exit}')"
  if [[ -n "$output" ]]; then
    xrandr --output "$output" --rotate right >/dev/null 2>&1 || true
  fi
fi

while true; do
  echo "$(date -Is) iniciando Player V3x: $PLAYER_URL" >> "$LOG_FILE"
  "$BROWSER_CMD" \
    --kiosk \
    --no-first-run \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --start-maximized \
    --autoplay-policy=no-user-gesture-required \
    --disable-translate \
    --noerrdialogs \
    --disable-dev-shm-usage \
    --disable-extensions \
    --disable-sync \
    --disable-background-networking \
    --disable-default-apps \
    "$PLAYER_URL" >> "$LOG_FILE" 2>&1 || true
  echo "$(date -Is) Chromium saiu; reiniciando em 5s" >> "$LOG_FILE"
  sleep 5
done
EOF

chmod +x "$RUNNER_FILE"

if [[ "$USE_SYSTEMD_USER" == "true" ]]; then
  rm -f "$AUTOSTART_FILE"
  cat > "$SYSTEMD_UNIT_FILE" <<EOF
[Unit]
Description=TotemDigital Player V3x (Chromium kiosk)
After=graphical-session.target

[Service]
Type=simple
ExecStart=$RUNNER_FILE
Restart=on-failure
RestartSec=15

[Install]
WantedBy=default.target
EOF
  if command -v systemctl >/dev/null 2>&1; then
    systemctl --user daemon-reload
    systemctl --user enable totemdigital-player-v3x.service
    echo "Servico systemd user ativado. Inicie com: systemctl --user start totemdigital-player-v3x.service"
  else
    echo "Aviso: systemctl nao encontrado. Depois de instalar systemd, execute:"
    echo "  systemctl --user daemon-reload"
    echo "  systemctl --user enable --now totemdigital-player-v3x.service"
  fi
else
  cat > "$AUTOSTART_FILE" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=TotemDigital Player V3x
Comment=Player Oficial V3x em Chromium Kiosk
Exec=$RUNNER_FILE
Terminal=false
X-GNOME-Autostart-enabled=true
EOF
  if command -v systemctl >/dev/null 2>&1; then
    if systemctl --user is-enabled totemdigital-player-v3x.service &>/dev/null; then
      echo "Aviso: totemdigital-player-v3x.service (systemd user) ainda esta ativo."
      echo "  Desative para evitar dois players: systemctl --user disable --now totemdigital-player-v3x.service"
    fi
  fi
fi

if [[ "$ENABLE_LINGER" == "true" ]]; then
  if ! command -v sudo >/dev/null 2>&1; then
    echo "Erro: --linger requer sudo no PATH."
    exit 1
  fi
  if ! command -v loginctl >/dev/null 2>&1; then
    echo "Erro: loginctl nao encontrado (systemd/logind)."
    exit 1
  fi
  echo "Ativando linger para o utilizador $(id -un)..."
  sudo loginctl enable-linger "$(id -un)"
  echo "Linger ativo. Verificar: loginctl show-user $(id -un) -p Linger"
  if [[ "$USE_SYSTEMD_USER" != "true" ]]; then
    echo "Nota: combine --linger com --systemd-user para unidades user estaveis em piloto."
  fi
fi

echo "Player Oficial V3x configurado."
echo "Config: $ENV_FILE"
echo "Runner: $RUNNER_FILE"
if [[ "$USE_SYSTEMD_USER" == "true" ]]; then
  echo "Systemd user: $SYSTEMD_UNIT_FILE"
else
  echo "Autostart: $AUTOSTART_FILE"
fi
echo "URL: $PLAYER_URL"
echo ""
echo "Para testar agora:"
echo "  $RUNNER_FILE"
echo ""
echo "Logs:"
echo "  $STATE_DIR/player-v3x-kiosk.log"
