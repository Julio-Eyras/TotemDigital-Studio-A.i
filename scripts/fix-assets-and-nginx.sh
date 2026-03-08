#!/bin/bash
# Fix assets mapping and Nginx config for SmartSignage
# Usage: sudo bash scripts/fix-assets-and-nginx.sh

set -euo pipefail

PROJECT_ROOT="/opt/smart-signage"
PUBLIC_ASSETS="$PROJECT_ROOT/public/assets"
FRONTEND_BUILD_ASSETS="$PROJECT_ROOT/frontend/build/assets"
NGINX_CONF_DIR="/etc/nginx/conf.d"
ASSETS_CONF_FILE="$NGINX_CONF_DIR/smart-signage-assets.conf"

echoinfo(){ echo -e "[INFO] $*"; }
echowarn(){ echo -e "[WARN] $*"; }
echoerr(){ echo -e "[ERROR] $*" >&2; }

if [ "$EUID" -ne 0 ]; then
  echoerr "Este script precisa ser executado como root (sudo)."
  exit 1
fi

echoinfo "1) Verificando existência do diretório de assets públicos..."
if [ ! -d "$PUBLIC_ASSETS" ]; then
  echoerr "Diretório público de assets não encontrado: $PUBLIC_ASSETS"
  exit 1
fi

echoinfo "2) Garantindo link simbólico em frontend/build/assets -> public/assets"
if [ -L "$FRONTEND_BUILD_ASSETS" ]; then
  echoinfo "Link simbólico já existe: $FRONTEND_BUILD_ASSETS"
else
  if [ -e "$FRONTEND_BUILD_ASSETS" ]; then
    echowarn "$FRONTEND_BUILD_ASSETS existe e não é link. Será movido para ${FRONTEND_BUILD_ASSETS}.bak"
    mv "$FRONTEND_BUILD_ASSETS" "${FRONTEND_BUILD_ASSETS}.bak.$(date +%s)"
  fi
  ln -s "$PUBLIC_ASSETS" "$FRONTEND_BUILD_ASSETS"
  echoinfo "Link criado: $FRONTEND_BUILD_ASSETS -> $PUBLIC_ASSETS"
fi

echoinfo "3) Ajustando permissões de leitura para usuário do Nginx (www-data)"
if id -u www-data >/dev/null 2>&1; then
  chown -R www-data:www-data "$PUBLIC_ASSETS" || echowarn "Falha ao chown (continuando)"
else
  echowarn "Usuário www-data não existe - pulando chown"
fi
chmod -R u=rwX,g=rX,o=rX "$PUBLIC_ASSETS" || echowarn "Falha ao chmod (continuando)"

echoinfo "4) Criando configuração Nginx dedicada para servir /assets via alias (conf.d)"
cat > "$ASSETS_CONF_FILE" <<'NGCONF'
#
# SmartSignage static assets alias
#
location ^~ /assets/ {
  alias /opt/smart-signage/public/assets/;
  access_log off;
  expires 7d;
  add_header Cache-Control "public, max-age=604800";
  try_files $uri $uri/ =404;
}
NGCONF

echoinfo "5) Testando configuração do Nginx..."
if nginx -t; then
  echoinfo "Configuração ok. Recarregando Nginx..."
  systemctl reload nginx
  echoinfo "Nginx recarregado com sucesso."
else
  echoerr "Teste do Nginx falhou. Removendo arquivo de configuração criado e abortando."
  rm -f "$ASSETS_CONF_FILE"
  nginx -t || true
  exit 1
fi

echoinfo "Operação concluída. Verifique um arquivo de exemplo:"
echo "  curl -I http://localhost/assets/uploads/subscriber-3/medias/Panvel_ABC-00010.jpg"

exit 0

