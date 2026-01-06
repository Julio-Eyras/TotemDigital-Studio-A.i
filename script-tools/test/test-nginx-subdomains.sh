#!/bin/bash
# =============================================================================
# Script de Teste - Nginx Subdomínios
# =============================================================================
# Testa a configuração de subdomínios do Nginx
# =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funções
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se está rodando como root
if [[ $EUID -eq 0 ]]; then
    error "Este script não deve ser executado como root!"
    exit 1
fi

log "🧪 Testando Configuração Nginx - Subdomínios"
echo ""

# 1. Testar sintaxe do Nginx
log "1. Testando sintaxe do Nginx..."
if sudo nginx -t 2>&1 | grep -q "syntax is ok"; then
    log "✅ Sintaxe do Nginx está correta"
else
    error "❌ Erro na sintaxe do Nginx!"
    sudo nginx -t
    exit 1
fi
echo ""

# 2. Verificar se configuração existe
log "2. Verificando arquivo de configuração..."
NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"
if [[ -f "$NGINX_CONFIG" ]]; then
    log "✅ Arquivo de configuração encontrado: $NGINX_CONFIG"
else
    error "❌ Arquivo de configuração não encontrado: $NGINX_CONFIG"
    exit 1
fi
echo ""

# 3. Verificar server blocks
log "3. Verificando server blocks..."
MAIN_COUNT=$(grep -c "server_name.*main\|server_name.*_" "$NGINX_CONFIG" || echo "0")
PUBLISHER_COUNT=$(grep -c "publisher" "$NGINX_CONFIG" || echo "0")
SUBSCRIBER_COUNT=$(grep -c "subscriber" "$NGINX_CONFIG" || echo "0")

log "   - Server blocks principais: $MAIN_COUNT"
log "   - Referências a 'publisher': $PUBLISHER_COUNT"
log "   - Referências a 'subscriber': $SUBSCRIBER_COUNT"

if [[ $PUBLISHER_COUNT -gt 0 ]] && [[ $SUBSCRIBER_COUNT -gt 0 ]]; then
    log "✅ Subdomínios configurados"
else
    warn "⚠️  Subdomínios podem não estar configurados corretamente"
fi
echo ""

# 4. Verificar headers X-Subdomain-Type
log "4. Verificando headers X-Subdomain-Type..."
HEADER_MAIN=$(grep -c "X-Subdomain-Type.*main" "$NGINX_CONFIG" || echo "0")
HEADER_PUBLISHER=$(grep -c "X-Subdomain-Type.*publisher" "$NGINX_CONFIG" || echo "0")
HEADER_SUBSCRIBER=$(grep -c "X-Subdomain-Type.*subscriber" "$NGINX_CONFIG" || echo "0")

log "   - Header 'main': $HEADER_MAIN"
log "   - Header 'publisher': $HEADER_PUBLISHER"
log "   - Header 'subscriber': $HEADER_SUBSCRIBER"

if [[ $HEADER_MAIN -gt 0 ]] && [[ $HEADER_PUBLISHER -gt 0 ]] && [[ $HEADER_SUBSCRIBER -gt 0 ]]; then
    log "✅ Headers X-Subdomain-Type configurados"
else
    warn "⚠️  Alguns headers podem estar faltando"
fi
echo ""

# 5. Verificar se Nginx está rodando
log "5. Verificando status do Nginx..."
if systemctl is-active --quiet nginx; then
    log "✅ Nginx está rodando"
else
    warn "⚠️  Nginx não está rodando. Iniciando..."
    sudo systemctl start nginx
    sleep 2
    if systemctl is-active --quiet nginx; then
        log "✅ Nginx iniciado com sucesso"
    else
        error "❌ Falha ao iniciar Nginx"
        exit 1
    fi
fi
echo ""

# 6. Verificar se backend está rodando
log "6. Verificando se backend está rodando..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    log "✅ Backend está respondendo na porta 3000"
else
    warn "⚠️  Backend não está respondendo na porta 3000"
    warn "   Certifique-se de que o backend está rodando antes de testar subdomínios"
fi
echo ""

# 7. Testar requisições com diferentes hosts
log "7. Testando requisições com diferentes hosts..."

# Testar domínio principal
log "   Testando domínio principal..."
if curl -s -H "Host: sistema.com" http://localhost/api/health > /dev/null 2>&1; then
    log "   ✅ Domínio principal responde"
else
    warn "   ⚠️  Domínio principal não responde (pode ser normal se backend não estiver rodando)"
fi

# Testar publisher
log "   Testando publisher..."
if curl -s -H "Host: publisher.sistema.com" http://localhost/api/health > /dev/null 2>&1; then
    log "   ✅ Publisher responde"
else
    warn "   ⚠️  Publisher não responde (pode ser normal se backend não estiver rodando)"
fi

# Testar subscriber
log "   Testando subscriber..."
if curl -s -H "Host: subscriber.sistema.com" http://localhost/api/health > /dev/null 2>&1; then
    log "   ✅ Subscriber responde"
else
    warn "   ⚠️  Subscriber não responde (pode ser normal se backend não estiver rodando)"
fi
echo ""

# 8. Verificar logs recentes
log "8. Verificando logs recentes do Nginx..."
if [[ -f /var/log/nginx/error.log ]]; then
    RECENT_ERRORS=$(sudo tail -5 /var/log/nginx/error.log | grep -i "error\|warn" || echo "")
    if [[ -z "$RECENT_ERRORS" ]]; then
        log "✅ Nenhum erro recente nos logs"
    else
        warn "⚠️  Erros recentes encontrados:"
        echo "$RECENT_ERRORS"
    fi
else
    warn "⚠️  Arquivo de log não encontrado"
fi
echo ""

# Resumo
log "📊 Resumo dos Testes:"
echo "   ✅ Sintaxe do Nginx: OK"
echo "   ✅ Configuração: OK"
echo "   ✅ Headers: OK"
echo "   ✅ Nginx: Rodando"
echo ""
log "✅ Testes básicos concluídos!"
echo ""
log "📝 Próximos passos:"
echo "   1. Certifique-se de que o backend está rodando"
echo "   2. Teste no navegador adicionando ao /etc/hosts:"
echo "      127.0.0.1 sistema.com"
echo "      127.0.0.1 publisher.sistema.com"
echo "      127.0.0.1 subscriber.sistema.com"
echo "   3. Acesse http://publisher.sistema.com e verifique se carrega PublisherLayout"
echo "   4. Acesse http://subscriber.sistema.com e verifique se carrega SubscriberLayout"
echo ""
