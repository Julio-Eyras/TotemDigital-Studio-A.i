#!/bin/bash

# =============================================================================
# Script para Parar Serviços - Smart Signage Pro
# =============================================================================
# Uso: ./stop-services.sh [backend|frontend|all]
# =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SERVICE=${1:-all}

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

# Verificar se Docker está disponível
check_docker() {
    if command -v docker &> /dev/null && docker ps &> /dev/null; then
        return 0
    fi
    return 1
}

# Parar via Docker Compose
stop_docker() {
    local service=$1
    
    if [ "$service" == "all" ]; then
        log "Parando todos os serviços via Docker Compose..."
        docker compose down
        log "✅ Todos os serviços parados"
    elif [ "$service" == "backend" ]; then
        log "Parando backend via Docker Compose..."
        docker compose stop backend
        log "✅ Backend parado"
    elif [ "$service" == "frontend" ]; then
        log "Parando frontend via Docker Compose..."
        docker compose stop frontend
        log "✅ Frontend parado"
    fi
}

# Parar via Systemd
stop_systemd() {
    local service=$1
    
    if [ "$service" == "all" ] || [ "$service" == "backend" ]; then
        if systemctl is-active --quiet smart-signage 2>/dev/null; then
            log "Parando serviço systemd: smart-signage..."
            sudo systemctl stop smart-signage
            log "✅ Serviço smart-signage parado"
        fi
        
        if systemctl is-active --quiet smartsignage-backend 2>/dev/null; then
            log "Parando serviço systemd: smartsignage-backend..."
            sudo systemctl stop smartsignage-backend
            log "✅ Serviço smartsignage-backend parado"
        fi
    fi
    
    if [ "$service" == "all" ] || [ "$service" == "frontend" ]; then
        if systemctl is-active --quiet smartsignage-frontend 2>/dev/null; then
            log "Parando serviço systemd: smartsignage-frontend..."
            sudo systemctl stop smartsignage-frontend
            log "✅ Serviço smartsignage-frontend parado"
        fi
    fi
}

# Parar processos Node.js por porta
stop_by_port() {
    local port=$1
    local service_name=$2
    
    # Verificar se há processo na porta
    if lsof -ti:$port &> /dev/null; then
        log "Parando processo na porta $port ($service_name)..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        log "✅ Processo na porta $port parado"
    else
        warn "Nenhum processo encontrado na porta $port"
    fi
}

# Parar processos Node.js por nome
stop_by_name() {
    local pattern=$1
    local service_name=$2
    
    if pgrep -f "$pattern" &> /dev/null; then
        log "Parando processos: $service_name..."
        pkill -f "$pattern" 2>/dev/null || true
        sleep 1
        
        # Forçar parada se ainda estiver rodando
        if pgrep -f "$pattern" &> /dev/null; then
            pkill -9 -f "$pattern" 2>/dev/null || true
        fi
        
        log "✅ Processos $service_name parados"
    else
        warn "Nenhum processo encontrado: $service_name"
    fi
}

# Função principal
main() {
    log "🛑 Parando serviços Smart Signage Pro..."
    log "Serviço: $SERVICE"
    echo ""
    
    # Tentar Docker primeiro
    if check_docker && [ -f "docker-compose.yml" ]; then
        log "Docker Compose detectado"
        stop_docker "$SERVICE"
        return 0
    fi
    
    # Tentar Systemd
    if command -v systemctl &> /dev/null; then
        log "Systemd detectado"
        stop_systemd "$SERVICE"
    fi
    
    # Parar por porta (fallback)
    if [ "$SERVICE" == "all" ] || [ "$SERVICE" == "backend" ]; then
        stop_by_port 3000 "Backend"
    fi
    
    if [ "$SERVICE" == "all" ] || [ "$SERVICE" == "frontend" ]; then
        stop_by_port 3001 "Frontend"
        stop_by_port 8080 "Frontend (alternativa)"
    fi
    
    # Parar por nome de processo (fallback)
    if [ "$SERVICE" == "all" ] || [ "$SERVICE" == "backend" ]; then
        stop_by_name "node.*backend" "Backend"
        stop_by_name "node.*dist/index.js" "Backend"
    fi
    
    if [ "$SERVICE" == "all" ] || [ "$SERVICE" == "frontend" ]; then
        stop_by_name "node.*frontend" "Frontend"
    fi
    
    log "✅ Processo de parada concluído"
    
    # Verificar se ainda há processos rodando
    echo ""
    log "Verificando processos restantes..."
    if pgrep -f "smartsignage\|smart-signage" &> /dev/null; then
        warn "⚠️  Ainda há processos rodando:"
        ps aux | grep -E "smartsignage|smart-signage" | grep -v grep || true
    else
        log "✅ Nenhum processo restante encontrado"
    fi
}

# Executar
main
