#!/bin/bash
# Script para criar um novo totem com UIN no banco de dados
# e gerar o arquivo de configuração encriptado do player

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

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

# Verificar argumentos
if [[ $# -lt 2 ]]; then
    error "Uso: $0 <UIN> <NOME_DO_TOTEM> [CLIENT_ID] [DESCRICAO]"
    echo ""
    echo "Exemplos:"
    echo "  $0 'TOTEM-001' 'Totem Entrada Principal' 1 'Totem localizado na entrada principal'"
    echo "  $0 'UIN-ABC-123' 'Totem Demo' 1"
    echo ""
    echo "Argumentos:"
    echo "  UIN          : Identificador único do totem (obrigatório, deve ser único)"
    echo "  NOME_DO_TOTEM: Nome/identificador do totem (obrigatório)"
    echo "  CLIENT_ID    : ID do cliente (opcional, padrão: 1)"
    echo "  DESCRICAO    : Descrição do totem (opcional)"
    exit 1
fi

UIN="$1"
TOTEM_NAME="$2"
CLIENT_ID="${3:-1}"
DESCRIPTION="${4:-$TOTEM_NAME}"

# Validar UIN
if [[ -z "$UIN" || ${#UIN} -lt 3 ]]; then
    error "UIN inválido: deve ter pelo menos 3 caracteres"
fi

# Validar formato do UIN (sem espaços, apenas alfanuméricos e hífens)
if [[ ! "$UIN" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    error "UIN inválido: deve conter apenas letras, números, hífens e underscores"
fi

log "Criando totem com UIN: $UIN"

# Carregar variáveis de ambiente do .env se existir
ENV_FILE=""
if [[ -f ".env" ]]; then
    ENV_FILE=".env"
elif [[ -f "/opt/smart-signage/.env" ]]; then
    ENV_FILE="/opt/smart-signage/.env"
elif [[ -f "$HOME/smartsignage-pro-main/.env" ]]; then
    ENV_FILE="$HOME/smartsignage-pro-main/.env"
fi

if [[ -n "$ENV_FILE" ]]; then
    log "Carregando variáveis de ambiente de: $ENV_FILE"
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Usar DATABASE_URL se disponível, senão construir
if [[ -z "$DATABASE_URL" ]]; then
    DB_USER="${DB_USER:-smartsignage}"
    DB_PASS="${DB_PASS:-smartsignage123}"
    DB_NAME="${DB_NAME:-smartsignage}"
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5432}"
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

log "Conectando ao banco de dados..."

# Verificar se UIN já existe
EXISTING_UIN=$(psql "$DATABASE_URL" -tAc "SELECT uin FROM totems WHERE uin = '$UIN' LIMIT 1;" 2>/dev/null | tr -d ' ' || echo "")

if [[ -n "$EXISTING_UIN" ]]; then
    error "UIN '$UIN' já existe no banco de dados!"
    echo "Use outro UIN ou atualize o totem existente."
    exit 1
fi

# Verificar se cliente existe
CLIENT_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM clients WHERE client_id = $CLIENT_ID;" 2>/dev/null | tr -d ' ' || echo "0")

if [[ "$CLIENT_EXISTS" -eq "0" ]]; then
    warn "Cliente com ID $CLIENT_ID não existe. Criando cliente padrão..."
    psql "$DATABASE_URL" -c "INSERT INTO clients (client_id, name) VALUES ($CLIENT_ID, 'Cliente Padrão') ON CONFLICT DO NOTHING;" 2>/dev/null || true
fi

# Gerar próximo totem_id disponível
NEXT_TOTEM_ID=$(psql "$DATABASE_URL" -tAc "SELECT COALESCE(MAX(totem_id), 0) + 1 FROM totems;" 2>/dev/null | tr -d ' ' || echo "1")

log "Criando totem no banco de dados..."
log "  Totem ID: $NEXT_TOTEM_ID"
log "  UIN: $UIN"
log "  Nome: $TOTEM_NAME"
log "  Cliente ID: $CLIENT_ID"
log "  Descrição: $DESCRIPTION"

# Criar totem no banco de dados
psql "$DATABASE_URL" <<SQL
INSERT INTO totems (
    totem_id,
    identifier,
    uin,
    device_id,
    local_id,
    description,
    config,
    status,
    version,
    firmware_version,
    ip_address,
    last_seen,
    last_heartbeat,
    active,
    blocked,
    created_at,
    updated_at
) VALUES (
    $NEXT_TOTEM_ID,
    '$TOTEM_NAME',
    '$UIN',
    'DEVICE-$(printf "%03d" $NEXT_TOTEM_ID)',
    NULL,
    '$DESCRIPTION',
    '{"resolution": "1920x1080", "orientation": "portrait", "brightness": 80}',
    'online',
    '2.1.0',
    '1.0.0',
    '127.0.0.1',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    true,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
SQL

if [[ $? -eq 0 ]]; then
    log "✅ Totem criado com sucesso no banco de dados!"
else
    error "❌ Falha ao criar totem no banco de dados"
fi

# Verificar se o script de geração de configuração existe
GENERATE_CONFIG_SCRIPT=""
if [[ -f "scripts/generate-player-config.sh" ]]; then
    GENERATE_CONFIG_SCRIPT="scripts/generate-player-config.sh"
elif [[ -f "/opt/smart-signage/scripts/generate-player-config.sh" ]]; then
    GENERATE_CONFIG_SCRIPT="/opt/smart-signage/scripts/generate-player-config.sh"
elif [[ -f "$HOME/smartsignage-pro-main/scripts/generate-player-config.sh" ]]; then
    GENERATE_CONFIG_SCRIPT="$HOME/smartsignage-pro-main/scripts/generate-player-config.sh"
fi

# Gerar arquivo de configuração encriptado do player
if [[ -n "$GENERATE_CONFIG_SCRIPT" ]]; then
    PLAYER_DIR=""
    if [[ -d "/opt/smart-signage/player" ]]; then
        PLAYER_DIR="/opt/smart-signage/player"
    elif [[ -d "$HOME/smartsignage-pro-main/player" ]]; then
        PLAYER_DIR="$HOME/smartsignage-pro-main/player"
    fi
    
    if [[ -n "$PLAYER_DIR" ]]; then
        log "Gerando arquivo de configuração encriptado do player..."
        SECRET_KEY="${TOTEM_SECRET_KEY:-smart-signage-totem-secret-key-2025-change-in-production}"
        
        if bash "$GENERATE_CONFIG_SCRIPT" "$UIN" "$PLAYER_DIR" "$SECRET_KEY" 2>/dev/null; then
            log "✅ Arquivo de configuração encriptado gerado com sucesso!"
        else
            warn "⚠️ Não foi possível gerar arquivo de configuração encriptado automaticamente"
            warn "   Você pode gerar manualmente usando:"
            warn "   sudo $GENERATE_CONFIG_SCRIPT $UIN $PLAYER_DIR"
        fi
    else
        warn "⚠️ Diretório do player não encontrado. Pule esta etapa se não estiver em modo kiosk."
    fi
else
    warn "⚠️ Script de geração de configuração não encontrado."
    warn "   O totem foi criado no banco, mas o arquivo de configuração não foi gerado."
fi

log ""
log "✅ Totem criado com sucesso!"
log ""
log "Resumo:"
log "  🆔 Totem ID: $NEXT_TOTEM_ID"
log "  🔑 UIN: $UIN"
log "  📝 Nome: $TOTEM_NAME"
log "  👤 Cliente ID: $CLIENT_ID"
log ""
log "Para usar este totem no player:"
log "  1. Acesse: http://SEU-IP/player?uin=$UIN"
log "  2. Ou use o arquivo de configuração encriptado (se gerado)"
log ""

