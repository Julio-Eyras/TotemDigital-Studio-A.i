#!/usr/bin/env bash
# Instala o binário Player-Linux, dados, unidade systemd e (opcional) sessão X kiosk.
set -euo pipefail

PREFIX="${PREFIX:-/opt/player-linux}"
DATA="${DATA:-/var/lib/player-linux}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_SRC="${BIN_SRC:-$ROOT/build/player-linux}"

if [[ ! -x "$BIN_SRC" ]]; then
  echo "Binário não encontrado: $BIN_SRC" >&2
  echo "Compile primeiro: cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build" >&2
  exit 1
fi

echo "Instalar Player-Linux em $PREFIX (dados $DATA)"
install -d "$PREFIX/bin" "$PREFIX/share" "$DATA/propagandas" "$DATA/vinhetas" "$DATA/ota" "$DATA/screenshots" "$DATA/telemetry"

install -m 0755 "$BIN_SRC" "$PREFIX/bin/player-linux"
if [[ -f "$ROOT/config/exemplo-player-config.json" ]]; then
  install -m 0644 "$ROOT/config/exemplo-player-config.json" "$PREFIX/share/exemplo-player-config.json"
  if [[ ! -f "$DATA/player-config.json" ]]; then
    install -m 0644 "$ROOT/config/exemplo-player-config.json" "$DATA/player-config.json"
    echo "Copiado exemplo para $DATA/player-config.json — edite serverUrl, uin, deviceId"
  fi
fi

if ! id -u playerlinux >/dev/null 2>&1; then
  useradd --system --home "$DATA" --shell /usr/sbin/nologin playerlinux || true
fi
chown -R playerlinux:playerlinux "$DATA" 2>/dev/null || true

UNIT_SRC="$ROOT/scripts/player-linux.service"
if [[ -f "$UNIT_SRC" ]] && [[ -d /etc/systemd/system ]]; then
  install -m 0644 "$UNIT_SRC" /etc/systemd/system/player-linux.service
  sed -i "s|/opt/player-linux|$PREFIX|g; s|/var/lib/player-linux|$DATA|g" /etc/systemd/system/player-linux.service
  systemctl daemon-reload
  systemctl enable player-linux.service
  echo "Unidade systemd player-linux.service activada (Restart=always)."
  echo "Arranque: systemctl start player-linux  (precisa DISPLAY=:0 no totem)"
fi

XS="$ROOT/scripts/player-linux-xsession.sh"
if [[ -f "$XS" ]]; then
  install -m 0755 "$XS" "$PREFIX/share/player-linux-xsession.sh"
  echo "Sessão kiosk: $PREFIX/share/player-linux-xsession.sh (xset/unclutter + player)"
fi

if [[ -f "$ROOT/scripts/kiosk-escape.sh" ]]; then
  install -m 0755 "$ROOT/scripts/kiosk-escape.sh" "$PREFIX/bin/kiosk-escape.sh"
fi
if [[ -d /etc/xdg/autostart && -f "$ROOT/scripts/player-linux.desktop" ]]; then
  install -m 0644 "$ROOT/scripts/player-linux.desktop" /etc/xdg/autostart/player-linux.desktop
fi

echo "Escape de kiosk (equiv. 3× OK): $PREFIX/bin/kiosk-escape.sh  ou  kill -USR1 \$(pidof player-linux)"
echo "OK. Paridade alvo Player-AD 2.15/115. platform=linux"
