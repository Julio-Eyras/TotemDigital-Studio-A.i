#!/bin/bash
# Script para corrigir permissões de TODOS os diretórios e arquivos
# Útil após extrair ZIPs do Windows que não preservam permissões Unix

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🔧 Correção de Permissões - Smart Signage Pro${NC}"
echo ""

# Detectar diretório do projeto
if [[ -n "$1" ]]; then
    PROJECT_DIR="$1"
else
    # Tentar detectar automaticamente
    if [[ -d "/home/smartchannel/SmartSignage-Pro" ]]; then
        PROJECT_DIR="/home/smartchannel/SmartSignage-Pro"
    elif [[ -d "/home/smartchannel/SmartSignage-Pro/SmartSignage-Pro-install" ]]; then
        PROJECT_DIR="/home/smartchannel/SmartSignage-Pro/SmartSignage-Pro-install"
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

echo -e "${BLUE}Diretório do projeto: $PROJECT_DIR${NC}"
echo ""

# Confirmar
read -p "Corrigir permissões recursivamente em $PROJECT_DIR? (s/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[SsYy]$ ]]; then
    echo "Cancelado."
    exit 0
fi

echo ""
echo -e "${YELLOW}Corrigindo permissões...${NC}"

# Contar diretórios e arquivos antes
DIR_COUNT=$(find "$PROJECT_DIR" -type d 2>/dev/null | wc -l)
FILE_COUNT=$(find "$PROJECT_DIR" -type f 2>/dev/null | wc -l)

echo -e "${BLUE}Encontrados:${NC}"
echo "  - Diretórios: $DIR_COUNT"
echo "  - Arquivos: $FILE_COUNT"
echo ""

# 1. Corrigir TODOS os diretórios para 755 (rwxr-xr-x)
# CRÍTICO: Sem permissão de execução (x), não é possível entrar no diretório
echo -e "${YELLOW}1. Corrigindo permissões de diretórios (755)...${NC}"
find "$PROJECT_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
echo -e "${GREEN}   ✅ Diretórios corrigidos${NC}"

# 2. Corrigir TODOS os arquivos para 644 (rw-r--r--)
echo -e "${YELLOW}2. Corrigindo permissões de arquivos (644)...${NC}"
find "$PROJECT_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
echo -e "${GREEN}   ✅ Arquivos corrigidos${NC}"

# 3. Adicionar permissão de execução para scripts .sh
echo -e "${YELLOW}3. Adicionando permissão de execução para scripts .sh...${NC}"
find "$PROJECT_DIR" -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
SCRIPT_COUNT=$(find "$PROJECT_DIR" -name "*.sh" -type f 2>/dev/null | wc -l)
echo -e "${GREEN}   ✅ $SCRIPT_COUNT scripts .sh corrigidos${NC}"

# 4. Verificar diretórios críticos
echo -e "${YELLOW}4. Verificando diretórios críticos...${NC}"

CRITICAL_DIRS=(
    "frontend/src"
    "frontend/src/components"
    "frontend/src/pages"
    "frontend/src/services"
    "backend/src"
    "backend/src/routes"
    "backend/src/services"
)

for dir in "${CRITICAL_DIRS[@]}"; do
    full_path="$PROJECT_DIR/$dir"
    if [[ -d "$full_path" ]]; then
        # Verificar se pode ser acessado
        if [[ -x "$full_path" ]] && [[ -r "$full_path" ]]; then
            echo -e "${GREEN}   ✅ $dir${NC}"
        else
            echo -e "${RED}   ❌ $dir - corrigindo...${NC}"
            chmod 755 "$full_path" 2>/dev/null || true
            find "$full_path" -type d -exec chmod 755 {} \; 2>/dev/null || true
            find "$full_path" -type f -exec chmod 644 {} \; 2>/dev/null || true
            echo -e "${GREEN}   ✅ $dir corrigido${NC}"
        fi
    fi
done

echo ""
echo -e "${GREEN}✅ Correção de permissões concluída!${NC}"
echo ""
echo -e "${BLUE}Resumo:${NC}"
echo "  - Diretórios: $DIR_COUNT (todos com permissão 755)"
echo "  - Arquivos: $FILE_COUNT (todos com permissão 644)"
echo "  - Scripts .sh: $SCRIPT_COUNT (com permissão de execução)"
echo ""
echo -e "${YELLOW}Teste rápido:${NC}"
echo "  cd $PROJECT_DIR/frontend/src/pages"
echo "  ls -la"
echo ""

