#!/bin/bash
# Script COMPLETO para corrigir TODOS os problemas do player
# Uso: sudo bash scripts/corrigir-player-completo.sh
#
# ⚠️ Use este script APENAS se você NÃO reinstalou do zero.
#    Se reinstalou tudo com install-smartsignage.sh, o player já está correto e não precisa deste script.

set -e

echo "🔧 CORREÇÃO COMPLETA DO PLAYER"
echo "=============================="
echo ""

# 1. Verificar se arquivos existem
echo "1️⃣ Verificando arquivos do player..."
PLAYER_DIR="/opt/smart-signage/player-web"
if [ ! -d "$PLAYER_DIR" ]; then
    echo "   ❌ Diretório não existe: $PLAYER_DIR"
    exit 1
fi

FILES=(
    "$PLAYER_DIR/index.html"
    "$PLAYER_DIR/js/app.js"
    "$PLAYER_DIR/js/api/client.js"
    "$PLAYER_DIR/js/cache/MediaCacheManager.js"
    "$PLAYER_DIR/js/cache/PlaylistChangeDetector.js"
)

MISSING_FILES=()
for file in "${FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
        echo "   ❌ Não encontrado: $file"
    else
        echo "   ✅ $(basename $file)"
    fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "   ⚠️ Alguns arquivos estão faltando!"
fi

# 2. Corrigir Nginx
echo ""
echo "2️⃣ Corrigindo configuração do Nginx..."
NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"

if [ ! -f "$NGINX_CONFIG" ]; then
    echo "   ❌ Arquivo de configuração não encontrado: $NGINX_CONFIG"
    exit 1
fi

# Backup
BACKUP_FILE="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$NGINX_CONFIG" "$BACKUP_FILE"
echo "   ✅ Backup criado: $BACKUP_FILE"

# Verificar se já está usando proxy_pass
if grep -q "location /player" "$NGINX_CONFIG" && grep -A 2 "location /player" "$NGINX_CONFIG" | grep -q "proxy_pass"; then
    echo "   ✅ Nginx já está usando proxy_pass"
else
    echo "   🔄 Aplicando correção do Nginx..."
    
    # Remover blocos antigos com alias
    sed -i '/location = \/player/,/^[[:space:]]*}/d' "$NGINX_CONFIG"
    
    # Substituir blocos location /player/ que usam alias
    perl -i -0pe 's/location\s+\/player\/\s+\{[^}]*alias[^}]*\}/location \/player {\n        proxy_pass http:\/\/localhost:3000;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade \$http_upgrade;\n        proxy_set_header Connection '\''upgrade'\'';\n        proxy_set_header Host \$host;\n        proxy_set_header X-Real-IP \$remote_addr;\n        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto \$scheme;\n        proxy_cache_bypass \$http_upgrade;\n        proxy_read_timeout 300s;\n        proxy_connect_timeout 75s;\n        proxy_buffer_size 256k;\n        proxy_buffers 8 512k;\n        proxy_busy_buffers_size 512k;\n        proxy_temp_file_write_size 512k;\n    }/gs' "$NGINX_CONFIG"
    
    echo "   ✅ Nginx corrigido"
fi

# 3. Testar configuração do Nginx
echo ""
echo "3️⃣ Testando configuração do Nginx..."
if sudo nginx -t; then
    echo "   ✅ Configuração válida"
else
    echo "   ❌ Erro na configuração. Restaurando backup..."
    cp "$BACKUP_FILE" "$NGINX_CONFIG"
    exit 1
fi

# 4. Recarregar Nginx
echo ""
echo "4️⃣ Recarregando Nginx..."
sudo systemctl reload nginx
echo "   ✅ Nginx recarregado"

# 5. Verificar se backend está rodando
echo ""
echo "5️⃣ Verificando backend..."
if systemctl is-active --quiet smart-signage-backend || pgrep -f "node.*backend" > /dev/null; then
    echo "   ✅ Backend está rodando"
    echo "   🔄 Reiniciando backend para aplicar mudanças..."
    if systemctl is-active --quiet smart-signage-backend; then
        sudo systemctl restart smart-signage-backend
    else
        # Se não está como serviço, tentar reiniciar manualmente
        echo "   ⚠️ Backend não está como serviço. Reinicie manualmente:"
        echo "      cd ~/SmartSignage-Pro/backend && npm run build && npm start"
    fi
else
    echo "   ⚠️ Backend não está rodando. Inicie o backend primeiro!"
fi

# 6. Testar acesso
echo ""
echo "6️⃣ Testando acesso aos arquivos..."
SERVER_IP="192.168.1.110"

echo "   Testando backend direto (porta 3000)..."
BACKEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/player/js/app.js" || echo "000")
if [ "$BACKEND_CODE" = "200" ]; then
    echo "   ✅ Backend está servindo corretamente"
else
    echo "   ❌ Backend retornou: $BACKEND_CODE"
fi

echo "   Testando via Nginx (porta 80)..."
NGINX_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$SERVER_IP/player/js/app.js" || echo "000")
if [ "$NGINX_CODE" = "200" ]; then
    echo "   ✅ Nginx está servindo corretamente"
else
    echo "   ❌ Nginx retornou: $NGINX_CODE"
fi

echo ""
echo "=============================="
echo "✅ CORREÇÃO COMPLETA FINALIZADA"
echo ""
echo "Próximos passos:"
echo "1. Acesse: http://$SERVER_IP/player/?uin=UIN-SHOPPING-001-2025"
echo "2. Verifique o console do navegador (F12)"
echo "3. Os arquivos JS devem carregar sem erros 404"
echo ""
echo "Se ainda houver problemas, verifique os logs:"
echo "  - Backend: tail -f /var/log/smart-signage/backend.log"
echo "  - Nginx: tail -f /var/log/nginx/error.log"
