#!/usr/bin/env bash
# Aplica chk_remote_command_type com tipos P1 (refresh_dispatch, content_version_check, etc.)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${INSTALL_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
SQL_FILE="$INSTALL_DIR/database/smartchannel-db-v2-compat-remote-command-types.sql"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "ERRO: $SQL_FILE não encontrado"
  exit 1
fi

if [[ -f "$INSTALL_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$INSTALL_DIR/.env"
  set +a
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-smartchannel_db}"
DB_USER="${DB_USER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-${DB_PASSWORD:-}}"

if ! command -v psql >/dev/null 2>&1; then
  echo "ERRO: psql não encontrado"
  exit 1
fi

echo "[compat] Atualizando chk_remote_command_type em $DB_NAME..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
echo "[compat] OK — tipos refresh_dispatch, sync_now, content_version_check, invalidate_*, purge_cache, etc."
