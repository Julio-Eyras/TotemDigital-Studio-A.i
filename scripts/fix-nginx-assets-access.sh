#!/bin/bash
# =============================================
# SmartSignage Pro - Corrigir Acesso do Nginx aos Assets
# Garante que Nginx (www-data) pode ler arquivos de mídia
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

print_info "Ajustando permissões para Nginx acessar assets..."

# Ajustar ownership para www-data (Nginx no Ubuntu/Debian)
if id www-data &>/dev/null; then
    print_info "Ajustando ownership para www-data..."
    sudo chown -R www-data:www-data "$ASSETS_BASE" 2>/dev/null || {
        print_warning "Não foi possível alterar ownership (tentando apenas grupo)..."
        sudo chgrp -R www-data "$ASSETS_BASE" 2>/dev/null || true
    }
    print_success "Ownership ajustado para www-data"
elif id nginx &>/dev/null; then
    print_info "Ajustando ownership para nginx..."
    sudo chown -R nginx:nginx "$ASSETS_BASE" 2>/dev/null || {
        print_warning "Não foi possível alterar ownership (tentando apenas grupo)..."
        sudo chgrp -R nginx "$ASSETS_BASE" 2>/dev/null || true
    }
    print_success "Ownership ajustado para nginx"
else
    print_warning "Usuário do Nginx não encontrado (www-data ou nginx)"
    print_info "Ajustando apenas permissões de leitura pública..."
fi

# Garantir permissões corretas
print_info "Ajustando permissões de diretórios (755)..."
sudo find "$ASSETS_BASE" -type d -exec chmod 755 {} \;
print_success "Diretórios: 755"

print_info "Ajustando permissões de arquivos (644)..."
sudo find "$ASSETS_BASE" -type f -exec chmod 644 {} \;
print_success "Arquivos: 644"

# Garantir que diretórios são executáveis (necessário para navegar)
print_info "Garantindo que diretórios são navegáveis..."
sudo find "$ASSETS_BASE" -type d -exec chmod +x {} \;
print_success "Diretórios são navegáveis"

# Testar acesso
print_info "Testando acesso..."
TEST_FILE="$ASSETS_BASE/uploads/subscriber-1/medias/Cestto_00005.png"
if [ -f "$TEST_FILE" ]; then
    if sudo -u www-data test -r "$TEST_FILE" 2>/dev/null || sudo -u nginx test -r "$TEST_FILE" 2>/dev/null; then
        print_success "Arquivo de teste é acessível pelo Nginx"
    else
        print_warning "Arquivo pode não ser acessível (verificando permissões)..."
        ls -la "$TEST_FILE" | head -1
    fi
fi

# Recarregar Nginx
print_info "Recarregando Nginx..."
if sudo systemctl reload nginx 2>/dev/null; then
    print_success "Nginx recarregado"
else
    print_warning "Não foi possível recarregar Nginx automaticamente"
    print_info "Execute manualmente: sudo systemctl reload nginx"
fi

print_success "Concluído!"
print_info "Teste acessando: http://192.168.1.110/assets/uploads/subscriber-1/medias/Cestto_00005.png"
