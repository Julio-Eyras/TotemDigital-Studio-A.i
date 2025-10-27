#!/bin/bash
# Smart Signage Pro v2.0 - Script de Gerenciamento do Sistema
# Este script permite controlar todos os serviços do sistema

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para mostrar ajuda
show_help() {
    echo -e "${BLUE}Smart Signage Pro v2.0 - Gerenciador do Sistema${NC}"
    echo ""
    echo "Uso: $0 [COMANDO]"
    echo ""
    echo "Comandos disponíveis:"
    echo "  start       - Iniciar todos os serviços"
    echo "  stop        - Parar todos os serviços"
    echo "  restart     - Reiniciar todos os serviços"
    echo "  status      - Mostrar status dos serviços"
    echo "  logs        - Mostrar logs dos serviços"
    echo "  backup      - Fazer backup do sistema"
    echo "  restore     - Restaurar backup"
    echo "  update      - Atualizar sistema"
    echo "  rebuild     - Rebuild completo"
    echo "  clean       - Limpar containers e volumes"
    echo "  health      - Verificar saúde do sistema"
    echo "  reset       - Reset completo (CUIDADO!)"
    echo ""
    echo "Exemplos:"
    echo "  $0 start"
    echo "  $0 status"
    echo "  $0 logs backend"
    echo "  $0 backup"
}

# Função para verificar se Docker está rodando
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker não está rodando!${NC}"
        echo "Por favor, inicie o Docker e tente novamente."
        exit 1
    fi
}

# Função para iniciar serviços
start_services() {
    echo -e "${BLUE}🚀 Iniciando Smart Signage Pro v2.0...${NC}"
    check_docker
    
    # Verificar se já está rodando
    if docker compose ps | grep -q "Up"; then
        echo -e "${YELLOW}⚠️  Alguns serviços já estão rodando.${NC}"
        echo "Use 'restart' para reiniciar ou 'stop' para parar primeiro."
        return 1
    fi
    
    # Iniciar serviços
    docker compose up -d
    
    echo -e "${GREEN}✅ Serviços iniciados com sucesso!${NC}"
    echo ""
    echo "Acesse:"
    echo "  Frontend: http://localhost:3001"
    echo "  Backend:  http://localhost:3000"
    echo "  Grafana:  http://localhost:3002"
    echo "  Prometheus: http://localhost:9090"
    
    # Aguardar inicialização
    echo -e "${BLUE}⏳ Aguardando inicialização...${NC}"
    sleep 10
    
    # Verificar saúde
    health_check
}

# Função para parar serviços
stop_services() {
    echo -e "${YELLOW}🛑 Parando Smart Signage Pro v2.0...${NC}"
    check_docker
    
    docker compose down
    
    echo -e "${GREEN}✅ Serviços parados com sucesso!${NC}"
}

# Função para reiniciar serviços
restart_services() {
    echo -e "${BLUE}🔄 Reiniciando Smart Signage Pro v2.0...${NC}"
    check_docker
    
    docker compose restart
    
    echo -e "${GREEN}✅ Serviços reiniciados com sucesso!${NC}"
    
    # Aguardar inicialização
    sleep 10
    health_check
}

# Função para mostrar status
show_status() {
    echo -e "${BLUE}📊 Status dos Serviços${NC}"
    echo ""
    check_docker
    
    docker compose ps
    
    echo ""
    echo -e "${BLUE}🔍 Verificando conectividade...${NC}"
    
    # Testar endpoints
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend API: Funcionando${NC}"
    else
        echo -e "${RED}❌ Backend API: Indisponível${NC}"
    fi
    
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend: Funcionando${NC}"
    else
        echo -e "${RED}❌ Frontend: Indisponível${NC}"
    fi
    
    if curl -s http://localhost:3002 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Grafana: Funcionando${NC}"
    else
        echo -e "${RED}❌ Grafana: Indisponível${NC}"
    fi
}

