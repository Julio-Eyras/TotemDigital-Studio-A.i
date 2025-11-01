#!/bin/bash

# Smart Signage Pro v2.0 - Diagnóstico API e Frontend
# Script para diagnosticar problemas de conexão entre frontend e backend

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTALL_DIR="/opt/smart-signage"
LOCAL_IP=$(hostname -I | awk '{print $1}')
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip || echo "Não detectado")

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Smart Signage Pro - Diagnóstico API e Frontend          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo

# 1. Verificar Backend
echo -e "${YELLOW}[1] Verificando Backend...${NC}"
if systemctl is-active --quiet smart-signage 2>/dev/null; then
    echo -e "${GREEN}✅ Backend (systemd) está rodando${NC}"
    BACKEND_MODE="systemd"
elif docker ps --format '{{.Names}}' | grep -q "smartsignage.*backend\|smartsignage.*app"; then
    echo -e "${GREEN}✅ Backend (Docker) está rodando${NC}"
    BACKEND_MODE="docker"
else
    echo -e "${RED}❌ Backend NÃO está rodando!${NC}"
    echo "Tentando iniciar..."
    sudo systemctl start smart-signage 2>/dev/null || echo "Falha ao iniciar"
    exit 1
fi

# 2. Testar Backend diretamente (porta 3000)
echo -e "\n${YELLOW}[2] Testando Backend na porta 3000...${NC}"
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
if [[ "$BACKEND_HEALTH" == "200" ]]; then
    echo -e "${GREEN}✅ Backend responde corretamente (HTTP 200)${NC}"
    curl -s http://localhost:3000/health | head -3
else
    echo -e "${RED}❌ Backend não responde (HTTP $BACKEND_HEALTH)${NC}"
    echo "Verificando logs..."
    if [[ "$BACKEND_MODE" == "systemd" ]]; then
        sudo journalctl -u smart-signage --no-pager -n 10 || true
    else
        docker logs $(docker ps --format '{{.Names}}' | grep "backend\|app" | head -1) --tail 10 || true
    fi
fi

# 3. Testar API via Nginx (/api/)
echo -e "\n${YELLOW}[3] Testando API via Nginx (/api/)...${NC}"
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80/api/health 2>/dev/null || echo "000")
if [[ "$API_HEALTH" == "200" ]]; then
    echo -e "${GREEN}✅ API via Nginx responde corretamente (HTTP 200)${NC}"
    curl -s http://localhost:80/api/health | head -3
else
    echo -e "${RED}❌ API via Nginx não responde (HTTP $API_HEALTH)${NC}"
    echo "Verificando configuração do Nginx..."
    sudo nginx -t
    echo "Verificando proxy_pass..."
    grep -A 5 "location /api/" /etc/nginx/sites-available/smart-signage || true
fi

# 4. Verificar CORS
echo -e "\n${YELLOW}[4] Verificando CORS...${NC}"
CORS_HEADERS=$(curl -s -I http://localhost:80/api/health 2>/dev/null | grep -i "access-control" || echo "")
if [[ -n "$CORS_HEADERS" ]]; then
    echo -e "${GREEN}✅ CORS configurado:${NC}"
    echo "$CORS_HEADERS"
else
    echo -e "${YELLOW}⚠️  CORS headers não encontrados (pode ser normal se for mesma origem)${NC}"
fi

# 5. Testar login
echo -e "\n${YELLOW}[5] Testando login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:80/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@smart-signage.com","password":"admin"}' 2>/dev/null || echo "ERRO")
if echo "$LOGIN_RESPONSE" | grep -q "token\|success"; then
    echo -e "${GREEN}✅ Login funcionando corretamente${NC}"
    echo "Token recebido: $(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4 | head -c 20)..."
else
    echo -e "${RED}❌ Login falhou${NC}"
    echo "Resposta: $LOGIN_RESPONSE"
fi

# 6. Verificar console do navegador (sugestão)
echo -e "\n${YELLOW}[6] Verificações do Frontend...${NC}"
echo "Abra o Console do navegador (F12) e verifique:"
echo "  - Erros de JavaScript"
echo "  - Requisições falhando na aba Network"
echo "  - Mensagens de CORS"

# 7. Resumo
echo -e "\n${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                       RESUMO                                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo
echo -e "${GREEN}✅ Backend direto:${NC} http://localhost:3000"
echo -e "${GREEN}✅ API via Nginx:${NC} http://localhost:80/api"
echo -e "${GREEN}✅ Frontend:${NC} http://localhost:80"
if [[ "$EXTERNAL_IP" != "Não detectado" ]]; then
    echo
    echo -e "${GREEN}✅ Acesso remoto:${NC}"
    echo "   Frontend: http://$EXTERNAL_IP:80"
    echo "   API: http://$EXTERNAL_IP:80/api"
fi
echo
echo -e "${YELLOW}💡 Se os menus não aparecem:${NC}"
echo "   1. Abra o Console do navegador (F12)"
echo "   2. Verifique erros na aba Console"
echo "   3. Verifique requisições na aba Network"
echo "   4. Verifique se há erros de CORS"
echo

