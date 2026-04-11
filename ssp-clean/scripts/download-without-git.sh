#!/bin/bash

# Smart Signage Pro v2.0 - Download sem Git
# Baixa o projeto do GitHub SEM histórico Git (apenas arquivos)

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
echo "║      Smart Signage Pro v2.0 - Download sem Git              ║"
echo "║     Baixa projeto do GitHub SEM histórico Git                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo

# Configurações
REPO_URL="https://github.com/Julio-Eyras/smartsignage-pro.git"
BRANCH="main"
DOWNLOAD_DIR="smartsignage-pro"
TEMP_DIR="/tmp/smartsignage-pro-download-$$"

# Verificar se wget ou curl está instalado
if command -v wget &> /dev/null; then
    DOWNLOAD_CMD="wget"
elif command -v curl &> /dev/null; then
    DOWNLOAD_CMD="curl"
else
    error "wget ou curl não encontrado. Instale com: sudo apt install wget curl"
    exit 1
fi

log "Baixando projeto do GitHub (sem Git)..."

# Opção 1: Baixar ZIP do GitHub (mais simples)
log "Método 1: Baixando ZIP do GitHub..."
ZIP_URL="https://github.com/Julio-Eyras/smartsignage-pro/archive/refs/heads/main.zip"

if command -v unzip &> /dev/null; then
    log "Baixando arquivo ZIP..."
    
    if [ "$DOWNLOAD_CMD" == "wget" ]; then
        wget -q "$ZIP_URL" -O /tmp/smartsignage-pro-main.zip
    else
        curl -sL "$ZIP_URL" -o /tmp/smartsignage-pro-main.zip
    fi
    
    if [ $? -eq 0 ]; then
        log "✅ ZIP baixado com sucesso!"
        
        # Extrair ZIP
        log "Extraindo arquivos..."
        if [ -d "$DOWNLOAD_DIR" ]; then
            warn "Diretório $DOWNLOAD_DIR já existe. Removendo..."
            rm -rf "$DOWNLOAD_DIR"
        fi
        
        unzip -q /tmp/smartsignage-pro-main.zip -d /tmp/
        mv /tmp/smartsignage-pro-main "$DOWNLOAD_DIR"
        
        # Limpar arquivo temporário
        rm -f /tmp/smartsignage-pro-main.zip
        
        log "✅ Arquivos extraídos para: $DOWNLOAD_DIR"
        
        # Verificar se existe .git e remover se existir
        if [ -d "$DOWNLOAD_DIR/.git" ]; then
            log "Removendo diretório .git (não será usado)..."
            rm -rf "$DOWNLOAD_DIR/.git"
            log "✅ Diretório .git removido"
        fi
        
        log "✅ Download concluído SEM Git!"
        log "📁 Diretório: $(pwd)/$DOWNLOAD_DIR"
        echo
        log "Próximos passos:"
        echo "  cd $DOWNLOAD_DIR"
        echo "  chmod +x scripts/install-smartsignage.sh"
        echo "  ./scripts/install-smartsignage.sh"
        exit 0
    else
        warn "Falha ao baixar ZIP, tentando método alternativo..."
    fi
else
    warn "unzip não encontrado. Instale com: sudo apt install unzip"
    warn "Tentando método alternativo com git (temporário)..."
fi

# Opção 2: Usar Git temporariamente e depois remover
log "Método 2: Usando Git temporariamente (será removido após download)..."
log "Clonando repositório em diretório temporário..."

if ! command -v git &> /dev/null; then
    error "Git não está instalado. Instale com: sudo apt install git"
    exit 1
fi

# Clonar em diretório temporário
log "Clonando repositório..."
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TEMP_DIR"

if [ $? -eq 0 ]; then
    log "✅ Repositório clonado (temporariamente)"
    
    # Mover arquivos para destino final
    if [ -d "$DOWNLOAD_DIR" ]; then
        warn "Diretório $DOWNLOAD_DIR já existe. Removendo..."
        rm -rf "$DOWNLOAD_DIR"
    fi
    
    # Mover apenas os arquivos (SEM .git)
    log "Copiando arquivos (SEM .git)..."
    mkdir -p "$DOWNLOAD_DIR"
    
    # Copiar arquivos e diretórios (excluindo .git explicitamente)
    find "$TEMP_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' -exec cp -r {} "$DOWNLOAD_DIR"/ \;
    
    # Garantir que .git não existe
    if [ -d "$DOWNLOAD_DIR/.git" ]; then
        log "Removendo diretório .git (não deveria existir)..."
        rm -rf "$DOWNLOAD_DIR/.git"
    fi
    
    # Remover também .gitignore se você não quiser nenhuma referência ao Git
    if [ -f "$DOWNLOAD_DIR/.gitignore" ]; then
        log "Removendo .gitignore (opcional)..."
        # Comentado: mantém .gitignore (útil para ignorar arquivos)
        # rm -f "$DOWNLOAD_DIR/.gitignore"
    fi
    
    # Limpar diretório temporário
    log "Limpando diretório temporário..."
    rm -rf "$TEMP_DIR"
    
    log "✅ Download concluído SEM Git!"
    log "📁 Diretório: $(pwd)/$DOWNLOAD_DIR"
    echo
    log "Próximos passos:"
    echo "  cd $DOWNLOAD_DIR"
    echo "  chmod +x scripts/install-smartsignage.sh"
    echo "  ./scripts/install-smartsignage.sh"
else
    error "Falha ao clonar repositório"
    exit 1
fi

