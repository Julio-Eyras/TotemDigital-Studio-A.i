#!/bin/bash
# Corrige precedência de /api/ sobre regex de arquivos estáticos no Nginx
# Uso: sudo bash scripts/corrigir-nginx-api-priority.sh

set -e

NGINX_CONFIG="${1:-/etc/nginx/sites-available/smart-signage}"

if [ ! -f "$NGINX_CONFIG" ]; then
    echo "❌ Arquivo não encontrado: $NGINX_CONFIG"
    exit 1
fi

echo "=========================================="
echo "Correção: location ^~ /api/ no Nginx"
echo "=========================================="

# Backup
BACKUP="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$NGINX_CONFIG" "$BACKUP"
echo "✅ Backup criado: $BACKUP"

# Substituir "location /api/" por "location ^~ /api/" em todos os server blocks
if grep -q "location /api/" "$NGINX_CONFIG"; then
    sed -i 's/^[[:space:]]*location \/api\/ {/    location ^~ \/api\/ {/g' "$NGINX_CONFIG"
    echo "✅ Substituído: location /api/ -> location ^~ /api/"
else
    echo "⚠️ Padrão 'location /api/' não encontrado. Verifique o arquivo."
fi

# Verificar configuração
if sudo nginx -t 2>/dev/null; then
    echo "✅ Configuração válida"
    sudo systemctl reload nginx
    echo "✅ Nginx recarregado"
    echo ""
    echo "Teste: curl -I http://127.0.0.1/api/player-static/js/app.js"
    echo "Esperado: HTTP 200"
else
    echo "❌ Erro na configuração. Restaurando backup..."
    cp "$BACKUP" "$NGINX_CONFIG"
    exit 1
fi

echo "=========================================="
