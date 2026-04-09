#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="player-lxn-http.service"

echo "== Player-LXN status =="
systemctl --user --no-pager --full status "$SERVICE_NAME" | sed -n '1,25p'
echo ""
echo "Recent logs:"
journalctl --user -u "$SERVICE_NAME" -n 40 --no-pager
