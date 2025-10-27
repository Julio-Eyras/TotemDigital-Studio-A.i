#!/bin/bash

# Smart Signage Pro v2.0 - Script para Configurar Autostart
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

# Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          Smart Signage Pro v2.0 - Configurar Autostart      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar se o usuário tem permissões sudo
if ! sudo -n true 2>/dev/null; then
    error "Este script precisa de permissões sudo para configurar o autostart"
    exit 1
fi

log "Configurando autostart do Smart Signage Pro..."

# Verificar se estamos no diretório correto
if [[ ! -d "$INSTALL_DIR" ]]; then
    error "Diretório de instalação não encontrado: $INSTALL_DIR"
    exit 1
fi

# Criar arquivo de serviço systemd
log "Criando arquivo de serviço systemd..."

sudo tee /etc/systemd/system/smart-signage.service > /dev/null << 'EOF'
[Unit]
Description=Smart Signage Pro v2.0
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/smart-signage
ExecStart=/opt/smart-signage/scripts/start-system.sh
ExecStop=/opt/smart-signage/scripts/stop-system.sh
TimeoutStartSec=0
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOF

if [[ $? -eq 0 ]]; then
    log "✅ Arquivo de serviço criado com sucesso!"
else
    error "❌ Falha ao criar arquivo de serviço"
    exit 1
fi

# Recarregar systemd
log "Recarregando systemd..."
sudo systemctl daemon-reload

if [[ $? -eq 0 ]]; then
    log "✅ Systemd recarregado com sucesso!"
else
    error "❌ Falha ao recarregar systemd"
    exit 1
fi

# Habilitar serviço
log "Habilitando serviço de autostart..."
sudo systemctl enable smart-signage.service

if [[ $? -eq 0 ]]; then
    log "✅ Autostart configurado com sucesso!"
else
    error "❌ Falha ao habilitar autostart"
    exit 1
fi

# Verificar status
log "Verificando status do serviço..."
if sudo systemctl is-enabled smart-signage.service &> /dev/null; then
    echo "✅ Autostart: HABILITADO"
else
    echo "❌ Autostart: DESABILITADO"
fi

# Mostrar informações
echo ""
echo "📊 INFORMAÇÕES DO AUTOSTART:"
echo "Serviço: smart-signage.service"
echo "Status: $(sudo systemctl is-enabled smart-signage.service)"
echo "Arquivo: /etc/systemd/system/smart-signage.service"
echo "Script de início: $INSTALL_DIR/scripts/start-system.sh"
echo "Script de parada: $INSTALL_DIR/scripts/stop-system.sh"

echo ""
echo "🔧 COMANDOS ÚTEIS:"
echo "Ver status: sudo systemctl status smart-signage.service"
echo "Iniciar agora: sudo systemctl start smart-signage.service"
echo "Parar agora: sudo systemctl stop smart-signage.service"
echo "Desabilitar: sudo systemctl disable smart-signage.service"
echo "Ver logs: sudo journalctl -u smart-signage.service -f"

echo ""
log "🎉 Autostart configurado com sucesso!"
log "O sistema será iniciado automaticamente quando o servidor for ligado!"
