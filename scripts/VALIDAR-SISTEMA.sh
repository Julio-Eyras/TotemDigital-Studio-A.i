#!/bin/bash

# ============================================
# Smart Signage Pro - Validação Automática do Sistema
# Linux/macOS
# ============================================
# Este script executa o sistema completo e valida automaticamente:
# - Backend (Node.js/Express)
# - Frontend (React)
# - Banco de Dados PostgreSQL
# - APIs e Health Checks
# - Logs de erros
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

# Variáveis de configuração (defaults; sobrescritos pelo .env se existir)
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="smartsignage"
DB_PASSWORD="smartsignage123"
DB_NAME="smartsignage"
BACKEND_PORT="3000"
FRONTEND_PORT="3001"
BACKEND_URL="http://localhost:$BACKEND_PORT"
FRONTEND_URL="http://localhost:$FRONTEND_PORT"

# Caminhos (raiz do projeto = pasta acima de scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_ENV="$BACKEND_DIR/.env"
ROOT_ENV="$ROOT_DIR/.env"
BACKEND_LOGS="$BACKEND_DIR/logs"
REPORT_FILE="$SCRIPT_DIR/validacao-sistema-$(date +%Y%m%d-%H%M%S).txt"

# Carregar credenciais reais da instalação (evita assumir user postgres sem password)
_load_env_file() {
    local f="$1"
    [[ -f "$f" ]] || return 0
    while IFS= read -r line || [[ -n "$line" ]]; do
        line="${line%%#*}"
        line="$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
        [[ -z "$line" || "$line" != *=* ]] && continue
        local k="${line%%=*}"
        local v="${line#*=}"
        v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
        case "$k" in
            DB_HOST) DB_HOST="$v" ;;
            DB_PORT) DB_PORT="$v" ;;
            DB_USER) DB_USER="$v" ;;
            DB_PASSWORD|DB_PASS) DB_PASSWORD="$v" ;;
            DB_NAME) DB_NAME="$v" ;;
            DATABASE_URL)
                # postgresql://user:pass@host:port/db
                if [[ "$v" =~ postgresql://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/([^?]+) ]]; then
                    DB_USER="${BASH_REMATCH[1]}"
                    DB_PASSWORD="${BASH_REMATCH[2]}"
                    DB_HOST="${BASH_REMATCH[3]}"
                    [[ -n "${BASH_REMATCH[4]}" ]] && DB_PORT="${BASH_REMATCH[4]}"
                    DB_NAME="${BASH_REMATCH[5]}"
                fi
                ;;
        esac
    done < "$f"
}
_load_env_file "$ROOT_ENV"
_load_env_file "$BACKEND_ENV"

# Contadores de validação
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
ERRORS=()

function test_result() {
    local test_name="$1"
    local passed="$2"
    local message="${3:-}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ "$passed" = true ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        print_success "$test_name"
        if [ -n "$message" ]; then
            print_info "  $message"
        fi
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        print_error "$test_name"
        if [ -n "$message" ]; then
            print_error "  $message"
        fi
        ERRORS+=("$test_name: $message")
    fi
}

# ============================================
# 1. VERIFICAÇÕES INICIAIS
# ============================================

print_header "1. Verificando Pre-requisitos"

# Node.js
print_info "Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(echo $NODE_VERSION | sed 's/v\([0-9]*\).*/\1/')
    if [ "$NODE_MAJOR" -ge 18 ]; then
        test_result "Node.js instalado" true "Versao: $NODE_VERSION"
    else
        test_result "Node.js instalado" false "Versao: $NODE_VERSION (necessario 18+)"
    fi
else
    test_result "Node.js instalado" false "Node.js nao encontrado"
fi

# npm
print_info "Verificando npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    test_result "npm instalado" true "Versao: $NPM_VERSION"
else
    test_result "npm instalado" false "npm nao encontrado"
fi

# PostgreSQL
print_info "Verificando PostgreSQL..."
export PGPASSWORD="$DB_PASSWORD"
_pg_ok=false
if command -v psql &> /dev/null; then
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        _pg_ok=true
        test_result "PostgreSQL acessivel" true "TCP $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
    elif PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
        _pg_ok=true
        test_result "PostgreSQL acessivel" true "TCP $DB_USER@$DB_HOST (db postgres; app DB pode faltar)"
    elif sudo -u postgres psql -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
        _pg_ok=true
        test_result "PostgreSQL acessivel" true "socket peer como user postgres (serviço OK; confira role $DB_USER)"
    else
        test_result "PostgreSQL acessivel" false "Falhou com DB_USER=$DB_USER (confira .env e roles)"
    fi
else
    test_result "PostgreSQL acessivel" false "psql nao encontrado"
fi
unset PGPASSWORD
unset _pg_ok

# Diretórios
[ -d "$BACKEND_DIR" ] && test_result "Diretorio backend existe" true || test_result "Diretorio backend existe" false
[ -d "$FRONTEND_DIR" ] && test_result "Diretorio frontend existe" true || test_result "Diretorio frontend existe" false
[ -f "$BACKEND_ENV" ] && test_result "Arquivo .env existe" true || test_result "Arquivo .env existe" false

echo ""

# ============================================
# 2. INSTALAÇÃO E CONFIGURAÇÃO
# ============================================

print_header "2. Instalando e Configurando Sistema"

# Instalar dependências do backend
print_info "Instalando dependencias do backend..."
cd "$BACKEND_DIR"
if npm install > /dev/null 2>&1; then
    test_result "Dependencias backend instaladas" true
else
    test_result "Dependencias backend instaladas" false "Erro ao instalar"
fi
cd "$ROOT_DIR"

# Instalar dependências do frontend
print_info "Instalando dependencias do frontend..."
cd "$FRONTEND_DIR"
if npm install > /dev/null 2>&1; then
    test_result "Dependencias frontend instaladas" true
else
    test_result "Dependencias frontend instaladas" false "Erro ao instalar"
fi
cd "$ROOT_DIR"

# Compilar backend
print_info "Compilando backend..."
cd "$BACKEND_DIR"
if npm run build > /dev/null 2>&1; then
    test_result "Backend compilado" true
else
    test_result "Backend compilado" false "Erro ao compilar"
fi
cd "$ROOT_DIR"

# Configurar banco de dados
print_info "Configurando banco de dados..."
cd "$BACKEND_DIR"
if node scripts/setup-database.js 2>&1 | grep -q "Configuracao do banco de dados concluida\|Schema aplicado com sucesso"; then
    test_result "Banco de dados configurado" true
else
    test_result "Banco de dados configurado" false "Pode ter havido problemas"
fi
cd "$ROOT_DIR"

echo ""

# ============================================
# 3. INICIAR SERVIÇOS
# ============================================

print_header "3. Iniciando Servicos"

# Parar serviços existentes
print_info "Parando servicos existentes..."
BACKEND_PID=$(lsof -ti:$BACKEND_PORT 2>/dev/null || true)
FRONTEND_PID=$(lsof -ti:$FRONTEND_PORT 2>/dev/null || true)
[ -n "$BACKEND_PID" ] && kill -9 $BACKEND_PID 2>/dev/null || true
[ -n "$FRONTEND_PID" ] && kill -9 $FRONTEND_PID 2>/dev/null || true
sleep 2

# Iniciar Backend
print_info "Iniciando Backend..."
cd "$BACKEND_DIR"
nohup npm run dev > "$BACKEND_LOGS/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$ROOT_DIR/.backend.pid"
cd "$ROOT_DIR"
sleep 5

# Iniciar Frontend
print_info "Iniciando Frontend..."
cd "$FRONTEND_DIR"
nohup npm start > "$FRONTEND_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$ROOT_DIR/.frontend.pid"
cd "$ROOT_DIR"
sleep 10

echo ""

# ============================================
# 4. VALIDAÇÕES DE CONECTIVIDADE
# ============================================

print_header "4. Validando Conectividade"

# Aguardar serviços iniciarem
print_info "Aguardando servicos iniciarem (30 segundos)..."
BACKEND_READY=false
FRONTEND_READY=false
WAITED=0
MAX_WAIT=30

while [ $WAITED -lt $MAX_WAIT ] && ([ "$BACKEND_READY" = false ] || [ "$FRONTEND_READY" = false ]); do
    sleep 2
    WAITED=$((WAITED + 2))
    
    # Testar Backend
    if [ "$BACKEND_READY" = false ]; then
        if curl -s "$BACKEND_URL/api/health/quick" > /dev/null 2>&1 || \
           curl -s "$BACKEND_URL/api/health" > /dev/null 2>&1; then
            BACKEND_READY=true
            print_info "Backend respondendo..."
        fi
    fi
    
    # Testar Frontend
    if [ "$FRONTEND_READY" = false ]; then
        if curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
            FRONTEND_READY=true
            print_info "Frontend respondendo..."
        fi
    fi
done

# Validar Backend
[ "$BACKEND_READY" = true ] && test_result "Backend acessivel" true "URL: $BACKEND_URL" || test_result "Backend acessivel" false "URL: $BACKEND_URL"

# Validar Frontend
[ "$FRONTEND_READY" = true ] && test_result "Frontend acessivel" true "URL: $FRONTEND_URL" || test_result "Frontend acessivel" false "URL: $FRONTEND_URL"

echo ""

# ============================================
# 5. VALIDAÇÕES DE API
# ============================================

print_header "5. Validando APIs"

if [ "$BACKEND_READY" = true ]; then
    # Health Check
    print_info "Testando /api/health/check..."
    if HEALTH_RESPONSE=$(curl -s "$BACKEND_URL/api/health/check" 2>/dev/null) || \
       HEALTH_RESPONSE=$(curl -s "$BACKEND_URL/api/health" 2>/dev/null); then
        HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
        test_result "Health Check API" true "Status: $HEALTH_STATUS"
    else
        test_result "Health Check API" false "Nao foi possivel conectar"
    fi
    
    # API Docs
    print_info "Testando /api-docs..."
    if curl -s "$BACKEND_URL/api-docs" > /dev/null 2>&1; then
        test_result "API Docs acessivel" true
    else
        test_result "API Docs acessivel" false "Nao foi possivel acessar"
    fi
    
    # Verificar banco de dados
    print_info "Verificando conexao com banco de dados..."
    if HEALTH_RESPONSE=$(curl -s "$BACKEND_URL/api/health/check" 2>/dev/null) || \
       HEALTH_RESPONSE=$(curl -s "$BACKEND_URL/api/health" 2>/dev/null); then
        DB_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"database"[^}]*"status":"[^"]*"' | cut -d'"' -f6 || echo "unknown")
        [ "$DB_STATUS" = "healthy" ] && test_result "Banco de dados conectado" true "Status: $DB_STATUS" || test_result "Banco de dados conectado" false "Status: $DB_STATUS"
    else
        test_result "Banco de dados conectado" false "Nao foi possivel verificar"
    fi
