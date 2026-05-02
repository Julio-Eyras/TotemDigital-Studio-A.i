#!/usr/bin/env bash
set -u

# Validação de carga demo dinâmica (PASS/FAIL)
# Uso:
#   DB=smartsignage ./scripts/validate-demo-dynamic.sh
#
# Opcional (sobrescrever esperados):
#   EXP_LOCALS=6 EXP_TOTEMS_ACTIVE=12 EXP_TOTEMS_STOCK=1 EXP_SUBSCRIBERS=5 ./scripts/validate-demo-dynamic.sh

DB="${DB:-smartsignage}"

EXP_PLANS="${EXP_PLANS:-3}"
EXP_LOCALS="${EXP_LOCALS:-6}"
EXP_TOTEMS_ACTIVE="${EXP_TOTEMS_ACTIVE:-12}"
EXP_TOTEMS_STOCK="${EXP_TOTEMS_STOCK:-1}"
EXP_SUBSCRIBERS="${EXP_SUBSCRIBERS:-5}"
EXP_CONTRACTS_TOTAL="${EXP_CONTRACTS_TOTAL:-15}"
EXP_CONTRACTS_ACTIVE="${EXP_CONTRACTS_ACTIVE:-5}"
EXP_CONTRACTS_DRAFT="${EXP_CONTRACTS_DRAFT:-5}"
EXP_CONTRACTS_CANCELLED="${EXP_CONTRACTS_CANCELLED:-5}"
# 3 planos × (locais demo + local Estoque) = 3 × (EXP_LOCALS + 1)
EXP_PLAN_LOCAL_ROWS="${EXP_PLAN_LOCAL_ROWS:-$(( (EXP_LOCALS + 1) * EXP_PLANS ))}"

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  echo "PASS: $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo "FAIL: $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

q() {
  sudo -u postgres psql -d "$DB" -t -A -c "$1" 2>/dev/null | tr -d '[:space:]'
}

echo "== Validação Demo Dinâmica =="
echo "DB=$DB"
echo

PLANS="$(q "SELECT COUNT(*) FROM plans WHERE slug IN ('bronze','silver','gold');")"
LOCALS="$(q "SELECT COUNT(*) FROM locals WHERE name LIKE 'Local Demo %';")"
TOTEMS_ACTIVE="$(q "SELECT COUNT(*) FROM totems WHERE identifier LIKE 'demo-totem-%' AND is_active=true;")"
TOTEMS_STOCK="$(q "SELECT COUNT(*) FROM totems WHERE identifier LIKE 'demo-stock-%' AND is_active=false;")"
SUBS="$(q "SELECT COUNT(*) FROM subscribers WHERE email LIKE 'subscriber.demo.%@totemdigital.local';")"
CONTRACTS_TOTAL="$(q "SELECT COUNT(*) FROM subscriber_contracts WHERE contract_number LIKE 'SUB-%';")"
CONTRACTS_ACTIVE="$(q "SELECT COUNT(*) FROM subscriber_contracts WHERE contract_number LIKE 'SUB-%' AND status='active';")"
CONTRACTS_DRAFT="$(q "SELECT COUNT(*) FROM subscriber_contracts WHERE contract_number LIKE 'SUB-%' AND status='draft';")"
CONTRACTS_CANCELLED="$(q "SELECT COUNT(*) FROM subscriber_contracts WHERE contract_number LIKE 'SUB-%' AND status='cancelled';")"
PLAN_LOCAL_ROWS="$(q "SELECT COUNT(*) FROM plan_local_access pla JOIN plans p ON p.plan_id = pla.plan_id WHERE p.slug IN ('bronze','silver','gold') AND COALESCE(pla.is_active,true) AND pla.is_allowed;")"

[[ "$PLANS" == "$EXP_PLANS" ]] && pass "planos bronze/silver/gold = $PLANS" || fail "planos esperado=$EXP_PLANS atual=${PLANS:-N/A}"
[[ "$LOCALS" == "$EXP_LOCALS" ]] && pass "locais demo = $LOCALS" || fail "locais esperado=$EXP_LOCALS atual=${LOCALS:-N/A}"
[[ "$TOTEMS_ACTIVE" == "$EXP_TOTEMS_ACTIVE" ]] && pass "totens ativos demo = $TOTEMS_ACTIVE" || fail "totens ativos esperado=$EXP_TOTEMS_ACTIVE atual=${TOTEMS_ACTIVE:-N/A}"
[[ "$TOTEMS_STOCK" == "$EXP_TOTEMS_STOCK" ]] && pass "totens estoque demo = $TOTEMS_STOCK" || fail "totens estoque esperado=$EXP_TOTEMS_STOCK atual=${TOTEMS_STOCK:-N/A}"
[[ "$SUBS" == "$EXP_SUBSCRIBERS" ]] && pass "subscribers demo = $SUBS" || fail "subscribers esperado=$EXP_SUBSCRIBERS atual=${SUBS:-N/A}"
[[ "$CONTRACTS_TOTAL" == "$EXP_CONTRACTS_TOTAL" ]] && pass "contratos demo total = $CONTRACTS_TOTAL" || fail "contratos total esperado=$EXP_CONTRACTS_TOTAL atual=${CONTRACTS_TOTAL:-N/A}"
[[ "$CONTRACTS_ACTIVE" == "$EXP_CONTRACTS_ACTIVE" ]] && pass "contratos active = $CONTRACTS_ACTIVE" || fail "active esperado=$EXP_CONTRACTS_ACTIVE atual=${CONTRACTS_ACTIVE:-N/A}"
[[ "$CONTRACTS_DRAFT" == "$EXP_CONTRACTS_DRAFT" ]] && pass "contratos draft = $CONTRACTS_DRAFT" || fail "draft esperado=$EXP_CONTRACTS_DRAFT atual=${CONTRACTS_DRAFT:-N/A}"
[[ "$CONTRACTS_CANCELLED" == "$EXP_CONTRACTS_CANCELLED" ]] && pass "contratos cancelled = $CONTRACTS_CANCELLED" || fail "cancelled esperado=$EXP_CONTRACTS_CANCELLED atual=${CONTRACTS_CANCELLED:-N/A}"
[[ "$PLAN_LOCAL_ROWS" == "$EXP_PLAN_LOCAL_ROWS" ]] && pass "plan_local_access (bronze/silver/gold) = $PLAN_LOCAL_ROWS" || fail "plan_local_access esperado=$EXP_PLAN_LOCAL_ROWS atual=${PLAN_LOCAL_ROWS:-N/A}"

echo
echo "Resumo plan_publisher_access (demo):"
sudo -u postgres psql -d "$DB" -c "
SELECT p.slug, ppa.publisher_id, ppa.is_allowed, ppa.is_active
FROM plan_publisher_access ppa
JOIN plans p ON p.plan_id = ppa.plan_id
WHERE p.slug IN ('bronze','silver','gold')
ORDER BY p.slug, ppa.publisher_id;
" 2>/dev/null || true

echo
echo "== Resultado =="
echo "PASS: $PASS_COUNT"
echo "FAIL: $FAIL_COUNT"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 2
fi

exit 0
