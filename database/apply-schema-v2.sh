#!/bin/bash
# =============================================
# SmartSignage Pro - Schema Refatorado v2.0
# Script Bash para aplicar todos os scripts SQL
# =============================================

set -e  # Parar em caso de erro

# Re-exec no bash se script for invocado com /bin/sh (garante compatibilidade de arrays e declare)
if [ -z "${BASH_VERSION:-}" ]; then
    exec /bin/bash "$0" "$@"
fi

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
    
    # Garantir permissão de leitura do arquivo (evita "Permissão negada" em alguns ambientes)
    chmod a+r "$script_path" 2>/dev/null || true
    
    # Executar psql
    local psql_output
    if psql_output=$(PGPASSWORD="${PGPASSWORD}" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -f "$script_path" \
        -v ON_ERROR_STOP=1 \
        2>&1); then
        print_color "$GREEN" "   ✅ Sucesso!"
        # Mostrar warnings/notices se houver
        if echo "$psql_output" | grep -q "NOTICE\|WARNING"; then
            echo "$psql_output" | grep -E "NOTICE|WARNING" | head -5
        fi
        return 0
    else
        # Se erro for permission denied, tentar com sudo -u postgres (se disponível)
        if echo "$psql_output" | grep -qi "permission denied"; then
            if command -v sudo &> /dev/null; then
                print_color "$YELLOW" "   Permissão negada detectada — tentando executar como user postgres via sudo..."
                if sudo -u postgres psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$script_path" 2>&1; then
                    print_color "$GREEN" "   ✅ Sucesso (via sudo postgres)!"
                    return 0
                else
                    print_color "$RED" "   ❌ Falha ao executar como postgres via sudo"
                fi
            fi
        fi
        print_color "$RED" "   ❌ Erro ao executar script"
        echo "$psql_output" | tail -40
        return 1
    fi
}

