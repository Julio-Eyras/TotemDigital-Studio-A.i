#!/bin/bash

# Script para verificar se a tabela event_logs foi criada corretamente
# Uso: ./verify-event-logs-table.sh [database_name] [user] [host] [port]

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
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                    Verificação da Tabela event_logs${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verificar se psql está disponível
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ Erro: psql não está instalado${NC}"
    exit 1
fi

# Verificar conexão
echo -e "${YELLOW}🔍 Verificando conexão...${NC}"
if ! PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ Erro: Não foi possível conectar ao banco de dados${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Conexão estabelecida${NC}"
echo ""

# Verificar se a tabela existe
echo -e "${YELLOW}📋 Verificando se a tabela existe...${NC}"
TABLE_EXISTS=$(PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_logs');" 2>/dev/null || echo "false")

if [[ "$TABLE_EXISTS" != "t" ]]; then
    echo -e "${RED}❌ A tabela event_logs NÃO existe${NC}"
    echo ""
    echo "Para criar a tabela, execute:"
    echo "  ./database/migrations/apply-event-logs-migration.sh"
    exit 1
fi

echo -e "${GREEN}✅ Tabela event_logs existe${NC}"
echo ""

# Mostrar estrutura da tabela
echo -e "${YELLOW}📊 Estrutura da tabela:${NC}"
PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\d event_logs" 2>&1
echo ""

# Verificar colunas obrigatórias
echo -e "${YELLOW}🔍 Verificando colunas obrigatórias...${NC}"
REQUIRED_COLUMNS=("id" "event_type" "entity_type" "timestamp")
MISSING_COLUMNS=()

for col in "${REQUIRED_COLUMNS[@]}"; do
    COL_EXISTS=$(PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'event_logs' AND column_name = '$col');" 2>/dev/null || echo "false")
    if [[ "$COL_EXISTS" != "t" ]]; then
        MISSING_COLUMNS+=("$col")
    fi
done

if [[ ${#MISSING_COLUMNS[@]} -gt 0 ]]; then
    echo -e "${RED}❌ Colunas faltando: ${MISSING_COLUMNS[*]}${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Todas as colunas obrigatórias existem${NC}"
echo ""

# Verificar índices
echo -e "${YELLOW}📊 Verificando índices...${NC}"
INDEX_COUNT=$(PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'event_logs';" 2>/dev/null || echo "0")

if [[ "$INDEX_COUNT" -lt 5 ]]; then
    echo -e "${YELLOW}⚠️  Poucos índices encontrados ($INDEX_COUNT). Esperado: 7+${NC}"
else
    echo -e "${GREEN}✅ Índices criados ($INDEX_COUNT encontrados)${NC}"
fi

echo ""
echo -e "${YELLOW}📋 Índices existentes:${NC}"
PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT indexname FROM pg_indexes WHERE tablename = 'event_logs' ORDER BY indexname;" 2>&1 || true
echo ""

# Verificar foreign keys
echo -e "${YELLOW}🔗 Verificando foreign keys...${NC}"
FK_COUNT=$(PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = 'event_logs' AND constraint_type = 'FOREIGN KEY';" 2>/dev/null || echo "0")

if [[ "$FK_COUNT" -lt 4 ]]; then
    echo -e "${YELLOW}⚠️  Poucas foreign keys encontradas ($FK_COUNT). Esperado: 4${NC}"
else
    echo -e "${GREEN}✅ Foreign keys criadas ($FK_COUNT encontradas)${NC}"
fi

echo ""
echo -e "${YELLOW}📋 Foreign keys existentes:${NC}"
PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.table_name = 'event_logs' AND tc.constraint_type = 'FOREIGN KEY';" 2>&1 || true
echo ""

# Teste de inserção
echo -e "${YELLOW}🧪 Testando inserção de registro...${NC}"
TEST_RESULT=$(PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "INSERT INTO event_logs (event_type, entity_type) VALUES ('test_event', 'test') RETURNING id;" 2>&1 || echo "ERROR")

if [[ "$TEST_RESULT" =~ ^[0-9]+$ ]]; then
    TEST_ID="$TEST_RESULT"
    echo -e "${GREEN}✅ Inserção de teste bem-sucedida (ID: $TEST_ID)${NC}"
    
    # Remover registro de teste
    PGPASSWORD="${PGPASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DELETE FROM event_logs WHERE id = $TEST_ID;" > /dev/null 2>&1
    echo -e "${GREEN}✅ Registro de teste removido${NC}"
else
    echo -e "${RED}❌ Erro ao inserir registro de teste${NC}"
    echo "$TEST_RESULT"
    exit 1
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                    Verificação Concluída com Sucesso!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ A tabela event_logs está configurada corretamente e pronta para uso!${NC}"
echo ""

