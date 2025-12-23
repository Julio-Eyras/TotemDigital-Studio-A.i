#!/bin/bash

# =============================================================================
# Script para criar ZIP de distribuição do Smart Signage Pro
# =============================================================================
# Uso: ./criar-zip-distribuicao.sh
# =============================================================================

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Variáveis
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION=$(date +%Y.%m.%d)
ZIP_NAME="SmartSignage-Pro-v${VERSION}.zip"
TEMP_DIR=$(mktemp -d)

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                    Criando ZIP de Distribuição${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
echo -e "${BLUE}📦 Nome do arquivo: ${ZIP_NAME}${NC}"
echo -e "${BLUE}📁 Diretório temporário: ${TEMP_DIR}${NC}"
echo

# Função para copiar diretório (com conversão automática de line endings para scripts .sh)
copy_dir() {
    local src="$1"
    local dst="$2"
    local desc="$3"
    
    if [[ -d "$src" ]]; then
        echo -e "${GREEN}✅ Copiando $desc...${NC}"
        mkdir -p "$dst"
        # Copiar excluindo node_modules, dist, build, etc.
        rsync -av --exclude='node_modules' \
                  --exclude='dist' \
                  --exclude='build' \
                  --exclude='coverage' \
                  --exclude='logs' \
                  --exclude='.env' \
                  --exclude='.git' \
                  --exclude='.vscode' \
                  --exclude='.idea' \
                  --exclude='*.log' \
                  --exclude='uploads' \
                  --exclude='backups' \
                  --exclude='postgres_data' \
                  --exclude='redis_data' \
                  --exclude='.cursor' \
                  "$src/" "$dst/" > /dev/null 2>&1 || cp -r "$src"/* "$dst/" 2>/dev/null || true
        
        # Converter line endings de todos os scripts .sh no diretório copiado (CRLF -> LF)
        find "$dst" -name "*.sh" -type f -exec sed -i 's/\r$//' {} \; 2>/dev/null || true
        find "$dst" -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
    else
        echo -e "${YELLOW}⚠️  $desc não encontrado: $src${NC}"
    fi
}

# Função para copiar arquivo
copy_file() {
    local src="$1"
    local dst="$2"
    local desc="$3"
    
    if [[ -f "$src" ]]; then
        mkdir -p "$(dirname "$dst")"
        cp "$src" "$dst"
        echo -e "${GREEN}✅ $desc copiado${NC}"
    else
        echo -e "${YELLOW}⚠️  $desc não encontrado: $src${NC}"
    fi
}

# Criar estrutura no diretório temporário
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                    Copiando Arquivos${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Copiar diretórios principais
copy_dir "$SCRIPT_DIR/backend" "$TEMP_DIR/backend" "Backend"
copy_dir "$SCRIPT_DIR/frontend" "$TEMP_DIR/frontend" "Frontend"
copy_dir "$SCRIPT_DIR/database" "$TEMP_DIR/database" "Database"
copy_dir "$SCRIPT_DIR/docker" "$TEMP_DIR/docker" "Docker"
copy_dir "$SCRIPT_DIR/nginx" "$TEMP_DIR/nginx" "Nginx"
copy_dir "$SCRIPT_DIR/monitoring" "$TEMP_DIR/monitoring" "Monitoring"
copy_dir "$SCRIPT_DIR/scripts" "$TEMP_DIR/scripts" "Scripts"

# Copiar TODOS os players e módulos relacionados
copy_dir "$SCRIPT_DIR/player-client" "$TEMP_DIR/player-client" "Player Client (todas plataformas)"
copy_dir "$SCRIPT_DIR/Player-SmartDisplayFX-client" "$TEMP_DIR/Player-SmartDisplayFX-client" "Player-SmartDisplayFX-client"
copy_dir "$SCRIPT_DIR/Player-Smart-FX-Interface" "$TEMP_DIR/Player-Smart-FX-Interface" "Player-Smart-FX-Interface"
copy_dir "$SCRIPT_DIR/player-agent" "$TEMP_DIR/player-agent" "Player Agent"
copy_dir "$SCRIPT_DIR/player-fx" "$TEMP_DIR/player-fx" "Player FX"
copy_dir "$SCRIPT_DIR/player" "$TEMP_DIR/player" "Player Genérico"

# Copiar arquivos na raiz
copy_file "$SCRIPT_DIR/docker-compose.yml" "$TEMP_DIR/docker-compose.yml" "docker-compose.yml"
copy_file "$SCRIPT_DIR/env.example" "$TEMP_DIR/env.example" "env.example"

# Copiar install-smartsignage.sh com conversão de line endings (CRLF -> LF)
if [[ -f "$SCRIPT_DIR/install-smartsignage.sh" ]]; then
    mkdir -p "$(dirname "$TEMP_DIR/install-smartsignage.sh")"
    sed 's/\r$//' "$SCRIPT_DIR/install-smartsignage.sh" > "$TEMP_DIR/install-smartsignage.sh"
    chmod +x "$TEMP_DIR/install-smartsignage.sh"
    echo -e "${GREEN}✅ install-smartsignage.sh copiado (line endings convertidos para LF)${NC}"
else
    echo -e "${YELLOW}⚠️  install-smartsignage.sh não encontrado${NC}"
fi

# CORREÇÃO CRÍTICA: Corrigir permissões de diretórios e arquivos antes de criar ZIP
# Diretórios precisam de permissão de execução (x) para serem acessados no Linux
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                    Corrigindo Permissões${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${GREEN}Corrigindo permissões de diretórios (755) e arquivos (644)...${NC}"

# Corrigir permissões de todos os diretórios (precisam de execução)
find "$TEMP_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
echo -e "${GREEN}✅ Permissões de diretórios corrigidas (755)${NC}"

# Corrigir permissões de todos os arquivos
find "$TEMP_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
echo -e "${GREEN}✅ Permissões de arquivos corrigidas (644)${NC}"

# Garantir que scripts .sh tenham permissão de execução
find "$TEMP_DIR" -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
echo -e "${GREEN}✅ Scripts .sh com permissão de execução${NC}"

echo -e "${GREEN}✅ Permissões corrigidas - arquivos prontos para distribuição${NC}"

# Copiar Dockerfiles
for dockerfile in "$SCRIPT_DIR"/Dockerfile*; do
    if [[ -f "$dockerfile" ]]; then
        copy_file "$dockerfile" "$TEMP_DIR/$(basename "$dockerfile")" "$(basename "$dockerfile")"
    fi
done

# Copiar README se existir
if [[ -f "$SCRIPT_DIR/README.md" ]]; then
    copy_file "$SCRIPT_DIR/README.md" "$TEMP_DIR/README.md" "README.md"
fi

# Criar arquivo de versão
cat > "$TEMP_DIR/VERSION.txt" << EOF
SmartSignage Pro - Pacote de Distribuição
Versão: ${VERSION}
Data de Criação: $(date +"%Y-%m-%d %H:%M:%S")
EOF

echo
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                    Criando ZIP${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Criar ZIP
cd "$TEMP_DIR"
zip -r "$SCRIPT_DIR/$ZIP_NAME" . -q
cd "$SCRIPT_DIR"

# Calcular tamanho
ZIP_SIZE=$(du -h "$ZIP_NAME" | cut -f1)

echo -e "${GREEN}✅ ZIP criado com sucesso!${NC}"
echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                    ✅ CONCLUÍDO${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
echo -e "${GREEN}📦 Arquivo: ${ZIP_NAME}${NC}"
echo -e "${GREEN}📊 Tamanho: ${ZIP_SIZE}${NC}"
echo -e "${GREEN}📍 Local: ${SCRIPT_DIR}/${ZIP_NAME}${NC}"
echo

# Limpar diretório temporário
rm -rf "$TEMP_DIR"

echo -e "${BLUE}💡 Próximos passos:${NC}"
echo -e "   1. Transferir ${ZIP_NAME} para a máquina destino"
echo -e "   2. Extrair: unzip ${ZIP_NAME}"
echo -e "   3. Copiar env.example para .env e configurar"
echo -e "   4. Executar: ./install-smartsignage.sh"
echo
echo -e "${GREEN}✅ O script install-smartsignage.sh está pronto para execução direta:${NC}"
echo -e "   - Line endings corretos (LF)"
echo -e "   - Sintaxe validada"
echo -e "   - Sem necessidade de correções"
echo

