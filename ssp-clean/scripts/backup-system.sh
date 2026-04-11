#!/bin/bash
# Smart Signage Pro v2.0 - Script de Backup Automático
# Este script faz backup completo do sistema

set -e

# Configurações
BACKUP_DIR="backups"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="backup-smartsignage-$DATE.tar.gz"
CONFIG_FILE="config-smartsignage-$DATE.tar.gz"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}💾 Iniciando backup do Smart Signage Pro v2.0...${NC}"

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker não está rodando!${NC}"
    exit 1
fi

# Criar diretório de backup
mkdir -p "$BACKUP_DIR"

# Verificar espaço em disco
AVAILABLE_SPACE=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$AVAILABLE_SPACE" -lt 5 ]; then
    echo -e "${RED}❌ Espaço insuficiente em disco (mínimo 5GB necessário)${NC}"
    exit 1
fi

echo -e "${BLUE}📊 Espaço disponível: ${AVAILABLE_SPACE}GB${NC}"

# Parar serviços temporariamente
echo -e "${YELLOW}⏸️  Parando serviços para backup...${NC}"
docker compose down

# Backup dos volumes Docker
echo -e "${BLUE}🗄️  Fazendo backup dos volumes...${NC}"
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
    alpine tar czf "/backup/$BACKUP_DIR/$BACKUP_FILE" \
        /data /uploads /logs /backups /appdata /assets /ollama /redis /prometheus /grafana

# Backup da configuração
echo -e "${BLUE}⚙️  Fazendo backup da configuração...${NC}"
tar czf "$BACKUP_DIR/$CONFIG_FILE" \
    .env \
    docker-compose.yml \
    nginx/ \
    monitoring/ \
    scripts/ \
    *.sh \
    *.bat \
    *.md

# Reiniciar serviços
echo -e "${BLUE}🔄 Reiniciando serviços...${NC}"
docker compose up -d

# Verificar tamanho dos backups
BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
CONFIG_SIZE=$(du -h "$BACKUP_DIR/$CONFIG_FILE" | cut -f1)

echo -e "${GREEN}✅ Backup concluído com sucesso!${NC}"
echo ""
echo -e "${GREEN}📦 Arquivos criados:${NC}"
echo -e "   Dados: $BACKUP_DIR/$BACKUP_FILE ($BACKUP_SIZE)"
echo -e "   Config: $BACKUP_DIR/$CONFIG_FILE ($CONFIG_SIZE)"
echo ""
echo -e "${BLUE}📋 Informações do backup:${NC}"
echo -e "   Data: $(date)"
echo -e "   Servidor: $(hostname)"
echo -e "   Versão: Smart Signage Pro v2.0"
echo ""
echo -e "${YELLOW}💡 Para restaurar: ./restore-backup.sh $BACKUP_DIR/$BACKUP_FILE${NC}"

# Limpar backups antigos (manter últimos 7 dias)
echo -e "${BLUE}🧹 Limpando backups antigos...${NC}"
find "$BACKUP_DIR" -name "backup-smartsignage-*.tar.gz" -mtime +7 -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "config-smartsignage-*.tar.gz" -mtime +7 -delete 2>/dev/null || true

echo -e "${GREEN}🎉 Backup finalizado!${NC}"