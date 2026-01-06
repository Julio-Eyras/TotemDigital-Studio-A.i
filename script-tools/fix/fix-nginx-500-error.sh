#!/bin/bash
# =============================================================================
# Script para Corrigir Erro 500 do Nginx
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

log "🔧 Corrigindo Erro 500 do Nginx"
echo ""

# 1. Verificar logs de erro
log "1. Verificando logs de erro do Nginx..."
if [[ -f /var/log/nginx/error.log ]]; then
    LATEST_ERROR=$(sudo tail -5 /var/log/nginx/error.log 2>/dev/null | grep -i "error\|failed\|denied" || echo "")
    if [[ -n "$LATEST_ERROR" ]]; then
        warn "⚠️  Últimos erros encontrados:"
        echo "$LATEST_ERROR" | sed 's/^/   /'
    else
        log "ℹ️  Nenhum erro recente nos logs"
    fi
    info "   Log completo: sudo tail -30 /var/log/nginx/error.log"
else
    warn "⚠️  Arquivo de log não encontrado"
fi
echo ""

# 2. Encontrar build do frontend
log "2. Procurando build do frontend..."
BUILD_DIRS=(
    "/opt/smart-signage/frontend/build"
    "$HOME/SmartSignage-Pro-install/frontend/build"
    "$(pwd)/frontend/build"
    "/home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend/build"
)

BUILD_FOUND=false
for BUILD_DIR in "${BUILD_DIRS[@]}"; do
    if [[ -f "$BUILD_DIR/index.html" ]]; then
        log "✅ Build encontrado em: $BUILD_DIR"
        BUILD_FOUND=true
        ACTUAL_BUILD_DIR="$BUILD_DIR"
        break
    fi
done

if [[ "$BUILD_FOUND" == false ]]; then
    error "❌ Build do frontend não encontrado!"
    info "   Execute: cd frontend && npm install && npm run build"
    echo ""
    read -p "Deseja compilar o frontend agora? (s/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        # Tentar encontrar diretório do frontend
        FRONTEND_DIRS=(
            "$(pwd)/frontend"
            "$HOME/SmartSignage-Pro-install/frontend"
            "/home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend"
        )
        
        for FRONTEND_DIR in "${FRONTEND_DIRS[@]}"; do
            if [[ -f "$FRONTEND_DIR/package.json" ]]; then
                log "   Compilando frontend em: $FRONTEND_DIR"
                cd "$FRONTEND_DIR"
                npm install
                npm run build
                ACTUAL_BUILD_DIR="$FRONTEND_DIR/build"
                BUILD_FOUND=true
                break
            fi
        done
        
        if [[ "$BUILD_FOUND" == false ]]; then
            error "❌ Não foi possível encontrar diretório do frontend"
            exit 1
        fi
    else
        exit 1
    fi
fi
echo ""

# 3. Verificar permissões
log "3. Verificando permissões..."
if [[ -n "$ACTUAL_BUILD_DIR" ]]; then
    PERMISSIONS=$(stat -c "%U:%G %a" "$ACTUAL_BUILD_DIR" 2>/dev/null || echo "")
    if [[ -n "$PERMISSIONS" ]]; then
        log "   Permissões atuais: $PERMISSIONS"
        
        # Verificar se www-data pode ler
        if sudo -u www-data test -r "$ACTUAL_BUILD_DIR/index.html" 2>/dev/null; then
            log "   ✅ www-data pode ler os arquivos"
        else
            warn "   ⚠️  www-data não pode ler os arquivos, corrigindo..."
            sudo chown -R www-data:www-data "$ACTUAL_BUILD_DIR"
            sudo chmod -R 755 "$ACTUAL_BUILD_DIR"
            log "   ✅ Permissões corrigidas"
        fi
    fi
fi
echo ""

# 4. Verificar configuração do Nginx
log "4. Verificando configuração do Nginx..."
NGINX_CONFIG="/etc/nginx/sites-available/smartsignage"

