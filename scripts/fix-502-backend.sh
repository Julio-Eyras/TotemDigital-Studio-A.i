#!/usr/bin/env bash
# Corrige 502 no login: garante backend a correr na porta 3000 e Nginx a fazer proxy.
# Executar NO SERVIDOR (192.168.1.110): ./scripts/fix-502-backend.sh

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# Suportar install em home ou em /opt
if [[ -d "$REPO_DIR/backend" ]]; then
  INSTALL_DIR="$REPO_DIR"
else
  INSTALL_DIR="/opt/smart-signage"
fi
if [[ ! -d "$INSTALL_DIR/backend" ]]; then
  echo -e "${RED}Erro: backend não encontrado em $REPO_DIR nem em $INSTALL_DIR${NC}"
  exit 1
fi

echo -e "${YELLOW}[1/6] Diretório do projeto: $INSTALL_DIR${NC}"

# 1) Compilar backend se necessário
if [[ ! -f "$INSTALL_DIR/backend/dist/index.js" ]]; then
  echo -e "${YELLOW}[2/6] Compilando backend...${NC}"
  (cd "$INSTALL_DIR/backend" && npm run build) || { echo -e "${RED}Falha ao compilar backend.${NC}"; exit 1; }
else
  echo -e "${GREEN}[2/6] Backend já compilado (dist/index.js)${NC}"
fi

# 2) Criar e iniciar serviço systemd se não existir
if [[ ! -f /etc/systemd/system/smart-signage.service ]]; then
  echo -e "${YELLOW}[3/6] Criando smart-signage.service...${NC}"
  "$SCRIPT_DIR/create-smart-signage-service.sh" "$INSTALL_DIR"
else
  echo -e "${GREEN}[3/6] Serviço systemd já existe${NC}"
fi

sudo systemctl daemon-reload
echo -e "${YELLOW}[4/6] Iniciando backend...${NC}"
sudo systemctl enable smart-signage 2>/dev/null || true
sudo systemctl restart smart-signage

# 3) Esperar backend responder na porta 3000
for i in {1..15}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null | grep -q 200; then
    echo -e "${GREEN}[5/6] Backend a responder em http://localhost:3000${NC}"
    break
  fi
  if [[ $i -eq 15 ]]; then
    echo -e "${RED}Backend não respondeu em 30s. Logs:${NC}"
    sudo journalctl -u smart-signage -n 30 --no-pager
    exit 1
  fi
  sleep 2
done

# 4) Verificar Nginx: proxy_pass deve ser localhost:3000
NGINX_CONF="/etc/nginx/sites-available/smart-signage"
if [[ -f "$NGINX_CONF" ]]; then
  if ! sudo grep -q "proxy_pass http://localhost:3000" "$NGINX_CONF"; then
    echo -e "${YELLOW}[6/6] Nginx: proxy_pass não aponta para 3000. Corrija manualmente o ficheiro $NGINX_CONF e execute: sudo nginx -t && sudo systemctl reload nginx${NC}"
  else
    echo -e "${GREEN}[6/6] Nginx config OK (proxy para 3000)${NC}"
    sudo nginx -t 2>/dev/null && sudo systemctl reload nginx 2>/dev/null || true
  fi
else
  echo -e "${YELLOW}[6/6] Nginx config não encontrado em $NGINX_CONF${NC}"
fi

# Teste final
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/health" 2>/dev/null || echo "000")
if [[ "$CODE" == "200" ]]; then
  echo -e "${GREEN}✅ Backend OK. Teste o login em http://$(hostname -I | awk '{print $1}') com admin / admin123${NC}"
else
  echo -e "${RED}❌ Backend ainda não responde (HTTP $CODE). Ver: sudo journalctl -u smart-signage -f${NC}"
  exit 1
fi
