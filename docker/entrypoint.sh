#!/bin/bash

# Smart Signage Pro v2.0 - Script de Inicialização Docker
# Executa instalação automática para modelo servidor único

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Banner
echo -e "${BLUE}"
echo "=============================================="
echo "    Smart Signage Pro v2.0 - Docker Container"
echo "    Instalação Automática - Servidor Único"
echo "=============================================="
echo -e "${NC}"

# =============================================
# CONFIGURAÇÃO INICIAL
# =============================================

log "Iniciando configuração do Smart Signage Pro v2.0..."

# Definir variáveis de ambiente padrão
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}
export HOST=${HOST:-0.0.0.0}
export DATABASE_TYPE=${DATABASE_TYPE:-sqlite}
export DATABASE_URL=${DATABASE_URL:-file:./data/smartsignage.db}
export JWT_SECRET=${JWT_SECRET:-smartsignage-docker-secret-key-2025}
export UPLOAD_PATH=${UPLOAD_PATH:-./uploads}

# =============================================
# VERIFICAÇÕES INICIAIS
# =============================================

log "Verificando dependências do sistema..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
    error "Node.js não encontrado"
fi

# Verificar npm
if ! command -v npm &> /dev/null; then
    error "npm não encontrado"
fi

# Verificar SQLite
if ! command -v sqlite3 &> /dev/null; then
    warning "SQLite3 não encontrado, usando implementação Node.js"
fi

log "✅ Dependências verificadas"

# =============================================
# CONFIGURAÇÃO DO BANCO DE DADOS
# =============================================

log "Configurando banco de dados..."

# Criar diretório de dados se não existir
mkdir -p /app/data /app/uploads /app/logs /app/backups

# Verificar se o banco existe
if [ ! -f "/app/data/smartsignage.db" ]; then
    log "Criando banco de dados SQLite..."
    touch /app/data/smartsignage.db
    log "✅ Banco de dados criado"
else
    log "✅ Banco de dados encontrado"
fi

# =============================================
# CONFIGURAÇÃO DO FRONTEND
# =============================================

log "Configurando frontend..."

if [ -d "/app/frontend/build" ]; then
    log "✅ Frontend build encontrado"
else
    warning "Frontend build não encontrado"
fi

# =============================================
# CONFIGURAÇÃO DO BACKEND
# =============================================

log "Configurando backend..."

cd /app/backend

# Verificar se dist existe
if [ ! -d "dist" ]; then
    log "Compilando TypeScript..."
    npm run build
fi

log "✅ Backend configurado"

# =============================================
# CONFIGURAÇÃO DO PLAYER
# =============================================

log "Configurando player HTML5 (com cache completo)..."

if [ -f "/app/player-web/index.html" ]; then
    log "✅ Player HTML5 encontrado (versão com cache completo)"
else
    warning "Player HTML5 não encontrado"
fi

# =============================================
# CONFIGURAÇÃO DE PERMISSÕES
# =============================================

log "Configurando permissões..."

# Ajustar permissões dos diretórios
chmod -R 755 /app/data /app/uploads /app/logs /app/backups
chmod +x /app/scripts/*.sh 2>/dev/null || true

log "✅ Permissões configuradas"

# =============================================
# TESTE DE CONECTIVIDADE
# =============================================

log "Testando conectividade..."

# Testar se a porta está disponível
if lsof -Pi :${PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
    warning "Porta ${PORT} já está em uso"
else
    log "✅ Porta ${PORT} disponível"
fi

# =============================================
# INICIALIZAÇÃO DOS SERVIÇOS
# =============================================

log "Inicializando serviços..."

# Executar script de primeira inicialização se existir
if [ -f "/app/scripts/first-boot.sh" ]; then
    log "Executando script de primeira inicialização..."
    bash /app/scripts/first-boot.sh
fi

# =============================================
# RESUMO DA CONFIGURAÇÃO
# =============================================

log "🎉 Configuração concluída com sucesso!"
log ""
log "📊 RESUMO DA CONFIGURAÇÃO:"
log "✅ Node.js: $(node --version)"
log "✅ npm: $(npm --version)"
log "✅ Banco de dados: ${DATABASE_TYPE}"
log "✅ Porta: ${PORT}"
log "✅ Ambiente: ${NODE_ENV}"
log "✅ Diretório de dados: /app/data"
log "✅ Diretório de uploads: /app/uploads"
log ""
log "🚀 Iniciando Smart Signage Pro v2.0..."

# =============================================
# EXECUÇÃO DO COMANDO PRINCIPAL
# =============================================

cd /app

# Executar o comando passado como argumento
exec "$@"
