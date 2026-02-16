#!/bin/bash
# =============================================
# SmartSignage Pro - Corrigir Permissões de Assets
# Garante que Nginx pode ler arquivos de mídia
# =============================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ASSETS_BASE="/opt/smart-signage/public/assets"

print_info() {
    echo -e "${BLUE}ℹ️  $@${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $@${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $@${NC}"
}

print_error() {
    echo -e "${RED}❌ $@${NC}"
}

# Verificar se diretório existe
if [ ! -d "$ASSETS_BASE" ]; then
    print_error "Diretório não encontrado: $ASSETS_BASE"
    exit 1
fi

print_info "Ajustando permissões de assets..."

# Ajustar permissões de diretórios (755)
find "$ASSETS_BASE" -type d -exec chmod 755 {} \;
print_success "Permissões de diretórios ajustadas (755)"

# Ajustar permissões de arquivos (644)
find "$ASSETS_BASE" -type f -exec chmod 644 {} \;
print_success "Permissões de arquivos ajustadas (644)"

# Verificar se Nginx precisa de acesso
if id www-data &>/dev/null; then
    print_info "Ajustando ownership para www-data (Nginx)..."
    # Dar acesso de leitura ao grupo www-data
    chmod -R g+r "$ASSETS_BASE" 2>/dev/null || true
    # Se possível, adicionar ao grupo www-data
    if groups | grep -q www-data || [ "$(id -u)" = "0" ]; then
        chgrp -R www-data "$ASSETS_BASE" 2>/dev/null || true
        chmod -R g+r "$ASSETS_BASE" 2>/dev/null || true
    else
        print_warning "Não foi possível alterar grupo para www-data (precisa sudo)"
        print_info "Execute: sudo chgrp -R www-data $ASSETS_BASE"
    fi
elif id nginx &>/dev/null; then
    print_info "Ajustando ownership para nginx..."
    chmod -R g+r "$ASSETS_BASE" 2>/dev/null || true
    if groups | grep -q nginx || [ "$(id -u)" = "0" ]; then
        chgrp -R nginx "$ASSETS_BASE" 2>/dev/null || true
        chmod -R g+r "$ASSETS_BASE" 2>/dev/null || true
    else
        print_warning "Não foi possível alterar grupo para nginx (precisa sudo)"
        print_info "Execute: sudo chgrp -R nginx $ASSETS_BASE"
    fi
fi

print_success "Permissões ajustadas!"
print_info "Verificando acesso..."

# Testar se arquivos são legíveis
if [ -f "$ASSETS_BASE/uploads/subscriber-1/medias/Cestto_00005.png" ]; then
    if [ -r "$ASSETS_BASE/uploads/subscriber-1/medias/Cestto_00005.png" ]; then
        print_success "Arquivo de teste é legível"
    else
        print_warning "Arquivo de teste não é legível (pode precisar sudo)"
    fi
fi

print_info "Recarregue o Nginx para aplicar mudanças:"
echo "  sudo systemctl reload nginx"
echo ""
print_success "Concluído!"
