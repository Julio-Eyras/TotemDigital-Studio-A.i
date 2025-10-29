#!/bin/bash

# Smart Signage Pro v2.0 - Script para Health Check do Sistema
# ===========================================================

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

# Carregar .env e padrões de porta
if [ -f "$INSTALL_DIR/.env" ]; then
    # shellcheck disable=SC1090
    . "$INSTALL_DIR/.env"
fi
FRONTEND_PORT=${FRONTEND_PORT:-8080}
FRONTEND_ALT_PORT=${FRONTEND_ALT_PORT:-3001}
BACKEND_PORT=${BACKEND_PORT:-3000}
PROMETHEUS_PORT=${PROMETHEUS_PORT:-9090}
GRAFANA_PORT=${GRAFANA_PORT:-3002}

# Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          Smart Signage Pro v2.0 - Health Check              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log "Executando health check do Smart Signage Pro..."

# Verificar se Docker está disponível
check_docker() {
    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        error "Docker Compose não encontrado!"
        return 1
    fi
    return 0
}

# Verificar se estamos no diretório correto
if [[ ! -d "$INSTALL_DIR" ]]; then
    error "Diretório de instalação não encontrado: $INSTALL_DIR"
    exit 1
fi

cd $INSTALL_DIR

# Verificar Docker
log "Verificando Docker..."
if check_docker; then
    echo "✅ Docker: OK"
else
    echo "❌ Docker: FALHOU"
    exit 1
fi

# Verificar containers
log "Verificando containers..."
if $COMPOSE_CMD ps | grep -q "Up"; then
    echo "✅ Containers: RODANDO"
    $COMPOSE_CMD ps
else
    echo "❌ Containers: NÃO ESTÃO RODANDO"
    echo "Para iniciar: ./scripts/start-system.sh"
    exit 1
fi

# Obter IP do servidor
SERVER_IP=$(hostname -I | awk '{print $1}')

# Função para testar endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    log "Testando $name: $url"
    
    if response=$(curl -s -w "%{http_code}" -o /dev/null --max-time 10 "$url" 2>/dev/null); then
        if [[ "$response" == "$expected_status" ]]; then
            echo "✅ $name: OK (HTTP $response)"
            return 0
        else
            echo "⚠️ $name: HTTP $response (esperado $expected_status)"
            return 1
        fi
    else
        echo "❌ $name: FALHOU (timeout ou erro de conexão)"
        return 1
    fi
}

# Testar endpoints
log "Testando endpoints..."
echo ""

# Testar Frontend
test_endpoint "Frontend (Nginx)" "http://$SERVER_IP:$FRONTEND_PORT"
test_endpoint "Frontend Direto" "http://$SERVER_IP:$FRONTEND_ALT_PORT"

# Testar Backend Health
test_endpoint "Backend Health" "http://$SERVER_IP:$BACKEND_PORT/health"

# Testar Backend API
test_endpoint "Backend API" "http://$SERVER_IP:$BACKEND_PORT/api/health"

# Testar Player
test_endpoint "Player" "http://$SERVER_IP:$FRONTEND_PORT/player"

# Testar Prometheus
test_endpoint "Prometheus" "http://$SERVER_IP:$PROMETHEUS_PORT"

# Testar Grafana
test_endpoint "Grafana" "http://$SERVER_IP:$GRAFANA_PORT"

# Verificar recursos do sistema
echo ""
log "Verificando recursos do sistema..."

# Uso de CPU
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
echo "CPU: ${CPU_USAGE}%"

# Uso de memória
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
echo "Memória: ${MEMORY_USAGE}%"

# Uso de disco
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}')
echo "Disco: $DISK_USAGE"

# Verificar logs de erro
echo ""
log "Verificando logs de erro recentes..."
ERROR_COUNT=$($COMPOSE_CMD logs --since=1h 2>&1 | grep -i "error\|fail\|exception" | wc -l)
if [[ $ERROR_COUNT -gt 0 ]]; then
    echo "⚠️ $ERROR_COUNT erros encontrados na última hora"
    echo "Para ver detalhes: ./scripts/logs-system.sh"
else
    echo "✅ Nenhum erro encontrado na última hora"
fi

# Verificar conectividade de rede
echo ""
log "Verificando conectividade de rede..."
if ping -c 1 8.8.8.8 &> /dev/null; then
    echo "✅ Conectividade de rede: OK"
else
    echo "❌ Conectividade de rede: FALHOU"
fi

# Resumo final
echo ""
log "📊 RESUMO DO HEALTH CHECK:"
echo "Data/Hora: $(date)"
echo "Servidor: $SERVER_IP"
echo "Uptime: $(uptime -p)"
echo "Containers: $($COMPOSE_CMD ps | grep -c "Up") rodando"

# Status do autostart
if systemctl is-enabled smart-signage.service &> /dev/null; then
    echo "Autostart: HABILITADO"
else
    echo "Autostart: DESABILITADO"
fi

echo ""
log "🎉 Health check concluído!"
