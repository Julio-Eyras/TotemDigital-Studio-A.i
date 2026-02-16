#!/bin/bash
# =============================================
# SmartSignage Pro - Migração de Caminhos de Mídia
# Migra arquivos de client-X para subscriber-X
# =============================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuração
UPLOADS_BASE_PATH="${UPLOADS_BASE_PATH:-/opt/smart-signage/public/assets/uploads}"
DRY_RUN="${DRY_RUN:-false}"

print_color() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

print_header() {
    print_color "$CYAN" ""
    print_color "$CYAN" "========================================"
    print_color "$CYAN" " Migração de Caminhos de Mídia"
    print_color "$CYAN" " client-X → subscriber-X"
    print_color "$CYAN" "========================================"
    echo ""
}

print_info() {
    print_color "$BLUE" "ℹ️  $@"
}

print_success() {
    print_color "$GREEN" "✅ $@"
}

print_warning() {
    print_color "$YELLOW" "⚠️  $@"
}

print_error() {
    print_color "$RED" "❌ $@"
}

# Verificar se o diretório existe
check_uploads_dir() {
    if [ ! -d "$UPLOADS_BASE_PATH" ]; then
        print_error "Diretório de uploads não encontrado: $UPLOADS_BASE_PATH"
        exit 1
    fi
    print_success "Diretório de uploads encontrado: $UPLOADS_BASE_PATH"
}

