#!/bin/bash

# Smart Signage Pro v2.0 - Script para Iniciar Sistema
# ===================================================

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

# Carregar variáveis do .env se existir e definir padrões
if [ -f "$INSTALL_DIR/.env" ]; then
    # shellcheck disable=SC1090
    . "$INSTALL_DIR/.env"
fi
FRONTEND_PORT=${FRONTEND_PORT:-8080}
FRONTEND_ALT_PORT=${FRONTEND_ALT_PORT:-3001}
BACKEND_PORT=${BACKEND_PORT:-3000}
PROMETHEUS_PORT=${PROMETHEUS_PORT:-9090}
GRAFANA_PORT=${GRAFANA_PORT:-3002}

# Verificar se Docker está disponível
check_docker() {
    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        error "Docker Compose não encontrado!"
        exit 1
    fi
}

# Verificar se o sistema está rodando
check_status() {
    cd $INSTALL_DIR
    if $COMPOSE_CMD ps | grep -q "Up"; then
        return 0
    else
        return 1
    fi
}

# Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              Smart Signage Pro v2.0 - Iniciar Sistema       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log "Iniciando Smart Signage Pro..."
check_docker
cd $INSTALL_DIR

if check_status; then
    warning "Sistema já está rodando!"
    $COMPOSE_CMD ps
else
    log "Iniciando containers..."
    $COMPOSE_CMD up -d
    
    # Aguardar serviços ficarem prontos
    log "Aguardando serviços ficarem prontos..."
    sleep 10
    
    if check_status; then
        log "✅ Sistema iniciado com sucesso!"
        $COMPOSE_CMD ps
        
        # Mostrar endpoints
        SERVER_IP=$(hostname -I | awk '{print $1}')
        echo ""
        echo "📊 ENDPOINTS DISPONÍVEIS:"
        echo "Frontend: http://$SERVER_IP:$FRONTEND_PORT (via Nginx)"
        echo "Frontend Direto: http://$SERVER_IP:$FRONTEND_ALT_PORT"
        echo "Backend API: http://$SERVER_IP:$BACKEND_PORT"
        echo "Player: http://$SERVER_IP:$FRONTEND_PORT/player"
        echo "Prometheus: http://$SERVER_IP:$PROMETHEUS_PORT"
        echo "Grafana: http://$SERVER_IP:$GRAFANA_PORT"
    else
        error "❌ Falha ao iniciar sistema"
        $COMPOSE_CMD logs --tail 20
        exit 1
    fi
fi
