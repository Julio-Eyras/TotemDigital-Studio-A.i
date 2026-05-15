#!/bin/bash
# Valida tabelas e constraints do módulo financeiro (sem executar carga v6).
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$(cd "$SCRIPT_DIR/../database" && pwd)"

export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-5432}"
export DB_NAME="${DB_NAME:-smartsignage}"
export DB_USER="${DB_USER:-smartsignage}"
export PGPASSWORD="${PGPASSWORD:-${DB_PASSWORD:-smartsignage123}}"

echo "Validação financeira (schema apenas)..."

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
\echo '--- Tabelas ---'
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('subscriber_billing', 'publisher_billing', 'subscriber_contracts')
ORDER BY 1;

\echo '--- Constraints payment_status ---'
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conname IN (
  'chk_subscriber_billing_payment_status',
  'chk_publisher_billing_payment_status'
);

\echo '--- Colunas críticas subscriber_billing ---'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'subscriber_billing'
  AND column_name IN ('contract_id', 'period_start', 'period_end', 'payment_status')
ORDER BY 1;
SQL

echo "OK — revise se overdue aparece em ambas as constraints."
