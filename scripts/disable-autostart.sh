#!/bin/bash

# Smart Signage Pro v2.0 - Script para Desabilitar Autostart
# =========================================================

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
echo "║         Smart Signage Pro v2.0 - Desabilitar Autostart      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar se o usuário tem permissões sudo
if ! sudo -n true 2>/dev/null; then
    error "Este script precisa de permissões sudo para desabilitar o autostart"
    exit 1
fi

log "Desabilitando autostart do Smart Signage Pro..."

# Verificar se o serviço existe
if [[ ! -f "/etc/systemd/system/smart-signage.service" ]]; then
    warning "Serviço smart-signage.service não encontrado!"
    warning "O autostart pode não ter sido configurado ainda."
    exit 1
fi

# Parar o serviço se estiver rodando
log "Parando serviço se estiver rodando..."
sudo systemctl stop smart-signage.service 2>/dev/null || true

# Desabilitar o serviço
log "Desabilitando serviço de autostart..."
sudo systemctl disable smart-signage.service

if [[ $? -eq 0 ]]; then
    log "✅ Autostart desabilitado com sucesso!"
else
    error "❌ Falha ao desabilitar autostart"
    exit 1
fi

# Verificar status
log "Verificando status do serviço..."
if sudo systemctl is-enabled smart-signage.service &> /dev/null; then
    echo "❌ Autostart: AINDA HABILITADO"
else
    echo "✅ Autostart: DESABILITADO"
fi

# Perguntar se quer remover o arquivo de serviço
echo ""
read -p "Deseja remover completamente o arquivo de serviço? (y/N): " remove_service

if [[ "$remove_service" =~ ^[Yy]$ ]]; then
    log "Removendo arquivo de serviço..."
    sudo rm -f /etc/systemd/system/smart-signage.service
    sudo systemctl daemon-reload
    log "✅ Arquivo de serviço removido!"
else
    log "Arquivo de serviço mantido (pode ser reabilitado posteriormente)"
fi

echo ""
echo "📊 INFORMAÇÕES:"
echo "O sistema NÃO será mais iniciado automaticamente no boot"
echo "Para iniciar manualmente: ./scripts/start-system.sh"
echo "Para reabilitar autostart: ./scripts/autostart-system.sh"

echo ""
log "🎉 Autostart desabilitado com sucesso!"
