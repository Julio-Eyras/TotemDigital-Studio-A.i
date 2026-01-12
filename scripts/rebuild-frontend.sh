#!/bin/bash

# Smart Signage Pro - Script para Rebuild e Restart do Frontend (Ubuntu/Linux)
# Limpa cache, recompila React e cria build de produção

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🔄 REBUILD E RESTART DO FRONTEND${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verificar se estamos no diretório correto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

if [[ ! -d "frontend" ]]; then
    error "Diretório 'frontend' não encontrado! Execute este script na raiz do projeto."
fi

# 1. Parar processos do frontend
log "1️⃣  Parando processos do frontend..."

# Parar processo do React dev server (porta 3001)
if lsof -ti:3001 > /dev/null 2>&1; then
    PID_PORT=$(lsof -ti:3001)
    info "Parando processo na porta 3001 (PID: $PID_PORT)..."
    kill -9 $PID_PORT 2>/dev/null || true
    sleep 1
    log "✅ Processo na porta 3001 parado"
fi

# Parar processos Node.js relacionados ao frontend
FRONTEND_PIDS=$(pgrep -f "react-scripts\|react-app-rewired" 2>/dev/null || true)
if [[ -n "$FRONTEND_PIDS" ]]; then
    for pid in $FRONTEND_PIDS; do
        info "Parando processo frontend (PID: $pid)..."
        kill -9 $pid 2>/dev/null || true
        log "✅ Processo frontend parado (PID: $pid)"
    done
    sleep 2
else
    info "Nenhum processo frontend encontrado"
fi

# Parar serviços systemd se existirem
if command -v systemctl &> /dev/null; then
    if systemctl is-active --quiet smart-signage-frontend 2>/dev/null; then
        info "Parando serviço systemd: smart-signage-frontend..."
        sudo systemctl stop smart-signage-frontend 2>/dev/null || true
        log "✅ Serviço systemd parado"
    fi
fi

# 2. Limpar cache e build antigo
log ""
log "2️⃣  Limpando cache e builds antigos..."

cd frontend

# Limpar build de produção
if [[ -d "build" ]]; then
    rm -rf build
    log "✅ Pasta frontend/build removida"
fi

# Limpar cache do webpack/react
if [[ -d "node_modules/.cache" ]]; then
    rm -rf node_modules/.cache
    log "✅ Cache do webpack/react removido"
fi

# Limpar cache do React
if [[ -d ".cache" ]]; then
    rm -rf .cache
    log "✅ Cache do React removido"
fi

# Limpar cache do ESLint
if [[ -f ".eslintcache" ]]; then
    rm -f .eslintcache
    log "✅ Cache do ESLint removido"
fi

# Limpar cache do npm
info "Limpando cache do npm..."
npm cache clean --force 2>/dev/null || true

# Limpar cache do webpack em node_modules (múltiplos locais)
if [[ -d "node_modules" ]]; then
    find node_modules -type d -name ".cache" -exec rm -rf {} + 2>/dev/null || true
    log "✅ Cache do webpack em node_modules removido"
fi

log "✅ Cache limpo completamente"

# 3. Recompilar frontend
log ""
log "3️⃣  Recompilando frontend (React)..."

# Verificar dependências
if [[ ! -d "node_modules" ]]; then
    info "Instalando dependências..."
    npm install
else
    info "Dependências do frontend já instaladas"
fi

# Aplicar patches antes de compilar
info "Aplicando patches..."
if [[ -f "node_modules/.bin/patch-package" ]]; then
    npm run postinstall 2>/dev/null || true
fi

# Compilar (build de produção)
info "Executando build..."
if npm run build; then
    log "✅ Frontend recompilado com sucesso!"
else
    error "❌ ERRO ao compilar frontend!"
fi

cd ..

# 4. Verificar se build foi criado
log ""
log "4️⃣  Verificando build..."

if [[ ! -f "frontend/build/index.html" ]]; then
    error "❌ Arquivo frontend/build/index.html não encontrado!"
fi

log "✅ Build criado com sucesso!"
info "📁 Localização: frontend/build/"

log ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log "✅ REBUILD DO FRONTEND CONCLUÍDO!"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log ""

echo -e "${BLUE}📊 STATUS:${NC}"
echo -e "   • Frontend compilado: frontend/build/"
echo ""

echo -e "${BLUE}💡 PRÓXIMOS PASSOS:${NC}"
if command -v systemctl &> /dev/null && systemctl list-unit-files | grep -q nginx; then
    echo -e "   • Reinicie o Nginx: ${YELLOW}sudo systemctl reload nginx${NC}"
fi
echo -e "   • Para dev server: ${YELLOW}cd frontend && npm start${NC}"
echo ""
