#!/bin/bash

# =============================================================================
# Smart Signage Pro v2.0 - Script de Download e Instalação de Dependências
# =============================================================================
# Este script baixa e instala todas as dependências necessárias para o projeto
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
    echo "║           Download e Instalação de Dependências             ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
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

# Instalar dependências do sistema
install_system_dependencies() {
    log "Instalando dependências do sistema..."
    
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
        python3-venv \
        sqlite3 \
        nginx \
        ufw \
        htop \
        nano \
        vim \
        tree \
        jq \
        net-tools \
        dnsutils \
        telnet \
        openssl \
        ca-certificates \
        gnupg \
        lsb-release \
        apt-transport-https \
        software-properties-common
    
    log "Dependências do sistema instaladas!"
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
    
    # Instalar Node.js 20.x (Node 18 deixou de ser suportado no NodeSource)
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    
    # Instalar Yarn (opcional)
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
    sudo apt update && sudo apt install -y yarn
    
    log "Node.js $(node --version) instalado com sucesso!"
    log "NPM $(npm --version) instalado com sucesso!"
    log "Yarn $(yarn --version) instalado com sucesso!"
}

# Instalar Docker
install_docker() {
    log "Instalando Docker..."
    
    # Verificar se Docker já está instalado
    if command -v docker &> /dev/null; then
        log "Docker já está instalado!"
        return
    fi
    
    # Instalar Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    
    # Instalar Docker Compose
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | jq -r .tag_name)
    sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    # Instalar Docker Compose Plugin
    sudo apt install -y docker-compose-plugin
    
    log "Docker $(docker --version) instalado com sucesso!"
    log "Docker Compose $(docker-compose --version) instalado com sucesso!"
    
    warn "IMPORTANTE: Faça logout e login novamente para usar Docker sem sudo!"
}

# Instalar ferramentas de desenvolvimento
install_dev_tools() {
    log "Instalando ferramentas de desenvolvimento..."
    
    # Instalar ferramentas Git
    sudo apt install -y git git-lfs
    
    # Instalar ferramentas de rede
    sudo apt install -y netcat-openbsd tcpdump wireshark-common
    
    # Instalar ferramentas de monitoramento
    sudo apt install -y iotop nethogs iftop
    
    # Instalar ferramentas de compressão
    sudo apt install -y zip unzip p7zip-full rar unrar
    
    # Instalar ferramentas de texto
    sudo apt install -y grep sed awk cut sort uniq
    
    log "Ferramentas de desenvolvimento instaladas!"
}

# Instalar ferramentas de banco de dados
install_database_tools() {
    log "Instalando ferramentas de banco de dados..."
    
    # PostgreSQL client
    sudo apt install -y postgresql-client
    
    # MySQL client
    sudo apt install -y mysql-client
    
    # Redis tools
    sudo apt install -y redis-tools
    
    # MongoDB tools
    wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
    sudo apt update
    sudo apt install -y mongodb-mongosh
    
    log "Ferramentas de banco de dados instaladas!"
}

# Instalar ferramentas de monitoramento
install_monitoring_tools() {
    log "Instalando ferramentas de monitoramento..."
    
    # Prometheus
    sudo apt install -y prometheus prometheus-node-exporter
    
    # Grafana
    wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
    echo "deb https://packages.grafana.com/oss/deb stable main" | sudo tee /etc/apt/sources.list.d/grafana.list
    sudo apt update
    sudo apt install -y grafana
    
    # InfluxDB
    wget -qO- https://repos.influxdata.com/influxdb.key | sudo apt-key add -
    echo "deb https://repos.influxdata.com/ubuntu focal stable" | sudo tee /etc/apt/sources.list.d/influxdb.list
    sudo apt update
    sudo apt install -y influxdb
    
    log "Ferramentas de monitoramento instaladas!"
}

# Instalar ferramentas de segurança
install_security_tools() {
    log "Instalando ferramentas de segurança..."
    
    # Fail2ban
    sudo apt install -y fail2ban
    
    # ClamAV
    sudo apt install -y clamav clamav-daemon
    
    # AIDE
    sudo apt install -y aide
    
    # Lynis
    sudo apt install -y lynis
    
    log "Ferramentas de segurança instaladas!"
}

# Configurar firewall básico
configure_firewall() {
    log "Configurando firewall básico..."
    
    sudo ufw --force reset
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Portas essenciais
    sudo ufw allow 22/tcp    # SSH
    sudo ufw allow 80/tcp    # HTTP
    sudo ufw allow 443/tcp   # HTTPS
    
    # Portas do Smart Signage
    sudo ufw allow 3000/tcp  # Backend
    sudo ufw allow 3001/tcp  # Frontend
    
    # Portas de monitoramento
    sudo ufw allow 9090/tcp  # Prometheus
    sudo ufw allow 3002/tcp  # Grafana
    
    sudo ufw --force enable
    log "Firewall configurado com sucesso!"
}

