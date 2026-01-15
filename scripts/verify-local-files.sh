#!/bin/bash

# Smart Signage Pro v2.0 - Verificação Local Completa
# Verifica se todos os arquivos essenciais estão presentes no repositório

set -e

# Garantir execução a partir do root do projeto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Banner
echo -e "${BLUE}"
echo "=============================================="
echo "    Smart Signage Pro v2.0 - Verificação Local"
echo "    Verificando arquivos essenciais"
echo "=============================================="
echo -e "${NC}"

# Contadores
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Função para verificar arquivo
check_file() {
    local file_path="$1"
    local description="$2"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ -f "$file_path" ]; then
        log "✅ $description: $file_path"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        error "❌ $description: $file_path (FALTANDO)"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# Função para verificar diretório
check_dir() {
    local dir_path="$1"
    local description="$2"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ -d "$dir_path" ]; then
        log "✅ $description: $dir_path"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        error "❌ $description: $dir_path (FALTANDO)"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

log "Iniciando verificação completa dos arquivos essenciais..."

# =============================================
# VERIFICAÇÃO DO FRONTEND
# =============================================
info "🔍 Verificando Frontend..."

check_file "frontend/public/index.html" "Arquivo principal do React"
check_file "frontend/public/manifest.json" "Manifesto da aplicação"
check_file "frontend/package.json" "Configuração do frontend"
check_file "frontend/src/index.tsx" "Ponto de entrada do React"
check_file "frontend/src/App.tsx" "Componente principal"
check_dir "frontend/src/components" "Componentes React"
check_dir "frontend/src/pages" "Páginas da aplicação"
check_dir "frontend/src/services" "Serviços da aplicação"

# =============================================
# VERIFICAÇÃO DO BACKEND
# =============================================
info "🔍 Verificando Backend..."

check_file "backend/package.json" "Configuração do backend"
check_file "backend/src/index.ts" "Ponto de entrada do backend"
check_file "backend/src/config/database.ts" "Configuração do banco"
check_file "backend/prisma/schema.prisma" "Schema do Prisma"
check_dir "backend/src/routes" "Rotas da API"
check_dir "backend/src/services" "Serviços do backend"
check_dir "backend/src/middleware" "Middlewares"
check_dir "backend/src/validation" "Validações"

# =============================================
# VERIFICAÇÃO DOS DOCKERFILES
# =============================================
info "🔍 Verificando Dockerfiles..."

check_file "Dockerfile" "Dockerfile principal"
check_file "Dockerfile.backend" "Dockerfile do backend"
check_file "Dockerfile.frontend" "Dockerfile do frontend"
check_file "docker-compose.yml" "Docker Compose"

# =============================================
# VERIFICAÇÃO DO NGINX
# =============================================
info "🔍 Verificando Nginx..."

check_file "nginx/frontend.conf" "Configuração do frontend"
check_file "nginx/simple.conf" "Configuração simples"

# =============================================
# VERIFICAÇÃO DO BANCO DE DADOS
# =============================================
info "🔍 Verificando Banco de Dados..."

check_file "database/smartchannel-db-v2-refactored-apply-all.sql" "Schema SQL (refatorado v2)"
check_file "database/carga-inicial-db-smarsignage-v4.sql" "Carga inicial (seeds v4)"

# =============================================
# VERIFICAÇÃO DO MONITORAMENTO
# =============================================
info "🔍 Verificando Monitoramento..."

check_file "monitoring/prometheus/prometheus.yml" "Configuração Prometheus"
check_file "monitoring/grafana/grafana.ini" "Configuração Grafana"
check_file "monitoring/grafana/datasources/prometheus.yml" "Datasource Grafana"

# =============================================
# VERIFICAÇÃO DO PLAYER
# =============================================
info "🔍 Verificando Player..."

check_file "player-web/index-dispatchplan.html" "Player Web (DispatchPlan)"
check_file "player-web/index.html" "Player Web (HTML5)"

# =============================================
# VERIFICAÇÃO DOS SCRIPTS
# =============================================
info "🔍 Verificando Scripts..."

check_file "scripts/install-smartsignage.sh" "Script de instalação (Linux)"
check_file "scripts/install-smartsignage.ps1" "Script de instalação (Windows)"
check_file "scripts/manage-system.sh" "Script de gerenciamento"
check_file "scripts/backup-system.sh" "Script de backup"
check_file "scripts/monitor-system.sh" "Script de monitoramento"

# =============================================
# VERIFICAÇÃO DOS ARQUIVOS DE CONFIGURAÇÃO
# =============================================
info "🔍 Verificando Arquivos de Configuração..."

check_file "env.example" "Exemplo de variáveis de ambiente"
check_file "backend/env.example" "Exemplo de variáveis do backend"
check_file ".gitignore" "Arquivo .gitignore"
check_file "package.json" "Configuração do projeto"

# =============================================
# VERIFICAÇÃO DO GIT
# =============================================
info "🔍 Verificando Status do Git..."

if [ -d ".git" ]; then
    log "✅ Repositório Git inicializado"
    
    # Verificar se há arquivos não commitados
    if git diff --quiet && git diff --cached --quiet; then
        log "✅ Nenhuma alteração pendente"
    else
        warning "⚠️ Há alterações não commitadas"
        git status --short
    fi
    
    # Verificar se está sincronizado com o remoto
    if git status -uno | grep -q "Your branch is up to date"; then
        log "✅ Repositório sincronizado com remoto"
    else
        warning "⚠️ Repositório não está sincronizado"
    fi
else
    error "❌ Repositório Git não inicializado"
fi

# =============================================
# RESUMO FINAL
# =============================================
log ""
log "📊 RESUMO DA VERIFICAÇÃO:"
log "========================="
log "Total de verificações: $TOTAL_CHECKS"
log "✅ Passou: $PASSED_CHECKS"
log "❌ Falhou: $FAILED_CHECKS"

if [ $FAILED_CHECKS -eq 0 ]; then
    log ""
    log "🎉 TODOS OS ARQUIVOS ESSENCIAIS ESTÃO PRESENTES!"
    log "✅ Sistema pronto para instalação"
    log ""
    log "📋 PRÓXIMOS PASSOS:"
    log "1. git add ."
    log "2. git commit -m 'Verificação completa - todos os arquivos presentes'"
    log "3. git push origin main"
    log "4. Testar no servidor Ubuntu"
    exit 0
else
    log ""
    error "❌ $FAILED_CHECKS ARQUIVO(S) FALTANDO!"
    log "Corrija os arquivos faltantes antes de fazer push"
    exit 1
fi
