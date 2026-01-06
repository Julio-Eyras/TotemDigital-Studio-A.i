#!/bin/bash

# ============================================
# Smart Signage Pro - Instalação e Inicialização Completa
# Linux/macOS
# ============================================
# Este script automatiza a instalação e o início de todos os componentes:
# - Backend (Node.js/Express)
# - Frontend (React)
# - Banco de Dados PostgreSQL
# ============================================

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

function print_header() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

function print_success() {
    echo -e "${GREEN}[OK] $1${NC}"
}

function print_error() {
    echo -e "${RED}[ERRO] $1${NC}"
}

function print_warning() {
    echo -e "${YELLOW}[AVISO] $1${NC}"
}

function print_info() {
    echo -e "${GRAY}  $1${NC}"
}

# Variáveis de configuração
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="smartsignage"
BACKEND_PORT="3000"
FRONTEND_PORT="3001"

# Caminhos
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
DATABASE_DIR="$ROOT_DIR/database"
BACKEND_ENV="$BACKEND_DIR/.env"

print_header "Smart Signage Pro - Instalacao e Inicializacao Completa"

# ============================================
# 1. PARAR SERVIÇOS EXISTENTES
# ============================================

print_header "1. Parando Servicos Existentes"

# Parar processos nas portas
print_info "Verificando servico na porta $BACKEND_PORT..."
BACKEND_PID=$(lsof -ti:$BACKEND_PORT 2>/dev/null || true)
if [ -n "$BACKEND_PID" ]; then
    print_info "Encontrado processo na porta $BACKEND_PORT com PID: $BACKEND_PID. Tentando parar..."
    kill -9 $BACKEND_PID 2>/dev/null || true
    print_success "Servico na porta $BACKEND_PORT (PID: $BACKEND_PID) parado com sucesso."
else
    print_info "Nenhum servico encontrado na porta $BACKEND_PORT."
fi

print_info "Verificando servico na porta $FRONTEND_PORT..."
FRONTEND_PID=$(lsof -ti:$FRONTEND_PORT 2>/dev/null || true)
if [ -n "$FRONTEND_PID" ]; then
    print_info "Encontrado processo na porta $FRONTEND_PORT com PID: $FRONTEND_PID. Tentando parar..."
    kill -9 $FRONTEND_PID 2>/dev/null || true
    print_success "Servico na porta $FRONTEND_PORT (PID: $FRONTEND_PID) parado com sucesso."
else
    print_info "Nenhum servico encontrado na porta $FRONTEND_PORT."
fi

sleep 2
echo ""

# ============================================
# 2. VERIFICAÇÕES INICIAIS
# ============================================

print_header "2. Verificando Pre-requisitos"

# Node.js
print_info "Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(echo $NODE_VERSION | sed 's/v\([0-9]*\).*/\1/')
    if [ "$NODE_MAJOR" -ge 18 ]; then
        print_success "Node.js encontrado: $NODE_VERSION"
    else
        print_error "Node.js versao 18+ e necessario. Versao atual: $NODE_VERSION"
        exit 1
    fi
else
    print_error "Node.js nao encontrado. Por favor, instale Node.js 18+ primeiro."
    print_info "Download: https://nodejs.org/"
    exit 1
fi

# npm
print_info "Verificando npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_success "npm encontrado: $NPM_VERSION"
else
    print_error "npm nao encontrado."
    exit 1
fi

echo ""

# ============================================
# 3. CONFIGURAR BACKEND
# ============================================

print_header "3. Configurando Backend"

if [ ! -d "$BACKEND_DIR" ]; then
    print_error "Diretorio 'backend' nao encontrado!"
    exit 1
fi

# Criar arquivo .env do backend
print_info "Criando arquivo .env do backend..."
if [ -f "$BACKEND_ENV" ]; then
    print_info ".env ja existe, mantendo configuracao atual."
