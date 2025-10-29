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

# Função para obter IPs do servidor
get_server_ips() {
    LOCAL_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "Não detectado")
    EXTERNAL_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 ipinfo.io/ip 2>/dev/null || echo "Não detectado")
    
    if [[ -z "$LOCAL_IP" || "$LOCAL_IP" == "" ]]; then
        LOCAL_IP=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $7; exit}' || echo "Não detectado")
    fi
    
    if [[ -z "$LOCAL_IP" || "$LOCAL_IP" == "" ]]; then
        LOCAL_IP="127.0.0.1"
    fi
}

# Função para mostrar ajuda completa
show_help() {
    # Obter IPs
    get_server_ips
    
    # Cores adicionais
    PURPLE='\033[0;35m'
    CYAN='\033[0;36m'
    
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║         Smart Signage Pro v2.0 - Gerenciador do Sistema      ║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                    📋 COMANDOS DISPONÍVEIS                    ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    echo -e "${GREEN}  start${NC}          Iniciar todos os serviços"
    echo -e "${GREEN}  stop${NC}           Parar todos os serviços"
    echo -e "${GREEN}  restart${NC}        Reiniciar todos os serviços"
    echo -e "${GREEN}  status${NC}         Mostrar status dos serviços"
    echo -e "${GREEN}  logs${NC}           Mostrar logs dos serviços"
    echo -e "${GREEN}  logs <servico>${NC} Mostrar logs de um serviço específico"
    echo -e "${GREEN}  backup${NC}         Fazer backup do sistema"
    echo -e "${GREEN}  restore${NC}        Restaurar backup"
    echo -e "${GREEN}  update${NC}         Atualizar sistema"
    echo -e "${GREEN}  rebuild${NC}        Rebuild completo"
    echo -e "${GREEN}  clean${NC}          Limpar containers e volumes não utilizados"
    echo -e "${GREEN}  health${NC}         Verificar saúde do sistema"
    echo -e "${GREEN}  reset${NC}          Reset completo (CUIDADO! Apaga tudo)"
    echo -e "${GREEN}  help${NC}            Mostrar esta mensagem de ajuda"
    echo
    echo -e "${YELLOW}Exemplos:${NC}"
    echo -e "  $0 start"
    echo -e "  $0 status"
    echo -e "  $0 logs backend"
    echo -e "  $0 logs frontend"
    echo -e "  $0 backup"
    echo
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                  🌐 INFORMAÇÕES DO SERVIDOR                   ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    echo -e "${CYAN}📍 Endereços do Servidor:${NC}"
    echo -e "   ${GREEN}IP Externo:${NC} ${YELLOW}$EXTERNAL_IP${NC}"
    echo -e "   ${GREEN}IP Local:${NC}   ${YELLOW}$LOCAL_IP${NC}"
    echo
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                    🌐 LINKS DE ACESSO                        ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    echo -e "${CYAN}📱 PAINEL ADMINISTRATIVO (Frontend):${NC}"
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
        echo -e "   ${YELLOW}👉 IP Externo: http://$EXTERNAL_IP:80${NC} ${GREEN}(Acesso remoto)${NC}"
    fi
    echo -e "   ${YELLOW}👉 IP Local:   http://$LOCAL_IP:80${NC} ${BLUE}(Rede interna)${NC}"
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
        echo -e "   ${YELLOW}👉 IP Externo: http://$EXTERNAL_IP:80/player${NC} ${GREEN}(Acesso remoto)${NC}"
    fi
    echo -e "   ${YELLOW}👉 IP Local:   http://$LOCAL_IP:80/player${NC} ${BLUE}(Rede interna)${NC}"
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
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                  🔐 CREDENCIAIS DE ACESSO                    ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    echo -e "${RED}👤 USUÁRIO:${NC} ${YELLOW}admin${NC}"
    echo -e "${RED}🔑 SENHA:${NC}  ${YELLOW}admin${NC}"
    echo
    echo -e "${RED}⚠️  ATENÇÃO:${NC} ${YELLOW}ALTERE A SENHA APÓS O PRIMEIRO LOGIN!${NC}"
    echo
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                  📋 INFORMAÇÕES TÉCNICAS                     ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    INSTALL_DIR="${INSTALL_DIR:-/opt/smart-signage}"
    echo -e "${CYAN}📁 Diretório de Instalação:${NC}"
    echo -e "   $INSTALL_DIR"
    echo
    echo -e "${CYAN}🔧 Scripts de Gerenciamento:${NC}"
    echo -e "   $0 {start|stop|restart|status|logs|update|backup|help}"
    echo -e "   $INSTALL_DIR/scripts/backup-system.sh"
    echo -e "   $INSTALL_DIR/scripts/monitor-system.sh"
    if command -v smartsignage &> /dev/null; then
        echo -e "   Comando global: smartsignage {comando}"
    fi
    echo
    echo -e "${CYAN}📊 Monitoramento:${NC}"
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
        echo -e "   Prometheus: http://$EXTERNAL_IP:9090 ${GREEN}(Acesso remoto)${NC}"
        echo -e "              http://$LOCAL_IP:9090 ${BLUE}(Rede interna)${NC}"
        echo -e "   Grafana:    http://$EXTERNAL_IP:3002 (admin/admin) ${GREEN}(Acesso remoto)${NC}"
        echo -e "              http://$LOCAL_IP:3002 (admin/admin) ${BLUE}(Rede interna)${NC}"
    else
        echo -e "   Prometheus: http://$LOCAL_IP:9090"
        echo -e "   Grafana:    http://$LOCAL_IP:3002 (admin/admin)"
    fi
    echo -e "   Logs:       $0 logs [servico]"
    echo -e "   Status:     $0 status"
    echo
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                    🚀 PRÓXIMOS PASSOS                       ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    echo -e "${YELLOW}1.${NC} ${CYAN}Acesse o sistema:${NC}"
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
        echo -e "   ${YELLOW}http://$EXTERNAL_IP:80${NC} ${GREEN}(Acesso remoto)${NC}"
    fi
    echo -e "   ${YELLOW}http://$LOCAL_IP:80${NC} ${BLUE}(Rede interna)${NC}"
    echo -e "${YELLOW}2.${NC} ${CYAN}Faça login com:${NC} ${YELLOW}admin/admin${NC}"
    echo -e "${YELLOW}3.${NC} ${CYAN}Altere a senha do administrador${NC}"
    echo -e "${YELLOW}4.${NC} ${CYAN}Configure seus clientes e totems${NC}"
    echo -e "${YELLOW}5.${NC} ${CYAN}Configure SSL/HTTPS para produção${NC}"
    echo
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    echo -e "${GREEN}💡 Para mais informações, execute:${NC}"
    echo -e "   ${YELLOW}$0 status${NC}  - Ver status dos serviços"
    echo -e "   ${YELLOW}$0 logs${NC}    - Ver logs em tempo real"
    echo -e "   ${YELLOW}$0 health${NC}  - Verificar saúde do sistema"
    echo
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
    
    # Obter IPs para mostrar links corretos
    get_server_ips
    
    # Cores adicionais
    PURPLE='\033[0;35m'
    CYAN='\033[0;36m'
    
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                    🌐 LINKS DE ACESSO                        ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    echo -e "${CYAN}📱 PAINEL ADMINISTRATIVO (Frontend):${NC}"
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
        echo -e "   ${YELLOW}👉 IP Externo: http://$EXTERNAL_IP:80${NC} ${GREEN}(Acesso remoto)${NC}"
    fi
    echo -e "   ${YELLOW}👉 IP Local:   http://$LOCAL_IP:80${NC} ${BLUE}(Rede interna)${NC}"
    echo
    echo -e "${CYAN}🔧 API BACKEND:${NC}"
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
        echo -e "   ${YELLOW}👉 IP Externo: http://$EXTERNAL_IP:3000${NC} ${GREEN}(Acesso remoto)${NC}"
    fi
    echo -e "   ${YELLOW}👉 IP Local:   http://$LOCAL_IP:3000${NC} ${BLUE}(Rede interna)${NC}"
    echo
    echo -e "${CYAN}📊 MONITORAMENTO:${NC}"
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
        echo -e "   ${YELLOW}👉 Prometheus: http://$EXTERNAL_IP:9090${NC} ${GREEN}(Acesso remoto)${NC}"
        echo -e "   ${YELLOW}   Prometheus: http://$LOCAL_IP:9090${NC} ${BLUE}(Rede interna)${NC}"
        echo -e "   ${YELLOW}👉 Grafana:    http://$EXTERNAL_IP:3002${NC} ${GREEN}(Acesso remoto)${NC}"
        echo -e "   ${YELLOW}   Grafana:    http://$LOCAL_IP:3002${NC} ${BLUE}(Rede interna)${NC}"
    else
        echo -e "   ${YELLOW}👉 Prometheus: http://$LOCAL_IP:9090${NC}"
        echo -e "   ${YELLOW}👉 Grafana:    http://$LOCAL_IP:3002${NC}"
    fi
    echo
    echo -e "${GREEN}💡 Execute '$0 help' para ver todas as informações e comandos disponíveis${NC}"
    echo
    
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
    
    # Aguardar inicialização (serviços precisam de tempo para iniciar)
    echo -e "${BLUE}⏳ Aguardando serviços iniciarem (15 segundos)...${NC}"
    sleep 15
    
    # Verificar status dos containers
    echo -e "${BLUE}📊 Status dos containers:${NC}"
    docker compose ps
    
    echo ""
    health_check
}

