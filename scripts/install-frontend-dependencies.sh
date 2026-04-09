#!/bin/bash
# Script de Instalação de Dependências do Frontend com Validações
# Smart Signage Pro v2.1
# Uso: ./scripts/install-frontend-dependencies.sh

set -e
set -o pipefail

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Funções de log
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Banner
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     Instalador de Dependências do Frontend - Smart Signage  ║"
echo "║                      v2.1 - Com Validações                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# =============================================================================
# VALIDAÇÕES INICIAIS
# =============================================================================

log "Iniciando validações do ambiente..."

# 1. Verificar se está no diretório correto
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    error "Este script deve ser executado no diretório frontend/"
    error "Diretório atual: $(pwd)"
    exit 1
fi

# 2. Verificar Node.js
if ! command -v node &> /dev/null; then
    error "Node.js não está instalado!"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    error "Node.js versão 16 ou superior é necessária. Versão atual: $(node --version)"
    exit 1
fi

log "✅ Node.js: $(node --version)"

# 3. Verificar npm
if ! command -v npm &> /dev/null; then
    error "npm não está instalado!"
    exit 1
fi

log "✅ npm: $(npm --version)"

# 4. Verificar package.json
if [ ! -f "package.json" ]; then
    error "package.json não encontrado!"
    exit 1
fi

log "✅ package.json encontrado"

# 5. Validar versões no package.json
log "Validando configurações do package.json..."

# Verificar se há versões antigas problemáticas
if grep -q '"ajv":\s*"\^8\.17\.1"' package.json 2>/dev/null; then
    warn "Versão antiga do ajv (8.17.1) detectada no package.json"
    warn "Corrigindo para versão compatível (8.12.0)..."
    sed -i 's/"ajv":\s*"\^8\.17\.1"/"ajv": "^8.12.0"/g' package.json
    sed -i 's/8\.17\.1/8.12.0/g' package.json
    log "✅ package.json corrigido"
fi

if grep -q '"ajv-keywords":\s*"\^5\.' package.json 2>/dev/null; then
    warn "Versão incompatível do ajv-keywords detectada"
    warn "Corrigindo para versão compatível (3.5.2)..."
    sed -i 's/"ajv-keywords":\s*"\^5\./"ajv-keywords": "^3.5./g' package.json
    sed -i 's/5\.1\.0/3.5.2/g' package.json
    log "✅ package.json corrigido"
fi

