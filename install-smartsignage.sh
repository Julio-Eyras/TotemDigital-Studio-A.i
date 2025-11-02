#!/bin/bash

# =============================================================================
# Smart Signage Pro v2.0 - Script de Auto-Instalação para Ubuntu
# =============================================================================
# Este script instala automaticamente o Smart Signage Pro em sistemas Ubuntu
# Suporta 3 modos: Single-Server, Docker, Desenvolvimento
#
# Uso: ./install-smartsignage.sh [OPÇÕES]
#
# OPÇÕES:
#   --fresh              Instalação COMPLETA do zero (apaga TUDO, incluindo volumes)
#   --rebuild            Rebuild containers preservando dados (volumes mantidos)
#   --rebuild-cache      Rebuild SEM cache do Docker (mais lento, mais garantido)
#   --rebuild-only       Apenas rebuild, não inicia serviços
#   --force              Força rebuild mesmo se não detectar mudanças
#   --check-only         Apenas verifica se rebuild é necessário (não executa)
#   --skip-menu          Pula menu interativo (usa modo Docker por padrão)
#   --https-self-signed  Habilita HTTPS com certificado autoassinado (single-server)
# =============================================================================

set -e  # Parar em caso de erro
set -o pipefail

# Trap de erro para diagnóstico rápido
trap 'echo -e "\033[0;31m[ERRO]\033[0m Falha na execução (linha $LINENO)."' ERR

# =============================================================================
# VARIÁVEIS GLOBAIS E FLAGS
# =============================================================================
FRESH_MODE=false
REBUILD_MODE=false
REBUILD_CACHE=false
REBUILD_ONLY=false
FORCE_REBUILD=false
CHECK_ONLY=false
SKIP_MENU=false
INSTALL_MODE=""
ENABLE_HTTPS_SELF_SIGNED=false
ENABLE_HTTPS_LETSENCRYPT=false
DOMAIN_NAME=""
SSL_EMAIL=""
ENABLE_KIOSK_MODE=false

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

# Função de log detalhado para diagnóstico
log_detailed() {
    echo -e "${BLUE}[DETALHADO $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Função de log de erro detalhado
log_error() {
    echo -e "${RED}[ERRO $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Função de log de progresso
log_progress() {
    echo -e "${CYAN}[PROGRESSO $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Função de log de status
log_status() {
    echo -e "${PURPLE}[STATUS $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Função para log de container
log_container() {
    echo -e "${YELLOW}[CONTAINER $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Retry genérico com backoff exponencial
retry_with_backoff() {
    local max_attempts=$1
    local initial_delay_seconds=$2
    shift 2
    local attempt=1
    local delay=$initial_delay_seconds
    while true; do
        if "$@"; then
            return 0
        fi
        if [[ $attempt -ge $max_attempts ]]; then
            return 1
        fi
        log "Tentativa ${attempt}/${max_attempts} falhou. Aguardando ${delay}s e tentando novamente..."
        sleep "$delay"
        attempt=$((attempt+1))
        delay=$((delay*2))
        if [[ $delay -gt 30 ]]; then delay=30; fi
    done
}

# Banner
show_banner() {
    clear
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    Smart Signage Pro v2.0                   ║"
    echo "║              Sistema de Sinalização Digital                 ║"
    echo "║                    Auto-Instalação Ubuntu                   ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# =============================================================================
# PARSE DE ARGUMENTOS
# =============================================================================
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --fresh)
                FRESH_MODE=true
                REBUILD_MODE=true
                FORCE_REBUILD=true
                SKIP_MENU=true
                INSTALL_MODE="docker"
                shift
                ;;
            --rebuild)
                REBUILD_MODE=true
                shift
                ;;
            --rebuild-cache)
                REBUILD_MODE=true
                REBUILD_CACHE=true
                shift
                ;;
            --rebuild-only)
                REBUILD_MODE=true
                REBUILD_ONLY=true
                shift
                ;;
            --force)
                FORCE_REBUILD=true
                shift
                ;;
            --check-only)
                CHECK_ONLY=true
                shift
                ;;
            --skip-menu)
                SKIP_MENU=true
                INSTALL_MODE="docker"
                shift
                ;;
            --https-self-signed)
                ENABLE_HTTPS_SELF_SIGNED=true
                shift
                ;;
            --help|-h)
                echo "Smart Signage Pro v2.0 - Script de Instalação"
                echo ""
                echo "Uso: $0 [OPÇÕES]"
                echo ""
                echo "OPÇÕES:"
                echo "  --fresh              Instalação COMPLETA do zero (apaga TUDO)"
                echo "  --rebuild            Rebuild preservando dados"
                echo "  --rebuild-cache      Rebuild sem cache Docker"
                echo "  --rebuild-only       Apenas rebuild, não inicia"
                echo "  --force              Força rebuild sempre"
                echo "  --check-only         Apenas verifica se precisa rebuild"
                echo "  --skip-menu          Pula menu (usa Docker)"
                echo "  --https-self-signed  Habilita HTTPS autoassinado (single-server)"
                echo "  --help               Mostra esta ajuda"
                exit 0
                ;;
            *)
                error "Opção desconhecida: $1"
                error "Use --help para ver opções disponíveis"
                exit 1
                ;;
        esac
    done
}

# Verificar se é root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "Este script não deve ser executado como root!"
        error "Execute como usuário normal (será solicitado sudo quando necessário)"
        exit 1
    fi
}

# Verificar sistema operacional
check_os() {
    if [[ ! -f /etc/os-release ]]; then
        error "Sistema operacional não suportado!"
        exit 1
    fi
    
    . /etc/os-release
    
    if [[ "$ID" != "ubuntu" ]]; then
        warn "Este script foi testado apenas no Ubuntu. Continuando..."
    fi
    
    log "Sistema detectado: $PRETTY_NAME"
}

# Atualizar sistema
update_system() {
    log "Atualizando sistema..."
    sudo apt update && sudo apt upgrade -y
    log "Sistema atualizado com sucesso!"
}

# Instalar dependências básicas
install_dependencies() {
    log "Instalando dependências básicas..."
    
    sudo apt install -y \
        curl \
        wget \
        git \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        build-essential \
        python3 \
        python3-pip \
        postgresql-client \
        sqlite3 \
        nginx \
        ufw \
        htop \
        nano \
        vim
    
    log "Dependências básicas instaladas!"
}

# Instalar Node.js
install_nodejs() {
    log "Instalando Node.js..."
    
    # Verificar se Node.js já está instalado
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $NODE_VERSION -ge 18 ]]; then
            log "Node.js v$(node --version) já está instalado!"
            return
        else
            warn "Node.js versão antiga detectada. Atualizando..."
        fi
    fi
    
    # Instalar Node.js 18.x
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    
    log "Node.js $(node --version) instalado com sucesso!"
    log "NPM $(npm --version) instalado com sucesso!"
}

# Instalar Docker (opcional)
install_docker() {
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        log "Instalando Docker..."
        
        # Verificar se Docker já está instalado e funcionando
        if command -v docker &> /dev/null && systemctl is-active --quiet docker; then
            log "Docker já está instalado e funcionando!"
            # Verificar se Docker Compose está instalado
            if command -v docker-compose &> /dev/null; then
                log "Docker Compose já está instalado!"
                return
            fi
        else
            # Instalar Docker
            log "Baixando e instalando Docker..."
            curl -fsSL https://get.docker.com -o get-docker.sh
            sudo sh get-docker.sh
            rm -f get-docker.sh
            
            # Configurar Docker
            sudo systemctl start docker
            sudo systemctl enable docker
            sudo usermod -aG docker $USER
            
            # Verificar se Docker está funcionando
            if ! systemctl is-active --quiet docker; then
                error "Falha ao iniciar Docker!"
                exit 1
            fi
            
            log "Docker $(docker --version) instalado com sucesso!"
        fi
        
        # Instalar Docker Compose
        if ! command -v docker-compose &> /dev/null; then
            log "Instalando Docker Compose..."
            DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')
            sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            sudo chmod +x /usr/local/bin/docker-compose
            
            # Verificar instalação
            if ! docker-compose --version &> /dev/null; then
                error "Falha ao instalar Docker Compose!"
                exit 1
            fi
            
            log "Docker Compose $(docker-compose --version) instalado com sucesso!"
        fi
        
        # Aplicar grupo docker imediatamente
        newgrp docker << EONG
        log "Grupo docker aplicado para esta sessão"
EONG
        
        warn "Docker instalado! Se houver problemas de permissão, faça logout e login novamente."
    fi
}

# Configurar firewall
configure_firewall() {
    log "Configurando firewall..."
    
    sudo ufw --force reset
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Portas padrão
    sudo ufw allow 22/tcp    # SSH
    sudo ufw allow 80/tcp    # HTTP (legado/opcional)
    sudo ufw allow 8080/tcp  # Frontend HTTP (padrão novo)
    sudo ufw allow 443/tcp   # HTTPS
    sudo ufw allow 3000/tcp  # Backend
    sudo ufw allow 3001/tcp  # Frontend alternativo
    
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        sudo ufw allow 5432/tcp  # PostgreSQL
        sudo ufw allow 6379/tcp  # Redis
        sudo ufw allow 9090/tcp  # Prometheus
        sudo ufw allow 3002/tcp  # Grafana
        sudo ufw allow 11434/tcp # Ollama
    fi
    
    sudo ufw --force enable
    log "Firewall configurado com sucesso!"
}

# Detectar diretório do projeto (apenas detecção, sem cópia)
detect_project_directory() {
    log "Detectando diretório do projeto..."
    
    # Detectar diretório do script
    SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
    log "Diretório do script: $SCRIPT_DIR"
    log "Diretório atual: $(pwd)"
    
    # Determinar diretório de origem (onde estão os arquivos do projeto)
    if [[ -d "backend" && -d "frontend" ]]; then
        SOURCE_DIR=$(pwd)
        log "Usando diretório atual como origem: $SOURCE_DIR"
    elif [[ -d "$SCRIPT_DIR/backend" && -d "$SCRIPT_DIR/frontend" ]]; then
        SOURCE_DIR="$SCRIPT_DIR"
        log "Usando diretório do script como origem: $SOURCE_DIR"
    else
        error "Arquivos do projeto não encontrados!"
        error "Verificando diretórios disponíveis:"
        log "Diretório atual:"
        ls -la $(pwd) || true
        log "Diretório do script:"
        ls -la "$SCRIPT_DIR" || true
        error "Execute este script no diretório raiz do projeto Smart Signage Pro"
        exit 1
    fi
    
    export SOURCE_DIR
    log "✅ Diretório de origem detectado: $SOURCE_DIR"
}

# Configurar projeto (define INSTALL_DIR baseado no modo)
setup_project() {
    log "Configurando projeto Smart Signage Pro..."
    
    # SOURCE_DIR deve ter sido definido por detect_project_directory()
    if [[ -z "$SOURCE_DIR" ]]; then
        detect_project_directory
    fi
    
    # Para single-server, usar diretório de origem diretamente (mais simples e confiável)
    # Para Docker, ainda copiar para /opt/smart-signage (padrão do docker-compose)
    if [[ "$INSTALL_MODE" == "single-server" ]] || [[ "$INSTALL_MODE" == "development" ]]; then
        INSTALL_DIR="$SOURCE_DIR"
        log "Modo Single-Server: usando diretório de origem diretamente: $INSTALL_DIR"
        log "✅ Não será necessário copiar arquivos - trabalhando diretamente do diretório de origem"
        
        # Apenas garantir que estamos no diretório correto
        cd "$INSTALL_DIR"
    else
        # Modo Docker: copiar para /opt/smart-signage
        INSTALL_DIR="/opt/smart-signage"
        sudo mkdir -p $INSTALL_DIR
        sudo chown $USER:$USER $INSTALL_DIR
        log "Modo Docker: copiando para $INSTALL_DIR"
        
        # Copiar arquivos do projeto (apenas para Docker, Single-Server usa diretório de origem)
        if [[ -d "$SOURCE_DIR/backend" && -d "$SOURCE_DIR/frontend" ]]; then
            log "Copiando arquivos do projeto de $SOURCE_DIR para $INSTALL_DIR..."
            
            # Usar rsync se disponível (mais eficiente e preserva permissões), senão usar cp
            if command -v rsync &> /dev/null; then
                log "Usando rsync para cópia recursiva eficiente..."
                
                # Copiar backend recursivamente
                log "Copiando backend..."
                rsync -av --delete "$SOURCE_DIR/backend/" "$INSTALL_DIR/backend/"
                
                # Copiar frontend recursivamente (garante TODOS os arquivos)
                log "Copiando frontend (recursivo completo)..."
                rsync -av --delete "$SOURCE_DIR/frontend/" "$INSTALL_DIR/frontend/"
                
                # Copiar outros diretórios importantes
                [[ -d "$SOURCE_DIR/player" ]] && rsync -av --delete "$SOURCE_DIR/player/" "$INSTALL_DIR/player/"
                [[ -d "$SOURCE_DIR/scripts" ]] && rsync -av --delete "$SOURCE_DIR/scripts/" "$INSTALL_DIR/scripts/"
                [[ -d "$SOURCE_DIR/database" ]] && rsync -av --delete "$SOURCE_DIR/database/" "$INSTALL_DIR/database/"
                [[ -d "$SOURCE_DIR/docker" ]] && rsync -av --delete "$SOURCE_DIR/docker/" "$INSTALL_DIR/docker/"
                [[ -d "$SOURCE_DIR/nginx" ]] && rsync -av --delete "$SOURCE_DIR/nginx/" "$INSTALL_DIR/nginx/"
                
                log "✅ Cópia recursiva completa com rsync concluída"
            else
                # Fallback para cp -a (preserva permissões e links simbólicos)
                log "Usando cp -a para cópia recursiva (rsync não disponível)..."
                
                # Copiar backend recursivamente
                log "Copiando backend..."
                cp -a "$SOURCE_DIR/backend" "$INSTALL_DIR/"
                
                # Copiar frontend recursivamente (garante TODOS os arquivos)
                log "Copiando frontend (recursivo completo)..."
                cp -a "$SOURCE_DIR/frontend" "$INSTALL_DIR/"
                
                # Copiar outros diretórios
                [[ -d "$SOURCE_DIR/player" ]] && cp -a "$SOURCE_DIR/player" "$INSTALL_DIR/"
                [[ -d "$SOURCE_DIR/scripts" ]] && cp -a "$SOURCE_DIR/scripts" "$INSTALL_DIR/"
                [[ -d "$SOURCE_DIR/database" ]] && rm -rf "$INSTALL_DIR/database" && cp -a "$SOURCE_DIR/database" "$INSTALL_DIR/"
                [[ -d "$SOURCE_DIR/docker" ]] && cp -a "$SOURCE_DIR/docker" "$INSTALL_DIR/"
                [[ -d "$SOURCE_DIR/nginx" ]] && cp -a "$SOURCE_DIR/nginx" "$INSTALL_DIR/"
                
                log "✅ Cópia recursiva completa com cp -a concluída"
            fi
        
            # Copiar arquivos essenciais (docker-compose.yml, Dockerfiles, etc)
            [[ -f "$SOURCE_DIR/docker-compose.yml" ]] && cp "$SOURCE_DIR/docker-compose.yml" "$INSTALL_DIR/"
            [[ -f "$SOURCE_DIR/Dockerfile" ]] && cp "$SOURCE_DIR/Dockerfile" "$INSTALL_DIR/"
            [[ -f "$SOURCE_DIR/Dockerfile.app" ]] && cp "$SOURCE_DIR/Dockerfile.app" "$INSTALL_DIR/"
            [[ -f "$SOURCE_DIR/Dockerfile.backend" ]] && cp "$SOURCE_DIR/Dockerfile.backend" "$INSTALL_DIR/"
            [[ -f "$SOURCE_DIR/Dockerfile.frontend" ]] && cp "$SOURCE_DIR/Dockerfile.frontend" "$INSTALL_DIR/"
            [[ -f "$SOURCE_DIR/env.example" ]] && cp "$SOURCE_DIR/env.example" "$INSTALL_DIR/.env"
            [[ -f "$SOURCE_DIR/package.json" ]] && cp "$SOURCE_DIR/package.json" "$INSTALL_DIR/"
            [[ -f "$SOURCE_DIR/manage-system.sh" ]] && cp "$SOURCE_DIR/manage-system.sh" "$INSTALL_DIR/"
            
            # Verificação final para Docker: garantir que App.tsx foi copiado
            if [[ ! -f "$INSTALL_DIR/frontend/src/App.tsx" ]]; then
                error "❌ App.tsx não foi copiado!"
                error "Verificando origem:"
                ls -la "$SOURCE_DIR/frontend/src/App.tsx" 2>/dev/null || error "App.tsx não existe na origem!"
                exit 1
            fi
            
            log "✅ Arquivos copiados com sucesso para $INSTALL_DIR"
        else
            error "Arquivos do projeto não encontrados em $SOURCE_DIR!"
            exit 1
        fi
    fi
    
    # Verificação final: garantir que arquivos essenciais existem
    log "Verificando arquivos essenciais..."
    
    if [[ ! -f "$INSTALL_DIR/frontend/src/App.tsx" ]]; then
        error "❌ App.tsx não encontrado em $INSTALL_DIR/frontend/src/App.tsx"
        error "Diretório atual: $(pwd)"
        error "INSTALL_DIR: $INSTALL_DIR"
        error "Verificando estrutura:"
        ls -la "$INSTALL_DIR/frontend/src/" 2>/dev/null || true
        exit 1
    fi
    
    if [[ ! -f "$INSTALL_DIR/frontend/src/index.tsx" ]]; then
        error "❌ index.tsx não encontrado em $INSTALL_DIR/frontend/src/index.tsx"
        exit 1
    fi
    
    if [[ ! -f "$INSTALL_DIR/frontend/package.json" ]]; then
        error "❌ package.json não encontrado em $INSTALL_DIR/frontend/package.json"
        exit 1
    fi
    
    log "✅ Todos os arquivos essenciais verificados"
    
    cd $INSTALL_DIR
    log "Projeto configurado em $INSTALL_DIR"
}

