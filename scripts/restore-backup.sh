#!/bin/bash
# Smart Signage Pro v2.0 - Script de Restore de Backup
# Este script restaura um backup completo do sistema

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Verificar parâmetros
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ Especifique o arquivo de backup!${NC}"
    echo ""
    echo "Uso: $0 <arquivo-backup>"
    echo ""
    echo "Backups disponíveis:"
    ls -la backups/*.tar.gz 2>/dev/null || echo "Nenhum backup encontrado."
    exit 1
fi

BACKUP_FILE="$1"

# Verificar se o arquivo existe
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Arquivo de backup não encontrado: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}🔄 Iniciando restore do Smart Signage Pro v2.0...${NC}"
echo -e "${BLUE}📦 Arquivo: $BACKUP_FILE${NC}"

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker não está rodando!${NC}"
    exit 1
fi

# Confirmação do usuário
echo -e "${YELLOW}⚠️  ATENÇÃO: Esta operação irá substituir todos os dados atuais!${NC}"
echo -e "${YELLOW}⚠️  Certifique-se de ter feito backup dos dados atuais antes de continuar.${NC}"
echo ""
read -p "Digite 'RESTAURAR' para confirmar: " confirm

if [ "$confirm" != "RESTAURAR" ]; then
    echo -e "${YELLOW}Operação cancelada.${NC}"
    exit 1
fi

# Verificar espaço em disco
AVAILABLE_SPACE=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$AVAILABLE_SPACE" -lt 10 ]; then
    echo -e "${RED}❌ Espaço insuficiente em disco (mínimo 10GB necessário)${NC}"
    exit 1
fi

echo -e "${BLUE}📊 Espaço disponível: ${AVAILABLE_SPACE}GB${NC}"

# Parar serviços
echo -e "${YELLOW}⏸️  Parando serviços...${NC}"
docker compose down

# Verificar se há arquivo de configuração correspondente
CONFIG_FILE="${BACKUP_FILE/backup-smartsignage/config-smartsignage}"
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${BLUE}⚙️  Restaurando configuração...${NC}"
    tar xzf "$CONFIG_FILE"
    echo -e "${GREEN}✅ Configuração restaurada${NC}"
else
    echo -e "${YELLOW}⚠️  Arquivo de configuração não encontrado: $CONFIG_FILE${NC}"
    echo -e "${YELLOW}⚠️  Continuando apenas com dados...${NC}"
fi

# Restaurar volumes
echo -e "${BLUE}🗄️  Restaurando dados...${NC}"
docker run --rm \
    -v smartsignage-pro_postgres_data:/data \
    -v smartsignage-pro_backend_uploads:/uploads \
    -v smartsignage-pro_backend_logs:/logs \
    -v smartsignage-pro_backend_backups:/backups \
    -v smartsignage-pro_backend_data:/appdata \
    -v smartsignage-pro_frontend_assets:/assets \
    -v smartsignage-pro_ollama_data:/ollama \
    -v smartsignage-pro_redis_data:/redis \
    -v smartsignage-pro_prometheus_data:/prometheus \
    -v smartsignage-pro_grafana_data:/grafana \
    -v "$(pwd)":/backup \
    alpine tar xzf "/backup/$BACKUP_FILE"

echo -e "${GREEN}✅ Dados restaurados${NC}"

# Rebuild containers se necessário
echo -e "${BLUE}🔨 Rebuildando containers...${NC}"
docker compose build --no-cache

# Iniciar serviços
echo -e "${BLUE}🚀 Iniciando serviços...${NC}"
docker compose up -d

# Aguardar inicialização
echo -e "${BLUE}⏳ Aguardando inicialização...${NC}"
sleep 15

# Verificar saúde do sistema
echo -e "${BLUE}🏥 Verificando saúde do sistema...${NC}"

# Verificar containers
if docker compose ps | grep -q "healthy"; then
    echo -e "${GREEN}✅ Containers saudáveis${NC}"
else
    echo -e "${YELLOW}⚠️  Alguns containers podem não estar saudáveis${NC}"
fi

# Verificar endpoints
ENDPOINTS=(
    "http://localhost:${BACKEND_PORT:-3000}/health:Backend API"
    "http://localhost:${BACKEND_PORT:-3000}/api/health:API Health"
    "http://localhost:${FRONTEND_ALT_PORT:-3001}:Frontend"
    "http://localhost:${GRAFANA_PORT:-3002}:Grafana"
    "http://localhost:${PROMETHEUS_PORT:-9090}:Prometheus"
)

ALL_OK=true
for endpoint in "${ENDPOINTS[@]}"; do
    URL=$(echo "$endpoint" | cut -d: -f1-2)
    NAME=$(echo "$endpoint" | cut -d: -f3)
    
    if curl -s "$URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $NAME: OK${NC}"
    else
        echo -e "${RED}❌ $NAME: FALHA${NC}"
        ALL_OK=false
    fi
done

echo ""
if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}🎉 Restore concluído com sucesso!${NC}"
    echo ""
    echo -e "${GREEN}🌐 Acesse:${NC}"
    echo -e "   Frontend: http://localhost:${FRONTEND_ALT_PORT:-3001}"
    echo -e "   Backend:  http://localhost:${BACKEND_PORT:-3000}"
    echo -e "   Grafana:  http://localhost:${GRAFANA_PORT:-3002}"
    echo -e "   Prometheus: http://localhost:${PROMETHEUS_PORT:-9090}"
else
    echo -e "${YELLOW}⚠️  Restore concluído com alguns problemas${NC}"
    echo -e "${YELLOW}⚠️  Verifique os logs: docker compose logs${NC}"
fi

echo ""
echo -e "${BLUE}📋 Informações do restore:${NC}"
echo -e "   Data: $(date)"
echo -e "   Arquivo: $BACKUP_FILE"
echo -e "   Servidor: $(hostname)"
echo -e "   Versão: Smart Signage Pro v2.0"
