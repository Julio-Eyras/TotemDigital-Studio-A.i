#!/bin/bash

# Smart Signage Pro - Script para Rebuild e Restart do Backend (Ubuntu/Linux)
# Limpa cache, recompila TypeScript e reinicia o servidor backend

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
echo -e "${CYAN}🔄 REBUILD E RESTART DO BACKEND${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verificar se estamos no diretório correto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

if [[ ! -d "backend" ]]; then
    error "Diretório 'backend' não encontrado! Execute este script na raiz do projeto."
fi

# 1. Parar processos do backend
log "1️⃣  Parando processos do backend..."

# Verificar porta 3000
if lsof -ti:3000 > /dev/null 2>&1; then
    PID_PORT=$(lsof -ti:3000)
    info "Parando processo na porta 3000 (PID: $PID_PORT)..."
    kill -9 $PID_PORT 2>/dev/null || true
    sleep 1
    log "✅ Processo na porta 3000 parado"
fi

# Parar processos Node.js relacionados ao backend
BACKEND_PIDS=$(pgrep -f "node.*dist/index.js" 2>/dev/null || true)
if [[ -n "$BACKEND_PIDS" ]]; then
    for pid in $BACKEND_PIDS; do
        info "Parando processo backend (PID: $pid)..."
        kill -9 $pid 2>/dev/null || true
        log "✅ Processo backend parado (PID: $pid)"
    done
    sleep 2
else
    info "Nenhum processo backend encontrado"
fi

# Parar serviços systemd se existirem
if command -v systemctl &> /dev/null; then
    if systemctl is-active --quiet smart-signage-backend 2>/dev/null; then
        info "Parando serviço systemd: smart-signage-backend..."
        sudo systemctl stop smart-signage-backend 2>/dev/null || true
        log "✅ Serviço systemd parado"
    fi
fi

# 2. Limpar cache e build antigo
log ""
log "2️⃣  Limpando cache e builds antigos..."

cd backend

if [[ -d "dist" ]]; then
    rm -rf dist
    log "✅ Pasta backend/dist removida"
fi

if [[ -d "node_modules/.cache" ]]; then
    rm -rf node_modules/.cache
    log "✅ Cache do node_modules removido"
fi

# Limpar cache do TypeScript
if ls *.tsbuildinfo 2>/dev/null | grep -q .; then
    rm -f *.tsbuildinfo
    log "✅ Cache do TypeScript removido"
fi

# Limpar cache do npm
info "Limpando cache do npm..."
npm cache clean --force 2>/dev/null || true

log "✅ Cache limpo"

# 3. Recompilar backend
log ""
log "3️⃣  Recompilando backend (TypeScript)..."

# Verificar dependências
if [[ ! -d "node_modules" ]]; then
    info "Instalando dependências..."
    npm install
else
    info "Dependências do backend já instaladas"
fi

# Compilar
info "Executando build..."
if npm run build; then
    log "✅ Backend recompilado com sucesso!"
else
    error "❌ ERRO ao compilar backend!"
fi

cd ..

# 4. Reiniciar backend
log ""
log "4️⃣  Reiniciando backend..."

cd backend

# Verificar se build foi criado
if [[ ! -f "dist/index.js" ]]; then
    error "❌ Arquivo dist/index.js não encontrado!"
fi

# Criar diretório de logs se não existir
mkdir -p ../logs

# Tentar iniciar via systemd se o serviço existir
if command -v systemctl &> /dev/null && systemctl list-unit-files | grep -q smart-signage-backend; then
    info "Iniciando backend via systemd..."
    sudo systemctl start smart-signage-backend
    BACKEND_STARTED_VIA_SYSTEMD=true
    log "✅ Backend iniciado via systemd"
else
    # Iniciar em background
    info "Iniciando backend em background..."
    LOG_FILE="../logs/backend-$(date +%Y%m%d-%H%M%S).log"
    nohup npm start > "$LOG_FILE" 2>&1 &
    BACKEND_PID=$!
    BACKEND_STARTED_VIA_SYSTEMD=false
    log "✅ Backend iniciado (PID: $BACKEND_PID)"
    log "📁 Logs: $LOG_FILE"
fi

cd ..

# Aguardar um pouco e verificar health check
log ""
info "Verificando health check..."

max_attempts=30
attempt=0
backend_ready=false

while [[ $attempt -lt $max_attempts ]] && [[ "$backend_ready" == "false" ]]; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        backend_ready=true
        log "✅ Backend iniciado e respondendo!"
        break
    fi
    
    attempt=$((attempt + 1))
    if [[ $attempt -ge $max_attempts ]]; then
        warning "⚠️  Backend pode não ter iniciado corretamente"
        if [[ "$BACKEND_STARTED_VIA_SYSTEMD" == "true" ]]; then
            warning "Verifique logs: sudo journalctl -u smart-signage-backend -f"
        else
            warning "Verifique logs: tail -f logs/backend-*.log"
            warning "Ou execute manualmente: cd backend && npm start"
        fi
    else
        sleep 2
    fi
done

log ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log "✅ REBUILD E RESTART DO BACKEND CONCLUÍDO!"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log ""

echo -e "${BLUE}📊 STATUS:${NC}"
if [[ "$BACKEND_STARTED_VIA_SYSTEMD" == "true" ]]; then
    echo -e "   • Backend: ✅ Rodando (systemd)"
else
    echo -e "   • Backend: ✅ Rodando (PID: $BACKEND_PID)"
fi
echo -e "   • URL: http://localhost:3000"
echo -e "   • Health: http://localhost:3000/health"
echo ""

echo -e "${BLUE}🔧 COMANDOS ÚTEIS:${NC}"
if [[ "$BACKEND_STARTED_VIA_SYSTEMD" == "true" ]]; then
    echo -e "   • Ver logs: ${YELLOW}sudo journalctl -u smart-signage-backend -f${NC}"
    echo -e "   • Parar backend: ${YELLOW}sudo systemctl stop smart-signage-backend${NC}"
    echo -e "   • Reiniciar backend: ${YELLOW}sudo systemctl restart smart-signage-backend${NC}"
else
    echo -e "   • Ver logs: ${YELLOW}tail -f logs/backend-*.log${NC}"
    echo -e "   • Parar backend: ${YELLOW}kill $BACKEND_PID${NC}"
    echo -e "   • Parar todos Node: ${YELLOW}pkill -f 'node.*dist/index.js'${NC}"
fi
echo ""
