#!/bin/bash

# Script Rápido de Instalação no Servidor de Teste
# Smart Signage Pro v2.1 - Docker Monolítico

set -e

echo "🚀 Smart Signage Pro v2.1 - Instalação no Servidor de Teste"
echo "============================================================"
echo ""

# Detectar root do projeto (este script vive em ./scripts)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Garantir que estamos no diretório raiz do projeto
if [[ -f "docker-compose.yml" ]]; then
    : # ok - já estamos no root
elif [[ -f "$PROJECT_ROOT/docker-compose.yml" ]]; then
    cd "$PROJECT_ROOT"
else
    echo -e "${RED}❌ Erro: docker-compose.yml não encontrado. Execute no diretório raiz do projeto.${NC}"
    echo "   Exemplo: cd /opt/SmartSignage-Pro"
    exit 1
fi

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker não encontrado. Instalando...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✅ Docker instalado${NC}"
    echo -e "${YELLOW}⚠️  Faça logout e login novamente, depois execute este script novamente${NC}"
    exit 0
fi

# Verificar Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker Compose não encontrado. Instalando...${NC}"
    sudo apt install -y docker-compose
    echo -e "${GREEN}✅ Docker Compose instalado${NC}"
fi

# Verificar arquivos essenciais
echo -e "${GREEN}📋 Verificando arquivos essenciais...${NC}"
MISSING_FILES=0

if [[ ! -f "docker-compose.yml" ]]; then
    echo -e "${RED}❌ docker-compose.yml não encontrado${NC}"
    MISSING_FILES=1
fi

if [[ ! -f "Dockerfile.app" ]]; then
    echo -e "${RED}❌ Dockerfile.app não encontrado${NC}"
    MISSING_FILES=1
fi

if [[ ! -f "database/smartchannel-db-v2-refactored-apply-all.sql" ]]; then
    echo -e "${RED}❌ database/smartchannel-db-v2-refactored-apply-all.sql não encontrado${NC}"
    MISSING_FILES=1
fi

if [[ ! -f "database/carga-inicial-db-smarsignage-v4.sql" ]]; then
    echo -e "${RED}❌ database/carga-inicial-db-smarsignage-v4.sql não encontrado${NC}"
    MISSING_FILES=1
fi

if [[ $MISSING_FILES -eq 1 ]]; then
    echo -e "${RED}❌ Arquivos essenciais faltando. Verifique o projeto.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Todos os arquivos essenciais encontrados${NC}"
echo ""

# Verificar recursos
echo -e "${GREEN}📊 Verificando recursos do servidor...${NC}"
RAM_GB=$(free -g | awk '/^Mem:/{print $2}')
DISK_GB=$(df -h / | awk 'NR==2 {print $4}' | sed 's/G//')

echo "   RAM disponível: ${RAM_GB}GB"
echo "   Disco disponível: ${DISK_GB}GB"

if [[ $RAM_GB -lt 4 ]]; then
    echo -e "${YELLOW}⚠️  RAM baixa (recomendado: 4GB mínimo)${NC}"
fi

echo ""

# Verificar portas
echo -e "${GREEN}🔍 Verificando portas...${NC}"
PORTS_IN_USE=0

if sudo netstat -tuln 2>/dev/null | grep -q ":80 "; then
    echo -e "${YELLOW}⚠️  Porta 80 já em uso${NC}"
    PORTS_IN_USE=1
fi

if sudo netstat -tuln 2>/dev/null | grep -q ":3000 "; then
    echo -e "${YELLOW}⚠️  Porta 3000 já em uso${NC}"
    PORTS_IN_USE=1
fi

if [[ $PORTS_IN_USE -eq 1 ]]; then
    echo -e "${YELLOW}⚠️  Algumas portas estão em uso. O Docker pode usar portas diferentes.${NC}"
fi

echo ""

# Perguntar se deseja continuar
read -p "Deseja continuar com a instalação? (s/N): " CONTINUE
if [[ ! "$CONTINUE" =~ ^[Ss]$ ]]; then
    echo "Instalação cancelada."
    exit 0
fi

echo ""
echo -e "${GREEN}🚀 Iniciando instalação...${NC}"
echo ""

# Tornar script principal executável (agora em ./scripts)
chmod +x scripts/install-smartsignage.sh

# Executar script de instalação principal
# Passar flag para modo Docker automaticamente
echo -e "${GREEN}Executando script de instalação principal...${NC}"
echo ""

# Executar em modo não-interativo para Docker
export INSTALL_MODE=docker
./scripts/install-smartsignage.sh --skip-menu || {
    echo -e "${RED}❌ Erro durante instalação${NC}"
    echo "Verifique os logs acima para mais detalhes"
    exit 1
}

echo ""
echo -e "${GREEN}✅ Instalação concluída!${NC}"
echo ""
echo "=== VALIDAÇÃO RÁPIDA ==="
echo ""

# Aguardar containers iniciarem
echo "Aguardando containers iniciarem..."
sleep 10

# Verificar containers
echo -e "${GREEN}📦 Verificando containers...${NC}"
docker compose ps

echo ""
echo -e "${GREEN}🌐 Testando conectividade...${NC}"

# Testar frontend
if curl -s -o /dev/null -w "%{http_code}" http://localhost/ | grep -q "200"; then
    echo -e "${GREEN}✅ Frontend acessível${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend não respondeu (pode estar iniciando)${NC}"
fi

# Testar backend
if curl -s http://localhost:3000/health | grep -q "healthy"; then
    echo -e "${GREEN}✅ Backend acessível${NC}"
else
    echo -e "${YELLOW}⚠️  Backend não respondeu (pode estar iniciando)${NC}"
fi

echo ""
echo "=== INFORMAÇÕES DE ACESSO ==="
SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "Frontend:     http://${SERVER_IP}/"
echo "Backend API:  http://${SERVER_IP}:3000/api"
echo "Player:       http://${SERVER_IP}/player/"
echo "Grafana:      http://${SERVER_IP}:3002"
echo "Prometheus:   http://${SERVER_IP}:9090"
echo ""
echo "Credenciais padrão:"
echo "  Usuário: admin"
echo "  Senha: admin"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE: Alterar senha após primeiro login!${NC}"
echo ""
echo "=== COMANDOS ÚTEIS ==="
echo ""
echo "Ver logs:           docker compose logs -f"
echo "Ver status:         docker compose ps"
echo "Reiniciar:          docker compose restart"
echo "Parar:              docker compose down"
echo "Iniciar:            docker compose up -d"
echo ""
echo -e "${GREEN}✅ Instalação concluída com sucesso!${NC}"

