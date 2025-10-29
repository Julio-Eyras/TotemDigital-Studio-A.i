#!/bin/bash

# Smart Signage Pro v2.0 - Script para Ver Logs do Sistema
# ========================================================

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
echo "║            Smart Signage Pro v2.0 - Logs do Sistema         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log "Exibindo logs do Smart Signage Pro..."
check_docker
cd $INSTALL_DIR

# Verificar se há containers rodando
if ! $COMPOSE_CMD ps | grep -q "Up"; then
    warning "Nenhum container está rodando!"
    log "Para iniciar o sistema, execute: ./scripts/start-system.sh"
    exit 1
fi

# Mostrar opções de logs
echo ""
echo "Escolha uma opção:"
echo "1. Logs de todos os serviços (recomendado)"
echo "2. Logs apenas do Backend"
echo "3. Logs apenas do Frontend"
echo "4. Logs apenas do PostgreSQL"
echo "5. Logs apenas do Redis"
echo "6. Logs apenas do Ollama"
echo "7. Logs apenas do Frontend (inclui Nginx integrado)"
echo "8. Logs apenas do Prometheus"
echo "9. Logs apenas do Grafana"
echo ""

read -p "Digite sua escolha (1-8): " choice

case $choice in
    1)
        log "Exibindo logs de todos os serviços..."
        log "Pressione Ctrl+C para sair"
        $COMPOSE_CMD logs -f
        ;;
    2)
        log "Exibindo logs do Backend..."
        log "Pressione Ctrl+C para sair"
        $COMPOSE_CMD logs -f backend
        ;;
    3)
        log "Exibindo logs do Frontend..."
        log "Pressione Ctrl+C para sair"
        $COMPOSE_CMD logs -f frontend
        ;;
    4)
        log "Exibindo logs do PostgreSQL..."
        log "Pressione Ctrl+C para sair"
        $COMPOSE_CMD logs -f postgres
        ;;
    5)
        log "Exibindo logs do Redis..."
        log "Pressione Ctrl+C para sair"
        $COMPOSE_CMD logs -f redis
        ;;
    6)
        log "Exibindo logs do Ollama..."
        log "Pressione Ctrl+C para sair"
        $COMPOSE_CMD logs -f ollama
        ;;
    7)
        log "Exibindo logs do Prometheus..."
        log "Pressione Ctrl+C para sair"
        $COMPOSE_CMD logs -f prometheus
        ;;
    8)
        log "Exibindo logs do Grafana..."
        log "Pressione Ctrl+C para sair"
        $COMPOSE_CMD logs -f grafana
        ;;
    *)
        error "Opção inválida!"
        exit 1
        ;;
esac
