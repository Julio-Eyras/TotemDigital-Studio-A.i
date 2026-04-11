#!/bin/bash

# =============================================================================
# Script Master de Gerenciamento - Smart Signage Pro
# =============================================================================
# Uso: ./scripts/manage.sh [categoria] [script]
# Exemplo: ./scripts/manage.sh status status-system
# =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
    echo -e "${CYAN}[INFO]${NC} $1"
}

# Listar categorias disponíveis
list_categories() {
    echo -e "${BLUE}📁 Categorias disponíveis:${NC}"
    echo ""
    for dir in "$SCRIPT_DIR"/*/; do
        if [ -d "$dir" ]; then
            category=$(basename "$dir")
            count=$(find "$dir" -maxdepth 1 -type f | wc -l)
            echo -e "  ${GREEN}$category${NC} ($count scripts)"
        fi
    done
}

# Listar scripts de uma categoria
list_scripts() {
    local category=$1
    local category_dir="$SCRIPT_DIR/$category"
    
    if [ ! -d "$category_dir" ]; then
        error "Categoria '$category' não encontrada"
        return 1
    fi
    
    echo -e "${BLUE}📄 Scripts em '$category':${NC}"
    echo ""
    for script in "$category_dir"/*; do
        if [ -f "$script" ]; then
            script_name=$(basename "$script")
            echo -e "  ${GREEN}$script_name${NC}"
        fi
    done
}

# Executar script
execute_script() {
    local category=$1
    local script_name=$2
    local script_path="$SCRIPT_DIR/$category/$script_name"
    
    if [ ! -f "$script_path" ]; then
        error "Script '$script_name' não encontrado em '$category'"
        return 1
    fi
    
    # Verificar se é executável
    if [ ! -x "$script_path" ]; then
        warn "Script não é executável. Adicionando permissão..."
        chmod +x "$script_path"
    fi
    
    log "Executando: $category/$script_name"
    echo ""
    "$script_path" "$@"
}

# Menu interativo
show_menu() {
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     Smart Signage Pro - Gerenciador de Scripts          ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Opções rápidas:${NC}"
    echo ""
    echo -e "  ${GREEN}1${NC}. Status do sistema"
    echo -e "  ${GREEN}2${NC}. Parar sistema"
    echo -e "  ${GREEN}3${NC}. Iniciar sistema"
    echo -e "  ${GREEN}4${NC}. Reiniciar sistema"
    echo -e "  ${GREEN}5${NC}. Matar processos mortos"
    echo -e "  ${GREEN}6${NC}. Visualizar logs"
    echo -e "  ${GREEN}7${NC}. Health check"
    echo -e "  ${GREEN}8${NC}. Monitorar sistema"
    echo -e "  ${GREEN}9${NC}. Listar todas as categorias"
    echo -e "  ${GREEN}0${NC}. Sair"
    echo ""
    read -p "Escolha uma opção: " choice
    
    case $choice in
        1) execute_script "status" "status-system.sh" ;;
        2) execute_script "stop" "stop-all.sh" ;;
        3) execute_script "start" "start-system.sh" ;;
        4) execute_script "restart" "restart-system.sh" ;;
        5) execute_script "kill" "clean-all.sh" ;;
        6) execute_script "logs" "logs-system.sh" ;;
        7) execute_script "health" "health-check.sh" ;;
        8) execute_script "monitor" "monitor-system.sh" ;;
        9) list_categories ;;
        0) exit 0 ;;
        *) error "Opção inválida" ;;
    esac
}

# Função principal
main() {
    if [ $# -eq 0 ]; then
        show_menu
    elif [ $# -eq 1 ]; then
        if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
            echo "Uso: $0 [categoria] [script] [argumentos...]"
            echo ""
            echo "Exemplos:"
            echo "  $0                          # Menu interativo"
            echo "  $0 status                    # Listar scripts de status"
            echo "  $0 status status-system       # Executar status-system.sh"
            echo "  $0 stop stop-all             # Executar stop-all.sh"
            echo ""
            list_categories
        elif [ "$1" == "--list" ] || [ "$1" == "-l" ]; then
            list_categories
        else
            list_scripts "$1"
        fi
    elif [ $# -ge 2 ]; then
        category=$1
        script_name=$2
        shift 2
        execute_script "$category" "$script_name" "$@"
    fi
}

main "$@"
