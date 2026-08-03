#!/usr/bin/env bash
# L1 — runner dentro do contentor Ubuntu (schema check + unit tests + L0 + dry-run install)
set -euo pipefail

ROOT="${ROOT:-/workspace}"
cd "$ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " L1 Ubuntu runner — MultiAgência"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "[1/6] Pré-requisitos"
node -v
npm -v
psql --version
git rev-parse --abbrev-ref HEAD 2>/dev/null || true

echo "[2/6] Postgres reachable"
export PGPASSWORD="${PGPASSWORD:-emu_pass_change_me}"
DB_HOST="${DB_HOST:-postgres-emu}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-smartsignage_emu}"
DB_USER="${DB_USER:-smartsignage_emu}"

for i in $(seq 1 30); do
  if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c 'SELECT 1' >/dev/null 2>&1; then
    echo "  OK postgres"
    break
  fi
  sleep 2
  if [[ $i -eq 30 ]]; then
    echo "ERRO: postgres não respondeu"
    exit 1
  fi
done

echo "[3/6] Tabelas purge / settings existem (schema init)"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
SELECT to_regclass('public.installation_purge_runs') IS NOT NULL AS purge_runs;
SELECT to_regclass('public.installation_purge_schedules') IS NOT NULL AS purge_sched;
SELECT to_regclass('public.system_settings') IS NOT NULL AS settings;
SQL

echo "[4/6] npm install backend + unit tests multi-agência/purge"
cd "$ROOT/backend"
if [[ ! -d node_modules ]]; then
  npm install --no-audit --no-fund
else
  echo "  node_modules já presente — skip install completo"
fi

npx jest --forceExit --no-coverage \
  --testPathPatterns="multiAgencyMasterSwitch|commercialPurgeService|installationModules" \
  || {
    echo "AVISO: jest falhou — a tentar path legado"
    npx jest --forceExit --no-coverage \
      --testPathPattern="multiAgencyMasterSwitch|commercialPurgeService|installationModulesService|installationModules.test" \
      || exit 1
  }

echo "[5/6] Harness L0"
cd "$ROOT"
node scripts/sim-vps-dev-pipeline.mjs

echo "[6/6] Instalador dry-run (procedimento clone/install emulado)"
export TDI_GIT_BRANCH="${TDI_GIT_BRANCH:-TotemDigital-MultiAgencia}"
bash scripts/Instala-TotemDigital-Server.sh \
  --modo producao --instancia dev --sim --dry-run \
  --email ops@dev.totemdigital.app.br \
  --owner-user Owner

mkdir -p "$ROOT/runtime/multiagencia-emu"
cat > "$ROOT/runtime/multiagencia-emu/L1-REPORT.txt" <<EOF
L1 OK
at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)
commit=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)
EOF

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " L1 CONCLUÍDO — runtime/multiagencia-emu/L1-REPORT.txt"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
