#!/bin/bash

# =============================================================================
# Smart Signage Pro - Script de Deploy/Teste em Servidor
# =============================================================================
# Este script automatiza o processo de deploy em um servidor de teste:
# 1. Compila o backend
# 2. Inicia o backend
# 3. Compila o frontend
# 4. Configura Nginx (se necessário)
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
echo "║     Smart Signage Pro - Deploy/Teste em Servidor           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar se estamos no diretório correto
if [[ ! -d "backend" ]] || [[ ! -d "frontend" ]]; then
    error "Execute este script na raiz do projeto (onde estão os diretórios backend/ e frontend/)"
fi

# =============================================================================
# 1. COMPILAR BACKEND
# =============================================================================
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "1️⃣  COMPILANDO BACKEND..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd backend

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
# 2. INICIAR BACKEND
# =============================================================================
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "2️⃣  INICIANDO BACKEND..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd backend

# Verificar se backend já está rodando
if pgrep -f "node.*dist/index.js" > /dev/null; then
    warning "Backend já está rodando. Parando processo anterior..."
    pkill -f "node.*dist/index.js" || true
    sleep 2
fi

# Iniciar backend em background
log "Iniciando backend em background..."
nohup npm start > ../logs/backend.log 2>&1 &
BACKEND_PID=$!

log "Backend iniciado (PID: $BACKEND_PID)"

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

cd ..

# =============================================================================
# 3. COMPILAR FRONTEND
# =============================================================================
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "3️⃣  COMPILANDO FRONTEND..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd frontend

# Verificar se node_modules existe
if [[ ! -d "node_modules" ]]; then
    log "Instalando dependências do frontend..."
    npm install
else
    log "Dependências do frontend já instaladas"
fi

# Compilar frontend
log "Criando build de produção do frontend..."
if npm run build; then
    log "✅ Frontend compilado com sucesso!"
    log "Build criado em: frontend/build/"
else
    error "❌ Erro ao compilar frontend. Verifique os erros acima."
fi

cd ..

# =============================================================================
# 4. VERIFICAÇÕES FINAIS
# =============================================================================
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "4️⃣  VERIFICAÇÕES FINAIS..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verificar se build foi criado
if [[ ! -d "frontend/build" ]]; then
    error "❌ Diretório frontend/build/ não encontrado!"
fi

# Verificar se backend está rodando
if ! pgrep -f "node.*dist/index.js" > /dev/null; then
    error "❌ Backend não está rodando!"
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
log "✅ DEPLOY CONCLUÍDO COM SUCESSO!"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""

SERVER_IP=$(hostname -I | awk '{print $1}' || echo "localhost")

echo -e "${BLUE}📊 STATUS:${NC}"
echo "  • Backend: ✅ Rodando (PID: $BACKEND_PID)"
echo "  • Frontend: ✅ Compilado (frontend/build/)"
echo ""

echo -e "${BLUE}🌐 URLs DE ACESSO:${NC}"
echo "  • Backend API: http://$SERVER_IP:3000"
echo "  • Backend Health: http://$SERVER_IP:3000/health"
echo "  • Frontend (se Nginx configurado): http://$SERVER_IP"
echo ""

echo -e "${BLUE}📝 PRÓXIMOS PASSOS:${NC}"
echo "  1. Configure Nginx para servir frontend/build/"
echo "  2. Configure proxy reverso para backend na porta 3000"
echo "  3. Reinicie Nginx: sudo systemctl restart nginx"
echo ""

echo -e "${BLUE}🔧 COMANDOS ÚTEIS:${NC}"
echo "  • Ver logs do backend: tail -f logs/backend.log"
echo "  • Parar backend: pkill -f 'node.*dist/index.js'"
echo "  • Reiniciar backend: cd backend && npm start"
echo ""

log "Deploy finalizado! 🎉"