# Função para mostrar status
show_status() {
    # Obter IPs
    get_server_ips
    
    # Cores adicionais
    PURPLE='\033[0;35m'
    CYAN='\033[0;36m'
    
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                  📊 STATUS DOS SERVIÇOS                     ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    check_docker
    
    docker compose ps
    
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                  🌐 INFORMAÇÕES DO SERVIDOR                  ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    echo -e "${CYAN}📍 Endereços do Servidor:${NC}"
    echo -e "   ${GREEN}IP Externo:${NC} ${YELLOW}$EXTERNAL_IP${NC}"
    echo -e "   ${GREEN}IP Local:${NC}   ${YELLOW}$LOCAL_IP${NC}"
    echo
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                  🔍 VERIFICAÇÃO DE CONECTIVIDADE             ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    
    # Testar endpoints
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend API: Funcionando${NC}"
        echo -e "   ${YELLOW}http://$LOCAL_IP:3000/health${NC}"
    else
        echo -e "${RED}❌ Backend API: Indisponível${NC}"
    fi
    
    if curl -s http://localhost:80 > /dev/null 2>&1; then
        RESPONSE=$(curl -s http://localhost:80)
        if echo "$RESPONSE" | grep -qi "Welcome to nginx"; then
            echo -e "${YELLOW}⚠️  Frontend: Nginx está servindo página padrão${NC}"
        else
            echo -e "${GREEN}✅ Frontend: Funcionando${NC}"
            echo -e "   ${YELLOW}http://$LOCAL_IP:80${NC}"
        fi
    else
        echo -e "${RED}❌ Frontend: Indisponível${NC}"
    fi
    
    if curl -s http://localhost:3002 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Grafana: Funcionando${NC}"
        echo -e "   ${YELLOW}http://$LOCAL_IP:3002${NC}"
    else
        echo -e "${RED}❌ Grafana: Indisponível${NC}"
    fi
    
    if curl -s http://localhost:9090 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Prometheus: Funcionando${NC}"
        echo -e "   ${YELLOW}http://$LOCAL_IP:9090${NC}"
    else
        echo -e "${RED}❌ Prometheus: Indisponível${NC}"
    fi
    
    echo
    echo -e "${GREEN}💡 Execute '$0 help' para ver todas as informações e links de acesso${NC}"
    echo
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
    echo ""
    
    local all_healthy=true
    
    # Verificar status dos containers primeiro
    echo -e "${CYAN}📦 Verificando containers...${NC}"
    local container_status=$(docker compose ps --format json 2>/dev/null || docker compose ps)
    
    # Verificar se há containers rodando
    local running_count=$(docker compose ps --services --filter "status=running" 2>/dev/null | wc -l || echo "0")
    if [ "$running_count" -gt 0 ]; then
        echo -e "${GREEN}✅ $running_count container(s) rodando${NC}"
    else
        echo -e "${YELLOW}⚠️  Nenhum container rodando ainda (aguardando inicialização)${NC}"
        all_healthy=false
    fi
    
    # Verificar containers healthy
    local healthy_count=$(docker compose ps --services --filter "health=healthy" 2>/dev/null | wc -l || echo "0")
    if [ "$healthy_count" -gt 0 ]; then
        echo -e "${GREEN}✅ $healthy_count container(s) saudável(is)${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}🌐 Verificando endpoints (aguardando 5 segundos para estabilização)...${NC}"
    sleep 5
    
    # Verificar endpoints com retry
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
        
        # Tentar até 3 vezes com delay
        local success=false
        for i in {1..3}; do
            if curl -s --max-time 5 "$url" > /dev/null 2>&1; then
                echo -e "${GREEN}✅ $name: OK${NC}"
                success=true
                break
            fi
            sleep 2
        done
        
        if [ "$success" = false ]; then
            echo -e "${YELLOW}⚠️  $name: Não respondeu ainda (pode estar iniciando)${NC}"
            all_healthy=false
        fi
    done
    
    echo ""
    if [ "$all_healthy" = true ]; then
        echo -e "${GREEN}🎉 Sistema totalmente saudável!${NC}"
    else
        echo -e "${YELLOW}⚠️  Alguns serviços ainda estão iniciando ou com problemas${NC}"
        echo -e "${CYAN}💡 Dica: Execute '$0 status' para ver status detalhado${NC}"
        echo -e "${CYAN}💡 Dica: Execute '$0 logs [servico]' para ver logs${NC}"
        echo -e "${CYAN}💡 Aguarde alguns segundos e execute '$0 status' novamente${NC}"
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
