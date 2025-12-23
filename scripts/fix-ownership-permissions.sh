#!/bin/bash
# Script para corrigir ownership e permissões após extrair ZIP
# Define ownership para o usuário atual e corrige permissões

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🔧 Correção de Ownership e Permissões${NC}"
echo ""

# Detectar diretório do projeto
if [[ -n "$1" ]]; then
    PROJECT_DIR="$1"
else
    # Tentar detectar automaticamente
    if [[ -d "$HOME/SmartSignage-Pro" ]]; then
        PROJECT_DIR="$HOME/SmartSignage-Pro"
    elif [[ -d "$(pwd)" ]]; then
        PROJECT_DIR="$(pwd)"
    else
        echo -e "${RED}❌ Diretório do projeto não encontrado${NC}"
        echo "Uso: $0 [DIRETÓRIO_DO_PROJETO]"
        exit 1
    fi
fi

if [[ ! -d "$PROJECT_DIR" ]]; then
    echo -e "${RED}❌ Diretório não encontrado: $PROJECT_DIR${NC}"
    exit 1
fi

# Obter usuário e grupo atual
CURRENT_USER="${USER:-$(whoami)}"
CURRENT_GROUP="${GROUP:-$(id -gn)}"

echo -e "${BLUE}Diretório do projeto: $PROJECT_DIR${NC}"
echo -e "${BLUE}Usuário: $CURRENT_USER${NC}"
echo -e "${BLUE}Grupo: $CURRENT_GROUP${NC}"
echo ""

# Verificar se precisa de sudo
NEED_SUDO=false
if [[ ! -O "$PROJECT_DIR" ]]; then
    echo -e "${YELLOW}⚠️  Diretório não pertence ao usuário atual${NC}"
    echo -e "${YELLOW}   Será necessário usar sudo para corrigir ownership${NC}"
    NEED_SUDO=true
fi

# Confirmar
read -p "Corrigir ownership e permissões? (s/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[SsYy]$ ]]; then
    echo "Cancelado."
    exit 0
fi

echo ""
echo -e "${YELLOW}Corrigindo ownership e permissões...${NC}"

# 1. Corrigir ownership
if [[ "$NEED_SUDO" == "true" ]]; then
    echo -e "${YELLOW}1. Ajustando ownership (pode pedir senha sudo)...${NC}"
    sudo chown -R "$CURRENT_USER:$CURRENT_GROUP" "$PROJECT_DIR" 2>/dev/null || {
        echo -e "${RED}❌ Erro ao ajustar ownership${NC}"
        exit 1
    }
    echo -e "${GREEN}   ✅ Ownership ajustado${NC}"
else
    echo -e "${YELLOW}1. Ajustando ownership...${NC}"
    chown -R "$CURRENT_USER:$CURRENT_GROUP" "$PROJECT_DIR" 2>/dev/null || {
        echo -e "${YELLOW}   ⚠️  Tentando com sudo...${NC}"
        sudo chown -R "$CURRENT_USER:$CURRENT_GROUP" "$PROJECT_DIR" 2>/dev/null || true
    }
    echo -e "${GREEN}   ✅ Ownership ajustado${NC}"
fi

# 2. Corrigir permissões de diretórios (755)
echo -e "${YELLOW}2. Corrigindo permissões de diretórios (755)...${NC}"
find "$PROJECT_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
echo -e "${GREEN}   ✅ Permissões de diretórios corrigidas${NC}"

# 3. Corrigir permissões de arquivos (644)
echo -e "${YELLOW}3. Corrigindo permissões de arquivos (644)...${NC}"
find "$PROJECT_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
echo -e "${GREEN}   ✅ Permissões de arquivos corrigidas${NC}"

# 4. Adicionar execução para scripts .sh
echo -e "${YELLOW}4. Adicionando permissão de execução para scripts .sh...${NC}"
find "$PROJECT_DIR" -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
SCRIPT_COUNT=$(find "$PROJECT_DIR" -name "*.sh" -type f 2>/dev/null | wc -l)
echo -e "${GREEN}   ✅ $SCRIPT_COUNT scripts .sh com permissão de execução${NC}"

# 5. Verificar diretórios críticos
echo -e "${YELLOW}5. Verificando diretórios críticos...${NC}"
CRITICAL_DIRS=(
    "frontend/src"
    "frontend/src/components"
    "frontend/src/pages"
    "backend/src"
    "backend/src/routes"
    "backend/src/services"
)

for dir in "${CRITICAL_DIRS[@]}"; do
    full_path="$PROJECT_DIR/$dir"
    if [[ -d "$full_path" ]]; then
        if [[ -O "$full_path" ]] && [[ -x "$full_path" ]] && [[ -r "$full_path" ]]; then
            echo -e "${GREEN}   ✅ $dir${NC}"
        else
            echo -e "${YELLOW}   ⚠️  $dir - corrigindo...${NC}"
            sudo chown -R "$CURRENT_USER:$CURRENT_GROUP" "$full_path" 2>/dev/null || \
            chown -R "$CURRENT_USER:$CURRENT_GROUP" "$full_path" 2>/dev/null || true
            chmod 755 "$full_path" 2>/dev/null || true
            find "$full_path" -type d -exec chmod 755 {} \; 2>/dev/null || true
            find "$full_path" -type f -exec chmod 644 {} \; 2>/dev/null || true
            echo -e "${GREEN}   ✅ $dir corrigido${NC}"
        fi
    fi
done

echo ""
echo -e "${GREEN}✅ Correção concluída!${NC}"
echo ""
echo -e "${BLUE}Verificação:${NC}"
ls -ld "$PROJECT_DIR" | awk '{print "  Ownership: " $3 ":" $4 "  Permissões: " $1}'
echo ""
echo -e "${YELLOW}Teste rápido:${NC}"
echo "  cd $PROJECT_DIR/frontend/src/pages"
echo "  ls -la"
echo ""

