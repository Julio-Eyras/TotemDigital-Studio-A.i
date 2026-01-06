#!/bin/bash

# =============================================================================
# Script para Parar TODOS os Serviços - Smart Signage Pro
# =============================================================================
# Uso: ./stop-all.sh
# Descrição: Para todos os serviços backend e frontend (Docker, systemd, processos Node.js)
# =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

log "🛑 Parando TODOS os serviços Smart Signage Pro..."
echo ""

# 1. Parar serviços Docker Compose
if command -v docker &> /dev/null && [ -f "docker-compose.yml" ]; then
    log "Parando serviços Docker Compose..."
    docker compose down 2>/dev/null || docker-compose down 2>/dev/null || warn "Docker Compose não encontrado ou sem serviços rodando"
fi

# 2. Parar serviços systemd
if command -v systemctl &> /dev/null; then
    log "Parando serviços systemd..."
    
    # Backend
    if sudo systemctl is-active --quiet smart-signage 2>/dev/null; then
        log "Parando smart-signage..."
        sudo systemctl stop smart-signage 2>/dev/null || true
    fi
    
    if sudo systemctl is-active --quiet smartsignage-backend 2>/dev/null; then
        log "Parando smartsignage-backend..."
        sudo systemctl stop smartsignage-backend 2>/dev/null || true
    fi
    
    # Frontend
    if sudo systemctl is-active --quiet smartsignage-frontend 2>/dev/null; then
        log "Parando smartsignage-frontend..."
        sudo systemctl stop smartsignage-frontend 2>/dev/null || true
    fi
fi

# 3. Parar processos por porta (Backend - porta 3000)
if command -v lsof &> /dev/null; then
    log "Parando processos por porta..."
    
    # Backend (porta 3000)
    if lsof -ti:3000 &> /dev/null; then
        log "Parando processo na porta 3000 (Backend)..."
        lsof -ti:3000 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    
    # Frontend (porta 3001)
    if lsof -ti:3001 &> /dev/null; then
        log "Parando processo na porta 3001 (Frontend)..."
        lsof -ti:3001 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    
    # Frontend alternativo (porta 8080)
    if lsof -ti:8080 &> /dev/null; then
        log "Parando processo na porta 8080 (Frontend alternativo)..."
        lsof -ti:8080 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
fi

# 4. Parar processos Node.js por nome
if command -v pgrep &> /dev/null; then
    log "Parando processos Node.js..."
    
    # Backend
    if pgrep -f "node.*backend" &> /dev/null || pgrep -f "node.*dist/index.js" &> /dev/null; then
        log "Parando processos backend..."
        pkill -f "node.*backend" 2>/dev/null || true
        pkill -f "node.*dist/index.js" 2>/dev/null || true
        sleep 1
        
        # Forçar parada se ainda estiver rodando
        if pgrep -f "node.*backend" &> /dev/null || pgrep -f "node.*dist/index.js" &> /dev/null; then
            pkill -9 -f "node.*backend" 2>/dev/null || true
            pkill -9 -f "node.*dist/index.js" 2>/dev/null || true
        fi
    fi
    
    # Frontend
    if pgrep -f "node.*frontend" &> /dev/null || pgrep -f "react-scripts" &> /dev/null; then
        log "Parando processos frontend..."
        pkill -f "node.*frontend" 2>/dev/null || true
        pkill -f "react-scripts" 2>/dev/null || true
        sleep 1
        
        # Forçar parada se ainda estiver rodando
        if pgrep -f "node.*frontend" &> /dev/null || pgrep -f "react-scripts" &> /dev/null; then
            pkill -9 -f "node.*frontend" 2>/dev/null || true
            pkill -9 -f "react-scripts" 2>/dev/null || true
        fi
    fi
fi

# 5. Verificar processos restantes
echo ""
log "Verificando processos restantes..."
if pgrep -f "smartsignage\|smart-signage\|backend.*dist\|frontend.*build" &> /dev/null; then
    warn "⚠️  Ainda há processos rodando:"
    ps aux | grep -E "smartsignage|smart-signage|backend.*dist|frontend.*build" | grep -v grep || true
    echo ""
    warn "Execute novamente o script se necessário ou mate os processos manualmente"
else
    log "✅ Todos os serviços foram parados com sucesso!"
fi

echo ""
log "✅ Processo de parada concluído"
