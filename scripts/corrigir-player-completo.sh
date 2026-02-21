#!/bin/bash
# Script de correção do player (404 em /player/js/*, etc.).
# NOTA: Com uma instalação feita por install-smartsignage.sh o player já deve funcionar;
#       use este script apenas para instalações antigas ou quando o Nginx/player foram alterados à mão.
# Uso: sudo bash scripts/corrigir-player-completo.sh

set -e

# Exige root (Nginx e /opt/smart-signage exigem permissão de administrador)
if [ "$(id -u)" -ne 0 ]; then
    echo "❌ Este script precisa ser executado como root."
    echo "   Use: sudo bash $0"
    echo "   Ou:  sudo ./corrigir-player-completo.sh"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLAYER_DIR="/opt/smart-signage/player-web"
SOURCE_PLAYER="$REPO_DIR/player-web"

echo "🔧 CORREÇÃO COMPLETA DO PLAYER"
echo "=============================="
echo ""

# 0. Copiar player-web do repositório se faltar em /opt
echo "0️⃣ Verificando arquivos do player em $PLAYER_DIR..."
if [ ! -d "$PLAYER_DIR" ]; then
    sudo mkdir -p "$PLAYER_DIR"
fi
if [ -d "$SOURCE_PLAYER" ] && [ -f "$SOURCE_PLAYER/index.html" ] && [ -f "$SOURCE_PLAYER/js/app.js" ]; then
    NEED_COPY=false
    for f in index.html js/app.js js/api/client.js js/cache/MediaCacheManager.js js/cache/PlaylistChangeDetector.js; do
        if [ ! -f "$PLAYER_DIR/$f" ]; then
            NEED_COPY=true
            break
        fi
    done
    if [ "$NEED_COPY" = true ]; then
        echo "   🔄 Copiando player-web do repositório ($SOURCE_PLAYER) para $PLAYER_DIR..."
        sudo cp -a "$SOURCE_PLAYER"/* "$PLAYER_DIR/" 2>/dev/null || sudo cp -r "$SOURCE_PLAYER"/* "$PLAYER_DIR/"
        if id www-data &>/dev/null; then
            sudo chown -R www-data:www-data "$PLAYER_DIR" 2>/dev/null || true
        fi
        echo "   ✅ Cópia concluída"
    fi
else
    echo "   ⚠️ Repositório sem player-web em $SOURCE_PLAYER (execute o script a partir do repo)"
fi

# 1. Verificar se arquivos existem
echo ""
echo "1️⃣ Verificando arquivos do player..."
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
    echo "   ❌ Arquivos obrigatórios faltando. Copie player-web para $PLAYER_DIR e execute o install ou este script de novo."
    exit 1
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

# Garantir location ^~ /player (evita que /player/js/* caia em regex .js e dê 404)
if ! grep -q "location ^~ /player " "$NGINX_CONFIG" 2>/dev/null; then
    if grep -q "location /player {" "$NGINX_CONFIG"; then
        echo "   🔄 Adicionando ^~ em location /player (evita 404 em /player/js/*)..."
        sed -i 's/location \/player {/location ^~ \/player {/g' "$NGINX_CONFIG"
        echo "   ✅ location ^~ /player aplicado"
    else
        echo "   ⚠️ Bloco 'location /player' não encontrado no Nginx. Verifique o config."
    fi
else
    echo "   ✅ Nginx já tem location ^~ /player"
fi

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

# 5. Verificar se backend está rodando e reiniciar (para servir player-web)
echo ""
echo "5️⃣ Verificando backend..."
if systemctl is-active --quiet smart-signage 2>/dev/null; then
    echo "   ✅ Backend (smart-signage) está rodando. Reiniciando..."
    sudo systemctl restart smart-signage
elif systemctl is-active --quiet smart-signage-backend 2>/dev/null; then
    echo "   ✅ Backend (smart-signage-backend) está rodando. Reiniciando..."
    sudo systemctl restart smart-signage-backend
elif pgrep -f "node.*backend" > /dev/null; then
    echo "   ⚠️ Backend rodando em processo. Reinicie manualmente para garantir:"
    echo "      sudo systemctl restart smart-signage"
else
    echo "   ⚠️ Backend não está rodando. Inicie: sudo systemctl start smart-signage"
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
echo "2. Os arquivos JS devem carregar sem 404 (F12 > Console)"
echo ""
echo "Se ainda der 404 em /player/js/*:"
echo "  bash $SCRIPT_DIR/diagnosticar-404-player.sh"
echo "  (e confira se Nginx tem 'location ^~ /player' e player-web em $PLAYER_DIR)"
echo ""
echo "Logs: tail -f /var/log/nginx/error.log  ou  journalctl -u smart-signage -f"
