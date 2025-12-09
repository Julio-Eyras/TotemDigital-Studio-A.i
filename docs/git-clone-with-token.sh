#!/bin/bash

# Smart Signage Pro - Comandos Git com Personal Access Token
# Use este script para clonar e trabalhar com o repositório privado

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "Smart Signage Pro - Setup Git com Token"
echo "==========================================${NC}"
echo ""

# Configurações
REPO_URL="https://github.com/Julio-Eyras/smartsignage-pro.git"
REPO_SSH="git@github.com:Julio-Eyras/smartsignage-pro.git"

# Função para clonar com token
clone_with_token() {
    local TOKEN="$1"
    
    if [ -z "$TOKEN" ]; then
        echo -e "${YELLOW}Token não fornecido. Solicitando...${NC}"
        read -sp "Digite seu GitHub Personal Access Token: " TOKEN
        echo ""
    fi
    
    # Usar token no URL
    git clone "https://${TOKEN}@github.com/Julio-Eyras/smartsignage-pro.git"
}

# Função para configurar credenciais
setup_credentials() {
    echo -e "${GREEN}Configurando credenciais do Git...${NC}"
    
    # Usar Git Credential Helper
    git config --global credential.helper store
    
    echo -e "${GREEN}✅ Credenciais configuradas${NC}"
    echo ""
    echo "Quando for solicitado, use:"
    echo "  Username: Julio-Eyras"
    echo "  Password: [seu-token]"
}

echo "Escolha o método de clonagem:"
echo "1) Clone com token no URL (mais rápido)"
echo "2) Clone com prompt de autenticação (mais seguro)"
echo "3) Clone via SSH (se tiver chave SSH configurada)"
echo "4) Configurar credenciais para usar token em todos os comandos"
echo ""
read -p "Opção [1-4]: " opcao

case $opcao in
    1)
        read -sp "Digite seu GitHub Personal Access Token: " TOKEN
        echo ""
        echo -e "${GREEN}Clonando repositório...${NC}"
        git clone "https://${TOKEN}@github.com/Julio-Eyras/smartsignage-pro.git"
        ;;
    2)
        echo -e "${GREEN}Clonando repositório...${NC}"
        echo "Quando solicitado:"
        echo "  Username: Julio-Eyras"
        echo "  Password: [seu-personal-access-token]"
        echo ""
        git clone "$REPO_URL"
        ;;
    3)
        echo -e "${GREEN}Clonando via SSH...${NC}"
        git clone "$REPO_SSH"
        ;;
    4)
        setup_credentials
        echo -e "${GREEN}Agora execute: git clone $REPO_URL${NC}"
        ;;
    *)
        echo "Opção inválida"
        exit 1
        ;;
esac

# Após clonar, entrar no diretório e executar instalação
if [ -d "smartsignage-pro" ]; then
    cd smartsignage-pro
    
    echo ""
    echo -e "${GREEN}✅ Repositório clonado com sucesso!${NC}"
    echo ""
    echo "Próximos passos:"
    echo "  cd smartsignage-pro"
    echo "  chmod +x install-smartsignage.sh"
    echo "  ./install-smartsignage.sh"
    echo ""
fi
