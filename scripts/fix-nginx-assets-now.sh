#!/bin/bash
# Script para corrigir Nginx - mudar alias para proxy_pass
# Execute com: sudo ./scripts/fix-nginx-assets-now.sh

set -e

NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"

echo "🔧 Corrigindo configuração do Nginx..."

# Criar backup
BACKUP="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$NGINX_CONFIG" "$BACKUP"
echo "✅ Backup criado: $BACKUP"

# Usar Python para fazer substituição precisa
python3 << 'PYTHON_EOF'
import re
import sys
from datetime import datetime

config_file = "/etc/nginx/sites-available/smart-signage"

try:
    with open(config_file, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Padrão mais específico: location /assets/ seguido de alias
    # Captura todo o bloco location até o fechamento }
    pattern = r'(location\s+/assets/\s*\{[^\}]*?)alias\s+/opt/smart-signage/public/assets/;([^\}]*?)(\})'
    
    def replace_block(match):
        before_alias = match.group(1)
        after_alias = match.group(2)
        closing_brace = match.group(3)
        
        # Remover expires e add_header se já existirem (vamos adicionar depois)
        after_alias = re.sub(r'\s*expires\s+[^;]+;', '', after_alias)
        after_alias = re.sub(r'\s*add_header\s+Cache-Control\s+[^;]+;', '', after_alias)
        
        replacement = f'''{before_alias}proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 1y;
        add_header Cache-Control "public, immutable";{after_alias}{closing_brace}'''
        
        return replacement
    
    new_content = re.sub(pattern, replace_block, content, flags=re.DOTALL | re.MULTILINE)
    
    if new_content != original_content:
        with open(config_file, 'w') as f:
            f.write(new_content)
        print("✅ Configuração atualizada com sucesso!")
        print(f"   {len(re.findall(pattern, original_content, flags=re.DOTALL))} bloco(s) location /assets/ atualizado(s)")
        sys.exit(0)
    else:
        print("ℹ️  Nenhuma alteração necessária")
        print("   (já está usando proxy_pass ou formato diferente)")
        sys.exit(0)
        
except Exception as e:
    print(f"❌ Erro: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
PYTHON_EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "🧪 Testando configuração..."
    if nginx -t; then
        echo "✅ Configuração válida!"
        echo ""
        echo "🔄 Recarregando Nginx..."
        systemctl reload nginx
        echo "✅ Nginx recarregado!"
        echo ""
        echo "🧪 Teste o acesso:"
        echo "   curl -I http://localhost/assets/uploads/subscriber-1/medias/Cestto_00005.png"
    else
        echo "❌ Erro na configuração! Restaurando backup..."
        cp "$BACKUP" "$NGINX_CONFIG"
        echo "Backup restaurado."
        exit 1
    fi
else
    echo "❌ Falha ao atualizar configuração"
    exit 1
fi
