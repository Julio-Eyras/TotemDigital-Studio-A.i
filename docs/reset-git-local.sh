#!/bin/bash

# Smart Signage Pro v2.0 - Reset Local para Estado do GitHub
# Descarta TODAS as alterações locais e volta ao estado do GitHub

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

# Banner
clear
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          Smart Signage Pro v2.0 - Reset Git Local           ║"
echo "║     Descarta TODAS as alterações locais (IRREVERSÍVEL)     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo

# Verificar se está em um repositório Git
if [ ! -d ".git" ]; then
    error "Não é um repositório Git!"
    exit 1
fi

# Mostrar status atual
log "Status atual do repositório:"
git status --short
echo

# Confirmar ação
echo -e "${RED}⚠️  ATENÇÃO: Esta operação irá APAGAR:${NC}"
echo "  ❌ Todas as alterações não commitadas"
echo "  ❌ Todos os arquivos modificados"
echo "  ❌ Todos os arquivos não rastreados (exceto os ignorados)"
echo
echo -e "${RED}⚠️  ESTA AÇÃO É IRREVERSÍVEL!${NC}"
echo
read -p "Digite 'DESCARTAR TUDO' para confirmar: " confirm

if [[ "$confirm" != "DESCARTAR TUDO" ]]; then
    warn "Operação cancelada pelo usuário."
    exit 0
fi

echo
log "Descartando todas as alterações locais..."

# 1. Descartar alterações em arquivos rastreados
log "Descartando alterações em arquivos rastreados..."
git checkout -- .

# 2. Descartar arquivos do staging (index)
log "Limpando área de staging..."
git reset --hard HEAD

# 3. Remover arquivos não rastreados (exceto os ignorados)
log "Removendo arquivos não rastreados..."
git clean -fd

# 4. Fazer fetch do GitHub para garantir que está atualizado
log "Atualizando referências do GitHub..."
git fetch origin

# 5. Resetar branch local para o estado do GitHub
log "Resetando branch local para o estado do GitHub..."
git reset --hard origin/main

# Verificar status final
log "Status final do repositório:"
git status --short

echo
log "✅ Todas as alterações locais foram descartadas!"
log "✅ Repositório agora está igual ao GitHub (origin/main)"
echo

