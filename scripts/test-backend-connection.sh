#!/bin/bash
# =============================================================================
# Script de Teste de Conexão com Backend
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

# Obter IP do servidor (ou usar fornecido)
SERVER_IP="${1:-192.168.1.110}"
PORT="${2:-3000}"

log "🧪 Testando Conexão com Backend"
echo ""
info "Servidor: $SERVER_IP"
info "Porta: $PORT"
echo ""

# 1. Testar Health Check
log "1. Testando Health Check..."
HEALTH_URL="http://${SERVER_IP}:${PORT}/health"
if command -v curl &> /dev/null; then
    HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "")
    HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)
    BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)
    
    if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "503" ]]; then
        log "✅ Backend está respondendo (HTTP $HTTP_CODE)"
        if [[ -n "$BODY" ]]; then
            echo "   Resposta:"
            echo "$BODY" | head -5 | sed 's/^/   /'
        fi
    else
        error "❌ Backend não respondeu corretamente (HTTP $HTTP_CODE)"
    fi
else
    warn "⚠️  curl não está instalado"
fi
echo ""

# 2. Testar API Health
log "2. Testando API Health..."
API_HEALTH_URL="http://${SERVER_IP}:${PORT}/api/health"
if command -v curl &> /dev/null; then
    API_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_HEALTH_URL" 2>/dev/null || echo "")
    API_CODE=$(echo "$API_RESPONSE" | tail -1)
    API_BODY=$(echo "$API_RESPONSE" | head -n -1)
    
    if [[ "$API_CODE" == "200" ]] || [[ "$API_CODE" == "503" ]]; then
        log "✅ API está respondendo (HTTP $API_CODE)"
        if [[ -n "$API_BODY" ]]; then
            echo "   Resposta:"
            echo "$API_BODY" | head -5 | sed 's/^/   /'
        fi
    else
        error "❌ API não respondeu corretamente (HTTP $API_CODE)"
    fi
else
    warn "⚠️  curl não está instalado"
fi
echo ""

# 3. Testar Root
log "3. Testando Root Endpoint..."
ROOT_URL="http://${SERVER_IP}:${PORT}/"
if command -v curl &> /dev/null; then
    ROOT_RESPONSE=$(curl -s -w "\n%{http_code}" "$ROOT_URL" 2>/dev/null || echo "")
    ROOT_CODE=$(echo "$ROOT_RESPONSE" | tail -1)
    ROOT_BODY=$(echo "$ROOT_RESPONSE" | head -n -1)
    
    if [[ "$ROOT_CODE" == "200" ]]; then
        log "✅ Root endpoint está respondendo (HTTP $ROOT_CODE)"
    else
        warn "⚠️  Root endpoint retornou HTTP $ROOT_CODE"
    fi
else
    warn "⚠️  curl não está instalado"
fi
echo ""

# 4. Verificar tempo de resposta
log "4. Medindo tempo de resposta..."
if command -v curl &> /dev/null; then
    TIME_START=$(date +%s%N)
    curl -s -o /dev/null "$HEALTH_URL" 2>/dev/null || true
    TIME_END=$(date +%s%N)
    TIME_MS=$(( (TIME_END - TIME_START) / 1000000 ))
    
    if [[ $TIME_MS -lt 1000 ]]; then
        log "✅ Tempo de resposta: ${TIME_MS}ms (excelente)"
    elif [[ $TIME_MS -lt 3000 ]]; then
        log "✅ Tempo de resposta: ${TIME_MS}ms (bom)"
    else
        warn "⚠️  Tempo de resposta: ${TIME_MS}ms (lento)"
    fi
else
    warn "⚠️  curl não está instalado"
fi
echo ""

# Resumo
log "📊 Resumo dos Testes:"
echo ""

if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "503" ]]; then
    log "✅ Backend está FUNCIONANDO!"
    echo ""
    info "🌐 URLs para acessar:"
    echo "   Health:    http://${SERVER_IP}:${PORT}/health"
    echo "   API:       http://${SERVER_IP}:${PORT}/api/health"
    echo "   Root:      http://${SERVER_IP}:${PORT}/"
    echo ""
    warn "ℹ️  Avisos do navegador sobre HTTP/HTTPS são normais e não afetam funcionalidade"
    echo ""
    info "💡 Para remover avisos:"
    echo "   1. Configure HTTPS (produção)"
    echo "   2. Use localhost (desenvolvimento)"
    echo "   3. Ignore os avisos (não afetam funcionalidade)"
else
    error "❌ Backend não está respondendo"
    echo ""
    info "📝 Verifique:"
    echo "   1. Backend está rodando? (ps aux | grep node)"
    echo "   2. Porta $PORT está em uso? (netstat -tlnp | grep :$PORT)"
    echo "   3. Firewall permite porta $PORT? (ufw status)"
    echo "   4. Logs do backend: tail -f backend/logs/*.log"
fi

echo ""
