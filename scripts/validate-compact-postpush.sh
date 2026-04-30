#!/usr/bin/env bash
set -u

# Validação rápida pós-push para modo Compact
# Uso:
#   BASE="http://host:porta/api" TOKEN="jwt" ./scripts/validate-compact-postpush.sh
# Opcional:
#   PLAN_ID=1 TOTEM_ID=1 OWNER_PUBLISHER_ID=1 ./scripts/validate-compact-postpush.sh

BASE="${BASE:-}"
TOKEN="${TOKEN:-}"
PLAN_ID="${PLAN_ID:-1}"
TOTEM_ID="${TOTEM_ID:-1}"
OWNER_PUBLISHER_ID="${OWNER_PUBLISHER_ID:-1}"

if [[ -z "$BASE" || -z "$TOKEN" ]]; then
  echo "ERRO: informe BASE e TOKEN."
  echo "Exemplo: BASE=\"http://localhost:3001/api\" TOKEN=\"...\" ./scripts/validate-compact-postpush.sh"
  exit 1
fi

AUTH_HEADER="Authorization: Bearer ${TOKEN}"
CT_HEADER="Content-Type: application/json"

PASS=0
FAIL=0

log_ok() {
  echo "PASS: $1"
  PASS=$((PASS + 1))
}

log_fail() {
  echo "FAIL: $1"
  FAIL=$((FAIL + 1))
}

has_jq() {
  command -v jq >/dev/null 2>&1
}

print_json() {
  local body="$1"
  if has_jq; then
    echo "$body" | jq .
  else
    echo "$body"
  fi
}

request() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local body
  local code

  if [[ -n "$data" ]]; then
    body="$(curl -s -X "$method" -H "$AUTH_HEADER" -H "$CT_HEADER" -d "$data" "$url")"
    code="$(curl -s -o /dev/null -w "%{http_code}" -X "$method" -H "$AUTH_HEADER" -H "$CT_HEADER" -d "$data" "$url")"
  else
    body="$(curl -s -X "$method" -H "$AUTH_HEADER" -H "$CT_HEADER" "$url")"
    code="$(curl -s -o /dev/null -w "%{http_code}" -X "$method" -H "$AUTH_HEADER" -H "$CT_HEADER" "$url")"
  fi

  echo "$code"
  echo "$body"
}

echo "== Validação Compact pós-push =="
echo "BASE=$BASE PLAN_ID=$PLAN_ID TOTEM_ID=$TOTEM_ID OWNER_PUBLISHER_ID=$OWNER_PUBLISHER_ID"
echo

# 1) Health
echo "[1] GET /health"
resp="$(request "GET" "$BASE/health")"
code="$(echo "$resp" | sed -n '1p')"
body="$(echo "$resp" | sed -n '2,$p')"
if [[ "$code" =~ ^2 ]]; then
  log_ok "health respondeu $code"
else
  log_fail "health respondeu $code"
fi
print_json "$body"
echo

# 2) Planos
echo "[2] GET /plans?active_only=true"
resp="$(request "GET" "$BASE/plans?active_only=true")"
code="$(echo "$resp" | sed -n '1p')"
body="$(echo "$resp" | sed -n '2,$p')"
if [[ "$code" =~ ^2 ]]; then
  log_ok "plans respondeu $code"
else
  log_fail "plans respondeu $code"
fi
print_json "$body"
echo

# 3) Locais
echo "[3] GET /locals?limit=2000&active_only=true"
resp="$(request "GET" "$BASE/locals?limit=2000&active_only=true")"
code="$(echo "$resp" | sed -n '1p')"
body="$(echo "$resp" | sed -n '2,$p')"
if [[ "$code" =~ ^2 ]]; then
  log_ok "locals respondeu $code"
else
  log_fail "locals respondeu $code"
fi
print_json "$body"
echo

# 4) Totens
echo "[4] GET /totems?limit=2000&page=1"
resp="$(request "GET" "$BASE/totems?limit=2000&page=1")"
code="$(echo "$resp" | sed -n '1p')"
body="$(echo "$resp" | sed -n '2,$p')"
if [[ "$code" =~ ^2 ]]; then
  log_ok "totems respondeu $code"
else
  log_fail "totems respondeu $code"
fi
print_json "$body"
echo

# 5) Plan publisher access
echo "[5] GET /subscriber-access/plan-publisher?planId=$PLAN_ID"
resp="$(request "GET" "$BASE/subscriber-access/plan-publisher?planId=$PLAN_ID")"
code="$(echo "$resp" | sed -n '1p')"
body="$(echo "$resp" | sed -n '2,$p')"
if [[ "$code" =~ ^2 ]]; then
  log_ok "plan-publisher list respondeu $code"
else
  log_fail "plan-publisher list respondeu $code"
fi
print_json "$body"
echo

# 6) Owner guard bloqueio
echo "[6] POST /subscriber-access/plan-publisher (publisher errado deve bloquear)"
resp="$(request "POST" "$BASE/subscriber-access/plan-publisher" "{\"planId\":$PLAN_ID,\"publisherId\":999999,\"isAllowed\":true}")"
code="$(echo "$resp" | sed -n '1p')"
body="$(echo "$resp" | sed -n '2,$p')"
if [[ "$code" -eq 400 || "$code" -eq 403 ]]; then
  log_ok "guard bloqueou publisher inválido ($code)"
else
  log_fail "guard NÃO bloqueou publisher inválido ($code)"
fi
print_json "$body"
echo

# 7) Owner guard allow
echo "[7] POST /subscriber-access/plan-publisher (publisher owner deve permitir)"
resp="$(request "POST" "$BASE/subscriber-access/plan-publisher" "{\"planId\":$PLAN_ID,\"publisherId\":$OWNER_PUBLISHER_ID,\"isAllowed\":true}")"
code="$(echo "$resp" | sed -n '1p')"
body="$(echo "$resp" | sed -n '2,$p')"
if [[ "$code" =~ ^2 ]]; then
  log_ok "guard permitiu publisher owner ($code)"
else
  log_fail "guard NÃO permitiu publisher owner ($code)"
fi
print_json "$body"
echo

# 8) Totem/heartbeat sanity
echo "[8.1] GET /totems/$TOTEM_ID"
resp="$(request "GET" "$BASE/totems/$TOTEM_ID")"
code="$(echo "$resp" | sed -n '1p')"
body="$(echo "$resp" | sed -n '2,$p')"
if [[ "$code" =~ ^2 ]]; then
  log_ok "totem by id respondeu $code"
else
  log_fail "totem by id respondeu $code"
fi
print_json "$body"
echo

echo "[8.2] GET /totems/$TOTEM_ID/heartbeat?limit=5"
resp="$(request "GET" "$BASE/totems/$TOTEM_ID/heartbeat?limit=5")"
code="$(echo "$resp" | sed -n '1p')"
body="$(echo "$resp" | sed -n '2,$p')"
if [[ "$code" =~ ^2 ]]; then
  log_ok "heartbeat respondeu $code"
else
  log_fail "heartbeat respondeu $code"
fi
print_json "$body"
echo

echo "== Resultado final =="
echo "PASS: $PASS"
echo "FAIL: $FAIL"

if [[ "$FAIL" -gt 0 ]]; then
  exit 2
fi

exit 0
