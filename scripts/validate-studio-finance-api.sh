#!/usr/bin/env bash
# Smoke HTTP do módulo financeiro Studio (requer backend ativo).
# Uso:
#   BASE="http://host:3001/api" USER=admin PASS=secret ./scripts/validate-studio-finance-api.sh
# Ou com token:
#   BASE="http://localhost:3001/api" TOKEN="jwt" ./scripts/validate-studio-finance-api.sh
set -u

BASE="${BASE:-}"
TOKEN="${TOKEN:-}"
USER="${USER:-admin}"
PASS="${PASS:-}"

if [[ -z "$BASE" ]]; then
  echo "ERRO: defina BASE (ex.: http://localhost:3001/api)"
  exit 1
fi

PASS_COUNT=0
FAIL_COUNT=0

log_ok() { echo "PASS: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
log_fail() { echo "FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

if [[ -z "$TOKEN" ]]; then
  if [[ -z "$PASS" ]]; then
    echo "ERRO: informe TOKEN ou PASS (com USER) para login."
    exit 1
  fi
  echo "== Login =="
  login_body="$(curl -s -X POST -H "Content-Type: application/json" \
    -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" \
    "$BASE/auth/login")"
  if command -v jq >/dev/null 2>&1; then
    TOKEN="$(echo "$login_body" | jq -r '.token // .data.token // empty')"
  else
    TOKEN="$(echo "$login_body" | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  fi
  if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
    echo "FAIL: login não retornou token"
    echo "$login_body"
    exit 1
  fi
  log_ok "login"
fi

AUTH="Authorization: Bearer $TOKEN"
CT="Content-Type: application/json"

req() {
  local method="$1" url="$2" data="${3:-}"
  if [[ -n "$data" ]]; then
    curl -s -w "\n%{http_code}" -X "$method" -H "$AUTH" -H "$CT" -d "$data" "$url"
  else
    curl -s -w "\n%{http_code}" -X "$method" -H "$AUTH" -H "$CT" "$url"
  fi
}

echo "== Studio finance API smoke =="
echo "BASE=$BASE"
echo

echo "[1] GET /health"
resp="$(req GET "$BASE/health")"
code="$(echo "$resp" | tail -n1)"
body="$(echo "$resp" | sed '$d')"
[[ "$code" =~ ^2 ]] && log_ok "health $code" || log_fail "health $code"
echo "$body" | head -c 400
echo
echo

echo "[2] GET /dashboard/ui-context"
resp="$(req GET "$BASE/dashboard/ui-context")"
code="$(echo "$resp" | tail -n1)"
[[ "$code" =~ ^2 ]] && log_ok "ui-context $code" || log_fail "ui-context $code"
echo

echo "[3] POST /financial-admin/issue-invoices"
resp="$(req POST "$BASE/financial-admin/issue-invoices" "{}")"
code="$(echo "$resp" | tail -n1)"
[[ "$code" =~ ^2 ]] && log_ok "issue-invoices $code" || log_fail "issue-invoices $code"
echo

echo "[4] POST /financial-admin/issue-revenue-share-payouts"
resp="$(req POST "$BASE/financial-admin/issue-revenue-share-payouts" '{"sinceDays":90}')"
code="$(echo "$resp" | tail -n1)"
[[ "$code" =~ ^2 ]] && log_ok "issue-revenue-share $code" || log_fail "issue-revenue-share $code"
echo

echo "[5] POST /financial-admin/issue-invoices (com repasse)"
resp="$(req POST "$BASE/financial-admin/issue-invoices" '{"includeRevenueSharePayouts":true}')"
code="$(echo "$resp" | tail -n1)"
[[ "$code" =~ ^2 ]] && log_ok "issue-invoices+repasse $code" || log_fail "issue-invoices+repasse $code"
echo

if [[ -n "${SUBSCRIBER_BILLING_ID:-}" ]]; then
  echo "[6] POST /financial-admin/subscriber-billing/$SUBSCRIBER_BILLING_ID/record-payment"
  resp="$(req POST "$BASE/financial-admin/subscriber-billing/$SUBSCRIBER_BILLING_ID/record-payment" '{"paymentMethod":"pix"}')"
  code="$(echo "$resp" | tail -n1)"
  body="$(echo "$resp" | sed '$d')"
  if [[ "$code" =~ ^2 ]]; then
    log_ok "record-payment $code"
    if command -v jq >/dev/null 2>&1 && echo "$body" | jq -e '.revenueSharePayout' >/dev/null 2>&1; then
      log_ok "resposta inclui revenueSharePayout"
    fi
  elif [[ "$code" -eq 400 ]]; then
    log_ok "record-payment $code (fatura já paga ou inválida — OK em re-run)"
  else
    log_fail "record-payment $code"
  fi
  echo
fi

echo "== Resultado =="
echo "PASS: $PASS_COUNT  FAIL: $FAIL_COUNT"
[[ "$FAIL_COUNT" -gt 0 ]] && exit 2
exit 0
