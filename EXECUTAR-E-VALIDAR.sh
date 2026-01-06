#!/bin/bash

# ============================================
# Smart Signage Pro - Executar e Validar Sistema Completo
# Linux/macOS
# ============================================
# Este script:
# 1. Executa o sistema completo (backend + frontend + banco)
# 2. Valida automaticamente todos os componentes
# 3. Gera relatório de validação
# ============================================

set -e  # Parar em caso de erro

# Cores para output
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
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

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATION_SCRIPT="$ROOT_DIR/VALIDAR-SISTEMA.sh"

print_header "Smart Signage Pro - Executar e Validar Sistema"

# Verificar se o script de validação existe
if [ ! -f "$VALIDATION_SCRIPT" ]; then
    print_error "Script de validacao nao encontrado: $VALIDATION_SCRIPT"
    exit 1
fi

# Tornar executável
chmod +x "$VALIDATION_SCRIPT" 2>/dev/null || true

# Executar script de validação
print_success "Executando validacao completa do sistema..."
echo ""

bash "$VALIDATION_SCRIPT"

# Verificar resultado
if [ $? -eq 0 ]; then
    echo ""
    print_success "Processo concluido!"
else
    echo ""
    print_error "Processo concluido com erros (codigo: $?)"
    exit $?
fi