else
    print_warning "Backend nao esta acessivel, pulando validacoes de API"
fi

echo ""

# ============================================
# 6. VALIDAÇÕES DE LOGS
# ============================================

print_header "6. Validando Logs"

# Verificar logs do backend
LOG_FILE="$BACKEND_LOGS/app.log"
if [ -f "$LOG_FILE" ]; then
    print_info "Analisando logs do backend..."
    ERROR_COUNT=$(grep -i "error\|ERROR\|Error" "$LOG_FILE" 2>/dev/null | wc -l || echo "0")
    CRITICAL_ERRORS=$(grep -i "FATAL\|CRITICAL\|ECONNREFUSED\|Cannot\|Failed" "$LOG_FILE" 2>/dev/null | head -5 || true)
    
    if [ -z "$CRITICAL_ERRORS" ]; then
        test_result "Logs sem erros criticos" true
    else
        test_result "Logs sem erros criticos" false "Encontrados erros criticos"
        print_warning "Erros encontrados nos logs:"
        echo "$CRITICAL_ERRORS" | while read -r line; do
            print_info "  $line"
        done
    fi
else
    test_result "Arquivo de log existe" false "Log file nao encontrado: $LOG_FILE"
fi

# Verificar processos
print_info "Verificando processos..."
if ps -p $BACKEND_PID > /dev/null 2>&1; then
    test_result "Backend processo rodando" true "PID: $BACKEND_PID"
