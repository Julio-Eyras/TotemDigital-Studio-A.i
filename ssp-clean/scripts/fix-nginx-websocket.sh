#!/bin/bash
# Corrige apenas o proxy WebSocket (/ws) no Nginx, sem refazer a instalação.
# Use quando o monitor mostrar "Error during WebSocket handshake: Unexpected response code: 200".
# Requer: sudo

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKEND_PORT="${BACKEND_PORT:-3000}"
if [[ -f "/opt/smart-signage/.env" ]]; then
  _p=$(grep -E '^BACKEND_PORT=' /opt/smart-signage/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)
  [[ -n "$_p" ]] && BACKEND_PORT="$_p"
fi

# Se NGINX_CONFIG foi passado (ex.: /etc/nginx/sites-available/default), usar
if [[ -n "$NGINX_CONFIG" ]] && [[ -f "$NGINX_CONFIG" ]]; then
  :
elif [[ -n "$NGINX_CONFIG" ]]; then
  echo -e "${RED}❌ NGINX_CONFIG=$NGINX_CONFIG não existe ou não é arquivo.${NC}"
  exit 1
else
  NGINX_CONFIG=""
  # Preferir o config que o Nginx realmente carrega (sites-enabled)
  for en in /etc/nginx/sites-enabled/smart-signage /etc/nginx/sites-enabled/default; do
    if [[ -L "$en" ]] || [[ -f "$en" ]]; then
      real=$(sudo readlink -f "$en" 2>/dev/null || echo "$en")
      if [[ -f "$real" ]]; then
        NGINX_CONFIG="$real"
        break
      fi
    fi
  done
  for cand in /etc/nginx/sites-available/smart-signage /etc/nginx/conf.d/smart-signage.conf /etc/nginx/sites-available/default; do
    if [[ -z "$NGINX_CONFIG" ]] && [[ -f "$cand" ]]; then
      NGINX_CONFIG="$cand"
      break
    fi
  done
fi

if [[ -z "$NGINX_CONFIG" ]]; then
  echo -e "${RED}❌ Nenhum config Nginx encontrado (smart-signage ou default).${NC}"
  echo "   Para um config específico: NGINX_CONFIG=/caminho/arquivo $0"
  ls -la /etc/nginx/sites-available/ 2>/dev/null || true
  exit 1
fi

echo -e "${GREEN}🔧 Corrigindo proxy WebSocket /ws no Nginx${NC}"
echo -e "   Config: $NGINX_CONFIG | Backend: localhost:$BACKEND_PORT"
echo ""

if sudo grep -q 'location /ws' "$NGINX_CONFIG" 2>/dev/null && sudo grep -A2 'location /ws' "$NGINX_CONFIG" | grep -q 'proxy_pass'; then
  echo -e "${GREEN}✅ O config já inclui 'location /ws' com proxy_pass.${NC}"
  echo "   Recarregando Nginx..."
  if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx 2>/dev/null && echo -e "${GREEN}✅ Nginx recarregado.${NC}" || echo -e "${YELLOW}⚠️  Recarregue manualmente: sudo systemctl reload nginx${NC}"
  fi
  echo -e "${YELLOW}Se ainda aparecer 'Unexpected response code: 200', o pedido pode estar a ser servido por outro server (ex.: acesso por IP usa default_server).${NC}"
  echo "   Adicione o bloco location /ws nesse config também, ou rode: NGINX_CONFIG=/etc/nginx/sites-available/default $0"
  exit 0
fi

BACKUP_FILE="${NGINX_CONFIG}.backup.ws.$(date +%Y%m%d-%H%M%S)"
sudo cp "$NGINX_CONFIG" "$BACKUP_FILE"
echo -e "${GREEN}✅ Backup: $BACKUP_FILE${NC}"

# Inserir bloco location /ws (Python para multi-linha seguro)
# Variáveis passadas por ambiente para o heredoc ser 'PYEOF' (evitar escape de $ no Nginx)
export NGINX_CONFIG
export BACKEND_PORT
sudo -E python3 << 'PYEOF'
import os
import re

config_path = os.environ.get("NGINX_CONFIG", "")
port = os.environ.get("BACKEND_PORT", "3000")

with open(config_path, "r") as f:
    content = f.read()
if "location /ws" in content and "proxy_pass" in content:
    print("Already has location /ws with proxy_pass, skipping insert")
    raise SystemExit(0)

# Bloco Nginx com $ literais (variáveis do Nginx)
block_ws = """    location /ws {
        proxy_pass http://localhost:%s;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

""" % port

# Inserir antes do primeiro "location /"
match = re.search(r"(\s+)(location\s+/\s*\{)", content)
if match:
    content = content.replace(match.group(0), block_ws + match.group(0), 1)
    with open(config_path, "w") as f:
        f.write(content)
    print("Inserted location /ws block before first location /")
else:
    match2 = re.search(r"(server\s*\{)\n", content)
    if match2:
        content = content.replace(match2.group(0), match2.group(0) + block_ws, 1)
        with open(config_path, "w") as f:
            f.write(content)
        print("Inserted location /ws block after server {")
    else:
        print("Could not find insertion point (no 'location /' or 'server {')")
        raise SystemExit(1)
PYEOF

echo -e "${YELLOW}Testando Nginx...${NC}"
if ! sudo nginx -t 2>/dev/null; then
  echo -e "${RED}❌ Config inválido. Restaurando backup.${NC}"
  sudo cp "$BACKUP_FILE" "$NGINX_CONFIG"
  exit 1
fi
echo -e "${YELLOW}Recarregando Nginx...${NC}"
sudo systemctl reload nginx
echo -e "${GREEN}✅ Proxy WebSocket /ws aplicado e Nginx recarregado.${NC}"
echo "   Teste no browser: o monitor não deve mais mostrar 'Unexpected response code: 200'."
echo "   Se o acesso for por IP (ex.: 192.168.1.110) e ainda falhar, pode ser outro server block; rode para o default: sudo NGINX_CONFIG=/etc/nginx/sites-available/default $0"
