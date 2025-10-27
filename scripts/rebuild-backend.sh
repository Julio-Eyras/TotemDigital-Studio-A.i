#!/bin/bash

# Smart Signage Pro v2.0 - Script para Reconstruir Backend
# =======================================================

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
echo "║         Smart Signage Pro v2.0 - Reconstruir Backend       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log "Reconstruindo Backend com correções..."

cd $INSTALL_DIR

# Verificar se Docker está disponível
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    error "Docker Compose não encontrado!"
    exit 1
fi

# 1. Parar todos os containers
log "Parando todos os containers..."
$COMPOSE_CMD down

# 2. Remover containers e imagens antigas
log "Removendo containers e imagens antigas..."
$COMPOSE_CMD rm -f backend
docker rmi smart-signage-backend 2>/dev/null || true

# 3. Limpar cache do Docker
log "Limpando cache do Docker..."
docker system prune -f

# 4. Reconstruir apenas o backend
log "Reconstruindo backend..."
$COMPOSE_CMD build --no-cache backend

if [[ $? -eq 0 ]]; then
    log "✅ Backend reconstruído com sucesso!"
else
    error "❌ Falha ao reconstruir backend"
    exit 1
fi

# 5. Iniciar apenas o backend primeiro
log "Iniciando backend..."
$COMPOSE_CMD up -d backend

# 6. Aguardar o backend ficar pronto
log "Aguardando backend ficar pronto..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        log "✅ Backend: Pronto"
        break
    fi
    
    if [[ $((i % 5)) -eq 0 ]]; then
        log "Aguardando Backend... (${i}/30)"
        # Mostrar logs do backend
        log "Logs do backend:"
        $COMPOSE_CMD logs --tail 5 backend
    fi
    
    sleep 2
done

# 7. Verificar se o backend está funcionando
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    log "✅ Backend funcionando!"
    
    # Iniciar os outros serviços
    log "Iniciando outros serviços..."
    $COMPOSE_CMD up -d
    
    # Mostrar status final
    log "Status final dos containers:"
    $COMPOSE_CMD ps
    
    # Mostrar endpoints
    SERVER_IP=$(hostname -I | awk '{print $1}')
    echo ""
    echo "📊 ENDPOINTS DISPONÍVEIS:"
    echo "Frontend: http://$SERVER_IP:80"
    echo "Backend API: http://$SERVER_IP:3000"
    echo "Player: http://$SERVER_IP:80/player"
    echo "Prometheus: http://$SERVER_IP:9090"
    echo "Grafana: http://$SERVER_IP:3002"
    
else
    error "❌ Backend ainda não está funcionando"
    log "Logs do backend:"
    $COMPOSE_CMD logs --tail 20 backend
    exit 1
fi

log "🎉 Reconstrução do backend concluída!"
