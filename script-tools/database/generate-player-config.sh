#!/bin/bash
# Script para gerar arquivo de configuração encriptado do player
# Vincula o UIN ao hardware da máquina (MAC address)

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função de log
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1" >&2
    exit 1
}

# Verificar argumentos
if [[ $# -lt 2 ]]; then
    error "Uso: $0 <UIN> <PLAYER_DIR> [SECRET_KEY]"
    echo "Exemplo: $0 default-demo /opt/smart-signage/player-web"
    exit 1
fi

UIN="$1"
PLAYER_DIR="$2"
SECRET_KEY="${3:-smart-signage-totem-secret-key-2025-change-in-production}"

# Validar UIN
if [[ -z "$UIN" || ${#UIN} -lt 3 ]]; then
    error "UIN inválido: deve ter pelo menos 3 caracteres"
fi

# Validar diretório do player
if [[ ! -d "$PLAYER_DIR" ]]; then
    error "Diretório do player não encontrado: $PLAYER_DIR"
fi

log "Gerando configuração encriptada do player para UIN: $UIN"

# Obter MAC address da primeira interface de rede ativa
MAC_ADDRESS=$(ip link show | grep -A1 "state UP" | grep -oE "([0-9a-f]{2}:){5}[0-9a-f]{2}" | head -1)
if [[ -z "$MAC_ADDRESS" ]]; then
    # Fallback: usar MAC de eth0 ou en0
    MAC_ADDRESS=$(cat /sys/class/net/eth0/address 2>/dev/null || cat /sys/class/net/enp0s3/address 2>/dev/null || echo "00:00:00:00:00:00")
fi

log "MAC Address detectado: $MAC_ADDRESS"

# Criar payload: UIN + MAC + timestamp
TIMESTAMP=$(date +%s)
PAYLOAD="${UIN}:${MAC_ADDRESS}:${TIMESTAMP}"

# Encriptar usando OpenSSL (AES-256-CBC)
# Usar MAC como salt adicional para vinculação ao hardware
ENCRYPTED=$(echo -n "$PAYLOAD" | openssl enc -aes-256-cbc -base64 -salt -pbkdf2 -iter 10000 -k "$SECRET_KEY" 2>/dev/null)

if [[ -z "$ENCRYPTED" ]]; then
    error "Falha ao encriptar configuração"
fi

# Criar arquivo de configuração JSON
CONFIG_FILE="${PLAYER_DIR}/config.json.enc"
cat > "$CONFIG_FILE" << EOF
{
  "encrypted": true,
  "version": "1.0",
  "data": "$ENCRYPTED",
  "mac": "$MAC_ADDRESS",
  "created": "$TIMESTAMP"
}
EOF

# Proteger arquivo (apenas leitura para owner)
chmod 600 "$CONFIG_FILE"

log "✅ Arquivo de configuração gerado: $CONFIG_FILE"
log "   UIN: $UIN"
log "   MAC: $MAC_ADDRESS"
log "   Arquivo protegido (chmod 600)"

# Verificar se foi criado corretamente
if [[ -f "$CONFIG_FILE" ]]; then
    log "✅ Configuração do player pronta!"
else
    error "Falha ao criar arquivo de configuração"
fi

