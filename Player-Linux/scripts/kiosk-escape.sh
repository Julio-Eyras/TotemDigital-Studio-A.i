#!/bin/sh
# Equivalente Linux ao menu 3× OK do Player-AD: overlay debug + cursor/DPMS (SIGUSR1).
set -e
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet player-linux 2>/dev/null; then
  systemctl kill -s USR1 player-linux
  echo "SIGUSR1 enviado ao serviço player-linux"
  exit 0
fi
pkill -USR1 -x player-linux 2>/dev/null || pkill -USR1 -f '/player-linux ' || {
  echo "player-linux não está a correr" >&2
  exit 1
}
echo "SIGUSR1 enviado ao processo player-linux"
