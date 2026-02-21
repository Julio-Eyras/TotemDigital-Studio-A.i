#!/bin/bash
# =============================================================================
# Script de Verificação de Status do Backend
# =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log "🔍 Verificando Status do Backend Smart Signage Pro"
echo ""

# 1. Verificar processos Node.js
log "1. Verificando processos Node.js..."
NODE_PROCESSES=$(ps aux | grep node | grep -v grep || echo "")
if [[ -n "$NODE_PROCESSES" ]]; then
    log "✅ Processos Node.js encontrados:"
    echo "$NODE_PROCESSES" | head -5
else
    warn "⚠️  Nenhum processo Node.js encontrado"
fi
echo ""

# 2. Verificar porta 3000
log "2. Verificando porta 3000..."
PORT_3000=$(sudo netstat -tlnp 2>/dev/null | grep :3000 || sudo ss -tlnp 2>/dev/null | grep :3000 || echo "")
if [[ -n "$PORT_3000" ]]; then
    log "✅ Porta 3000 está em uso:"
    echo "$PORT_3000"
else
    error "❌ Porta 3000 não está em uso (backend não está rodando)"
fi
echo ""

# 3. Verificar porta 3001 (frontend)
log "3. Verificando porta 3001 (frontend)..."
PORT_3001=$(sudo netstat -tlnp 2>/dev/null | grep :3001 || sudo ss -tlnp 2>/dev/null | grep :3001 || echo "")
if [[ -n "$PORT_3001" ]]; then
    log "✅ Porta 3001 está em uso (frontend):"
    echo "$PORT_3001"
else
    warn "⚠️  Porta 3001 não está em uso (frontend não está rodando)"
fi
echo ""

# 4. Verificar firewall
log "4. Verificando firewall (UFW)..."
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(sudo ufw status 2>/dev/null || echo "inactive")
    if echo "$UFW_STATUS" | grep -q "Status: active"; then
        log "✅ Firewall está ativo"
        if echo "$UFW_STATUS" | grep -q "3000"; then
            log "✅ Porta 3000 está permitida no firewall"
        else
            warn "⚠️  Porta 3000 pode não estar permitida no firewall"
            info "   Execute: sudo ufw allow 3000/tcp"
        fi
    else
        warn "⚠️  Firewall não está ativo"
    fi
else
    warn "⚠️  UFW não está instalado"
fi
echo ""

# 5. Testar conexão local
log "5. Testando conexão local (localhost:3000)..."
if command -v curl &> /dev/null; then
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null | grep -q "200\|503"; then
        log "✅ Backend responde localmente"
        HEALTH_RESPONSE=$(curl -s http://localhost:3000/health 2>/dev/null || echo "")
        if [[ -n "$HEALTH_RESPONSE" ]]; then
            echo "   Resposta: $HEALTH_RESPONSE" | head -3
        fi
    else
        error "❌ Backend não responde localmente"
        info "   Isso indica que o backend não está rodando ou não iniciou corretamente"
    fi
else
    warn "⚠️  curl não está instalado (não é possível testar conexão)"
fi
echo ""

# 6. Verificar PostgreSQL
log "6. Verificando PostgreSQL..."
if systemctl is-active --quiet postgresql 2>/dev/null; then
    log "✅ PostgreSQL está rodando"
else
    error "❌ PostgreSQL não está rodando"
    info "   Execute: sudo systemctl start postgresql"
fi
echo ""

# 7. Verificar arquivo .env
log "7. Verificando configuração (.env)..."
if [[ -f "backend/.env" ]]; then
    log "✅ Arquivo .env existe"
    if grep -q "PORT=3000" backend/.env 2>/dev/null; then
        log "✅ PORT=3000 configurado"
    else
        warn "⚠️  PORT pode não estar configurado como 3000"
    fi
    if grep -q "HOST=0.0.0.0" backend/.env 2>/dev/null; then
        log "✅ HOST=0.0.0.0 configurado (aceita conexões externas)"
    else
        warn "⚠️  HOST pode não estar configurado como 0.0.0.0"
    fi
else
    warn "⚠️  Arquivo .env não encontrado em backend/.env"
    info "   Execute: cp backend/env.example backend/.env"
fi
echo ""

# 8. Verificar build do backend
log "8. Verificando build do backend..."
if [[ -d "backend/dist" ]]; then
    log "✅ Diretório dist/ existe (backend foi compilado)"
    if [[ -f "backend/dist/index.js" ]]; then
        log "✅ Arquivo index.js compilado existe"
    else
        warn "⚠️  Arquivo index.js não encontrado em dist/"
    fi
else
    warn "⚠️  Diretório dist/ não existe (backend não foi compilado)"
    info "   Execute: cd backend && npm run build"
fi
echo ""

# Resumo
log "📊 Resumo:"
echo ""

# Contar problemas
PROBLEMS=0

if [[ -z "$PORT_3000" ]]; then
    error "❌ Backend não está rodando na porta 3000"
    PROBLEMS=$((PROBLEMS + 1))
fi

if ! systemctl is-active --quiet postgresql 2>/dev/null; then
    error "❌ PostgreSQL não está rodando"
    PROBLEMS=$((PROBLEMS + 1))
fi

if [[ ! -f "backend/.env" ]]; then
    error "❌ Arquivo .env não encontrado"
    PROBLEMS=$((PROBLEMS + 1))
fi

if [[ $PROBLEMS -eq 0 ]]; then
    log "✅ Nenhum problema crítico encontrado!"
    echo ""
    info "🌐 URLs para acessar:"
    echo "   Backend:  http://192.168.1.110:3000"
    echo "   Frontend: http://192.168.1.110:3001"
    echo "   Health:   http://192.168.1.110:3000/health"
else
    error "❌ $PROBLEMS problema(s) crítico(s) encontrado(s)"
    echo ""
    info "📝 Próximos passos:"
    echo "   1. Verificar se backend está rodando: ps aux | grep node"
    echo "   2. Iniciar backend: cd backend && npm start"
    echo "   3. Verificar logs: tail -f backend/logs/*.log"
fi

echo ""
