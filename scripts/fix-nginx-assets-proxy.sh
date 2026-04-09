#!/bin/bash
# =============================================
# SmartSignage Pro - Corrigir Nginx para Proxy Assets
# Muda de alias direto para proxy para backend (resolve problema de permissões)
# =============================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"

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

# Verificar se arquivo existe
if [ ! -f "$NGINX_CONFIG" ]; then
    print_error "Arquivo de configuração não encontrado: $NGINX_CONFIG"
    exit 1
fi

print_info "Verificando configuração atual do Nginx..."

# Verificar se já está usando proxy
if grep -q "location /assets/" "$NGINX_CONFIG" && grep -A 2 "location /assets/" "$NGINX_CONFIG" | grep -q "proxy_pass"; then
    print_success "Nginx já está configurado para fazer proxy de /assets/"
    print_info "Nenhuma alteração necessária"
    exit 0
fi

# Verificar se está usando alias
if grep -q "location /assets/" "$NGINX_CONFIG" && grep -A 2 "location /assets/" "$NGINX_CONFIG" | grep -q "alias"; then
    print_info "Nginx está usando alias direto. Mudando para proxy..."
    
    # Criar backup
    BACKUP_FILE="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
    sudo cp "$NGINX_CONFIG" "$BACKUP_FILE"
    print_success "Backup criado: $BACKUP_FILE"
    
    # Substituir alias por proxy_pass
    # Usar sed para substituir blocos location /assets/
    sudo sed -i '/location \/assets\/ {/,/}/ {
        /alias.*assets/ {
            a\
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        d
        }
        /expires/ {
            a\
        expires 1y;
        add_header Cache-Control "public, immutable";
        }
    }' "$NGINX_CONFIG"
    
    # Alternativa: usar Python para fazer substituição mais precisa
    python3 << 'PYTHON_SCRIPT'
import re
import sys

config_file = "/etc/nginx/sites-available/smart-signage"

try:
    with open(config_file, 'r') as f:
        content = f.read()
    
    # Padrão para location /assets/ com alias
    pattern = r'(location /assets/ \{[^}]*?)alias\s+/opt/smart-signage/public/assets/;([^}]*?\})'
    
    replacement = r'''\1proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;\2'''
    
    new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    if new_content != content:
        with open(config_file, 'w') as f:
            f.write(new_content)
        print("Configuração atualizada com sucesso")
        sys.exit(0)
    else:
        print("Nenhuma alteração necessária")
        sys.exit(0)
        
except Exception as e:
    print(f"Erro: {e}")
    sys.exit(1)
PYTHON_SCRIPT
    
    if [ $? -eq 0 ]; then
        print_success "Configuração atualizada!"
        
        # Testar configuração
        print_info "Testando configuração do Nginx..."
        if sudo nginx -t 2>/dev/null; then
            print_success "Configuração válida!"
            
            # Recarregar Nginx
            print_info "Recarregando Nginx..."
            if sudo systemctl reload nginx 2>/dev/null; then
                print_success "Nginx recarregado com sucesso!"
                print_info "Assets agora são servidos via proxy para o backend"
            else
                print_warning "Não foi possível recarregar Nginx automaticamente"
                print_info "Execute: sudo systemctl reload nginx"
            fi
        else
            print_error "Erro na configuração do Nginx!"
            print_info "Restaurando backup..."
            sudo cp "$BACKUP_FILE" "$NGINX_CONFIG"
            print_info "Backup restaurado. Verifique a configuração manualmente."
            exit 1
        fi
    else
        print_error "Falha ao atualizar configuração"
        exit 1
    fi
else
    print_warning "Configuração de /assets/ não encontrada ou formato inesperado"
    print_info "Verifique manualmente: $NGINX_CONFIG"
    exit 1
fi

print_success "Concluído!"
