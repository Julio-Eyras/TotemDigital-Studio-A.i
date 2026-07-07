#!/usr/bin/env bash
# Aplica compat SQL do trigger cascade_totem_deactivate (status invalidated).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${INSTALL_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
SQL_FILE="$INSTALL_DIR/database/smartchannel-db-v2-compat-totem-playlist-deactivate-status.sql"
# shellcheck source=lib/load-db-env.sh
source "$SCRIPT_DIR/lib/load-db-env.sh"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "ERRO: $SQL_FILE não encontrado"
  exit 1
fi

for env_candidate in "$INSTALL_DIR/.env" "$INSTALL_DIR/backend/.env"; do
  load_db_env_from_file "$env_candidate"
done

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-smartchannel_db}"
DB_USER="${DB_USER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-${DB_PASSWORD:-}}"

if ! command -v psql >/dev/null 2>&1; then
  echo "ERRO: psql não encontrado"
  exit 1
fi

echo "[compat] Atualizando cascade_totem_deactivate em $DB_NAME (@$DB_HOST)..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
echo "[compat] OK — totem desativado usa status invalidated em totem_playlists"
