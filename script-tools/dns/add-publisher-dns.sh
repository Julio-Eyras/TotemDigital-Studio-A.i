#!/bin/bash
# =============================================================================
# Script para Adicionar DNS Local para Publisher
# =============================================================================
# Uso: ./add-publisher-dns.sh <publisher_id>
# Exemplo: ./add-publisher-dns.sh 1
# =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[OK]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Verificar se está rodando como root
if [[ $EUID -ne 0 ]]; then
    error "Este script precisa ser executado como root (use sudo)"
    exit 1
fi

# Verificar argumento
PUBLISHER_ID=$1
if [[ -z "$PUBLISHER_ID" ]]; then
    error "Uso: $0 <publisher_id>"
    echo "Exemplo: $0 1"
    exit 1
fi

# Validar que é um número
if ! [[ "$PUBLISHER_ID" =~ ^[0-9]+$ ]]; then
    error "Publisher ID deve ser um número"
    exit 1
fi

DNSMASQ_CONF="/etc/dnsmasq.d/smartsignage-publishers-subscribers.conf"

# Verificar se arquivo de configuração existe
if [[ ! -f "$DNSMASQ_CONF" ]]; then
    error "Arquivo de configuração DNS não encontrado: $DNSMASQ_CONF"
    error "Execute o script de instalação primeiro ou configure DNS local manualmente"
    exit 1
fi

# Verificar se já existe
if grep -q "publisher${PUBLISHER_ID}.local" "$DNSMASQ_CONF" 2>/dev/null; then
    warn "Publisher ${PUBLISHER_ID} já está configurado no DNS local"
    exit 0
fi

log "Adicionando DNS local para publisher${PUBLISHER_ID}..."

# Adicionar entradas DNS
{
    echo ""
    echo "# Publisher ${PUBLISHER_ID} (adicionado via script)"
    echo "address=/publisher${PUBLISHER_ID}.local/127.0.0.1"
    echo "address=/api.publisher${PUBLISHER_ID}.local/127.0.0.1"
    echo "address=/mqtt.publisher${PUBLISHER_ID}.local/127.0.0.1"
    echo "address=/player.publisher${PUBLISHER_ID}.local/127.0.0.1"
} | sudo tee -a "$DNSMASQ_CONF" > /dev/null

# Reiniciar dnsmasq
log "Reiniciando dnsmasq..."
sudo systemctl restart dnsmasq || {
    error "Falha ao reiniciar dnsmasq"
    exit 1
}

# Validar
sleep 1
if nslookup "publisher${PUBLISHER_ID}.local" 127.0.0.1 >/dev/null 2>&1; then
    log "✅ DNS local configurado para publisher${PUBLISHER_ID}.local"
    info "Domínios disponíveis:"
    echo "   • publisher${PUBLISHER_ID}.local"
    echo "   • api.publisher${PUBLISHER_ID}.local"
    echo "   • mqtt.publisher${PUBLISHER_ID}.local"
    echo "   • player.publisher${PUBLISHER_ID}.local"
else
    warn "⚠️  DNS pode não estar funcionando. Teste manualmente:"
    echo "   nslookup publisher${PUBLISHER_ID}.local 127.0.0.1"
fi
