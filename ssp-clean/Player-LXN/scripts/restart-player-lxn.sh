#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="player-lxn-http.service"
systemctl --user restart "$SERVICE_NAME"
echo "Reiniciado: $SERVICE_NAME"
systemctl --user --no-pager --full status "$SERVICE_NAME" | sed -n '1,12p'
