-- =============================================================================
-- Validação: Plano Básico e limites de campanhas
-- Execute com: psql -U <user> -d <database> -f database/validate-plano-basico-limits.sql
-- =============================================================================

\echo '=== 1. Plano Básico (plan_id = 1) - coluna limits e features ==='
SELECT
  plan_id,
  name,
  slug,
  is_active,
  limits,
  limits->>'campaigns' AS limits_campaigns,
  (limits->>'campaigns')::int AS limits_campaigns_int,
  features,
  features->>'campaigns' AS features_campaigns
FROM plans
WHERE plan_id = 1;

\echo ''
\echo '=== 2. Todos os planos (campanhas em limits) ==='
SELECT plan_id, name, limits, limits->>'campaigns' AS campaigns_limit
FROM plans
WHERE is_active = true
ORDER BY plan_id;

\echo ''
\echo '=== 3. Contratos ativos que usam Plano Básico (plan_id = 1) ==='
SELECT sc.contract_id, sc.subscriber_id, sc.plan_id, sc.contract_number, sc.status, sc.start_date, sc.end_date
FROM subscriber_contracts sc
WHERE sc.plan_id = 1
  AND sc.status = 'active'
  AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
ORDER BY sc.subscriber_id;

\echo ''
\echo '=== 4. Se limits.campaigns estiver errado, corrija com (ex.: 25): ==='
\echo '   UPDATE plans SET limits = jsonb_set(COALESCE(limits, ''{}''::jsonb), ''{campaigns}'', ''25'') WHERE plan_id = 1;'
\echo ''
\echo '   Depois de alterar na BD: o backend guarda limites em cache (Redis) por 5 min.'
\echo '   Para o novo limite valer de imediato: reinicie o backend OU apague as chaves'
\echo '   subscriber:*:max_limits no Redis (ex.: redis-cli --scan --pattern "subscriber:*:max_limits").'
\echo ''
\echo '=== 5. Verificar tipo: limits deve ser JSONB com chave campaigns (número) ==='
SELECT plan_id, name,
  jsonb_typeof(limits) AS limits_tipo,
  limits ? 'campaigns' AS tem_campaigns,
  limits->'campaigns' AS campaigns_val
FROM plans
WHERE plan_id = 1;