else
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "dev-secret-key-$(date +%s)")
    TWO_FACTOR_KEY=$(openssl rand -base64 32 2>/dev/null || echo "dev-2fa-key-$(date +%s)")
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    CORS_ORIGIN="http://localhost:${BACKEND_PORT},http://localhost:${FRONTEND_PORT},http://localhost:8080"
    ALLOWED_FILE_TYPES="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,audio/mp3,audio/wav,audio/ogg"
    SMTP_FROM="Smart Signage <noreply@smartsignage.com>"
    DATE_STR=$(date '+%Y-%m-%d %H:%M:%S')
    
    cat > "$BACKEND_ENV" << EOF
# Smart Signage Pro v2.1 - Configuracao Local
# Gerado automaticamente em $DATE_STR

NODE_ENV=development
PORT=$BACKEND_PORT
HOST=0.0.0.0

# =============================================
# BANCO DE DADOS (PostgreSQL)
# =============================================
DB_DRIVER=postgresql
DATABASE_URL=$DATABASE_URL
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_POOL_SIZE=20
DB_CONNECTION_TIMEOUT=30000

# =============================================
# AUTENTICACAO JWT
# =============================================
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# =============================================
# AUTENTICACAO DE DOIS FATORES (2FA)
# =============================================
TWO_FACTOR_ENCRYPTION_KEY=$TWO_FACTOR_KEY

# =============================================
# SEGURANCA
# =============================================
PLAYER_ABANDON_PIN=1234
BCRYPT_ROUNDS=12

# =============================================
# CORS
# =============================================
CORS_ORIGIN=$CORS_ORIGIN

# =============================================
# RATE LIMITING
# =============================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_REQUESTS=5
UPLOAD_RATE_LIMIT_WINDOW_MS=3600000
UPLOAD_RATE_LIMIT_MAX_REQUESTS=20
SENSITIVE_RATE_LIMIT_WINDOW_MS=600000
SENSITIVE_RATE_LIMIT_MAX_REQUESTS=10
MAX_PAYLOAD_SIZE=10MB

# =============================================
# UPLOAD DE ARQUIVOS
# =============================================
UPLOAD_MAX_SIZE=100MB
UPLOAD_PATH=./public/assets/uploads
MEDIA_QUOTA_PER_CLIENT=5GB
ALLOWED_FILE_TYPES=$ALLOWED_FILE_TYPES

# =============================================
# REDIS / CACHE (opcional - desabilitado por padrao)
# =============================================
CACHE_ENABLED=false
CACHE_TTL=3600
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# =============================================
# LOGGING
# =============================================
LOG_LEVEL=info
LOG_FILE=./logs/app.log
LOG_MAX_SIZE=10MB
LOG_MAX_FILES=5
LOG_ENABLE_CONSOLE=true

# =============================================
# IA / SMART PLAYLIST (opcional)
# =============================================
AI_PROVIDER=ollama
AI_MODEL=llama3.2:3b
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_TIMEOUT=30000

# =============================================
# EMAIL (desabilitado por padrao)
# =============================================
EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=$SMTP_FROM
SMTP_TLS_REJECT_UNAUTHORIZED=true
FRONTEND_URL=http://localhost:$FRONTEND_PORT

# =============================================
# MONITORAMENTO (opcional)
# =============================================
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=false

# =============================================
# BACKUP
# =============================================
BACKUP_ENABLED=false
BACKUP_INTERVAL=24h
BACKUP_RETENTION_DAYS=30
BACKUP_PATH=./backups

# =============================================
# ANALYTICS
# =============================================
ANALYTICS_ENABLED=true
ANALYTICS_RETENTION_DAYS=365
ANALYTICS_BATCH_SIZE=1000

# =============================================
# STRIPE / PAGAMENTOS (desabilitado)
# =============================================
STRIPE_ENABLED=false

# =============================================
# DESENVOLVIMENTO
# =============================================
DEBUG=true
VERBOSE_LOGGING=true
EOF
    print_success "Arquivo .env criado em: backend/.env"
fi

# Instalar dependências do backend
print_info "Instalando dependencias do backend..."
cd "$BACKEND_DIR"
if npm install > /dev/null 2>&1; then
    print_success "Dependencias do backend instaladas!"
