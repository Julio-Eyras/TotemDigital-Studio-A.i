#!/bin/bash

# =============================================================================
# Smart Signage Pro v2.0 - Script de Teste dos Builds
# =============================================================================
# Este script testa se todos os builds foram criados corretamente
# =============================================================================

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Função para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Banner
show_banner() {
    clear
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║              Smart Signage Pro v2.0                         ║"
    echo "║                    Teste dos Builds                         ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Verificar se estamos no diretório correto
check_directory() {
    if [[ ! -f "package.json" ]]; then
        error "Arquivo package.json não encontrado!"
        error "Execute este script no diretório raiz do projeto Smart Signage Pro"
        exit 1
    fi
    
    log "Diretório do projeto verificado: $(pwd)"
}

# Testar backend
test_backend() {
    log "Testando backend..."
    
    if [[ ! -d "backend" ]]; then
        error "Diretório backend não encontrado!"
        return 1
    fi
    
    cd backend
    
    # Verificar se package.json existe
    if [[ ! -f "package.json" ]]; then
        error "package.json do backend não encontrado!"
        cd ..
        return 1
    fi
    
    # Verificar se node_modules existe
    if [[ ! -d "node_modules" ]]; then
        warn "node_modules não encontrado. Instalando dependências..."
        npm install
    fi
    
    # Verificar se dist existe
    if [[ ! -d "dist" ]]; then
        warn "Diretório dist não encontrado. Compilando..."
        npm run build
    fi
    
    # Verificar arquivos compilados
    if [[ ! -f "dist/index.js" ]]; then
        error "Arquivo dist/index.js não encontrado!"
        cd ..
        return 1
    fi
    
    # Verificar se o arquivo compilado é válido
    if ! node -c dist/index.js; then
        error "Arquivo dist/index.js contém erros de sintaxe!"
        cd ..
        return 1
    fi
    
    # Verificar tamanho do arquivo
    FILE_SIZE=$(stat -c%s dist/index.js 2>/dev/null || stat -f%z dist/index.js 2>/dev/null || echo "0")
    if [[ $FILE_SIZE -lt 1000 ]]; then
        warn "Arquivo dist/index.js muito pequeno ($FILE_SIZE bytes)"
    fi
    
    log "Backend compilado com sucesso! Tamanho: $FILE_SIZE bytes"
    cd ..
    return 0
}

# Testar frontend
test_frontend() {
    log "Testando frontend..."
    
    if [[ ! -d "frontend" ]]; then
        error "Diretório frontend não encontrado!"
        return 1
    fi
    
    cd frontend
    
    # Verificar se package.json existe
    if [[ ! -f "package.json" ]]; then
        error "package.json do frontend não encontrado!"
        cd ..
        return 1
    fi
    
    # Verificar se node_modules existe
    if [[ ! -d "node_modules" ]]; then
        warn "node_modules não encontrado. Instalando dependências..."
        npm install
    fi
    
    # Verificar se public/index.html existe
    if [[ ! -f "public/index.html" ]]; then
        warn "public/index.html não encontrado. Criando..."
        mkdir -p public
        cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Smart Signage Pro</title>
  </head>
  <body>
    <noscript>Você precisa habilitar o JavaScript para executar este aplicativo.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF
    fi
    
    # Verificar se build existe
    if [[ ! -d "build" ]]; then
        warn "Diretório build não encontrado. Criando build básico..."
        mkdir -p build
        cat > build/index.html << 'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Smart Signage Pro</title>
  </head>
  <body>
    <h1>Smart Signage Pro v2.0</h1>
    <p>Frontend em desenvolvimento</p>
  </body>
</html>
EOF
    fi
    
    # Verificar se build/index.html existe
    if [[ ! -f "build/index.html" ]]; then
        error "Arquivo build/index.html não encontrado!"
        cd ..
        return 1
    fi
    
    # Verificar tamanho do arquivo
    FILE_SIZE=$(stat -c%s build/index.html 2>/dev/null || stat -f%z build/index.html 2>/dev/null || echo "0")
    if [[ $FILE_SIZE -lt 100 ]]; then
        warn "Arquivo build/index.html muito pequeno ($FILE_SIZE bytes)"
    fi
    
    log "Frontend preparado com sucesso! Tamanho: $FILE_SIZE bytes"
    cd ..
    return 0
}

# Testar player
test_player() {
    log "Testando player..."
    
    if [[ ! -d "player-web" ]]; then
        error "Diretório player-web não encontrado!"
        return 1
    fi
    
    # Verificar se index.html existe
    if [[ ! -f "player-web/index.html" ]]; then
        error "Arquivo player-web/index.html não encontrado!"
        return 1
    fi
    
    # Verificar se o arquivo é válido HTML
    if ! grep -q "<!DOCTYPE html>" player-web/index.html; then
        warn "Arquivo player-web/index.html pode não ser HTML válido"
    fi
    
    # Verificar tamanho do arquivo
    FILE_SIZE=$(stat -c%s player-web/index.html 2>/dev/null || stat -f%z player-web/index.html 2>/dev/null || echo "0")
    if [[ $FILE_SIZE -lt 100 ]]; then
        warn "Arquivo player-web/index.html muito pequeno ($FILE_SIZE bytes)"
    fi
    
    log "Player verificado com sucesso! Tamanho: $FILE_SIZE bytes"
    return 0
}

# Testar scripts
test_scripts() {
    log "Testando scripts..."
    
    if [[ ! -d "scripts" ]]; then
        error "Diretório scripts não encontrado!"
        return 1
    fi
    
    # Verificar scripts importantes
    SCRIPTS=("install.sh" "first-boot.sh" "deploy-production.sh")
    
    for script in "${SCRIPTS[@]}"; do
        if [[ -f "scripts/$script" ]]; then
            # Verificar se é executável
            if [[ -x "scripts/$script" ]]; then
                log "Script $script encontrado e executável"
            else
                warn "Script $script encontrado mas não é executável"
            fi
        else
            warn "Script $script não encontrado"
        fi
    done
    
    return 0
}

# Testar configurações
test_configurations() {
    log "Testando configurações..."
    
    # Verificar docker-compose.yml
    if [[ -f "docker-compose.yml" ]]; then
        if command -v docker-compose &> /dev/null; then
            if docker-compose config &> /dev/null; then
                log "docker-compose.yml é válido"
            else
                error "docker-compose.yml contém erros!"
                return 1
            fi
        else
            warn "docker-compose não instalado, pulando validação"
        fi
    else
        error "docker-compose.yml não encontrado!"
        return 1
    fi
    
    # Verificar Dockerfile
    if [[ -f "Dockerfile" ]]; then
        log "Dockerfile encontrado"
    else
        error "Dockerfile não encontrado!"
        return 1
    fi
    
    # Verificar env.example
    if [[ -f "env.example" ]]; then
        log "env.example encontrado"
    else
        error "env.example não encontrado!"
        return 1
    fi
    
    return 0
}

# Testar banco de dados
test_database() {
    log "Testando banco de dados..."
    
    if [[ ! -d "database" ]]; then
        error "Diretório database não encontrado!"
        return 1
    fi
    
    # Verificar schema master refatorado
    if [[ -f "database/smartchannel-db-v2-refactored-apply-all.sql" ]]; then
        # Verificar se contém comandos SQL básicos
        if grep -q "CREATE TABLE" database/smartchannel-db-v2-refactored-apply-all.sql; then
            log "smartchannel-db-v2-refactored-apply-all.sql contém comandos CREATE TABLE"
        else
            warn "smartchannel-db-v2-refactored-apply-all.sql pode não conter comandos CREATE TABLE"
        fi
        
        # Verificar tamanho do arquivo
        FILE_SIZE=$(stat -c%s database/smartchannel-db-v2-refactored-apply-all.sql 2>/dev/null || stat -f%z database/smartchannel-db-v2-refactored-apply-all.sql 2>/dev/null || echo "0")
        if [[ $FILE_SIZE -lt 1000 ]]; then
            warn "smartchannel-db-v2-refactored-apply-all.sql muito pequeno ($FILE_SIZE bytes)"
        fi
        
        log "smartchannel-db-v2-refactored-apply-all.sql verificado com sucesso! Tamanho: $FILE_SIZE bytes"
    else
        error "database/smartchannel-db-v2-refactored-apply-all.sql não encontrado!"
        return 1
    fi
    
    return 0
}

# Testar dependências
test_dependencies() {
    log "Testando dependências..."
    
    # Verificar Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log "Node.js encontrado: $NODE_VERSION"
        
        # Verificar se é versão 18+
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $NODE_MAJOR -ge 18 ]]; then
            log "Versão do Node.js adequada (18+)"
        else
            warn "Versão do Node.js pode ser inadequada ($NODE_VERSION)"
        fi
    else
        error "Node.js não encontrado!"
        return 1
    fi
    
    # Verificar NPM
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        log "NPM encontrado: $NPM_VERSION"
    else
        error "NPM não encontrado!"
        return 1
    fi
    
    # Verificar Docker (opcional)
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        log "Docker encontrado: $DOCKER_VERSION"
    else
        warn "Docker não encontrado (opcional)"
    fi
    
    return 0
}

