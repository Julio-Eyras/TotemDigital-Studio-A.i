#!/bin/bash

# =============================================================================
# Script para criar pacote de distribuição COMPLETO e INDEPENDENTE
# =============================================================================
# Este script copia TODOS os arquivos necessários para o diretório de
# distribuição, garantindo que seja totalmente independente do diretório origem
# =============================================================================

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Diretórios
SOURCE_DIR="$(pwd)"
DIST_DIR="$SOURCE_DIR/SmartSignage-Pro-Distribuicao" 

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                    Criando Pacote de Distribuição Completo${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Remover diretório de distribuição existente
if [[ -d "$DIST_DIR" ]]; then
    echo -e "${YELLOW}Removendo diretório de distribuição existente...${NC}"
    rm -rf "$DIST_DIR"
fi

# Criar diretório de distribuição
mkdir -p "$DIST_DIR"
echo -e "${GREEN}✅ Diretório criado: $DIST_DIR${NC}"
echo

# Função para copiar diretório
copy_dir() {
    local src="$1"
    local dst="$2"
    local desc="$3"
    
    if [[ -d "$src" ]]; then
        echo -e "${GREEN}Copiando $desc...${NC}"
        mkdir -p "$dst"
        cp -r "$src"/* "$dst/" 2>/dev/null || true
        
        # Converter line endings de todos os scripts .sh (CRLF -> LF)
        find "$dst" -name "*.sh" -type f -exec sed -i 's/\r$//' {} \; 2>/dev/null || true
        find "$dst" -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
        
        echo -e "${GREEN}  ✅ $desc copiado${NC}"
    else
        echo -e "${YELLOW}  ⚠️  $desc não encontrado: $src${NC}"
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
        echo -e "${GREEN}  ✅ $desc copiado${NC}"
    else
        echo -e "${YELLOW}  ⚠️  $desc não encontrado: $src${NC}"
    fi
}

# Função para copiar script shell com conversão de line endings
copy_shell_script() {
    local src="$1"
    local dst="$2"
    local desc="$3"
    
    if [[ -f "$src" ]]; then
        mkdir -p "$(dirname "$dst")"
        # Converter CRLF para LF e garantir encoding UTF-8
        sed 's/\r$//' "$src" > "$dst"
        chmod +x "$dst" 2>/dev/null || true
        echo -e "${GREEN}  ✅ $desc copiado (line endings convertidos)${NC}"
    else
        echo -e "${YELLOW}  ⚠️  $desc não encontrado: $src${NC}"
    fi
}

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                    Copiando Componentes Principais${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# 1. Backend completo
copy_dir "$SOURCE_DIR/backend" "$DIST_DIR/backend" "Backend completo"

# 2. Frontend completo
copy_dir "$SOURCE_DIR/frontend" "$DIST_DIR/frontend" "Frontend completo"

# 3. Player-client completo (inclui todas as plataformas: webos, android, linux, tizen, windows)
copy_dir "$SOURCE_DIR/player-client" "$DIST_DIR/player-client" "Player-client completo (todas plataformas)"

# 4. Player-SmartDisplayFX-client
copy_dir "$SOURCE_DIR/Player-SmartDisplayFX-client" "$DIST_DIR/Player-SmartDisplayFX-client" "Player-SmartDisplayFX-client"

# 5. Player-Smart-FX-Interface
copy_dir "$SOURCE_DIR/Player-Smart-FX-Interface" "$DIST_DIR/Player-Smart-FX-Interface" "Player-Smart-FX-Interface"

# 6. Player-agent (se existir)
copy_dir "$SOURCE_DIR/player-agent" "$DIST_DIR/player-agent" "Player-agent"

# 7. Player-fx (se existir)
copy_dir "$SOURCE_DIR/player-fx" "$DIST_DIR/player-fx" "Player-fx"

# 8. player-web-cache (diretório genérico, se existir)
copy_dir "$SOURCE_DIR/player-web-cache" "$DIST_DIR/player-web-cache" "Player genérico - player-web-cache"

# 9. Database
copy_dir "$SOURCE_DIR/database" "$DIST_DIR/database" "Database (schema e scripts)"

# 10. Docker
copy_dir "$SOURCE_DIR/docker" "$DIST_DIR/docker" "Docker (entrypoints e configs)"

# 11. Nginx
copy_dir "$SOURCE_DIR/nginx" "$DIST_DIR/nginx" "Nginx (configurações)"

# 12. Monitoring
copy_dir "$SOURCE_DIR/monitoring" "$DIST_DIR/monitoring" "Monitoring (Prometheus + Grafana)"

# 13. Scripts
echo -e "${GREEN}Copiando Scripts...${NC}"
mkdir -p "$DIST_DIR/scripts"
if [[ -f "$SOURCE_DIR/scripts/install-smartsignage.sh" ]]; then
    # Converter line endings (CRLF -> LF) ao copiar
    sed 's/\r$//' "$SOURCE_DIR/scripts/install-smartsignage.sh" > "$DIST_DIR/scripts/install-smartsignage.sh"
    chmod +x "$DIST_DIR/scripts/install-smartsignage.sh"
    echo -e "${GREEN}  ✅ install-smartsignage.sh copiado (line endings convertidos)${NC}"
fi
if [[ -d "$SOURCE_DIR/scripts" ]]; then
    # Copiar todos os scripts úteis (excluindo temporários)
    find "$SOURCE_DIR/scripts" -type f -name "*.sh" -o -name "*.ps1" | while read script; do
        rel_path="${script#$SOURCE_DIR/scripts/}"
        mkdir -p "$DIST_DIR/scripts/$(dirname "$rel_path")"
        cp "$script" "$DIST_DIR/scripts/$rel_path"
    done
    echo -e "${GREEN}  ✅ Scripts copiados${NC}"
fi

echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                    Copiando Arquivos de Configuração${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Arquivos de configuração na raiz
copy_file "$SOURCE_DIR/docker-compose.yml" "$DIST_DIR/docker-compose.yml" "docker-compose.yml"
copy_file "$SOURCE_DIR/Dockerfile.app" "$DIST_DIR/Dockerfile.app" "Dockerfile.app"
copy_file "$SOURCE_DIR/Dockerfile.backend" "$DIST_DIR/Dockerfile.backend" "Dockerfile.backend"
copy_file "$SOURCE_DIR/Dockerfile.frontend" "$DIST_DIR/Dockerfile.frontend" "Dockerfile.frontend"
copy_file "$SOURCE_DIR/env.example" "$DIST_DIR/env.example" "env.example"

# Verificar se há Dockerfile na raiz
if [[ -f "$SOURCE_DIR/Dockerfile" ]]; then
    copy_file "$SOURCE_DIR/Dockerfile" "$DIST_DIR/Dockerfile" "Dockerfile"
fi

echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                    Copiando Documentação${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Documentação existente no diretório de distribuição (se houver)
if [[ -d "$SOURCE_DIR/docs" ]]; then
    copy_dir "$SOURCE_DIR/docs" "$DIST_DIR/docs" "Documentação"
fi

# Copiar documentação específica se existir
if [[ -f "$SOURCE_DIR/README.md" ]]; then
    copy_file "$SOURCE_DIR/README.md" "$DIST_DIR/README.md" "README.md"
fi

echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                    Criando Arquivos de Metadados${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Criar arquivo de versão
cat > "$DIST_DIR/VERSION.txt" << EOF
SmartSignage Pro - Pacote de Distribuição
Versão: $(date +%Y.%m.%d)
Data de Criação: $(date +"%Y-%m-%d %H:%M:%S")
EOF
echo -e "${GREEN}  ✅ VERSION.txt criado${NC}"

# Criar arquivo de verificação
cat > "$DIST_DIR/verificar-pacote.sh" << 'VERIFY_EOF'
#!/bin/bash
# Script de verificação do pacote de distribuição

echo "Verificando integridade do pacote..."

ERRORS=0

# Verificar diretórios essenciais
for dir in backend frontend database docker nginx monitoring scripts; do
    if [[ ! -d "$dir" ]]; then
        echo "❌ Diretório faltando: $dir"
        ERRORS=$((ERRORS + 1))
    else
        echo "✅ $dir"
    fi
done

# Verificar arquivos essenciais
for file in docker-compose.yml Dockerfile.app env.example scripts/install-smartsignage.sh; do
    if [[ ! -f "$file" ]]; then
        echo "❌ Arquivo faltando: $file"
        ERRORS=$((ERRORS + 1))
    else
        echo "✅ $file"
    fi
done

# Verificar backend
if [[ ! -f "backend/package.json" ]] || [[ ! -d "backend/src" ]]; then
    echo "❌ Backend incompleto"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Backend completo"
fi

# Verificar frontend
if [[ ! -f "frontend/package.json" ]] || [[ ! -d "frontend/src" ]]; then
    echo "❌ Frontend incompleto"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Frontend completo"
fi

if [[ $ERRORS -eq 0 ]]; then
    echo ""
    echo "✅ Pacote completo e pronto para distribuição!"
    exit 0
else
    echo ""
    echo "❌ Pacote incompleto! $ERRORS erro(s) encontrado(s)."
    exit 1
fi
VERIFY_EOF

chmod +x "$DIST_DIR/verificar-pacote.sh"
echo -e "${GREEN}  ✅ verificar-pacote.sh criado${NC}"

# CORREÇÃO CRÍTICA: Corrigir permissões de diretórios e arquivos
# Diretórios precisam de permissão de execução (x) para serem acessados no Linux
echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                    Corrigindo Permissões${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

echo -e "${GREEN}Corrigindo permissões de diretórios (755) e arquivos (644)...${NC}"

# Corrigir permissões de todos os diretórios (precisam de execução)
find "$DIST_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
echo -e "${GREEN}✅ Permissões de diretórios corrigidas (755)${NC}"

# Corrigir permissões de todos os arquivos
find "$DIST_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
echo -e "${GREEN}✅ Permissões de arquivos corrigidas (644)${NC}"

# Garantir que scripts .sh tenham permissão de execução
find "$DIST_DIR" -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
echo -e "${GREEN}✅ Scripts .sh com permissão de execução${NC}"

echo -e "${GREEN}✅ Permissões corrigidas - arquivos prontos para distribuição${NC}"

echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                    Verificação Final${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Executar verificação
cd "$DIST_DIR"
if [[ -f "verificar-pacote.sh" ]]; then
    bash verificar-pacote.sh
fi

echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                    ✅ PACOTE DE DISTRIBUIÇÃO CRIADO COM SUCESSO!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
echo -e "${GREEN}📦 Diretório: $DIST_DIR${NC}"
echo -e "${GREEN}📝 O pacote é totalmente independente e pode ser distribuído/compactado${NC}"
echo