else
    test_result "Backend processo rodando" false "PID: $BACKEND_PID"
fi

if ps -p $FRONTEND_PID > /dev/null 2>&1; then
    test_result "Frontend processo rodando" true "PID: $FRONTEND_PID"
else
    test_result "Frontend processo rodando" false "PID: $FRONTEND_PID"
fi

echo ""

# ============================================
# 7. VALIDAÇÕES DE PORTAS
# ============================================

print_header "7. Validando Portas"

# Verificar porta do backend
print_info "Verificando porta $BACKEND_PORT..."
if lsof -ti:$BACKEND_PORT > /dev/null 2>&1; then
    PORT_PID=$(lsof -ti:$BACKEND_PORT | head -1)
    test_result "Porta $BACKEND_PORT em uso (Backend)" true "PID: $PORT_PID"
else
    test_result "Porta $BACKEND_PORT em uso (Backend)" false
fi

# Verificar porta do frontend
print_info "Verificando porta $FRONTEND_PORT..."
if lsof -ti:$FRONTEND_PORT > /dev/null 2>&1; then
    PORT_PID=$(lsof -ti:$FRONTEND_PORT | head -1)
    test_result "Porta $FRONTEND_PORT em uso (Frontend)" true "PID: $PORT_PID"
else
    test_result "Porta $FRONTEND_PORT em uso (Frontend)" false
