#!/bin/bash
# Corrige 404 em /player/js/*: adiciona ^~ em "location /player" para que
# o Nginx não capture /player/js/* pela regex de arquivos estáticos (.js).
# Uso: sudo bash scripts/corrigir-nginx-player-404.sh

set -e

NGINX_CONFIG="${1:-/etc/nginx/sites-available/smart-signage}"

echo "=========================================="
echo "Correção Nginx: location ^~ /player"
echo "=========================================="

if [ ! -f "$NGINX_CONFIG" ]; then
    echo "Arquivo não encontrado: $NGINX_CONFIG"
    exit 1
fi

if grep -q "location ^~ /player " "$NGINX_CONFIG" 2>/dev/null; then
    echo "Config já possui 'location ^~ /player'. Nada a fazer."
    sudo nginx -t 2>/dev/null && sudo systemctl reload nginx 2>/dev/null && echo "Nginx recarregado." || true
    exit 0
fi

# Backup
BACKUP="${NGINX_CONFIG}.bak.$(date +%Y%m%d_%H%M%S)"
cp "$NGINX_CONFIG" "$BACKUP"
echo "Backup: $BACKUP"

# Só trocar "location /player {" por "location ^~ /player {" (não mexe em /player-cache)
if grep -q "location /player {" "$NGINX_CONFIG"; then
    sed -i 's/location \/player {/location ^~ \/player {/g' "$NGINX_CONFIG"
    echo "Substituído: location /player { -> location ^~ /player {"
else
    echo "Padrão 'location /player {' não encontrado. Verifique o arquivo."
    exit 1
fi

if ! sudo nginx -t 2>/dev/null; then
    echo "Erro na config do Nginx. Restaurando backup."
    cp "$BACKUP" "$NGINX_CONFIG"
    exit 1
fi

sudo systemctl reload nginx
echo "Nginx recarregado com sucesso."
echo ""
echo "Teste: curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/player/js/app.js"
echo "Esperado: 200"
echo "=========================================="