# Instalar dependências do projeto
install_project_dependencies() {
    log "Instalando dependências do projeto..."
    
    # No modo Docker, não instalamos/compilamos localmente (evita inconsistências do ambiente host).
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        log "Modo Docker: pulando instalação/compilação locais (será feito durante o Docker build)."
        return 0
    fi
    
    # Backend
    cd $INSTALL_DIR/backend
    log "Instalando dependências do backend (incluindo dev para build)..."
    npm install --include=dev
    
    # Compilar TypeScript do backend
    log "Compilando TypeScript do backend..."
    if npm run build; then
        log "✅ Backend compilado com sucesso!"
    else
        error "❌ Erro ao compilar backend TypeScript"
        exit 1
    fi
    
    # Frontend - sempre compilar para single-server também
    if [[ "$INSTALL_MODE" == "single-server" ]] || [[ "$INSTALL_MODE" == "development" ]]; then
        cd $INSTALL_DIR/frontend || {
            error "❌ Não foi possível entrar no diretório $INSTALL_DIR/frontend"
            exit 1
        }
        
        # CRÍTICO: Garantir tsconfig.json ANTES de instalar dependências
        # React Scripts precisa disso para resolver módulos corretamente
        if [[ ! -f "tsconfig.json" ]]; then
            log "⚠️  tsconfig.json não encontrado! Criando antes de instalar dependências..."
            cat > "tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": false,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
EOF
            log "✅ tsconfig.json criado"
        fi
        
        # Verificar se os arquivos essenciais estão presentes antes da compilação
        log "Verificando arquivos do frontend antes da compilação..."
        log "Diretório atual: $(pwd)"
        log "INSTALL_DIR: $INSTALL_DIR"
        
        # Verificar se index.tsx está importando corretamente
        if [[ -f "src/index.tsx" ]]; then
            log "Verificando importação em index.tsx..."
            if ! grep -q "from './App'" "src/index.tsx" && ! grep -q "from \"./App\"" "src/index.tsx"; then
                warn "⚠️  Import de App não encontrado em index.tsx como esperado"
                log "Conteúdo de index.tsx:"
                cat "src/index.tsx" | head -5
            fi
        fi
        
        # Verificação completa: listar estrutura de diretórios
        log "Verificando estrutura do diretório frontend:"
        log "  - Diretório frontend existe: $([[ -d "$INSTALL_DIR/frontend" ]] && echo "SIM" || echo "NÃO")"
        log "  - Diretório frontend/src existe: $([[ -d "$INSTALL_DIR/frontend/src" ]] && echo "SIM" || echo "NÃO")"
        log "  - Arquivo App.tsx existe: $([[ -f "$INSTALL_DIR/frontend/src/App.tsx" ]] && echo "SIM" || echo "NÃO")"
        log "  - Arquivo index.tsx existe: $([[ -f "$INSTALL_DIR/frontend/src/index.tsx" ]] && echo "SIM" || echo "NÃO")"
        
        # Verificar se estamos no diretório correto
        if [[ ! -d "src" ]]; then
            error "❌ Diretório src não encontrado em $(pwd)"
            error "Estrutura atual:"
            ls -la
            exit 1
        fi
        
        # Verificar se App.tsx existe ANTES de compilar
        if [[ ! -f "src/App.tsx" ]]; then
            error "❌ Arquivo src/App.tsx não encontrado em $(pwd)/src/"
            error "Listando arquivos em src/:"
            ls -la src/ 2>/dev/null || true
            error "Listando todos os arquivos .tsx em src/:"
            find src -name "*.tsx" 2>/dev/null || true
            error "Verificando se App.tsx existe em $INSTALL_DIR/frontend/src/:"
            ls -la "$INSTALL_DIR/frontend/src/App.tsx" 2>/dev/null || error "❌ App.tsx não existe!"
            error "O arquivo App.tsx é obrigatório para compilar o frontend!"
            exit 1
        fi
        
        # Verificar se index.tsx existe
        if [[ ! -f "src/index.tsx" ]]; then
            error "❌ Arquivo src/index.tsx não encontrado em $(pwd)/src/"
            error "Listando arquivos em src/:"
            ls -la src/ 2>/dev/null || true
            error "O arquivo index.tsx é obrigatório para compilar o frontend!"
            exit 1
        fi
        
        # Verificação adicional: confirmar que App.tsx pode ser lido
        if [[ ! -r "src/App.tsx" ]]; then
            error "❌ Arquivo src/App.tsx não pode ser lido (problema de permissões)"
            error "Permissões do arquivo:"
            ls -la src/App.tsx
            error "Ajustando permissões..."
            chmod 644 src/App.tsx || true
        fi
        
        # Listar arquivos principais para debug
        log "Arquivos principais encontrados em src/:"
        ls -la src/*.tsx src/*.ts 2>/dev/null | head -10 || true
        
        # Verificação adicional: verificar se App.tsx tem conteúdo válido
        if [[ -f "src/App.tsx" ]]; then
            log "Verificando conteúdo de App.tsx..."
            FILE_SIZE=$(wc -c < "src/App.tsx" 2>/dev/null || echo "0")
            log "  - Tamanho do arquivo: $FILE_SIZE bytes"
            
            if [[ $FILE_SIZE -eq 0 ]]; then
                error "❌ Arquivo App.tsx está vazio!"
                exit 1
            fi
            
            # Verificar se começa com import ou export (arquivo TypeScript válido)
            FIRST_LINE=$(head -n 1 "src/App.tsx" 2>/dev/null || echo "")
            if [[ ! "$FIRST_LINE" =~ ^(import|export) ]]; then
                warn "⚠️  Primeira linha de App.tsx não é um import/export: $FIRST_LINE"
                log "Primeiras 3 linhas de App.tsx:"
                head -n 3 "src/App.tsx" 2>/dev/null || true
            fi
        fi
        
        # Verificar encoding e caracteres especiais no nome do arquivo
        log "Verificando nome do arquivo App.tsx..."
        # Obter apenas o nome do arquivo (sem caminho)
        if [[ -f "src/App.tsx" ]]; then
            FILE_NAME=$(basename "src/App.tsx")
            log "  - Nome encontrado: '$FILE_NAME'"
            
            # Verificar se há problemas de case sensitivity (comparar apenas o nome)
            if [[ "$FILE_NAME" != "App.tsx" ]]; then
                warn "⚠️  Nome do arquivo não é exatamente 'App.tsx': '$FILE_NAME'"
                warn "Corrigindo nome do arquivo..."
                # Encontrar o arquivo com case incorreto
                for file in src/*.tsx; do
                    if [[ -f "$file" ]] && [[ "$(basename "$file" | tr '[:upper:]' '[:lower:]')" == "app.tsx" ]]; then
                        mv "$file" "src/App.tsx" && log "✅ Arquivo renomeado para App.tsx" || warn "⚠️  Não foi possível renomear"
                        break
                    fi
                done
            else
                log "✅ Nome do arquivo está correto: App.tsx"
            fi
        fi
        
        # Garantir permissões corretas
        chmod 644 src/App.tsx 2>/dev/null || true
        chmod 644 src/index.tsx 2>/dev/null || true
        
        log "✅ Arquivos essenciais do frontend encontrados (App.tsx, index.tsx)"
        
        # Limpar cache do React/Webpack antes de compilar (resolve problemas de módulos não encontrados)
        log "Limpando cache do build anterior..."
        rm -rf node_modules/.cache 2>/dev/null || true
        rm -rf build 2>/dev/null || true
        rm -rf .cache 2>/dev/null || true
        rm -rf .eslintcache 2>/dev/null || true
        # Limpar cache do npm também
        npm cache clean --force 2>/dev/null || true
        log "✅ Cache limpo"
        
        # Garantir que tsconfig.json existe e está configurado corretamente
        if [[ ! -f "tsconfig.json" ]]; then
            log "Criando tsconfig.json para o frontend..."
            cat > "tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": false,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
EOF
            log "✅ tsconfig.json criado"
        else
            log "✅ tsconfig.json já existe"
            # Verificar se moduleResolution está correto
            if ! grep -q '"moduleResolution"' "tsconfig.json"; then
                warn "⚠️  tsconfig.json não tem moduleResolution configurado"
                log "Adicionando moduleResolution: node..."
                # Adicionar moduleResolution se não existir
                sed -i '/"module":/a\    "moduleResolution": "node",' "tsconfig.json" 2>/dev/null || true
            fi
        fi
        
        # Verificação crítica: garantir que o diretório src está no include
        if ! grep -q '"src"' "tsconfig.json"; then
            warn "⚠️  tsconfig.json não inclui 'src'"
            log "Atualizando tsconfig.json para incluir src..."
            sed -i 's/"include":.*/"include": ["src"]/' "tsconfig.json" 2>/dev/null || true
        fi
        
        # Verificação final: tentar compilar apenas o App.tsx para verificar sintaxe
        log "Verificando sintaxe do App.tsx..."
        if command -v tsc &> /dev/null; then
            # Tentar verificar sintaxe TypeScript do App.tsx
            TEMP_TS_CONFIG=$(mktemp)
            cat > "$TEMP_TS_CONFIG" << 'EOF'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": false,
    "forceConsistentCasingInFileNames": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
EOF
            if tsc --noEmit --project "$TEMP_TS_CONFIG" src/App.tsx 2>&1 | grep -q "error"; then
                warn "⚠️  Erros de sintaxe detectados em App.tsx:"
                tsc --noEmit --project "$TEMP_TS_CONFIG" src/App.tsx 2>&1 | head -5
            else
                log "✅ Sintaxe do App.tsx está OK"
            fi
            rm -f "$TEMP_TS_CONFIG"
        fi
        
        # Verificação adicional: confirmar que index.tsx pode encontrar App.tsx
        log "Verificando se index.tsx pode importar App.tsx..."
        if grep -q "from './App'" "src/index.tsx" || grep -q "from \"./App\"" "src/index.tsx"; then
            log "✅ Importação em index.tsx está correta"
            
            # Verificação final: confirmar que App.tsx está no mesmo diretório
            log "Verificando localização exata do App.tsx..."
            if [[ -f "src/App.tsx" ]]; then
                log "✅ App.tsx confirmado em src/App.tsx"
                # Listar todos os arquivos .tsx em src/ para debug
                log "Arquivos .tsx em src/:"
                ls -1 src/*.tsx 2>/dev/null | head -5 || true
                
                # Verificar permissões e propriedade
                log "Informações detalhadas de App.tsx:"
                ls -la "src/App.tsx" 2>/dev/null || true
                
                # Tentar ler o arquivo diretamente para confirmar que está acessível
                if head -1 "src/App.tsx" > /dev/null 2>&1; then
                    log "✅ App.tsx pode ser lido diretamente"
                else
                    error "❌ App.tsx NÃO pode ser lido diretamente!"
                    error "Verificando permissões..."
                    chmod 644 "src/App.tsx" || true
                fi
            fi
        else
            warn "⚠️  Importação em index.tsx não está como esperado"
            log "Conteúdo de index.tsx:"
            head -5 "src/index.tsx"
        fi
        
        # Verificar se os arquivos importados pelo App.tsx existem
        log "Verificando arquivos importados pelo App.tsx..."
        MISSING_FILES=()
        
        # Lista de arquivos que App.tsx importa
        REQUIRED_FILES=(
            "src/pages/Auth/LoginPage.tsx"
            "src/pages/Dashboard/Dashboard.tsx"
            "src/pages/Media/Media.tsx"
            "src/pages/Playlists/Playlists.tsx"
            "src/pages/Players/Players.tsx"
            "src/components/Layout/Layout.tsx"
        )
        
        for file in "${REQUIRED_FILES[@]}"; do
            if [[ ! -f "$file" ]]; then
                MISSING_FILES+=("$file")
                warn "⚠️  Arquivo não encontrado: $file"
            fi
        done
        
        if [[ ${#MISSING_FILES[@]} -gt 0 ]]; then
            warn "⚠️  Alguns arquivos importados por App.tsx estão faltando:"
            printf '  - %s\n' "${MISSING_FILES[@]}"
            warn "Isso pode impedir a compilação do App.tsx"
        else
            log "✅ Todos os arquivos principais importados por App.tsx existem"
        fi
        
        # CRÍTICO: Verificação final ANTES de compilar - garantir que App.tsx pode ser encontrado
        log "Verificação final antes da compilação..."
        
        # Testar resolução do módulo usando Node.js diretamente
        log "Testando resolução do módulo App.tsx..."
        TEST_RESOLVE=$(node -e "
            const fs = require('fs');
            const path = require('path');
            try {
                const appPath = path.resolve('src/App.tsx');
                if (fs.existsSync(appPath)) {
                    console.log('EXISTS');
                } else {
                    console.log('NOT_FOUND');
                }
            } catch(e) {
                console.log('ERROR');
            }
        " 2>&1 || echo "ERROR")
        
        if [[ "$TEST_RESOLVE" == *"EXISTS"* ]]; then
            log "✅ Node.js confirma que App.tsx existe e pode ser encontrado"
        else
            warn "⚠️  Node.js não conseguiu encontrar App.tsx: $TEST_RESOLVE"
        fi
        
        # Verificação final: confirmar que estamos no diretório correto
        if [[ ! -f "src/App.tsx" ]] || [[ ! -f "src/index.tsx" ]]; then
            error "❌ Arquivos não encontrados no diretório atual: $(pwd)"
            error "Estrutura esperada:"
            ls -la src/ 2>/dev/null | head -10 || true
            exit 1
        fi
        
        if [[ ! -f "public/index.html" ]]; then
            log_error "index.html não encontrado em frontend/public/"
            log "Criando arquivo index.html..."
            cat > "public/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="Smart Signage Pro - Sistema de Sinalização Digital Profissional"
    />
    <link rel="apple-touch-icon" href="%PUBLIC_URL%/logo192.png" />
    <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />
    <title>Smart Signage Pro</title>
  </head>
  <body>
    <noscript>Você precisa habilitar o JavaScript para executar este aplicativo.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF
        fi
        
        if [[ ! -f "public/manifest.json" ]]; then
            log_error "manifest.json não encontrado em frontend/public/"
            log "Criando arquivo manifest.json..."
            cat > "public/manifest.json" << 'EOF'
{
  "short_name": "Smart Signage Pro",
  "name": "Smart Signage Pro - Sistema de Sinalização Digital",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff"
}
EOF
        fi
        
        log "Instalando dependências do frontend..."
        npm install
        
        # Verificação final: garantir que o import NÃO tenha extensão .tsx
        # TypeScript/Webpack NÃO permite extensões em imports de arquivos TypeScript
        log "Verificando se o import em index.tsx está correto (sem extensão)..."
        if grep -q "from './App.tsx'" "src/index.tsx" || grep -q 'from "./App.tsx"' "src/index.tsx"; then
            log "⚠️  Corrigindo import: removendo extensão .tsx (não permitida pelo TypeScript)..."
            BACKUP_INDEX="src/index.tsx.backup.$(date +%s)"
            cp "src/index.tsx" "$BACKUP_INDEX"
            
            # Remover extensão .tsx do import (TypeScript não permite)
            sed -i "s|from './App.tsx'|from './App'|g" "src/index.tsx" 2>/dev/null || \
            sed -i 's|from "./App.tsx"|from "./App"|g' "src/index.tsx" 2>/dev/null || {
                warn "⚠️  Não foi possível corrigir index.tsx"
                mv "$BACKUP_INDEX" "src/index.tsx"
            }
            
            if grep -q "from './App'" "src/index.tsx" || grep -q 'from "./App"' "src/index.tsx"; then
                log "✅ Importação corrigida: extensão .tsx removida"
            else
                warn "⚠️  Não foi possível corrigir a importação"
                mv "$BACKUP_INDEX" "src/index.tsx"
            fi
        else
            log "✅ Importação em index.tsx está correta (sem extensão)"
        fi
        
        log "Compilando frontend..."
        npm run build
        
        # Verificar se o build foi bem-sucedido
        if [[ -d "build" && -f "build/index.html" ]]; then
            log "✅ Frontend compilado com sucesso!"
        else
            log_error "❌ Falha na compilação do frontend!"
            log "Verificando logs de erro..."
            exit 1
        fi
    fi
    
    log "Dependências do projeto instaladas!"
}

# Configurar banco de dados
setup_database() {
    log "Configurando banco de dados..."
    
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        # Verificar escolha do driver; padrão PostgreSQL
        if [[ -z "$DB_DRIVER" ]]; then
            DB_DRIVER="postgresql"
        fi

        if [[ "$DB_DRIVER" == "sqlite" ]]; then
            log "Configurando SQLite (servidor único)..."
            mkdir -p "$INSTALL_DIR/data"
            SQLITE_PATH="$INSTALL_DIR/data/smartsignage.db"
            if [[ ! -f "$SQLITE_PATH" ]]; then
                log "Criando banco SQLite em $SQLITE_PATH"
                : > "$SQLITE_PATH"
            fi
            export DB_DRIVER="sqlite"
            export DATABASE_URL="file:$SQLITE_PATH"
            log "✅ SQLite configurado. DATABASE_URL=$DATABASE_URL"
            return 0
        fi

        # PostgreSQL local (servidor único)
        log "Instalando e configurando PostgreSQL (servidor único)..."
        
        # Instalar PostgreSQL se não estiver instalado
        if ! command -v psql &> /dev/null; then
            log "Instalando PostgreSQL..."
            sudo apt-get update -y
            sudo apt-get install -y postgresql postgresql-contrib
        else
            log "PostgreSQL já está instalado: $(psql --version)"
        fi

        # Garantir serviço ativo
        sudo systemctl enable postgresql
        if ! systemctl is-active --quiet postgresql; then
            log "Iniciando PostgreSQL..."
            sudo systemctl start postgresql
            sleep 5  # Aguardar PostgreSQL iniciar
        else
            log "PostgreSQL já está rodando"
        fi

        # Aguardar PostgreSQL estar pronto
        log "Aguardando PostgreSQL estar pronto..."
        for i in {1..30}; do
            if sudo -u postgres psql -c "SELECT 1" > /dev/null 2>&1; then
                log "✅ PostgreSQL está pronto"
                break
            fi
            if [[ $i -eq 30 ]]; then
                error "❌ PostgreSQL não iniciou após 60 segundos"
                exit 1
            fi
            sleep 2
        done

        # Parâmetros
        local PG_DB="smartsignage"
        local PG_USER="smartsignage"
        local PG_PASS="smartsignage123"

        # Criar USER idempotente
        log "Criando usuário PostgreSQL '${PG_USER}'..."
        if sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '${PG_USER}'" | grep -q 1; then
            log "Usuário '${PG_USER}' já existe"
        else
            sudo -u postgres psql -c "CREATE USER ${PG_USER} WITH PASSWORD '${PG_PASS}';" || {
                error "❌ Falha ao criar usuário PostgreSQL"
                exit 1
            }
            log "✅ Usuário '${PG_USER}' criado com sucesso"
        fi

        # Criar DATABASE idempotente
        log "Criando banco de dados '${PG_DB}'..."
        if sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${PG_DB}'" | grep -q 1; then
            log "Banco de dados '${PG_DB}' já existe"
        else
            sudo -u postgres psql -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};" || {
                error "❌ Falha ao criar banco de dados"
                exit 1
            }
            log "✅ Banco de dados '${PG_DB}' criado com sucesso"
        fi

        # Garantir privilégios
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO ${PG_USER};" >/dev/null 2>&1 || true
        sudo -u postgres psql -d ${PG_DB} -c "GRANT ALL ON SCHEMA public TO ${PG_USER};" >/dev/null 2>&1 || true

        # Exportar variáveis para as próximas etapas
        export DB_DRIVER="postgresql"
        export DATABASE_URL="postgresql://${PG_USER}:${PG_PASS}@localhost:5432/${PG_DB}"
        log "✅ PostgreSQL configurado. DATABASE_URL=${DATABASE_URL}"
    else
        # PostgreSQL via Docker
        log "Banco PostgreSQL será configurado via Docker"
    fi
}

# Configurar variáveis de ambiente
setup_environment() {
    log "Configurando variáveis de ambiente..."
    
    ENV_FILE="$INSTALL_DIR/.env"
    
    # Gerar JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    
    # Gerar UIN único
    UIN=$(date +%s)$(cat /sys/class/net/eth0/address 2>/dev/null | tr -d ':' || echo "000000000000")
    
    cat > $ENV_FILE << EOF
# Smart Signage Pro v2.0 - Configuração
# Gerado automaticamente em $(date)

# Modo de instalação
INSTALL_MODE=$INSTALL_MODE

# Identificação única do sistema
UIN=$UIN

# Banco de dados (PostgreSQL ou SQLite)
DB_DRIVER=${DB_DRIVER:-postgresql}
DATABASE_URL=${DATABASE_URL:-postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage}

# Servidor
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Autenticação
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Player
PLAYER_ABANDON_PIN=1234

# IA
AI_PROVIDER=ollama
AI_MODEL=llama3.2:3b
OLLAMA_BASE_URL=http://localhost:11434

# Upload
UPLOAD_MAX_SIZE=100MB
UPLOAD_PATH=$INSTALL_DIR/public/assets/uploads
MEDIA_QUOTA_PER_CLIENT=5GB

# Logs
LOG_LEVEL=info
LOG_FILE=$INSTALL_DIR/logs/app.log

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF

    log "Variáveis de ambiente configuradas em $ENV_FILE"
}

# Perguntar sobre configuração HTTPS
ask_https_configuration() {
    # Pular se for modo Docker (gerenciado pelo compose)
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        return 0
    fi
    
    # Pular se já foi configurado via flag
    if [[ "$ENABLE_HTTPS_SELF_SIGNED" == "true" ]]; then
        return 0
    fi
    
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}                    Configuração de HTTPS (SSL/TLS)${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    echo -e "${YELLOW}Escolha como deseja configurar HTTPS:${NC}"
    echo -e "${GREEN}1)${NC} Sem HTTPS (apenas HTTP - porta 80)"
    echo -e "${GREEN}2)${NC} HTTPS com certificado autoassinado (testes/desenvolvimento)"
    echo -e "${GREEN}3)${NC} HTTPS com Let's Encrypt (produção - requer domínio público)"
    echo
    read -p "Digite sua escolha (1-3) [padrão: 1]: " https_choice
    
    https_choice=${https_choice:-1}
    
    case $https_choice in
        1)
            log "HTTPS não será configurado (apenas HTTP)"
            ENABLE_HTTPS_SELF_SIGNED=false
            ENABLE_HTTPS_LETSENCRYPT=false
            ;;
        2)
            log "HTTPS autoassinado será configurado"
            ENABLE_HTTPS_SELF_SIGNED=true
            ENABLE_HTTPS_LETSENCRYPT=false
            ;;
        3)
            log "Iniciando configuração Let's Encrypt..."
            ask_letsencrypt_details
            ;;
        *)
            log "Opção inválida, usando padrão (sem HTTPS)"
            ENABLE_HTTPS_SELF_SIGNED=false
            ENABLE_HTTPS_LETSENCRYPT=false
            ;;
    esac
}

# Perguntar detalhes do Let's Encrypt
ask_letsencrypt_details() {
    echo
    echo -e "${YELLOW}Para usar Let's Encrypt, você precisa ter:${NC}"
    echo "  ✓ Domínio público (ex: smartsignage.com.br)"
    echo "  ✓ DNS apontando para o IP deste servidor"
    echo "  ✓ Porta 80 acessível (para validação)"
    echo
    read -p "Digite seu domínio (ex: smartsignage.com.br): " domain_input
    
    if [[ -z "$domain_input" ]]; then
        warning "Domínio não informado. Usando HTTP sem HTTPS."
        ENABLE_HTTPS_LETSENCRYPT=false
        return 0
    fi
    
    DOMAIN_NAME="$domain_input"
    
    echo
    read -p "Digite seu email para notificações do Let's Encrypt (opcional): " email_input
    SSL_EMAIL="${email_input:-admin@${DOMAIN_NAME}}"
    
    # Verificar se o domínio está configurado no DNS
    log "Verificando se o domínio $DOMAIN_NAME aponta para este servidor..."
    
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "")
    
    # Tentar usar dig se disponível, senão usar getent ou ping
    if command -v dig &> /dev/null; then
        DOMAIN_IP=$(dig +short "$DOMAIN_NAME" A 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1 || echo "")
    elif command -v host &> /dev/null; then
        DOMAIN_IP=$(host -t A "$DOMAIN_NAME" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")
    else
        DOMAIN_IP=""
    fi
    
    if [[ -z "$DOMAIN_IP" ]]; then
        warning "⚠️  Não foi possível verificar o DNS do domínio $DOMAIN_NAME"
        warning "Certifique-se de que o DNS A/AAAA aponta para este servidor antes de continuar"
        echo
        read -p "Deseja continuar mesmo assim? (s/N): " continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Ss]$ ]]; then
            log "Let's Encrypt cancelado. Usando HTTP sem HTTPS."
            ENABLE_HTTPS_LETSENCRYPT=false
            return 0
        fi
    elif [[ -n "$SERVER_IP" && "$DOMAIN_IP" != "$SERVER_IP" ]]; then
        warning "⚠️  O domínio $DOMAIN_NAME aponta para $DOMAIN_IP, mas este servidor é $SERVER_IP"
        warning "O certificado pode falhar se o DNS não estiver correto"
        echo
        read -p "Deseja continuar mesmo assim? (s/N): " continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Ss]$ ]]; then
            log "Let's Encrypt cancelado. Usando HTTP sem HTTPS."
            ENABLE_HTTPS_LETSENCRYPT=false
            return 0
        fi
    else
        log "✓ Domínio $DOMAIN_NAME verificado corretamente"
    fi
    
    ENABLE_HTTPS_LETSENCRYPT=true
    ENABLE_HTTPS_SELF_SIGNED=false
}

# Configurar Let's Encrypt
setup_letsencrypt() {
    if [[ "$ENABLE_HTTPS_LETSENCRYPT" != "true" ]] || [[ -z "$DOMAIN_NAME" ]]; then
        return 0
    fi
    
    log "Configurando Let's Encrypt para $DOMAIN_NAME..."
    
    # Instalar certbot se não estiver instalado
    if ! command -v certbot &> /dev/null; then
        log "Instalando Certbot..."
        sudo apt install -y certbot python3-certbot-nginx || {
            error "Falha ao instalar Certbot"
            warning "Continuando sem HTTPS"
            ENABLE_HTTPS_LETSENCRYPT=false
            return 0
        }
    fi
    
    # Criar configuração Nginx temporária (HTTP) para validação
    NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"
    
    # Configurar primeiro com HTTP apenas
    sudo tee $NGINX_CONFIG > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME www.$DOMAIN_NAME;
    
    # Frontend
    location / {
        root $FRONTEND_BUILD_DIR;
        try_files \$uri \$uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Player
    location /player/ {
        alias $INSTALL_DIR/player/;
        try_files \$uri \$uri/ /player/index.html;
    }
    
    # Assets
    location /assets/ {
        alias $INSTALL_DIR/public/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    sudo ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Recarregar Nginx
    if sudo nginx -t && sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload; then
        log "Nginx configurado com HTTP temporariamente"
    else
        error "Erro ao configurar Nginx"
        warning "Continuando sem HTTPS"
        ENABLE_HTTPS_LETSENCRYPT=false
        return 0
    fi
    
    # Tentar obter certificado
    log "Obtendo certificado SSL do Let's Encrypt..."
    log "Isso pode levar alguns minutos..."
    
    if sudo certbot --nginx -d "$DOMAIN_NAME" -d "www.$DOMAIN_NAME" --non-interactive --agree-tos --email "$SSL_EMAIL" --redirect; then
        log "✅ Certificado Let's Encrypt obtido com sucesso!"
        
        # Configurar renovação automática
        if ! sudo crontab -l 2>/dev/null | grep -q "certbot renew"; then
            (sudo crontab -l 2>/dev/null; echo "0 0 * * * /usr/bin/certbot renew --quiet --nginx && systemctl reload nginx") | sudo crontab -
            log "✓ Renovação automática configurada no cron"
        fi
    else
        error "❌ Falha ao obter certificado Let's Encrypt"
        warning "Verifique se:"
        warning "  - O domínio $DOMAIN_NAME aponta para este servidor"
        warning "  - A porta 80 está acessível"
        warning "  - O firewall permite conexões HTTP"
        warning "Continuando sem HTTPS. Você pode tentar novamente depois com:"
        warning "  sudo certbot --nginx -d $DOMAIN_NAME"
        ENABLE_HTTPS_LETSENCRYPT=false
        
        # Recriar configuração sem SSL
        setup_nginx_http_only
    fi
}

# Configurar Nginx apenas HTTP (sem SSL)
setup_nginx_http_only() {
    NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"
    
    sudo tee $NGINX_CONFIG > /dev/null << EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME:-_};
    
    # Frontend
    location / {
        root $FRONTEND_BUILD_DIR;
        try_files \$uri \$uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Player
    location /player/ {
        alias $INSTALL_DIR/player/;
        try_files \$uri \$uri/ /player/index.html;
    }
    
    # Assets
    location /assets/ {
        alias $INSTALL_DIR/public/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
}

# Configurar Nginx
setup_nginx() {
    log "Configurando Nginx..."
    
    # Em modo Docker, o Nginx é gerenciado pelo Docker Compose
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        log "Nginx será gerenciado pelo Docker Compose"
        return 0
    fi
    
    # Validar que o build do frontend existe
    if [[ ! -d "$INSTALL_DIR/frontend/build" ]]; then
        error "❌ Build do frontend não encontrado em $INSTALL_DIR/frontend/build"
        error "O frontend precisa ser compilado antes de configurar o Nginx!"
        exit 1
    fi
    
    if [[ ! -f "$INSTALL_DIR/frontend/build/index.html" ]]; then
        error "❌ Arquivo index.html não encontrado no build do frontend!"
        exit 1
    fi
    
    log "✅ Build do frontend encontrado: $INSTALL_DIR/frontend/build"
    
    # SOLUÇÃO PROFISSIONAL: Para servidor dedicado, copiar build para diretório público padrão
    # Isso evita problemas de permissão em diretórios home e segue melhores práticas de deploy
    if [[ "$INSTALL_MODE" == "single-server" ]] && [[ "$INSTALL_DIR" =~ ^/home/ ]]; then
        log "📦 Servidor dedicado detectado - copiando build para diretório público padrão..."
        
        # Definir diretório de deploy profissional
        if [[ -d "/opt/smart-signage" ]]; then
            DEPLOY_DIR="/opt/smart-signage/frontend/build"
        else
            DEPLOY_DIR="/var/www/smart-signage"
        fi
        
        log "Copiando build de $INSTALL_DIR/frontend/build para $DEPLOY_DIR..."
        
        # Criar diretório de deploy
        sudo mkdir -p "$DEPLOY_DIR"
        
        # Copiar build completo
        sudo rm -rf "$DEPLOY_DIR"/* 2>/dev/null || true
        sudo cp -a "$INSTALL_DIR/frontend/build"/* "$DEPLOY_DIR/" || {
            error "❌ Erro ao copiar build para $DEPLOY_DIR"
            exit 1
        }
        
        # Ajustar permissões corretas
        if id www-data &>/dev/null; then
            sudo chown -R www-data:www-data "$DEPLOY_DIR" 2>/dev/null || true
        else
            sudo chown -R nginx:nginx "$DEPLOY_DIR" 2>/dev/null || true
        fi
        sudo chmod -R 755 "$DEPLOY_DIR" 2>/dev/null || true
        sudo find "$DEPLOY_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
        
        # Atualizar INSTALL_DIR para o diretório de deploy (apenas para configuração do Nginx)
        FRONTEND_BUILD_DIR="$DEPLOY_DIR"
        log "✅ Build copiado para $DEPLOY_DIR (diretório público padrão)"
    else
        # Usar diretório original se não estiver em home ou se não for single-server
        FRONTEND_BUILD_DIR="$INSTALL_DIR/frontend/build"
    fi
    
    NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"
    
    if [[ "$ENABLE_HTTPS_SELF_SIGNED" == "true" ]] && [[ "$INSTALL_MODE" == "single-server" ]]; then
        SSL_DIR="$INSTALL_DIR/nginx/ssl"
        sudo mkdir -p "$SSL_DIR"
        if [[ ! -f "$SSL_DIR/selfsigned.key" || ! -f "$SSL_DIR/selfsigned.crt" ]]; then
            sudo openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
                -keyout "$SSL_DIR/selfsigned.key" \
                -out "$SSL_DIR/selfsigned.crt" \
                -subj "/C=BR/ST=NA/L=NA/O=SmartSignage/OU=IT/CN=localhost"
        fi
        sudo tee $NGINX_CONFIG > /dev/null << EOF
server {
    listen 80;
    server_name _;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate     $SSL_DIR/selfsigned.crt;
    ssl_certificate_key $SSL_DIR/selfsigned.key;

    # Frontend
    location / {
        root $FRONTEND_BUILD_DIR;
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Player
    location /player/ {
        alias $INSTALL_DIR/player/;
        try_files \$uri \$uri/ /player/index.html;
    }

    # Assets
    location /assets/ {
        alias $INSTALL_DIR/public/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    else
        sudo tee $NGINX_CONFIG > /dev/null << EOF
server {
    listen 80;
    server_name _;
    
    # Diretório raiz e arquivo índice
    root $FRONTEND_BUILD_DIR;
    index index.html;
    
    # Configurações gerais
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Arquivos estáticos do React (JS, CSS, etc.)
    location /static/ {
        alias $FRONTEND_BUILD_DIR/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # Outros arquivos estáticos (manifest, favicon, etc.)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webmanifest)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # Backend API (DEVE vir antes de / para não interceptar)
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Player
    location /player/ {
        alias $INSTALL_DIR/player/;
        try_files \$uri \$uri/ /player/index.html;
    }
    
    # Assets
    location /assets/ {
        alias $INSTALL_DIR/public/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Frontend SPA - todas as rotas vão para index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Compressão Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
}
EOF
    fi

    sudo ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Se Let's Encrypt está ativo, não configurar aqui (será feito em setup_letsencrypt)
    if [[ "$ENABLE_HTTPS_LETSENCRYPT" == "true" ]]; then
        log "Nginx será configurado pelo Let's Encrypt"
        return 0
    fi
    
    # Garantir permissões corretas para o Nginx ler os arquivos
    log "Ajustando permissões do build do frontend para o Nginx..."
    
    # Se usamos DEPLOY_DIR (diretório público), já foram ajustadas acima
    # Se não, ajustar permissões do diretório original
    if [[ -n "$FRONTEND_BUILD_DIR" ]] && [[ "$FRONTEND_BUILD_DIR" != "$INSTALL_DIR/frontend/build" ]]; then
        log "✅ Permissões já foram ajustadas no diretório de deploy: $FRONTEND_BUILD_DIR"
    else
        # Ajustar permissões do diretório original (caso não tenha sido copiado)
        if id www-data &>/dev/null; then
            sudo chown -R www-data:www-data "$FRONTEND_BUILD_DIR" 2>/dev/null || true
        else
            sudo chown -R nginx:nginx "$FRONTEND_BUILD_DIR" 2>/dev/null || true
        fi
        sudo chmod -R 755 "$FRONTEND_BUILD_DIR" 2>/dev/null || true
        sudo find "$FRONTEND_BUILD_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
        sudo find "$FRONTEND_BUILD_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
        log "✅ Permissões ajustadas para $FRONTEND_BUILD_DIR"
    fi
    
    # Testar configuração
    if sudo nginx -t; then
        log "✅ Configuração do Nginx válida!"
        
        # Para single-server, iniciar e habilitar Nginx
        if [[ "$INSTALL_MODE" == "single-server" ]]; then
            log "Iniciando e habilitando Nginx..."
            sudo systemctl enable nginx
            if ! systemctl is-active --quiet nginx; then
                sudo systemctl start nginx
                sleep 3
                
                # Verificar se iniciou corretamente
                if systemctl is-active --quiet nginx; then
                    log "✅ Nginx iniciado com sucesso!"
                else
                    error "❌ Falha ao iniciar Nginx!"
                    sudo systemctl status nginx --no-pager -l || true
                    error "Verificando logs do Nginx:"
                    sudo tail -30 /var/log/nginx/error.log 2>/dev/null || true
                    exit 1
                fi
            else
                log "✅ Nginx já está rodando"
                # Recarregar configuração se já estava rodando
                # IMPORTANTE: Forçar reload para aplicar nova configuração com FRONTEND_BUILD_DIR
                log "Recarregando Nginx para aplicar nova configuração..."
                if sudo nginx -t 2>/dev/null; then
                    sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload || {
                        warn "⚠️  Falha ao recarregar Nginx, tentando restart..."
                        sudo systemctl restart nginx
                        sleep 3
                    }
                    log "✅ Nginx recarregado"
                else
                    error "❌ Configuração do Nginx inválida após atualização!"
                    sudo nginx -t
                fi
                sleep 2
            fi
            
            # Validação final: verificar se o Nginx consegue servir o index.html
            log "Validando se o Nginx está servindo o frontend..."
            log "Diretório configurado: $FRONTEND_BUILD_DIR"
            
            # Verificar se a configuração do Nginx está correta
            log "Verificando configuração atual do Nginx..."
            if grep -q "$FRONTEND_BUILD_DIR" /etc/nginx/sites-available/smart-signage 2>/dev/null; then
                log "✅ Configuração do Nginx aponta para: $FRONTEND_BUILD_DIR"
            else
                warning "⚠️  Configuração do Nginx pode não estar apontando para $FRONTEND_BUILD_DIR"
                warning "Conteúdo atual da configuração:"
                sudo grep -A 5 "location /" /etc/nginx/sites-available/smart-signage 2>/dev/null | head -10 || true
            fi
            
            sleep 2
            if curl -s -f http://localhost:80 > /dev/null 2>&1; then
                log "✅ Nginx está respondendo na porta 80!"
                # Verificar se retorna HTML (não erro 404 ou 403)
                HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80)
                if [[ "$HTTP_STATUS" == "200" ]]; then
                    log "✅ Nginx está servindo o frontend corretamente (HTTP 200)!"
                else
                    warning "⚠️  Nginx respondeu com status HTTP $HTTP_STATUS"
                    warning "Verificando se index.html está acessível em $FRONTEND_BUILD_DIR..."
                    sudo ls -la "$FRONTEND_BUILD_DIR/index.html" || true
                    warning "Verificando logs recentes do Nginx:"
                    sudo tail -30 /var/log/nginx/error.log 2>/dev/null | grep -E "(stat|Permission|denied)" | tail -5 || true
                fi
            else
                warning "⚠️  Nginx pode não estar servindo o frontend corretamente"
                warning "Diretório configurado: $FRONTEND_BUILD_DIR"
                warning "Verificando se arquivo existe:"
                sudo ls -la "$FRONTEND_BUILD_DIR/index.html" || true
                warning "Verificando logs:"
                sudo tail -30 /var/log/nginx/error.log 2>/dev/null | grep -E "(stat|Permission|denied)" | tail -10 || true
            fi
        fi
    else
        error "❌ Erro na configuração do Nginx!"
        sudo nginx -t
        exit 1
    fi
}

# Criar serviço systemd
create_systemd_service() {
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        log "Criando serviço systemd..."
        
        SERVICE_FILE="/etc/systemd/system/smart-signage.service"
        
        sudo tee $SERVICE_FILE > /dev/null << EOF
[Unit]
Description=Smart Signage Pro Backend
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
EnvironmentFile=$INSTALL_DIR/.env

# Limites de recursos
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

        sudo systemctl daemon-reload
        sudo systemctl enable smart-signage
        
        log "✅ Serviço systemd criado e habilitado"
        log "⚠️  O serviço será iniciado após configurar o banco de dados"
    fi
}

# Configurar Docker Compose
setup_docker_compose() {
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        log "Configurando Docker Compose..."
        
        # Detectar diretório do script
        SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
        log "Diretório do script: $SCRIPT_DIR"
        
        cd $INSTALL_DIR
        
        # Verificar se docker-compose.yml existe
        if [[ ! -f "docker-compose.yml" ]]; then
            log "Arquivo docker-compose.yml não encontrado, tentando copiar..."
            log "Verificando locais possíveis:"
            log "  - $SCRIPT_DIR/docker-compose.yml: $([[ -f "$SCRIPT_DIR/docker-compose.yml" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - ./docker-compose.yml: $([[ -f "./docker-compose.yml" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            
            # Tentar copiar do diretório do script
            if [[ -f "$SCRIPT_DIR/docker-compose.yml" ]]; then
                cp "$SCRIPT_DIR/docker-compose.yml" $INSTALL_DIR/
                log "Arquivo docker-compose.yml copiado com sucesso!"
            elif [[ -f "./docker-compose.yml" ]]; then
                cp ./docker-compose.yml $INSTALL_DIR/
                log "Arquivo docker-compose.yml copiado do diretório atual!"
            else
                error "Arquivo docker-compose.yml não encontrado!"
                error "Verifique se o arquivo existe no diretório do projeto"
                exit 1
            fi
        fi
        
        # Verificar se Dockerfiles existem (aceita monolito Dockerfile.app OU backend+frontend)
        # Condição correta: se NÃO existe Dockerfile.app E (NÃO existe backend OU NÃO existe frontend) => faltam arquivos
        if [[ ! -f "Dockerfile.app" ]] && [[ ! -f "Dockerfile.backend" || ! -f "Dockerfile.frontend" ]]; then
            log "Dockerfiles não encontrados, tentando copiar..."
            log "Verificando locais possíveis:"
            log "  - $SCRIPT_DIR/Dockerfile: $([[ -f "$SCRIPT_DIR/Dockerfile" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - $SCRIPT_DIR/Dockerfile.backend: $([[ -f "$SCRIPT_DIR/Dockerfile.backend" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - $SCRIPT_DIR/Dockerfile.frontend: $([[ -f "$SCRIPT_DIR/Dockerfile.frontend" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - $SCRIPT_DIR/Dockerfile.app: $([[ -f "$SCRIPT_DIR/Dockerfile.app" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - ./Dockerfile: $([[ -f "./Dockerfile" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - ./Dockerfile.backend: $([[ -f "./Dockerfile.backend" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - ./Dockerfile.frontend: $([[ -f "./Dockerfile.frontend" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - ./Dockerfile.app: $([[ -f "./Dockerfile.app" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            
            # Tentar copiar do diretório do script
            if [[ -f "$SCRIPT_DIR/Dockerfile" ]]; then
                cp "$SCRIPT_DIR/Dockerfile" $INSTALL_DIR/
                log "Arquivo Dockerfile copiado com sucesso!"
            fi
            if [[ -f "$SCRIPT_DIR/Dockerfile.app" ]]; then
                cp "$SCRIPT_DIR/Dockerfile.app" $INSTALL_DIR/
                log "Arquivo Dockerfile.app copiado com sucesso!"
            fi
            if [[ -f "$SCRIPT_DIR/Dockerfile.backend" ]]; then
                cp "$SCRIPT_DIR/Dockerfile.backend" $INSTALL_DIR/
                log "Arquivo Dockerfile.backend copiado com sucesso!"
            fi
            if [[ -f "$SCRIPT_DIR/Dockerfile.frontend" ]]; then
                cp "$SCRIPT_DIR/Dockerfile.frontend" $INSTALL_DIR/
                log "Arquivo Dockerfile.frontend copiado com sucesso!"
            fi
            
            # Tentar copiar do diretório atual
            if [[ -f "./Dockerfile" ]]; then
                cp ./Dockerfile $INSTALL_DIR/
                log "Arquivo Dockerfile copiado do diretório atual!"
            fi
            if [[ -f "./Dockerfile.app" ]]; then
                cp ./Dockerfile.app $INSTALL_DIR/
                log "Arquivo Dockerfile.app copiado do diretório atual!"
            fi
            if [[ -f "./Dockerfile.backend" ]]; then
                cp ./Dockerfile.backend $INSTALL_DIR/
                log "Arquivo Dockerfile.backend copiado do diretório atual!"
            fi
            if [[ -f "./Dockerfile.frontend" ]]; then
                cp ./Dockerfile.frontend $INSTALL_DIR/
                log "Arquivo Dockerfile.frontend copiado do diretório atual!"
            fi
            
            if [[ ! -f "$INSTALL_DIR/Dockerfile.app" ]] && [[ ! -f "$INSTALL_DIR/Dockerfile.backend" || ! -f "$INSTALL_DIR/Dockerfile.frontend" ]]; then
                error "Dockerfiles não encontrados em nenhum local!"
                error "Verifique se existe Dockerfile.app ou os arquivos Dockerfile.backend e Dockerfile.frontend no diretório do projeto"
                exit 1
            fi
        fi
        
        # Verificar se diretório docker existe
        if [[ ! -d "docker" ]]; then
            log "Diretório docker não encontrado, tentando copiar..."
            log "Verificando locais possíveis:"
            log "  - $SCRIPT_DIR/docker: $([[ -d "$SCRIPT_DIR/docker" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - ./docker: $([[ -d "./docker" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - $(pwd)/docker: $([[ -d "$(pwd)/docker" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            
            # Tentar copiar do diretório do script
            if [[ -d "$SCRIPT_DIR/docker" ]]; then
                cp -r "$SCRIPT_DIR/docker" $INSTALL_DIR/
                log "Diretório docker copiado com sucesso de $SCRIPT_DIR!"
            elif [[ -d "./docker" ]]; then
                cp -r ./docker $INSTALL_DIR/
                log "Diretório docker copiado do diretório atual!"
            else
                error "Diretório docker não encontrado!"
                error "Verificando diretórios disponíveis em $SCRIPT_DIR:"
                ls -la "$SCRIPT_DIR/" || true
                error "Verifique se o diretório docker existe no diretório do projeto"
                exit 1
            fi
        else
            log "Diretório docker já existe em $INSTALL_DIR"
        fi
        
        # Verificar novamente se os arquivos existem
        if [[ ! -f "docker-compose.yml" ]]; then
            error "Falha ao copiar docker-compose.yml para $INSTALL_DIR"
            exit 1
        fi
        
        # Verificar Dockerfiles especializados
        if [[ -f "Dockerfile.app" ]]; then
            log "Arquivo Dockerfile.app encontrado em $INSTALL_DIR"
        else
            if [[ -f "Dockerfile.backend" ]]; then
                log "Arquivo Dockerfile.backend encontrado em $INSTALL_DIR"
            else
                warning "AVISO: Dockerfile.backend não encontrado"
            fi
            if [[ -f "Dockerfile.frontend" ]]; then
                log "Arquivo Dockerfile.frontend encontrado em $INSTALL_DIR"
            else
                warning "AVISO: Dockerfile.frontend não encontrado"
            fi
        fi
        
        log "Arquivo docker-compose.yml encontrado em $INSTALL_DIR"
        
        # Verificar se estamos no diretório correto
        CURRENT_DIR=$(pwd)
        if [[ "$CURRENT_DIR" != "$INSTALL_DIR" ]]; then
            log "Navegando para o diretório correto: $INSTALL_DIR"
            cd $INSTALL_DIR
        fi
        
        # Verificar novamente se os arquivos existem no diretório atual
        if [[ ! -f "./docker-compose.yml" ]]; then
            error "Arquivo docker-compose.yml não encontrado no diretório atual: $(pwd)"
            error "Listando arquivos no diretório:"
            ls -la
            exit 1
        fi
        
        # Verificar Dockerfiles especializados
        if [[ -f "./Dockerfile.app" ]]; then
            log "Confirmado: Dockerfile.app está em $(pwd)"
        else
            if [[ -f "./Dockerfile.backend" ]]; then
                log "Confirmado: Dockerfile.backend está em $(pwd)"
            else
                warning "AVISO: Dockerfile.backend não encontrado"
            fi
            if [[ -f "./Dockerfile.frontend" ]]; then
                log "Confirmado: Dockerfile.frontend está em $(pwd)"
            else
                warning "AVISO: Dockerfile.frontend não encontrado"
            fi
        fi
        
        log "Confirmado: docker-compose.yml está em $(pwd)"
        
        # Criar diretórios necessários
        mkdir -p logs backups public/assets/uploads ml-models
        
        # Verificar se Docker está funcionando
        if ! systemctl is-active --quiet docker; then
            error "Docker não está funcionando!"
            exit 1
        fi
        
        # Verificar se docker-compose está disponível (nova sintaxe)
        if command -v docker &> /dev/null && docker compose version &> /dev/null; then
            COMPOSE_CMD="docker compose"
            log "Usando Docker Compose v2 (docker compose)"
        elif command -v docker-compose &> /dev/null; then
            COMPOSE_CMD="docker-compose"
            log "Usando Docker Compose v1 (docker-compose)"
        else
            error "Docker Compose não está instalado!"
            exit 1
        fi
        
        # Aplicar grupo docker se necessário
        if ! groups $USER | grep -q docker; then
            warn "Usuário não está no grupo docker. Adicionando..."
            sudo usermod -aG docker $USER
            log "Usuário adicionado ao grupo docker"
        fi
        
        # Verificar permissões do Docker
        if ! docker ps &> /dev/null; then
            warn "Testando permissões do Docker..."
            if ! docker ps 2>&1 | grep -q "permission denied"; then
                error "Docker não está funcionando corretamente"
                exit 1
            else
                warn "Permissão negada. Tentando aplicar grupo docker..."
                sudo usermod -aG docker $USER
                sudo systemctl restart docker
                sleep 5
                
                # Tentar novamente
                if ! docker ps &> /dev/null; then
                    error "Ainda sem permissão. Execute: sudo usermod -aG docker $USER && newgrp docker"
                    exit 1
                fi
            fi
        fi
        
        log "Permissões do Docker verificadas com sucesso!"
        
        # Parar o Nginx do sistema se estiver rodando (para liberar porta 80)
        if systemctl is-active --quiet nginx 2>/dev/null; then
            log "Nginx do sistema está rodando. Parando para liberar porta 80..."
            sudo systemctl stop nginx 2>/dev/null || true
            sudo systemctl disable nginx 2>/dev/null || true
            log "Nginx do sistema parado e desabilitado"
        fi
        
        # Verificar se porta 80 está livre
        if command -v netstat &> /dev/null; then
            if sudo netstat -tlnp | grep -q ":80 "; then
                log_error "Porta 80 está em uso! Verificando processo..."
                sudo netstat -tlnp | grep ":80 " || true
                log "Tentando parar processo na porta 80..."
                # Não forçar parada automática, apenas avisar
            fi
        elif command -v ss &> /dev/null; then
            if sudo ss -tlnp | grep -q ":80 "; then
                log_error "Porta 80 está em uso! Verificando processo..."
                sudo ss -tlnp | grep ":80 " || true
            fi
        fi
        
        # Testar build do Docker antes de iniciar containers
        if [[ "$INSTALL_MODE" == "docker" ]]; then
            test_docker_build
        fi
        
        # Fazer build das imagens antes de iniciar
        if [[ "$INSTALL_MODE" == "docker" ]]; then
            log "Construindo imagens Docker..."
            
            # Parar e remover containers existentes (incluindo órfãos)
            log "Parando containers existentes..."
            $COMPOSE_CMD down --remove-orphans 2>/dev/null || true
            
            # Parar qualquer container órfão que esteja usando porta 80
            log "Verificando e parando containers órfãos na porta 80..."
            ORPHAN_CONTAINERS=$(docker ps -a --filter "name=smartsignage-nginx" --format "{{.Names}}" 2>/dev/null || true)
            if [[ -n "$ORPHAN_CONTAINERS" ]]; then
                log "Removendo containers órfãos: $ORPHAN_CONTAINERS"
                docker stop $ORPHAN_CONTAINERS 2>/dev/null || true
                docker rm -f $ORPHAN_CONTAINERS 2>/dev/null || true
            fi
            
            # Verificar e parar qualquer processo usando porta 80
            if command -v ss &> /dev/null; then
                PORT80_PID=$(sudo ss -tlnp | grep ":80 " | grep -oP 'pid=\K\d+' | head -1 || true)
                if [[ -n "$PORT80_PID" ]]; then
                    PORT80_CONTAINER=$(docker ps --filter "publish=80" --format "{{.Names}}" | head -1 || true)
                    if [[ -n "$PORT80_CONTAINER" ]]; then
                        log "Parando container usando porta 80: $PORT80_CONTAINER"
                        docker stop $PORT80_CONTAINER 2>/dev/null || true
                        docker rm -f $PORT80_CONTAINER 2>/dev/null || true
                    fi
                fi
            fi
            
            # Limpar imagens antigas se necessário
            log "Limpando imagens antigas..."
            $COMPOSE_CMD down --remove-orphans --rmi all 2>/dev/null || true
            
            # Reconstruir imagens (monolito)
            log "Construindo imagem Docker do app (monolito)..."
        # Tentar build com até 3 retries em caso de falha transitória
        if retry_with_backoff 3 3 $COMPOSE_CMD build --no-cache app 2>&1 | tee /tmp/docker-compose-build.log; then
                log "✅ Build da imagem app concluído com sucesso!"
            else
                error "❌ Erro no build da imagem app"
                error "Verificando se Dockerfile.app existe:"
                ls -la Dockerfile.app || error "Dockerfile.app NÃO EXISTE!"
                error "Últimas linhas do log:"
                tail -50 /tmp/docker-compose-build.log
                error "Log completo salvo em: /tmp/docker-compose-build.log"
                exit 1
            fi
        fi
        
        # Iniciar serviços
        if [[ "$INSTALL_MODE" == "docker" ]]; then
            log "Iniciando containers Docker..."
            
            # Garantir que estamos no diretório correto
            cd $INSTALL_DIR
            log "Diretório atual: $(pwd)"
            
            # Verificar se o arquivo existe
            if [[ ! -f "docker-compose.yml" ]]; then
                error "Arquivo docker-compose.yml não encontrado em $INSTALL_DIR"
                error "Listando arquivos no diretório:"
                ls -la
                exit 1
            fi
            
            log "Arquivo docker-compose.yml encontrado: $(ls -la docker-compose.yml)"
            
            # Iniciar serviços na ordem correta
            start_services_in_order
            
            # Verificar se containers estão rodando
            log "Verificando status final dos containers..."
            sleep 5
            
            # Garantir que estamos no diretório correto
            cd $INSTALL_DIR
            
            if $COMPOSE_CMD ps | grep -q "Up"; then
                log "Docker Compose configurado e iniciado com sucesso!"
                $COMPOSE_CMD ps
            else
                error "Falha ao iniciar containers Docker!"
                error "Status dos containers:"
                $COMPOSE_CMD ps
                error "Logs dos containers:"
                $COMPOSE_CMD logs
                exit 1
            fi
        fi
    fi
}

# Testar pontos de entrada
test_endpoints() {
    log "Testando pontos de entrada..."
    
    # Obter IP do servidor
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    # Lista de endpoints para testar baseada no modo
    declare -A ENDPOINTS
    
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        # Endpoints para Docker
        ENDPOINTS=(
            ["Backend Health"]="http://$SERVER_IP:3000/health"
            ["Backend API"]="http://$SERVER_IP:3000/api/health"
            ["Frontend"]="http://$SERVER_IP:80"
            ["Player"]="http://$SERVER_IP:80/player"
            ["Prometheus"]="http://$SERVER_IP:9090"
            ["Grafana"]="http://$SERVER_IP:3002"
        )
        
    elif [[ "$INSTALL_MODE" == "single-server" ]]; then
        # Endpoints para Single-Server
        ENDPOINTS=(
            ["Backend Health"]="http://$SERVER_IP:3000/health"
            ["Backend API"]="http://$SERVER_IP:3000/api/health"
            ["Frontend"]="http://$SERVER_IP:80"
            ["Player"]="http://$SERVER_IP:80/player"
        )
        
    elif [[ "$INSTALL_MODE" == "development" ]]; then
        # Endpoints para Development
        ENDPOINTS=(
            ["Backend Health"]="http://$SERVER_IP:3000/health"
            ["Backend API"]="http://$SERVER_IP:3000/api/health"
            ["Frontend Dev"]="http://$SERVER_IP:3001"
            ["Nginx"]="http://$SERVER_IP:80"
        )
    fi
    
    # Testar cada endpoint
    for service in "${!ENDPOINTS[@]}"; do
        url="${ENDPOINTS[$service]}"
        log "Testando $service: $url"
        
        # Tentar conectar com timeout
        if curl -s --max-time 10 "$url" > /dev/null 2>&1; then
            log "✅ $service: OK"
        else
            warning "❌ $service: FALHOU - $url"
        fi
    done
    
    log "Teste de endpoints concluído!"
}

# Iniciar serviços na ordem correta
start_services_in_order() {
    log "Iniciando serviços na ordem correta..."
    
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        # Garantir que estamos no diretório correto
        cd $INSTALL_DIR
        
        # Verificar se docker-compose.yml existe
        if [[ ! -f "docker-compose.yml" ]]; then
            error "docker-compose.yml não encontrado em $INSTALL_DIR"
            exit 1
        fi
        
        # Parar containers órfãos antes de iniciar
        log "Removendo containers órfãos antes de iniciar..."
        $COMPOSE_CMD down --remove-orphans 2>/dev/null || true
        
        # Parar qualquer container órfão smartsignage-nginx
        docker stop smartsignage-nginx 2>/dev/null || true
        docker rm -f smartsignage-nginx 2>/dev/null || true
        
        # Verificar e garantir que porta 80 está livre
        log "Verificando se porta 80 está livre..."
        sleep 2
        if command -v ss &> /dev/null; then
            if sudo ss -tlnp | grep -q ":80 "; then
                log_error "Porta 80 ainda está em uso após limpeza!"
                log "Processos usando porta 80:"
                sudo ss -tlnp | grep ":80 " || true
                
                # Tentar parar containers Docker usando porta 80
                PORT80_CONTAINERS=$(docker ps --filter "publish=80" --format "{{.Names}}" || true)
                if [[ -n "$PORT80_CONTAINERS" ]]; then
                    log "Parando containers Docker usando porta 80: $PORT80_CONTAINERS"
                    docker stop $PORT80_CONTAINERS 2>/dev/null || true
                    docker rm -f $PORT80_CONTAINERS 2>/dev/null || true
                    sleep 2
                fi
            else
                log "✅ Porta 80 está livre"
            fi
        fi
        
        # Ordem para Docker - iniciar em sequência
        log "Iniciando PostgreSQL..."
        retry_with_backoff 3 2 $COMPOSE_CMD up -d postgres || true
        wait_for_postgres
        
        log "Iniciando Redis..."
        retry_with_backoff 3 2 $COMPOSE_CMD up -d redis || true
        wait_for_redis
        
        log "Iniciando Ollama..."
        retry_with_backoff 3 2 $COMPOSE_CMD up -d ollama || true
        wait_for_ollama
        
        log "Iniciando App (monolito)..."
        # Retry leve para imagens que podem falhar por rede
        for i in {1..3}; do $COMPOSE_CMD up -d postgres redis ollama prometheus grafana && break || sleep 5; done
        retry_with_backoff 3 3 $COMPOSE_CMD up -d app || true
        # Aguarde estabilização
        sleep 5
        
        log "Iniciando Prometheus..."
        log_detailed "Verificando arquivos de configuração do Prometheus..."
        if [[ ! -f "monitoring/prometheus/prometheus.yml" ]]; then
            log_error "Arquivo prometheus.yml não encontrado!"
            
            # Verificar se existe um diretório com esse nome
            if [[ -d "monitoring/prometheus/prometheus.yml" ]]; then
                log_error "Existe um diretório com o nome prometheus.yml!"
                log_progress "Removendo diretório incorreto..."
                sudo rm -rf "monitoring/prometheus/prometheus.yml" 2>/dev/null || {
                    log_error "Não foi possível remover o diretório com sudo"
                    log_progress "Tentando com permissões diferentes..."
                    chmod -R 755 "monitoring/prometheus/prometheus.yml" 2>/dev/null || true
                    rm -rf "monitoring/prometheus/prometheus.yml" 2>/dev/null || {
                        log_error "Ainda não foi possível remover. Continuando com nome alternativo..."
                        PROMETHEUS_CONFIG_FILE="monitoring/prometheus/prometheus-config.yml"
                    }
                }
            fi
            
            log_progress "Criando arquivo de configuração padrão..."
            mkdir -p monitoring/prometheus
            
            # Usar nome alternativo se necessário
            PROMETHEUS_CONFIG_FILE=${PROMETHEUS_CONFIG_FILE:-"monitoring/prometheus/prometheus.yml"}
            
            cat > "$PROMETHEUS_CONFIG_FILE" << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
  
  - job_name: 'smart-signage-backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
  
  - job_name: 'smart-signage-frontend'
    static_configs:
      - targets: ['frontend:80']
    metrics_path: '/metrics'
    scrape_interval: 30s
EOF
            log_status "✅ Arquivo prometheus.yml criado"
            
            # Se usou nome alternativo, atualizar docker-compose.yml
            if [[ "$PROMETHEUS_CONFIG_FILE" != "monitoring/prometheus/prometheus.yml" ]]; then
                log_progress "Atualizando docker-compose.yml para usar arquivo alternativo..."
                sed -i "s|monitoring/prometheus/prometheus.yml|$PROMETHEUS_CONFIG_FILE|g" docker-compose.yml
            fi
        else
            log_status "✅ Arquivo prometheus.yml encontrado"
        fi
        
        $COMPOSE_CMD up -d prometheus
        wait_for_prometheus
        
        log "Iniciando Grafana..."
        $COMPOSE_CMD up -d grafana
        wait_for_grafana
        
    elif [[ "$INSTALL_MODE" == "single-server" ]]; then
        # Ordem para Single-Server
        log "Verificando PostgreSQL..."
        if ! systemctl is-active --quiet postgresql; then
            log "Iniciando PostgreSQL..."
            sudo systemctl start postgresql
            sleep 5  # Aguardar PostgreSQL iniciar
        else
            log "✅ PostgreSQL já está rodando"
        fi
        
        log "Iniciando Backend..."
        sudo systemctl start smart-signage
        wait_for_backend
        
        # Nginx já foi iniciado em setup_nginx(), apenas verificar
        log "Verificando Nginx..."
        if ! systemctl is-active --quiet nginx; then
            log "Nginx não está ativo. Tentando iniciar..."
            sudo systemctl enable nginx
            sudo systemctl start nginx
            sleep 2
        fi
        wait_for_nginx
        
    elif [[ "$INSTALL_MODE" == "development" ]]; then
        # Ordem para Desenvolvimento
        log "Iniciando Backend em modo desenvolvimento..."
        cd $INSTALL_DIR/backend
        npm run dev &
        BACKEND_PID=$!
        wait_for_backend
        
        log "Iniciando Frontend em modo desenvolvimento..."
        cd $INSTALL_DIR/frontend
        npm start &
        FRONTEND_PID=$!
        wait_for_frontend
        
        log "Iniciando Nginx..."
        sudo systemctl start nginx
        wait_for_nginx
        
        # Salvar PIDs para cleanup posterior
        echo $BACKEND_PID > $INSTALL_DIR/.backend.pid
        echo $FRONTEND_PID > $INSTALL_DIR/.frontend.pid
    fi
    
    log "Todos os serviços iniciados na ordem correta!"
}

# Verificar ordem de inicialização
check_startup_order() {
    log "Verificando ordem de inicialização dos serviços..."
    
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        # Ordem para Docker
        # Serviços monitorados (monolito app)
        SERVICES=("postgres" "redis" "ollama" "app" "prometheus" "grafana")
        
        for service in "${SERVICES[@]}"; do
            log "Verificando $service..."
            
            # Aguardar serviço estar pronto
            case $service in
                "postgres")
                    wait_for_postgres
                    ;;
                "redis")
                    wait_for_redis
                    ;;
                "ollama")
                    wait_for_ollama
                    ;;
                "backend")
                    wait_for_backend
                    ;;
                "frontend")
                    wait_for_frontend  # Este já inclui verificação do Nginx integrado
                    ;;
                "prometheus")
                    wait_for_prometheus
                    ;;
                "grafana")
                    wait_for_grafana
                    ;;
            esac
        done
        
    elif [[ "$INSTALL_MODE" == "single-server" ]]; then
        # Ordem para Single-Server
        SERVICES=("backend" "nginx")
        
        for service in "${SERVICES[@]}"; do
            log "Verificando $service..."
            
            case $service in
                "backend")
                    wait_for_backend
                    ;;
                "nginx")
                    wait_for_nginx
                    ;;
            esac
        done
        
    elif [[ "$INSTALL_MODE" == "development" ]]; then
        # Ordem para Desenvolvimento
        SERVICES=("backend" "frontend" "nginx")
        
        for service in "${SERVICES[@]}"; do
            log "Verificando $service..."
            
            case $service in
                "backend")
                    wait_for_backend_dev
                    ;;
                "frontend")
                    wait_for_frontend_dev
                    ;;
                "nginx")
                    wait_for_nginx
                    ;;
            esac
        done
    fi
    
    log "Ordem de inicialização verificada!"
}

# Funções de espera para cada serviço
wait_for_postgres() {
    log "Aguardando PostgreSQL..."
    local attempts=0
    local delay=2
    while [[ $attempts -lt 30 ]]; do
        if $COMPOSE_CMD exec -T postgres pg_isready -U smartsignage > /dev/null 2>&1; then
            log "✅ PostgreSQL: Pronto"
            return 0
        fi
        attempts=$((attempts+1))
        sleep "$delay"
        if [[ $delay -lt 10 ]]; then delay=$((delay+1)); fi
    done
    warning "❌ PostgreSQL: Timeout"
}

wait_for_redis() {
    log "Aguardando Redis..."
    local attempts=0
    local delay=2
    while [[ $attempts -lt 15 ]]; do
        if $COMPOSE_CMD exec -T redis redis-cli ping > /dev/null 2>&1; then
            log "✅ Redis: Pronto"
            return 0
        fi
        attempts=$((attempts+1))
        sleep "$delay"
        if [[ $delay -lt 10 ]]; then delay=$((delay+1)); fi
    done
    warning "❌ Redis: Timeout"
}

wait_for_ollama() {
    log "Aguardando Ollama..."
    local attempts=0
    local delay=3
    while [[ $attempts -lt 20 ]]; do
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            log "✅ Ollama: Pronto"
            return 0
        fi
        attempts=$((attempts+1))
        sleep "$delay"
        if [[ $delay -lt 15 ]]; then delay=$((delay+1)); fi
    done
    warning "❌ Ollama: Timeout"
}

wait_for_backend() {
    log "Aguardando Backend..."
    
    # No modo single-server, verificar serviço systemd primeiro
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        log "Verificando serviço systemd smart-signage..."
        
        # Aguardar serviço estar ativo
        for i in {1..30}; do
            if systemctl is-active --quiet smart-signage; then
                log "✅ Serviço smart-signage está ativo"
                break
            fi
            if [[ $i -eq 30 ]]; then
                warning "⚠️ Serviço smart-signage não iniciou após 60 segundos"
                log "Verificando status do serviço..."
                sudo systemctl status smart-signage --no-pager -l || true
                log "Verificando logs do serviço..."
                sudo journalctl -u smart-signage --no-pager -n 50 || true
                return 1
            fi
            sleep 2
        done
    fi
    
    # Aguardar endpoint responder
    for i in {1..60}; do
        # Tentar diferentes endpoints de health check
        if curl -s http://localhost:3000/health > /dev/null 2>&1 || \
           curl -s http://localhost:3000/api/health > /dev/null 2>&1 || \
           curl -s http://localhost:3000/ > /dev/null 2>&1; then
            log "✅ Backend: Pronto"
            return 0
        fi
        
        # Mostrar progresso a cada 10 tentativas
        if [[ $((i % 10)) -eq 0 ]]; then
            log "Aguardando Backend responder... (${i}/60)"
            if [[ "$INSTALL_MODE" == "single-server" ]]; then
                # Verificar logs em modo single-server
                log "Últimas linhas do log do serviço:"
                sudo journalctl -u smart-signage --no-pager -n 5 || true
            fi
        fi
        
        sleep 2
    done
    
    echo -e "${YELLOW}[WARNING]${NC} ❌ Backend: Timeout após 2 minutos"
    
    # Diagnóstico específico por modo
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        echo -e "${YELLOW}[WARNING]${NC} Verificando logs do serviço systemd..."
        sudo journalctl -u smart-signage --no-pager -n 50 || true
        echo -e "${YELLOW}[WARNING]${NC} Verificando status do serviço..."
        sudo systemctl status smart-signage --no-pager -l || true
    else
        echo -e "${YELLOW}[WARNING]${NC} Iniciando diagnóstico automático..."
        diagnose_and_fix_backend
    fi
}

# Função de diagnóstico e correção automática do backend
diagnose_and_fix_backend() {
    log_detailed "🔍 DIAGNÓSTICO AUTOMÁTICO DO BACKEND"
    
    # Verificar se o container está rodando
    if ! docker ps | grep -q "smartsignage-backend"; then
        log_error "Container backend não está rodando"
        log "🔄 Tentando reiniciar container..."
        docker compose up -d backend
        sleep 10
        return
    fi
    
    # Verificar logs do backend
    log_detailed "📋 Analisando logs do backend..."
    BACKEND_LOGS=$(docker logs smartsignage-backend --tail 50 2>&1)
    
    # Mostrar logs para análise
    log_detailed "Logs do backend (últimas 20 linhas):"
    echo "$BACKEND_LOGS" | tail -20 | while read line; do
        log_detailed "  $line"
    done
    
    # Detectar problemas comuns
    if echo "$BACKEND_LOGS" | grep -q "prisma generate"; then
        log_error "PROBLEMA DETECTADO: Prisma client não inicializado"
        log "🔄 Aplicando correção específica para Prisma..."
        fix_prisma_initialization
    elif echo "$BACKEND_LOGS" | grep -q "Database not initialized"; then
        log_error "PROBLEMA DETECTADO: Database not initialized"
        log "🔄 Aplicando correção automática..."
        fix_database_initialization
    elif echo "$BACKEND_LOGS" | grep -q "Cannot find module"; then
        log_error "PROBLEMA DETECTADO: Módulos não encontrados"
        log "🔄 Reconstruindo container..."
        docker compose down backend
        docker compose build --no-cache backend
        docker compose up -d backend
        sleep 15
    elif echo "$BACKEND_LOGS" | grep -q "EADDRINUSE"; then
        log_error "PROBLEMA DETECTADO: Porta em uso"
        log "🔄 Liberando porta 3000..."
        sudo fuser -k 3000/tcp 2>/dev/null || true
        docker compose restart backend
        sleep 10
    elif echo "$BACKEND_LOGS" | grep -q "Permission denied"; then
        log_error "PROBLEMA DETECTADO: Permissões incorretas"
        log "🔄 Corrigindo permissões..."
        fix_backend_permissions
    elif echo "$BACKEND_LOGS" | grep -q "TypeError"; then
        log_error "PROBLEMA DETECTADO: Erro de tipo JavaScript"
        log "🔄 Reconstruindo com limpeza completa..."
        apply_general_backend_fixes
    else
        log_error "PROBLEMA NÃO IDENTIFICADO - Aplicando correções gerais..."
        apply_general_backend_fixes
    fi
    
    # Tentar novamente após correções
    log "🔄 Testando backend após correções..."
    for i in {1..30}; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            log "✅ Backend: Corrigido e funcionando!"
            return 0
        fi
        sleep 2
    done
    
    log_error "Backend ainda não está respondendo após correções"
    log_detailed "Logs finais do backend:"
    docker logs smartsignage-backend --tail 20 2>/dev/null || echo "Não foi possível obter logs"
}

# Corrigir inicialização do Prisma
fix_prisma_initialization() {
    log "🔄 Corrigindo inicialização do Prisma..."
    
    # Parar container completamente para evitar loop de reinicialização
    log_detailed "Parando container backend para correção..."
    docker compose stop backend
    sleep 5
    
    # Limpar redes conflitantes primeiro
    log_detailed "Limpando redes conflitantes..."
    docker network prune -f 2>/dev/null || true
    
    # Iniciar container em modo interativo para correção
    log_detailed "Iniciando container backend em modo de correção..."
    docker compose run --rm --no-deps backend sh -c '
        echo "🔧 Modo de correção do Prisma iniciado"
        
        # Verificar estrutura de diretórios
        echo "📁 Estrutura atual:"
        ls -la /app/
        
        # Criar diretório prisma no local correto
        mkdir -p /app/prisma
        
        # Criar schema.prisma mínimo
        cat > /app/prisma/schema.prisma << 'EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String
  name      String
  role      String   @default("user")
  is_active Boolean  @default(true)
  created_at DateTime @default(now())
  updated_at DateTime @default(now())
}

model Client {
  id        Int      @id @default(autoincrement())
  name      String
  email     String?
  phone     String?
  address   String?
  is_active Boolean  @default(true)
  created_at DateTime @default(now())
  updated_at DateTime @default(now())
}

model Totem {
  id            Int      @id @default(autoincrement())
  name          String
  location      String?
  client_id     Int?
  is_active     Boolean  @default(true)
  last_heartbeat DateTime?
  created_at    DateTime @default(now())
  updated_at    DateTime @default(now())
}

model Media {
  id           Int      @id @default(autoincrement())
  filename     String
  original_name String
  file_path    String
  file_type    String
  file_size    Int
  duration     Int?
  client_id    Int?
  created_at   DateTime @default(now())
}

model Playlist {
  id          Int      @id @default(autoincrement())
  name        String
  description String?
  client_id   Int?
  is_active   Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @default(now())
}

model PlaylistItem {
  id          Int      @id @default(autoincrement())
  playlist_id Int?
  media_id    Int?
  order_index Int
  duration    Int      @default(10000)
  created_at  DateTime @default(now())
}
EOF
        
        echo "✅ Schema.prisma criado em /app/prisma/"
        
        # Verificar se foi criado
        ls -la /app/prisma/
        
        # Executar prisma generate no diretório correto
        echo "🔄 Executando prisma generate..."
        cd /app
        npx prisma generate --schema=./prisma/schema.prisma
        
        if [ $? -eq 0 ]; then
            echo "✅ Prisma generate executado com sucesso"
        else
            echo "❌ Falha ao executar prisma generate"
            exit 1
        fi
        
        echo "✅ Correção do Prisma concluída"
    '
    
    PRISMA_EXIT_CODE=$?
    
    if [ $PRISMA_EXIT_CODE -eq 0 ]; then
        log "✅ Prisma generate executado com sucesso"
        
        # Reconstruir imagem com Prisma gerado
        log "🔄 Reconstruindo imagem backend com Prisma corrigido..."
        docker compose build --no-cache backend
        
        # Iniciar backend normalmente
        log "🔄 Iniciando backend com Prisma corrigido..."
        docker compose up -d backend
        sleep 15
    else
        log_error "Falha ao executar prisma generate (código: $PRISMA_EXIT_CODE)"
        log "🔄 Tentando reconstruir container completamente..."
        rebuild_backend_container
    fi
}

# Função para reconstruir container backend
rebuild_backend_container() {
    log "🔄 Reconstruindo container backend..."
    
    # Parar apenas o backend
    docker compose stop backend
    docker compose rm -f backend
    
    # Reconstruir com cache limpo
    log "🔄 Reconstruindo container backend..."
    docker compose build --no-cache backend
    
    # Iniciar novamente
    log "🔄 Iniciando container backend reconstruído..."
    docker compose up -d backend
    sleep 15
}

# Corrigir inicialização do banco de dados
fix_database_initialization() {
    log "🔄 Corrigindo inicialização do banco de dados..."
    
    # Verificar se o banco está acessível
    if ! docker exec smartsignage-postgres pg_isready -U smartsignage > /dev/null 2>&1; then
        log "❌ Banco de dados não está acessível"
        log "🔄 Reiniciando PostgreSQL..."
        docker compose restart postgres
        sleep 10
    fi
    
    # Reiniciar backend para forçar nova inicialização
    log "🔄 Reiniciando backend..."
    docker compose restart backend
    sleep 15
}

# Corrigir permissões do backend
fix_backend_permissions() {
    log "🔄 Corrigindo permissões do backend..."
    
    # Ajustar permissões dos volumes
    docker exec smartsignage-backend chown -R smartsignage:nodejs /app 2>/dev/null || true
    docker exec smartsignage-backend chmod -R 755 /app 2>/dev/null || true
    
    # Reiniciar container
    docker compose restart backend
    sleep 10
}

# Aplicar correções gerais
apply_general_backend_fixes() {
    log "🔄 Aplicando correções gerais..."
    
    # Parar todos os containers
    docker compose down
    
    # Limpar volumes problemáticos
    docker volume prune -f 2>/dev/null || true
    
    # Reconstruir e iniciar
    docker compose build --no-cache backend
    docker compose up -d postgres redis ollama
    sleep 10
    docker compose up -d backend
    sleep 15
}

wait_for_frontend() {
    log_progress "Aguardando Frontend..."
    local attempts=0
    local delay=2
    while [[ $attempts -lt 20 ]]; do
        log_detailed "Tentativa $((attempts+1))/20 - Testando conectividade do frontend..."
        if curl -s -f http://localhost:3001 > /dev/null 2>&1; then
            log_status "✅ Frontend: Pronto (porta 3001)"
            return 0
        fi
        CONTAINER_STATUS=$(docker ps --filter "name=smartsignage-frontend" --format "table {{.Status}}" | tail -1)
        log_detailed "Status do container: $CONTAINER_STATUS"
        attempts=$((attempts+1))
        sleep "$delay"
        if [[ $delay -lt 8 ]]; then delay=$((delay+1)); fi
    done
    log_error "❌ Frontend: Timeout após ~45 segundos"
    
    # Diagnóstico automático do frontend
    diagnose_and_fix_frontend
}

# Função de diagnóstico e correção automática do frontend
diagnose_and_fix_frontend() {
    log_error "🔍 DIAGNÓSTICO AUTOMÁTICO DO FRONTEND"
    
    # Verificar se o container está rodando
    log_container "Verificando status do container frontend..."
    if ! docker ps | grep -q "smartsignage-frontend"; then
        log_error "❌ Container frontend não está rodando"
        log_progress "🔄 Tentando reiniciar container..."
        docker compose up -d frontend
        sleep 10
        return
    fi
    
    # Verificar logs do frontend
    log_detailed "📋 Analisando logs do frontend..."
    FRONTEND_LOGS=$(docker logs smartsignage-frontend --tail 50 2>&1)
    log_detailed "Logs do frontend:"
    echo "$FRONTEND_LOGS" | head -20
    
    # Verificar se o container está saudável
    log_status "Verificando health check do frontend..."
    FRONTEND_HEALTH=$(docker inspect smartsignage-frontend --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-health-check")
    log_status "Status de saúde: $FRONTEND_HEALTH"
    
    # Verificar se a porta está respondendo
    log_progress "Testando conectividade do frontend..."
    if curl -s -f http://localhost:3001 >/dev/null 2>&1; then
        log_status "✅ Frontend respondendo na porta 3001"
        return
    else
        log_error "❌ Frontend não responde na porta 3001"
    fi
    
    # Detectar problemas comuns
    if echo "$FRONTEND_LOGS" | grep -q "Cannot find module"; then
        log_error "🔧 PROBLEMA DETECTADO: Módulos não encontrados"
        log_progress "🔄 Reconstruindo container frontend..."
        docker compose down frontend
        docker compose build --no-cache frontend
        docker compose up -d frontend
        sleep 15
    elif echo "$FRONTEND_LOGS" | grep -q "nginx"; then
        log_error "🔧 PROBLEMA DETECTADO: Erro no Nginx interno"
        log_progress "🔄 Verificando configuração do Nginx..."
        docker exec smartsignage-frontend nginx -t 2>&1 | head -10
    elif echo "$FRONTEND_LOGS" | grep -q "502\|Bad Gateway"; then
        log_error "🔧 PROBLEMA DETECTADO: Erro 502 Bad Gateway"
        log_progress "🔄 Verificando conectividade interna..."
        docker exec smartsignage-frontend curl -s http://localhost:80 || echo "Erro interno"
    elif echo "$FRONTEND_LOGS" | grep -q "Permission denied"; then
        log_error "🔧 PROBLEMA DETECTADO: Permissões incorretas"
        log_progress "🔄 Corrigindo permissões..."
        docker exec smartsignage-frontend chown -R nginx:nginx /usr/share/nginx/html 2>/dev/null || true
        docker compose restart frontend
        sleep 10
    else
        log_error "🔧 PROBLEMA NÃO IDENTIFICADO - Aplicando correções gerais..."
        log_progress "🔄 Reiniciando container frontend..."
        docker compose restart frontend
        sleep 15
    fi
    
    # Tentar novamente após correções
    log_progress "🔄 Testando frontend após correções..."
    for i in {1..15}; do
        if curl -s -f http://localhost:3001 > /dev/null 2>&1; then
            log_status "✅ Frontend: Corrigido e funcionando!"
            return 0
        fi
        sleep 2
    done
    
    log "❌ Frontend ainda não está respondendo após correções"
    log "📋 Logs finais do frontend:"
    docker logs smartsignage-frontend --tail 20 2>/dev/null || echo "Não foi possível obter logs"
}

wait_for_nginx() {
    # Nginx agora está integrado no container frontend
    # Esta função verifica o frontend que contém o Nginx
    log_progress "Aguardando Frontend (com Nginx integrado)..."
    
    # No modo Docker, Nginx está no frontend - usar wait_for_frontend
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        wait_for_frontend
        return $?
    else
        # Modo single-server ou development: verificar serviço Nginx do sistema
        # Primeiro, garantir que o Nginx está iniciado
        if ! systemctl is-active --quiet nginx 2>/dev/null; then
            log "Nginx não está ativo. Tentando iniciar..."
            sudo systemctl enable nginx 2>/dev/null || true
            sudo systemctl start nginx 2>/dev/null || {
                log_error "Falha ao iniciar Nginx!"
                sudo systemctl status nginx --no-pager -l || true
                return 1
            }
            sleep 2
        fi
        
        # Aguardar Nginx responder
        local attempts=0
        local delay=2
        while [[ $attempts -lt 20 ]]; do
            log_detailed "Tentativa $((attempts+1))/20 - Testando conectividade do Nginx..."
            
            # Verificar se serviço está ativo
            if systemctl is-active --quiet nginx 2>/dev/null; then
                # Verificar se responde na porta 80
                if curl -s -f http://localhost:80 > /dev/null 2>&1; then
                    log_status "✅ Nginx: Pronto (serviço ativo na porta 80)"
                    return 0
                fi
            else
                # Se não estiver ativo, tentar iniciar novamente
                log "Nginx não está ativo. Tentando iniciar..."
                sudo systemctl start nginx 2>/dev/null || true
                sleep 2
            fi
            
            attempts=$((attempts+1))
            sleep "$delay"
            if [[ $delay -lt 8 ]]; then delay=$((delay+1)); fi
        done
        
        log_error "❌ Nginx: Timeout após ~40 segundos"
        log "Status do serviço Nginx:"
        sudo systemctl status nginx --no-pager -l 2>/dev/null || echo "Não foi possível obter status"
        log "Testando configuração do Nginx:"
        sudo nginx -t 2>&1 || true
        log "Verificando se porta 80 está em uso:"
        sudo ss -tlnp | grep ":80 " || echo "Porta 80 não está em uso"
        return 1
    fi
}

wait_for_prometheus() {
    log_progress "Aguardando Prometheus..."
    for i in {1..15}; do
        log_detailed "Tentativa $i/15 - Testando conectividade do Prometheus..."
        if curl -s -f http://localhost:9090/-/healthy > /dev/null 2>&1; then
            log_status "✅ Prometheus: Pronto (porta 9090)"
            return 0
        fi
        
        # Verificar status do container
        CONTAINER_STATUS=$(docker ps --filter "name=smartsignage-prometheus" --format "table {{.Status}}" | tail -1)
        log_detailed "Status do container Prometheus: $CONTAINER_STATUS"
        
        sleep 2
    done
    log_error "❌ Prometheus: Timeout após 30 segundos"
    
    # Diagnóstico do Prometheus
    log_detailed "Logs do container Prometheus:"
    docker logs smartsignage-prometheus --tail 20 2>/dev/null || echo "Não foi possível obter logs"
}

wait_for_grafana() {
    log "Aguardando Grafana..."
    for i in {1..20}; do
        if curl -s http://localhost:3002/api/health > /dev/null 2>&1; then
            log "✅ Grafana: Pronto"
            return 0
        fi
        sleep 3
    done
    warning "❌ Grafana: Timeout"
}

# Funções específicas para modo development
wait_for_backend_dev() {
    log "Aguardando Backend (Development)..."
    for i in {1..30}; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            log "✅ Backend (Dev): Pronto"
            return 0
        fi
        sleep 2
    done
    warning "❌ Backend (Dev): Timeout"
}

wait_for_frontend_dev() {
    log "Aguardando Frontend (Development)..."
    for i in {1..30}; do
        if curl -s http://localhost:3001 > /dev/null 2>&1; then
            log "✅ Frontend (Dev): Pronto"
            return 0
        fi
        sleep 2
    done
    warning "❌ Frontend (Dev): Timeout"
}

# Criar script de entrypoint se não existir
create_entrypoint_script() {
    log "Criando script de entrypoint..."
    
    # Criar diretório docker se não existir
    mkdir -p docker
    
    # Criar arquivo entrypoint.sh
    cat > docker/entrypoint.sh << 'EOF'
#!/bin/bash

# Smart Signage Pro v2.0 - Script de Inicialização Docker
# Executa instalação automática para modelo servidor único

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Banner
echo -e "${BLUE}"
echo "=============================================="
echo "    Smart Signage Pro v2.0 - Docker Container"
echo "    Instalação Automática - Servidor Único"
echo "=============================================="
echo -e "${NC}"

# =============================================
# CONFIGURAÇÃO INICIAL
# =============================================

log "Iniciando configuração do Smart Signage Pro v2.0..."

# Definir variáveis de ambiente padrão
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}
export HOST=${HOST:-0.0.0.0}
export DATABASE_TYPE=postgresql
export DATABASE_URL=${DATABASE_URL:-postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage}
export JWT_SECRET=${JWT_SECRET:-smartsignage-docker-secret-key-2025}
export UPLOAD_PATH=${UPLOAD_PATH:-./uploads}

# =============================================
# VERIFICAÇÕES INICIAIS
# =============================================

log "Verificando dependências do sistema..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
    error "Node.js não encontrado"
fi

# Verificar npm
if ! command -v npm &> /dev/null; then
    error "npm não encontrado"
fi

# Verificar SQLite
if ! command -v sqlite3 &> /dev/null; then
    warning "SQLite3 não encontrado, usando implementação Node.js"
fi

log "✅ Dependências verificadas"

# =============================================
# CONFIGURAÇÃO DO BANCO DE DADOS
# =============================================

log "Configurando banco de dados..."

# Criar diretório de dados se não existir
mkdir -p /app/data /app/uploads /app/logs /app/backups

# Verificar se o banco existe
if [ ! -f "/app/data/smartsignage.db" ]; then
    log "Criando banco de dados SQLite..."
    touch /app/data/smartsignage.db
    log "✅ Banco de dados criado"
else
    log "✅ Banco de dados encontrado"
fi

# =============================================
# CONFIGURAÇÃO DO FRONTEND
# =============================================

log "Configurando frontend..."

if [ -d "/app/frontend" ]; then
    cd /app/frontend
    
    # Verificar se node_modules existe
    if [ ! -d "node_modules" ]; then
        log "Instalando dependências do frontend..."
        npm install --production
    fi
    
    # Build do frontend se necessário
    if [ ! -d "build" ]; then
        log "Fazendo build do frontend..."
        npm run build
    fi
    
    cd /app
    log "✅ Frontend configurado"
else
    warning "Diretório frontend não encontrado"
fi

# =============================================
# CONFIGURAÇÃO DO BACKEND
# =============================================

log "Configurando backend..."

cd /app/backend

# Verificar se dist existe
if [ ! -d "dist" ]; then
    log "Compilando TypeScript..."
    npm run build
fi

log "✅ Backend configurado"

# =============================================
# CONFIGURAÇÃO DO PLAYER
# =============================================

log "Configurando player HTML5..."

if [ -f "/app/player/index.html" ]; then
    log "✅ Player HTML5 encontrado"
else
    warning "Player HTML5 não encontrado"
fi

# =============================================
# CONFIGURAÇÃO DE PERMISSÕES
# =============================================

log "Configurando permissões..."

# Ajustar permissões dos diretórios
chmod -R 755 /app/data /app/uploads /app/logs /app/backups
chmod +x /app/scripts/*.sh 2>/dev/null || true

log "✅ Permissões configuradas"

# =============================================
# TESTE DE CONECTIVIDADE
# =============================================

log "Testando conectividade..."

# Testar se a porta está disponível
if lsof -Pi :${PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
    warning "Porta ${PORT} já está em uso"
else
    log "✅ Porta ${PORT} disponível"
fi

# =============================================
# INICIALIZAÇÃO DOS SERVIÇOS
# =============================================

log "Inicializando serviços..."

# Executar script de primeira inicialização se existir
if [ -f "/app/scripts/first-boot.sh" ]; then
    log "Executando script de primeira inicialização..."
    bash /app/scripts/first-boot.sh
fi

# =============================================
# RESUMO DA CONFIGURAÇÃO
# =============================================

log "🎉 Configuração concluída com sucesso!"
log ""
log "📊 RESUMO DA CONFIGURAÇÃO:"
log "✅ Node.js: $(node --version)"
log "✅ npm: $(npm --version)"
log "✅ Banco de dados: ${DATABASE_TYPE}"
log "✅ Porta: ${PORT}"
log "✅ Ambiente: ${NODE_ENV}"
log "✅ Diretório de dados: /app/data"
log "✅ Diretório de uploads: /app/uploads"
log ""
log "🚀 Iniciando Smart Signage Pro v2.0..."

# =============================================
# EXECUÇÃO DO COMANDO PRINCIPAL
# =============================================

cd /app

# Executar o comando passado como argumento
exec "$@"
EOF

    # Dar permissão de execução
    chmod +x docker/entrypoint.sh
    
    # Verificar se o arquivo foi criado corretamente
    if [[ -f "docker/entrypoint.sh" && -x "docker/entrypoint.sh" ]]; then
        log "✅ Script de entrypoint criado com sucesso!"
        log "Tamanho: $(stat -c%s "docker/entrypoint.sh" 2>/dev/null || stat -f%z "docker/entrypoint.sh" 2>/dev/null || echo "N/A") bytes"
    else
        error "❌ Falha ao criar script de entrypoint"
        return 1
    fi
}

# Testar build do Docker
test_docker_build() {
    log "Verificando Dockerfiles e arquivos necessários..."
    
    # Verificar Docker
    log "Verificando Docker..."
    if ! command -v docker &> /dev/null; then
        error "Docker não instalado"
        return 1
    fi
    
    log "✅ Docker instalado: $(docker --version)"
    
    if ! systemctl is-active docker &> /dev/null; then
        log "Docker não está rodando, tentando iniciar..."
        sudo systemctl start docker
        sleep 3
        if ! systemctl is-active docker &> /dev/null; then
            error "Falha ao iniciar Docker"
            return 1
        fi
    fi
    
    log "✅ Docker rodando"
    
    # Verificar Dockerfiles especializados
    log "Verificando Dockerfiles especializados..."
    if [[ -f "Dockerfile.backend" ]] && [[ -f "Dockerfile.frontend" ]]; then
        log "✅ Dockerfiles especializados encontrados"
    else
        warning "⚠️ Dockerfiles especializados não encontrados"
        warning "⚠️ Usando arquitetura antiga (apenas aviso)"
    fi
    
    # Verificar arquivos necessários
    log "Verificando arquivos necessários..."
    REQUIRED_FILES=(
        "docker-compose.yml"
        "backend/package.json"
        "frontend/package.json"
        "nginx/frontend.conf"
        "nginx/nginx.conf"
    )
    
    for file in "${REQUIRED_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            log "✅ $file: EXISTE"
        else
            error "❌ $file: NÃO EXISTE"
            return 1
        fi
    done
    
    log "✅ Todos os arquivos necessários estão presentes"
    return 0
}

setup_first_boot() {
    if [[ "$INSTALL_MODE" != "single-server" ]]; then
        log "Primeiro boot será configurado pelo Docker"
        return 0
    fi
    
    log "Configurando primeiro boot (migrations e seed)..."
    
    cd $INSTALL_DIR/backend || {
        error "Diretório backend não encontrado: $INSTALL_DIR/backend"
        exit 1
    }
    
    # Garantir que DATABASE_URL está definido
    if [[ -z "$DATABASE_URL" ]]; then
        error "DATABASE_URL não está definido!"
        exit 1
    fi
    
    export DATABASE_URL
    export NODE_ENV=production
    
    # Gerar Prisma Client
    log "Gerando Prisma Client..."
    if npx prisma generate; then
        log "✅ Prisma Client gerado com sucesso"
    else
        error "❌ Falha ao gerar Prisma Client"
        exit 1
    fi
    
    # Executar migrations ou criar schema
    log "Criando schema do banco de dados..."
    
    # Verificar se existem migrations
    if [[ -d "prisma/migrations" ]] && [[ -n "$(ls -A prisma/migrations 2>/dev/null)" ]]; then
        log "Migrations encontradas - executando migrate deploy..."
        if npx prisma migrate deploy; then
            log "✅ Migrations executadas com sucesso"
        else
            warn "⚠️ Migrate deploy falhou, tentando db push..."
            if npx prisma db push --accept-data-loss --skip-generate; then
                log "✅ Schema criado com sucesso (db push)"
            else
                error "❌ Falha ao criar schema do banco de dados"
                exit 1
            fi
        fi
    else
        log "Nenhuma migration encontrada - usando db push para criar schema..."
        log "Executando prisma db push..."
        if npx prisma db push --accept-data-loss --skip-generate; then
            log "✅ Schema criado com sucesso (db push)"
        else
            error "❌ Falha ao criar schema do banco de dados"
            error "Verificando conexão com o banco..."
            psql "$DATABASE_URL" -c "SELECT 1" || error "❌ Não foi possível conectar ao banco de dados!"
            
            # Tentar criar schema manualmente usando código do backend
            log "Tentando criar schema manualmente..."
            cd $INSTALL_DIR/backend
            node -e "
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();
            (async () => {
                try {
                    await prisma.\$connect();
                    console.log('✅ Conectado ao banco');
                    
                    // Verificar se tabelas já existem
                    const tables = await prisma.\$queryRaw\`
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                    \`;
                    console.log('Tabelas encontradas:', tables.length);
                    
                    if (tables.length === 0) {
                        console.log('⚠️ Nenhuma tabela encontrada - executando db push...');
                        const { execSync } = require('child_process');
                        execSync('npx prisma db push --accept-data-loss --skip-generate', { 
                            stdio: 'inherit',
                            env: process.env
                        });
                        console.log('✅ Schema criado');
                    } else {
                        console.log('✅ Tabelas já existem no banco');
                    }
                    
                    await prisma.\$disconnect();
                    process.exit(0);
                } catch (e) {
                    console.error('❌ Erro:', e.message);
                    await prisma.\$disconnect();
                    process.exit(1);
                }
            })();
            " || {
                error "❌ Falha crítica ao criar schema do banco de dados"
                error "Verifique os logs acima para mais detalhes"
                exit 1
            }
        fi
    fi
    
    # Verificar se tabelas foram criadas corretamente
    log "Verificando se todas as tabelas foram criadas..."
    cd $INSTALL_DIR/backend
    
    # Lista de tabelas obrigatórias
    REQUIRED_TABLES=("users" "clients" "totems" "medias" "playlists" "playlist_items" "campaigns")
    
    MISSING_TABLES=()
    for table in "${REQUIRED_TABLES[@]}"; do
        if ! psql "$DATABASE_URL" -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table'" | grep -q 1; then
            MISSING_TABLES+=("$table")
        fi
    done
    
    if [[ ${#MISSING_TABLES[@]} -gt 0 ]]; then
        warn "⚠️ Tabelas faltando: ${MISSING_TABLES[*]}"
        log "Tentando criar todas as tabelas novamente com db push..."
        
        # Gerar Prisma Client novamente antes de db push
        npx prisma generate || warn "⚠️ Falha ao gerar Prisma Client"
        
        # Executar db push para criar todas as tabelas
        if npx prisma db push --accept-data-loss --skip-generate; then
            log "✅ Tabelas criadas com sucesso"
            
            # Verificar novamente
            for table in "${MISSING_TABLES[@]}"; do
                if psql "$DATABASE_URL" -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table'" | grep -q 1; then
                    log "✅ Tabela $table criada"
                else
                    error "❌ Falha ao criar tabela $table"
                fi
            done
        else
            error "❌ Falha crítica ao criar tabelas do banco de dados"
            error "Tabelas faltando: ${MISSING_TABLES[*]}"
            exit 1
        fi
    else
        log "✅ Todas as tabelas obrigatórias existem"
    fi
    
    # Executar seed (dados iniciais)
    log "Executando seed do banco de dados..."
    if npx prisma db seed 2>/dev/null || npm run seed 2>/dev/null; then
        log "✅ Seed executado com sucesso"
    else
        warn "⚠️ Seed não foi executado (pode não estar configurado)"
        # Criar usuário admin manualmente se necessário
        log "Criando usuário admin padrão..."
        cd $INSTALL_DIR/backend
        
        # Verificar se usuário já existe antes de criar
        log "Verificando se usuário admin já existe..."
        if psql "$DATABASE_URL" -tAc "SELECT 1 FROM users WHERE username = 'admin'" | grep -q 1; then
            log "✅ Usuário admin já existe - atualizando senha..."
            node -e "
            const { PrismaClient } = require('@prisma/client');
            const bcrypt = require('bcryptjs');
            const prisma = new PrismaClient();
            (async () => {
                try {
                    const hashedPassword = await bcrypt.hash('admin123', 12);
                    await prisma.\$executeRaw\`
                        UPDATE users 
                        SET password_hash = \${hashedPassword},
                            role = 'admin',
                            is_active = true,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE username = 'admin'
                    \`;
                    console.log('✅ Senha do admin atualizada para admin123');
                } catch (e) {
                    console.error('Erro ao atualizar:', e.message);
                } finally {
                    await prisma.\$disconnect();
                }
            })();
            " || warn "⚠️ Falha ao atualizar usuário admin"
        else
            log "Criando novo usuário admin..."
            node -e "
            const { PrismaClient } = require('@prisma/client');
            const bcrypt = require('bcryptjs');
            const prisma = new PrismaClient();
            (async () => {
                try {
                    // Verificar se tabela users existe
                    const tables = await prisma.\$queryRaw\`
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = 'users'
                    \`;
                    
                    if (!Array.isArray(tables) || tables.length === 0) {
                        console.error('❌ Tabela users não existe! Execute prisma db push primeiro.');
                        await prisma.\$disconnect();
                        process.exit(1);
                    }
                    
                    // Usar executeRaw para criar com username (campo que existe no banco mas não no Prisma schema)
                    const hashedPassword = await bcrypt.hash('admin123', 12);
                    await prisma.\$executeRaw\`
                        INSERT INTO users (username, email, password_hash, name, role, is_active, created_at, updated_at)
                        VALUES ('admin', 'admin@smart-signage.com', \${hashedPassword}, 'Administrator', 'admin', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT (username) 
                        DO UPDATE SET 
                            role = 'admin',
                            is_active = true,
                            password_hash = \${hashedPassword},
                            updated_at = CURRENT_TIMESTAMP
                    \`;
                    console.log('✅ Usuário admin criado: admin@smart-signage.com / admin123');
                } catch (e) {
                    console.error('❌ Erro ao criar admin:', e.message);
                    console.error('Stack:', e.stack);
                    if (e.message.includes('relation \"users\" does not exist')) {
                        console.error('💡 A tabela users não existe! Execute: npx prisma db push');
                    }
                } finally {
                    await prisma.\$disconnect();
                }
            })();
            " || {
                warn "⚠️ Falha ao criar usuário admin automaticamente"
                warn "Você pode criar manualmente após verificar se o schema foi criado"
            }
        fi
    fi
    
    # Verificar se o admin foi criado corretamente
    log "Verificando se usuário admin foi criado corretamente..."
    cd $INSTALL_DIR/backend
    if psql "$DATABASE_URL" -tAc "SELECT 1 FROM users WHERE username = 'admin'" | grep -q 1; then
        ADMIN_INFO=$(psql "$DATABASE_URL" -tAc "SELECT username, email, role, is_active FROM users WHERE username = 'admin'" 2>/dev/null || echo "")
        if [[ -n "$ADMIN_INFO" ]]; then
            log "✅ Usuário admin encontrado: $ADMIN_INFO"
        else
            warn "⚠️ Usuário admin existe mas não foi possível ler detalhes"
        fi
        
        # Verificar se password_hash existe
        if psql "$DATABASE_URL" -tAc "SELECT password_hash FROM users WHERE username = 'admin'" | grep -q '\$'; then
            log "✅ Senha do admin está configurada (hash encontrado)"
        else
            warn "⚠️ Senha do admin pode não estar configurada corretamente"
        fi
    else
        error "❌ ATENÇÃO: Usuário admin NÃO foi criado!"
        error "Execute manualmente para criar o admin:"
        error "cd $INSTALL_DIR/backend"
        error "node -e \"const {PrismaClient} = require('@prisma/client'); const bcrypt = require('bcryptjs'); const prisma = new PrismaClient(); (async () => { const hash = await bcrypt.hash('admin123', 12); await prisma.\$executeRaw\`INSERT INTO users (username, email, password_hash, name, role, is_active, created_at, updated_at) VALUES ('admin', 'admin@smart-signage.com', \${hash}, 'Administrator', 'admin', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT (username) DO UPDATE SET password_hash = \${hash}\`; await prisma.\$disconnect(); })();\""
    fi
    
    log "✅ Primeiro boot configurado!"
    log "👤 Usuário admin padrão: admin"
    log "🔑 Senha admin padrão: admin123"
    warn "⚠️  IMPORTANTE: Altere a senha padrão após o primeiro login!"
}

# Criar script de gerenciamento
create_management_script() {
    log "Criando script de gerenciamento..."
    
    MANAGEMENT_SCRIPT="$INSTALL_DIR/manage.sh"
    
    if [[ "$INSTALL_MODE" == "development" ]]; then
        # Script específico para desenvolvimento
        cat > $MANAGEMENT_SCRIPT << 'EOF'
#!/bin/bash

# Smart Signage Pro v2.0 - Script de Gerenciamento (Development)
# ==============================================================

INSTALL_DIR="/opt/smart-signage"

case "$1" in
    start)
        echo "Iniciando Smart Signage Pro (Development)..."
        cd $INSTALL_DIR/backend
        npm run dev &
        echo $! > $INSTALL_DIR/.backend.pid
        
        cd $INSTALL_DIR/frontend
        npm start &
        echo $! > $INSTALL_DIR/.frontend.pid
        
        sudo systemctl start nginx
        echo "Serviços iniciados em modo desenvolvimento"
        ;;
    stop)
        echo "Parando Smart Signage Pro (Development)..."
        if [[ -f "$INSTALL_DIR/.backend.pid" ]]; then
            kill $(cat $INSTALL_DIR/.backend.pid) 2>/dev/null
            rm -f $INSTALL_DIR/.backend.pid
        fi
        
        if [[ -f "$INSTALL_DIR/.frontend.pid" ]]; then
            kill $(cat $INSTALL_DIR/.frontend.pid) 2>/dev/null
            rm -f $INSTALL_DIR/.frontend.pid
        fi
        
        sudo systemctl stop nginx
        echo "Serviços parados"
        ;;
    restart)
        echo "Reiniciando Smart Signage Pro (Development)..."
        $0 stop
        sleep 3
        $0 start
        ;;
    status)
        echo "Status do Smart Signage Pro (Development):"
        echo "Backend PID: $(cat $INSTALL_DIR/.backend.pid 2>/dev/null || echo 'Não rodando')"
        echo "Frontend PID: $(cat $INSTALL_DIR/.frontend.pid 2>/dev/null || echo 'Não rodando')"
        sudo systemctl status nginx --no-pager
        ;;
    logs)
        echo "Logs do Smart Signage Pro (Development):"
        echo "Backend logs:"
        tail -f $INSTALL_DIR/backend/logs/*.log 2>/dev/null || echo "Nenhum log encontrado"
        ;;
    update)
        echo "Atualizando Smart Signage Pro (Development)..."
        cd $INSTALL_DIR/backend && npm install
        cd $INSTALL_DIR/frontend && npm install
        echo "Dependências atualizadas"
        ;;
    backup)
        echo "Criando backup..."
        BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).tar.gz"
        tar -czf $BACKUP_FILE -C $INSTALL_DIR data logs
        echo "Backup criado: $BACKUP_FILE"
        ;;
    *)
        echo "Uso: $0 {start|stop|restart|status|logs|update|backup}"
        exit 1
        ;;
esac
EOF
    else
        # Script para Docker e Single-Server
        cat > $MANAGEMENT_SCRIPT << 'EOF'
#!/bin/bash

# Smart Signage Pro v2.0 - Script de Gerenciamento
# ================================================

INSTALL_DIR="/opt/smart-signage"
SERVICE_NAME="smart-signage"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Verificar se Docker está disponível
check_docker() {
    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        error "Docker Compose não encontrado!"
        exit 1
    fi
}

# Verificar se o sistema está rodando
check_status() {
    cd $INSTALL_DIR
    if $COMPOSE_CMD ps | grep -q "Up"; then
        return 0
    else
        return 1
    fi
}

case "$1" in
    start)
        log "Iniciando Smart Signage Pro..."
        check_docker
        cd $INSTALL_DIR
        
        if check_status; then
            warning "Sistema já está rodando!"
            $COMPOSE_CMD ps
        else
            log "Iniciando containers..."
            $COMPOSE_CMD up -d
            
            # Aguardar serviços ficarem prontos
            log "Aguardando serviços ficarem prontos..."
            sleep 10
            
            if check_status; then
                log "✅ Sistema iniciado com sucesso!"
                $COMPOSE_CMD ps
            else
                error "❌ Falha ao iniciar sistema"
                $COMPOSE_CMD logs --tail 20
            fi
        fi
        ;;
    stop)
        log "Parando Smart Signage Pro..."
        check_docker
        cd $INSTALL_DIR
        
        if check_status; then
            $COMPOSE_CMD down
            log "✅ Sistema parado com sucesso!"
        else
            warning "Sistema já está parado!"
        fi
        ;;
    restart)
        log "Reiniciando Smart Signage Pro..."
        $0 stop
        sleep 5
        $0 start
        ;;
    status)
        log "Status do Smart Signage Pro:"
        check_docker
        cd $INSTALL_DIR
        $COMPOSE_CMD ps
        
        # Verificar endpoints
        log "Verificando endpoints..."
        SERVER_IP=$(hostname -I | awk '{print $1}')
        
        echo ""
        echo "📊 ENDPOINTS DISPONÍVEIS:"
        # Carregar .env e definir padrões de portas
        if [ -f "$INSTALL_DIR/.env" ]; then
            . "$INSTALL_DIR/.env"
        fi
        # No modo single-server, Nginx está na porta 80
        if [[ "$INSTALL_MODE" == "single-server" ]]; then
            FRONTEND_PORT=${FRONTEND_PORT:-80}
        else
            FRONTEND_PORT=${FRONTEND_PORT:-8080}
        fi
        FRONTEND_ALT_PORT=${FRONTEND_ALT_PORT:-3001}
        BACKEND_PORT=${BACKEND_PORT:-3000}
        PROMETHEUS_PORT=${PROMETHEUS_PORT:-9090}
        GRAFANA_PORT=${GRAFANA_PORT:-3002}
        echo "Frontend: http://$SERVER_IP:$FRONTEND_PORT"
        echo "Frontend Direto: http://$SERVER_IP:$FRONTEND_ALT_PORT"
        echo "Backend API: http://$SERVER_IP:$BACKEND_PORT"
        echo "Player: http://$SERVER_IP:$FRONTEND_PORT/player"
        echo "Prometheus: http://$SERVER_IP:$PROMETHEUS_PORT"
        echo "Grafana: http://$SERVER_IP:$GRAFANA_PORT"
        ;;
    logs)
        log "Logs do Smart Signage Pro:"
        check_docker
        cd $INSTALL_DIR
        $COMPOSE_CMD logs -f
        ;;
    update)
        log "Atualizando Smart Signage Pro..."
        cd $INSTALL_DIR
        git pull origin main
        cd backend && npm install
        check_docker
        $COMPOSE_CMD down && $COMPOSE_CMD up -d --build
        ;;
    backup)
        log "Criando backup..."
        BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).tar.gz"
        tar -czf $BACKUP_FILE -C $INSTALL_DIR data logs
        log "✅ Backup criado: $BACKUP_FILE"
        ;;
    autostart)
        log "Configurando autostart do sistema..."
        
        # Criar script de autostart
        cat > /etc/systemd/system/smart-signage.service << 'SERVICE_EOF'
[Unit]
Description=Smart Signage Pro v2.0
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/smart-signage
ExecStart=/opt/smart-signage/manage.sh start
ExecStop=/opt/smart-signage/manage.sh stop
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
'SERVICE_EOF'
        
        # Recarregar systemd e habilitar serviço
        sudo systemctl daemon-reload
        sudo systemctl enable smart-signage.service
        
        log "✅ Autostart configurado com sucesso!"
        log "O sistema será iniciado automaticamente no boot do servidor"
        log "Para desabilitar: sudo systemctl disable smart-signage.service"
        ;;
    disable-autostart)
        log "Desabilitando autostart do sistema..."
        sudo systemctl disable smart-signage.service
        log "✅ Autostart desabilitado!"
        ;;
    *)
        echo "Smart Signage Pro v2.0 - Script de Gerenciamento"
        echo "================================================"
        echo ""
        echo "Uso: $0 {start|stop|restart|status|logs|update|backup|autostart|disable-autostart}"
        echo ""
        echo "Comandos disponíveis:"
        echo "  start           - Iniciar o sistema"
        echo "  stop            - Parar o sistema"
        echo "  restart         - Reiniciar o sistema"
        echo "  status          - Ver status e endpoints"
        echo "  logs            - Ver logs em tempo real"
        echo "  update          - Atualizar sistema"
        echo "  backup          - Criar backup"
        echo "  autostart       - Configurar autostart no boot"
        echo "  disable-autostart - Desabilitar autostart"
        echo ""
        echo "Para configurar autostart (iniciar automaticamente no boot):"
        echo "  $0 autostart"
        exit 1
        ;;
esac
EOF
    fi
    
    chmod +x $MANAGEMENT_SCRIPT
    log "Script de gerenciamento criado: $MANAGEMENT_SCRIPT"
}

# Mostrar informações finais
show_final_info() {
    # Carregar .env e padrões de portas
    if [ -f "$INSTALL_DIR/.env" ]; then
        . "$INSTALL_DIR/.env"
    fi
    # No modo single-server, Nginx está na porta 80
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        FRONTEND_PORT=${FRONTEND_PORT:-80}
    else
        FRONTEND_PORT=${FRONTEND_PORT:-8080}
    fi
    FRONTEND_ALT_PORT=${FRONTEND_ALT_PORT:-3001}
    BACKEND_PORT=${BACKEND_PORT:-3000}
    PROMETHEUS_PORT=${PROMETHEUS_PORT:-9090}
    GRAFANA_PORT=${GRAFANA_PORT:-3002}
    # Obter IPs do servidor
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "Não detectado")
    
    # Usar IP externo se disponível, senão usar local
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
        SERVER_IP="$EXTERNAL_IP"
        IP_TYPE="IP Externo"
    else
        SERVER_IP="$LOCAL_IP"
        IP_TYPE="IP Local"
    fi
    
    log "Instalação concluída com sucesso!"
    echo
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║                    🎉 INSTALAÇÃO CONCLUÍDA! 🎉                ║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    🌐 INFORMAÇÕES DO SERVIDOR                ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${BLUE}📍 Endereços do Servidor:${NC}"
    echo -e "   ${GREEN}IP Externo:${NC} ${YELLOW}$EXTERNAL_IP${NC}"
    echo -e "   ${GREEN}IP Local:${NC}   ${YELLOW}$LOCAL_IP${NC}"
    echo -e "   ${GREEN}Usando:${NC}     ${YELLOW}$IP_TYPE${NC}"
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    🌐 LINKS DE ACESSO                        ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${CYAN}📱 PAINEL ADMINISTRATIVO (Frontend):${NC}"
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
    echo -e "   ${YELLOW}👉 IP Externo: http://$EXTERNAL_IP:$FRONTEND_PORT${NC} ${GREEN}(Acesso remoto)${NC}"
    fi
    echo -e "   ${YELLOW}👉 IP Local:   http://$LOCAL_IP:$FRONTEND_PORT${NC} ${BLUE}(Rede interna)${NC}"
    echo -e "   ${BLUE}   (Interface principal do sistema)${NC}"
    echo
    echo -e "${CYAN}🔧 API BACKEND:${NC}"
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
        echo -e "   ${YELLOW}👉 IP Externo: http://$EXTERNAL_IP:3000${NC} ${GREEN}(Acesso remoto)${NC}"
    fi
    echo -e "   ${YELLOW}👉 IP Local:   http://$LOCAL_IP:3000${NC} ${BLUE}(Rede interna)${NC}"
    echo -e "   ${BLUE}   (API REST para integração)${NC}"
    echo
    echo -e "${CYAN}📺 PLAYER DE MÍDIA:${NC}"
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
    echo -e "   ${YELLOW}👉 IP Externo: http://$EXTERNAL_IP:$FRONTEND_PORT/player${NC} ${GREEN}(Acesso remoto)${NC}"
    fi
    echo -e "   ${YELLOW}👉 IP Local:   http://$LOCAL_IP:$FRONTEND_PORT/player${NC} ${BLUE}(Rede interna)${NC}"
    echo -e "   ${BLUE}   (Player para totems)${NC}"
    echo
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
        echo -e "${GREEN}💡 DICA:${NC} ${YELLOW}Use o IP Externo para acesso remoto${NC}"
        echo -e "${GREEN}💡 DICA:${NC} ${YELLOW}Use o IP Local para acesso na rede interna${NC}"
        echo -e "${YELLOW}⚠️  IMPORTANTE:${NC} ${RED}Configure firewall para permitir acesso às portas 80 e 3000${NC}"
    else
        echo -e "${YELLOW}⚠️  AVISO:${NC} ${RED}IP Externo não detectado. Configure firewall para acesso remoto.${NC}"
    fi
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    🔐 CREDENCIAIS DE ACESSO                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${RED}👤 USUÁRIO:${NC} ${YELLOW}admin${NC}"
    echo -e "${RED}🔑 SENHA:${NC}  ${YELLOW}admin123${NC}"
    echo
    echo -e "${RED}⚠️  ATENÇÃO:${NC} ${YELLOW}ALTERE A SENHA APÓS O PRIMEIRO LOGIN!${NC}"
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    📋 INFORMAÇÕES TÉCNICAS                   ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${BLUE}📁 Diretório de Instalação:${NC}"
    echo -e "   $INSTALL_DIR"
    echo
    echo -e "${BLUE}🔧 Scripts de Gerenciamento:${NC}"
    echo -e "   $INSTALL_DIR/manage-system.sh {start|stop|restart|status|logs|update|backup}"
    echo -e "   $INSTALL_DIR/scripts/backup-system.sh"
    echo -e "   $INSTALL_DIR/scripts/monitor-system.sh"
    echo -e "   Comando global: smartsignage {comando}"
    echo
    echo -e "${BLUE}📊 Monitoramento:${NC}"
    echo -e "   Logs:       sudo journalctl -u smart-signage -f"
    echo
    
    # Informações sobre Grafana e Prometheus baseado no modo
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        echo -e "${BLUE}📈 Monitoramento (Grafana/Prometheus):${NC}"
        if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
            echo -e "   Grafana:    http://$EXTERNAL_IP:3002 (admin/admin) ${GREEN}(Acesso remoto)${NC}"
            echo -e "   Prometheus: http://$EXTERNAL_IP:9090 ${GREEN}(Acesso remoto)${NC}"
        fi
        echo -e "   Grafana:    http://$LOCAL_IP:3002 (admin/admin) ${BLUE}(Rede interna)${NC}"
        echo -e "   Prometheus: http://$LOCAL_IP:9090 ${BLUE}(Rede interna)${NC}"
        echo -e "   ${YELLOW}💡 Acesse o Grafana para visualizar dashboards e métricas${NC}"
        echo -e "   ${YELLOW}💡 O Prometheus coleta métricas do sistema${NC}"
    else
        echo -e "${YELLOW}⚠️  Grafana/Prometheus:${NC}"
        echo -e "   ${YELLOW}Monitoramento não está disponível no modo Single-Server${NC}"
        echo -e "   ${YELLOW}Para habilitar: Reinstale usando modo Docker (opção 2)${NC}"
        echo -e "   ${YELLOW}Ou instale manualmente seguindo a documentação${NC}"
    fi
    
    # Informações sobre modo Kiosk
    if [[ "$ENABLE_KIOSK_MODE" == "true" ]]; then
        echo
        echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║                    🖥️  MODO KIOSK CONFIGURADO                  ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
        echo
        echo -e "${CYAN}📺 Modo Kiosk (Totem/Sinalização):${NC}"
        echo -e "   ${GREEN}✓${NC} Ambiente gráfico XFCE instalado"
        echo -e "   ${GREEN}✓${NC} Auto-login configurado"
        echo -e "   ${GREEN}✓${NC} Navegador inicia automaticamente"
        echo -e "   ${GREEN}✓${NC} Tela em modo Portrait (vertical)"
        echo -e "   ${GREEN}✓${NC} URL: ${YELLOW}${KIOSK_URL:-http://$LOCAL_IP:80}${NC}"
        echo
        echo -e "${BLUE}🔧 Gerenciamento do Kiosk:${NC}"
        echo -e "   ${YELLOW}$INSTALL_DIR/scripts/manage-kiosk.sh start${NC}    - Iniciar Kiosk"
        echo -e "   ${YELLOW}$INSTALL_DIR/scripts/manage-kiosk.sh stop${NC}     - Parar Kiosk"
        echo -e "   ${YELLOW}$INSTALL_DIR/scripts/manage-kiosk.sh restart${NC}  - Reiniciar Kiosk"
        echo -e "   ${YELLOW}$INSTALL_DIR/scripts/manage-kiosk.sh rotate${NC}   - Aplicar rotação Portrait"
        echo
        echo -e "${YELLOW}💡 DICA:${NC} ${CYAN}Após reiniciar o servidor, o ambiente gráfico iniciará automaticamente${NC}"
        echo -e "${YELLOW}💡 DICA:${NC} ${CYAN}Para iniciar agora sem reiniciar: sudo systemctl start lightdm${NC}"
    fi
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    🚀 PRÓXIMOS PASSOS                       ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${YELLOW}1.${NC} ${CYAN}Acesse o sistema:${NC} ${YELLOW}http://$SERVER_IP:$FRONTEND_PORT${NC}"
    echo -e "${YELLOW}2.${NC} ${CYAN}Faça login com:${NC} admin/admin123"
    echo -e "${YELLOW}3.${NC} ${CYAN}Altere a senha} do administrador"
    echo -e "${YELLOW}4.${NC} ${CYAN}Configure seus clientes e totems"
    echo -e "${YELLOW}5.${NC} ${CYAN}Configure SSL/HTTPS para produção"
    echo
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║              ✅ SMART SIGNAGE PRO v2.0 PRONTO! ✅            ║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${GREEN}🎯 Sistema instalado e funcionando perfeitamente!${NC}"
    echo -e "${GREEN}🌐 Acesse agora: ${YELLOW}http://$SERVER_IP:$FRONTEND_PORT${NC}"
    echo
}

# =============================================================================
# FUNÇÕES DE DETECÇÃO E REBUILD
# =============================================================================

# Calcular checksum de arquivos críticos
calculate_checksums() {
    local BUILD_INFO_FILE="$INSTALL_DIR/.build-info.json"
    
    if [[ ! -d "$INSTALL_DIR" ]]; then
        echo "{}"
        return
    fi
    
    cd "$INSTALL_DIR" 2>/dev/null || { echo "{}"; return; }
    
    # Calcular checksums dos arquivos críticos
    local BACKEND_DF=$(md5sum Dockerfile.backend 2>/dev/null | awk '{print $1}' || echo "missing")
    local FRONTEND_DF=$(md5sum Dockerfile.frontend 2>/dev/null | awk '{print $1}' || echo "missing")
    local DOCKER_COMPOSE=$(md5sum docker-compose.yml 2>/dev/null | awk '{print $1}' || echo "missing")
    local NGINX_CONF=$(md5sum nginx/nginx-complete.conf 2>/dev/null | awk '{print $1}' || echo "missing")
    local ENTRYPOINT=$(md5sum docker/nginx-entrypoint.sh 2>/dev/null | awk '{print $1}' || echo "missing")
    
    cat << EOF
{
  "build_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "version": "2.0.0",
  "checksums": {
    "Dockerfile.backend": "$BACKEND_DF",
    "Dockerfile.frontend": "$FRONTEND_DF",
    "docker-compose.yml": "$DOCKER_COMPOSE",
    "nginx/nginx-complete.conf": "$NGINX_CONF",
    "docker/nginx-entrypoint.sh": "$ENTRYPOINT"
  }
}
EOF
}

# Salvar informações da build
save_build_info() {
    local BUILD_INFO_FILE="$INSTALL_DIR/.build-info.json"
    if [[ -d "$INSTALL_DIR" ]]; then
        calculate_checksums > "$BUILD_INFO_FILE"
        log_detailed "Informações de build salvas em: $BUILD_INFO_FILE"
    fi
}

# Carregar informações da build anterior
load_build_info() {
    local BUILD_INFO_FILE="$INSTALL_DIR/.build-info.json"
    if [[ -f "$BUILD_INFO_FILE" ]]; then
        cat "$BUILD_INFO_FILE"
    else
        echo "{}"
    fi
}

# Verificar se rebuild é necessário
check_rebuild_needed() {
    if [[ "$FORCE_REBUILD" == "true" ]]; then
        log_status "Rebuild forçado via --force"
        return 0
    fi
    
    # Se não existe instalação anterior, não precisa rebuild (é primeira instalação)
    if [[ ! -d "$INSTALL_DIR" ]] || [[ ! -f "$INSTALL_DIR/.build-info.json" ]]; then
        log_status "Primeira instalação detectada - rebuild não necessário (será feito build inicial)"
        return 1
    fi
    
    local CURRENT_CHECKSUMS=$(calculate_checksums)
    local PREVIOUS_CHECKSUMS=$(load_build_info)
    
    # Comparar checksums
    local BACKEND_CURRENT=$(echo "$CURRENT_CHECKSUMS" | grep -o '"Dockerfile.backend": "[^"]*"' | cut -d'"' -f4)
    local BACKEND_PREVIOUS=$(echo "$PREVIOUS_CHECKSUMS" | grep -o '"Dockerfile.backend": "[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
    
    local FRONTEND_CURRENT=$(echo "$CURRENT_CHECKSUMS" | grep -o '"Dockerfile.frontend": "[^"]*"' | cut -d'"' -f4)
    local FRONTEND_PREVIOUS=$(echo "$PREVIOUS_CHECKSUMS" | grep -o '"Dockerfile.frontend": "[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
    
    local COMPOSE_CURRENT=$(echo "$CURRENT_CHECKSUMS" | grep -o '"docker-compose.yml": "[^"]*"' | cut -d'"' -f4)
    local COMPOSE_PREVIOUS=$(echo "$PREVIOUS_CHECKSUMS" | grep -o '"docker-compose.yml": "[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
    
    local NGINX_CURRENT=$(echo "$CURRENT_CHECKSUMS" | grep -o '"nginx/nginx-complete.conf": "[^"]*"' | cut -d'"' -f4)
    local NGINX_PREVIOUS=$(echo "$PREVIOUS_CHECKSUMS" | grep -o '"nginx/nginx-complete.conf": "[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
    
    if [[ "$BACKEND_CURRENT" != "$BACKEND_PREVIOUS" ]] || \
       [[ "$FRONTEND_CURRENT" != "$FRONTEND_PREVIOUS" ]] || \
       [[ "$COMPOSE_CURRENT" != "$COMPOSE_PREVIOUS" ]] || \
       [[ "$NGINX_CURRENT" != "$NGINX_PREVIOUS" ]]; then
        log_status "Mudanças detectadas em Dockerfiles/configurações - rebuild necessário"
        log_detailed "Backend: $([ "$BACKEND_CURRENT" != "$BACKEND_PREVIOUS" ] && echo "MUDOU" || echo "OK")"
        log_detailed "Frontend: $([ "$FRONTEND_CURRENT" != "$FRONTEND_PREVIOUS" ] && echo "MUDOU" || echo "OK")"
        log_detailed "Docker Compose: $([ "$COMPOSE_CURRENT" != "$COMPOSE_PREVIOUS" ] && echo "MUDOU" || echo "OK")"
        log_detailed "Nginx Config: $([ "$NGINX_CURRENT" != "$NGINX_PREVIOUS" ] && echo "MUDOU" || echo "OK")"
        return 0
    fi
    
    log_status "Nenhuma mudança detectada - rebuild não necessário"
    return 1
}

# Rebuild preservando dados
rebuild_preserve_data() {
    log "🔄 Iniciando rebuild preservando dados..."
    
    cd "$INSTALL_DIR" || { error "Diretório $INSTALL_DIR não encontrado!"; exit 1; }
    
    # Parar containers
    log_progress "Parando containers..."
    $COMPOSE_CMD down 2>/dev/null || true
    
    # Rebuild imagens
    if [[ "$REBUILD_CACHE" == "true" ]]; then
        log_progress "Rebuild SEM cache (pode demorar mais)..."
        $COMPOSE_CMD build --no-cache backend frontend
    else
        log_progress "Rebuild com cache..."
        $COMPOSE_CMD build backend frontend
    fi
    
    if [[ $? -eq 0 ]]; then
        log "✅ Rebuild concluído com sucesso!"
        save_build_info
        
        # Reiniciar containers após rebuild
        if [[ "$REBUILD_ONLY" != "true" ]]; then
            log_progress "Reiniciando containers após rebuild..."
            $COMPOSE_CMD up -d
            log "✅ Containers reiniciados!"
        fi
    else
        error "❌ Falha no rebuild!"
        exit 1
    fi
    
    if [[ "$REBUILD_ONLY" == "true" ]]; then
        log "✅ Rebuild concluído. Use '$0 start' para iniciar."
        exit 0
    fi
}

# Rebuild do zero (apaga tudo)
rebuild_fresh() {
    log "⚠️  INICIANDO INSTALAÇÃO DO ZERO - TODOS OS DADOS SERÃO PERDIDOS!"
    
    # Confirmação adicional
    echo
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}                    ⚠️  ATENÇÃO CRÍTICA ⚠️                    ${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo
    echo -e "${YELLOW}Esta operação irá APAGAR:${NC}"
    echo "  ❌ Todos os containers"
    echo "  ❌ Todas as imagens Docker"
    echo "  ❌ Todos os volumes (banco de dados, uploads, backups)"
    echo "  ❌ Todos os logs"
    echo
    echo -e "${RED}⚠️  ESTA AÇÃO É IRREVERSÍVEL!${NC}"
    echo
    read -p "Digite 'APAGAR TUDO' para confirmar: " confirm
    
    if [[ "$confirm" != "APAGAR TUDO" ]]; then
        log "Operação cancelada pelo usuário."
        exit 0
    fi
    
    cd "$INSTALL_DIR" || { error "Diretório $INSTALL_DIR não encontrado!"; exit 1; }
    
    # Determinar comando compose
    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        error "Docker Compose não encontrado!"
        exit 1
    fi
    
    # Parar e remover TUDO
    log_progress "Parando e removendo containers..."
    $COMPOSE_CMD down -v --rmi all --remove-orphans 2>/dev/null || true
    
    log_progress "Limpando volumes órfãos..."
    docker volume prune -af 2>/dev/null || true
    
    log_progress "Limpando sistema Docker..."
    docker system prune -af --volumes 2>/dev/null || true
    
    # Rebuild do zero
    log_progress "Instalando do zero (sem cache)..."
    $COMPOSE_CMD build --no-cache
    
    if [[ $? -eq 0 ]]; then
        log "✅ Build do zero concluído!"
        save_build_info
        
        # Reiniciar containers após rebuild fresh
        if [[ "$REBUILD_ONLY" != "true" ]]; then
            log_progress "Iniciando containers após build do zero..."
            $COMPOSE_CMD up -d
            log "✅ Containers iniciados!"
        fi
    else
        error "❌ Falha no build!"
        exit 1
    fi
    
    if [[ "$REBUILD_ONLY" == "true" ]]; then
        log "✅ Instalação do zero concluída. Use '$0 start' para iniciar."
        exit 0
    fi
}

# Menu principal
show_menu() {
    # Se SKIP_MENU está ativo, usar modo padrão
    if [[ "$SKIP_MENU" == "true" && -n "$INSTALL_MODE" ]]; then
        log "Modo selecionado: $INSTALL_MODE (via argumento)"
        case "$INSTALL_MODE" in
            docker)
                DB_DRIVER="postgresql"
                DATABASE_URL="postgresql://smartsignage:smartsignage123@postgres:5432/smartsignage"
                ;;
        esac
        return
    fi
    
    echo
    echo -e "${CYAN}Selecione o modo de instalação:${NC}"
    echo -e "${GREEN}1)${NC} Single-Server (Appliance dedicado)"
    echo -e "${GREEN}2)${NC} Docker (Produção - PostgreSQL)"
    echo
    read -p "Digite sua escolha (1-2): " choice
    
    case $choice in
        1)
            INSTALL_MODE="single-server"
            # Escolher banco para servidor único
            echo
            echo -e "${CYAN}Selecione o banco de dados para Single-Server:${NC}"
            echo -e "${GREEN}1)${NC} PostgreSQL (recomendado)"
            echo -e "${GREEN}2)${NC} SQLite (simples, sem servidor)"
            echo
            read -p "Digite sua escolha (1-2) [padrão: 1]: " db_choice
            db_choice=${db_choice:-1}
            if [[ "$db_choice" == "2" ]]; then
                DB_DRIVER="sqlite"
                DATABASE_URL="file:$INSTALL_DIR/data/smartsignage.db"
            else
                DB_DRIVER="postgresql"
                DATABASE_URL="postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage"
            fi
            ;;
        2)
            INSTALL_MODE="docker"
            DB_DRIVER="postgresql"
            DATABASE_URL="postgresql://smartsignage:smartsignage123@postgres:5432/smartsignage"
            ;;
        *)
            error "Opção inválida!"
            exit 1
            ;;
    esac
    
    echo
    log "Modo selecionado: $INSTALL_MODE"
    
    # Perguntar sobre modo kiosk (apenas para single-server)
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        echo
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${CYAN}                    Modo Kiosk (Totem/Sinalização)${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo
        echo -e "${YELLOW}Deseja instalar ambiente gráfico em modo Kiosk?${NC}"
        echo -e "${GREEN}✓${NC} Interface gráfica (XFCE)"
        echo -e "${GREEN}✓${NC} Login automático"
        echo -e "${GREEN}✓${NC} Navegador inicia automaticamente com o sistema"
        echo -e "${GREEN}✓${NC} Tela em modo Portrait (vertical) por padrão"
        echo
        read -p "Instalar modo Kiosk? (s/N): " kiosk_choice
        if [[ "$kiosk_choice" =~ ^[Ss]$ ]]; then
            ENABLE_KIOSK_MODE=true
            log "Modo Kiosk será configurado após a instalação"
        else
            ENABLE_KIOSK_MODE=false
            log "Modo Kiosk não será configurado"
        fi
    fi
}

# Função para configurar scripts de gerenciamento
setup_management_scripts() {
    log "Configurando scripts de gerenciamento..."
    
    # Dar permissão de execução aos scripts
    chmod +x manage-system.sh 2>/dev/null || true
    chmod +x scripts/*.sh 2>/dev/null || true
    
    # Criar link simbólico para o script principal
    if [ ! -L /usr/local/bin/smartsignage ]; then
        # Tentar criar link sem sudo primeiro
        if ln -sf "$INSTALL_DIR/manage-system.sh" /usr/local/bin/smartsignage 2>/dev/null; then
            log "✅ Criado comando global 'smartsignage'"
        else
            # Se falhar, tentar com sudo
            if sudo ln -sf "$INSTALL_DIR/manage-system.sh" /usr/local/bin/smartsignage 2>/dev/null; then
                log "✅ Criado comando global 'smartsignage' (com sudo)"
            else
                log "⚠️ Não foi possível criar link simbólico global"
                log "Você pode usar: $INSTALL_DIR/manage-system.sh"
            fi
        fi
    fi
    
    # Configurar backup automático no crontab
    if ! crontab -l 2>/dev/null | grep -q "backup-system.sh"; then
        (crontab -l 2>/dev/null; echo "0 2 * * * $INSTALL_DIR/scripts/backup-system.sh >> $INSTALL_DIR/logs/backup.log 2>&1") | crontab -
        log "Configurado backup automático diário às 2:00"
    fi
    
    # Configurar limpeza automática semanal
    if ! crontab -l 2>/dev/null | grep -q "clean-system"; then
        (crontab -l 2>/dev/null; echo "0 3 * * 0 $INSTALL_DIR/manage-system.sh clean >> $INSTALL_DIR/logs/cleanup.log 2>&1") | crontab -
        log "Configurada limpeza automática semanal"
    fi
    
    log "Scripts de gerenciamento configurados com sucesso!"
}

# Configurar modo Kiosk (ambiente gráfico com auto-login e navegador automático)
setup_kiosk_mode() {
    if [[ "$ENABLE_KIOSK_MODE" != "true" ]]; then
        return 0
    fi
    
    log "Configurando modo Kiosk (ambiente gráfico)..."
    
    # Verificar se já tem ambiente gráfico instalado
    if [[ -f /usr/bin/xfce4-session ]] || [[ -f /usr/bin/gnome-session ]]; then
        log "Ambiente gráfico já está instalado!"
    else
        # Instalar ambiente gráfico (XFCE - leve e eficiente)
        log "Instalando ambiente gráfico XFCE..."
        sudo DEBIAN_FRONTEND=noninteractive apt-get update -y
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
            xfce4 \
            xfce4-goodies \
            xorg \
            xserver-xorg \
            lightdm \
            chromium-browser \
            unclutter \
            xdotool
        
        log "✅ Ambiente gráfico XFCE instalado!"
    fi
    
    # Configurar auto-login
    log "Configurando auto-login..."
    CURRENT_USER=$(whoami)
    
    # Configurar LightDM para auto-login
    sudo tee /etc/lightdm/lightdm.conf > /dev/null << EOF
[Seat:*]
autologin-user=$CURRENT_USER
autologin-user-timeout=0
user-session=xfce
greeter-session=lightdm-greeter
EOF
    
    log "✅ Auto-login configurado para usuário: $CURRENT_USER"
    
    # Obter IP do servidor para o URL
    SERVER_IP=$(hostname -I | awk '{print $1}')
    KIOSK_URL="http://${SERVER_IP}:80"
    
    # Criar diretório de autostart
    mkdir -p "$HOME/.config/autostart"
    
    # Script de inicialização do Kiosk
    KIOSK_SCRIPT="$HOME/.config/autostart/kiosk.sh"
    cat > "$KIOSK_SCRIPT" << 'KIOSK_SCRIPT_EOF'
#!/bin/bash
# Smart Signage Pro - Script de Inicialização Kiosk

# Aguardar XFCE iniciar completamente
sleep 10

# Configurar orientação Portrait (90 graus - vertical)
# Detecta a tela primária e aplica rotação
PRIMARY_DISPLAY=$(xrandr | grep " connected" | grep -o "^[^ ]*" | head -1)

if [[ -n "$PRIMARY_DISPLAY" ]]; then
    # Aplicar rotação Portrait (90 graus no sentido horário)
    xrandr --output "$PRIMARY_DISPLAY" --rotate right
    
    # Se não funcionar, tentar outras opções
    if [[ $? -ne 0 ]]; then
        # Tentar rotação no sentido anti-horário (270 graus)
        xrandr --output "$PRIMARY_DISPLAY" --rotate left
    fi
fi

# Esconder cursor após 5 segundos de inatividade
unclutter -idle 5 -root &

# Desabilitar proteção de tela
xset s off
xset -dpms
xset s noblank

# Obter IP do servidor (pode ser passado como variável ou detectar)
KIOSK_URL="${KIOSK_URL:-http://localhost:80}"

# Iniciar navegador em modo kiosk (tela cheia, sem barra de endereço)
chromium-browser \
    --kiosk \
    --no-first-run \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --start-maximized \
    --incognito \
    --disable-translate \
    --disable-features=TranslateUI \
    --noerrdialogs \
    --disable-web-security \
    --disable-dev-shm-usage \
    --autoplay-policy=no-user-gesture-required \
    "$KIOSK_URL" &
KIOSK_SCRIPT_EOF
    
    chmod +x "$KIOSK_SCRIPT"
    
    # Substituir KIOSK_URL no script com o IP real
    sed -i "s|KIOSK_URL=\"\${KIOSK_URL:-http://localhost:80}\"|KIOSK_URL=\"$KIOSK_URL\"|g" "$KIOSK_SCRIPT"
    
    # Criar entrada no autostart do XFCE
    KIOSK_DESKTOP="$HOME/.config/autostart/kiosk.desktop"
    cat > "$KIOSK_DESKTOP" << EOF
[Desktop Entry]
Type=Application
Name=Smart Signage Kiosk
Exec=$KIOSK_SCRIPT
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
    
    chmod +x "$KIOSK_DESKTOP"
    
    log "✅ Script de Kiosk criado: $KIOSK_SCRIPT"
    log "✅ URL do Kiosk: $KIOSK_URL"
    
    # Configurar xrandr para ser executado no login (fallback)
    # Adicionar ao .bashrc ou .profile para garantir rotação
    if ! grep -q "xrandr.*rotate" "$HOME/.bashrc" 2>/dev/null; then
        echo "" >> "$HOME/.bashrc"
        echo "# Smart Signage Pro - Configuração de rotação de tela" >> "$HOME/.bashrc"
        echo "if [[ -n \"\$DISPLAY\" ]]; then" >> "$HOME/.bashrc"
        echo "    PRIMARY_DISPLAY=\$(xrandr | grep ' connected' | grep -o '^[^ ]*' | head -1)" >> "$HOME/.bashrc"
        echo "    if [[ -n \"\$PRIMARY_DISPLAY\" ]]; then" >> "$HOME/.bashrc"
        echo "        xrandr --output \"\$PRIMARY_DISPLAY\" --rotate right 2>/dev/null || xrandr --output \"\$PRIMARY_DISPLAY\" --rotate left 2>/dev/null" >> "$HOME/.bashrc"
        echo "    fi" >> "$HOME/.bashrc"
        echo "fi" >> "$HOME/.bashrc"
    fi
    
    # Habilitar LightDM
    sudo systemctl enable lightdm
    if ! systemctl is-active --quiet lightdm 2>/dev/null; then
        log "⚠️  LightDM será iniciado no próximo boot"
        log "💡 Para iniciar agora, execute: sudo systemctl start lightdm"
    else
        log "✅ LightDM já está ativo"
    fi
    
    # Criar script de gerenciamento do kiosk
    KIOSK_MANAGE_SCRIPT="$INSTALL_DIR/scripts/manage-kiosk.sh"
    mkdir -p "$INSTALL_DIR/scripts"
    cat > "$KIOSK_MANAGE_SCRIPT" << 'KIOSK_MANAGE_EOF'
#!/bin/bash
# Smart Signage Pro - Gerenciamento do Modo Kiosk

case "$1" in
    start)
        echo "Iniciando modo Kiosk..."
        sudo systemctl start lightdm
        ;;
    stop)
        echo "Parando modo Kiosk..."
        sudo systemctl stop lightdm
        ;;
    restart)
        echo "Reiniciando modo Kiosk..."
        sudo systemctl restart lightdm
        ;;
    status)
        echo "Status do modo Kiosk:"
        sudo systemctl status lightdm --no-pager
        ;;
    rotate)
        echo "Aplicando rotação Portrait..."
        PRIMARY_DISPLAY=$(xrandr | grep " connected" | grep -o "^[^ ]*" | head -1)
        if [[ -n "$PRIMARY_DISPLAY" ]]; then
            xrandr --output "$PRIMARY_DISPLAY" --rotate right || \
            xrandr --output "$PRIMARY_DISPLAY" --rotate left
            echo "✅ Rotação aplicada em: $PRIMARY_DISPLAY"
        else
            echo "❌ Nenhuma tela detectada"
        fi
        ;;
    *)
        echo "Uso: $0 {start|stop|restart|status|rotate}"
        echo ""
        echo "Comandos:"
        echo "  start   - Inicia o ambiente gráfico (Kiosk)"
        echo "  stop    - Para o ambiente gráfico"
        echo "  restart - Reinicia o ambiente gráfico"
        echo "  status  - Mostra status do LightDM"
        echo "  rotate  - Aplica rotação Portrait na tela"
        exit 1
        ;;
esac
KIOSK_MANAGE_EOF
    
    chmod +x "$KIOSK_MANAGE_SCRIPT"
    
    log "✅ Script de gerenciamento criado: $KIOSK_MANAGE_SCRIPT"
    
    # Adicionar informação sobre o Kiosk na mensagem final
    log "✅ Modo Kiosk configurado com sucesso!"
    log "📍 URL do Kiosk: $KIOSK_URL"
    log "💡 Use '$KIOSK_MANAGE_SCRIPT' para gerenciar o modo Kiosk"
    
    # Criar variável global para usar em show_final_info
    export KIOSK_URL
    export KIOSK_ENABLED=true
}

# Função principal
main() {
    # Parse de argumentos PRIMEIRO
    parse_arguments "$@"
    
    show_banner
    
    # Mostrar modo selecionado se aplicável
    if [[ "$FRESH_MODE" == "true" ]]; then
        echo -e "${RED}⚠️  MODO FRESH ATIVADO - Instalação completa do zero${NC}"
        echo
    elif [[ "$REBUILD_MODE" == "true" ]]; then
        echo -e "${YELLOW}🔄 MODO REBUILD ATIVADO - Rebuild preservando dados${NC}"
        echo
    fi
    
    check_root
    check_os
    
    # Verificar modo check-only
    if [[ "$CHECK_ONLY" == "true" ]]; then
        log "Modo check-only: Verificando se rebuild é necessário..."
        if check_rebuild_needed; then
            echo "✅ Rebuild necessário"
            exit 0
        else
            echo "✅ Rebuild não necessário"
            exit 1
        fi
    fi
    
    # Detectar diretório do projeto PRIMEIRO (necessário para checksums)
    detect_project_directory
    
    # Verificar se é modo rebuild antes do menu
    # Para rebuild, precisamos definir INSTALL_DIR temporariamente
    if [[ "$REBUILD_MODE" == "true" ]]; then
        # Tentar detectar INSTALL_DIR existente (pode ser /opt/smart-signage ou diretório de origem)
        if [[ -d "/opt/smart-signage" ]]; then
            INSTALL_DIR="/opt/smart-signage"
        elif [[ -d "$SOURCE_DIR" ]] && [[ -f "$SOURCE_DIR/.env" ]]; then
            INSTALL_DIR="$SOURCE_DIR"
        fi
        
        if [[ -d "$INSTALL_DIR" ]]; then
            cd "$INSTALL_DIR" 2>/dev/null || true
            
            if [[ "$FRESH_MODE" == "true" ]]; then
                rebuild_fresh
                # Após rebuild fresh, continuar instalação normalmente
            elif check_rebuild_needed || [[ "$FORCE_REBUILD" == "true" ]]; then
                rebuild_preserve_data
                # rebuild_preserve_data já reinicia containers se REBUILD_ONLY não estiver ativo
                if [[ "$REBUILD_ONLY" != "true" ]]; then
                    log "Aguardando serviços iniciarem após rebuild..."
                    sleep 20  # Dar tempo para containers iniciarem
                    check_startup_order
                    test_endpoints
                    show_final_info
                    exit 0
                fi
            else
                log "Rebuild não necessário (use --force para forçar)"
            fi
        fi
    fi
    
    show_menu
    
    # AGORA definir INSTALL_DIR baseado no modo escolhido
    setup_project
    
    # Perguntar sobre HTTPS (após menu, antes da instalação)
    ask_https_configuration
    
    log "Iniciando instalação do Smart Signage Pro v2.0..."
    
    update_system
    install_dependencies
    install_nodejs
    install_docker
    configure_firewall
    install_project_dependencies
    setup_database
    setup_environment
    
    # Para single-server: setup_first_boot DEVE ser antes de create_systemd_service
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        setup_first_boot  # Executar migrations e seed ANTES de iniciar o serviço
    fi
    
    setup_nginx
    setup_letsencrypt  # Configurar Let's Encrypt se escolhido
    create_systemd_service
    
    # Para Docker: setup_docker_compose
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        setup_docker_compose
    fi
    
    # Se modo Docker, verificar se precisa rebuild apenas SE já existe instalação anterior
    # Não fazer rebuild automático durante instalação nova (já foi feito build em setup_docker_compose)
    if [[ "$INSTALL_MODE" == "docker" ]] && [[ "$REBUILD_MODE" != "true" ]] && [[ -f "$INSTALL_DIR/.build-info.json" ]]; then
        if check_rebuild_needed; then
            log_progress "Mudanças detectadas - fazendo rebuild automático..."
            REBUILD_MODE=true
            rebuild_preserve_data
            # rebuild_preserve_data já reinicia os containers
            log "Aguardando serviços iniciarem após rebuild..."
            sleep 20  # Dar tempo suficiente para containers iniciarem
            check_startup_order
            test_endpoints
            show_final_info
            exit 0
        fi
    fi
    
    check_startup_order
    test_endpoints
    
    # Para Docker: setup_first_boot é executado dentro do container
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        log "Para Docker, primeiro boot será configurado dentro do container"
    fi
    
    create_management_script
    setup_management_scripts
    
    # Configurar modo Kiosk se solicitado
    if [[ "$ENABLE_KIOSK_MODE" == "true" ]]; then
        setup_kiosk_mode
    fi
    
    # Executar checklist pós-instalação (não bloqueante)
    if [[ -f "$INSTALL_DIR/scripts/post-install-check.sh" ]]; then
        chmod +x "$INSTALL_DIR/scripts/post-install-check.sh" 2>/dev/null || true
        (HOST_OVERRIDE="${PUBLIC_DOMAIN:-localhost}" bash "$INSTALL_DIR/scripts/post-install-check.sh") || true
    fi
    
    # Salvar informações da build após instalação bem-sucedida
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        save_build_info
    fi
    
    show_final_info
}

# Executar script
main "$@"