else
    print_error "Erro ao instalar dependencias do backend"
    exit 1
fi
cd "$ROOT_DIR"
echo ""

# ============================================
# 4. CONFIGURAR BANCO DE DADOS
# ============================================

print_header "4. Configurando Banco de Dados"

# Criar diretório de logs
mkdir -p "$BACKEND_DIR/logs"

print_info "Criando banco de dados e aplicando schema..."
cd "$BACKEND_DIR"
if node scripts/setup-database.js 2>&1 | grep -q "Configuracao do banco de dados concluida\|Schema aplicado com sucesso"; then
    print_success "Banco de dados configurado!"
else
    print_warning "Pode ter havido problemas ao configurar o banco. Verifique os logs acima."
fi
cd "$ROOT_DIR"
echo ""

print_info "Compilando backend..."
cd "$BACKEND_DIR"
if npm run build > /dev/null 2>&1; then
    print_success "Backend compilado!"
else
    print_error "Erro ao compilar backend"
    exit 1
fi
cd "$ROOT_DIR"
echo ""

# ============================================
# 5. CONFIGURAR FRONTEND
# ============================================

print_header "5. Configurando Frontend"

if [ ! -d "$FRONTEND_DIR" ]; then
    print_error "Diretorio 'frontend' nao encontrado!"
    exit 1
fi

print_info "Instalando dependencias do frontend..."
cd "$FRONTEND_DIR"
if npm install > /dev/null 2>&1; then
    print_success "Dependencias do frontend instaladas!"
else
    print_error "Erro ao instalar dependencias do frontend"
    exit 1
fi
cd "$ROOT_DIR"
echo ""

# ============================================
# 6. INICIANDO SERVIÇOS
# ============================================

print_header "6. Iniciando Servicos"

# Iniciar Backend em background
print_info "Iniciando Backend..."
cd "$BACKEND_DIR"
nohup npm run dev > "$BACKEND_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$ROOT_DIR/.backend.pid"
print_success "Backend iniciado (PID: $BACKEND_PID)"
cd "$ROOT_DIR"

# Aguardar backend iniciar
print_info "Aguardando backend iniciar..."
sleep 5
for i in {1..10}; do
    if curl -s "http://localhost:$BACKEND_PORT/api/health/quick" > /dev/null 2>&1 || \
       curl -s "http://localhost:$BACKEND_PORT/api/health" > /dev/null 2>&1; then
        print_success "Backend esta rodando na porta $BACKEND_PORT"
        break
    fi
    sleep 2
done

# Iniciar Frontend em background
print_info "Iniciando Frontend..."
cd "$FRONTEND_DIR"
nohup npm start > "$FRONTEND_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$ROOT_DIR/.frontend.pid"
print_success "Frontend iniciado (PID: $FRONTEND_PID)"
cd "$ROOT_DIR"

# Aguardar frontend iniciar
print_info "Aguardando frontend iniciar..."
sleep 10

echo ""
print_header "Sistema Iniciado!"

echo -e "${GREEN}Servicos rodando:${NC}"
echo ""
echo -e "  ${CYAN}Backend:${NC}  http://localhost:$BACKEND_PORT"
echo -e "  ${CYAN}Frontend:${NC} http://localhost:$FRONTEND_PORT"
echo ""
echo -e "${GRAY}Processos:${NC}"
echo -e "  ${GRAY}Backend PID:${NC}  $BACKEND_PID"
echo -e "  ${GRAY}Frontend PID:${NC} $FRONTEND_PID"
echo ""

echo -e "${YELLOW}Para parar os servicos:${NC}"
echo -e "  ${GRAY}Execute:${NC} ./PARAR-SERVICOS.sh"
echo -e "  ${GRAY}Ou:${NC} kill $BACKEND_PID $FRONTEND_PID"
echo ""

echo -e "${GRAY}Logs do Backend:${NC}"
echo -e "  ${GRAY}backend/logs/app.log${NC}"
echo -e "  ${GRAY}backend/logs/backend.log${NC}"
echo ""

print_header "Sistema pronto para uso!"

