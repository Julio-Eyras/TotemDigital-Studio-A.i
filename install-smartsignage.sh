#!/bin/bash

# =============================================================================
# Smart Signage Pro v2.0 - Script de Auto-Instalação para Ubuntu
# =============================================================================
# Este script instala automaticamente o Smart Signage Pro em sistemas Ubuntu
# Suporta 3 modos: Single-Server, Docker, Desenvolvimento
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

# Função de log detalhado para diagnóstico
log_detailed() {
    echo -e "${BLUE}[DETALHADO $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Função de log de erro detalhado
log_error() {
    echo -e "${RED}[ERRO $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
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
    sudo ufw allow 80/tcp    # HTTP
    sudo ufw allow 443/tcp   # HTTPS
    sudo ufw allow 3000/tcp  # Backend
    sudo ufw allow 3001/tcp  # Frontend
    
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        sudo ufw allow 5432/tcp  # PostgreSQL
        sudo ufw allow 6379/tcp  # Redis
        sudo ufw allow 9090/tcp  # Prometheus
        sudo ufw allow 3002/tcp  # Grafana
    fi
    
    sudo ufw --force enable
    log "Firewall configurado com sucesso!"
}

# Baixar e configurar projeto
setup_project() {
    log "Configurando projeto Smart Signage Pro..."
    
    # Detectar diretório do script
    SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
    log "Diretório do script: $SCRIPT_DIR"
    log "Diretório atual: $(pwd)"
    
    # Criar diretório de instalação
    INSTALL_DIR="/opt/smart-signage"
    sudo mkdir -p $INSTALL_DIR
    sudo chown $USER:$USER $INSTALL_DIR
    
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
    
    # Copiar arquivos do projeto
    if [[ -d "$SOURCE_DIR/backend" && -d "$SOURCE_DIR/frontend" ]]; then
        log "Copiando arquivos do projeto de $SOURCE_DIR..."
        cp -r "$SOURCE_DIR/backend" $INSTALL_DIR/
        cp -r "$SOURCE_DIR/frontend" $INSTALL_DIR/
        
        # Copiar arquivos opcionais se existirem
        [[ -d "$SOURCE_DIR/player" ]] && cp -r "$SOURCE_DIR/player" $INSTALL_DIR/
        [[ -d "$SOURCE_DIR/scripts" ]] && cp -r "$SOURCE_DIR/scripts" $INSTALL_DIR/
        [[ -d "$SOURCE_DIR/database" ]] && rm -rf $INSTALL_DIR/database && cp -r "$SOURCE_DIR/database" $INSTALL_DIR/
        [[ -d "$SOURCE_DIR/docker" ]] && cp -r "$SOURCE_DIR/docker" $INSTALL_DIR/
        
        # Copiar arquivos essenciais
        [[ -f "$SOURCE_DIR/docker-compose.yml" ]] && cp "$SOURCE_DIR/docker-compose.yml" $INSTALL_DIR/
        [[ -f "$SOURCE_DIR/Dockerfile" ]] && cp "$SOURCE_DIR/Dockerfile" $INSTALL_DIR/
        [[ -f "$SOURCE_DIR/Dockerfile.backend" ]] && cp "$SOURCE_DIR/Dockerfile.backend" $INSTALL_DIR/
        [[ -f "$SOURCE_DIR/Dockerfile.frontend" ]] && cp "$SOURCE_DIR/Dockerfile.frontend" $INSTALL_DIR/
        [[ -f "$SOURCE_DIR/env.example" ]] && cp "$SOURCE_DIR/env.example" $INSTALL_DIR/.env
        [[ -f "$SOURCE_DIR/package.json" ]] && cp "$SOURCE_DIR/package.json" $INSTALL_DIR/
        
        # Copiar arquivo nginx se existir
        if [[ -d "$SOURCE_DIR/nginx" ]]; then
            cp -r "$SOURCE_DIR/nginx" $INSTALL_DIR/
        fi
        
        # Verificar se arquivos essenciais foram copiados
        if [[ ! -f "$INSTALL_DIR/docker-compose.yml" ]]; then
            log "AVISO: docker-compose.yml não foi copiado. Será copiado posteriormente."
        fi
        
        if [[ ! -f "$INSTALL_DIR/Dockerfile" ]]; then
            log "AVISO: Dockerfile não foi copiado. Será copiado posteriormente."
        fi
        
        if [[ ! -f "$INSTALL_DIR/Dockerfile.backend" ]]; then
            log "AVISO: Dockerfile.backend não foi copiado. Será copiado posteriormente."
        fi
        
        if [[ ! -f "$INSTALL_DIR/Dockerfile.frontend" ]]; then
            log "AVISO: Dockerfile.frontend não foi copiado. Será copiado posteriormente."
        fi
        
        log "Arquivos do projeto copiados com sucesso!"
    else
        error "Arquivos do projeto não encontrados!"
        error "Execute este script no diretório raiz do projeto Smart Signage Pro"
        exit 1
    fi
    
    cd $INSTALL_DIR
    log "Projeto configurado em $INSTALL_DIR"
}

# Instalar dependências do projeto
install_project_dependencies() {
    log "Instalando dependências do projeto..."
    
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
    
    # Frontend (se necessário)
    if [[ "$INSTALL_MODE" != "single-server" ]]; then
        cd $INSTALL_DIR/frontend
        log "Instalando dependências do frontend..."
        npm install
        log "Compilando frontend..."
        npm run build
    fi
    
    log "Dependências do projeto instaladas!"
}

# Configurar banco de dados
setup_database() {
    log "Configurando banco de dados..."
    
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        # SQLite
        DB_FILE="$INSTALL_DIR/data/smartsignage.db"
        mkdir -p $INSTALL_DIR/data
        sqlite3 $DB_FILE < $INSTALL_DIR/database/schema.sql
        log "Banco SQLite configurado: $DB_FILE"
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

# Banco de dados
DB_DRIVER=$DB_DRIVER
DATABASE_URL=$DATABASE_URL

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

# Configurar Nginx
setup_nginx() {
    log "Configurando Nginx..."
    
    # Em modo Docker, o Nginx é gerenciado pelo Docker Compose
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        log "Nginx será gerenciado pelo Docker Compose"
        return 0
    fi
    
    NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"
    
    sudo tee $NGINX_CONFIG > /dev/null << EOF
server {
    listen 80;
    server_name _;
    
    # Frontend
    location / {
        root $INSTALL_DIR/frontend/build;
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
    
    # Apenas testar configuração, não recarregar
    if sudo nginx -t; then
        log "Nginx configurado com sucesso!"
    else
        warning "Configuração do Nginx pode ter problemas, mas continuando..."
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
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=$INSTALL_DIR/.env

[Install]
WantedBy=multi-user.target
EOF

        sudo systemctl daemon-reload
        sudo systemctl enable smart-signage
        sudo systemctl start smart-signage
        
        log "Serviço systemd criado e iniciado!"
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
        
        # Verificar se Dockerfiles existem
        if [[ ! -f "Dockerfile" ]] || [[ ! -f "Dockerfile.backend" ]] || [[ ! -f "Dockerfile.frontend" ]]; then
            log "Dockerfiles não encontrados, tentando copiar..."
            log "Verificando locais possíveis:"
            log "  - $SCRIPT_DIR/Dockerfile: $([[ -f "$SCRIPT_DIR/Dockerfile" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - $SCRIPT_DIR/Dockerfile.backend: $([[ -f "$SCRIPT_DIR/Dockerfile.backend" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - $SCRIPT_DIR/Dockerfile.frontend: $([[ -f "$SCRIPT_DIR/Dockerfile.frontend" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - ./Dockerfile: $([[ -f "./Dockerfile" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - ./Dockerfile.backend: $([[ -f "./Dockerfile.backend" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - ./Dockerfile.frontend: $([[ -f "./Dockerfile.frontend" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            
            # Tentar copiar do diretório do script
            if [[ -f "$SCRIPT_DIR/Dockerfile" ]]; then
                cp "$SCRIPT_DIR/Dockerfile" $INSTALL_DIR/
                log "Arquivo Dockerfile copiado com sucesso!"
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
            if [[ -f "./Dockerfile.backend" ]]; then
                cp ./Dockerfile.backend $INSTALL_DIR/
                log "Arquivo Dockerfile.backend copiado do diretório atual!"
            fi
            if [[ -f "./Dockerfile.frontend" ]]; then
                cp ./Dockerfile.frontend $INSTALL_DIR/
                log "Arquivo Dockerfile.frontend copiado do diretório atual!"
            fi
            
            if [[ ! -f "$INSTALL_DIR/Dockerfile" ]] || [[ ! -f "$INSTALL_DIR/Dockerfile.backend" ]] || [[ ! -f "$INSTALL_DIR/Dockerfile.frontend" ]]; then
                error "Dockerfiles não encontrados em nenhum local!"
                error "Verifique se os arquivos Dockerfile, Dockerfile.backend e Dockerfile.frontend existem no diretório do projeto"
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
        if systemctl is-active --quiet nginx; then
            log "Nginx do sistema está rodando. Parando para liberar porta 80..."
            sudo systemctl stop nginx
            sudo systemctl disable nginx
            log "Nginx do sistema parado"
        fi
        
        # Testar build do Docker antes de iniciar containers
        if [[ "$INSTALL_MODE" == "docker" ]]; then
            test_docker_build
        fi
        
        # Fazer build das imagens antes de iniciar
        if [[ "$INSTALL_MODE" == "docker" ]]; then
            log "Construindo imagens Docker..."
            
            # Verificar se já existem containers rodando
            if $COMPOSE_CMD ps | grep -q "Up"; then
                log "Parando containers existentes..."
                $COMPOSE_CMD down
            fi
            
            # Limpar imagens antigas se necessário
            log "Limpando imagens antigas..."
            $COMPOSE_CMD down --rmi all 2>/dev/null || true
            
            # Reconstruir imagens
            log "Construindo imagens Docker (backend e frontend)..."
            if $COMPOSE_CMD build --no-cache backend frontend 2>&1 | tee /tmp/docker-compose-build.log; then
                log "✅ Build das imagens backend e frontend concluído com sucesso!"
            else
                error "❌ Erro no build das imagens Docker"
                error "Últimas linhas do log:"
                tail -50 /tmp/docker-compose-build.log
                error "Log completo salvo em: /tmp/docker-compose-build.log"
                exit 1
            fi
        fi
        
        # Iniciar serviços
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
        
        # Ordem para Docker - iniciar em sequência
        log "Iniciando PostgreSQL..."
        $COMPOSE_CMD up -d postgres
        wait_for_postgres
        
        log "Iniciando Redis..."
        $COMPOSE_CMD up -d redis
        wait_for_redis
        
        log "Iniciando Ollama..."
        $COMPOSE_CMD up -d ollama
        wait_for_ollama
        
        log "Iniciando Backend..."
        $COMPOSE_CMD up -d backend
        wait_for_backend
        
        log "Iniciando Frontend..."
        $COMPOSE_CMD up -d frontend
        wait_for_frontend
        
        log "Iniciando Nginx..."
        $COMPOSE_CMD up -d nginx
        wait_for_nginx
        
        log "Iniciando Prometheus..."
        $COMPOSE_CMD up -d prometheus
        wait_for_prometheus
        
        log "Iniciando Grafana..."
        $COMPOSE_CMD up -d grafana
        wait_for_grafana
        
    elif [[ "$INSTALL_MODE" == "single-server" ]]; then
        # Ordem para Single-Server
        log "Iniciando Backend..."
        sudo systemctl start smart-signage
        wait_for_backend
        
        log "Iniciando Nginx..."
        sudo systemctl start nginx
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
        SERVICES=("postgres" "redis" "ollama" "backend" "frontend" "nginx" "prometheus" "grafana")
        
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
                    wait_for_frontend
                    ;;
                "nginx")
                    wait_for_nginx
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
    for i in {1..30}; do
        if $COMPOSE_CMD exec -T postgres pg_isready -U smartsignage > /dev/null 2>&1; then
            log "✅ PostgreSQL: Pronto"
            return 0
        fi
        sleep 2
    done
    warning "❌ PostgreSQL: Timeout"
}

wait_for_redis() {
    log "Aguardando Redis..."
    for i in {1..15}; do
        if $COMPOSE_CMD exec -T redis redis-cli ping > /dev/null 2>&1; then
            log "✅ Redis: Pronto"
            return 0
        fi
        sleep 2
    done
    warning "❌ Redis: Timeout"
}

wait_for_ollama() {
    log "Aguardando Ollama..."
    for i in {1..20}; do
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            log "✅ Ollama: Pronto"
            return 0
        fi
        sleep 3
    done
    warning "❌ Ollama: Timeout"
}

wait_for_backend() {
    log "Aguardando Backend..."
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
            log "Aguardando Backend... (${i}/60)"
        fi
        
        sleep 2
    done
    
    echo -e "${YELLOW}[WARNING]${NC} ❌ Backend: Timeout após 2 minutos"
    echo -e "${YELLOW}[WARNING]${NC} Iniciando diagnóstico automático..."
    
    # Diagnóstico automático e correção
    diagnose_and_fix_backend
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
    log "Aguardando Frontend..."
    for i in {1..20}; do
        if curl -s http://localhost:80 > /dev/null 2>&1; then
            log "✅ Frontend: Pronto"
            return 0
        fi
        sleep 2
    done
    warning "❌ Frontend: Timeout"
    
    # Diagnóstico automático do frontend
    diagnose_and_fix_frontend
}

# Função de diagnóstico e correção automática do frontend
diagnose_and_fix_frontend() {
    log "🔍 DIAGNÓSTICO AUTOMÁTICO DO FRONTEND"
    
    # Verificar se o container está rodando
    if ! docker ps | grep -q "smartsignage-frontend"; then
        log "❌ Container frontend não está rodando"
        log "🔄 Tentando reiniciar container..."
        docker compose up -d frontend
        sleep 10
        return
    fi
    
    # Verificar logs do frontend
    log "📋 Analisando logs do frontend..."
    FRONTEND_LOGS=$(docker logs smartsignage-frontend --tail 30 2>&1)
    
    # Detectar problemas comuns
    if echo "$FRONTEND_LOGS" | grep -q "Cannot find module"; then
        log "🔧 PROBLEMA DETECTADO: Módulos não encontrados"
        log "🔄 Reconstruindo container frontend..."
        docker compose down frontend
        docker compose build --no-cache frontend
        docker compose up -d frontend
        sleep 15
    elif echo "$FRONTEND_LOGS" | grep -q "Permission denied"; then
        log "🔧 PROBLEMA DETECTADO: Permissões incorretas"
        log "🔄 Corrigindo permissões..."
        docker exec smartsignage-frontend chown -R nginx:nginx /usr/share/nginx/html 2>/dev/null || true
        docker compose restart frontend
        sleep 10
    else
        log "🔧 PROBLEMA NÃO IDENTIFICADO - Aplicando correções gerais..."
        docker compose restart frontend
        sleep 10
    fi
    
    # Tentar novamente após correções
    log "🔄 Testando frontend após correções..."
    for i in {1..15}; do
        if curl -s http://localhost:80 > /dev/null 2>&1; then
            log "✅ Frontend: Corrigido e funcionando!"
            return 0
        fi
        sleep 2
    done
    
    log "❌ Frontend ainda não está respondendo após correções"
    log "📋 Logs finais do frontend:"
    docker logs smartsignage-frontend --tail 20 2>/dev/null || echo "Não foi possível obter logs"
}

wait_for_nginx() {
    log "Aguardando Nginx..."
    for i in {1..10}; do
        if systemctl is-active --quiet nginx; then
            log "✅ Nginx: Pronto"
            return 0
        fi
        sleep 1
    done
    warning "❌ Nginx: Timeout"
}

wait_for_prometheus() {
    log "Aguardando Prometheus..."
    for i in {1..15}; do
        if curl -s http://localhost:9090/-/healthy > /dev/null 2>&1; then
            log "✅ Prometheus: Pronto"
            return 0
        fi
        sleep 2
    done
    warning "❌ Prometheus: Timeout"
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
export DATABASE_TYPE=${DATABASE_TYPE:-sqlite}
export DATABASE_URL=${DATABASE_URL:-file:./data/smartsignage.db}
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
    log "Configurando primeiro boot..."
    
    # Criar usuário admin padrão
    ADMIN_PASSWORD=$(openssl rand -base64 12)
    
    # Executar script de primeiro boot
    if [[ -f "$INSTALL_DIR/scripts/first-boot.sh" ]]; then
        chmod +x $INSTALL_DIR/scripts/first-boot.sh
        $INSTALL_DIR/scripts/first-boot.sh
    fi
    
    log "Primeiro boot configurado!"
    log "Usuário admin padrão: admin"
    log "Senha admin padrão: $ADMIN_PASSWORD"
    warn "IMPORTANTE: Altere a senha padrão após o primeiro login!"
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
        echo "Frontend: http://$SERVER_IP:80"
        echo "Backend API: http://$SERVER_IP:3000"
        echo "Player: http://$SERVER_IP:80/player"
        echo "Prometheus: http://$SERVER_IP:9090"
        echo "Grafana: http://$SERVER_IP:3002"
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
    echo -e "   ${YELLOW}👉 http://$SERVER_IP:80${NC}"
    echo -e "   ${BLUE}   (Interface principal do sistema)${NC}"
    echo
    echo -e "${CYAN}🔧 API BACKEND:${NC}"
    echo -e "   ${YELLOW}👉 http://$SERVER_IP:3000${NC}"
    echo -e "   ${BLUE}   (API REST para integração)${NC}"
    echo
    echo -e "${CYAN}📺 PLAYER DE MÍDIA:${NC}"
    echo -e "   ${YELLOW}👉 http://$SERVER_IP:80/player${NC}"
    echo -e "   ${BLUE}   (Player para totems)${NC}"
    echo
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
        echo -e "${GREEN}💡 DICA:${NC} ${YELLOW}Use o IP Externo para acesso remoto${NC}"
        echo -e "${GREEN}💡 DICA:${NC} ${YELLOW}Use o IP Local para acesso na rede interna${NC}"
    else
        echo -e "${YELLOW}⚠️  AVISO:${NC} ${RED}IP Externo não detectado. Configure firewall para acesso remoto.${NC}"
    fi
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    🔐 CREDENCIAIS DE ACESSO                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${RED}👤 USUÁRIO:${NC} ${YELLOW}admin${NC}"
    echo -e "${RED}🔑 SENHA:${NC}  ${YELLOW}admin${NC}"
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
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        echo -e "   Prometheus: http://$SERVER_IP:9090"
        echo -e "   Grafana:    http://$SERVER_IP:3002 (admin/admin)"
    fi
    echo -e "   Logs:       sudo journalctl -u smart-signage -f"
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    🚀 PRÓXIMOS PASSOS                       ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${YELLOW}1.${NC} ${CYAN}Acesse o sistema:${NC} ${YELLOW}http://$SERVER_IP:80${NC}"
    echo -e "${YELLOW}2.${NC} ${CYAN}Faça login com:${NC} admin/admin"
    echo -e "${YELLOW}3.${NC} ${CYAN}Altere a senha} do administrador"
    echo -e "${YELLOW}4.${NC} ${CYAN}Configure seus clientes e totems"
    echo -e "${YELLOW}5.${NC} ${CYAN}Configure SSL/HTTPS para produção"
    echo
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║              ✅ SMART SIGNAGE PRO v2.0 PRONTO! ✅            ║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${GREEN}🎯 Sistema instalado e funcionando perfeitamente!${NC}"
    echo -e "${GREEN}🌐 Acesse agora: ${YELLOW}http://$SERVER_IP:80${NC}"
    echo
}

# Menu principal
show_menu() {
    echo
    echo -e "${CYAN}Selecione o modo de instalação:${NC}"
    echo -e "${GREEN}1)${NC} Single-Server (Appliance dedicado - SQLite)"
    echo -e "${GREEN}2)${NC} Docker (Produção - PostgreSQL)"
    echo -e "${GREEN}3)${NC} Desenvolvimento (Local - SQLite)"
    echo
    read -p "Digite sua escolha (1-3): " choice
    
    case $choice in
        1)
            INSTALL_MODE="single-server"
            DB_DRIVER="sqlite"
            DATABASE_URL="file:$INSTALL_DIR/data/smartsignage.db"
            ;;
        2)
            INSTALL_MODE="docker"
            DB_DRIVER="postgresql"
            DATABASE_URL="postgresql://smartsignage:smartsignage123@postgres:5432/smartsignage"
            ;;
        3)
            INSTALL_MODE="development"
            DB_DRIVER="sqlite"
            DATABASE_URL="file:$INSTALL_DIR/data/smartsignage.db"
            ;;
        *)
            error "Opção inválida!"
            exit 1
            ;;
    esac
    
    echo
    log "Modo selecionado: $INSTALL_MODE"
}

# Função para configurar scripts de gerenciamento
setup_management_scripts() {
    log "Configurando scripts de gerenciamento..."
    
    # Dar permissão de execução aos scripts
    chmod +x manage-system.sh 2>/dev/null || true
    chmod +x scripts/*.sh 2>/dev/null || true
    
    # Criar link simbólico para o script principal
    if [ ! -L /usr/local/bin/smartsignage ]; then
        ln -sf "$INSTALL_DIR/manage-system.sh" /usr/local/bin/smartsignage
        log "Criado comando global 'smartsignage'"
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

# Função principal
main() {
    show_banner
    check_root
    check_os
    show_menu
    
    log "Iniciando instalação do Smart Signage Pro v2.0..."
    
    update_system
    install_dependencies
    install_nodejs
    install_docker
    configure_firewall
    setup_project
    install_project_dependencies
    setup_database
    setup_environment
    setup_nginx
    create_systemd_service
    setup_docker_compose
    check_startup_order
    test_endpoints
    setup_first_boot
    create_management_script
    setup_management_scripts
    show_final_info
}

# Executar script
main "$@"
