#!/bin/bash
# Script para corrigir line endings de arquivos .sh (CRLF -> LF)
# Execute este script no servidor Linux após extrair ZIP do Windows

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🔧 Correção de Line Endings - Scripts .sh${NC}"
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

echo -e "${BLUE}Diretório do projeto: $PROJECT_DIR${NC}"
echo ""

# Verificar se dos2unix está disponível (melhor método)
if command -v dos2unix &> /dev/null; then
    echo -e "${YELLOW}Usando dos2unix (método recomendado)...${NC}"
    
    # Encontrar e converter todos os arquivos .sh
    find "$PROJECT_DIR" -type f -name "*.sh" -exec dos2unix {} \; 2>/dev/null || true
    
    SH_COUNT=$(find "$PROJECT_DIR" -type f -name "*.sh" 2>/dev/null | wc -l)
    echo -e "${GREEN}✅ $SH_COUNT arquivos .sh convertidos com dos2unix${NC}"
    
elif command -v sed &> /dev/null; then
    echo -e "${YELLOW}Usando sed (método alternativo)...${NC}"
    
    # Encontrar e converter todos os arquivos .sh usando sed
    SH_COUNT=0
    while IFS= read -r -d '' file; do
        # Remover CR (carriage return)
        sed -i 's/\r$//' "$file" 2>/dev/null || true
        SH_COUNT=$((SH_COUNT + 1))
    done < <(find "$PROJECT_DIR" -type f -name "*.sh" -print0 2>/dev/null)
    
    echo -e "${GREEN}✅ $SH_COUNT arquivos .sh convertidos com sed${NC}"
    
else
    echo -e "${RED}❌ Nem dos2unix nem sed estão disponíveis${NC}"
    echo "Instale dos2unix: sudo apt-get install dos2unix"
    exit 1
fi

# Verificar arquivo específico install-smartsignage.sh
INSTALL_SCRIPT="$PROJECT_DIR/scripts/install-smartsignage.sh"
if [[ -f "$INSTALL_SCRIPT" ]]; then
    echo ""
    echo -e "${YELLOW}Verificando install-smartsignage.sh...${NC}"
    
    # Verificar se tem CRLF
    if file "$INSTALL_SCRIPT" | grep -q "CRLF"; then
        echo -e "${RED}⚠️  install-smartsignage.sh ainda tem CRLF - corrigindo...${NC}"
        if command -v dos2unix &> /dev/null; then
            dos2unix "$INSTALL_SCRIPT" 2>/dev/null || true
        else
            sed -i 's/\r$//' "$INSTALL_SCRIPT" 2>/dev/null || true
        fi
        echo -e "${GREEN}✅ install-smartsignage.sh corrigido${NC}"
    else
        echo -e "${GREEN}✅ install-smartsignage.sh já está com line endings corretos${NC}"
    fi
    
    # Verificar shebang
    if head -1 "$INSTALL_SCRIPT" | grep -q "^#!/bin/bash"; then
        echo -e "${GREEN}✅ Shebang está correto${NC}"
    else
        echo -e "${YELLOW}⚠️  Verificando shebang...${NC}"
        head -1 "$INSTALL_SCRIPT" | od -c | head -1
    fi
    
    # Dar permissão de execução
    chmod +x "$INSTALL_SCRIPT" 2>/dev/null || true
    echo -e "${GREEN}✅ Permissão de execução garantida${NC}"
fi

echo ""
echo -e "${GREEN}✅ Correção concluída!${NC}"
echo ""
echo -e "${BLUE}Teste rápido:${NC}"
echo "  file $INSTALL_SCRIPT"
echo "  head -1 $INSTALL_SCRIPT | od -c"
echo "  ./scripts/install-smartsignage.sh --help"
echo ""

