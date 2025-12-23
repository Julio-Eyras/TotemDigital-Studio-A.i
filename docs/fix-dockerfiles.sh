#!/bin/bash

# =============================================================================
# Script para corrigir Dockerfiles no servidor
# =============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                CORREÇÃO DE DOCKERFILES                      ║"
    echo "║              Smart Signage Pro v2.0                         ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Verificar se está no diretório correto
check_directory() {
    if [[ ! -f "docker-compose.yml" ]]; then
        error "Execute este script no diretório /opt/smart-signage"
        exit 1
    fi
}

# Parar containers
stop_containers() {
    log "Parando containers..."
    docker compose down
}

# Copiar Dockerfiles
copy_dockerfiles() {
    log "Copiando Dockerfiles..."
    
    # Verificar se existem no diretório atual
    if [[ -f "Dockerfile.backend" ]] && [[ -f "Dockerfile.frontend" ]]; then
        log "✅ Dockerfiles já existem no servidor"
        return 0
    fi
    
    # Tentar copiar do diretório original
    if [[ -f "$HOME/SmartChannel-TV/Dockerfile.backend" ]]; then
        cp "$HOME/SmartChannel-TV/Dockerfile.backend" .
        log "✅ Dockerfile.backend copiado"
    fi
    
    if [[ -f "$HOME/SmartChannel-TV/Dockerfile.frontend" ]]; then
        cp "$HOME/SmartChannel-TV/Dockerfile.frontend" .
        log "✅ Dockerfile.frontend copiado"
    fi
    
    # Verificar se foram copiados
    if [[ ! -f "Dockerfile.backend" ]] || [[ ! -f "Dockerfile.frontend" ]]; then
        error "❌ Dockerfiles não encontrados!"
        error "Execute este script no diretório do projeto SmartSignage-Pro"
        exit 1
    fi
}

# Verificar docker-compose.yml
check_docker_compose() {
    log "Verificando docker-compose.yml..."
    
    if grep -q "Dockerfile.backend" docker-compose.yml && grep -q "Dockerfile.frontend" docker-compose.yml; then
        log "✅ docker-compose.yml já está configurado para nova arquitetura"
    else
        warn "⚠️ docker-compose.yml precisa ser atualizado para nova arquitetura"
        warn "Execute o script de instalação atualizado"
    fi
}

# Rebuild containers
rebuild_containers() {
    log "Rebuildando containers..."
    
    # Remover imagens antigas
    docker compose down --rmi all
    
    # Build das novas imagens
    docker compose build --no-cache
    
    log "✅ Containers rebuildados com sucesso!"
}

# Iniciar containers
start_containers() {
    log "Iniciando containers..."
    
    # Iniciar na ordem correta
    docker compose up -d postgres
    docker compose up -d redis
    docker compose up -d ollama
    docker compose up -d backend
    docker compose up -d frontend
    docker compose up -d nginx
    docker compose up -d prometheus
    docker compose up -d grafana
    
    log "✅ Containers iniciados!"
}

# Verificar status
check_status() {
    log "Verificando status dos containers..."
    
    docker compose ps
    
    # Testar endpoints
    log "Testando endpoints..."
    
    # Aguardar backend
    for i in {1..30}; do
        if curl -f http://localhost:3000/health >/dev/null 2>&1; then
            log "✅ Backend: OK"
            break
        fi
        log "Aguardando backend... ($i/30)"
        sleep 2
    done
    
    # Testar frontend
    if curl -f http://localhost:3001 >/dev/null 2>&1; then
        log "✅ Frontend: OK"
    else
        warn "⚠️ Frontend: Não respondeu"
    fi
    
    # Testar nginx
    if curl -f http://localhost >/dev/null 2>&1; then
        log "✅ Nginx: OK"
    else
        warn "⚠️ Nginx: Não respondeu"
    fi
}

# Mostrar URLs
show_urls() {
    log "URLs de acesso:"
    echo
    echo -e "${GREEN}🎮 Player:${NC} http://$(hostname -I | awk '{print $1}')/player"
    echo -e "${GREEN}👨‍💼 Admin Panel:${NC} http://$(hostname -I | awk '{print $1}')/admin"
    echo -e "${GREEN}🔌 API:${NC} http://$(hostname -I | awk '{print $1}')/api"
    echo -e "${GREEN}💚 Health:${NC} http://$(hostname -I | awk '{print $1}')/health"
    echo -e "${GREEN}📊 Grafana:${NC} http://$(hostname -I | awk '{print $1}'):3002"
    echo -e "${GREEN}📈 Prometheus:${NC} http://$(hostname -I | awk '{print $1}'):9090"
    echo
}

# Função principal
main() {
    show_banner
    check_directory
    stop_containers
    copy_dockerfiles
    check_docker_compose
    rebuild_containers
    start_containers
    check_status
    show_urls
    
    log "✅ Correção concluída com sucesso!"
}

# Executar script
main "$@"
