#!/bin/bash

# Smart Signage Pro - Script para Rebuild Completo (Backend + Frontend) - Ubuntu/Linux
# Limpa cache, recompila tudo e reinicia serviços

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
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
echo -e "${CYAN}🔄 REBUILD COMPLETO - BACKEND + FRONTEND${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verificar se estamos no diretório correto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Executar rebuild do backend
echo -e "${MAGENTA}▶️  Executando rebuild do backend...${NC}"
echo ""
bash "$SCRIPT_DIR/rebuild-backend.sh"

if [[ $? -ne 0 ]]; then
    error "❌ Erro ao fazer rebuild do backend!"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Executar rebuild do frontend
echo -e "${MAGENTA}▶️  Executando rebuild do frontend...${NC}"
echo ""
bash "$SCRIPT_DIR/rebuild-frontend.sh"

if [[ $? -ne 0 ]]; then
    error "❌ Erro ao fazer rebuild do frontend!"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log "✅ REBUILD COMPLETO CONCLUÍDO!"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log ""

echo -e "${BLUE}📊 RESUMO:${NC}"
echo -e "   • Backend: ✅ Recompilado e reiniciado"
echo -e "   • Frontend: ✅ Recompilado"
echo ""

echo -e "${BLUE}🌐 URLs:${NC}"
echo -e "   • Backend API: http://localhost:3000"
echo -e "   • Frontend Build: frontend/build/"
echo ""

# Reiniciar Nginx se estiver instalado
if command -v systemctl &> /dev/null && systemctl is-active --quiet nginx 2>/dev/null; then
    info "Reiniciando Nginx para servir novo build do frontend..."
    sudo systemctl reload nginx || sudo systemctl restart nginx
    log "✅ Nginx reiniciado"
fi

echo ""
