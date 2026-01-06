#!/bin/bash
# =============================================================================
# Script de Verificação de Status do Frontend
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

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log "🔍 Verificando Status do Frontend Smart Signage Pro"
echo ""

# 1. Verificar se build existe
log "1. Verificando build do frontend..."
BUILD_DIRS=(
    "/opt/smart-signage/frontend/build"
    "$HOME/SmartSignage-Pro-install/frontend/build"
    "$(pwd)/frontend/build"
)

BUILD_FOUND=false
for BUILD_DIR in "${BUILD_DIRS[@]}"; do
    if [[ -d "$BUILD_DIR" ]] && [[ -f "$BUILD_DIR/index.html" ]]; then
        log "✅ Build encontrado em: $BUILD_DIR"
        BUILD_FOUND=true
        ACTUAL_BUILD_DIR="$BUILD_DIR"
        break
    fi
done

if [[ "$BUILD_FOUND" == false ]]; then
    error "❌ Build do frontend não encontrado!"
    info "   Execute: cd frontend && npm install && npm run build"
else
    # Verificar tamanho do build
    BUILD_SIZE=$(du -sh "$ACTUAL_BUILD_DIR" 2>/dev/null | cut -f1 || echo "N/A")
    log "   Tamanho do build: $BUILD_SIZE"
    
    # Verificar arquivos importantes
    if [[ -f "$ACTUAL_BUILD_DIR/index.html" ]]; then
        log "   ✅ index.html existe"
    else
        error "   ❌ index.html não encontrado"
    fi
    
    if [[ -d "$ACTUAL_BUILD_DIR/static" ]]; then
        STATIC_COUNT=$(find "$ACTUAL_BUILD_DIR/static" -type f 2>/dev/null | wc -l)
        log "   ✅ static/ existe ($STATIC_COUNT arquivos)"
    else
        warn "   ⚠️  static/ não encontrado"
    fi
fi
echo ""

# 2. Verificar Nginx
log "2. Verificando Nginx..."
if systemctl is-active --quiet nginx 2>/dev/null; then
    log "✅ Nginx está rodando"
    
    # Verificar porta 80
    PORT_80=$(sudo netstat -tlnp 2>/dev/null | grep :80 || sudo ss -tlnp 2>/dev/null | grep :80 || echo "")
    if [[ -n "$PORT_80" ]]; then
        log "✅ Porta 80 está em uso"
    else
        warn "⚠️  Porta 80 não está em uso"
    fi
    
    # Verificar configuração
    if sudo nginx -t 2>/dev/null; then
        log "✅ Configuração do Nginx está válida"
    else
        error "❌ Configuração do Nginx tem erros"
        info "   Execute: sudo nginx -t"
    fi
else
    error "❌ Nginx não está rodando"
    info "   Execute: sudo systemctl start nginx"
fi
echo ""

# 3. Verificar configuração do Nginx
log "3. Verificando configuração do Nginx..."
NGINX_CONFIGS=(
    "/etc/nginx/sites-available/smartsignage"
    "/etc/nginx/sites-enabled/smartsignage"
    "/etc/nginx/nginx.conf"
)

NGINX_CONFIG_FOUND=false
for CONFIG in "${NGINX_CONFIGS[@]}"; do
    if [[ -f "$CONFIG" ]]; then
        log "✅ Configuração encontrada: $CONFIG"
        NGINX_CONFIG_FOUND=true
        
        # Verificar se root aponta para build
        if grep -q "root.*frontend.*build" "$CONFIG" 2>/dev/null; then
            ROOT_DIR=$(grep "root" "$CONFIG" | head -1 | sed 's/.*root[[:space:]]*\([^;]*\);.*/\1/' | xargs)
            log "   Root configurado: $ROOT_DIR"
            
            if [[ -d "$ROOT_DIR" ]] && [[ -f "$ROOT_DIR/index.html" ]]; then
                log "   ✅ Diretório root existe e tem index.html"
            else
                error "   ❌ Diretório root não existe ou não tem index.html"
            fi
        else
            warn "   ⚠️  Não encontrou configuração 'root' para frontend"
        fi
        
        # Verificar try_files (necessário para SPA)
        if grep -q "try_files.*index.html" "$CONFIG" 2>/dev/null; then
            log "   ✅ try_files configurado (SPA suportado)"
        else
            warn "   ⚠️  try_files não configurado (SPA pode não funcionar)"
        fi
        
        break
    fi
done

if [[ "$NGINX_CONFIG_FOUND" == false ]]; then
    warn "⚠️  Configuração do Nginx não encontrada"
fi
echo ""

# 4. Testar conexão local
log "4. Testando conexão local (localhost)..."
if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null || echo "000")
    
    if [[ "$HTTP_CODE" == "200" ]]; then
        log "✅ Frontend responde localmente (HTTP 200)"
        
        # Verificar se retorna HTML
        CONTENT_TYPE=$(curl -s -I http://localhost/ 2>/dev/null | grep -i "content-type" || echo "")
        if echo "$CONTENT_TYPE" | grep -qi "text/html"; then
            log "   ✅ Retorna HTML"
        else
            warn "   ⚠️  Não retorna HTML: $CONTENT_TYPE"
        fi
    elif [[ "$HTTP_CODE" == "000" ]]; then
        error "❌ Não consegue conectar (Nginx pode não estar rodando)"
    else
        warn "⚠️  Retornou HTTP $HTTP_CODE"
    fi
else
    warn "⚠️  curl não está instalado"
fi
echo ""

# 5. Verificar processos Node.js (dev server)
log "5. Verificando servidor de desenvolvimento..."
NODE_DEV=$(ps aux | grep -E "node.*3001|react-scripts|npm.*start" | grep -v grep || echo "")
if [[ -n "$NODE_DEV" ]]; then
    log "✅ Servidor de desenvolvimento pode estar rodando:"
    echo "$NODE_DEV" | head -2 | sed 's/^/   /'
    info "   Frontend dev server: http://192.168.1.110:3001"
else
    log "ℹ️  Servidor de desenvolvimento não está rodando (normal em produção)"
fi
echo ""

# Resumo
log "📊 Resumo:"
echo ""

PROBLEMS=0

if [[ "$BUILD_FOUND" == false ]]; then
    error "❌ Frontend não foi compilado"
    PROBLEMS=$((PROBLEMS + 1))
fi

if ! systemctl is-active --quiet nginx 2>/dev/null; then
    error "❌ Nginx não está rodando"
    PROBLEMS=$((PROBLEMS + 1))
fi

if [[ $PROBLEMS -eq 0 ]]; then
    log "✅ Frontend está configurado corretamente!"
    echo ""
    info "🌐 URLs para acessar:"
    echo "   Login Principal:    http://192.168.1.110/login"
    echo "   Login Subscriber:    http://192.168.1.110/subscriber-login"
    echo "   Dashboard:          http://192.168.1.110/dashboard"
    echo ""
    if [[ -n "$NODE_DEV" ]]; then
        info "   Dev Server:         http://192.168.1.110:3001"
    fi
else
    error "❌ $PROBLEMS problema(s) encontrado(s)"
    echo ""
    info "📝 Próximos passos:"
    if [[ "$BUILD_FOUND" == false ]]; then
        echo "   1. Compilar frontend: cd frontend && npm install && npm run build"
    fi
    if ! systemctl is-active --quiet nginx 2>/dev/null; then
        echo "   2. Iniciar Nginx: sudo systemctl start nginx"
    fi
fi

echo ""