if [[ -f "$NGINX_CONFIG" ]]; then
    # Verificar qual diretório está configurado
    CONFIGURED_ROOT=$(sudo grep "root" "$NGINX_CONFIG" | head -1 | sed 's/.*root[[:space:]]*\([^;]*\);.*/\1/' | xargs || echo "")
    
    if [[ -n "$CONFIGURED_ROOT" ]]; then
        log "   Diretório configurado no Nginx: $CONFIGURED_ROOT"
        
        # Verificar se diretório configurado existe
        if [[ -f "$CONFIGURED_ROOT/index.html" ]]; then
            log "   ✅ Diretório configurado existe e tem index.html"
        else
            warn "   ⚠️  Diretório configurado não existe ou não tem index.html"
            
            # Perguntar se deseja atualizar
            if [[ -n "$ACTUAL_BUILD_DIR" ]]; then
                echo ""
                read -p "Deseja atualizar configuração do Nginx para: $ACTUAL_BUILD_DIR? (s/n) " -n 1 -r
                echo ""
                if [[ $REPLY =~ ^[Ss]$ ]]; then
                    # Fazer backup
                    sudo cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
                    
                    # Atualizar root no arquivo de configuração
                    sudo sed -i "s|root[[:space:]]*[^;]*;|root $ACTUAL_BUILD_DIR;|g" "$NGINX_CONFIG"
                    
                    log "   ✅ Configuração atualizada"
                    
                    # Testar configuração
                    if sudo nginx -t 2>/dev/null; then
                        log "   ✅ Configuração do Nginx está válida"
                    else
                        error "   ❌ Erro na configuração do Nginx"
                        warn "   Restaurando backup..."
                        sudo cp "${NGINX_CONFIG}.backup."* "$NGINX_CONFIG" 2>/dev/null || true
                        exit 1
                    fi
                fi
            fi
        fi
    else
        warn "   ⚠️  Não foi possível encontrar configuração 'root'"
    fi
else
    error "❌ Arquivo de configuração do Nginx não encontrado: $NGINX_CONFIG"
fi
echo ""

# 5. Recarregar Nginx
log "5. Recarregando Nginx..."
if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx
    log "✅ Nginx recarregado"
else
    error "❌ Erro na configuração do Nginx, não foi possível recarregar"
    info "   Execute: sudo nginx -t"
    exit 1
fi
echo ""

# 6. Testar conexão
log "6. Testando conexão..."
sleep 2

if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/login 2>/dev/null || echo "000")
    
    if [[ "$HTTP_CODE" == "200" ]]; then
        log "✅ Frontend está respondendo (HTTP 200)"
    elif [[ "$HTTP_CODE" == "404" ]]; then
        warn "⚠️  Retornou 404 (pode ser normal se React Router não estiver configurado)"
    elif [[ "$HTTP_CODE" == "000" ]]; then
        error "❌ Não consegue conectar"
    else
        warn "⚠️  Retornou HTTP $HTTP_CODE"
        info "   Verifique logs: sudo tail -30 /var/log/nginx/error.log"
    fi
else
    warn "⚠️  curl não está instalado"
fi
echo ""

# Resumo
log "📊 Resumo:"
echo ""

if [[ "$BUILD_FOUND" == true ]]; then
    log "✅ Build encontrado: $ACTUAL_BUILD_DIR"
    log "✅ Permissões verificadas"
    log "✅ Nginx recarregado"
    echo ""
    info "🌐 Teste acessando:"
    echo "   http://192.168.1.110/login"
    echo "   http://192.168.1.110/subscriber-login"
    echo ""
    info "📝 Se ainda houver erro 500, verifique logs:"
    echo "   sudo tail -30 /var/log/nginx/error.log"
else
    error "❌ Build do frontend não foi encontrado ou compilado"
    echo ""
    info "📝 Execute manualmente:"
    echo "   cd frontend"
    echo "   npm install"
    echo "   npm run build"
fi

echo ""
