#!/bin/bash

# Smart Signage Pro v2.0 - Script para Atualizar Sistema
# ======================================================

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
echo "║            Smart Signage Pro v2.0 - Atualizar Sistema       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log "Atualizando Smart Signage Pro..."

# Verificar se estamos no diretório correto
if [[ ! -d "$INSTALL_DIR" ]]; then
    error "Diretório de instalação não encontrado: $INSTALL_DIR"
    exit 1
fi

cd $INSTALL_DIR

# Fazer backup antes da atualização
log "Criando backup antes da atualização..."
BACKUP_FILE="backup-pre-update-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf $BACKUP_FILE data logs 2>/dev/null || warning "Não foi possível criar backup completo"
log "✅ Backup criado: $BACKUP_FILE"

# Parar sistema
log "Parando sistema para atualização..."
check_docker
$COMPOSE_CMD down

# Atualizar código (se for um repositório git)
if [[ -d ".git" ]]; then
    log "Atualizando código do repositório..."
    git pull origin main
    if [[ $? -eq 0 ]]; then
        log "✅ Código atualizado com sucesso!"
    else
        warning "Falha ao atualizar código do repositório"
    fi
else
    warning "Não é um repositório git, pulando atualização de código"
fi

# Atualizar dependências do backend
if [[ -d "backend" ]]; then
    log "Atualizando dependências do backend..."
    cd backend
    npm install
    if [[ $? -eq 0 ]]; then
        log "✅ Dependências do backend atualizadas!"
    else
        error "Falha ao atualizar dependências do backend"
        exit 1
    fi
    cd ..
fi

# Atualizar dependências do frontend
if [[ -d "frontend" ]]; then
    log "Atualizando dependências do frontend..."
    cd frontend
    npm install
    if [[ $? -eq 0 ]]; then
        log "✅ Dependências do frontend atualizadas!"
    else
        error "Falha ao atualizar dependências do frontend"
        exit 1
    fi
    cd ..
fi

# Reconstruir e iniciar containers
log "Reconstruindo containers com as atualizações..."
$COMPOSE_CMD build --no-cache

if [[ $? -eq 0 ]]; then
    log "✅ Containers reconstruídos com sucesso!"
else
    error "Falha ao reconstruir containers"
    exit 1
fi

log "Iniciando sistema atualizado..."
$COMPOSE_CMD up -d

# Aguardar serviços ficarem prontos
log "Aguardando serviços ficarem prontos..."
sleep 15

# Verificar se tudo está funcionando
if $COMPOSE_CMD ps | grep -q "Up"; then
    log "✅ Sistema atualizado e funcionando!"
    
    # Mostrar status
    $COMPOSE_CMD ps
    
    # Mostrar endpoints
    SERVER_IP=$(hostname -I | awk '{print $1}')
    echo ""
    echo "📊 ENDPOINTS DISPONÍVEIS:"
    echo "Frontend: http://$SERVER_IP:$FRONTEND_PORT"
    echo "Backend API: http://$SERVER_IP:$BACKEND_PORT"
    echo "Player: http://$SERVER_IP:$FRONTEND_PORT/player"
    echo "Prometheus: http://$SERVER_IP:$PROMETHEUS_PORT"
    echo "Grafana: http://$SERVER_IP:$GRAFANA_PORT"
else
    error "❌ Falha ao iniciar sistema após atualização"
    $COMPOSE_CMD logs --tail 20
    exit 1
fi

log "🎉 Atualização concluída com sucesso!"
