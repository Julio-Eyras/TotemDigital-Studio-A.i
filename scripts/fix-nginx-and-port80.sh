#!/usr/bin/env bash
# =============================================================================
# SmartSignage Pro - Nginx e porta 80 (uso exclusivo desta aplicação)
# Portas e serviços (80, 3000, 5432, 6379) são dedicados ao SmartSignage Pro.
# Execute no servidor: bash scripts/fix-nginx-and-port80.sh
# =============================================================================

set -e

for _ss_env in /opt/smart-signage/.env "${PWD}/.env"; do
    if [[ -f "$_ss_env" ]] && grep -qE '^SMARTSIGNAGE_NGINX_SPLIT=true' "$_ss_env" 2>/dev/null; then
        echo "AVISO: Este servidor usa layout Nginx dividido (site corporativo + painel em portas distintas)."
        echo "  O ficheiro $_ss_env contém SMARTSIGNAGE_NGINX_SPLIT=true."
        echo "  NÃO execute este script: ele força Smart Signage na porta 80 e pode apagar o site corporativo."
        echo "  Ajuste Nginx manualmente ou volte a correr o instalador."
        exit 2
    fi
done

echo "=== Nginx e porta 80 (uso exclusivo SmartSignage Pro) ==="

# 1. Nginx instalado?
if ! command -v nginx &>/dev/null; then
    echo "Nginx não encontrado. Instalando..."
    sudo apt-get update -qq
    sudo apt-get install -y nginx
fi

# 2. Configuração exclusiva: único server na porta 80 para esta aplicação
CONF_EXCLUSIVA="/etc/nginx/conf.d/smart-signage-port80.conf"
echo "Aplicando configuração exclusiva em $CONF_EXCLUSIVA..."
sudo tee "$CONF_EXCLUSIVA" <<'NGINX'
# SmartSignage Pro - uso exclusivo da aplicação (porta 80)
# Inclui: frontend (admin), /api, /player, /ws, /assets
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root /opt/smart-signage/frontend/build;
    index index.html;
    client_max_body_size 500M;

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # WebSocket (logs, monitor)
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Player (todo /player e /player/* vão para o backend)
    location ^~ /player {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_buffer_size 256k;
        proxy_buffers 8 512k;
        proxy_busy_buffers_size 512k;
        proxy_temp_file_write_size 512k;
    }

    # Uploads e ficheiros estáticos (backend ou alias)
    location /assets/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend SPA (admin)
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

# 3. Remover site default e outros em sites-enabled que usem porta 80 (uso exclusivo)
if [[ -f /etc/nginx/sites-enabled/default ]]; then
    echo "Removendo site default (porta 80 exclusiva para SmartSignage)..."
    sudo rm -f /etc/nginx/sites-enabled/default
fi
for f in /etc/nginx/sites-enabled/*; do
    [[ -e "$f" ]] || continue
    if sudo grep -qE "listen\s+80\s|listen\s+\[::\]:80" "$f" 2>/dev/null; then
        echo "Desativando $f (porta 80 exclusiva)..."
        sudo rm -f "$f"
    fi
done

# 4. Testar configuração
if ! sudo nginx -t 2>/dev/null; then
    echo "Erro na configuração do Nginx. Verifique: sudo nginx -t"
    exit 1
fi

# 5. Iniciar e ativar Nginx
echo "Iniciando Nginx..."
sudo systemctl enable nginx 2>/dev/null || true
sudo systemctl start nginx 2>/dev/null || true
sudo systemctl restart nginx 2>/dev/null || true
sleep 2

if ! systemctl is-active --quiet nginx; then
    echo "Falha ao iniciar Nginx. Ver: sudo systemctl status nginx"
    sudo systemctl status nginx --no-pager -l || true
    exit 1
fi

# 6. Firewall: permitir porta 80
if command -v ufw &>/dev/null; then
    if sudo ufw status 2>/dev/null | grep -q "Status: active"; then
        echo "Abrindo porta 80 no firewall..."
        sudo ufw allow 80/tcp 2>/dev/null || true
        sudo ufw reload 2>/dev/null || true
    fi
fi

# 7. Verificar se algo está a escutar na porta 80
echo ""
echo "=== Estado final ==="
if ss -tlnp 2>/dev/null | grep -q ":80 "; then
    echo "OK: Algo está a escutar na porta 80:"
    ss -tlnp | grep ":80 "
else
    echo "AVISO: Nada a escutar na porta 80. Verifique: sudo systemctl status nginx"
fi

echo ""
echo "Teste no browser: http://$(hostname -I | awk '{print $1}')"
echo "Ou: curl -I http://127.0.0.1/"
