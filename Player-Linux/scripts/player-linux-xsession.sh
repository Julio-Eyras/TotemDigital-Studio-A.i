#!/usr/bin/env bash
# Kiosk X11: desliga screensaver, esconde rato, arranca o player.
set -euo pipefail
DATA="${PLAYER_LINUX_DATA:-/var/lib/player-linux}"
BIN="${PLAYER_LINUX_BIN:-/opt/player-linux/bin/player-linux}"
xset s off -dpms 2>/dev/null || true
xset s noblank 2>/dev/null || true
unclutter -idle 0.1 -root >/dev/null 2>&1 &
exec "$BIN" --data-dir "$DATA"
