#!/bin/bash
# Script para corrigir configuração do Nginx para servir arquivos JS do player corretamente
# Uso: sudo bash scripts/corrigir-nginx-player.sh

set -e

NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"

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
#    Usar awk para processar linha por linha
awk '
    /location \/player\/ \{/ {
        in_player_block = 1
        has_index = 0
        print
        next
    }
    in_player_block {
        if (/index index\.html/) {
            has_index = 1
        }
        if (/alias.*player-web\/;/) {
            print
            if (!has_index) {
                print "            index index.html;"
                has_index = 1
            }
            next
        }
        if (/\}/) {
            in_player_block = 0
            has_index = 0
        }
        print
        next
    }
    { print }
' "$NGINX_CONFIG" > "${NGINX_CONFIG}.tmp" && mv "${NGINX_CONFIG}.tmp" "$NGINX_CONFIG"

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
