#!/usr/bin/env bash
# Smoke SQL pós-deploy Studio: contratos, intervalos e emissão financeira (read-only).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-5432}"
export DB_NAME="${DB_NAME:-smartsignage}"
export DB_USER="${DB_USER:-smartsignage}"
export PGPASSWORD="${PGPASSWORD:-${DB_PASSWORD:-smartsignage123}}"

echo "=== Studio finance smoke (read-only) ==="
echo "DB: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
\echo '--- Perfil de instalação ---'
SELECT setting_key, setting_value
FROM system_settings
WHERE setting_key = 'installation.profile';

\echo '--- Admin / owner com publisher_id ---'
SELECT id, username, role, publisher_id
FROM users
WHERE role IN ('admin', 'owner_system', 'admin_sql')
  AND is_active = true
ORDER BY id
LIMIT 5;

\echo '--- Contratos anunciante ativos (intervalo) ---'
SELECT contract_id, subscriber_id,
       COALESCE(billing_interval, 'month') AS billing_interval,
       total_amount, status
FROM subscriber_contracts
WHERE status = 'active'
ORDER BY contract_id
LIMIT 10;

\echo '--- Contratos exibidor ativos (assinatura / híbrido) ---'
SELECT contract_id, publisher_id, contract_type,
       COALESCE(billing_interval, subscription_interval, 'month') AS billing_interval,
       subscription_amount, status
FROM publisher_contracts
WHERE status = 'active'
  AND contract_type IN ('subscription', 'hybrid')
ORDER BY contract_id
LIMIT 10;

\echo '--- Faturas por período (últimas 5 anunciante) ---'
SELECT billing_id, contract_id, period_start, period_end, amount, payment_status
FROM subscriber_billing
WHERE contract_id IS NOT NULL
ORDER BY billing_id DESC
LIMIT 5;

\echo '--- Faturas por período (últimas 5 exibidor incoming) ---'
SELECT billing_id, contract_id, period_start, period_end, amount, payment_status, direction
FROM publisher_billing
WHERE contract_id IS NOT NULL AND direction = 'incoming'
ORDER BY billing_id DESC
LIMIT 5;

\echo '--- Planos com 4 preços ---'
SELECT plan_id, name, price_monthly, price_four_month, price_semester, price_yearly, billing_interval
FROM plans
WHERE is_active = true
ORDER BY plan_id
LIMIT 10;
SQL

echo
echo "Smoke concluído. Para emissão manual de teste: POST /api/financial-admin/issue-invoices"
echo "  (opcional: publisherId, publisherContractId, subscriberId, contractId)"