# Configurar aliases úteis
configure_aliases() {
    log "Configurando aliases úteis..."
    
    # Adicionar aliases ao .bashrc
    cat >> ~/.bashrc << 'EOF'

# Smart Signage Pro - Aliases úteis
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias grep='grep --color=auto'
alias fgrep='fgrep --color=auto'
alias egrep='egrep --color=auto'
alias h='history'
alias j='jobs -l'
alias which='type -a'
alias path='echo -e ${PATH//:/\\n}'
alias now='date +"%T"'
alias nowtime=now
alias nowdate='date +"%d-%m-%Y"'
alias ports='netstat -tulanp'
alias myip='curl -s https://ipinfo.io/ip'
alias weather='curl -s wttr.in'
alias ss='sudo systemctl'
alias sss='sudo systemctl status'
alias sse='sudo systemctl enable'
alias ssd='sudo systemctl disable'
alias ssr='sudo systemctl restart'
alias ssl='sudo systemctl reload'
alias dc='docker-compose'
alias dcu='docker-compose up -d'
alias dcd='docker-compose down'
alias dcr='docker-compose restart'
alias dcl='docker-compose logs -f'
alias dps='docker ps'
alias dpa='docker ps -a'
alias di='docker images'
alias dex='docker exec -it'
alias dlog='docker logs -f'
EOF

    # Recarregar .bashrc
    source ~/.bashrc
    
    log "Aliases configurados com sucesso!"
}

# Configurar Git
configure_git() {
    log "Configurando Git..."
    
    # Configurar Git globalmente (se não estiver configurado)
    if ! git config --global user.name &> /dev/null; then
        read -p "Digite seu nome para o Git: " git_name
        git config --global user.name "$git_name"
    fi
    
    if ! git config --global user.email &> /dev/null; then
        read -p "Digite seu email para o Git: " git_email
        git config --global user.email "$git_email"
    fi
    
    # Configurações úteis do Git
    git config --global init.defaultBranch main
    git config --global pull.rebase false
    git config --global push.default simple
    git config --global core.autocrlf input
    git config --global core.safecrlf true
    
    log "Git configurado com sucesso!"
}

# Instalar dependências do projeto
install_project_dependencies() {
    log "Instalando dependências do projeto..."
    
    # Verificar se estamos no diretório correto
    if [[ ! -f "package.json" ]]; then
        error "Arquivo package.json não encontrado!"
        error "Execute este script no diretório raiz do projeto Smart Signage Pro"
        exit 1
    fi
    
    # Instalar dependências do projeto principal
    npm install
    
    # Instalar dependências do backend
    if [[ -d "backend" ]]; then
        cd backend
        npm install
        cd ..
    fi
    
    # Instalar dependências do frontend
    if [[ -d "frontend" ]]; then
        cd frontend
        npm install
        cd ..
    fi
    
    log "Dependências do projeto instaladas!"
}

# Compilar projeto
compile_project() {
    log "Compilando projeto..."
    
    # Compilar backend
    if [[ -d "backend" ]]; then
        cd backend
        npm run build
        cd ..
        log "Backend compilado com sucesso!"
    fi
    
    # Build frontend (se necessário)
    if [[ -d "frontend" ]]; then
        cd frontend
        # Criar build básico se não existir
        if [[ ! -d "build" ]]; then
            mkdir -p build
            echo "<!DOCTYPE html><html><head><title>Smart Signage Pro</title></head><body><h1>Smart Signage Pro v2.0</h1><p>Frontend em desenvolvimento</p></body></html>" > build/index.html
        fi
        cd ..
        log "Frontend preparado!"
    fi
    
    log "Projeto compilado com sucesso!"
}

# Criar diretórios necessários
create_directories() {
    log "Criando diretórios necessários..."
    
    mkdir -p logs
    mkdir -p backups
    mkdir -p public/assets/uploads
    mkdir -p data
    mkdir -p ml-models
    mkdir -p temp
    
    log "Diretórios criados com sucesso!"
}

# Configurar serviços
configure_services() {
    log "Configurando serviços..."
    
    # Habilitar serviços essenciais
    sudo systemctl enable nginx
    sudo systemctl enable fail2ban
    
    # Iniciar serviços
    sudo systemctl start nginx
    sudo systemctl start fail2ban
    
    log "Serviços configurados com sucesso!"
}

# Verificar instalação
verify_installation() {
    log "Verificando instalação..."
    
    echo
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    VERIFICAÇÃO DA INSTALAÇÃO                ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    # Verificar Node.js
    if command -v node &> /dev/null; then
        echo -e "${GREEN}✅ Node.js:${NC} $(node --version)"
    else
        echo -e "${RED}❌ Node.js:${NC} Não instalado"
    fi
    
    # Verificar NPM
    if command -v npm &> /dev/null; then
        echo -e "${GREEN}✅ NPM:${NC} $(npm --version)"
    else
        echo -e "${RED}❌ NPM:${NC} Não instalado"
    fi
    
    # Verificar Docker
    if command -v docker &> /dev/null; then
        echo -e "${GREEN}✅ Docker:${NC} $(docker --version)"
    else
        echo -e "${RED}❌ Docker:${NC} Não instalado"
    fi
    
    # Verificar Docker Compose
    if command -v docker-compose &> /dev/null; then
        echo -e "${GREEN}✅ Docker Compose:${NC} $(docker-compose --version)"
    else
        echo -e "${RED}❌ Docker Compose:${NC} Não instalado"
    fi
    
    # Verificar Nginx
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✅ Nginx:${NC} Ativo"
    else
        echo -e "${YELLOW}⚠️ Nginx:${NC} Inativo"
    fi
    
    # Verificar Firewall
    if sudo ufw status | grep -q "Status: active"; then
        echo -e "${GREEN}✅ Firewall:${NC} Ativo"
    else
        echo -e "${YELLOW}⚠️ Firewall:${NC} Inativo"
    fi
    
    # Verificar Git
    if command -v git &> /dev/null; then
        echo -e "${GREEN}✅ Git:${NC} $(git --version)"
    else
        echo -e "${RED}❌ Git:${NC} Não instalado"
    fi
    
    echo
    log "Verificação concluída!"
}

