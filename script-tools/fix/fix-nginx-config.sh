#!/bin/bash
# Script para corrigir configuração do Nginx para usar /opt/smart-signage

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🔧 Corrigindo configuração do Nginx...${NC}"
echo ""

# Encontrar arquivo de configuração do Nginx
NGINX_CONFIG=""
if [[ -f "/etc/nginx/sites-available/smart-signage" ]]; then
    NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"
elif [[ -f "/etc/nginx/conf.d/smart-signage.conf" ]]; then
    NGINX_CONFIG="/etc/nginx/conf.d/smart-signage.conf"
else
    echo -e "${RED}❌ Arquivo de configuração do Nginx não encontrado${NC}"
    echo "   Procurando em /etc/nginx/sites-available/..."
    ls -la /etc/nginx/sites-available/ 2>/dev/null || true
    exit 1
fi

echo -e "${YELLOW}Arquivo encontrado: $NGINX_CONFIG${NC}"

# Fazer backup
BACKUP_FILE="${NGINX_CONFIG}.backup.$(date +%Y%m%d-%H%M%S)"
sudo cp "$NGINX_CONFIG" "$BACKUP_FILE"
echo -e "${GREEN}✅ Backup criado: $BACKUP_FILE${NC}"

# Substituir todas as ocorrências de INSTALL_DIR/public/assets por /opt/smart-signage/public/assets
echo -e "${YELLOW}Atualizando configuração...${NC}"
sudo sed -i 's|alias \$INSTALL_DIR/public/assets/|alias /opt/smart-signage/public/assets/|g' "$NGINX_CONFIG"
sudo sed -i 's|alias /home/[^/]*/smartsignage-pro[^/]*/public/assets/|alias /opt/smart-signage/public/assets/|g' "$NGINX_CONFIG"

# Verificar se a substituição funcionou
if grep -q "alias /opt/smart-signage/public/assets/" "$NGINX_CONFIG"; then
    echo -e "${GREEN}✅ Configuração atualizada${NC}"
else
    echo -e "${RED}❌ Erro: configuração não foi atualizada corretamente${NC}"
    exit 1
fi

# Testar configuração
echo -e "${YELLOW}Testando configuração do Nginx...${NC}"
if sudo nginx -t; then
    echo -e "${GREEN}✅ Configuração válida${NC}"
else
    echo -e "${RED}❌ Erro na configuração do Nginx${NC}"
    echo "   Restaurando backup..."
    sudo cp "$BACKUP_FILE" "$NGINX_CONFIG"
    exit 1
fi

# Recarregar Nginx
echo -e "${YELLOW}Recarregando Nginx...${NC}"
if sudo systemctl reload nginx; then
    echo -e "${GREEN}✅ Nginx recarregado com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao recarregar Nginx${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Configuração do Nginx corrigida!${NC}"
echo ""
echo "Verifique se os arquivos estão acessíveis:"
echo "  curl -I http://localhost/assets/uploads/client-1/medias/ff.mp4"