# Função para mostrar logs
show_logs() {
    local service=${1:-""}
    
    if [ -z "$service" ]; then
        echo -e "${BLUE}📋 Logs de Todos os Serviços${NC}"
        docker compose logs --tail=50
    else
        echo -e "${BLUE}📋 Logs do Serviço: $service${NC}"
        docker compose logs --tail=50 "$service"
    fi
}

# Função para backup
backup_system() {
    echo -e "${BLUE}💾 Fazendo backup do sistema...${NC}"
    
    local backup_file="backup-smartsignage-$(date +%Y%m%d-%H%M%S).tar.gz"
    
    # Criar diretório de backup
    mkdir -p backups
    
    # Backup dos volumes Docker
    docker compose down
    docker run --rm -v smartsignage-pro_postgres_data:/data -v smartsignage-pro_backend_uploads:/uploads -v smartsignage-pro_backend_logs:/logs -v smartsignage-pro_backend_backups:/backups -v smartsignage-pro_backend_data:/appdata -v smartsignage-pro_frontend_assets:/assets -v smartsignage-pro_ollama_data:/ollama -v smartsignage-pro_redis_data:/redis -v smartsignage-pro_prometheus_data:/prometheus -v smartsignage-pro_grafana_data:/grafana -v "$(pwd)":/backup alpine tar czf /backup/backups/"$backup_file" /data /uploads /logs /backups /appdata /assets /ollama /redis /prometheus /grafana
    
    # Backup da configuração
    tar czf "backups/config-$backup_file" .env docker-compose.yml nginx/ monitoring/
    
    # Reiniciar serviços
    docker compose up -d
    
    echo -e "${GREEN}✅ Backup criado: backups/$backup_file${NC}"
    echo -e "${GREEN}✅ Configuração: backups/config-$backup_file${NC}"
}