# Migrar arquivos de um diretório client-X para subscriber-X
migrate_client_dir() {
    local client_id=$1
    local client_dir="$UPLOADS_BASE_PATH/client-${client_id}"
    local subscriber_dir="$UPLOADS_BASE_PATH/subscriber-${client_id}"
    
    if [ ! -d "$client_dir" ]; then
        return 0  # Diretório não existe, pular
    fi
    
    print_info "Processando client-${client_id}..."
    
    # Criar diretório subscriber se não existir
    if [ "$DRY_RUN" = "false" ]; then
        mkdir -p "$subscriber_dir"
    else
        print_info "[DRY RUN] Criaria diretório: $subscriber_dir"
    fi
    
    # Migrar subdiretórios (medias, thumbnails, etc)
    local migrated=0
    local skipped=0
    local errors=0
    
    for subdir in "$client_dir"/*; do
        if [ -d "$subdir" ]; then
            local subdir_name=$(basename "$subdir")
            local target_subdir="$subscriber_dir/$subdir_name"
            
            if [ "$DRY_RUN" = "false" ]; then
                if [ -d "$target_subdir" ]; then
                    print_warning "  Diretório já existe: $target_subdir (mesclando arquivos)"
                    # Mover arquivos individuais para evitar sobrescrever diretórios
                    find "$subdir" -type f -exec mv {} "$target_subdir/" \; 2>/dev/null || true
                else
                    mv "$subdir" "$target_subdir"
                    print_success "  Migrado: $subdir_name"
                    migrated=$((migrated + 1))
                fi
            else
                print_info "[DRY RUN] Migraria: $subdir → $target_subdir"
                migrated=$((migrated + 1))
            fi
        elif [ -f "$subdir" ]; then
            # Arquivo solto no diretório client-X
            local filename=$(basename "$subdir")
            local target_file="$subscriber_dir/$filename"
            
            if [ "$DRY_RUN" = "false" ]; then
                if [ -f "$target_file" ]; then
                    print_warning "  Arquivo já existe: $filename (mantendo ambos)"
                    # Adicionar timestamp ao arquivo antigo
                    local timestamp=$(date +%s)
                    local new_name="${filename%.*}_${timestamp}.${filename##*.}"
                    mv "$subdir" "$subscriber_dir/$new_name"
                else
                    mv "$subdir" "$target_file"
                fi
                migrated=$((migrated + 1))
            else
                print_info "[DRY RUN] Migraria arquivo: $filename"
                migrated=$((migrated + 1))
            fi
        fi
    done
    
    # Remover diretório client-X se estiver vazio
    if [ "$DRY_RUN" = "false" ]; then
        if [ -z "$(ls -A "$client_dir" 2>/dev/null)" ]; then
            rmdir "$client_dir" 2>/dev/null && print_success "  Diretório client-${client_id} removido (vazio)"
        else
            print_warning "  Diretório client-${client_id} ainda contém arquivos (não removido)"
        fi
    fi
    
    if [ $migrated -gt 0 ]; then
        print_success "  Total migrado: $migrated item(s)"
    fi
}

# Atualizar caminhos no banco de dados
update_database_paths() {
    print_info "Atualizando caminhos no banco de dados..."
    
    # Verificar se psql está disponível
    if ! command -v psql &> /dev/null; then
        print_warning "psql não encontrado. Pulando atualização do banco de dados."
        print_info "Execute manualmente:"
        echo ""
        echo "UPDATE medias SET file_path = REPLACE(file_path, '/client-', '/subscriber-') WHERE file_path LIKE '%/client-%';"
        echo "UPDATE medias SET thumbnail_url = REPLACE(thumbnail_url, '/client-', '/subscriber-') WHERE thumbnail_url LIKE '%/client-%';"
        echo "UPDATE medias SET preview_url = REPLACE(preview_url, '/client-', '/subscriber-') WHERE preview_url LIKE '%/client-%';"
        echo ""
        return 0
    fi
    
    # Carregar variáveis de ambiente do .env se existir
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env | xargs)
    fi
    
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5432}"
    DB_NAME="${DB_NAME:-smartsignage}"
    DB_USER="${DB_USER:-smartsignage}"
    DB_PASS="${DB_PASS:-smartsignage123}"
    
    if [ -n "$DB_PASS" ]; then
        export PGPASSWORD="$DB_PASS"
    fi
    
    if [ "$DRY_RUN" = "false" ]; then
        print_info "Conectando ao banco de dados..."
        
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
-- Atualizar file_path
UPDATE medias 
SET file_path = REPLACE(file_path, '/client-', '/subscriber-') 
WHERE file_path LIKE '%/client-%';

-- Atualizar thumbnail_url
UPDATE medias 
SET thumbnail_url = REPLACE(thumbnail_url, '/client-', '/subscriber-') 
WHERE thumbnail_url LIKE '%/client-%';

-- Atualizar preview_url
UPDATE medias 
SET preview_url = REPLACE(preview_url, '/client-', '/subscriber-') 
WHERE preview_url LIKE '%/client-%';

-- Mostrar estatísticas
SELECT 
    COUNT(*) FILTER (WHERE file_path LIKE '%/client-%') as paths_ainda_client,
    COUNT(*) FILTER (WHERE file_path LIKE '%/subscriber-%') as paths_subscriber,
    COUNT(*) as total
FROM medias;
EOF
        
        print_success "Banco de dados atualizado"
    else
        print_info "[DRY RUN] Atualizaria caminhos no banco de dados"
    fi
}

# Função principal
main() {
    print_header
    
    print_info "Modo: $([ "$DRY_RUN" = "true" ] && echo "DRY RUN (simulação)" || echo "EXECUÇÃO REAL")"
    print_info "Diretório base: $UPLOADS_BASE_PATH"
    echo ""
    
    # Verificar diretório
    check_uploads_dir
    echo ""
    
    # Encontrar todos os diretórios client-X
    print_info "Procurando diretórios client-X..."
    local client_dirs=($(find "$UPLOADS_BASE_PATH" -maxdepth 1 -type d -name "client-*" 2>/dev/null | sort))
    
    if [ ${#client_dirs[@]} -eq 0 ]; then
        print_success "Nenhum diretório client-X encontrado. Migração não necessária."
        exit 0
    fi
    
    print_info "Encontrados ${#client_dirs[@]} diretório(s) client-X:"
    for dir in "${client_dirs[@]}"; do
        local client_id=$(basename "$dir" | sed 's/client-//')
        local file_count=$(find "$dir" -type f 2>/dev/null | wc -l)
        print_info "  - client-${client_id} ($file_count arquivo(s))"
    done
    echo ""
    
    # Confirmar execução
    if [ "$DRY_RUN" = "false" ]; then
        print_warning "ATENÇÃO: Esta operação irá mover arquivos e atualizar o banco de dados."
        read -p "Deseja continuar? (s/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Ss]$ ]]; then
            print_info "Operação cancelada pelo usuário."
            exit 0
        fi
        echo ""
    fi
    
    # Migrar cada diretório
    local total_migrated=0
    for dir in "${client_dirs[@]}"; do
        local client_id=$(basename "$dir" | sed 's/client-//')
        migrate_client_dir "$client_id"
        echo ""
    done
    
    # Atualizar banco de dados
    update_database_paths
    echo ""
    
    print_success "Migração concluída!"
    print_info "Verifique os logs acima para detalhes."
}

# Executar
main "$@"