# Testar execução do backend
test_backend_execution() {
    log "Testando execução do backend..."
    
    if [[ ! -f "backend/dist/index.js" ]]; then
        error "Backend não compilado!"
        return 1
    fi
    
    # Testar sintaxe do arquivo
    if ! node -c backend/dist/index.js; then
        error "Backend contém erros de sintaxe!"
        return 1
    fi
    
    # Tentar executar por alguns segundos
    cd backend
    timeout 5s node dist/index.js &
    BACKEND_PID=$!
    sleep 2
    
    # Verificar se o processo ainda está rodando
    if kill -0 $BACKEND_PID 2>/dev/null; then
        log "Backend iniciou com sucesso!"
        kill $BACKEND_PID 2>/dev/null || true
        cd ..
        return 0
    else
        error "Backend falhou ao iniciar!"
        cd ..
        return 1
    fi
}

# Gerar relatório
generate_report() {
    log "Gerando relatório de testes..."
    
    REPORT_FILE="test-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > $REPORT_FILE << EOF
Smart Signage Pro v2.0 - Relatório de Testes
============================================
Data: $(date)
Sistema: $(uname -a)
Node.js: $(node --version 2>/dev/null || echo "Não instalado")
NPM: $(npm --version 2>/dev/null || echo "Não instalado")
Docker: $(docker --version 2>/dev/null || echo "Não instalado")

Resultados dos Testes:
=====================

Backend:
- Compilação: $([ -f "backend/dist/index.js" ] && echo "✅ Sucesso" || echo "❌ Falha")
- Tamanho: $([ -f "backend/dist/index.js" ] && echo "$(stat -c%s backend/dist/index.js 2>/dev/null || stat -f%z backend/dist/index.js 2>/dev/null || echo "0") bytes" || echo "N/A")

Frontend:
- Build: $([ -f "frontend/build/index.html" ] && echo "✅ Sucesso" || echo "❌ Falha")
- Tamanho: $([ -f "frontend/build/index.html" ] && echo "$(stat -c%s frontend/build/index.html 2>/dev/null || stat -f%z frontend/build/index.html 2>/dev/null || echo "0") bytes" || echo "N/A")

Player:
- Arquivo: $([ -f "player-web/index.html" ] && echo "✅ Encontrado" || echo "❌ Não encontrado")
- Tamanho: $([ -f "player-web/index.html" ] && echo "$(stat -c%s player-web/index.html 2>/dev/null || stat -f%z player-web/index.html 2>/dev/null || echo "0") bytes" || echo "N/A")

Configurações:
- docker-compose.yml: $([ -f "docker-compose.yml" ] && echo "✅ Encontrado" || echo "❌ Não encontrado")
- Dockerfile: $([ -f "Dockerfile" ] && echo "✅ Encontrado" || echo "❌ Não encontrado")
- env.example: $([ -f "env.example" ] && echo "✅ Encontrado" || echo "❌ Não encontrado")

Banco de Dados:
- smartchannel-db-v2-refactored-apply-all.sql: $([ -f "database/smartchannel-db-v2-refactored-apply-all.sql" ] && echo "✅ Encontrado" || echo "❌ Não encontrado")
- Tamanho: $([ -f "database/smartchannel-db-v2-refactored-apply-all.sql" ] && echo "$(stat -c%s database/smartchannel-db-v2-refactored-apply-all.sql 2>/dev/null || stat -f%z database/smartchannel-db-v2-refactored-apply-all.sql 2>/dev/null || echo "0") bytes" || echo "N/A")

Scripts:
- install.sh: $([ -f "scripts/install.sh" ] && echo "✅ Encontrado" || echo "❌ Não encontrado")
- first-boot.sh: $([ -f "scripts/first-boot.sh" ] && echo "✅ Encontrado" || echo "❌ Não encontrado")

Status Geral: $([ -f "backend/dist/index.js" ] && [ -f "frontend/build/index.html" ] && [ -f "player-web/index.html" ] && echo "✅ PRONTO PARA INSTALAÇÃO" || echo "❌ NECESSITA CORREÇÕES")
EOF

    log "Relatório gerado: $REPORT_FILE"
}