fi

echo ""

# ============================================
# 8. RELATÓRIO FINAL
# ============================================

print_header "8. Relatorio Final"

if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
else
    SUCCESS_RATE=0
fi

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}RESUMO DA VALIDACAO${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
print_info "Total de testes: $TOTAL_TESTS"
print_success "Testes aprovados: $PASSED_TESTS"
print_error "Testes falhados: $FAILED_TESTS"
print_info "Taxa de sucesso: ${SUCCESS_RATE}%"
echo ""

# Gerar relatório em arquivo
cat > "$REPORT_FILE" << EOF
========================================
VALIDACAO DO SISTEMA SMART SIGNAGE PRO
========================================
Data: $(date '+%Y-%m-%d %H:%M:%S')
Versao: 2.1.0

RESUMO:
- Total de testes: $TOTAL_TESTS
- Aprovados: $PASSED_TESTS
- Falhados: $FAILED_TESTS
- Taxa de sucesso: ${SUCCESS_RATE}%

SERVICOS:
- Backend: $BACKEND_URL
- Frontend: $FRONTEND_URL
- Banco de Dados: $DB_HOST:$DB_PORT/$DB_NAME

ERROS ENCONTRADOS:
$(printf '%s\n' "${ERRORS[@]}")

========================================
EOF

print_success "Relatorio salvo em: $REPORT_FILE"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}SISTEMA VALIDADO COM SUCESSO!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    print_info "Backend: $BACKEND_URL"
    print_info "Frontend: $FRONTEND_URL"
    print_info "API Docs: $BACKEND_URL/api-docs"
    print_info "Health Check: $BACKEND_URL/api/health/check"
    echo ""
    print_info "Para parar os servicos, execute: ./PARAR-SERVICOS.sh"
else
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}VALIDACAO CONCLUIDA COM ERROS${NC}"
    echo -e "${YELLOW}========================================${NC}"
    echo ""
    print_warning "Alguns testes falharam. Verifique o relatorio para detalhes."
    echo ""
    print_info "Relatorio: $REPORT_FILE"
fi

echo ""

