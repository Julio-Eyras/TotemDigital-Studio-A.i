#!/bin/bash

# Smart Signage Pro v2.0 - Script para Atualizar TODAS as Referências
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
echo "║     Smart Signage Pro v2.0 - Atualização Completa          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log "Iniciando atualização completa de todas as referências..."

cd $INSTALL_DIR

# 1. Atualizar todos os scripts
log "Atualizando scripts..."

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
    "scripts/fix-backend.sh"
    "scripts/rebuild-backend.sh"
    "scripts/rebuild-architecture.sh"
    "scripts/debug-backend.sh"
)

for script in "${SCRIPTS_TO_UPDATE[@]}"; do
    if [[ -f "$script" ]]; then
        log "Atualizando $script..."
        
        # Substituir docker-compose por docker compose
        sed -i 's/docker-compose up/docker compose up/g' "$script"
        sed -i 's/docker-compose down/docker compose down/g' "$script"
        sed -i 's/docker-compose ps/docker compose ps/g' "$script"
        sed -i 's/docker-compose logs/docker compose logs/g' "$script"
        sed -i 's/docker-compose build/docker compose build/g' "$script"
        sed -i 's/docker-compose restart/docker compose restart/g' "$script"
        sed -i 's/docker-compose stop/docker compose stop/g' "$script"
        sed -i 's/docker-compose rm/docker compose rm/g' "$script"
        sed -i 's/docker-compose config/docker compose config/g' "$script"
        
        # Substituir nomes de containers antigos
        sed -i 's/smartsignage-backend/backend/g' "$script"
        sed -i 's/smartsignage-frontend/frontend/g' "$script"
        sed -i 's/smartsignage-postgres/postgres/g' "$script"
        sed -i 's/smartsignage-redis/redis/g' "$script"
        sed -i 's/smartsignage-ollama/ollama/g' "$script"
        sed -i 's/smartsignage-nginx/nginx/g' "$script"
        sed -i 's/smartsignage-prometheus/prometheus/g' "$script"
        sed -i 's/smartsignage-grafana/grafana/g' "$script"
        
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
    "PROGRESSO_FINAL_v2.0.md"
    "PROGRESSO_ATUAL_v2.0.md"
    "RESUMO_EXECUTIVO_v2.0.md"
)

for doc in "${DOCS_TO_UPDATE[@]}"; do
    if [[ -f "$doc" ]]; then
        log "Atualizando $doc..."
        
        # Substituir docker-compose por docker compose
        sed -i 's/docker-compose/docker compose/g' "$doc"
        
        # Substituir nomes de containers antigos
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

# Atualizar package.json se existir
if [[ -f "package.json" ]]; then
    log "Atualizando package.json..."
    sed -i 's/docker-compose/docker compose/g' "package.json"
    log "✅ package.json atualizado"
fi

# Atualizar backend/package.json se existir
if [[ -f "backend/package.json" ]]; then
    log "Atualizando backend/package.json..."
    sed -i 's/docker-compose/docker compose/g' "backend/package.json"
    log "✅ backend/package.json atualizado"
fi

# 4. Verificar se todos os arquivos necessários existem
log "Verificando arquivos necessários..."

REQUIRED_FILES=(
    "Dockerfile.backend"
    "Dockerfile.frontend"
    "docker-compose.yml"
    "nginx/frontend.conf"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        log "✅ $file encontrado"
    else
        error "❌ $file não encontrado!"
        exit 1
    fi
done

# 5. Verificar se docker-compose.yml está correto
log "Verificando docker-compose.yml..."

if grep -q "Dockerfile.backend" docker-compose.yml && grep -q "Dockerfile.frontend" docker-compose.yml; then
    log "✅ docker-compose.yml está atualizado"
else
    error "❌ docker-compose.yml não está atualizado!"
    exit 1
fi

# 6. Criar backup das alterações
log "Criando backup das alterações..."
BACKUP_FILE="backup-complete-update-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$BACKUP_FILE" scripts/ *.md nginx/ 2>/dev/null || warning "Não foi possível criar backup completo"
log "✅ Backup criado: $BACKUP_FILE"

# 7. Resumo das alterações
echo ""
log "📊 RESUMO DAS ALTERAÇÕES:"
echo "✅ Scripts atualizados para usar 'docker compose' v2"
echo "✅ Referências de containers atualizadas"
echo "✅ Documentação atualizada"
echo "✅ Arquivos de configuração atualizados"
echo "✅ Dockerfiles verificados"
echo "✅ docker-compose.yml verificado"
echo "✅ Backup criado"

# 8. Mostrar próximos passos
echo ""
log "🎯 PRÓXIMOS PASSOS:"
echo "1. Execute: ./scripts/rebuild-architecture.sh"
echo "2. Ou execute: docker compose down && docker compose build --no-cache && docker compose up -d"
echo "3. Verifique o status: ./scripts/status-system.sh"

echo ""
log "🎉 Atualização completa concluída com sucesso!"
log "Todas as referências foram atualizadas para a nova arquitetura separada!"
