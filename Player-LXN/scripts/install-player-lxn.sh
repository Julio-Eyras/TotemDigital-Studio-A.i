#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="player-lxn-http.service"
AUTOSTART_DIR="$HOME/.config/autostart"
AUTOSTART_FILE="$AUTOSTART_DIR/player-lxn-kiosk.desktop"
SYSTEMD_DIR="$HOME/.config/systemd/user"
PORT="${PLAYER_LXN_PORT:-17890}"

echo "== Install Player-LXN (Ubuntu kiosk) =="
echo "Root: $ROOT"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 nao encontrado."
  exit 1
fi

CHROMIUM_CMD=""
if command -v chromium-browser >/dev/null 2>&1; then
  CHROMIUM_CMD="chromium-browser"
elif command -v chromium >/dev/null 2>&1; then
  CHROMIUM_CMD="chromium"
else
  echo "Chromium nao encontrado. No Ubuntu use:"
  echo "  sudo apt update && sudo apt install -y chromium-browser"
  exit 1
fi

mkdir -p "$HOME/.config/player-lxn"
cp -f "$ROOT/config/player-config.json" "$HOME/.config/player-lxn/player-config.json"

mkdir -p "$SYSTEMD_DIR"
cat > "$SYSTEMD_DIR/$SERVICE_NAME" <<EOF
[Unit]
Description=Player-LXN HTTP local server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$ROOT
ExecStart=/usr/bin/env python3 -m http.server $PORT --directory "$ROOT"
Restart=always
RestartSec=2

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE_NAME"

mkdir -p "$AUTOSTART_DIR"
cat > "$AUTOSTART_FILE" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=Player-LXN Kiosk
Comment=SmartSignage Player-LXN em modo kiosk
Exec=$CHROMIUM_CMD --kiosk --app=http://127.0.0.1:$PORT --autoplay-policy=no-user-gesture-required --disable-infobars --no-first-run --disable-translate
Terminal=false
X-GNOME-Autostart-enabled=true
EOF

chmod +x "$AUTOSTART_FILE"

echo ""
echo "OK: servico user systemd ativo: $SERVICE_NAME"
echo "OK: autostart criado: $AUTOSTART_FILE"
echo "URL local: http://127.0.0.1:$PORT"
echo ""
echo "Comandos uteis:"
echo "  systemctl --user status $SERVICE_NAME"
echo "  systemctl --user restart $SERVICE_NAME"
