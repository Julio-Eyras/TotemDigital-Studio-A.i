#!/bin/bash

# Smart Signage Pro - Instalação Completa do Zero
# Este script clona o repositório e executa a instalação completa

set -e

echo "=========================================="
echo "Smart Signage Pro - Instalação do Zero"
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se Git está instalado
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git não está instalado!${NC}"
    echo "Instalando Git..."
    sudo apt-get update
    sudo apt-get install -y git
fi

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker não está instalado.${NC}"
    echo "O script de instalação irá instalar o Docker automaticamente."
fi

# Diretório base
BASE_DIR="${HOME}/smart-signage"
REPO_URL="https://github.com/Julio-Eyras/smartsignage-pro.git"

# Limpar instalação anterior (opcional)
read -p "Deseja remover instalação anterior em ${BASE_DIR}? (s/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo "Removendo instalação anterior..."
    sudo rm -rf "${BASE_DIR}"
    echo -e "${GREEN}✅ Instalação anterior removida${NC}"
fi

# Criar diretório base
mkdir -p "${BASE_DIR}"
cd "${BASE_DIR}"

# Clonar o repositório
echo ""
echo "📥 Clonando repositório do GitHub..."
if [ -d "smartsignage-pro" ]; then
    echo "Diretório já existe. Atualizando..."
    cd smartsignage-pro
    git pull origin main
else
    git clone "${REPO_URL}" smartsignage-pro
    cd smartsignage-pro
fi

echo -e "${GREEN}✅ Repositório clonado/atualizado com sucesso!${NC}"

# Verificar última commit
echo ""
echo "📋 Informações do repositório:"
git log -1 --oneline

# Dar permissão de execução ao script
chmod +x install-smartsignage.sh

echo ""
echo "=========================================="
echo "🚀 Iniciando instalação do Smart Signage Pro"
echo "=========================================="
echo ""

# Executar script de instalação
./install-smartsignage.sh

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Instalação concluída!${NC}"
echo "=========================================="
echo ""
echo "Acesse o sistema em:"
echo "  - Frontend: http://localhost ou http://$(hostname -I | awk '{print $1}')"
echo "  - Login padrão: admin / admin"
echo ""
echo "Comandos úteis:"
echo "  - Status: /opt/smart-signage/scripts/status.sh"
echo "  - Parar: docker compose down"
echo "  - Iniciar: docker compose up -d"
echo "  - Logs: docker compose logs -f"
echo ""
