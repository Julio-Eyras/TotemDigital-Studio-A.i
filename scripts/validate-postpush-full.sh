#!/usr/bin/env bash
set -u

# Validação completa pós-push (instalação opcional + seed demo + API compact)
# Uso mínimo:
#   ./scripts/validate-postpush-full.sh
#
# Com instalação antes de validar:
#   RUN_INSTALL=true ./scripts/validate-postpush-full.sh
#
# Com validação de API compact:
#   BASE="http://localhost:3001/api" TOKEN="jwt" ./scripts/validate-postpush-full.sh
#
# Variáveis opcionais:
#   DB=smartsignage
#   RUN_INSTALL=true|false  (default: false)
#   INSTALL_CMD="bash scripts/install-smartsignage.sh"
#   PLAN_ID=1 TOTEM_ID=1 OWNER_PUBLISHER_ID=1

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${DB:-smartsignage}"
RUN_INSTALL="${RUN_INSTALL:-false}"
INSTALL_CMD="${INSTALL_CMD:-bash scripts/install-smartsignage.sh}"

PASS=0
FAIL=0
SKIP=0

pass() {
  echo "PASS: $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "FAIL: $1"
  FAIL=$((FAIL + 1))
}

skip() {
  echo "SKIP: $1"
  SKIP=$((SKIP + 1))
}

run_step() {
  local title="$1"
  local cmd="$2"
  echo
  echo "== $title =="
  if bash -lc "cd \"$ROOT_DIR\" && $cmd"; then
    pass "$title"
  else
    fail "$title"
  fi
}

echo "== Validação Pós-Push Completa =="
echo "ROOT_DIR=$ROOT_DIR"
echo "DB=$DB"
echo "RUN_INSTALL=$RUN_INSTALL"

if [[ "$RUN_INSTALL" == "true" ]]; then
  run_step "Instalação (opcional)" "$INSTALL_CMD"
else
  skip "Instalação (RUN_INSTALL=false)"
fi

run_step "Validação da carga demo dinâmica" "DB=\"$DB\" ./scripts/validate-demo-dynamic.sh"

echo
echo "== Sanidade de status de contratos demo =="
STATUSES="$(sudo -u postgres psql -d "$DB" -t -A -c \
  "SELECT status || ':' || COUNT(*) FROM subscriber_contracts WHERE contract_number LIKE 'SUB-%' GROUP BY status ORDER BY status;" \
  2>/dev/null || true)"
if [[ -n "$STATUSES" ]]; then
  echo "$STATUSES"
  if echo "$STATUSES" | rg -q "^paused:"; then
    fail "Encontrado status inválido 'paused' em subscriber_contracts"
  else
    pass "Nenhum contrato demo com status 'paused'"
  fi
else
  fail "Não foi possível consultar status de subscriber_contracts em DB=$DB"
fi

if [[ -n "${BASE:-}" && -n "${TOKEN:-}" ]]; then
  API_CMD="BASE=\"$BASE\" TOKEN=\"$TOKEN\" PLAN_ID=\"${PLAN_ID:-1}\" TOTEM_ID=\"${TOTEM_ID:-1}\" OWNER_PUBLISHER_ID=\"${OWNER_PUBLISHER_ID:-1}\" ./scripts/validate-compact-postpush.sh"
  run_step "Validação de API Compact pós-push" "$API_CMD"
else
  skip "Validação de API compact (defina BASE e TOKEN)"
fi

echo
echo "== Resultado Final =="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
echo "SKIP: $SKIP"

if [[ "$FAIL" -gt 0 ]]; then
  exit 2
fi

exit 0
