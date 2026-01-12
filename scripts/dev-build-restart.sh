#!/bin/bash

# =============================================================================
# Smart Signage Pro - Script de Build e Restart para Desenvolvimento
# =============================================================================
# Este script automatiza o processo de desenvolvimento:
# 1. Para serviços existentes
# 2. Compila o backend
# 3. Compila o frontend
# 4. Reinicia o backend
# 5. Verifica se tudo está funcionando
# =============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log
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

# Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   Smart Signage Pro - Build e Restart para Desenvolvimento  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar se estamos no diretório correto
if [[ ! -d "backend" ]] || [[ ! -d "frontend" ]]; then
    error "Execute este script na raiz do projeto (onde estão os diretórios backend/ e frontend/)"
fi

# Definir diretório raiz do projeto
PROJECT_ROOT="$(pwd)"

# Criar diretório de logs se não existir
mkdir -p logs

# =============================================================================
# 1. PARAR SERVIÇOS EXISTENTES
# =============================================================================
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "1️⃣  PARANDO SERVIÇOS EXISTENTES..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Usar script stop-services.sh se disponível (mais robusto)
if [[ -f "$PROJECT_ROOT/scripts/stop-services.sh" ]]; then
    log "Usando script stop-services.sh para parar serviços..."
    bash "$PROJECT_ROOT/scripts/stop-services.sh" all || warning "⚠️  Alguns serviços podem não ter sido parados"
    sleep 2  # Aguardar serviços pararem completamente
else
    warning "⚠️  Script stop-services.sh não encontrado. Parando processos manualmente..."
    
    # Parar backend (processo Node.js na porta 3000 ou processo dist/index.js)
    if pgrep -f "node.*dist/index.js" > /dev/null || lsof -ti:3000 > /dev/null 2>&1; then
        log "Parando backend..."
        pkill -f "node.*dist/index.js" 2>/dev/null || true
        lsof -ti:3000 | xargs kill -9 2>/dev/null || true
        sleep 2
        log "✅ Backend parado"
    else
        log "Backend não estava rodando"
    fi

    # Parar frontend dev server (porta 3001)
    if lsof -ti:3001 > /dev/null 2>&1; then
        log "Parando frontend dev server..."
        lsof -ti:3001 | xargs kill -9 2>/dev/null || true
        sleep 1
        log "✅ Frontend dev server parado"
    else
        log "Frontend dev server não estava rodando"
    fi
    
    # Parar serviços systemd se existirem
    if command -v systemctl &> /dev/null; then
        if sudo systemctl is-active --quiet smart-signage 2>/dev/null; then
            log "Parando serviço systemd: smart-signage..."
            sudo systemctl stop smart-signage 2>/dev/null || true
        fi
        
        if sudo systemctl is-active --quiet smartsignage-backend 2>/dev/null; then
            log "Parando serviço systemd: smartsignage-backend..."
            sudo systemctl stop smartsignage-backend 2>/dev/null || true
        fi
        
        if sudo systemctl is-active --quiet smartsignage-frontend 2>/dev/null; then
            log "Parando serviço systemd: smartsignage-frontend..."
            sudo systemctl stop smartsignage-frontend 2>/dev/null || true
        fi
    fi
fi

# Parar serviços systemd se existirem
if systemctl is-active --quiet smart-signage-backend 2>/dev/null; then
    log "Parando serviço systemd smart-signage-backend..."
    sudo systemctl stop smart-signage-backend 2>/dev/null || true
    log "✅ Serviço systemd parado"
fi

# =============================================================================
# 2. LIMPAR CACHE E COMPILAR BACKEND
# =============================================================================
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "2️⃣  LIMPANDO CACHE E COMPILANDO BACKEND..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd backend

# Limpar cache antes de compilar
log "Limpando cache do backend..."
rm -rf dist 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true
rm -f *.tsbuildinfo 2>/dev/null || true
npm cache clean --force 2>/dev/null || true
log "✅ Cache limpo"

# Verificar se node_modules existe
if [[ ! -d "node_modules" ]]; then
    log "Instalando dependências do backend..."
    npm install
else
    log "Dependências do backend já instaladas"
fi

# Compilar TypeScript
log "Compilando TypeScript do backend..."
if npm run build; then
    log "✅ Backend compilado com sucesso!"
else
    error "❌ Erro ao compilar backend. Verifique os erros acima."
fi

cd ..

# =============================================================================
# 3. LIMPAR CACHE E COMPILAR FRONTEND
# =============================================================================
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "3️⃣  LIMPANDO CACHE E COMPILANDO FRONTEND..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd frontend

# Limpar cache antes de compilar
log "Limpando cache do frontend..."
rm -rf build 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .cache 2>/dev/null || true
rm -f .eslintcache 2>/dev/null || true
# Limpar cache do webpack em node_modules
find node_modules -type d -name ".cache" -exec rm -rf {} + 2>/dev/null || true
npm cache clean --force 2>/dev/null || true
log "✅ Cache limpo"

# Verificar se node_modules existe
if [[ ! -d "node_modules" ]]; then
    log "Instalando dependências do frontend..."
    npm install
else
    log "Dependências do frontend já instaladas"
fi

