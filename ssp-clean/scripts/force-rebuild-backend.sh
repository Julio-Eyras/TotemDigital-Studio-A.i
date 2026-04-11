#!/bin/bash

# Script para FORÇAR rebuild completo do backend
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
echo -e "${CYAN}🔨 FORÇAR REBUILD COMPLETO DO BACKEND${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 1. Verificar se arquivos existem no código fonte
log "1️⃣  Verificando estrutura do backend..."

if [[ ! -d "backend/src" ]]; then
    error "❌ Diretório backend/src/ não existe!"
fi

if [[ ! -f "backend/tsconfig.json" ]]; then
    error "❌ Arquivo backend/tsconfig.json não encontrado!"
fi

log "✅ Estrutura do backend verificada"

# 2. Parar TODOS os processos relacionados
log ""
log "2️⃣  Parando TODOS os processos relacionados..."

# Parar processos Node relacionados ao backend
pkill -f "node.*dist/index.js" 2>/dev/null || true
pkill -f "node.*backend" 2>/dev/null || true
pkill -f "ts-node.*backend" 2>/dev/null || true
pkill -f "nodemon.*backend" 2>/dev/null || true

# Parar processos na porta 3000
if lsof -ti:3000 > /dev/null 2>&1; then
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    log "✅ Processos na porta 3000 parados"
fi

# Parar serviços systemd se existirem
if command -v systemctl &> /dev/null; then
    if systemctl is-active --quiet smart-signage-backend 2>/dev/null; then
        info "Parando serviço systemd: smart-signage-backend..."
        sudo systemctl stop smart-signage-backend 2>/dev/null || true
        log "✅ Serviço systemd parado"
    fi
fi

sleep 2

# 3. LIMPEZA AGRESSIVA DE CACHE
log ""
log "3️⃣  Limpeza AGRESSIVA de cache..."

cd backend

# Remover build antigo
if [[ -d "dist" ]]; then
    rm -rf dist
    log "✅ Build antigo (dist/) removido"
fi

# Limpar TODOS os caches possíveis
rm -rf node_modules/.cache 2>/dev/null || true

# Limpar cache do TypeScript
find . -name "*.tsbuildinfo" -delete 2>/dev/null || true
find . -name "tsconfig.tsbuildinfo" -delete 2>/dev/null || true

# Limpar cache do npm
npm cache clean --force 2>/dev/null || true

# Limpar arquivos temporários
find . -name "*.log" -type f -delete 2>/dev/null || true
find . -name ".DS_Store" -delete 2>/dev/null || true

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

# 5. REBUILD FORÇADO
log ""
log "5️⃣  Executando build FORÇADO..."

# Limpar variáveis de ambiente que podem causar cache
unset NODE_ENV
export NODE_ENV=production

# Verificar se tsconfig.json existe e está válido
if [[ ! -f "tsconfig.json" ]]; then
    error "❌ tsconfig.json não encontrado!"
fi

# Build com flags que forçam recompilação
npm run build

if [[ $? -ne 0 ]]; then
    error "❌ ERRO ao compilar backend!"
fi

cd ..

# 6. Verificar se build foi criado corretamente
log ""
log "6️⃣  Verificando build criado..."

if [[ ! -f "backend/dist/index.js" ]]; then
    error "❌ Build não foi criado corretamente! Arquivo backend/dist/index.js não encontrado"
fi

# Verificar tamanho do build
BUILD_SIZE=$(du -sh backend/dist 2>/dev/null | cut -f1)
log "📦 Tamanho do build: $BUILD_SIZE"

# Contar arquivos compilados
FILE_COUNT=$(find backend/dist -type f -name "*.js" 2>/dev/null | wc -l)
log "📄 Arquivos JavaScript compilados: $FILE_COUNT"

# 7. Reiniciar backend
log ""
log "7️⃣  Reiniciando backend..."

cd backend

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

# 8. Aguardar e verificar health check
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

# 9. Instruções finais
log ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log "✅ REBUILD FORÇADO CONCLUÍDO!"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log ""

echo -e "${BLUE}📋 PRÓXIMOS PASSOS:${NC}"
echo ""
echo "1. Verificar se o backend está rodando:"
if [[ "$BACKEND_STARTED_VIA_SYSTEMD" == "true" ]]; then
    echo -e "   ${YELLOW}sudo systemctl status smart-signage-backend${NC}"
else
    echo -e "   ${YELLOW}curl http://localhost:3000/health${NC}"
fi
echo ""
echo "2. Verificar logs:"
if [[ "$BACKEND_STARTED_VIA_SYSTEMD" == "true" ]]; then
    echo -e "   ${YELLOW}sudo journalctl -u smart-signage-backend -f${NC}"
else
    echo -e "   ${YELLOW}tail -f logs/backend-*.log${NC}"
fi
echo ""
echo "3. Se ainda houver problemas:"
echo -e "   ${YELLOW}Verifique erros de compilação TypeScript acima${NC}"
echo -e "   ${YELLOW}Verifique se o banco de dados está acessível${NC}"
echo -e "   ${YELLOW}Verifique variáveis de ambiente em backend/.env${NC}"
echo ""
