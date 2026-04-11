#!/bin/bash
# =============================================================================
# Script para corrigir permissões do banco de dados PostgreSQL
# Garante que o usuário smartsignage tenha acesso completo a todas as tabelas
# =============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Detectar configurações do banco
if [[ -f "/opt/smart-signage/.env" ]]; then
    INSTALL_DIR="/opt/smart-signage"
elif [[ -f "$HOME/smartsignage-pro-main/.env" ]]; then
    INSTALL_DIR="$HOME/smartsignage-pro-main"
else
    error "Não foi possível encontrar o diretório de instalação"
    exit 1
fi

# Carregar variáveis do .env
if [[ -f "$INSTALL_DIR/.env" ]]; then
    source <(grep -E "^DB_|^PG_" "$INSTALL_DIR/.env" | sed 's/^/export /')
fi

# Valores padrão
PG_DB="${DB_NAME:-smartsignage}"
PG_USER="${DB_USER:-smartsignage}"
PG_HOST="${DB_HOST:-localhost}"
PG_PORT="${DB_PORT:-5432}"

log "Corrigindo permissões do banco de dados..."
log "Banco: $PG_DB"
log "Usuário: $PG_USER"
log "Host: $PG_HOST:$PG_PORT"

# Verificar se o banco existe
if ! sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${PG_DB}'" | grep -q 1; then
    error "Banco de dados '${PG_DB}' não existe!"
    exit 1
fi

# Verificar se o usuário existe
if ! sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '${PG_USER}'" | grep -q 1; then
    error "Usuário '${PG_USER}' não existe!"
    exit 1
fi

log "Transferindo ownership de todas as tabelas para ${PG_USER}..."
sudo -u postgres psql -d "$PG_DB" -tAc "SELECT 'ALTER TABLE ' || schemaname || '.' || tablename || ' OWNER TO ${PG_USER};' FROM pg_tables WHERE schemaname = 'public';" | sudo -u postgres psql -d "$PG_DB" || true

log "Transferindo ownership de todas as sequences para ${PG_USER}..."
sudo -u postgres psql -d "$PG_DB" -tAc "SELECT 'ALTER SEQUENCE ' || schemaname || '.' || sequencename || ' OWNER TO ${PG_USER};' FROM pg_sequences WHERE schemaname = 'public';" | sudo -u postgres psql -d "$PG_DB" || true

log "Transferindo ownership de todas as views para ${PG_USER}..."
sudo -u postgres psql -d "$PG_DB" -tAc "SELECT 'ALTER VIEW ' || schemaname || '.' || viewname || ' OWNER TO ${PG_USER};' FROM pg_views WHERE schemaname = 'public';" | sudo -u postgres psql -d "$PG_DB" || true

log "Transferindo ownership de todas as funções para ${PG_USER}..."
sudo -u postgres psql -d "$PG_DB" -tAc "SELECT 'ALTER FUNCTION ' || n.nspname || '.' || p.proname || '(' || pg_get_function_arguments(p.oid) || ') OWNER TO ${PG_USER};' FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public';" | sudo -u postgres psql -d "$PG_DB" || true

log "Garantindo privilégios explícitos em todas as tabelas..."
sudo -u postgres psql -d "$PG_DB" -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${PG_USER};" || true
sudo -u postgres psql -d "$PG_DB" -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${PG_USER};" || true
sudo -u postgres psql -d "$PG_DB" -c "GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO ${PG_USER};" || true

log "Garantindo privilégios específicos em tabelas críticas..."
for table in system_settings export_schedules export_queries export_executions; do
    if sudo -u postgres psql -d "$PG_DB" -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$table'" | grep -q 1; then
        log "  Corrigindo permissões em: $table"
        sudo -u postgres psql -d "$PG_DB" -c "ALTER TABLE $table OWNER TO ${PG_USER};" || true
        sudo -u postgres psql -d "$PG_DB" -c "GRANT ALL ON TABLE $table TO ${PG_USER};" || true
    fi
done

log "Configurando privilégios padrão para objetos futuros..."
sudo -u postgres psql -d "$PG_DB" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${PG_USER};" || true
sudo -u postgres psql -d "$PG_DB" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${PG_USER};" || true
sudo -u postgres psql -d "$PG_DB" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ${PG_USER};" || true

log "✅ Permissões corrigidas com sucesso!"
log ""
log "Verificando acesso do usuário ${PG_USER}..."
if PGPASSWORD="${DB_PASSWORD:-smartsignage123}" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -c "SELECT COUNT(*) FROM system_settings;" >/dev/null 2>&1; then
    log "✅ Usuário ${PG_USER} pode acessar system_settings"
else
    warn "⚠️  Usuário ${PG_USER} ainda não consegue acessar system_settings"
    warn "   Verifique manualmente as permissões"
fi

if PGPASSWORD="${DB_PASSWORD:-smartsignage123}" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -c "SELECT COUNT(*) FROM export_schedules;" >/dev/null 2>&1; then
    log "✅ Usuário ${PG_USER} pode acessar export_schedules"
else
    warn "⚠️  Usuário ${PG_USER} ainda não consegue acessar export_schedules"
    warn "   Verifique manualmente as permissões"
fi

log ""
log "Reinicie o serviço backend para aplicar as mudanças:"
log "  sudo systemctl restart smart-signage"