# Aplicar patches antes de compilar
log "Aplicando patches..."
if [[ -f "node_modules/.bin/patch-package" ]]; then
    npm run postinstall 2>/dev/null || true
fi

# Compilar frontend
log "Criando build do frontend..."
if npm run build; then
    log "✅ Frontend compilado com sucesso!"
    log "Build criado em: frontend/build/"
else
    error "❌ Erro ao compilar frontend. Verifique os erros acima."
fi

cd ..

# =============================================================================
# 4. INICIAR BACKEND
# =============================================================================
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "4️⃣  INICIANDO BACKEND..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd backend

# Tentar iniciar via systemd se o serviço existir
if systemctl list-unit-files | grep -q smart-signage-backend; then
    log "Iniciando backend via systemd..."
    sudo systemctl start smart-signage-backend
    BACKEND_STARTED_VIA_SYSTEMD=true
else
    # Iniciar backend em background via npm start
    log "Iniciando backend em background (npm start)..."
    nohup npm start > ../logs/backend.log 2>&1 &
    BACKEND_PID=$!
    BACKEND_STARTED_VIA_SYSTEMD=false
    log "Backend iniciado (PID: $BACKEND_PID)"
fi

cd ..

# Aguardar backend ficar pronto
log "Aguardando backend ficar pronto..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        log "✅ Backend está rodando e respondendo!"
        break
    fi
    
    if [[ $i -eq 30 ]]; then
        error "❌ Backend não respondeu após 30 tentativas. Verifique logs/backend.log"
    fi
    
    sleep 2
done

# =============================================================================
# 5. REINICIAR NGINX (se configurado)
# =============================================================================
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "5️⃣  REINICIANDO NGINX (se configurado)..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v nginx > /dev/null; then
    if sudo systemctl is-active --quiet nginx 2>/dev/null; then
        log "Reiniciando Nginx para servir novo build do frontend..."
        sudo systemctl reload nginx || sudo systemctl restart nginx
        log "✅ Nginx reiniciado"
    else
        log "Nginx não está rodando (opcional)"
    fi
else
    log "Nginx não encontrado (opcional para desenvolvimento)"
fi

# =============================================================================
# 6. VERIFICAÇÕES FINAIS
# =============================================================================
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "6️⃣  VERIFICAÇÕES FINAIS..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verificar se build foi criado
if [[ ! -d "frontend/build" ]]; then
    error "❌ Diretório frontend/build/ não encontrado!"
fi

# Verificar se backend está rodando
if [[ "$BACKEND_STARTED_VIA_SYSTEMD" == "true" ]]; then
    if systemctl is-active --quiet smart-signage-backend 2>/dev/null; then
        log "✅ Backend rodando via systemd"
    else
        error "❌ Backend não está rodando via systemd!"
    fi
else
    if pgrep -f "node.*dist/index.js" > /dev/null; then
        log "✅ Backend rodando (PID: $BACKEND_PID)"
    else
        error "❌ Backend não está rodando!"
    fi
fi

# Health check do backend
if curl -s http://localhost:3000/health | grep -q "healthy"; then
    log "✅ Backend health check: OK"
else
    warning "⚠️  Backend health check falhou"
fi

# =============================================================================
# RESUMO FINAL
# =============================================================================
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "✅ BUILD E RESTART CONCLUÍDOS COM SUCESSO!"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""

SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")

echo -e "${BLUE}📊 STATUS:${NC}"
if [[ "$BACKEND_STARTED_VIA_SYSTEMD" == "true" ]]; then
    echo "  • Backend: ✅ Rodando (systemd)"
else
    echo "  • Backend: ✅ Rodando (PID: $BACKEND_PID)"
fi
echo "  • Frontend: ✅ Compilado (frontend/build/)"
if command -v nginx > /dev/null && systemctl is-active --quiet nginx 2>/dev/null; then
    echo "  • Nginx: ✅ Rodando"
fi
echo ""

echo -e "${BLUE}🌐 URLs DE ACESSO:${NC}"
echo "  • Backend API: http://$SERVER_IP:3000"
echo "  • Backend Health: http://$SERVER_IP:3000/health"
if command -v nginx > /dev/null && systemctl is-active --quiet nginx 2>/dev/null; then
    echo "  • Frontend (via Nginx): http://$SERVER_IP"
    echo "  • Frontend (via Nginx): http://$SERVER_IP/login"
fi
echo ""

echo -e "${BLUE}🔧 COMANDOS ÚTEIS:${NC}"
echo "  • Ver logs do backend: tail -f logs/backend.log"
if [[ "$BACKEND_STARTED_VIA_SYSTEMD" == "true" ]]; then
    echo "  • Ver logs do backend (systemd): sudo journalctl -u smart-signage-backend -f"
    echo "  • Parar backend: sudo systemctl stop smart-signage-backend"
    echo "  • Reiniciar backend: sudo systemctl restart smart-signage-backend"
else
    echo "  • Parar backend: pkill -f 'node.*dist/index.js'"
    echo "  • Reiniciar backend: cd backend && npm start"
fi
echo "  • Recompilar e reiniciar: ./scripts/dev-build-restart.sh"
echo ""

log "Build e restart finalizados! 🎉"
