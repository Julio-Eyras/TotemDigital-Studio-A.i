#!/bin/bash

# Smart Signage Pro v2.0 - Script para Verificar Status do Sistema
# ================================================================

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

# Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║            Smart Signage Pro v2.0 - Status do Sistema       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log "Verificando status do Smart Signage Pro..."
check_docker
cd $INSTALL_DIR

# Status dos containers
log "Status dos containers:"
$COMPOSE_CMD ps

# Verificar endpoints
log "Verificando endpoints..."
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "📊 ENDPOINTS DISPONÍVEIS:"
echo "Frontend: http://$SERVER_IP:80 (via Nginx)"
echo "Frontend Direto: http://$SERVER_IP:3001"
echo "Backend API: http://$SERVER_IP:3000"
echo "Player: http://$SERVER_IP:80/player"
echo "Prometheus: http://$SERVER_IP:9090"
echo "Grafana: http://$SERVER_IP:3002"

# Testar conectividade
echo ""
log "Testando conectividade dos endpoints..."

# Função para testar endpoint
test_endpoint() {
    local name=$1
    local url=$2
    
    if curl -s --max-time 5 "$url" > /dev/null 2>&1; then
        echo "✅ $name: OK"
    else
        echo "❌ $name: FALHOU"
    fi
}

test_endpoint "Frontend (Nginx)" "http://$SERVER_IP:80"
test_endpoint "Frontend Direto" "http://$SERVER_IP:3001"
test_endpoint "Backend Health" "http://$SERVER_IP:3000/health"
test_endpoint "Backend API" "http://$SERVER_IP:3000/api/health"
test_endpoint "Player" "http://$SERVER_IP:80/player"
test_endpoint "Prometheus" "http://$SERVER_IP:9090"
test_endpoint "Grafana" "http://$SERVER_IP:3002"

# Informações do sistema
echo ""
log "Informações do sistema:"
echo "Data/Hora: $(date)"
echo "Uptime: $(uptime -p)"
echo "Uso de disco: $(df -h / | tail -1 | awk '{print $5}')"
echo "Uso de memória: $(free -h | grep Mem | awk '{print $3 "/" $2}')"

# Status do autostart
echo ""
log "Status do autostart:"
if systemctl is-enabled smart-signage.service &> /dev/null; then
    echo "✅ Autostart: HABILITADO"
else
    echo "❌ Autostart: DESABILITADO"
fi
