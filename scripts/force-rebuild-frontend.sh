#!/bin/bash

# Script para FORÇAR rebuild completo do frontend
# Resolve problemas quando mudanças não aparecem após rebuild

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🔨 FORÇAR REBUILD COMPLETO DO FRONTEND${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 1. Verificar se arquivos existem no código fonte
log "1️⃣  Verificando arquivos no código fonte..."

MISSING_FILES=0

if [[ ! -f "frontend/src/pages/TotemPlayList/TotemPlayList.tsx" ]]; then
    error "❌ frontend/src/pages/TotemPlayList/TotemPlayList.tsx NÃO existe!"
    MISSING_FILES=$((MISSING_FILES + 1))
else
    log "✅ TotemPlayList.tsx existe"
fi

if ! grep -q "TotemPlayList\|totem-playlists" frontend/src/App.tsx 2>/dev/null; then
    error "❌ Rota TotemPlayList NÃO encontrada em App.tsx!"
    MISSING_FILES=$((MISSING_FILES + 1))
else
    log "✅ Rota TotemPlayList encontrada em App.tsx"
fi

if ! grep -q "Playlists de Totens\|totem-playlists" frontend/src/utils/menuHierarchy.tsx 2>/dev/null; then
    error "❌ Menu 'Playlists de Totens' NÃO encontrado em menuHierarchy.tsx!"
    MISSING_FILES=$((MISSING_FILES + 1))
else
    log "✅ Menu 'Playlists de Totens' encontrado em menuHierarchy.tsx"
fi

if [[ $MISSING_FILES -gt 0 ]]; then
    error "❌ Alguns arquivos estão faltando! Verifique o código fonte."
fi

# 2. Parar TODOS os processos relacionados
log ""
log "2️⃣  Parando TODOS os processos relacionados..."

# Parar processos Node
pkill -f "node.*react-scripts" 2>/dev/null || true
pkill -f "node.*react-app-rewired" 2>/dev/null || true
pkill -f "node.*webpack" 2>/dev/null || true

# Parar processos na porta 3001
if lsof -ti:3001 > /dev/null 2>&1; then
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    log "✅ Processos na porta 3001 parados"
fi

sleep 2

# 3. LIMPEZA AGRESSIVA DE CACHE
log ""
log "3️⃣  Limpeza AGRESSIVA de cache..."

cd frontend

# Remover build antigo
if [[ -d "build" ]]; then
    rm -rf build
    log "✅ Build antigo removido"
fi

# Limpar TODOS os caches possíveis
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .cache 2>/dev/null || true
rm -f .eslintcache 2>/dev/null || true
rm -rf .parcel-cache 2>/dev/null || true

# Limpar cache do webpack em TODOS os lugares
find node_modules -type d -name ".cache" -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "*.cache" -delete 2>/dev/null || true

# Limpar cache do npm
npm cache clean --force 2>/dev/null || true

# Limpar arquivos temporários do TypeScript
find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

log "✅ Cache completamente limpo"

# 4. Reinstalar dependências (opcional, mas garante que está tudo certo)
log ""
log "4️⃣  Verificando dependências..."

if [[ ! -d "node_modules" ]] || [[ "$1" == "--reinstall" ]]; then
    warning "Reinstalando dependências (isso pode demorar)..."
    rm -rf node_modules package-lock.json 2>/dev/null || true
    npm install
    log "✅ Dependências reinstaladas"
else
    log "✅ Dependências já instaladas (use --reinstall para forçar reinstalação)"
fi

# 5. Aplicar patches
log ""
log "5️⃣  Aplicando patches..."

if [[ -f "node_modules/.bin/patch-package" ]]; then
    npm run postinstall 2>/dev/null || true
    log "✅ Patches aplicados"
fi

# 6. REBUILD FORÇADO
log ""
log "6️⃣  Executando build FORÇADO..."

# Limpar variáveis de ambiente que podem causar cache
unset NODE_ENV
export NODE_ENV=production
export GENERATE_SOURCEMAP=false
export INLINE_RUNTIME_CHUNK=false

# Build com flags que forçam recompilação
npm run build

if [[ $? -ne 0 ]]; then
    error "❌ ERRO ao compilar frontend!"
fi

cd ..

# 7. Verificar se build foi criado corretamente
log ""
log "7️⃣  Verificando build criado..."

if [[ ! -f "frontend/build/index.html" ]]; then
    error "❌ Build não foi criado corretamente!"
fi

# Verificar se TotemPlayList está no build
if grep -r "TotemPlayList\|totem-playlists" frontend/build/static/js/*.js 2>/dev/null | grep -q .; then
    log "✅ TotemPlayList encontrado no build!"
else
    warning "⚠️  TotemPlayList NÃO encontrado no build JavaScript"
    warning "Isso pode ser normal se estiver em um chunk separado"
fi

# Verificar se a rota está no build
if grep -r "/totem-playlists" frontend/build/static/js/*.js 2>/dev/null | grep -q .; then
    log "✅ Rota /totem-playlists encontrada no build!"
else
    warning "⚠️  Rota /totem-playlists NÃO encontrada no build"
fi

BUILD_SIZE=$(du -sh frontend/build 2>/dev/null | cut -f1)
log "📦 Tamanho do build: $BUILD_SIZE"

# 8. Reiniciar Nginx
log ""
log "8️⃣  Reiniciando Nginx..."

if command -v systemctl &> /dev/null && systemctl is-active --quiet nginx 2>/dev/null; then
    sudo systemctl reload nginx || sudo systemctl restart nginx
    log "✅ Nginx reiniciado"
else
    warning "⚠️  Nginx não está rodando (opcional)"
fi

# 9. Instruções finais
log ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log "✅ REBUILD FORÇADO CONCLUÍDO!"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log ""

echo -e "${BLUE}📋 PRÓXIMOS PASSOS:${NC}"
echo ""
echo "1. Limpar cache do NAVEGADOR:"
echo -e "   ${YELLOW}Chrome/Edge: Ctrl+Shift+Delete → Limpar cache${NC}"
echo -e "   ${YELLOW}Firefox: Ctrl+Shift+Delete → Limpar cache${NC}"
echo -e "   ${YELLOW}Ou use: Ctrl+Shift+R (hard refresh)${NC}"
echo ""
echo "2. Verificar se o menu aparece:"
echo -e "   ${YELLOW}Login como admin e verifique o menu '📢 Publicador'${NC}"
echo -e "   ${YELLOW}Deve aparecer 'Playlists de Totens'${NC}"
echo ""
echo "3. Acessar diretamente:"
echo -e "   ${YELLOW}http://seu-servidor/totem-playlists${NC}"
echo ""
echo "4. Se ainda não aparecer, verificar logs do navegador:"
echo -e "   ${YELLOW}F12 → Console → Verificar erros${NC}"
echo ""
