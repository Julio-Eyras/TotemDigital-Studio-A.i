#!/bin/bash

# Smart Signage Pro v2.0 - Diagnóstico Nginx
# Script para diagnosticar problemas do Nginx e frontend

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTALL_DIR="/opt/smart-signage"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Smart Signage Pro - Diagnóstico Nginx              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo

# 1. Verificar Nginx
echo -e "${YELLOW}[1] Verificando status do Nginx...${NC}"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx está rodando${NC}"
else
    echo -e "${RED}❌ Nginx NÃO está rodando!${NC}"
    sudo systemctl status nginx --no-pager -l | head -20
    exit 1
fi

# 2. Verificar configuração
echo -e "\n${YELLOW}[2] Testando configuração do Nginx...${NC}"
if sudo nginx -t; then
    echo -e "${GREEN}✅ Configuração válida${NC}"
else
    echo -e "${RED}❌ Erro na configuração!${NC}"
    exit 1
fi

# 3. Verificar arquivos do build
echo -e "\n${YELLOW}[3] Verificando arquivos do build...${NC}"
if [[ -f "$INSTALL_DIR/frontend/build/index.html" ]]; then
    echo -e "${GREEN}✅ index.html encontrado${NC}"
    ls -lh "$INSTALL_DIR/frontend/build/index.html"
else
    echo -e "${RED}❌ index.html NÃO encontrado!${NC}"
    exit 1
fi

if [[ -d "$INSTALL_DIR/frontend/build/static" ]]; then
    echo -e "${GREEN}✅ Diretório static encontrado${NC}"
    echo "Arquivos em static/js:"
    ls -lh "$INSTALL_DIR/frontend/build/static/js" | head -5
else
    echo -e "${RED}❌ Diretório static NÃO encontrado!${NC}"
fi

# 4. Verificar permissões
echo -e "\n${YELLOW}[4] Verificando permissões...${NC}"
if sudo -u www-data test -r "$INSTALL_DIR/frontend/build/index.html" 2>/dev/null; then
    echo -e "${GREEN}✅ Nginx (www-data) pode ler index.html${NC}"
else
    echo -e "${RED}❌ Nginx NÃO pode ler index.html!${NC}"
    echo "Ajustando permissões..."
    sudo chmod 644 "$INSTALL_DIR/frontend/build/index.html"
    sudo chmod -R 755 "$INSTALL_DIR/frontend/build"
    sudo chown -R $(whoami):www-data "$INSTALL_DIR/frontend/build"
fi

# 5. Testar HTTP localmente
echo -e "\n${YELLOW}[5] Testando HTTP localmente...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80)
if [[ "$HTTP_CODE" == "200" ]]; then
    echo -e "${GREEN}✅ HTTP 200 OK${NC}"
else
    echo -e "${RED}❌ HTTP $HTTP_CODE${NC}"
fi

# 6. Verificar se JavaScript está sendo servido
echo -e "\n${YELLOW}[6] Verificando se JavaScript está sendo servido...${NC}"
JS_FILE=$(ls "$INSTALL_DIR/frontend/build/static/js/main.*.js" 2>/dev/null | head -1 | xargs basename 2>/dev/null || echo "")
if [[ -n "$JS_FILE" ]]; then
    echo "Arquivo JS encontrado: $JS_FILE"
    JS_PATH="/static/js/$JS_FILE"
    JS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:80$JS_PATH")
    if [[ "$JS_CODE" == "200" ]]; then
        echo -e "${GREEN}✅ JavaScript está sendo servido corretamente (HTTP 200)${NC}"
    else
        echo -e "${RED}❌ JavaScript retornou HTTP $JS_CODE${NC}"
        echo "Tentando acessar: http://localhost:80$JS_PATH"
    fi
else
    echo -e "${YELLOW}⚠️  Nenhum arquivo JS encontrado${NC}"
fi

# 7. Verificar firewall
echo -e "\n${YELLOW}[7] Verificando firewall...${NC}"
if sudo ufw status | grep -q "80/tcp"; then
    echo -e "${GREEN}✅ Porta 80 está permitida no firewall${NC}"
else
    echo -e "${RED}❌ Porta 80 NÃO está permitida no firewall!${NC}"
    echo "Configurando firewall..."
    sudo ufw allow 80/tcp
fi

if sudo ufw status | grep -q "3000/tcp"; then
    echo -e "${GREEN}✅ Porta 3000 está permitida no firewall${NC}"
else
    echo -e "${YELLOW}⚠️  Porta 3000 NÃO está permitida no firewall${NC}"
fi

# 8. Verificar acesso remoto
echo -e "\n${YELLOW}[8] Verificando acesso remoto...${NC}"
LOCAL_IP=$(hostname -I | awk '{print $1}')
EXTERNAL_IP=$(curl -s ifconfig.me || curl -s ipinfo.io/ip || echo "Não detectado")

echo "IP Local: $LOCAL_IP"
echo "IP Externo: $EXTERNAL_IP"

# 9. Verificar logs de erro
echo -e "\n${YELLOW}[9] Últimas linhas do log de erro do Nginx:${NC}"
sudo tail -10 /var/log/nginx/error.log 2>/dev/null || echo "Nenhum erro recente"

# 10. Resumo
echo -e "\n${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                       RESUMO                                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo
echo -e "${GREEN}✅ Teste local:${NC} http://localhost:80"
echo -e "${GREEN}✅ Teste na rede:${NC} http://$LOCAL_IP:80"
if [[ "$EXTERNAL_IP" != "Não detectado" ]]; then
    echo -e "${GREEN}✅ Teste remoto:${NC} http://$EXTERNAL_IP:80"
fi
echo
echo -e "${YELLOW}💡 Se a página não carrega remotamente:${NC}"
echo "   1. Verifique se o firewall permite porta 80"
echo "   2. Verifique se o roteador faz port forwarding"
echo "   3. Verifique se há firewall no provedor"
echo
echo -e "${YELLOW}💡 Se o JavaScript não carrega:${NC}"
echo "   1. Abra o Console do navegador (F12)"
echo "   2. Verifique erros no Console"
echo "   3. Verifique a aba Network para ver quais arquivos falharam"
echo

