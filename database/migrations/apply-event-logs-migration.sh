#!/bin/bash

# Script para aplicar migração da tabela event_logs
# Uso: ./apply-event-logs-migration.sh [database_name] [user] [host] [port]

set -e

# Configurações padrão
DB_NAME="${1:-smartsignage}"
DB_USER="${2:-smartsignage}"
DB_HOST="${3:-localhost}"
DB_PORT="${4:-5432}"

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                    Aplicar Migração: Tabela event_logs${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verificar se psql está disponível
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ Erro: psql não está instalado${NC}"
    echo "   Instale o PostgreSQL client: sudo apt-get install postgresql-client"
    exit 1
fi

# Verificar se o arquivo de migração existe
MIGRATION_FILE="$(dirname "$0")/add-event-logs-table.sql"
if [[ ! -f "$MIGRATION_FILE" ]]; then
    echo -e "${RED}❌ Erro: Arquivo de migração não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Configurações:${NC}"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Migration File: $MIGRATION_FILE"
echo ""

# Verificar conexão com o banco
echo -e "${YELLOW}🔍 Verificando conexão com o banco de dados...${NC}"
if ! PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ Erro: Não foi possível conectar ao banco de dados${NC}"
    echo "   Verifique as credenciais e se o PostgreSQL está rodando"
    echo ""
    echo "   Você pode fornecer a senha via variável de ambiente:"
    echo "   export PGPASSWORD=sua_senha"
    echo "   $0"
    exit 1
fi

echo -e "${GREEN}✅ Conexão com o banco de dados estabelecida${NC}"
echo ""

# Verificar se a tabela já existe
echo -e "${YELLOW}🔍 Verificando se a tabela event_logs já existe...${NC}"
TABLE_EXISTS=$(PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_logs');" 2>/dev/null || echo "false")

if [[ "$TABLE_EXISTS" == "t" ]]; then
    echo -e "${YELLOW}⚠️  A tabela event_logs já existe${NC}"
    read -p "Deseja recriar a tabela? (Isso apagará todos os dados existentes!) [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}✅ Migração cancelada. Tabela mantida como está.${NC}"
        exit 0
    fi
    
    echo -e "${YELLOW}🗑️  Removendo tabela existente...${NC}"
    PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DROP TABLE IF EXISTS event_logs CASCADE;" 2>&1
    echo -e "${GREEN}✅ Tabela removida${NC}"
    echo ""
fi

# Aplicar migração
echo -e "${YELLOW}📝 Aplicando migração...${NC}"
if PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE" 2>&1; then
    echo ""
    echo -e "${GREEN}✅ Migração aplicada com sucesso!${NC}"
    echo ""
    
    # Verificar se a tabela foi criada
    echo -e "${YELLOW}🔍 Verificando tabela criada...${NC}"
    TABLE_COUNT=$(PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM event_logs;" 2>/dev/null || echo "0")
    
    echo -e "${GREEN}✅ Tabela event_logs criada e verificada${NC}"
    echo ""
    
    # Mostrar estrutura da tabela
    echo -e "${YELLOW}📊 Estrutura da tabela:${NC}"
    PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\d event_logs" 2>&1 || true
    echo ""
    
    # Mostrar índices
    echo -e "${YELLOW}📊 Índices criados:${NC}"
    PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'event_logs' ORDER BY indexname;" 2>&1 || true
    echo ""
    
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}                    Migração Concluída com Sucesso!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${GREEN}✅ A tabela event_logs está pronta para uso!${NC}"
    echo ""
    echo "Próximos passos:"
    echo "  1. O EventLogService pode ser usado para registrar eventos importantes"
    echo "  2. Verifique a documentação em: DOCUMENTACAO_ESTRATEGIA_LOGGING.md"
    echo ""
    
else
    echo ""
    echo -e "${RED}❌ Erro ao aplicar migração${NC}"
    echo "   Verifique os erros acima e tente novamente"
    exit 1
fi

