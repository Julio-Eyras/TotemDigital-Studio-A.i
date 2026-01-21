#!/bin/bash
# =============================================
# SmartSignage Pro - Aplicar Schema Completo v2.0
# Script único que aplica todos os arquivos SQL na ordem correta
# =============================================

# set -e  # Desabilitado para continuar mesmo com alguns erros

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuração
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-smartsignage}"
DB_USER="${DB_USER:-smartsignage}"
DB_PASS="${DB_PASS:-smartsignage123}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================"
echo " SmartSignage Pro - Schema v2.0"
echo " Aplicação Completa"
echo "========================================"
echo ""
echo "Configuração:"
echo "  Host: ${DB_HOST}"
echo "  Port: ${DB_PORT}"
echo "  Database: ${DB_NAME}"
echo "  Username: ${DB_USER}"
echo ""

# Lista de arquivos na ordem correta
FILES=(
    "part1-schema-setup.sql"
    "part2-tables-base.sql"
    "part3-tables-dependent.sql"
    "part4-billing-contracts.sql"
    "part5-tables-relationships.sql"
    "part6-tables-other.sql"
    "seeds-default-settings.sql"
    "part7-foreign-keys.sql"
    "part8-indexes.sql"
    "part9-triggers-functions.sql"
    "part10-views.sql"
    "part11-playlist-mix.sql"
    "part12-playlist-mix-functions.sql"
    "part13-dispatcher-views.sql"
    "seeds-playlist-mix.sql"
)

TOTAL=${#FILES[@]}
SUCCESS=0
ERROR=0

if [ -n "$DB_PASS" ]; then
    export PGPASSWORD="$DB_PASS"
fi

# Garantir que não há set -e ativo
set +e

for i in "${!FILES[@]}"; do
    file="${FILES[$i]}"
    if [[ "$file" == "seeds-default-settings.sql" || "$file" == "seeds-playlist-mix.sql" ]]; then
        full_path="${SCRIPT_DIR}/${file}"
    else
        full_path="${SCRIPT_DIR}/smartchannel-db-v2-refactored-${file}"
    fi
    num=$((i + 1))
    
    if [ ! -f "$full_path" ]; then
        echo -e "${RED}❌ Arquivo não encontrado: ${file}${NC}"
        ((ERROR++))
        continue
    fi
    
    echo -e "${BLUE}[${num}/${TOTAL}]${NC} ${file}..."
    
    # Executar psql e capturar código de saída
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$full_path" > /tmp/schema_apply_${num}.log 2>&1
    PSQL_EXIT_CODE=$?
    
    if [ $PSQL_EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ Sucesso!${NC}"
        ((SUCCESS++))
    else
        echo -e "${RED}❌ Erro (código: $PSQL_EXIT_CODE)${NC}"
        echo -e "${YELLOW}Últimas linhas do log:${NC}"
        tail -20 /tmp/schema_apply_${num}.log 2>/dev/null || echo "Log não disponível"
        ((ERROR++))
        # Continuar mesmo com erro (não usar break)
        echo -e "${YELLOW}Continuando com próximo arquivo...${NC}"
        echo ""
    fi
done

echo ""
echo "========================================"
echo " Resumo"
echo "========================================"
echo -e "  Sucesso: ${GREEN}${SUCCESS}${NC}"
echo -e "  Erros: ${RED}${ERROR}${NC}"

if [ $ERROR -eq 0 ]; then
    echo -e "${GREEN}✅ Schema aplicado com sucesso!${NC}"
    exit 0
else
    echo -e "${RED}❌ Falha na aplicação${NC}"
    exit 1
fi

