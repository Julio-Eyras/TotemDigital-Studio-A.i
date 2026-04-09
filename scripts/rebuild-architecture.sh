#!/bin/bash

# Smart Signage Pro v2.0 - Script para Reconstruir com Nova Arquitetura
# ===================================================================

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

# Carregar .env e padrões de portas
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
echo "║      Smart Signage Pro v2.0 - Nova Arquitetura Separada    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log "Reconstruindo com nova arquitetura separada..."

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
$COMPOSE_CMD rm -f
docker rmi smart-signage-backend smart-signage-frontend 2>/dev/null || true

# 3. Limpar cache do Docker
log "Limpando cache do Docker..."
docker system prune -f

# 4. Verificar se os novos Dockerfiles existem
log "Verificando novos Dockerfiles..."
if [[ ! -f "Dockerfile.backend" ]]; then
    error "Dockerfile.backend não encontrado!"
    exit 1
fi

if [[ ! -f "Dockerfile.frontend" ]]; then
    error "Dockerfile.frontend não encontrado!"
    exit 1
fi

if [[ ! -f "nginx/nginx-complete.conf" ]]; then
    error "nginx/nginx-complete.conf não encontrado!"
    exit 1
fi

log "✅ Todos os arquivos necessários encontrados"

# 5. Reconstruir todos os serviços
log "Reconstruindo todos os serviços com nova arquitetura..."
$COMPOSE_CMD build --no-cache

if [[ $? -eq 0 ]]; then
    log "✅ Serviços reconstruídos com sucesso!"
else
    error "❌ Falha ao reconstruir serviços"
    exit 1
fi

# 6. Iniciar serviços na ordem correta
log "Iniciando serviços na ordem correta..."

# Iniciar PostgreSQL primeiro
log "Iniciando PostgreSQL..."
$COMPOSE_CMD up -d postgres

# Aguardar PostgreSQL ficar pronto
log "Aguardando PostgreSQL..."
for i in {1..30}; do
    if $COMPOSE_CMD ps | grep -q "postgres.*healthy"; then
        log "✅ PostgreSQL: Pronto"
        break
    fi
    sleep 2
done

# Iniciar Redis
log "Iniciando Redis..."
$COMPOSE_CMD up -d redis

# Aguardar Redis ficar pronto
log "Aguardando Redis..."
for i in {1..30}; do
    if $COMPOSE_CMD ps | grep -q "redis.*healthy"; then
        log "✅ Redis: Pronto"
        break
    fi
    sleep 2
done

# Iniciar Ollama
log "Iniciando Ollama..."
$COMPOSE_CMD up -d ollama

# Aguardar Ollama ficar pronto
log "Aguardando Ollama..."
for i in {1..30}; do
    if $COMPOSE_CMD ps | grep -q "ollama.*Up"; then
        log "✅ Ollama: Pronto"
        break
    fi
    sleep 2
done

# Iniciar Backend
log "Iniciando Backend..."
$COMPOSE_CMD up -d backend

# Aguardar Backend ficar pronto
log "Aguardando Backend..."
for i in {1..60}; do
    if curl -s http://localhost:${BACKEND_PORT}/health > /dev/null 2>&1; then
        log "✅ Backend: Pronto"
        break
    fi
    
    if [[ $((i % 10)) -eq 0 ]]; then
        log "Aguardando Backend... (${i}/60)"
        $COMPOSE_CMD logs --tail 5 backend
    fi
    
    sleep 2
done

# Iniciar Frontend
log "Iniciando Frontend..."
$COMPOSE_CMD up -d frontend

# Aguardar Frontend ficar pronto
log "Aguardando Frontend..."
for i in {1..30}; do
    if curl -s http://localhost:${FRONTEND_ALT_PORT} > /dev/null 2>&1; then
        log "✅ Frontend: Pronto"
        break
    fi
    sleep 2
done

# Nginx está integrado no frontend - não precisa iniciar separadamente

# Iniciar Monitoramento
log "Iniciando Monitoramento..."
$COMPOSE_CMD up -d prometheus grafana

# 7. Verificar status final
log "Verificando status final..."
$COMPOSE_CMD ps

# 8. Testar endpoints
log "Testando endpoints..."
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "📊 ENDPOINTS DISPONÍVEIS:"
echo "Frontend: http://$SERVER_IP:$FRONTEND_PORT (Nginx integrado)"
echo "Frontend Direto: http://$SERVER_IP:$FRONTEND_ALT_PORT"
echo "Backend API: http://$SERVER_IP:$BACKEND_PORT"
echo "Player: http://$SERVER_IP:$FRONTEND_PORT/player"
echo "Prometheus: http://$SERVER_IP:$PROMETHEUS_PORT"
echo "Grafana: http://$SERVER_IP:$GRAFANA_PORT"

# Testar conectividade
echo ""
log "Testando conectividade dos endpoints..."

test_endpoint() {
    local name=$1
    local url=$2
    
    if curl -s --max-time 5 "$url" > /dev/null 2>&1; then
        echo "✅ $name: OK"
    else
        echo "❌ $name: FALHOU"
    fi
}

test_endpoint "Frontend" "http://$SERVER_IP:$FRONTEND_PORT"
test_endpoint "Frontend Direto" "http://$SERVER_IP:$FRONTEND_ALT_PORT"
test_endpoint "Backend Health" "http://$SERVER_IP:$BACKEND_PORT/health"
test_endpoint "Backend API" "http://$SERVER_IP:$BACKEND_PORT/api/health"
test_endpoint "Prometheus" "http://$SERVER_IP:$PROMETHEUS_PORT"
test_endpoint "Grafana" "http://$SERVER_IP:$GRAFANA_PORT"

echo ""
log "🎉 Nova arquitetura implementada com sucesso!"
log "Cada serviço agora tem seu próprio container especializado!"