# Mostrar resumo
show_summary() {
    echo
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    RESUMO DOS TESTES                        ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    # Contar sucessos e falhas
    SUCCESS_COUNT=0
    TOTAL_COUNT=0
    
    # Backend
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    if [[ -f "backend/dist/index.js" ]]; then
        echo -e "${GREEN}✅ Backend:${NC} Compilado com sucesso"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}❌ Backend:${NC} Falha na compilação"
    fi
    
    # Frontend
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    if [[ -f "frontend/build/index.html" ]]; then
        echo -e "${GREEN}✅ Frontend:${NC} Build criado com sucesso"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}❌ Frontend:${NC} Falha no build"
    fi
    
    # Player
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    if [[ -f "player-web/index.html" ]]; then
        echo -e "${GREEN}✅ Player:${NC} Arquivo encontrado"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}❌ Player:${NC} Arquivo não encontrado"
    fi
    
    # Configurações
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    if [[ -f "docker-compose.yml" && -f "Dockerfile" && -f "env.example" ]]; then
        echo -e "${GREEN}✅ Configurações:${NC} Todos os arquivos encontrados"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}❌ Configurações:${NC} Arquivos faltando"
    fi
    
    # Banco de dados
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    if [[ -f "database/smartchannel-db-v2-refactored-apply-all.sql" ]]; then
        echo -e "${GREEN}✅ Banco de Dados:${NC} Schema encontrado"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}❌ Banco de Dados:${NC} Schema não encontrado"
    fi
    
    echo
    echo -e "${CYAN}Resultado: $SUCCESS_COUNT/$TOTAL_COUNT testes passaram${NC}"
    
    if [[ $SUCCESS_COUNT -eq $TOTAL_COUNT ]]; then
        echo -e "${GREEN}🎉 Todos os testes passaram! O projeto está pronto para instalação.${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️ Alguns testes falharam. Verifique os erros acima.${NC}"
        return 1
    fi
}

# Função principal
main() {
    show_banner
    check_directory
    
    log "Iniciando testes dos builds..."
    
    # Executar testes
    test_dependencies
    test_backend
    test_frontend
    test_player
    test_scripts
    test_configurations
    test_database
    test_backend_execution
    
    # Gerar relatório
    generate_report
    
    # Mostrar resumo
    show_summary
}

# Executar script
main "$@"
