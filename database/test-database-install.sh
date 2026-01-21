#!/bin/bash
# =============================================
# SmartSignage Pro - Teste de Instalação do Banco
# =============================================
# Script para testar a instalação completa do schema SQL
# Pode ser executado múltiplas vezes (idempotente)

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuração padrão (pode ser sobrescrita por variáveis de ambiente)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-smartsignage}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-}"

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATABASE_DIR="${SCRIPT_DIR}"

echo "========================================"
echo " SmartSignage Pro - Teste de Instalação"
echo " Schema v2.0 - Banco de Dados"
echo "========================================"
echo ""
echo "Configuração:"
echo "  Host: ${DB_HOST}"
echo "  Port: ${DB_PORT}"
echo "  Database: ${DB_NAME}"
echo "  Username: ${DB_USER}"
echo ""

# Verificar se psql está disponível
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql não encontrado. Instale PostgreSQL client.${NC}"
    exit 1
fi

# Função para executar SQL
execute_sql() {
    local sql_file="$1"
    local description="$2"
    
    echo -e "${BLUE}[TESTE]${NC} ${description}..."
    
    if [ -n "$DB_PASS" ]; then
        export PGPASSWORD="$DB_PASS"
    fi
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$sql_file" > /tmp/schema_test_output.log 2>&1; then
        echo -e "${GREEN}✅ Sucesso!${NC}"
        return 0
    else
        echo -e "${RED}❌ Erro ao executar ${sql_file}${NC}"
        echo -e "${YELLOW}Últimas linhas do log:${NC}"
        tail -20 /tmp/schema_test_output.log
        return 1
    fi
}

# Função para verificar se tabela existe
check_table() {
    local table_name="$1"
    local query="SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table_name}');"
    
    if [ -n "$DB_PASS" ]; then
        export PGPASSWORD="$DB_PASS"
    fi
    
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$query" 2>/dev/null | tr -d ' ')
    
    if [ "$result" = "t" ]; then
        return 0
    else
        return 1
    fi
}

# Função para contar registros em uma tabela
count_records() {
    local table_name="$1"
    
    if [ -n "$DB_PASS" ]; then
        export PGPASSWORD="$DB_PASS"
    fi
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM ${table_name};" 2>/dev/null | tr -d ' '
}

echo -e "${BLUE}Iniciando testes...${NC}"
echo ""

# Lista de arquivos SQL na ordem correta
SQL_FILES=(
    "smartchannel-db-v2-refactored-part1-schema-setup.sql"
    "smartchannel-db-v2-refactored-part2-tables-base.sql"
    "smartchannel-db-v2-refactored-part3-tables-dependent.sql"
    "smartchannel-db-v2-refactored-part4-billing-contracts.sql"
    "smartchannel-db-v2-refactored-part5-tables-relationships.sql"
    "smartchannel-db-v2-refactored-part6-tables-other.sql"
    "seeds-default-settings.sql"
    "smartchannel-db-v2-refactored-part7-foreign-keys.sql"
    "smartchannel-db-v2-refactored-part8-indexes.sql"
    "smartchannel-db-v2-refactored-part9-triggers-functions.sql"
    "smartchannel-db-v2-refactored-part10-views.sql"
    "smartchannel-db-v2-refactored-part11-playlist-mix.sql"
    "smartchannel-db-v2-refactored-part12-playlist-mix-functions.sql"
    "smartchannel-db-v2-refactored-part13-dispatcher-views.sql"
    "seeds-playlist-mix.sql"
)

TOTAL_FILES=${#SQL_FILES[@]}
SUCCESS_COUNT=0
ERROR_COUNT=0

# Executar cada arquivo SQL
for i in "${!SQL_FILES[@]}"; do
    file="${SQL_FILES[$i]}"
    file_path="${DATABASE_DIR}/${file}"
    file_num=$((i + 1))
    
    if [ ! -f "$file_path" ]; then
        echo -e "${YELLOW}⚠️  Arquivo não encontrado: ${file}${NC}"
        ((ERROR_COUNT++))
        continue
    fi
    
    if execute_sql "$file_path" "[${file_num}/${TOTAL_FILES}] ${file}"; then
        ((SUCCESS_COUNT++))
    else
        ((ERROR_COUNT++))
        echo -e "${RED}Parando execução devido a erro...${NC}"
        break
    fi
done

echo ""
echo "========================================"
echo " Resumo do Teste"
echo "========================================"
echo -e "  Arquivos executados com sucesso: ${GREEN}${SUCCESS_COUNT}${NC}"
echo -e "  Arquivos com erro: ${RED}${ERROR_COUNT}${NC}"
echo ""

# Verificações pós-instalação
if [ $ERROR_COUNT -eq 0 ]; then
    echo -e "${BLUE}Verificando tabelas principais...${NC}"
    echo ""
    
    TABLES_TO_CHECK=(
        "subscribers"
        "publishers"
        "users"
        "totems"
        "campaigns"
        "medias"
        "playlists"
        "playlist_mix_rules"
        "ai_context_data"
    )
    
    MISSING_TABLES=0
    
    for table in "${TABLES_TO_CHECK[@]}"; do
        if check_table "$table"; then
            count=$(count_records "$table")
            echo -e "  ${GREEN}✅${NC} ${table} (${count} registros)"
        else
            echo -e "  ${RED}❌${NC} ${table} (NÃO ENCONTRADA)"
            ((MISSING_TABLES++))
        fi
    done
    
    echo ""
    
    if [ $MISSING_TABLES -eq 0 ]; then
        echo -e "${GREEN}✅ Todas as tabelas principais foram criadas!${NC}"
        echo ""
        echo -e "${GREEN}✅ Teste de instalação concluído com sucesso!${NC}"
        exit 0
    else
        echo -e "${RED}❌ Algumas tabelas não foram criadas.${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Teste falhou. Verifique os erros acima.${NC}"
    exit 1
fi

