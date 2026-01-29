#!/bin/bash
# Script para corrigir configuração do Nginx para servir arquivos JS do player corretamente
# Uso: sudo bash scripts/corrigir-nginx-player.sh

set -e

NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"
NGINX_ENABLED="/etc/nginx/sites-enabled/smart-signage"

echo "🔧 Corrigindo configuração do Nginx para o player..."

# Verificar se arquivo existe
if [ ! -f "$NGINX_CONFIG" ]; then
    echo "❌ Arquivo de configuração não encontrado: $NGINX_CONFIG"
    exit 1
fi

# Backup
BACKUP_FILE="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$NGINX_CONFIG" "$BACKUP_FILE"
echo "✅ Backup criado: $BACKUP_FILE"

# Corrigir todos os blocos location /player/
# 1. Substituir try_files que usa /player-web/index.html por /index.html
sed -i 's|try_files \$uri \$uri/ /player-web/index.html;|try_files $uri $uri/ /index.html;|g' "$NGINX_CONFIG"

# 2. Garantir que todos os blocos /player/ tenham index index.html;
#    Adicionar após a linha com alias se não existir
python3 << 'PYTHON_SCRIPT'
import re
import sys

config_file = sys.argv[1]

with open(config_file, 'r') as f:
    content = f.read()

# Padrão para encontrar blocos location /player/
pattern = r'(location\s+/player/\s+\{[^}]*?)(alias\s+[^;]+;)([^}]*?)(try_files[^;]+;)'

def fix_block(match):
    block_start = match.group(1)
    alias_line = match.group(2)
    middle = match.group(3)
    try_files = match.group(4)
    
    # Verificar se já tem index
    if 'index index.html' not in middle and 'index index.html' not in block_start:
        # Adicionar index após alias
        return f"{block_start}{alias_line}\n            index index.html;{middle}{try_files}"
    return match.group(0)

# Aplicar correção
fixed_content = re.sub(pattern, fix_block, content, flags=re.DOTALL)

with open(config_file, 'w') as f:
    f.write(fixed_content)
PYTHON_SCRIPT
"$NGINX_CONFIG"

echo "✅ Configuração corrigida"

# Testar configuração
echo "🧪 Testando configuração do Nginx..."
if sudo nginx -t; then
    echo "✅ Configuração válida"
    
    # Recarregar Nginx
    echo "🔄 Recarregando Nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx recarregado com sucesso"
    
    echo ""
    echo "✅ Correção aplicada com sucesso!"
    echo ""
    echo "Teste os arquivos JS:"
    echo "  curl -I http://192.168.1.110/player/js/app.js"
    echo "  curl -I http://192.168.1.110/player/js/api/client.js"
    echo ""
else
    echo "❌ Erro na configuração do Nginx. Restaurando backup..."
    cp "$BACKUP_FILE" "$NGINX_CONFIG"
    echo "✅ Backup restaurado"
    exit 1
fi
