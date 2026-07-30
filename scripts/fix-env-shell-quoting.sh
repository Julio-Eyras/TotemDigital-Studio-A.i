#!/usr/bin/env bash
# Corrige .env com valores sem aspas (SMART CHANNEL, crons, SMTP_FROM, …)
# que quebram `source .env` no bash ("CHANNEL: command not found").
#
# Uso (servidor, sem reinstalar):
#   bash scripts/fix-env-shell-quoting.sh
#   bash scripts/fix-env-shell-quoting.sh /path/to/.env
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

repair_env_shell_quoting() {
  local env_file="${1:-}"
  [[ -n "$env_file" && -f "$env_file" ]] || return 0
  local tmp
  tmp="$(mktemp)" || return 0
  awk '
    BEGIN {
      q["FINANCIAL_PIX_MERCHANT_NAME"] = 1
      q["FINANCIAL_PIX_MERCHANT_CITY"] = 1
      q["FINANCIAL_PUBLIC_APP_URL"] = 1
      q["FINANCIAL_CRON_ENFORCE_BLOCKS"] = 1
      q["FINANCIAL_CRON_ISSUE"] = 1
      q["FINANCIAL_CRON_OVERDUE"] = 1
      q["FINANCIAL_CRON_REMINDERS"] = 1
      q["FINANCIAL_CRON_REVENUE_SHARE"] = 1
      q["SMTP_FROM"] = 1
      q["SYSTEM_OWNER_NAME"] = 1
      q["SYSTEM_OWNER_CONTACT_NAME"] = 1
      q["SYSTEM_OWNER_PLAN_NAME"] = 1
      q["SYSTEM_OWNER_CITY"] = 1
    }
    function needs_quote(v) {
      return (v ~ /[[:space:]<>*]/ || v ~ /#/)
    }
    /^[[:space:]]*#/ || /^[[:space:]]*$/ || index($0, "=") == 0 { print; next }
    {
      key = $0
      sub(/=.*/, "", key)
      val = $0
      sub(/^[^=]*=/, "", val)
      if (!(key in q)) { print; next }
      if (val ~ /^".*"$/ || val ~ /^\x27.*\x27$/) { print; next }
      if (!needs_quote(val) && key !~ /^SMTP_FROM$/) { print; next }
      gsub(/\\/, "\\\\", val)
      gsub(/"/, "\\\"", val)
      print key "=\"" val "\""
    }
  ' "$env_file" > "$tmp"
  if ! cmp -s "$env_file" "$tmp" 2>/dev/null; then
    cp -a "$env_file" "${env_file}.bak-shell-quote.$(date +%Y%m%d%H%M%S)" 2>/dev/null || true
    cat "$tmp" > "$env_file"
    echo "Corrigido: $env_file"
  else
    echo "Já OK: $env_file"
  fi
  rm -f "$tmp"
}

TARGETS=("$@")
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  TARGETS=("$ROOT/.env" "$ROOT/backend/.env")
fi

for f in "${TARGETS[@]}"; do
  if [[ -f "$f" ]]; then
    repair_env_shell_quoting "$f"
    set +e
    # shellcheck disable=SC1090
    ( set -a; source "$f"; set +a ) >/dev/null 2>&1
    rc=$?
    set -e
    if [[ $rc -eq 0 ]]; then
      echo "source OK: $f"
    else
      echo "AVISO: source ainda falha em $f (revise manualmente)" >&2
      exit 1
    fi
  else
    echo "Ausente (ok): $f"
  fi
done
