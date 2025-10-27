#!/bin/bash
# Smart Signage Pro v2.0 - Monitor em Tempo Real
# Este script monitora o sistema em tempo real

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configurações
REFRESH_INTERVAL=5
LOG_FILE="monitor.log"

# Função para limpar tela
clear_screen() {
    clear
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                SMART SIGNAGE PRO v2.0 MONITOR               ║${NC}"
    echo -e "${BLUE}║                    Monitor em Tempo Real                   ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Função para mostrar status dos containers
show_container_status() {
    echo -e "${CYAN}📦 STATUS DOS CONTAINERS${NC}"
    echo "┌─────────────────────────────────────────────────────────────────┐"
    
    if docker compose ps 2>/dev/null | grep -q "Up"; then
        docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" | tail -n +2 | while read line; do
            if echo "$line" | grep -q "healthy"; then
                echo -e "│ ${GREEN}✅ $line${NC}"
            elif echo "$line" | grep -q "unhealthy"; then
                echo -e "│ ${RED}❌ $line${NC}"
            elif echo "$line" | grep -q "Up"; then
                echo -e "│ ${YELLOW}⚠️  $line${NC}"
            else
                echo -e "│ ${RED}🔴 $line${NC}"
            fi
        done
    else
        echo -e "│ ${RED}❌ Nenhum container rodando${NC}"
    fi
    
    echo "└─────────────────────────────────────────────────────────────────┘"
    echo ""
}

# Função para mostrar status dos endpoints
show_endpoint_status() {
    echo -e "${CYAN}🌐 STATUS DOS ENDPOINTS${NC}"
    echo "┌─────────────────────────────────────────────────────────────────┐"
    
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
        
        if curl -s --max-time 3 "$url" > /dev/null 2>&1; then
            echo -e "│ ${GREEN}✅ $name: OK${NC}"
        else
            echo -e "│ ${RED}❌ $name: FALHA${NC}"
        fi
    done
    
    echo "└─────────────────────────────────────────────────────────────────┘"
    echo ""
}

# Função para mostrar uso de recursos
show_resource_usage() {
    echo -e "${CYAN}📊 USO DE RECURSOS${NC}"
    echo "┌─────────────────────────────────────────────────────────────────┐"
    
    # CPU e Memória do sistema
    if command -v top > /dev/null 2>&1; then
        local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
        local mem_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
        echo -e "│ ${BLUE}💻 CPU: ${cpu_usage}% | RAM: ${mem_usage}%${NC}"
    fi
    
    # Uso de disco
    local disk_usage=$(df -h . | awk 'NR==2 {print $5}')
    echo -e "│ ${BLUE}💾 Disco: ${disk_usage}${NC}"
    
    # Docker stats
    if docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | grep smartsignage | head -3 | while read line; do
        echo -e "│ ${BLUE}🐳 $line${NC}"
    done
    
    echo "└─────────────────────────────────────────────────────────────────┘"
    echo ""
}

# Função para mostrar logs recentes
show_recent_logs() {
    echo -e "${CYAN}📋 LOGS RECENTES${NC}"
    echo "┌─────────────────────────────────────────────────────────────────┐"
    
    # Logs de erro recentes
    local error_logs=$(docker compose logs --tail=3 2>/dev/null | grep -i error | tail -2)
    if [ -n "$error_logs" ]; then
        echo -e "│ ${RED}❌ Erros recentes:${NC}"
        echo "$error_logs" | while read line; do
            echo -e "│ ${RED}   $line${NC}"
        done
    else
        echo -e "│ ${GREEN}✅ Nenhum erro recente${NC}"
    fi
    
    echo "└─────────────────────────────────────────────────────────────────┘"
    echo ""
}

# Função para mostrar informações do sistema
show_system_info() {
    echo -e "${CYAN}ℹ️  INFORMAÇÕES DO SISTEMA${NC}"
    echo "┌─────────────────────────────────────────────────────────────────┐"
    echo -e "│ ${BLUE}🕐 Data/Hora: $(date)${NC}"
    echo -e "│ ${BLUE}🖥️  Servidor: $(hostname)${NC}"
    echo -e "│ ${BLUE}🐧 OS: $(uname -s) $(uname -r)${NC}"
    echo -e "│ ${BLUE}🐳 Docker: $(docker --version 2>/dev/null | cut -d' ' -f3 || echo 'N/A')${NC}"
    echo -e "│ ${BLUE}📦 Compose: $(docker compose version 2>/dev/null | cut -d' ' -f4 || echo 'N/A')${NC}"
    echo "└─────────────────────────────────────────────────────────────────┘"
    echo ""
}

# Função para mostrar estatísticas de rede
show_network_stats() {
    echo -e "${CYAN}🌐 ESTATÍSTICAS DE REDE${NC}"
    echo "┌─────────────────────────────────────────────────────────────────┐"
    
    # Conexões ativas
    local connections=$(netstat -an 2>/dev/null | grep -E ":(3000|3001|3002|9090|11434)" | grep LISTEN | wc -l)
    echo -e "│ ${BLUE}🔗 Conexões ativas: $connections${NC}"
    
    # Portas abertas
    echo -e "│ ${BLUE}🚪 Portas abertas:${NC}"
    netstat -tlnp 2>/dev/null | grep -E ":(80|3000|3001|3002|9090|11434)" | while read line; do
        local port=$(echo "$line" | awk '{print $4}' | cut -d: -f2)
        local status=$(echo "$line" | awk '{print $6}')
        if [ "$status" = "LISTEN" ]; then
            echo -e "│ ${GREEN}   ✅ Porta $port: Ativa${NC}"
        else
            echo -e "│ ${RED}   ❌ Porta $port: Inativa${NC}"
        fi
    done
    
    echo "└─────────────────────────────────────────────────────────────────┘"
    echo ""
}

# Função para mostrar alertas
show_alerts() {
    echo -e "${CYAN}🚨 ALERTAS${NC}"
    echo "┌─────────────────────────────────────────────────────────────────┐"
    
    local alerts=()
    
    # Verificar containers não saudáveis
    if docker compose ps 2>/dev/null | grep -q "unhealthy"; then
        alerts+=("Containers não saudáveis detectados")
    fi
    
    # Verificar endpoints com falha
    if ! curl -s --max-time 3 http://localhost:3000/health > /dev/null 2>&1; then
        alerts+=("Backend API indisponível")
    fi
    
    # Verificar uso de disco
    local disk_usage=$(df . | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 90 ]; then
        alerts+=("Uso de disco crítico: ${disk_usage}%")
    fi
    
    # Verificar uso de memória
    if command -v free > /dev/null 2>&1; then
        local mem_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
        if [ "$mem_usage" -gt 90 ]; then
            alerts+=("Uso de memória crítico: ${mem_usage}%")
        fi
    fi
    
    if [ ${#alerts[@]} -eq 0 ]; then
        echo -e "│ ${GREEN}✅ Nenhum alerta${NC}"
    else
        for alert in "${alerts[@]}"; do
            echo -e "│ ${RED}⚠️  $alert${NC}"
        done
    fi
    
    echo "└─────────────────────────────────────────────────────────────────┘"
    echo ""
}

# Função principal do monitor
run_monitor() {
    while true; do
        clear_screen
        
        show_system_info
        show_container_status
        show_endpoint_status
        show_resource_usage
        show_network_stats
        show_alerts
        show_recent_logs
        
        echo -e "${YELLOW}🔄 Atualizando em $REFRESH_INTERVAL segundos... (Ctrl+C para sair)${NC}"
        
        # Log da sessão
        echo "$(date): Monitor executado" >> "$LOG_FILE"
        
        sleep "$REFRESH_INTERVAL"
    done
}

# Função para mostrar ajuda
show_help() {
    echo -e "${BLUE}Smart Signage Pro v2.0 - Monitor em Tempo Real${NC}"
    echo ""
    echo "Uso: $0 [OPÇÕES]"
    echo ""
    echo "Opções:"
    echo "  -i, --interval SECONDS  Intervalo de atualização (padrão: 5)"
    echo "  -h, --help             Mostrar esta ajuda"
    echo "  -v, --version          Mostrar versão"
    echo ""
    echo "Exemplos:"
    echo "  $0                     # Monitor com intervalo padrão"
    echo "  $0 -i 10               # Monitor com intervalo de 10 segundos"
    echo ""
    echo "Controles:"
    echo "  Ctrl+C                 Sair do monitor"
    echo "  Ctrl+Z                 Pausar monitor"
}

# Função para mostrar versão
show_version() {
    echo "Smart Signage Pro v2.0 Monitor"
    echo "Versão: 2.0.0"
    echo "Data: $(date)"
}

# Processar argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--interval)
            REFRESH_INTERVAL="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--version)
            show_version
            exit 0
            ;;
        *)
            echo -e "${RED}Opção inválida: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker não está rodando!${NC}"
    echo "Por favor, inicie o Docker e tente novamente."
    exit 1
fi

# Verificar se o sistema está instalado
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ Smart Signage Pro não está instalado!${NC}"
    echo "Execute ./install-smartsignage.sh primeiro."
    exit 1
fi

# Iniciar monitor
echo -e "${GREEN}🚀 Iniciando monitor do Smart Signage Pro v2.0...${NC}"
echo -e "${BLUE}📊 Intervalo de atualização: ${REFRESH_INTERVAL}s${NC}"
echo ""

run_monitor
