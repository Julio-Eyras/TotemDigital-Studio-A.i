#!/usr/bin/env bash
# Aplica upgrades de intervalos de cobrança em instalação EXISTENTE (sem recriar o BD).
# Idempotente: pode ser executado várias vezes.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_DIR="${ROOT}/database"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-smartsignage}"
DB_USER="${DB_USER:-postgres}"

export PGPASSWORD="${PGPASSWORD:-}"

psql_base() {
  if command -v sudo >/dev/null 2>&1 && [[ "$(id -u)" -ne 0 ]] && sudo -u postgres psql -d postgres -c "SELECT 1" >/dev/null 2>&1; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" "$@"
  else
    psql -v ON_ERROR_STOP=1 -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" "$@"
  fi
}

echo "==> Aplicando upgrade billing (part4 bloco DO: planos, contratos, subscriptions)..."
psql_base -f "${DB_DIR}/smartchannel-db-v2-refactored-part4-billing-contracts.sql"

echo "==> Aplicando procedures atómicas (part17: create_subscriber_with_contracts + billing_interval)..."
psql_base -f "${DB_DIR}/smartchannel-db-v2-refactored-part17-atomic-procedures.sql"

echo "==> Concluído. Valide com: node ${DB_DIR}/validate-v6.js (se aplicável)"
