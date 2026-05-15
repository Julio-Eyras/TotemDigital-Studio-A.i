#!/usr/bin/env bash
# Conclui instalação interrompida (ex.: falha no part4 do schema):
#   1) reaplica schema v2 idempotente
#   2) seeds demo dinâmicos (--seeds-only)
#   3) validate-v6 + arranque de serviços (se systemd existir)
#
# Uso no servidor (após git pull com fix do part4):
#   cd /caminho/TotemDigital
#   export SYSTEM_OWNER_ADMIN_USERNAME=ismael   # mesmo user da instalação
#   bash scripts/finish-install-after-schema.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_NAME="${DB_NAME:-smartsignage}"
DB_USER="${DB_USER:-smartsignage}"
DB_PASSWORD="${DB_PASSWORD:-smartsignage123}"
export PGPASSWORD="${PGPASSWORD:-$DB_PASSWORD}"
export DB_PASSWORD="$DB_PASSWORD"
export PRIMARY_DB_USER="${PRIMARY_DB_USER:-$DB_USER}"
export PRIMARY_DB_NAME="${PRIMARY_DB_NAME:-$DB_NAME}"
export SKIP_CONFIRM=true

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${CYAN}$*${NC}"; }
ok() { echo -e "${GREEN}✅ $*${NC}"; }

log "==> 1/3 Schema v2 (idempotente, 21 passos)"
cd "$ROOT/database"
DB_NAME="$DB_NAME" DB_USER="$DB_USER" PGPASSWORD="$PGPASSWORD" bash ./apply-schema-v2.sh
ok "Schema aplicado"

log "==> 2/3 Seeds demo dinâmicos (owner/planos/totens/anunciantes)"
cd "$ROOT"
export SYSTEM_OWNER_ADMIN_USERNAME="${SYSTEM_OWNER_ADMIN_USERNAME:-ismael}"
export INSTALL_TOTEMDIGITAL_COMPACT="${INSTALL_TOTEMDIGITAL_COMPACT:-true}"
bash "$ROOT/scripts/install-smartsignage.sh" \
    --seeds-only \
    --skip-menu \
    --load-seeds \
    --totemdigital-compact
ok "Seeds aplicados"

log "==> 3/3 Validação pós-carga"
if command -v node >/dev/null 2>&1 && [[ -f "$ROOT/database/validate-v6.js" ]]; then
    VALIDATE_V6_SKIP_LOAD=true \
    DB_NAME="$DB_NAME" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" \
    NODE_PATH="$ROOT/backend/node_modules${NODE_PATH:+:$NODE_PATH}" \
        node "$ROOT/database/validate-v6.js"
    ok "validate-v6.js OK"
else
    echo "⚠️  node ou validate-v6.js indisponível — validação manual recomendada"
fi

if systemctl list-unit-files 2>/dev/null | grep -q 'smart-signage.service'; then
    log "Reiniciando smart-signage e Nginx..."
    sudo systemctl daemon-reload 2>/dev/null || true
    sudo systemctl enable smart-signage.service 2>/dev/null || true
    sudo systemctl restart smart-signage.service 2>/dev/null || sudo systemctl start smart-signage.service 2>/dev/null || true
    if systemctl is-active --quiet nginx 2>/dev/null; then
        sudo systemctl reload nginx 2>/dev/null || sudo systemctl restart nginx 2>/dev/null || true
    fi
    ok "Serviços systemd atualizados"
fi

echo
ok "Instalação de banco concluída. Aceda ao painel na porta configurada (ex.: :8080)."
