#!/bin/bash
# Smart Signage Pro v2.0 - Script de Reset Completo
# Este script remove completamente o sistema e todos os dados

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}⚠️  ATENÇÃO: RESET COMPLETO DO SISTEMA SMART SIGNAGE PRO v2.0${NC}"
echo ""
echo -e "${RED}Esta operação irá:${NC}"
echo -e "${RED}  ❌ Parar todos os serviços${NC}"
echo -e "${RED}  ❌ Remover todos os containers${NC}"
echo -e "${RED}  ❌ Remover todos os volumes (DADOS PERDIDOS!)${NC}"
echo -e "${RED}  ❌ Remover todas as imagens Docker${NC}"
echo -e "${RED}  ❌ Remover todas as redes Docker${NC}"
echo -e "${RED}  ❌ Limpar completamente o sistema${NC}"
echo ""
echo -e "${YELLOW}⚠️  TODOS OS DADOS SERÃO PERDIDOS PERMANENTEMENTE!${NC}"
echo -e "${YELLOW}⚠️  Certifique-se de ter feito backup antes de continuar!${NC}"
echo ""

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker não está rodando!${NC}"
    exit 1
fi

# Mostrar informações do sistema atual
echo -e "${BLUE}📊 Sistema atual:${NC}"
docker compose ps 2>/dev/null || echo "Nenhum serviço rodando"
echo ""

# Mostrar volumes existentes
echo -e "${BLUE}💾 Volumes que serão removidos:${NC}"
docker volume ls | grep smartsignage || echo "Nenhum volume encontrado"
echo ""

# Mostrar imagens existentes
echo -e "${BLUE}🖼️  Imagens que serão removidas:${NC}"
docker images | grep smartsignage || echo "Nenhuma imagem encontrada"
echo ""

# Confirmação múltipla
echo -e "${RED}Para confirmar o reset, digite exatamente:${NC}"
echo -e "${RED}1. 'RESETAR SISTEMA'${NC}"
echo -e "${RED}2. 'CONFIRMAR RESET'${NC}"
echo -e "${RED}3. 'APAGAR TUDO'${NC}"
echo ""

read -p "Digite a primeira confirmação: " confirm1
if [ "$confirm1" != "RESETAR SISTEMA" ]; then
    echo -e "${YELLOW}Operação cancelada.${NC}"
    exit 1
fi

read -p "Digite a segunda confirmação: " confirm2
if [ "$confirm2" != "CONFIRMAR RESET" ]; then
    echo -e "${YELLOW}Operação cancelada.${NC}"
    exit 1
fi

read -p "Digite a terceira confirmação: " confirm3
if [ "$confirm3" != "APAGAR TUDO" ]; then
    echo -e "${YELLOW}Operação cancelada.${NC}"
    exit 1
fi

echo ""
echo -e "${RED}🔄 Iniciando reset completo...${NC}"

# Parar todos os serviços
echo -e "${YELLOW}⏸️  Parando todos os serviços...${NC}"
docker compose down 2>/dev/null || true

# Remover containers
echo -e "${YELLOW}🗑️  Removendo containers...${NC}"
docker container prune -f

# Remover volumes específicos do Smart Signage
echo -e "${YELLOW}💾 Removendo volumes do Smart Signage...${NC}"
docker volume ls -q | grep smartsignage | xargs -r docker volume rm -f

# Remover imagens específicas do Smart Signage
echo -e "${YELLOW}🖼️  Removendo imagens do Smart Signage...${NC}"
docker images -q | xargs -r docker rmi -f 2>/dev/null || true

# Remover redes
echo -e "${YELLOW}🌐 Removendo redes...${NC}"
docker network prune -f

# Limpeza completa do sistema Docker
echo -e "${YELLOW}🧹 Limpeza completa do Docker...${NC}"
docker system prune -af

# Remover arquivos de configuração (opcional)
echo ""
echo -e "${YELLOW}⚠️  Deseja remover também os arquivos de configuração?${NC}"
echo -e "${YELLOW}   (Isso inclui .env, docker-compose.yml, etc.)${NC}"
read -p "Digite 'SIM' para remover: " remove_config

if [ "$remove_config" = "SIM" ]; then
    echo -e "${YELLOW}🗑️  Removendo arquivos de configuração...${NC}"
    rm -f .env docker-compose.yml
    rm -rf nginx/ monitoring/ scripts/
    echo -e "${GREEN}✅ Arquivos de configuração removidos${NC}"
else
    echo -e "${BLUE}ℹ️  Arquivos de configuração mantidos${NC}"
fi

# Verificar limpeza
echo ""
echo -e "${BLUE}🔍 Verificando limpeza...${NC}"

# Verificar containers
CONTAINERS=$(docker ps -a | grep smartsignage | wc -l)
if [ "$CONTAINERS" -eq 0 ]; then
    echo -e "${GREEN}✅ Nenhum container do Smart Signage encontrado${NC}"
else
    echo -e "${YELLOW}⚠️  $CONTAINERS containers ainda existem${NC}"
fi

# Verificar volumes
VOLUMES=$(docker volume ls | grep smartsignage | wc -l)
if [ "$VOLUMES" -eq 0 ]; then
    echo -e "${GREEN}✅ Nenhum volume do Smart Signage encontrado${NC}"
else
    echo -e "${YELLOW}⚠️  $VOLUMES volumes ainda existem${NC}"
fi

# Verificar imagens
IMAGES=$(docker images | grep smartsignage | wc -l)
if [ "$IMAGES" -eq 0 ]; then
    echo -e "${GREEN}✅ Nenhuma imagem do Smart Signage encontrada${NC}"
else
    echo -e "${YELLOW}⚠️  $IMAGES imagens ainda existem${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Reset completo finalizado!${NC}"
echo ""
echo -e "${BLUE}📋 Resumo do reset:${NC}"
echo -e "   Data: $(date)"
echo -e "   Servidor: $(hostname)"
echo -e "   Sistema: Smart Signage Pro v2.0"
echo ""
echo -e "${GREEN}🚀 Para reinstalar:${NC}"
echo -e "   1. Execute: ./install-smartsignage.sh"
echo -e "   2. Ou execute: ./manage-system.sh start"
echo ""
echo -e "${YELLOW}💡 Dica: Considere fazer backup antes de reinstalar${NC}"
