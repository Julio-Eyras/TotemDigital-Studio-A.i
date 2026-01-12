#!/bin/bash

# Smart Signage Pro - Script para Limpar Cache (Backend + Frontend) - Ubuntu/Linux
# Limpa todos os caches sem recompilar

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

warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🧹 LIMPEZA DE CACHE${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verificar se estamos no diretório correto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

cleaned=false

# Backend
echo -e "${YELLOW}📦 Backend:${NC}"

if [[ -d "backend/node_modules/.cache" ]]; then
    rm -rf backend/node_modules/.cache
    log "   ✅ Cache do node_modules removido"
    cleaned=true
fi

if ls backend/*.tsbuildinfo 2>/dev/null | grep -q .; then
    rm -f backend/*.tsbuildinfo
    log "   ✅ Cache TypeScript removido"
    cleaned=true
fi

# Frontend
echo ""
echo -e "${YELLOW}📦 Frontend:${NC}"

if [[ -d "frontend/node_modules/.cache" ]]; then
    rm -rf frontend/node_modules/.cache
    log "   ✅ Cache do webpack/react removido"
    cleaned=true
fi

if [[ -d "frontend/.cache" ]]; then
    rm -rf frontend/.cache
    log "   ✅ Cache do React removido"
    cleaned=true
fi

if [[ -f "frontend/.eslintcache" ]]; then
    rm -f frontend/.eslintcache
    log "   ✅ Cache do ESLint removido"
    cleaned=true
fi

# Cache do webpack em node_modules (múltiplos locais)
if [[ -d "frontend/node_modules" ]]; then
    find frontend/node_modules -type d -name ".cache" -exec rm -rf {} + 2>/dev/null || true
    if [[ $? -eq 0 ]]; then
        log "   ✅ Cache do webpack em node_modules removido"
        cleaned=true
    fi
fi

# Cache do npm
echo ""
echo -e "${YELLOW}📦 NPM Cache:${NC}"
npm cache clean --force 2>/dev/null || true
log "   ✅ Cache do npm limpo"
cleaned=true

echo ""
if [[ "$cleaned" == "true" ]]; then
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "✅ CACHE LIMPO COM SUCESSO!"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
    info "ℹ️  Nenhum cache encontrado para limpar"
fi
echo ""
