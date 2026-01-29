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
# Substituir try_files que usa /player-web/index.html por /index.html
sed -i 's|try_files \$uri \$uri/ /player-web/index.html;|try_files $uri $uri/ /index.html;|g' "$NGINX_CONFIG"

# Garantir que todos os blocos /player/ tenham index index.html;
# Se não tiver, adicionar após o alias
sed -i '/location \/player\/ {/,/}/ {
    /alias.*player-web/ {
        N
        /index index.html/! {
            a\
            index index.html;
        }
    }
}' "$NGINX_CONFIG"

# Método mais simples: usar perl para garantir que index está presente
perl -i -pe '
    if (/location \/player\/ \{/) {
        $in_block = 1;
        $has_index = 0;
        $has_alias = 0;
    }
    if ($in_block) {
        $has_index = 1 if /index index\.html/;
        $has_alias = 1 if /alias.*player-web/;
        if (/\}/ && $has_alias && !$has_index) {
            s/(alias.*player-web\/;)/$1\n            index index.html;/;
        }
        $in_block = 0 if /\}/;
    }
' "$NGINX_CONFIG"

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
