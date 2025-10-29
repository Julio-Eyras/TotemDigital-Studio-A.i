#!/bin/bash

# Smart Signage Pro v2.0 - Script para Verificar Nova Arquitetura
# ==============================================================

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
echo "║     Smart Signage Pro v2.0 - Verificação da Arquitetura     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log "Verificando implementação da nova arquitetura separada..."

cd $INSTALL_DIR

# 1. Verificar arquivos necessários
log "Verificando arquivos necessários..."

REQUIRED_FILES=(
    "Dockerfile.backend"
    "Dockerfile.frontend"
    "docker-compose.yml"
    "nginx/nginx-complete.conf"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file"
    else
        echo "❌ $file - FALTANDO"
    fi
done

# 2. Verificar docker-compose.yml
log "Verificando docker-compose.yml..."

if grep -q "Dockerfile.backend" docker-compose.yml; then
    echo "✅ Dockerfile.backend referenciado"
else
    echo "❌ Dockerfile.backend NÃO referenciado"
fi

if grep -q "Dockerfile.frontend" docker-compose.yml; then
    echo "✅ Dockerfile.frontend referenciado"
else
    echo "❌ Dockerfile.frontend NÃO referenciado"
fi

if grep -q "container_name: backend" docker-compose.yml; then
    echo "✅ Container backend configurado"
else
    echo "❌ Container backend NÃO configurado"
fi

if grep -q "container_name: frontend" docker-compose.yml; then
    echo "✅ Container frontend configurado"
else
    echo "❌ Container frontend NÃO configurado"
fi

# 3. Verificar volumes separados
log "Verificando volumes separados..."

VOLUMES=(
    "backend_uploads"
    "backend_logs"
    "backend_data"
    "frontend_assets"
    "postgres_data"
)

for volume in "${VOLUMES[@]}"; do
    if grep -q "$volume:" docker-compose.yml; then
        echo "✅ Volume $volume configurado"
    else
        echo "❌ Volume $volume NÃO configurado"
    fi
done

# 4. Verificar scripts
log "Verificando scripts..."

SCRIPTS=(
    "scripts/start-system.sh"
    "scripts/stop-system.sh"
    "scripts/status-system.sh"
    "scripts/rebuild-architecture.sh"
    "scripts/update-all-references.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [[ -f "$script" ]]; then
        echo "✅ $script"
    else
        echo "❌ $script - FALTANDO"
    fi
done

# 5. Verificar referências antigas
log "Verificando referências antigas..."

OLD_REFERENCES=$(grep -r "smartsignage-" . --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | wc -l)
if [[ $OLD_REFERENCES -gt 0 ]]; then
    echo "⚠️ $OLD_REFERENCES referências antigas encontradas"
    echo "Execute: ./scripts/update-all-references.sh"
else
    echo "✅ Nenhuma referência antiga encontrada"
fi

# 6. Verificar docker-compose vs docker compose
log "Verificando uso de docker compose..."

DOCKER_COMPOSE_OLD=$(grep -r "docker-compose" . --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | wc -l)
if [[ $DOCKER_COMPOSE_OLD -gt 0 ]]; then
    echo "⚠️ $DOCKER_COMPOSE_OLD referências a 'docker-compose' encontradas"
    echo "Execute: ./scripts/update-all-references.sh"
else
    echo "✅ Todas as referências usam 'docker compose'"
fi

# 7. Resumo da arquitetura
echo ""
log "📊 RESUMO DA ARQUITETURA:"
echo ""
echo "🏗️ CONTAINERS SEPARADOS:"
echo "  • postgres: Banco de dados PostgreSQL"
echo "  • backend: API Node.js (porta 3000)"
echo "  • frontend: Interface React com Nginx integrado (porta 80 e 3001)"
echo "  • redis: Cache (porta 6379)"
echo "  • ollama: IA (porta 11434)"
echo "  • prometheus: Métricas (porta 9090)"
echo "  • grafana: Dashboards (porta 3002)"
echo ""
echo "💾 VOLUMES SEPARADOS:"
echo "  • postgres_data: Dados do banco"
echo "  • backend_uploads: Uploads do backend"
echo "  • backend_logs: Logs do backend"
echo "  • backend_data: Dados do backend"
echo "  • frontend_assets: Assets do frontend"
echo "  • ollama_data: Modelos de IA"
echo "  • redis_data: Cache Redis"
echo "  • prometheus_data: Métricas"
echo "  • grafana_data: Dashboards"
echo ""
echo "🔧 DOCKERFILES ESPECIALIZADOS:"
echo "  • Dockerfile.backend: Container do backend"
echo "  • Dockerfile.frontend: Container do frontend"
echo ""
echo "📋 ENDPOINTS DISPONÍVEIS:"
echo "  • Frontend: http://SEU_IP:80 (Nginx integrado)"
echo "  • Frontend Direto: http://SEU_IP:3001"
echo "  • Backend API: http://SEU_IP:3000"
echo "  • Player: http://SEU_IP:80/player"
echo "  • Prometheus: http://SEU_IP:9090"
echo "  • Grafana: http://SEU_IP:3002"

# 8. Próximos passos
echo ""
log "🎯 PRÓXIMOS PASSOS:"
echo "1. Execute: ./scripts/update-all-references.sh (se necessário)"
echo "2. Execute: ./scripts/rebuild-architecture.sh"
echo "3. Verifique: ./scripts/status-system.sh"

echo ""
log "🎉 Verificação da arquitetura concluída!"
