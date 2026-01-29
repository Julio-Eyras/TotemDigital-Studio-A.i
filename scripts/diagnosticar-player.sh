#!/bin/bash
# Script de diagnóstico para verificar problemas com arquivos JS do player
# Uso: bash scripts/diagnosticar-player.sh

set -e

PLAYER_DIR="/opt/smart-signage/player-web"
NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"
SERVER_IP="192.168.1.110"

echo "🔍 Diagnóstico do Player - Arquivos JS"
echo "========================================"
echo ""

# 1. Verificar se diretório existe
echo "1️⃣ Verificando diretório do player..."
if [ -d "$PLAYER_DIR" ]; then
    echo "   ✅ Diretório existe: $PLAYER_DIR"
else
    echo "   ❌ Diretório NÃO existe: $PLAYER_DIR"
    exit 1
fi

# 2. Verificar estrutura de arquivos
echo ""
echo "2️⃣ Verificando estrutura de arquivos..."
FILES=(
    "$PLAYER_DIR/index.html"
    "$PLAYER_DIR/js/app.js"
    "$PLAYER_DIR/js/api/client.js"
    "$PLAYER_DIR/js/cache/MediaCacheManager.js"
    "$PLAYER_DIR/js/cache/PlaylistChangeDetector.js"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $(basename $file)"
    else
        echo "   ❌ $(basename $file) - NÃO ENCONTRADO"
        echo "      Caminho esperado: $file"
    fi
done

# 3. Verificar permissões
echo ""
echo "3️⃣ Verificando permissões..."
ls -la "$PLAYER_DIR" | head -5
echo ""
ls -la "$PLAYER_DIR/js" 2>/dev/null | head -5 || echo "   ⚠️ Diretório js/ não encontrado"

# 4. Verificar configuração do Nginx
echo ""
echo "4️⃣ Verificando configuração do Nginx..."
if [ -f "$NGINX_CONFIG" ]; then
    echo "   ✅ Arquivo de configuração encontrado"
    
    echo ""
    echo "   Blocos location /player/ encontrados:"
    grep -A 5 "location /player/" "$NGINX_CONFIG" | head -20
    
    echo ""
    echo "   Verificando try_files..."
    if grep -q "try_files.*/player-web/index.html" "$NGINX_CONFIG"; then
        echo "   ❌ PROBLEMA ENCONTRADO: try_files ainda usa /player-web/index.html"
        echo "   Execute: sudo bash scripts/corrigir-nginx-player.sh"
    else
        echo "   ✅ try_files está correto"
    fi
    
    echo ""
    echo "   Verificando index..."
    if grep -A 3 "location /player/" "$NGINX_CONFIG" | grep -q "index index.html"; then
        echo "   ✅ index index.html presente"
    else
        echo "   ⚠️ index index.html não encontrado (pode não ser necessário)"
    fi
else
    echo "   ❌ Arquivo de configuração não encontrado: $NGINX_CONFIG"
fi

# 5. Testar acesso direto ao backend (porta 3000)
echo ""
echo "5️⃣ Testando acesso direto ao backend (porta 3000)..."
echo "   Testando: http://127.0.0.1:3000/player/js/app.js"
if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/player/js/app.js" | grep -q "200"; then
    echo "   ✅ Backend está servindo corretamente"
else
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/player/js/app.js")
    echo "   ❌ Backend retornou: $HTTP_CODE"
fi

# 6. Testar acesso via Nginx (porta 80)
echo ""
echo "6️⃣ Testando acesso via Nginx (porta 80)..."
echo "   Testando: http://$SERVER_IP/player/js/app.js"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$SERVER_IP/player/js/app.js")
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Nginx está servindo corretamente"
else
    echo "   ❌ Nginx retornou: $HTTP_CODE"
    echo ""
    echo "   Testando outros arquivos:"
    for file in "js/api/client.js" "js/cache/MediaCacheManager.js" "js/cache/PlaylistChangeDetector.js"; do
        CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$SERVER_IP/player/$file")
        echo "   - /player/$file: $CODE"
    done
fi

# 7. Verificar logs do backend
echo ""
echo "7️⃣ Últimas linhas dos logs do backend (se disponível)..."
if [ -f "/var/log/smart-signage/backend.log" ]; then
    echo "   Últimas 5 linhas relacionadas a arquivos estáticos:"
    grep -i "static\|player\|js" /var/log/smart-signage/backend.log | tail -5 || echo "   Nenhuma linha encontrada"
else
    echo "   ⚠️ Arquivo de log não encontrado"
fi

# 8. Verificar logs do Nginx
echo ""
echo "8️⃣ Verificando logs do Nginx..."
if [ -f "/var/log/nginx/error.log" ]; then
    echo "   Últimas 5 linhas de erro relacionadas a /player:"
    grep "/player" /var/log/nginx/error.log | tail -5 || echo "   Nenhum erro encontrado"
else
    echo "   ⚠️ Arquivo de log não encontrado"
fi

echo ""
echo "========================================"
echo "✅ Diagnóstico concluído"
echo ""
echo "Se os arquivos existem mas retornam 404 via Nginx:"
echo "  1. Execute: sudo bash scripts/corrigir-nginx-player.sh"
echo "  2. Ou edite manualmente: sudo nano $NGINX_CONFIG"
echo "  3. Depois: sudo nginx -t && sudo systemctl reload nginx"
