#!/bin/bash

# Smart Signage Pro v2.0 - Script para Corrigir Problemas do Backend
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

# Carregar .env e padrões de portas
if [ -f "$INSTALL_DIR/.env" ]; then
    # shellcheck disable=SC1090
    . "$INSTALL_DIR/.env"
fi
FRONTEND_PORT=${FRONTEND_PORT:-8080}
BACKEND_PORT=${BACKEND_PORT:-3000}
PROMETHEUS_PORT=${PROMETHEUS_PORT:-9090}
GRAFANA_PORT=${GRAFANA_PORT:-3002}

# Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         Smart Signage Pro v2.0 - Corrigir Backend           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log "Corrigindo problemas do Backend..."

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

# 1. Parar o container backend
log "Parando container backend..."
$COMPOSE_CMD stop backend

# 2. Remover container backend
log "Removendo container backend..."
$COMPOSE_CMD rm -f backend

# 3. Verificar se há problemas com a imagem
log "Verificando imagem do backend..."
if docker images | grep -q "smart-signage-backend"; then
    log "Imagem encontrada, reconstruindo..."
    $COMPOSE_CMD build --no-cache backend
else
    log "Imagem não encontrada, construindo..."
    $COMPOSE_CMD build backend
fi

# 4. Verificar se o arquivo .env existe e tem as configurações corretas
log "Verificando arquivo .env..."
if [[ -f ".env" ]]; then
    log "Arquivo .env encontrado"
    cat .env
else
    log "Criando arquivo .env..."
    cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DB_DRIVER=postgres
DATABASE_URL=postgresql://smartsignage:smartsignage123@postgres:5432/smartsignage
JWT_SECRET=smartsignage-docker-secret-key-2025
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
PLAYER_ABANDON_PIN=1234
AI_PROVIDER=ollama
AI_MODEL=llama3.2:3b
OLLAMA_BASE_URL=http://ollama:11434
UPLOAD_MAX_SIZE=2GB
UPLOAD_PATH=/opt/smart-signage/public/assets/uploads
MEDIA_QUOTA_PER_CLIENT=5GB
LOG_LEVEL=info
LOG_FILE=/opt/smart-signage/logs/app.log
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
fi

# 5. Verificar se o diretório de logs existe
log "Verificando diretório de logs..."
mkdir -p logs
chmod 755 logs

# 6. Verificar se o diretório de dados existe
log "Verificando diretório de dados..."
mkdir -p data
chmod 755 data

# 7. Verificar se o diretório de uploads existe
log "Verificando diretório de uploads..."
mkdir -p public/assets/uploads
chmod 755 public/assets/uploads

# 8. Iniciar apenas o backend primeiro
log "Iniciando apenas o backend..."
$COMPOSE_CMD up -d backend

# 9. Aguardar o backend ficar pronto
log "Aguardando backend ficar pronto..."
for i in {1..30}; do
    if curl -s http://localhost:${BACKEND_PORT}/health > /dev/null 2>&1; then
        log "✅ Backend: Pronto"
        break
    fi
    
    if [[ $((i % 5)) -eq 0 ]]; then
        log "Aguardando Backend... (${i}/30)"
        # Mostrar logs do backend
        log "Logs do backend:"
        $COMPOSE_CMD logs --tail 10 backend
    fi
    
    sleep 2
done

# 10. Verificar se o backend está funcionando
if curl -s http://localhost:${BACKEND_PORT}/health > /dev/null 2>&1; then
    log "✅ Backend corrigido e funcionando!"
    
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
    echo "Frontend: http://$SERVER_IP:$FRONTEND_PORT"
    echo "Backend API: http://$SERVER_IP:$BACKEND_PORT"
    echo "API: http://$SERVER_IP:$FRONTEND_PORT/api/player/"
    echo "Prometheus: http://$SERVER_IP:$PROMETHEUS_PORT"
    echo "Grafana: http://$SERVER_IP:$GRAFANA_PORT"
    
else
    error "❌ Backend ainda não está funcionando"
    log "Logs do backend:"
    $COMPOSE_CMD logs --tail 20 backend
    exit 1
fi

log "🎉 Correção do backend concluída!"
