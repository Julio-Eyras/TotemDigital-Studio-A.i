#!/bin/bash
# Script para corrigir configuração do Nginx para servir arquivos JS do player corretamente
# Muda de alias para proxy_pass para o backend Express
# Uso: sudo bash scripts/corrigir-nginx-player.sh

set -e

NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"

echo "🔧 Corrigindo configuração do Nginx para o player..."
echo "   Mudando de 'alias' para 'proxy_pass' (backend Express serve os arquivos)"

# Verificar se arquivo existe
if [ ! -f "$NGINX_CONFIG" ]; then
    echo "❌ Arquivo de configuração não encontrado: $NGINX_CONFIG"
    exit 1
fi

# Backup
BACKUP_FILE="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$NGINX_CONFIG" "$BACKUP_FILE"
echo "✅ Backup criado: $BACKUP_FILE"

# Criar arquivo temporário com a configuração corrigida
TEMP_FILE="${NGINX_CONFIG}.tmp"

# Usar awk para processar o arquivo e substituir blocos /player/ que usam alias
awk '
    BEGIN {
        in_player_block = 0
        player_block_start = 0
        indent = ""
    }
    
    # Detectar início de bloco /player/ com alias
    /location\s+\/player/ {
        # Verificar se é um bloco que usa alias (próximas linhas)
        in_player_block = 1
        player_block_start = NR
        indent = ""
        match($0, /^[ \t]*/)
        indent = substr($0, 1, RLENGTH)
        print
        next
    }
    
    # Se estamos em um bloco /player/ e encontramos alias, substituir todo o bloco
    in_player_block && /alias.*player-web/ {
        # Substituir todo o bloco por configuração de proxy
        print indent "# Player - Proxy para backend Express (serve arquivos estáticos corretamente)"
        print indent "location /player {"
        print indent "    proxy_pass http://localhost:3000;"
        print indent "    proxy_http_version 1.1;"
        print indent "    proxy_set_header Upgrade \\$http_upgrade;"
        print indent "    proxy_set_header Connection '\''upgrade'\'';"
        print indent "    proxy_set_header Host \\$host;"
        print indent "    proxy_set_header X-Real-IP \\$remote_addr;"
        print indent "    proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;"
        print indent "    proxy_set_header X-Forwarded-Proto \\$scheme;"
        print indent "    proxy_cache_bypass \\$http_upgrade;"
        print indent "    proxy_read_timeout 300s;"
        print indent "    proxy_connect_timeout 75s;"
        print indent "    # Buffers maiores para player (arquivos JS podem ser grandes)"
        print indent "    proxy_buffer_size 256k;"
        print indent "    proxy_buffers 8 512k;"
        print indent "    proxy_busy_buffers_size 512k;"
        print indent "    proxy_temp_file_write_size 512k;"
        print indent "}"
        
        # Pular linhas até encontrar o fechamento do bloco
        skip_until_brace = 1
        next
    }
    
    # Se estamos pulando linhas do bloco antigo
    skip_until_brace && /\}/ {
        skip_until_brace = 0
        in_player_block = 0
        next
    }
    
    # Se estamos pulando linhas, ignorar
    skip_until_brace {
        next
    }
    
    # Se encontramos fechamento de bloco e estávamos em um bloco /player/
    in_player_block && /\}/ {
        in_player_block = 0
        print
        next
    }
    
    # Linhas normais
    {
        print
    }
' "$NGINX_CONFIG" > "$TEMP_FILE"

# Verificar se a substituição funcionou (deve ter menos linhas com "alias.*player-web")
OLD_ALIAS_COUNT=$(grep -c "alias.*player-web" "$NGINX_CONFIG" || echo "0")
NEW_ALIAS_COUNT=$(grep -c "alias.*player-web" "$TEMP_FILE" || echo "0")

if [ "$NEW_ALIAS_COUNT" -lt "$OLD_ALIAS_COUNT" ]; then
    mv "$TEMP_FILE" "$NGINX_CONFIG"
    echo "✅ Configuração corrigida: $OLD_ALIAS_COUNT -> $NEW_ALIAS_COUNT blocos com alias"
else
    echo "⚠️ Método automático não funcionou completamente. Aplicando substituição manual..."
    rm -f "$TEMP_FILE"
    
    # Método alternativo: substituição direta com sed/perl
    # Remover blocos location = /player que redirecionam
    sed -i '/location = \/player {/,/}/d' "$NGINX_CONFIG"
    
    # Substituir blocos location /player/ que usam alias
    perl -i -0pe 's/location\s+\/player\/\s+\{[^}]*alias[^}]*\}/location \/player {\n        proxy_pass http:\/\/localhost:3000;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade \$http_upgrade;\n        proxy_set_header Connection '\''upgrade'\'';\n        proxy_set_header Host \$host;\n        proxy_set_header X-Real-IP \$remote_addr;\n        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto \$scheme;\n        proxy_cache_bypass \$http_upgrade;\n        proxy_read_timeout 300s;\n        proxy_connect_timeout 75s;\n        proxy_buffer_size 256k;\n        proxy_buffers 8 512k;\n        proxy_busy_buffers_size 512k;\n        proxy_temp_file_write_size 512k;\n    }/gs' "$NGINX_CONFIG"
    
    echo "✅ Substituição manual aplicada"
fi

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
    echo "O Nginx agora faz proxy para o backend Express na porta 3000."
    echo "O backend Express serve os arquivos estáticos do player corretamente."
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
