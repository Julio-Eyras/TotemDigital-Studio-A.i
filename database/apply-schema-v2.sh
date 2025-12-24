#!/bin/bash
# =============================================
# SmartSignage Pro - Schema Refatorado v2.0
# Script Bash para aplicar todos os scripts SQL
# =============================================

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configurações padrão
DB_NAME="${DB_NAME:-smartchannel_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
SKIP_CONFIRM="${SKIP_CONFIRM:-false}"

# Função para output colorido
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Verificar se psql está disponível
check_psql() {
    if ! command -v psql &> /dev/null; then
        print_color "$RED" "❌ ERRO: psql não encontrado no PATH"
        print_color "$YELLOW" "   Instale o PostgreSQL Client ou adicione ao PATH"
        exit 1
    fi
}

# Executar script SQL
execute_sql_script() {
    local script_path=$1
    local description=$2
    
    if [ ! -f "$script_path" ]; then
        print_color "$RED" "❌ Arquivo não encontrado: $script_path"
        return 1
    fi
    
    print_color "$CYAN" "   Executando: $description..."
    
    # Executar psql
    if PGPASSWORD="${PGPASSWORD}" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -f "$script_path" \
        -v ON_ERROR_STOP=1 \
        -q; then
        print_color "$GREEN" "   ✅ Sucesso!"
        return 0
    else
        print_color "$RED" "   ❌ Erro ao executar script"
        return 1
    fi
}

# Script principal
main() {
    print_color "$CYAN" ""
    print_color "$CYAN" "========================================"
    print_color "$CYAN" " SmartSignage Pro - Schema v2.0"
    print_color "$CYAN" " Aplicação de Scripts SQL"
    print_color "$CYAN" "========================================"
    echo ""
    
    # Verificar psql
    check_psql
    
    # Obter diretório do script
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # Lista de scripts na ordem correta
    declare -a scripts=(
        "smartchannel-db-v2-refactored-part1-schema-setup.sql|Parte 1: Setup do Schema"
        "smartchannel-db-v2-refactored-part2-tables-base.sql|Parte 2: Tabelas Base"
        "smartchannel-db-v2-refactored-part3-tables-dependent.sql|Parte 3: Tabelas Dependentes"
        "smartchannel-db-v2-refactored-part4-billing-contracts.sql|Parte 4: Billing e Contratos"
        "smartchannel-db-v2-refactored-part5-tables-relationships.sql|Parte 5: Relacionamentos N:N"
        "smartchannel-db-v2-refactored-part6-tables-other.sql|Parte 6: Outras Tabelas"
        "smartchannel-db-v2-refactored-part7-foreign-keys.sql|Parte 7: Foreign Keys"
        "smartchannel-db-v2-refactored-part8-indexes.sql|Parte 8: Índices"
        "smartchannel-db-v2-refactored-part9-triggers-functions.sql|Parte 9: Triggers e Funções"
        "smartchannel-db-v2-refactored-part10-views.sql|Parte 10: Views"
        "smartchannel-db-v2-refactored-part11-playlist-mix.sql|Parte 11: Playlist Mix (Tabelas)"
        "smartchannel-db-v2-refactored-part12-playlist-mix-functions.sql|Parte 12: Playlist Mix (Funções e Triggers)"
        "seeds-playlist-mix.sql|Seeds: Dados Iniciais Playlist Mix"
    )
    
    # Mostrar configuração
    print_color "$YELLOW" "Configuração:"
    echo "  Host: $DB_HOST"
    echo "  Port: $DB_PORT"
    echo "  Database: $DB_NAME"
    echo "  Username: $DB_USER"
    echo ""
    
    # Confirmação
    if [ "$SKIP_CONFIRM" != "true" ]; then
        print_color "$YELLOW" "⚠️  ATENÇÃO: Este script irá recriar o banco de dados do zero!"
        print_color "$RED" "   Todos os dados existentes serão perdidos!"
        echo ""
        read -p "Deseja continuar? (S/N): " confirm
        if [[ ! "$confirm" =~ ^[Ss]$ ]]; then
            print_color "$YELLOW" "Operação cancelada."
            exit 0
        fi
    fi
    
    print_color "$CYAN" ""
    print_color "$CYAN" "Iniciando aplicação dos scripts..."
    echo ""
    
    success_count=0
    fail_count=0
    start_time=$(date +%s)
    
    # Executar cada script
    step=0
    for script_info in "${scripts[@]}"; do
        IFS='|' read -r script_file description <<< "$script_info"
        script_path="$SCRIPT_DIR/$script_file"
        step=$((step + 1))
        total=${#scripts[@]}
        
        print_color "$CYAN" "[$step/$total] $description"
        
        if execute_sql_script "$script_path" "$description"; then
            success_count=$((success_count + 1))
        else
            fail_count=$((fail_count + 1))
            print_color "$RED" ""
            print_color "$RED" "❌ ERRO: Falha ao executar $script_file"
            print_color "$YELLOW" "   Parando execução..."
            break
        fi
        
        echo ""
    done
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    # Resumo
    print_color "$CYAN" ""
    print_color "$CYAN" "========================================"
    print_color "$CYAN" " Resumo da Execução"
    print_color "$CYAN" "========================================"
    print_color "$GREEN" "  Scripts executados com sucesso: $success_count"
    if [ $fail_count -eq 0 ]; then
        print_color "$GREEN" "  Scripts com erro: $fail_count"
    else
        print_color "$RED" "  Scripts com erro: $fail_count"
    fi
    echo "  Tempo total: ${duration} segundos"
    echo ""
    
    if [ $fail_count -eq 0 ]; then
        print_color "$GREEN" "✅ Schema v2.0 aplicado com sucesso!"
        echo ""
        print_color "$YELLOW" "NOTA: Lembre-se de atualizar as Materialized Views periodicamente:"
        echo "  REFRESH MATERIALIZED VIEW mv_publisher_revenue_share_consolidated;"
        echo "  REFRESH MATERIALIZED VIEW mv_totem_executions_last_24h;"
        echo ""
        exit 0
    else
        print_color "$RED" "❌ Falha na aplicação do schema. Verifique os erros acima."
        exit 1
    fi
}

# Executar
main