# Função para restaurar backup
restore_system() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        echo -e "${RED}❌ Especifique o arquivo de backup!${NC}"
        echo "Uso: $0 restore <arquivo-backup>"
        echo ""
        echo "Backups disponíveis:"
        ls -la backups/*.tar.gz 2>/dev/null || echo "Nenhum backup encontrado."
        return 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}❌ Arquivo de backup não encontrado: $backup_file${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}⚠️  ATENÇÃO: Esta operação irá substituir todos os dados!${NC}"
    read -p "Tem certeza? (digite 'SIM' para confirmar): " confirm
    
    if [ "$confirm" != "SIM" ]; then
        echo -e "${YELLOW}Operação cancelada.${NC}"
        return 1
    fi
    
    echo -e "${BLUE}🔄 Restaurando backup: $backup_file${NC}"
    
    # Parar serviços
    docker compose down
    
    # Restaurar volumes
    docker run --rm -v smartsignage-pro_postgres_data:/data -v smartsignage-pro_backend_uploads:/uploads -v smartsignage-pro_backend_logs:/logs -v smartsignage-pro_backend_backups:/backups -v smartsignage-pro_backend_data:/appdata -v smartsignage-pro_frontend_assets:/assets -v smartsignage-pro_ollama_data:/ollama -v smartsignage-pro_redis_data:/redis -v smartsignage-pro_prometheus_data:/prometheus -v smartsignage-pro_grafana_data:/grafana -v "$(pwd)":/backup alpine tar xzf /backup/"$backup_file"
    
    # Reiniciar serviços
    docker compose up -d
    
    echo -e "${GREEN}✅ Backup restaurado com sucesso!${NC}"
}

# Função para atualizar sistema
update_system() {
    echo -e "${BLUE}🔄 Atualizando Smart Signage Pro v2.0...${NC}"
    
    # Fazer backup antes da atualização
    backup_system
    
    # Atualizar imagens Docker
    docker compose pull
    
    # Rebuild containers
    docker compose build --no-cache
    
    # Reiniciar serviços
    docker compose up -d
    
    echo -e "${GREEN}✅ Sistema atualizado com sucesso!${NC}"
}

# Função para rebuild completo
rebuild_system() {
    echo -e "${BLUE}🔨 Fazendo rebuild completo do sistema...${NC}"
    
    # Fazer backup
    backup_system
    
    # Parar e remover containers
    docker compose down
    
    # Remover imagens locais
    docker compose down --rmi all
    
    # Rebuild completo
    docker compose build --no-cache
    
    # Iniciar serviços
    docker compose up -d
    
    echo -e "${GREEN}✅ Rebuild completo realizado!${NC}"
}

# Função para limpeza
clean_system() {
    echo -e "${YELLOW}🧹 Limpando sistema...${NC}"
    
    # Parar serviços
    docker compose down
    
    # Remover containers parados
    docker container prune -f
    
    # Remover imagens não utilizadas
    docker image prune -f
    
    # Remover volumes não utilizados
    docker volume prune -f
    
    # Remover redes não utilizadas
    docker network prune -f
    
    echo -e "${GREEN}✅ Limpeza concluída!${NC}"
}

# Função para verificar saúde
health_check() {
    echo -e "${BLUE}🏥 Verificando saúde do sistema...${NC}"
    
    local all_healthy=true
    
    # Verificar containers
    if ! docker compose ps | grep -q "healthy"; then
        echo -e "${RED}❌ Alguns containers não estão saudáveis${NC}"
        all_healthy=false
    fi
    
    # Verificar endpoints
    local endpoints=(
        "http://localhost:3000/health:Backend API"
        "http://localhost:3000/api/health:API Health"
        "http://localhost:3001:Frontend"
        "http://localhost:3002:Grafana"
        "http://localhost:9090:Prometheus"
        "http://localhost:11434/api/tags:Ollama IA"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local url=$(echo "$endpoint" | cut -d: -f1-2)
        local name=$(echo "$endpoint" | cut -d: -f3)
        
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $name: OK${NC}"
        else
            echo -e "${RED}❌ $name: FALHA${NC}"
            all_healthy=false
        fi
    done
    
    if [ "$all_healthy" = true ]; then
        echo -e "${GREEN}🎉 Sistema totalmente saudável!${NC}"
    else
        echo -e "${YELLOW}⚠️  Sistema com problemas detectados${NC}"
        echo "Execute '$0 logs' para mais detalhes."
    fi
}

# Função para reset completo
reset_system() {
    echo -e "${RED}⚠️  ATENÇÃO: RESET COMPLETO DO SISTEMA!${NC}"
    echo "Esta operação irá:"
    echo "  - Parar todos os serviços"
    echo "  - Remover todos os containers"
    echo "  - Remover todos os volumes (DADOS PERDIDOS!)"
    echo "  - Remover todas as imagens"
    echo "  - Limpar completamente o sistema"
    echo ""
    read -p "Digite 'RESETAR' para confirmar: " confirm
    
    if [ "$confirm" != "RESETAR" ]; then
        echo -e "${YELLOW}Operação cancelada.${NC}"
        return 1
    fi
    
    echo -e "${RED}🔄 Resetando sistema...${NC}"
    
    # Parar e remover tudo
    docker compose down -v --rmi all
    
    # Limpeza completa
    docker system prune -af
    
    echo -e "${GREEN}✅ Sistema resetado completamente!${NC}"
    echo "Execute '$0 start' para reinstalar."
}

# Função principal
main() {
    case "${1:-help}" in
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "$2"
            ;;
        backup)
            backup_system
            ;;
        restore)
            restore_system "$2"
            ;;
        update)
            update_system
            ;;
        rebuild)
            rebuild_system
            ;;
        clean)
            clean_system
            ;;
        health)
            health_check
            ;;
        reset)
            reset_system
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}❌ Comando inválido: $1${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Executar função principal
main "$@"
