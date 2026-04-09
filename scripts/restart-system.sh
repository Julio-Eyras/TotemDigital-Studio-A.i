#!/bin/bash

# Smart Signage Pro v2.0 - Script para Reiniciar Sistema
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

# Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║            Smart Signage Pro v2.0 - Reiniciar Sistema       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log "Reiniciando Smart Signage Pro..."

# Parar sistema
log "Parando sistema..."
bash $INSTALL_DIR/scripts/stop-system.sh

# Aguardar um pouco
log "Aguardando 5 segundos..."
sleep 5

# Iniciar sistema
log "Iniciando sistema..."
bash $INSTALL_DIR/scripts/start-system.sh

log "✅ Reinicialização concluída!"