# Pré-processar SQL para compatibilidade com versões do Postgres
# Substitui padrões não suportados como:
#   ALTER TABLE IF EXISTS tbl ADD CONSTRAINT IF NOT EXISTS name UNIQUE (cols);
# por:
#   CREATE UNIQUE INDEX IF NOT EXISTS name ON tbl (cols);
preprocess_sql() {
    local orig="$1"
    local tmp="$2"
    cp "$orig" "$tmp"

    # Regex simples que detecta o padrão na mesma linha ou em duas linhas
    # e converte para CREATE UNIQUE INDEX IF NOT EXISTS
    perl -0777 -pe 's/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([\w\.]+)\s*\n\s*ADD\s+CONSTRAINT\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w_]+)\s+UNIQUE\s*\(([^)]+)\)\s*;/CREATE UNIQUE INDEX IF NOT EXISTS $2 ON $1 ($3);/gis' -i "$tmp" || true

    # Também remover saídas inválidas deixadas por edições anteriores (linhas vazias com ALTER TABLE leftovers)
    sed -E -i.bak '/^ALTER TABLE IF EXISTS[[:space:]]*$/d' "$tmp" || true
    rm -f "${tmp}.bak" 2>/dev/null || true
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
    
    # Garantir permissões de leitura para todos os arquivos .sql no diretório (evita "Permissão negada")
    chmod a+r "$SCRIPT_DIR"/*.sql 2>/dev/null || true

    # Lista de scripts na ordem correta
    declare -a scripts=(
        "smartchannel-db-v2-refactored-part1-schema-setup.sql|Parte 1: Setup do Schema"
        "smartchannel-db-v2-refactored-part2-tables-base.sql|Parte 2: Tabelas Base"
        "smartchannel-db-v2-refactored-part3-tables-dependent.sql|Parte 3: Tabelas Dependentes"
        "smartchannel-db-v2-compat-campaign-status-cancelled.sql|Compat: chk_campaign_status com cancelled"
        "smartchannel-db-v2-refactored-part4-billing-contracts.sql|Parte 4: Billing e Contratos"
        "smartchannel-db-v2-compat-publisher-billing-overdue.sql|Compat: publisher_billing payment_status overdue"
        "smartchannel-db-v2-refactored-part5-tables-relationships.sql|Parte 5: Relacionamentos N:N"
        "smartchannel-db-v2-refactored-part6-tables-other.sql|Parte 6: Outras Tabelas"
        "smartchannel-db-v2-compat-remote-command-types.sql|Compat: tipos remote_commands (P1 sync)"
        "smartchannel-db-v2-compat-remote-screenshots.sql|Compat: remote_screenshots + player_settings"
        "seeds-publish-templates-vx4.sql|Seeds: Templates publicação rápida (Vx4)"
        "seeds-default-settings.sql|Seeds: Configurações Padrão do Sistema"
        "smartchannel-db-v2-refactored-part7-foreign-keys.sql|Parte 7: Foreign Keys"
        "smartchannel-db-v2-refactored-part8-indexes.sql|Parte 8: Índices"
        "smartchannel-db-v2-refactored-part9-triggers-functions.sql|Parte 9: Triggers e Funções"
        "smartchannel-db-v2-compat-totem-playlist-deactivate-status.sql|Compat: totem deactivate status invalidated"
        "smartchannel-db-v2-refactored-part10-views.sql|Parte 10: Views"
        "smartchannel-db-v2-refactored-part11-playlist-mix.sql|Parte 11: Playlist Mix (Tabelas)"
        "smartchannel-db-v2-refactored-part12-playlist-mix-functions.sql|Parte 12: Playlist Mix (Funções e Triggers)"
        "smartchannel-db-v2-refactored-part13-dispatcher-views.sql|Parte 13: Dispatcher Views"
        "smartchannel-db-v2-refactored-part14-reconcile.sql|Parte 14: Reconciliation (plan_publisher_access)"
        "smartchannel-db-v2-refactored-part15-contracts.sql|Parte 15: Contracts indexes, triggers e audit"
        "smartchannel-db-v2-refactored-part16-plans.sql|Parte 16: Plans (compatibilidade seeds)"
        "smartchannel-db-v2-refactored-part17-atomic-procedures.sql|Parte 17: Procedures atómicas (publisher/subscriber)"
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
        
        # Pré-processar script para maior compatibilidade e executar o temporário
        tmp_sql="$(mktemp /tmp/smartsignage-schema-XXXX.sql)"
        preprocess_sql "$script_path" "$tmp_sql"
        if execute_sql_script "$tmp_sql" "$description"; then
            success_count=$((success_count + 1))
        else
            fail_count=$((fail_count + 1))
            print_color "$RED" ""
            print_color "$RED" "❌ ERRO: Falha ao executar $script_file"
            print_color "$YELLOW" "   Parando execução..."
            rm -f "$tmp_sql"
            break
        fi
        rm -f "$tmp_sql"
        
        echo ""
    done

    # Pós-condição de identidade: nenhum Device ID persistido pode permanecer fora do formato canônico.
    if [ "$fail_count" -eq 0 ]; then
        noncanonical_device_ids=$(PGPASSWORD="${PGPASSWORD}" psql \
            -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
                SELECT
                    (SELECT COUNT(*) FROM totems
                     WHERE device_id IS NOT NULL
                       AND (device_id = '' OR device_id <> UPPER(TRIM(device_id)))) +
                    (SELECT COUNT(*) FROM smart_tvs
                     WHERE device_id IS NOT NULL
                       AND (device_id = '' OR device_id <> UPPER(TRIM(device_id)))) +
                    (SELECT COUNT(*) FROM device_tokens
                     WHERE device_id IS NOT NULL
                       AND (device_id = '' OR device_id <> UPPER(TRIM(device_id)))) +
                    (SELECT COUNT(*) FROM totems
                     WHERE jsonb_typeof(player_settings) = 'object'
                       AND player_settings ? 'deviceId'
                       AND (
                           NULLIF(TRIM(player_settings->>'deviceId'), '') IS NULL
                           OR player_settings->>'deviceId' <> UPPER(TRIM(player_settings->>'deviceId'))
                       ));
            " 2>/dev/null | tr -d '[:space:]')
        if [ "${noncanonical_device_ids:-1}" != "0" ]; then
            print_color "$RED" "❌ Validação falhou: ${noncanonical_device_ids:-desconhecido} Device IDs não canônicos"
            fail_count=$((fail_count + 1))
        else
            print_color "$GREEN" "✅ Device IDs normalizados em maiúsculas"
        fi
    fi
    
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

