#!/bin/bash

# Smart Signage Pro v2.0 - Script para Atualizar Todas as Referências
# =================================================================

INSTALL_DIR="/opt/smart-signage"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        Smart Signage Pro v2.0 - Atualizar Referências      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log "Atualizando todas as referências para nova arquitetura..."

cd $INSTALL_DIR

# 1. Atualizar scripts que ainda usam docker-compose hardcoded
log "Atualizando scripts para usar docker compose v2..."

# Lista de scripts para atualizar
SCRIPTS_TO_UPDATE=(
    "scripts/start-system.sh"
    "scripts/stop-system.sh"
    "scripts/restart-system.sh"
    "scripts/status-system.sh"
    "scripts/logs-system.sh"
    "scripts/health-check.sh"
    "scripts/update-system.sh"
    "scripts/backup-system.sh"
    "scripts/autostart-system.sh"
    "scripts/disable-autostart.sh"
)

for script in "${SCRIPTS_TO_UPDATE[@]}"; do
    if [[ -f "$script" ]]; then
        log "Atualizando $script..."
        
        # Substituir docker-compose por docker compose (onde apropriado)
        sed -i 's/docker-compose down/docker compose down/g' "$script"
        sed -i 's/docker-compose up/docker compose up/g' "$script"
        sed -i 's/docker-compose ps/docker compose ps/g' "$script"
        sed -i 's/docker-compose logs/docker compose logs/g' "$script"
        sed -i 's/docker-compose build/docker compose build/g' "$script"
        sed -i 's/docker-compose restart/docker compose restart/g' "$script"
        sed -i 's/docker-compose stop/docker compose stop/g' "$script"
        sed -i 's/docker-compose rm/docker compose rm/g' "$script"
        
        log "✅ $script atualizado"
    else
        warning "Script não encontrado: $script"
    fi
done

# 2. Atualizar documentação
log "Atualizando documentação..."

DOCS_TO_UPDATE=(
    "README.md"
    "INSTALACAO_VPS_SSH.md"
    "README_INSTALACAO_SERVIDOR.md"
    "INSTRUCOES_INSTALACAO_TECNICO.md"
)

for doc in "${DOCS_TO_UPDATE[@]}"; do
    if [[ -f "$doc" ]]; then
        log "Atualizando $doc..."
        
        # Substituir referências antigas
        sed -i 's/docker-compose/docker compose/g' "$doc"
        sed -i 's/smartsignage-backend/backend/g' "$doc"
        sed -i 's/smartsignage-frontend/frontend/g' "$doc"
        sed -i 's/smartsignage-postgres/postgres/g' "$doc"
        sed -i 's/smartsignage-redis/redis/g' "$doc"
        sed -i 's/smartsignage-ollama/ollama/g' "$doc"
        sed -i 's/smartsignage-nginx/nginx/g' "$doc"
        sed -i 's/smartsignage-prometheus/prometheus/g' "$doc"
        sed -i 's/smartsignage-grafana/grafana/g' "$doc"
        
        log "✅ $doc atualizado"
    else
        warning "Documento não encontrado: $doc"
    fi
done

# 3. Atualizar arquivos de configuração
log "Atualizando arquivos de configuração..."

# Verificar se nginx.conf existe e atualizar
if [[ -f "nginx/nginx.conf" ]]; then
    log "Atualizando nginx/nginx.conf..."
    # Atualizar referências de containers
    sed -i 's/smartsignage-backend/backend/g' "nginx/nginx.conf"
    sed -i 's/smartsignage-frontend/frontend/g' "nginx/nginx.conf"
    log "✅ nginx/nginx.conf atualizado"
fi

# 4. Atualizar scripts de monitoramento
log "Atualizando scripts de monitoramento..."

if [[ -d "monitoring" ]]; then
    find monitoring -name "*.yml" -o -name "*.yaml" -o -name "*.json" | while read file; do
        log "Atualizando $file..."
        sed -i 's/smartsignage-backend/backend/g' "$file"
        sed -i 's/smartsignage-frontend/frontend/g' "$file"
        sed -i 's/smartsignage-postgres/postgres/g' "$file"
        sed -i 's/smartsignage-redis/redis/g' "$file"
        sed -i 's/smartsignage-ollama/ollama/g' "$file"
        sed -i 's/smartsignage-nginx/nginx/g' "$file"
        sed -i 's/smartsignage-prometheus/prometheus/g' "$file"
        sed -i 's/smartsignage-grafana/grafana/g' "$file"
        log "✅ $file atualizado"
    done
fi

# 5. Verificar se todos os Dockerfiles necessários existem
log "Verificando Dockerfiles necessários..."

REQUIRED_DOCKERFILES=(
    "Dockerfile.backend"
    "Dockerfile.frontend"
    "nginx/frontend.conf"
)

for dockerfile in "${REQUIRED_DOCKERFILES[@]}"; do
    if [[ -f "$dockerfile" ]]; then
        log "✅ $dockerfile encontrado"
    else
        error "❌ $dockerfile não encontrado!"
        exit 1
    fi
done

# 6. Verificar se docker-compose.yml está atualizado
log "Verificando docker-compose.yml..."

if grep -q "Dockerfile.backend" docker-compose.yml && grep -q "Dockerfile.frontend" docker-compose.yml; then
    log "✅ docker-compose.yml está atualizado"
else
    error "❌ docker-compose.yml não está atualizado!"
    exit 1
fi

# 7. Criar backup das alterações
log "Criando backup das alterações..."
BACKUP_FILE="backup-references-update-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$BACKUP_FILE" scripts/ *.md nginx/ monitoring/ 2>/dev/null || warning "Não foi possível criar backup completo"
log "✅ Backup criado: $BACKUP_FILE"

# 8. Resumo das alterações
echo ""
log "📊 RESUMO DAS ALTERAÇÕES:"
echo "✅ Scripts atualizados para usar 'docker compose' v2"
echo "✅ Referências de containers atualizadas"
echo "✅ Documentação atualizada"
echo "✅ Arquivos de configuração atualizados"
echo "✅ Dockerfiles verificados"
echo "✅ Backup criado"

echo ""
log "🎉 Todas as referências foram atualizadas com sucesso!"
log "Agora você pode usar a nova arquitetura separada!"