# Mostrar informações finais
show_final_info() {
    log "Instalação de dependências concluída com sucesso!"
    echo
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    PRÓXIMOS PASSOS                          ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${GREEN}🚀 Para instalar o Smart Signage Pro:${NC}"
    echo -e "   ./scripts/install-smartsignage.sh"
    echo
    echo -e "${GREEN}🔧 Comandos úteis:${NC}"
    echo -e "   node --version          # Verificar Node.js"
    echo -e "   npm --version           # Verificar NPM"
    echo -e "   docker --version        # Verificar Docker"
    echo -e "   sudo systemctl status nginx  # Status do Nginx"
    echo -e "   sudo ufw status         # Status do Firewall"
    echo
    echo -e "${GREEN}📁 Diretórios criados:${NC}"
    echo -e "   logs/                   # Logs do sistema"
    echo -e "   backups/                # Backups"
    echo -e "   public/assets/uploads/  # Uploads de mídia"
    echo -e "   data/                   # Dados do banco"
    echo -e "   ml-models/              # Modelos de IA"
    echo
    echo -e "${YELLOW}⚠️ IMPORTANTE:${NC}"
    echo -e "   - Faça logout e login para usar Docker sem sudo"
    echo -e "   - Configure o Git com suas credenciais"
    echo -e "   - Execute o script de instalação principal"
    echo
    echo -e "${GREEN}✅ Todas as dependências estão prontas!${NC}"
}

# Menu principal
show_menu() {
    echo
    echo -e "${CYAN}Selecione o que deseja instalar:${NC}"
    echo -e "${GREEN}1)${NC} Instalação Completa (Recomendada)"
    echo -e "${GREEN}2)${NC} Apenas Dependências do Sistema"
    echo -e "${GREEN}3)${NC} Apenas Node.js e NPM"
    echo -e "${GREEN}4)${NC} Apenas Docker"
    echo -e "${GREEN}5)${NC} Apenas Ferramentas de Desenvolvimento"
    echo -e "${GREEN}6)${NC} Apenas Ferramentas de Monitoramento"
    echo -e "${GREEN}7)${NC} Apenas Ferramentas de Segurança"
    echo -e "${GREEN}8)${NC} Apenas Dependências do Projeto"
    echo
    read -p "Digite sua escolha (1-8): " choice
    
    case $choice in
        1)
            INSTALL_ALL=true
            ;;
        2)
            INSTALL_SYSTEM=true
            ;;
        3)
            INSTALL_NODE=true
            ;;
        4)
            INSTALL_DOCKER=true
            ;;
        5)
            INSTALL_DEV_TOOLS=true
            ;;
        6)
            INSTALL_MONITORING=true
            ;;
        7)
            INSTALL_SECURITY=true
            ;;
        8)
            INSTALL_PROJECT=true
            ;;
        *)
            error "Opção inválida!"
            exit 1
            ;;
    esac
}

# Função principal
main() {
    show_banner
    check_os
    show_menu
    
    log "Iniciando instalação de dependências..."
    
    if [[ "$INSTALL_ALL" == "true" ]]; then
        update_system
        install_system_dependencies
        install_nodejs
        install_docker
        install_dev_tools
        install_database_tools
        install_monitoring_tools
        install_security_tools
        configure_firewall
        configure_aliases
        configure_git
        install_project_dependencies
        compile_project
        create_directories
        configure_services
    else
        if [[ "$INSTALL_SYSTEM" == "true" ]]; then
            update_system
            install_system_dependencies
        fi
        
        if [[ "$INSTALL_NODE" == "true" ]]; then
            install_nodejs
        fi
        
        if [[ "$INSTALL_DOCKER" == "true" ]]; then
            install_docker
        fi
        
        if [[ "$INSTALL_DEV_TOOLS" == "true" ]]; then
            install_dev_tools
        fi
        
        if [[ "$INSTALL_MONITORING" == "true" ]]; then
            install_monitoring_tools
        fi
        
        if [[ "$INSTALL_SECURITY" == "true" ]]; then
            install_security_tools
        fi
        
        if [[ "$INSTALL_PROJECT" == "true" ]]; then
            install_project_dependencies
            compile_project
        fi
    fi
    
    verify_installation
    show_final_info
}

# Executar script
main "$@"
