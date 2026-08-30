#!/usr/bin/env bash
# Observação de soak no totem (não substitui 8–24 h de campo).
# Uso: sudo bash scripts/soak-observe.sh [horas-a-olhar]
set -euo pipefail
HOURS="${1:-8}"
UNIT="${UNIT:-player-linux}"
DATA="${PLAYER_LINUX_DATA:-/var/lib/player-linux}"

echo "== systemd =="
systemctl is-active "$UNIT" || true
systemctl show "$UNIT" -p NRestarts -p ActiveEnterTimestamp -p WatchdogTimestamp -p WatchdogUSec || true

echo "== journal (${HOURS}h) =="
journalctl -u "$UNIT" --since "${HOURS} hours ago" --no-pager 2>/dev/null | \
  grep -E "WATCHDOG|GStreamer ERROR|OTA|overlay|HEARTBEAT|skip item" || true

echo "== processo =="
ps -o pid,etime,rss,cmd -C player-linux 2>/dev/null || echo "player-linux não está a correr"

echo "== disco =="
df -h "$DATA" 2>/dev/null || df -h /
JSONL="${DATA}/telemetry/events-v2.jsonl"
if [[ -f "$JSONL" ]]; then
  ls -lh "$JSONL" "$JSONL.1" 2>/dev/null || ls -lh "$JSONL"
fi
LOG="${DATA}/player-linux-operations.log"
if [[ -f "$LOG" ]]; then
  echo "== log (últimas 20) =="
  tail -n 20 "$LOG"
fi

echo "Critério soak: HB contínuo, 0 Watchdog kills, recover após unplug de rede, jsonl rodado se >8MiB."