# Verificar versões corretas
AJV_VERSION=$(grep -A 1 '"ajv"' package.json | grep -oE '\^[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")
AJV_KEYWORDS_VERSION=$(grep -A 1 '"ajv-keywords"' package.json | grep -oE '\^[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")

if [ -n "$AJV_VERSION" ]; then
    log "✅ ajv configurado: $AJV_VERSION"
    if [[ "$AJV_VERSION" == *"8.17.1"* ]]; then
        error "Versão incompatível do ajv ainda presente!"
        exit 1
    fi
else
    warn "ajv não encontrado em devDependencies - será instalado automaticamente"
fi

if [ -n "$AJV_KEYWORDS_VERSION" ]; then
    log "✅ ajv-keywords configurado: $AJV_KEYWORDS_VERSION"
else
    warn "ajv-keywords não encontrado em devDependencies - será instalado automaticamente"
fi

# =============================================================================
# LIMPEZA
# =============================================================================

log "Limpando instalações anteriores..."

# Remover node_modules
if [ -d "node_modules" ]; then
    log "Removendo node_modules..."
    rm -rf node_modules
    log "✅ node_modules removido"
fi

# Remover package-lock.json
if [ -f "package-lock.json" ]; then
    log "Removendo package-lock.json..."
    rm -f package-lock.json
    log "✅ package-lock.json removido"
fi

# Limpar cache do npm
log "Limpando cache do npm..."
npm cache clean --force > /dev/null 2>&1 || true
log "✅ Cache do npm limpo"

# =============================================================================
# INSTALAÇÃO
# =============================================================================

log "Iniciando instalação de dependências..."

# Instalar ajv e ajv-keywords explicitamente primeiro
log "Instalando ajv e ajv-keywords explicitamente..."
if npm install ajv@^8.12.0 ajv-keywords@^3.5.2 --legacy-peer-deps --save-dev --no-audit --no-fund 2>&1 | tee /tmp/npm-install-ajv.log; then
    log "✅ ajv e ajv-keywords instalados"
else
    error "Falha ao instalar ajv e ajv-keywords"
    error "Log:"
    tail -20 /tmp/npm-install-ajv.log
    exit 1
fi

# Instalar todas as dependências
log "Instalando todas as dependências (isso pode levar alguns minutos)..."
if npm install --legacy-peer-deps --no-audit --no-fund 2>&1 | tee /tmp/npm-install-all.log; then
    log "✅ Todas as dependências instaladas"
else
    error "Falha ao instalar dependências"
    error "Últimas linhas do log:"
    tail -30 /tmp/npm-install-all.log
    exit 1
fi

# =============================================================================
# VALIDAÇÕES PÓS-INSTALAÇÃO
# =============================================================================

log "Validando instalação..."

# Verificar se node_modules foi criado
if [ ! -d "node_modules" ]; then
    error "node_modules não foi criado!"
    exit 1
fi

log "✅ node_modules criado"

# Verificar versões instaladas
log "Verificando versões instaladas..."

AJV_INSTALLED=$(npm list ajv --depth=0 2>/dev/null | grep ajv@ | head -1 || echo "")
AJV_KEYWORDS_INSTALLED=$(npm list ajv-keywords --depth=0 2>/dev/null | grep ajv-keywords@ | head -1 || echo "")

if [ -n "$AJV_INSTALLED" ]; then
    log "✅ $AJV_INSTALLED"
    if echo "$AJV_INSTALLED" | grep -q "8.17.1"; then
        error "Versão incorreta do ajv instalada (8.17.1)!"
        error "Esperado: 8.12.0"
        exit 1
    fi
else
    warn "Não foi possível verificar versão do ajv instalada"
fi

if [ -n "$AJV_KEYWORDS_INSTALLED" ]; then
    log "✅ $AJV_KEYWORDS_INSTALLED"
else
    warn "Não foi possível verificar versão do ajv-keywords instalada"
fi

# Verificar se react-scripts está instalado
if [ ! -d "node_modules/react-scripts" ]; then
    error "react-scripts não foi instalado!"
    exit 1
fi

log "✅ react-scripts instalado"

# Verificar se arquivos críticos existem
CRITICAL_FILES=(
    "node_modules/react-scripts/bin/react-scripts.js"
    "node_modules/ajv/dist/ajv.js"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        error "Arquivo crítico não encontrado: $file"
        exit 1
    fi
done

log "✅ Arquivos críticos verificados"

# =============================================================================
# TESTE DE COMPILAÇÃO (OPCIONAL)
# =============================================================================

read -p "Deseja testar a compilação agora? (s/N): " test_build
test_build=${test_build:-n}

if [[ "$test_build" =~ ^[Ss]$ ]]; then
    log "Testando compilação..."
    
    if npm run build 2>&1 | tee /tmp/npm-build.log; then
        log "✅ Compilação bem-sucedida!"
        
        if [ -d "build" ] && [ -f "build/index.html" ]; then
            log "✅ Build gerado com sucesso em build/"
        else
            warn "Build não gerado ou index.html não encontrado"
        fi
    else
        error "Falha na compilação"
        error "Últimas linhas do log:"
        tail -50 /tmp/npm-build.log
        warn "Dependências instaladas, mas compilação falhou"
        warn "Verifique os logs acima para mais detalhes"
    fi
else
    log "Teste de compilação pulado"
fi

# =============================================================================
# RESUMO
# =============================================================================

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ INSTALAÇÃO CONCLUÍDA! ✅               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
log "Resumo da instalação:"
echo "  📦 Node.js: $(node --version)"
echo "  📦 npm: $(npm --version)"
echo "  📦 Dependências instaladas em: node_modules/"
if [ -n "$AJV_INSTALLED" ]; then
    echo "  📦 $AJV_INSTALLED"
fi
if [ -n "$AJV_KEYWORDS_INSTALLED" ]; then
    echo "  📦 $AJV_KEYWORDS_INSTALLED"
fi
echo ""
log "Próximos passos:"
echo "  1. Execute: npm run build"
echo "  2. Ou execute: npm start (para desenvolvimento)"
echo ""

