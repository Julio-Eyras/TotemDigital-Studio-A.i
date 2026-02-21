#!/bin/bash

# Smart Signage Pro - Corrigir Demora no Boot por networkd-wait-online
# =====================================================================
# Este script configura o systemd para não esperar a rede WiFi ficar online
# durante o boot, permitindo que o sistema inicie mais rapidamente.

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

error() {
    echo -e "${RED}[ERRO]${NC} $1" >&2
    exit 1
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
echo "║     Corrigir Demora no Boot - networkd-wait-online        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar se o usuário tem permissões sudo
if ! sudo -n true 2>/dev/null; then
    error "Este script precisa de permissões sudo"
    exit 1
fi

log "Configurando systemd para não esperar rede WiFi durante o boot..."

# ============================================================================
# 1. Configurar systemd-networkd-wait-online para não esperar WiFi
# ============================================================================

log "Configurando systemd-networkd-wait-online.service..."

# Criar override para networkd-wait-online
sudo mkdir -p /etc/systemd/system/systemd-networkd-wait-online.service.d/

sudo tee /etc/systemd/system/systemd-networkd-wait-online.service.d/override.conf > /dev/null << 'EOF'
[Service]
# Timeout de 10 segundos (ao invés de esperar indefinidamente)
TimeoutStartSec=10s

# Ignorar interfaces WiFi e outras interfaces que podem demorar
ExecStart=
ExecStart=/lib/systemd/systemd-networkd-wait-online --timeout=10 --any
EOF

if [[ $? -eq 0 ]]; then
    log "✅ Override para networkd-wait-online criado"
else
    error "❌ Falha ao criar override"
fi

# ============================================================================
# 2. Alternativa: Desabilitar completamente networkd-wait-online (opcional)
# ============================================================================

read -p "Deseja desabilitar completamente o networkd-wait-online? (s/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    log "Desabilitando systemd-networkd-wait-online.service..."
    sudo systemctl disable systemd-networkd-wait-online.service 2>/dev/null || true
    sudo systemctl mask systemd-networkd-wait-online.service 2>/dev/null || true
    log "✅ networkd-wait-online desabilitado"
fi

# ============================================================================
# 3. Configurar NetworkManager para não bloquear o boot (se estiver usando)
# ============================================================================

if systemctl is-enabled NetworkManager.service &>/dev/null; then
    log "NetworkManager detectado. Configurando para não bloquear boot..."
    
    # Criar override para NetworkManager
    sudo mkdir -p /etc/systemd/system/NetworkManager-wait-online.service.d/
    
    sudo tee /etc/systemd/system/NetworkManager-wait-online.service.d/override.conf > /dev/null << 'EOF'
[Service]
# Timeout de 10 segundos
TimeoutStartSec=10s
EOF
    
    # Desabilitar wait-online do NetworkManager
    sudo systemctl disable NetworkManager-wait-online.service 2>/dev/null || true
    
    log "✅ NetworkManager-wait-online configurado"
fi

# ============================================================================
# 4. Atualizar serviços do Smart Signage para não depender de network-online
# ============================================================================

log "Atualizando serviços do Smart Signage..."

# Verificar se smart-signage.service existe
if [[ -f /etc/systemd/system/smart-signage.service ]]; then
    log "Atualizando smart-signage.service..."
    
    # Criar override para remover dependência de network-online
    sudo mkdir -p /etc/systemd/system/smart-signage.service.d/
    
    sudo tee /etc/systemd/system/smart-signage.service.d/override.conf > /dev/null << 'EOF'
[Unit]
# Remover dependência de network-online.target
# Usar apenas network.target que só espera a interface existir
After=network.target docker.service
Wants=network.target docker.service
EOF
    
    log "✅ smart-signage.service atualizado"
fi

# Verificar outros serviços relacionados
SERVICES=(
    "smart-signage-backend.service"
    "smart-signage-frontend.service"
    "smart-signage-player.service"
)

for service in "${SERVICES[@]}"; do
    if [[ -f "/etc/systemd/system/$service" ]]; then
        log "Atualizando $service..."
        sudo mkdir -p "/etc/systemd/system/$service.d/"
        
        sudo tee "/etc/systemd/system/$service.d/override.conf" > /dev/null << EOF
[Unit]
After=network.target
Wants=network.target
EOF
        
        log "✅ $service atualizado"
    fi
done

# ============================================================================
# 5. Configurar systemd-networkd para não esperar endereço IP (se estiver usando)
# ============================================================================

if systemctl is-enabled systemd-networkd.service &>/dev/null; then
    log "systemd-networkd detectado. Configurando..."
    
    # Configurar para não esperar endereço IP em interfaces WiFi
    if [[ -d /etc/systemd/network ]]; then
        # Criar configuração para interfaces WiFi
        sudo tee /etc/systemd/network/99-wifi-no-wait.conf > /dev/null << 'EOF'
[Match]
Type=wlan

[Link]
RequiredForOnline=no
EOF
        
        log "✅ Configuração para WiFi criada"
    fi
fi

# ============================================================================
# 6. Recarregar systemd
# ============================================================================

log "Recarregando systemd..."
sudo systemctl daemon-reload

if [[ $? -eq 0 ]]; then
    log "✅ Systemd recarregado"
else
    error "❌ Falha ao recarregar systemd"
fi

# ============================================================================
# 7. Verificar configuração
# ============================================================================

echo ""
log "📊 VERIFICAÇÃO DA CONFIGURAÇÃO:"
echo ""

# Verificar networkd-wait-online
if systemctl is-enabled systemd-networkd-wait-online.service &>/dev/null; then
    echo "  systemd-networkd-wait-online: $(systemctl is-enabled systemd-networkd-wait-online.service)"
    echo "  Timeout configurado: 10 segundos"
else
    echo "  systemd-networkd-wait-online: DESABILITADO"
fi

# Verificar NetworkManager-wait-online
if systemctl is-enabled NetworkManager-wait-online.service &>/dev/null 2>&1; then
    echo "  NetworkManager-wait-online: $(systemctl is-enabled NetworkManager-wait-online.service)"
else
    echo "  NetworkManager-wait-online: DESABILITADO"
fi

# Verificar serviços do Smart Signage
if [[ -f /etc/systemd/system/smart-signage.service ]]; then
    echo "  smart-signage.service: $(systemctl is-enabled smart-signage.service)"
    echo "  Dependências: network.target (não network-online.target)"
fi

echo ""
log "✅ Configuração concluída!"
echo ""
info "📝 PRÓXIMOS PASSOS:"
echo "  1. Reinicie o sistema para testar: sudo reboot"
echo "  2. Verifique o tempo de boot: systemd-analyze"
echo "  3. Verifique o tempo de cada serviço: systemd-analyze blame"
echo ""
warning "⚠️  NOTA: O sistema agora iniciará sem esperar a rede WiFi ficar online."
warning "  Os serviços podem iniciar antes da rede estar completamente configurada."
warning "  Se algum serviço precisar de rede, ele deve lidar com reconexão internamente."

