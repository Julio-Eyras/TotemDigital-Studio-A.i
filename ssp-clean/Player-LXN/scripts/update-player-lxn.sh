#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="player-lxn-http.service"

echo "== Update Player-LXN =="
echo "Root: $ROOT"

if [[ -d "$ROOT/.git" ]]; then
  git -C "$ROOT" pull --ff-only || true
fi

systemctl --user daemon-reload
systemctl --user restart "$SERVICE_NAME"

echo "Atualizacao concluida."
echo "Status:"
systemctl --user --no-pager --full status "$SERVICE_NAME" | sed -n '1,15p'
