#!/bin/bash
# Script de correção rápida de permissões e caminhos

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🔧 Correção Rápida de Permissões e Caminhos${NC}"
echo ""

# 1. Corrigir permissões do diretório de logs
echo -e "${YELLOW}1. Corrigindo permissões do diretório de logs...${NC}"
LOGS_DIR="/opt/smart-signage/Logs"
if [[ ! -d "$LOGS_DIR" ]]; then
    echo "   Criando diretório: $LOGS_DIR"
    sudo mkdir -p "$LOGS_DIR"
fi
sudo chown -R "$USER:$USER" "$LOGS_DIR" 2>/dev/null || chown -R "$USER:$USER" "$LOGS_DIR" 2>/dev/null || true
sudo chmod 755 "$LOGS_DIR" 2>/dev/null || chmod 755 "$LOGS_DIR" 2>/dev/null || true
echo -e "${GREEN}   ✅ Diretório de logs corrigido${NC}"

# 2. Corrigir configuração no banco
echo -e "${YELLOW}2. Corrigindo configuração media.storage.path no banco...${NC}"
sudo -u postgres psql -d smartsignage -c "
UPDATE system_settings 
SET setting_value = '/opt/smart-signage/public/assets/uploads',
    default_value = '/opt/smart-signage/public/assets/uploads',
    updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'media.storage.path';
" >/dev/null 2>&1 && echo -e "${GREEN}   ✅ Configuração atualizada${NC}" || echo -e "${RED}   ⚠️  Erro ao atualizar (pode não existir ainda)${NC}"

# 3. Corrigir permissões dos diretórios de uploads
echo -e "${YELLOW}3. Corrigindo permissões dos diretórios de uploads...${NC}"
UPLOADS_DIR="/opt/smart-signage/public/assets/uploads"
if [[ ! -d "$UPLOADS_DIR" ]]; then
    echo "   Criando diretório: $UPLOADS_DIR"
    sudo mkdir -p "$UPLOADS_DIR"
fi
sudo chown -R "$USER:$USER" "$UPLOADS_DIR" 2>/dev/null || chown -R "$USER:$USER" "$UPLOADS_DIR" 2>/dev/null || true
sudo chmod -R 755 "$UPLOADS_DIR" 2>/dev/null || chmod -R 755 "$UPLOADS_DIR" 2>/dev/null || true
sudo find "$UPLOADS_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
echo -e "${GREEN}   ✅ Permissões de uploads corrigidas${NC}"

# 4. Reiniciar serviço
echo -e "${YELLOW}4. Reiniciando serviço...${NC}"
sudo systemctl restart smart-signage
sleep 3
if systemctl is-active --quiet smart-signage; then
    echo -e "${GREEN}   ✅ Serviço reiniciado com sucesso${NC}"
else
    echo -e "${RED}   ❌ Serviço não está rodando. Verifique logs:${NC}"
    echo "   sudo journalctl -u smart-signage -n 50"
fi

echo ""
echo -e "${GREEN}✅ Correção concluída!${NC}"

