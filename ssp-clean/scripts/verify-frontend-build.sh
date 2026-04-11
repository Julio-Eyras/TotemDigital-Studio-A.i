#!/bin/bash

# Script para verificar se o build do frontend está atualizado
# Verifica se os arquivos modificados estão no build

set -e

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 VERIFICAÇÃO DO BUILD DO FRONTEND${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verificar se build existe
if [[ ! -d "frontend/build" ]]; then
    error "❌ Diretório frontend/build/ não existe!"
    warning "Execute: ./scripts/rebuild-frontend.sh"
    exit 1
fi

log "✅ Diretório frontend/build/ existe"

# Verificar arquivos específicos da implementação TotemPlayList
echo ""
log "Verificando arquivos da implementação TotemPlayList..."

# 1. Verificar se TotemPlayList.tsx existe no build
if grep -r "TotemPlayList\|totem-playlists" frontend/build/static/js/*.js 2>/dev/null | grep -q .; then
    log "✅ TotemPlayList encontrado no build"
else
    warning "⚠️  TotemPlayList NÃO encontrado no build"
    warning "O build pode estar desatualizado"
fi

# 2. Verificar se a rota está no App.js do build
if grep -r "/totem-playlists\|TotemPlayList" frontend/build/static/js/*.js 2>/dev/null | grep -q .; then
    log "✅ Rota /totem-playlists encontrada no build"
else
    warning "⚠️  Rota /totem-playlists NÃO encontrada no build"
fi

# 3. Verificar data de modificação do build
BUILD_DATE=$(stat -c %y frontend/build/index.html 2>/dev/null || stat -f "%Sm" frontend/build/index.html 2>/dev/null || echo "desconhecida")
log "📅 Data do build: $BUILD_DATE"

# 4. Verificar data de modificação dos arquivos fonte
SOURCE_FILES=(
    "frontend/src/pages/TotemPlayList/TotemPlayList.tsx"
    "frontend/src/App.tsx"
    "frontend/src/utils/menuHierarchy.tsx"
    "frontend/src/services/api/index.ts"
)

echo ""
log "Verificando datas dos arquivos fonte..."

for file in "${SOURCE_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        SOURCE_DATE=$(stat -c %y "$file" 2>/dev/null || stat -f "%Sm" "$file" 2>/dev/null || echo "desconhecida")
        log "   📄 $file: $SOURCE_DATE"
        
        # Comparar datas (simplificado)
        if [[ "$SOURCE_DATE" > "$BUILD_DATE" ]]; then
            warning "   ⚠️  Arquivo fonte mais recente que o build!"
        fi
    else
        warning "   ⚠️  Arquivo não encontrado: $file"
    fi
done

# 5. Verificar se os arquivos existem no código fonte
echo ""
log "Verificando existência dos arquivos no código fonte..."

if [[ -f "frontend/src/pages/TotemPlayList/TotemPlayList.tsx" ]]; then
    log "✅ frontend/src/pages/TotemPlayList/TotemPlayList.tsx existe"
else
    error "❌ frontend/src/pages/TotemPlayList/TotemPlayList.tsx NÃO existe!"
fi

if grep -q "TotemPlayList\|totem-playlists" frontend/src/App.tsx 2>/dev/null; then
    log "✅ Rota TotemPlayList encontrada em App.tsx"
else
    error "❌ Rota TotemPlayList NÃO encontrada em App.tsx!"
fi

if grep -q "Playlists de Totens\|totem-playlists" frontend/src/utils/menuHierarchy.tsx 2>/dev/null; then
    log "✅ Menu 'Playlists de Totens' encontrado em menuHierarchy.tsx"
else
    error "❌ Menu 'Playlists de Totens' NÃO encontrado em menuHierarchy.tsx!"
fi

# 6. Verificar se Nginx está servindo o build correto
echo ""
log "Verificando Nginx..."

if command -v systemctl &> /dev/null && systemctl is-active --quiet nginx 2>/dev/null; then
    NGINX_ROOT=$(grep -r "root.*frontend/build" /etc/nginx/sites-enabled/* 2>/dev/null | head -1 | awk '{print $2}' | tr -d ';' || echo "")
    
    if [[ -n "$NGINX_ROOT" ]]; then
        log "✅ Nginx configurado para servir: $NGINX_ROOT"
        
        if [[ "$NGINX_ROOT" == "$PROJECT_ROOT/frontend/build" ]] || [[ "$NGINX_ROOT" == "$(realpath $PROJECT_ROOT/frontend/build)" ]]; then
            log "✅ Nginx está servindo o build correto"
        else
            warning "⚠️  Nginx pode estar servindo um build diferente"
            warning "   Configurado: $NGINX_ROOT"
            warning "   Esperado: $PROJECT_ROOT/frontend/build"
        fi
    else
        warning "⚠️  Não foi possível determinar a configuração do Nginx"
    fi
else
    warning "⚠️  Nginx não está rodando ou não está instalado"
fi

# 7. Recomendações
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}💡 RECOMENDAÇÕES:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "1. Limpar cache e recompilar frontend:"
echo -e "   ${YELLOW}./scripts/rebuild-frontend.sh${NC}"
echo ""

echo "2. Limpar cache do navegador:"
echo -e "   ${YELLOW}Ctrl+Shift+R (Chrome/Firefox) ou Ctrl+F5${NC}"
echo ""

if command -v systemctl &> /dev/null && systemctl is-active --quiet nginx 2>/dev/null; then
    echo "3. Reiniciar Nginx:"
    echo -e "   ${YELLOW}sudo systemctl reload nginx${NC}"
    echo ""
fi

echo "4. Verificar se os arquivos estão no servidor:"
echo -e "   ${YELLOW}ls -la frontend/src/pages/TotemPlayList/${NC}"
echo ""

echo ""
