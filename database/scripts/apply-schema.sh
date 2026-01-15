#!/bin/bash
# Script para Aplicar Schema SQL
# Aplica o schema refatorado (smartchannel-db-v2-refactored-apply-all.sql) de forma segura

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$SCRIPT_DIR/.."
DB_FILE="$DB_DIR/smartchannel-db-v2-refactored-apply-all.sql"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Aplicando schema SQL (refatorado v2)...${NC}"

# Verificar se o arquivo existe
if [ ! -f "$DB_FILE" ]; then
    echo -e "${RED}❌ Erro: Arquivo $DB_FILE não encontrado${NC}"
    exit 1
fi

# Solicitar confirmação
read -p "⚠️  Deseja aplicar o schema no banco de dados? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Operação cancelada${NC}"
    exit 0
fi

# Solicitar informações de conexão
read -p "Host (localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Port (5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

read -p "Database: " DB_NAME

read -p "User (postgres): " DB_USER
DB_USER=${DB_USER:-postgres}

read -sp "Password: " DB_PASS
echo ""

# Exportar variáveis para psql
export PGPASSWORD=$DB_PASS

echo -e "${GREEN}📝 Aplicando schema...${NC}"

# O apply-all usa comandos \i, então rodamos dentro do diretório database/
if (cd "$DB_DIR" && psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$(basename "$DB_FILE")"); then
    echo -e "${GREEN}✅ Schema aplicado com sucesso!${NC}"
    exit 0
else
    echo -e "${RED}❌ Erro ao aplicar schema${NC}"
    exit 1
fi

