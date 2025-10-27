#!/bin/bash

# Smart Signage Pro v2.0 - Script para Debug do Backend
# ====================================================

INSTALL_DIR="/opt/smart-signage"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║            Smart Signage Pro v2.0 - Debug Backend           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log "Investigando problema do Backend..."

cd $INSTALL_DIR

# Verificar se Docker está disponível
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    error "Docker Compose não encontrado!"
    exit 1
fi

# Verificar status dos containers
log "Status dos containers:"
$COMPOSE_CMD ps

echo ""

# Verificar logs do backend
log "Logs do container backend (últimas 50 linhas):"
$COMPOSE_CMD logs --tail 50 backend

echo ""

# Verificar se o container está rodando
log "Verificando se o container backend está rodando..."
if $COMPOSE_CMD ps | grep -q "backend.*Up"; then
    echo "✅ Container backend está rodando"
else
    echo "❌ Container backend NÃO está rodando"
    log "Tentando reiniciar o container backend..."
    $COMPOSE_CMD restart backend
    sleep 10
    $COMPOSE_CMD logs --tail 20 backend
fi

echo ""

# Verificar conectividade interna
log "Testando conectividade interna do container..."
if docker exec backend curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend responde internamente"
else
    echo "❌ Backend NÃO responde internamente"
fi

# Verificar se a porta está sendo escutada
log "Verificando se a porta 3000 está sendo escutada..."
if docker exec backend netstat -tlnp | grep -q ":3000"; then
    echo "✅ Porta 3000 está sendo escutada"
else
    echo "❌ Porta 3000 NÃO está sendo escutada"
fi

# Verificar processos dentro do container
log "Processos rodando no container backend:"
docker exec backend ps aux

echo ""

# Verificar variáveis de ambiente
log "Variáveis de ambiente do container backend:"
docker exec backend env | grep -E "(NODE_ENV|PORT|HOST|DATABASE)"

echo ""

# Verificar arquivos no container
log "Verificando arquivos no container backend:"
docker exec backend ls -la /app/
docker exec backend ls -la /app/dist/

echo ""

# Verificar se o entrypoint está sendo executado
log "Verificando se o entrypoint está sendo executado:"
docker exec backend ls -la /entrypoint.sh 2>/dev/null || echo "Entrypoint não encontrado (normal na nova arquitetura)"

echo ""

# Testar endpoints externamente
SERVER_IP=$(hostname -I | awk '{print $1}')
log "Testando endpoints externamente:"

echo "Testando http://$SERVER_IP:3000/health..."
if curl -s --max-time 5 "http://$SERVER_IP:3000/health"; then
    echo "✅ Endpoint /health responde"
else
    echo "❌ Endpoint /health NÃO responde"
fi

echo "Testando http://$SERVER_IP:3000/..."
if curl -s --max-time 5 "http://$SERVER_IP:3000/"; then
    echo "✅ Endpoint raiz responde"
else
    echo "❌ Endpoint raiz NÃO responde"
fi

echo ""

log "Debug concluído!"
