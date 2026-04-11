#!/bin/bash

# Smart Signage Pro v2.0 - Conversor de Diretório para Repositório Git
# Converte diretório baixado do GitHub em repositório Git funcional

set -e

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
    exit 1
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
echo "    Smart Signage Pro v2.0 - Conversor Git"
echo "    Convertendo diretório em repositório Git"
echo "=============================================="
echo -e "${NC}"

# Verificar se estamos no diretório correto
if [ ! -f "scripts/install-smartsignage.sh" ]; then
    error "Execute este script no diretório smartsignage-pro-main"
fi

# Verificar se git está instalado
if ! command -v git &> /dev/null; then
    error "Git não está instalado. Execute: sudo apt install git"
fi

# Verificar se já é um repositório Git
if [ -d ".git" ]; then
    warning "Diretório já é um repositório Git"
    log "Atualizando repositório existente..."
    git pull origin main
    exit 0
fi

log "Inicializando repositório Git..."

# Inicializar repositório Git
git init

# Configurar repositório remoto
log "Configurando repositório remoto..."
git remote add origin https://github.com/Julio-Eyras/smartsignage-pro.git

# Configurar branch main
git branch -M main

# Fazer fetch do repositório remoto
log "Baixando informações do repositório remoto..."
git fetch origin

# Fazer merge com o repositório remoto (permitindo históricos não relacionados)
log "Sincronizando com repositório remoto..."
git pull origin main --allow-unrelated-histories

log "✅ Repositório Git configurado com sucesso!"

# Verificar se os arquivos do frontend estão presentes
log "Verificando arquivos do frontend..."
if [ -f "frontend/public/index.html" ]; then
    log "✅ frontend/public/index.html encontrado"
else
    warning "frontend/public/index.html não encontrado"
fi

if [ -f "frontend/public/manifest.json" ]; then
    log "✅ frontend/public/manifest.json encontrado"
else
    warning "frontend/public/manifest.json não encontrado"
fi

log ""
log "🎉 Conversão concluída!"
log ""
log "📋 PRÓXIMOS PASSOS:"
log "1. Execute: sudo ./scripts/install-smartsignage.sh"
log "2. Ou execute: ./diagnose-installation.sh para verificar"
log ""
log "🚀 Sistema pronto para instalação!"
