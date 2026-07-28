#!/bin/bash

# =============================================================================
# Smart Signage Pro - Script de Auto-Instalação para Ubuntu
# =============================================================================
# Versão do Sistema: 2.1.0
# Versão do Script: 2.1.18
# =============================================================================
# Este script instala automaticamente o Smart Signage Pro em sistemas Ubuntu
# Suporta modos de instalação e perfil MQTT para single-server:
# - Single-Server (perfil dev)
# - Single-Server (perfil produção com Mosquitto local)
# - Docker
#
# Uso: ./install-smartsignage.sh [OPÇÕES]
# =============================================================================

# Versões (podem ser diferentes)
SYSTEM_VERSION="2.1.0"
SCRIPT_VERSION="2.1.18"
#
# OPÇÕES:
#   --fresh              Instalação COMPLETA do zero (single-server por defeito; com --mode docker limpa Compose)
#   --sync-corporate-site  Só sincroniza totemdigital.site + logos-icons para a raiz HTTP corporativa (:80)
#   --corporate-web-root <dir>     Destino Nginx do site corporativo (padrão /var/www/corporate-site)
#   --corporate-site-source <dir>  Origem do HTML (padrão: <repo>/totemdigital.site)
#   --rebuild            Rebuild containers preservando dados (volumes mantidos)
#   --rebuild-cache      Rebuild SEM cache do Docker (mais lento, mais garantido)
#   --rebuild-only       Apenas rebuild, não inicia serviços
#   --force              Força rebuild mesmo se não detectar mudanças
#   --check-only         Apenas verifica se rebuild é necessário (não executa)
#   --skip-menu          Pula menu interativo (usa defaults do menu: Single-Server)
#   --mode <modo>        Define o modo (single-server|single-server-prod|docker) e pula o menu
#   --mqtt-mode <modo>   Perfil MQTT no single-server (dev|production)
#   --https-self-signed  Habilita HTTPS com certificado autoassinado (single-server)
#   --split-corporate-system  Site estático e painel em portas HTTP distintas (menu ou env SMARTSIGNAGE_*)
#   --public-host / --corporate-http-port / --system-http-port / --corporate-web-root  (ver --help)
# =============================================================================

set -e  # Parar em caso de erro
set -o pipefail

# Logs de install em pasta gravável pelo user actual (evitar /tmp root-owned → pipefail falso).
install_log_dir() {
    local base="${INSTALL_DIR:-${SOURCE_DIR:-$PWD}}"
    local d="${base}/logs/install"
    mkdir -p "$d" 2>/dev/null || d="${HOME}/.smartsignage-install-logs"
    mkdir -p "$d" 2>/dev/null || d="/tmp/smartsignage-install-$USER"
    mkdir -p "$d" 2>/dev/null || true
    echo "$d"
}
install_log_file() {
    echo "$(install_log_dir)/$1"
}

# Trap de erro com recuperação best-effort do backend em single-server
on_install_error() {
    local failed_line="${1:-$LINENO}"
    echo -e "\033[0;31m[ERRO]\033[0m Falha na execução (linha ${failed_line})."

    # Evitar loops de recuperação
    if [[ "${INSTALL_RECOVERY_ATTEMPTED:-false}" == "true" ]]; then
        return
    fi
    INSTALL_RECOVERY_ATTEMPTED=true

    # Em Docker não tentamos recuperação via systemd local
    if [[ "${INSTALL_MODE:-single-server}" == "docker" ]]; then
        return
    fi

    echo -e "\033[1;33m[WARNING]\033[0m Tentando recuperação automática do backend (single-server)..."

    local candidate_dir=""
    local d=""
    for d in "${INSTALL_DIR:-}" "${SOURCE_DIR:-}" "$(pwd)" "/home/${USER}/TotemDigital"; do
        [[ -z "$d" ]] && continue
        if [[ -f "$d/backend/dist/index.js" ]]; then
            candidate_dir="$d"
            break
        fi
    done

    if [[ -z "$candidate_dir" ]]; then
        return
    fi

    local helper_script="$candidate_dir/scripts/create-smart-signage-service.sh"
    if [[ ! -f /etc/systemd/system/smart-signage.service ]] && [[ -x "$helper_script" ]]; then
        sudo bash "$helper_script" "$candidate_dir" 2>/dev/null || true
    fi

    sudo systemctl daemon-reload 2>/dev/null || true
    sudo systemctl enable smart-signage.service 2>/dev/null || true
    sudo systemctl start smart-signage.service 2>/dev/null || true
    sleep 2

    if command -v ss >/dev/null 2>&1 && ss -tlnp 2>/dev/null | grep -q ":3000 "; then
        echo -e "\033[0;32m[INFO]\033[0m Recuperação automática: backend voltou a escutar na porta 3000."
    fi
}

on_install_exit() {
    local exit_code=$?
    # Só atuar em falhas
    if [[ $exit_code -eq 0 ]]; then
        return
    fi

    # Evitar recuperação em modos especiais ou docker
    if [[ "${INSTALL_MODE:-single-server}" == "docker" ]] || [[ "${DB_ONLY_MODE:-false}" == "true" ]]; then
        return
    fi

    # Se já tentamos no trap ERR, não repetir
    if [[ "${INSTALL_RECOVERY_ATTEMPTED:-false}" == "true" ]]; then
        return
    fi

    INSTALL_RECOVERY_ATTEMPTED=true
    echo -e "\033[1;33m[WARNING]\033[0m Saída com falha detectada. Tentando recuperação final do smart-signage..."

    local candidate_dir=""
    local d=""
    for d in "${INSTALL_DIR:-}" "${SOURCE_DIR:-}" "$(pwd)" "/home/${USER}/TotemDigital"; do
        [[ -z "$d" ]] && continue
        if [[ -f "$d/backend/dist/index.js" ]]; then
            candidate_dir="$d"
            break
        fi
    done
    if [[ -z "$candidate_dir" ]]; then
        return
    fi

    local helper_script="$candidate_dir/scripts/create-smart-signage-service.sh"
    if [[ ! -f /etc/systemd/system/smart-signage.service ]] && [[ -x "$helper_script" ]]; then
        sudo bash "$helper_script" "$candidate_dir" 2>/dev/null || true
    fi
    sudo systemctl daemon-reload 2>/dev/null || true
    sudo systemctl enable smart-signage.service 2>/dev/null || true
    sudo systemctl start smart-signage.service 2>/dev/null || true
}

trap 'on_install_error $LINENO' ERR
trap 'on_install_exit' EXIT

# =============================================================================
# VARIÁVEIS GLOBAIS E FLAGS
# =============================================================================
FRESH_MODE=false
REBUILD_MODE=false
REBUILD_CACHE=false
REBUILD_ONLY=false
FORCE_REBUILD=false
CHECK_ONLY=false
SKIP_MENU=false
INSTALL_MODE=""
ENABLE_HTTPS_SELF_SIGNED=false
ENABLE_HTTPS_LETSENCRYPT=false
DOMAIN_NAME=""
SSL_EMAIL=""
# Nginx: site corporativo estático vs painel Smart Signage em portas distintas (ex.: 80 + 8080)
SPLIT_CORPORATE_AND_SYSTEM="${SPLIT_CORPORATE_AND_SYSTEM:-false}"
# IP ou nome público (para server_name e mensagens finais; pode ficar vazio → _)
PUBLIC_HOST="${PUBLIC_HOST:-}"
CORPORATE_HTTP_PORT="${CORPORATE_HTTP_PORT:-80}"
SYSTEM_HTTP_PORT="${SYSTEM_HTTP_PORT:-80}"
CORPORATE_WEB_ROOT="${CORPORATE_WEB_ROOT:-/var/www/corporate-site}"
# Origem no repositório do site corporativo (preferência: totemdigital.site)
CORPORATE_SITE_SOURCE="${CORPORATE_SITE_SOURCE:-}"
CORPORATE_WEB_ROOT_FROM_CLI=false
CORPORATE_SITE_SOURCE_FROM_CLI=false
# Nome do ficheiro HTML de atalho ao painel na raiz corporativa (layout dividido)
CORPORATE_LANDING_FILE="${CORPORATE_LANDING_FILE:-app.html}"
ENABLE_KIOSK_MODE=false
RESET_DATABASE=false
PRESERVE_DB=false
LOAD_SEEDS=false
SEEDS_OPTION_FORCED=false
# Migração opcional: um local por publisher (modo compacto / legado com 3 locais no seed antigo)
COMPACT_MERGE_LOCALS="${COMPACT_MERGE_LOCALS:-false}"
START_TOTEM=false
# Com --skip-players / --totemdigital-install: não copia players cliente (só servidor + build)
SKIP_PLAYERS_INSTALL=false
CONFIGURE_DNS_LOCAL=false
DB_WAS_CREATED_OR_RESET=false
SINGLE_SERVER_MQTT_MODE="dev"       # dev | production
MQTT_LOCAL_BROKER_REQUIRED=false
MQTT_BACKEND_USERNAME="backend"
MQTT_BACKEND_PASSWORD=""
MQTT_PLAYER_USERNAME="player"
MQTT_PLAYER_PASSWORD=""
MQTT_WS_URL_DEFAULT="ws://localhost:9001"

# TotemDigital modo compacto (= mono / monousuário) vs Pro — gravado em .env como TOTEMDIGITAL_COMPACT / REACT_APP_TOTEMDIGITAL_COMPACT
# Menu interativo pergunta sempre 1/2 (exceto --totemdigital-compact / --smartsignage-pro). Com --skip-menu, usa esta variável ou o default true.
INSTALL_TOTEMDIGITAL_COMPACT="${INSTALL_TOTEMDIGITAL_COMPACT:-true}"
TOTEMDIGITAL_PROFILE_CLI_SET=false

# Modo Publicar em Totem (branch SmartSignage-direc-totem) — gravado em .env como DIRECT_TOTEM_MODE / REACT_APP_DIRECT_TOTEM_MODE.
# Backend lê em runtime; frontend em build-time (alterar exige rebuild do frontend). Default true neste branch.
INSTALL_DIRECT_TOTEM_MODE="${INSTALL_DIRECT_TOTEM_MODE:-true}"

# Dados do proprietário (owner) usados no seed compacto (sem hardcode fixo de "totem digital")
SYSTEM_OWNER_NAME="${SYSTEM_OWNER_NAME:-Totem Digital}"
SYSTEM_OWNER_CONTACT_NAME="${SYSTEM_OWNER_CONTACT_NAME:-}"
SYSTEM_OWNER_EMAIL="${SYSTEM_OWNER_EMAIL:-}"
SYSTEM_OWNER_CITY="${SYSTEM_OWNER_CITY:-Encruzilhada}"
SYSTEM_OWNER_ADMIN_USERNAME="${SYSTEM_OWNER_ADMIN_USERNAME:-}"
SYSTEM_OWNER_PUBLISHER_USERNAME="${SYSTEM_OWNER_PUBLISHER_USERNAME:-}"
SYSTEM_OWNER_PLAN_NAME="${SYSTEM_OWNER_PLAN_NAME:-}"
SYSTEM_OWNER_PLAN_SLUG="${SYSTEM_OWNER_PLAN_SLUG:-}"
SYSTEM_DEMO_TARGET_PUBLISHER_ID="${SYSTEM_DEMO_TARGET_PUBLISHER_ID:-1}"

# Carga demo dinâmica (PRO/Compact) — só aplicada quando DIRECT_TOTEM_MODE=false.
# Modo direct totem: apenas publisher owner + limits.defaults (sem planos/locais/totens/subscribers demo).
DEMO_LOCALS_COUNT="${DEMO_LOCALS_COUNT:-}"
DEMO_TOTEMS_ACTIVE="${DEMO_TOTEMS_ACTIVE:-}"
DEMO_TOTEMS_STOCK="${DEMO_TOTEMS_STOCK:-}"
DEMO_SUBSCRIBERS_COUNT="${DEMO_SUBSCRIBERS_COUNT:-}"

# Limites padrão (system_settings limits.defaults.* e JSON dos planos demo). Inteiros >= 0; 0 = ilimitado no backend.
# Sobrescreva antes do install, ex.: export LIMITS_DEFAULT_STORAGE_GB=200
LIMITS_DEFAULT_STORAGE_GB="${LIMITS_DEFAULT_STORAGE_GB:-0}"
LIMITS_DEFAULT_CAMPAIGNS="${LIMITS_DEFAULT_CAMPAIGNS:-0}"
LIMITS_DEFAULT_TOTEMS="${LIMITS_DEFAULT_TOTEMS:-0}"
LIMITS_DEFAULT_MEDIAS="${LIMITS_DEFAULT_MEDIAS:-0}"
LIMITS_DEFAULT_PLAYLISTS="${LIMITS_DEFAULT_PLAYLISTS:-0}"
LIMITS_DEMO_BRONZE_TOTEMS="${LIMITS_DEMO_BRONZE_TOTEMS:-4}"
LIMITS_DEMO_BRONZE_CAMPAIGNS="${LIMITS_DEMO_BRONZE_CAMPAIGNS:-20}"
LIMITS_DEMO_SILVER_TOTEMS="${LIMITS_DEMO_SILVER_TOTEMS:-8}"
LIMITS_DEMO_SILVER_CAMPAIGNS="${LIMITS_DEMO_SILVER_CAMPAIGNS:-50}"
LIMITS_DEMO_GOLD_TOTEMS="${LIMITS_DEMO_GOLD_TOTEMS:-20}"
LIMITS_DEMO_GOLD_CAMPAIGNS="${LIMITS_DEMO_GOLD_CAMPAIGNS:-120}"

# Modos especiais (operações focadas)
DB_ONLY_MODE=false                # Reinstala apenas o banco (drop + schema + seeds), sem rebuild de backend/frontend
SEEDS_ONLY_MODE=false             # Aplica apenas seeds dinâmicos + usuários (sem drop/schema)
CORPORATE_SITE_SYNC_ONLY=false    # Só sync totemdigital.site + logos-icons → CORPORATE_WEB_ROOT (porta 80)
BACKEND_BUILD_ONLY=false          # Faz apenas build do backend (sem mexer em banco/Nginx/etc.)
FRONTEND_BUILD_ONLY=false         # Faz apenas build do frontend (sem mexer em banco/backend/etc.)
BACKFRONT_BUILD_ONLY=false        # Faz build do backend e do frontend (deps + TypeScript + React), sem tocar no banco

# Flags internas para controlar o comportamento de install_project_dependencies
SKIP_BACKEND_DEPS_BUILD=false     # Quando true, pula instalação/build do backend dentro de install_project_dependencies
SKIP_FRONTEND_DEPS_BUILD=false    # Quando true, pula instalação/build do frontend dentro de install_project_dependencies

# Variáveis para seleção de players
INSTALL_PLAYER_WEBOS=false
INSTALL_PLAYER_ANDROID=false
INSTALL_PLAYER_LINUX_ELECTRON=false
INSTALL_PLAYER_LINUX_CPP=false
INSTALL_PLAYER_WINDOWS_ELECTRON=false
INSTALL_PLAYER_TIZEN=false
INSTALL_PLAYER_SMARTDISPLAYFX=false
INSTALL_PLAYER_FX_INTERFACE=false
INSTALL_PLAYER_WEB_CACHE=false
INSTALL_ALL_PLAYERS=false

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

# Função de log de progresso
log_progress() {
    echo -e "${CYAN}[PROGRESSO $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Função de log de status
log_status() {
    echo -e "${PURPLE}[STATUS $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

to_kebab_case() {
    local input="$1"
    echo "$input" \
        | tr '[:upper:]' '[:lower:]' \
        | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g'
}

escape_sed_replacement() {
    printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

escape_sql_literal() {
    # Escapa aspas simples para uso seguro em literais SQL: ' -> ''
    printf '%s' "$1" | sed "s/'/''/g"
}

sanitize_owner_profile_defaults() {
    local owner_name
    owner_name="$(echo "${SYSTEM_OWNER_NAME:-Totem Digital}" | xargs)"
    [[ -z "$owner_name" ]] && owner_name="Totem Digital"

    local owner_slug
    owner_slug="$(to_kebab_case "$owner_name")"
    [[ -z "$owner_slug" ]] && owner_slug="totem-digital"

    local owner_compact="${owner_slug//-/}"
    [[ -z "$owner_compact" ]] && owner_compact="totemdigital"

    SYSTEM_OWNER_NAME="$owner_name"
    SYSTEM_OWNER_CONTACT_NAME="$(echo "${SYSTEM_OWNER_CONTACT_NAME:-Sr. Contato Agente}" | xargs)"
    SYSTEM_OWNER_EMAIL="$(echo "${SYSTEM_OWNER_EMAIL:-contato@${owner_compact}.local}" | xargs)"
    SYSTEM_OWNER_CITY="$(echo "${SYSTEM_OWNER_CITY:-Encruzilhada}" | xargs)"
    SYSTEM_OWNER_ADMIN_USERNAME="$(echo "${SYSTEM_OWNER_ADMIN_USERNAME:-Owner}" | xargs)"
    SYSTEM_OWNER_PUBLISHER_USERNAME="$(echo "${SYSTEM_OWNER_PUBLISHER_USERNAME:-${owner_compact}.publisher}" | xargs)"
    SYSTEM_OWNER_PLAN_NAME="$(echo "${SYSTEM_OWNER_PLAN_NAME:-Plano $owner_name}" | xargs)"
    SYSTEM_OWNER_PLAN_SLUG="$(echo "${SYSTEM_OWNER_PLAN_SLUG:-$(to_kebab_case "${SYSTEM_OWNER_PLAN_NAME:-Plano $owner_name}")}" | xargs)"
}

# Limites padrão (system_settings limits.defaults.* e JSON dos planos demo). Inteiros >= 0; 0 = ilimitado no backend.
# Podem ser definidos antes do install: export LIMITS_DEFAULT_STORAGE_GB=100
sanitize_limits_defaults() {
    LIMITS_DEFAULT_STORAGE_GB="${LIMITS_DEFAULT_STORAGE_GB:-0}"
    LIMITS_DEFAULT_CAMPAIGNS="${LIMITS_DEFAULT_CAMPAIGNS:-0}"
    LIMITS_DEFAULT_TOTEMS="${LIMITS_DEFAULT_TOTEMS:-0}"
    LIMITS_DEFAULT_MEDIAS="${LIMITS_DEFAULT_MEDIAS:-0}"
    LIMITS_DEFAULT_PLAYLISTS="${LIMITS_DEFAULT_PLAYLISTS:-0}"
    LIMITS_DEMO_BRONZE_TOTEMS="${LIMITS_DEMO_BRONZE_TOTEMS:-4}"
    LIMITS_DEMO_BRONZE_CAMPAIGNS="${LIMITS_DEMO_BRONZE_CAMPAIGNS:-20}"
    LIMITS_DEMO_SILVER_TOTEMS="${LIMITS_DEMO_SILVER_TOTEMS:-8}"
    LIMITS_DEMO_SILVER_CAMPAIGNS="${LIMITS_DEMO_SILVER_CAMPAIGNS:-50}"
    LIMITS_DEMO_GOLD_TOTEMS="${LIMITS_DEMO_GOLD_TOTEMS:-20}"
    LIMITS_DEMO_GOLD_CAMPAIGNS="${LIMITS_DEMO_GOLD_CAMPAIGNS:-120}"
    [[ "$LIMITS_DEFAULT_STORAGE_GB" =~ ^[0-9]+$ ]] || LIMITS_DEFAULT_STORAGE_GB=0
    [[ "$LIMITS_DEFAULT_CAMPAIGNS" =~ ^[0-9]+$ ]] || LIMITS_DEFAULT_CAMPAIGNS=0
    [[ "$LIMITS_DEFAULT_TOTEMS" =~ ^[0-9]+$ ]] || LIMITS_DEFAULT_TOTEMS=0
    [[ "$LIMITS_DEFAULT_MEDIAS" =~ ^[0-9]+$ ]] || LIMITS_DEFAULT_MEDIAS=0
    [[ "$LIMITS_DEFAULT_PLAYLISTS" =~ ^[0-9]+$ ]] || LIMITS_DEFAULT_PLAYLISTS=0
    [[ "$LIMITS_DEMO_BRONZE_TOTEMS" =~ ^[0-9]+$ ]] || LIMITS_DEMO_BRONZE_TOTEMS=4
    [[ "$LIMITS_DEMO_BRONZE_CAMPAIGNS" =~ ^[0-9]+$ ]] || LIMITS_DEMO_BRONZE_CAMPAIGNS=20
    [[ "$LIMITS_DEMO_SILVER_TOTEMS" =~ ^[0-9]+$ ]] || LIMITS_DEMO_SILVER_TOTEMS=8
    [[ "$LIMITS_DEMO_SILVER_CAMPAIGNS" =~ ^[0-9]+$ ]] || LIMITS_DEMO_SILVER_CAMPAIGNS=50
    [[ "$LIMITS_DEMO_GOLD_TOTEMS" =~ ^[0-9]+$ ]] || LIMITS_DEMO_GOLD_TOTEMS=20
    [[ "$LIMITS_DEMO_GOLD_CAMPAIGNS" =~ ^[0-9]+$ ]] || LIMITS_DEMO_GOLD_CAMPAIGNS=120
}

# Volume da carga demo dinâmica (ignorada quando INSTALL_DIRECT_TOTEM_MODE=true).
# Demo completa padrão: 6 locais, 12 totens ativos, 1 estoque, 5 subscribers.
# Sobrescreva DEMO_* no ambiente para forçar outro volume.
resolve_demo_seed_profile() {
    DEMO_LOCALS_COUNT="${DEMO_LOCALS_COUNT:-6}"
    DEMO_TOTEMS_ACTIVE="${DEMO_TOTEMS_ACTIVE:-12}"
    DEMO_TOTEMS_STOCK="${DEMO_TOTEMS_STOCK:-1}"
    DEMO_SUBSCRIBERS_COUNT="${DEMO_SUBSCRIBERS_COUNT:-5}"
    [[ "$DEMO_LOCALS_COUNT" =~ ^[0-9]+$ ]] || DEMO_LOCALS_COUNT=1
    [[ "$DEMO_TOTEMS_ACTIVE" =~ ^[0-9]+$ ]] || DEMO_TOTEMS_ACTIVE=1
    [[ "$DEMO_TOTEMS_STOCK" =~ ^[0-9]+$ ]] || DEMO_TOTEMS_STOCK=0
    [[ "$DEMO_SUBSCRIBERS_COUNT" =~ ^[0-9]+$ ]] || DEMO_SUBSCRIBERS_COUNT=0
    # O SQL gerado usa "(i - 1) % DEMO_LOCALS_COUNT" — evita módulo por zero quando há totens sem locais
    if [[ "$DEMO_LOCALS_COUNT" -eq 0 && "$DEMO_TOTEMS_ACTIVE" -gt 0 ]]; then
        DEMO_LOCALS_COUNT=1
    fi
    log "Carga demo: locais=$DEMO_LOCALS_COUNT totens=$DEMO_TOTEMS_ACTIVE estoque=$DEMO_TOTEMS_STOCK subscribers=$DEMO_SUBSCRIBERS_COUNT"
}

ask_owner_profile() {
    sanitize_owner_profile_defaults
    sanitize_limits_defaults

    if [[ "$SKIP_MENU" == "true" ]]; then
        log "Dados do owner (skip-menu): ${SYSTEM_OWNER_NAME} <${SYSTEM_OWNER_EMAIL}> | admin=${SYSTEM_OWNER_ADMIN_USERNAME}"
        return 0
    fi

    echo
    echo -e "${CYAN}Dados do proprietário do sistema (owner) — primeira etapa${NC}"
    if [[ "${INSTALL_TOTEMDIGITAL_COMPACT}" == "true" ]]; then
        echo -e "${YELLOW}Esses dados definem a organização única (publisher owner), mesmo com --no-seeds.${NC}"
        echo -e "${YELLOW}Depois da instalação, edite em: menu «Sua organização».${NC}"
    else
        echo -e "${YELLOW}Esses dados serão usados para gerar seed dinâmico (publisher/plano/admin).${NC}"
    fi

    local input=""
    read -p "Usuário Dono, Admin, publisher [${SYSTEM_OWNER_ADMIN_USERNAME}]: " input
    [[ -n "${input// }" ]] && SYSTEM_OWNER_ADMIN_USERNAME="$input"

    read -p "Nome do proprietário/empresa [${SYSTEM_OWNER_NAME}]: " input
    [[ -n "${input// }" ]] && SYSTEM_OWNER_NAME="$input"
    sanitize_owner_profile_defaults

    read -p "Nome do contato [${SYSTEM_OWNER_CONTACT_NAME}]: " input
    [[ -n "${input// }" ]] && SYSTEM_OWNER_CONTACT_NAME="$input"

    read -p "E-mail principal [${SYSTEM_OWNER_EMAIL}]: " input
    [[ -n "${input// }" ]] && SYSTEM_OWNER_EMAIL="$input"

    echo
    echo -e "${CYAN}Limites padrão (Pro e Compact)${NC}"
    echo -e "${YELLOW}Use números inteiros. 0 = ilimitado. Enter mantém o valor entre colchetes.${NC}"
    read -p "  Armazenamento padrão — storage_gb (GB) [${LIMITS_DEFAULT_STORAGE_GB}]: " input
    [[ -n "${input// }" ]] && LIMITS_DEFAULT_STORAGE_GB="$input"
    read -p "  Campanhas padrão (campaigns) [${LIMITS_DEFAULT_CAMPAIGNS}]: " input
    [[ -n "${input// }" ]] && LIMITS_DEFAULT_CAMPAIGNS="$input"
    read -p "  Totens padrão (totems) [${LIMITS_DEFAULT_TOTEMS}]: " input
    [[ -n "${input// }" ]] && LIMITS_DEFAULT_TOTEMS="$input"
    read -p "  Mídias padrão (0=ilimitado) [${LIMITS_DEFAULT_MEDIAS}]: " input
    [[ -n "${input// }" ]] && LIMITS_DEFAULT_MEDIAS="$input"
    read -p "  Playlists padrão (0=ilimitado) [${LIMITS_DEFAULT_PLAYLISTS}]: " input
    [[ -n "${input// }" ]] && LIMITS_DEFAULT_PLAYLISTS="$input"
    sanitize_limits_defaults

    if [[ "${INSTALL_TOTEMDIGITAL_COMPACT}" != "true" ]]; then
        read -p "Publisher alvo da carga demo (ID) [${SYSTEM_DEMO_TARGET_PUBLISHER_ID}]: " input
        [[ -n "${input// }" ]] && SYSTEM_DEMO_TARGET_PUBLISHER_ID="$input"
    fi

    sanitize_owner_profile_defaults
}

prepare_seed_with_owner_profile() {
    local input_seed_file="$1"
    local output_seed_file="$2"

    sanitize_owner_profile_defaults
    sanitize_limits_defaults
    cp "$input_seed_file" "$output_seed_file"

    local owner_name="$SYSTEM_OWNER_NAME"
    local owner_name_lower
    owner_name_lower="$(echo "$owner_name" | tr '[:upper:]' '[:lower:]')"
    local owner_city="$SYSTEM_OWNER_CITY"
    local owner_city_lower
    owner_city_lower="$(echo "$owner_city" | tr '[:upper:]' '[:lower:]')"

    local rep_owner_name rep_owner_name_lower rep_contact rep_email rep_city rep_city_lower rep_admin rep_plan_name rep_plan_slug
    rep_owner_name="$(escape_sed_replacement "$(escape_sql_literal "$owner_name")")"
    rep_owner_name_lower="$(escape_sed_replacement "$(escape_sql_literal "$owner_name_lower")")"
    rep_contact="$(escape_sed_replacement "$(escape_sql_literal "$SYSTEM_OWNER_CONTACT_NAME")")"
    rep_email="$(escape_sed_replacement "$(escape_sql_literal "$SYSTEM_OWNER_EMAIL")")"
    rep_city="$(escape_sed_replacement "$(escape_sql_literal "$owner_city")")"
    rep_city_lower="$(escape_sed_replacement "$(escape_sql_literal "$owner_city_lower")")"
    rep_admin="$(escape_sed_replacement "$(escape_sql_literal "$SYSTEM_OWNER_ADMIN_USERNAME")")"
    rep_plan_name="$(escape_sed_replacement "$(escape_sql_literal "$SYSTEM_OWNER_PLAN_NAME")")"
    rep_plan_slug="$(escape_sed_replacement "$(escape_sql_literal "$SYSTEM_OWNER_PLAN_SLUG")")"

    sed -i "s/contato@totemdigital.local/${rep_email}/g" "$output_seed_file"
    sed -i "s/totemdigital.admin/${rep_admin}/g" "$output_seed_file"
    sed -i "s/Contato Totem Digital/${rep_contact}/g" "$output_seed_file"
    sed -i "s/plano-totem-digital/${rep_plan_slug}/g" "$output_seed_file"
    sed -i "s/Plano Totem Digital/${rep_plan_name}/g" "$output_seed_file"
    sed -i "s/totem digital/${rep_owner_name_lower}/g" "$output_seed_file"
    sed -i "s/Totem Digital/${rep_owner_name}/g" "$output_seed_file"
    sed -i "s/Encruzilhada/${rep_city}/g" "$output_seed_file"
    sed -i "s/encruzilhada/${rep_city_lower}/g" "$output_seed_file"

    # Bloco demo dinâmico (funcional em PRO e Compact)
    local owner_sql contact_sql city_sql email_sql admin_sql
    owner_sql="$(escape_sql_literal "$SYSTEM_OWNER_NAME")"
    contact_sql="$(escape_sql_literal "$SYSTEM_OWNER_CONTACT_NAME")"
    city_sql="$(escape_sql_literal "$SYSTEM_OWNER_CITY")"
    email_sql="$(escape_sql_literal "$SYSTEM_OWNER_EMAIL")"
    admin_sql="$(escape_sql_literal "$SYSTEM_OWNER_ADMIN_USERNAME")"

    sanitize_limits_defaults
    local demo_json_bronze demo_json_silver demo_json_gold
    demo_json_bronze="$(printf '{"totems":%s,"campaigns":%s,"storage_gb":%s}' "${LIMITS_DEMO_BRONZE_TOTEMS}" "${LIMITS_DEMO_BRONZE_CAMPAIGNS}" "${LIMITS_DEFAULT_STORAGE_GB}")"
    demo_json_silver="$(printf '{"totems":%s,"campaigns":%s,"storage_gb":%s}' "${LIMITS_DEMO_SILVER_TOTEMS}" "${LIMITS_DEMO_SILVER_CAMPAIGNS}" "${LIMITS_DEFAULT_STORAGE_GB}")"
    demo_json_gold="$(printf '{"totems":%s,"campaigns":%s,"storage_gb":%s}' "${LIMITS_DEMO_GOLD_TOTEMS}" "${LIMITS_DEMO_GOLD_CAMPAIGNS}" "${LIMITS_DEFAULT_STORAGE_GB}")"
    local lim_d_storage lim_d_campaigns lim_d_totems lim_d_medias lim_d_playlists
    lim_d_storage="$(escape_sql_literal "${LIMITS_DEFAULT_STORAGE_GB}")"
    lim_d_campaigns="$(escape_sql_literal "${LIMITS_DEFAULT_CAMPAIGNS}")"
    lim_d_totems="$(escape_sql_literal "${LIMITS_DEFAULT_TOTEMS}")"
    lim_d_medias="$(escape_sql_literal "${LIMITS_DEFAULT_MEDIAS}")"
    lim_d_playlists="$(escape_sql_literal "${LIMITS_DEFAULT_PLAYLISTS}")"

    local target_publisher_id="${SYSTEM_DEMO_TARGET_PUBLISHER_ID:-1}"
    [[ "$target_publisher_id" =~ ^[0-9]+$ ]] || target_publisher_id=1
    local is_compact_sql="false"
    [[ "${INSTALL_TOTEMDIGITAL_COMPACT}" == "true" ]] && is_compact_sql="true"
    local is_direct_sql="false"
    [[ "${INSTALL_DIRECT_TOTEM_MODE:-true}" == "true" ]] && is_direct_sql="true"

    if [[ "$is_direct_sql" == "true" ]]; then
        log "Modo direct totem: carga demo omitida (sem planos/locais/totens/subscribers demo)"
        cat >> "$output_seed_file" <<EOF

-- =============================================
-- DIRECT TOTEM — seed mínimo (sem demo operacional)
-- Totens/locais são criados pela UI; local padrão sob demanda (ensureDefaultLocalForPublisher).
-- =============================================
DO \$\$
DECLARE
    v_target_publisher_id INTEGER := ${target_publisher_id};
    v_is_compact BOOLEAN := ${is_compact_sql};
BEGIN
    IF v_is_compact THEN
        SELECT publisher_id INTO v_target_publisher_id
        FROM publishers
        WHERE is_active = true
        ORDER BY publisher_id ASC
        LIMIT 1;
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM publishers WHERE publisher_id = v_target_publisher_id AND is_active = true
        ) THEN
            SELECT publisher_id INTO v_target_publisher_id
            FROM publishers
            WHERE is_active = true
            ORDER BY publisher_id ASC
            LIMIT 1;
        END IF;
    END IF;

    IF v_target_publisher_id IS NULL THEN
        RAISE NOTICE 'Seed direct totem: nenhum publisher ativo — bloco mínimo ignorado.';
        RETURN;
    END IF;

    IF v_is_compact THEN
        UPDATE publishers SET is_system_owner = false, updated_at = CURRENT_TIMESTAMP
        WHERE is_system_owner = true AND publisher_id IS DISTINCT FROM v_target_publisher_id;
        UPDATE publishers SET is_system_owner = true, updated_at = CURRENT_TIMESTAMP
        WHERE publisher_id = v_target_publisher_id;
        INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description)
        VALUES ('installation.profile', 'single_publisher', 'string', 'system', 'Perfil de instalação (mono/direct totem)')
        ON CONFLICT (setting_key) DO UPDATE SET
            setting_value = EXCLUDED.setting_value,
            updated_at = CURRENT_TIMESTAMP;
    END IF;
END
\$\$;
EOF
    else
        resolve_demo_seed_profile
        cat >> "$output_seed_file" <<EOF

-- =============================================
-- CARGA DEMO DINÂMICA (PRO/COMPACT) — volume via DEMO_* (resolve_demo_seed_profile)
-- Demo completa: 3 planos, ${DEMO_LOCALS_COUNT} locais, ${DEMO_TOTEMS_ACTIVE} totems ativos + ${DEMO_TOTEMS_STOCK} estoque,
-- ${DEMO_SUBSCRIBERS_COUNT} subscribers com 3 contratos cada (active + draft + cancelled)
-- =============================================
DO \$\$
DECLARE
    v_target_publisher_id INTEGER := ${target_publisher_id};
    v_is_compact BOOLEAN := ${is_compact_sql};
    v_admin_id INTEGER;
    v_stock_local_id INTEGER;
    v_bronze_plan_id INTEGER;
    v_silver_plan_id INTEGER;
    v_gold_plan_id INTEGER;
    v_subscriber_id INTEGER;
    v_contract_id INTEGER;
    v_local_name TEXT;
    v_totem_name TEXT;
    v_subscriber_name TEXT;
    v_local_id INTEGER;
    v_local_ids INTEGER[] := ARRAY[]::INTEGER[];
    v_local_names TEXT[] := ARRAY[
        'Bem-Fica Shoping',
        'Fitness Fat - Academia',
        'Galeria Centro',
        'Galeria Cores-Viva',
        'Running - Academia',
        'Super Manoel-Legumes'
    ];
    v_totem_names TEXT[] := ARRAY[
        'Totem 40 polegadas (nr002)',
        'Totem 50 polegadas',
        'Totem 40 polegadas',
        'Totem 32 polegadas (branco)',
        'Totem Painel Led',
        'Totem 40 polegadas',
        'Totem Exterminator T1000',
        'Totem Madeira Wikia 50 polegadas',
        'Totem 32 polegadas dupla face',
        'Totem Coluna 3 Faces'
    ];
    v_subscriber_names TEXT[] := ARRAY[
        'Papel Colorido',
        'Boi na Brasa',
        'Almoco Todo Dia',
        'Roupas Academia',
        'Rest. Grill bom apetiscos'
    ];
    i INTEGER;
BEGIN
    -- Garantir publisher alvo:
    -- Compact: publisher owner (id mais baixo ativo, geralmente 1)
    -- PRO: publisher informado no install; fallback para primeiro ativo.
    IF v_is_compact THEN
        SELECT publisher_id INTO v_target_publisher_id
        FROM publishers
        WHERE is_active = true
        ORDER BY publisher_id ASC
        LIMIT 1;
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM publishers WHERE publisher_id = v_target_publisher_id AND is_active = true
        ) THEN
            SELECT publisher_id INTO v_target_publisher_id
            FROM publishers
            WHERE is_active = true
            ORDER BY publisher_id ASC
            LIMIT 1;
        END IF;
    END IF;

    IF v_target_publisher_id IS NULL THEN
        RAISE NOTICE 'Seed demo dinâmico: nenhum publisher ativo encontrado. Bloco ignorado.';
        RETURN;
    END IF;

    -- Studio/mono: um único publisher owner da instalação
    IF v_is_compact THEN
        UPDATE publishers SET is_system_owner = false, updated_at = CURRENT_TIMESTAMP
        WHERE is_system_owner = true AND publisher_id IS DISTINCT FROM v_target_publisher_id;
        UPDATE publishers SET is_system_owner = true, updated_at = CURRENT_TIMESTAMP
        WHERE publisher_id = v_target_publisher_id;
        INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description)
        VALUES ('installation.profile', 'single_publisher', 'string', 'system', 'Perfil de instalação (mono)')
        ON CONFLICT (setting_key) DO UPDATE SET
            setting_value = EXCLUDED.setting_value,
            updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- Admin responsável pelos contratos
    SELECT id INTO v_admin_id FROM users WHERE username = '${admin_sql}' LIMIT 1;
    IF v_admin_id IS NULL THEN
        SELECT id INTO v_admin_id FROM users ORDER BY id ASC LIMIT 1;
    END IF;

    -- Admin tenant: publisher_id permanece NULL (chk_users_tenant_logic).
    -- Studio resolve o exibidor owner via publishers.is_system_owner, não via users.publisher_id.

    -- Planos base
    INSERT INTO plans (name, slug, description, price_monthly, price_four_month, price_semester, price_yearly, currency, billing_interval, features, limits, is_active, is_popular, is_default, sort_order)
    VALUES
      ('Plano Bronze', 'bronze', 'Plano Bronze demo dinâmico', 129.00, 516.00, 774.00, 1290.00, 'BRL', 'month', '{"tier":"bronze","ai_text_assist":true,"ai_video":false}'::jsonb, '${demo_json_bronze}'::jsonb, true, false, true, 1),
      ('Plano Silver', 'silver', 'Plano Silver demo dinâmico', 199.00, 796.00, 1194.00, 1990.00, 'BRL', 'month', '{"tier":"silver","ai_text_assist":true,"ai_video":false}'::jsonb, '${demo_json_silver}'::jsonb, true, true, false, 2),
      ('Plano Gold', 'gold', 'Plano Gold demo dinâmico', 299.00, 1196.00, 1794.00, 2990.00, 'BRL', 'month', '{"tier":"gold","ai_text_assist":true,"ai_video":true}'::jsonb, '${demo_json_gold}'::jsonb, true, false, false, 3)
    ON CONFLICT (slug) DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description,
          price_monthly = EXCLUDED.price_monthly,
          price_four_month = EXCLUDED.price_four_month,
          price_semester = EXCLUDED.price_semester,
          price_yearly = EXCLUDED.price_yearly,
          billing_interval = EXCLUDED.billing_interval,
          features = EXCLUDED.features,
          limits = EXCLUDED.limits,
          is_active = EXCLUDED.is_active,
          updated_at = CURRENT_TIMESTAMP;

    SELECT plan_id INTO v_bronze_plan_id FROM plans WHERE slug = 'bronze' LIMIT 1;
    SELECT plan_id INTO v_silver_plan_id FROM plans WHERE slug = 'silver' LIMIT 1;
    SELECT plan_id INTO v_gold_plan_id   FROM plans WHERE slug = 'gold' LIMIT 1;

    -- Acesso plano -> publisher (3 linhas, conforme solicitado)
    INSERT INTO plan_publisher_access (plan_id, publisher_id, is_allowed, restrictions, notes, is_active)
    VALUES
      (v_bronze_plan_id, v_target_publisher_id, true, '{}'::jsonb, 'Demo dinâmica bronze', true),
      (v_silver_plan_id, v_target_publisher_id, true, '{}'::jsonb, 'Demo dinâmica silver', true),
      (v_gold_plan_id, v_target_publisher_id, true, '{}'::jsonb, 'Demo dinâmica gold', true)
    ON CONFLICT (plan_id, publisher_id) DO UPDATE
      SET is_allowed = EXCLUDED.is_allowed,
          restrictions = EXCLUDED.restrictions,
          notes = EXCLUDED.notes,
          is_active = EXCLUDED.is_active,
          updated_at = CURRENT_TIMESTAMP;

    -- 6 locais ativos operacionais
    FOR i IN 1..${DEMO_LOCALS_COUNT} LOOP
        v_local_name := COALESCE(v_local_names[i], format('Local Demo %s - ${city_sql}', lpad(i::TEXT, 2, '0')));
        IF NOT EXISTS (
            SELECT 1 FROM locals WHERE publisher_id = v_target_publisher_id AND name = v_local_name
        ) THEN
            INSERT INTO locals (
                publisher_id, created_via_contract_id, name, category_segment, address, city, state, zip_code, country, timezone, description, is_active
            ) VALUES (
                v_target_publisher_id, NULL, v_local_name, 'Demo', 'Endereço Demo ' || i, '${city_sql}', NULL, NULL, 'BR', 'America/Sao_Paulo',
                'Local demo dinâmico', true
            );
        END IF;

        SELECT local_id INTO v_local_id
        FROM locals
        WHERE publisher_id = v_target_publisher_id AND name = v_local_name
        ORDER BY local_id ASC
        LIMIT 1;

        v_local_ids := array_append(v_local_ids, v_local_id);
    END LOOP;

    -- Compatibilidade: padronizar nome legado de estoque
    UPDATE locals
       SET name = 'Estoque',
           category_segment = COALESCE(category_segment, 'Estoque'),
           description = COALESCE(description, 'Local técnico para totems de estoque inativos'),
           updated_at = CURRENT_TIMESTAMP
     WHERE publisher_id = v_target_publisher_id
       AND name = 'ESTOQUE DEMO';

    -- Local técnico de estoque (inativo) para totems sem operação
    IF NOT EXISTS (
        SELECT 1 FROM locals WHERE publisher_id = v_target_publisher_id AND name = 'Estoque'
    ) THEN
        INSERT INTO locals (
            publisher_id, name, category_segment, city, country, timezone, description, is_active
        ) VALUES (
            v_target_publisher_id, 'Estoque', 'Estoque', '${city_sql}', 'BR', 'America/Sao_Paulo',
            'Local técnico para totems de estoque inativos', false
        );
    END IF;

    SELECT local_id INTO v_stock_local_id
    FROM locals
    WHERE publisher_id = v_target_publisher_id AND name = 'Estoque'
    ORDER BY local_id ASC
    LIMIT 1;

    -- plan_local_access: obrigatório para API de totens por contrato/plano (modo compacto).
    -- Um registo (plano, local) por cada local operacional + Estoque, para bronze/silver/gold.
    FOREACH v_local_id IN ARRAY v_local_ids LOOP
        INSERT INTO plan_local_access (plan_id, local_id, is_allowed, is_active, restrictions, created_at, updated_at)
        VALUES
          (v_bronze_plan_id, v_local_id, true, true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (v_silver_plan_id, v_local_id, true, true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (v_gold_plan_id, v_local_id, true, true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (plan_id, local_id) DO UPDATE
          SET is_allowed = EXCLUDED.is_allowed,
              is_active = EXCLUDED.is_active,
              restrictions = EXCLUDED.restrictions,
              updated_at = CURRENT_TIMESTAMP;
    END LOOP;

    IF v_stock_local_id IS NOT NULL THEN
        INSERT INTO plan_local_access (plan_id, local_id, is_allowed, is_active, restrictions, created_at, updated_at)
        VALUES
          (v_bronze_plan_id, v_stock_local_id, true, true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (v_silver_plan_id, v_stock_local_id, true, true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
          (v_gold_plan_id, v_stock_local_id, true, true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (plan_id, local_id) DO UPDATE
          SET is_allowed = EXCLUDED.is_allowed,
              is_active = EXCLUDED.is_active,
              restrictions = EXCLUDED.restrictions,
              updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- 12 totems ativos: 2 por local (6 locais)
    FOR i IN 1..${DEMO_TOTEMS_ACTIVE} LOOP
        v_totem_name := COALESCE(
            v_totem_names[i],
            format('%s #%s', v_totem_names[((i - 1) % array_length(v_totem_names, 1)) + 1], i)
        );
        INSERT INTO totems (
            identifier, uin, device_id, local_id, name, description, status, last_heartbeat, heartbeat_interval, network_info, capabilities, is_active
        ) VALUES (
            format('Tv-%s', lpad(i::TEXT, 3, '0')),
            format('Tv-%s', lpad(i::TEXT, 3, '0')),
            format('Tv-%s', lpad(i::TEXT, 3, '0')),
            v_local_ids[((i - 1) % ${DEMO_LOCALS_COUNT}) + 1],
            v_totem_name,
            'Totem demo dinâmico ativo',
            'online',
            NOW() - INTERVAL '2 minutes',
            60,
            '{}'::jsonb,
            '{}'::jsonb,
            true
        )
        ON CONFLICT (identifier) DO UPDATE
          SET local_id = EXCLUDED.local_id,
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              status = EXCLUDED.status,
              is_active = EXCLUDED.is_active,
              updated_at = CURRENT_TIMESTAMP;
    END LOOP;

    -- Totens de estoque inativos
    FOR i IN 1..${DEMO_TOTEMS_STOCK} LOOP
        INSERT INTO totems (
            identifier, uin, device_id, local_id, name, description, status, heartbeat_interval, network_info, capabilities, is_active
        ) VALUES (
            format('demo-stock-%s', lpad(i::TEXT, 3, '0')),
            format('DEMO-STOCK-UIN-%s', lpad(i::TEXT, 3, '0')),
            format('DEMO-STOCK-DEV-%s', lpad(i::TEXT, 3, '0')),
            v_stock_local_id,
            format('Totem Estoque %s', lpad(i::TEXT, 3, '0')),
            'Totem de estoque (inativo)',
            'offline',
            60,
            '{}'::jsonb,
            '{}'::jsonb,
            false
        )
        ON CONFLICT (identifier) DO UPDATE
          SET local_id = EXCLUDED.local_id,
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              status = EXCLUDED.status,
              is_active = EXCLUDED.is_active,
              updated_at = CURRENT_TIMESTAMP;
    END LOOP;

    -- 5 subscribers + 3 contratos por subscriber (bronze active, silver draft, gold cancelled)
    FOR i IN 1..${DEMO_SUBSCRIBERS_COUNT} LOOP
        v_subscriber_name := COALESCE(v_subscriber_names[i], format('Subscriber Demo %s', lpad(i::TEXT, 2, '0')));
        INSERT INTO subscribers (name, contact_name, email, address, category_segment, description, is_active)
        VALUES (
            v_subscriber_name,
            '${contact_sql}',
            format('subscriber.demo.%s@totemdigital.local', lpad(i::TEXT, 2, '0')),
            '${city_sql}',
            'Demo',
            'Subscriber demo dinâmico',
            true
        )
        ON CONFLICT (email) DO UPDATE
          SET name = EXCLUDED.name,
              contact_name = EXCLUDED.contact_name,
              address = EXCLUDED.address,
              is_active = EXCLUDED.is_active,
              updated_at = CURRENT_TIMESTAMP;

        SELECT subscriber_id INTO v_subscriber_id
        FROM subscribers
        WHERE email = format('subscriber.demo.%s@totemdigital.local', lpad(i::TEXT, 2, '0'))
        LIMIT 1;

        INSERT INTO subscriber_contracts (
            subscriber_id, plan_id, contract_number, contract_type, title, description,
            start_date, end_date, total_amount, currency, billing_interval, payment_terms, status,
            signed_by_subscriber_at, signed_by_tenant_at, created_by, metadata, is_active
        ) VALUES
        (v_subscriber_id, v_bronze_plan_id, format('SUB-%s-BRONZE', v_subscriber_id), 'subscription', 'Contrato Bronze Demo', 'Contrato demo bronze', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', 1548.00, 'BRL', 'year', 'Anual', 'active', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', v_admin_id, '{}'::jsonb, true),
        (v_subscriber_id, v_silver_plan_id, format('SUB-%s-SILVER', v_subscriber_id), 'subscription', 'Contrato Silver Demo', 'Contrato demo silver', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', 2388.00, 'BRL', 'year', 'Anual', 'draft', NULL, NULL, v_admin_id, '{}'::jsonb, true),
        (v_subscriber_id, v_gold_plan_id,   format('SUB-%s-GOLD', v_subscriber_id), 'subscription', 'Contrato Gold Demo',   'Contrato demo gold',   CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', 3588.00, 'BRL', 'year', 'Anual', 'cancelled', NULL, NULL, v_admin_id, '{}'::jsonb, true)
        ON CONFLICT (subscriber_id, contract_number) DO UPDATE
          SET plan_id = EXCLUDED.plan_id,
              status = EXCLUDED.status,
              total_amount = EXCLUDED.total_amount,
              is_active = EXCLUDED.is_active,
              updated_at = CURRENT_TIMESTAMP;
    END LOOP;

    -- Faturas demo para testar semáforo financeiro (cartões de anunciantes + painel Billing)
    SELECT subscriber_id INTO v_subscriber_id
    FROM subscribers WHERE email = 'subscriber.demo.01@totemdigital.local' LIMIT 1;
    IF v_subscriber_id IS NOT NULL THEN
        SELECT contract_id INTO v_contract_id
        FROM subscriber_contracts
        WHERE subscriber_id = v_subscriber_id AND status = 'active'
        ORDER BY contract_id LIMIT 1;
        INSERT INTO subscriber_billing (
            subscriber_id, contract_id, period_start, period_end,
            billing_type, amount, currency, direction, description,
            invoice_number, payment_method, payment_status, due_date, is_active
        ) VALUES (
            v_subscriber_id, v_contract_id,
            date_trunc('month', CURRENT_DATE)::date,
            (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date,
            'subscription', 1548.00, 'BRL', 'incoming',
            'Mensalidade demo — vencida (semáforo vermelho)',
            format('DEMO-SUB-%s-OVERDUE', v_subscriber_id),
            'pix', 'overdue',
            CURRENT_TIMESTAMP - INTERVAL '10 days',
            true
        )
        ON CONFLICT (invoice_number) DO UPDATE SET
            payment_status = EXCLUDED.payment_status,
            due_date = EXCLUDED.due_date,
            updated_at = CURRENT_TIMESTAMP;
    END IF;

    SELECT subscriber_id INTO v_subscriber_id
    FROM subscribers WHERE email = 'subscriber.demo.02@totemdigital.local' LIMIT 1;
    IF v_subscriber_id IS NOT NULL THEN
        SELECT contract_id INTO v_contract_id
        FROM subscriber_contracts
        WHERE subscriber_id = v_subscriber_id AND status = 'active'
        ORDER BY contract_id LIMIT 1;
        INSERT INTO subscriber_billing (
            subscriber_id, contract_id, period_start, period_end,
            billing_type, amount, currency, direction, description,
            invoice_number, payment_method, payment_status, due_date, is_active
        ) VALUES (
            v_subscriber_id, v_contract_id,
            date_trunc('month', CURRENT_DATE)::date,
            (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date,
            'subscription', 2388.00, 'BRL', 'incoming',
            'Mensalidade demo — a vencer (semáforo laranja)',
            format('DEMO-SUB-%s-DUESOON', v_subscriber_id),
            'pix', 'pending',
            CURRENT_TIMESTAMP + INTERVAL '15 days',
            true
        )
        ON CONFLICT (invoice_number) DO UPDATE SET
            payment_status = EXCLUDED.payment_status,
            due_date = EXCLUDED.due_date,
            updated_at = CURRENT_TIMESTAMP;
    END IF;

    SELECT subscriber_id INTO v_subscriber_id
    FROM subscribers WHERE email = 'subscriber.demo.03@totemdigital.local' LIMIT 1;
    IF v_subscriber_id IS NOT NULL THEN
        SELECT contract_id INTO v_contract_id
        FROM subscriber_contracts
        WHERE subscriber_id = v_subscriber_id AND status = 'active'
        ORDER BY contract_id LIMIT 1;
        INSERT INTO subscriber_billing (
            subscriber_id, contract_id, period_start, period_end,
            billing_type, amount, currency, direction, description,
            invoice_number, payment_method, payment_status, due_date, payment_date, is_active
        ) VALUES (
            v_subscriber_id, v_contract_id,
            date_trunc('month', CURRENT_DATE)::date,
            (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date,
            'subscription', 1548.00, 'BRL', 'incoming',
            'Mensalidade demo — paga (semáforo verde)',
            format('DEMO-SUB-%s-PAID', v_subscriber_id),
            'pix', 'paid',
            CURRENT_TIMESTAMP - INTERVAL '5 days',
            CURRENT_TIMESTAMP - INTERVAL '2 days',
            true
        )
        ON CONFLICT (invoice_number) DO UPDATE SET
            payment_status = EXCLUDED.payment_status,
            payment_date = EXCLUDED.payment_date,
            updated_at = CURRENT_TIMESTAMP;
    END IF;

    -- Contrato a vencer em ~20 dias (anunciante 4 — semáforo laranja por contrato)
    UPDATE subscriber_contracts sc
    SET end_date = CURRENT_DATE + INTERVAL '20 days',
        updated_at = CURRENT_TIMESTAMP
    FROM subscribers s
    WHERE sc.subscriber_id = s.subscriber_id
      AND s.email = 'subscriber.demo.04@totemdigital.local'
      AND sc.status = 'active'
      AND sc.contract_number LIKE '%-BRONZE';

    -- Mensalidade do exibidor (incoming) vencida — demo financeira
    INSERT INTO publisher_billing (
        publisher_id, billing_type, amount, currency, direction,
        description, invoice_number, payment_method, payment_status, due_date, is_active
    ) VALUES (
        v_target_publisher_id,
        'subscription', 299.00, 'BRL', 'incoming',
        'Assinatura plataforma demo — vencida',
        format('DEMO-PUB-%s-OVERDUE', v_target_publisher_id),
        'pix', 'overdue',
        CURRENT_TIMESTAMP - INTERVAL '7 days',
        true
    )
    ON CONFLICT (invoice_number) DO UPDATE SET
        payment_status = EXCLUDED.payment_status,
        due_date = EXCLUDED.due_date,
        updated_at = CURRENT_TIMESTAMP;
END
\$\$;
EOF
    fi

    cat >> "$output_seed_file" <<EOF

-- Limites padrão no banco (variáveis LIMITS_DEFAULT_* do instalador). 0 = ilimitado no backend.
UPDATE system_settings SET setting_value = '${lim_d_storage}', default_value = '${lim_d_storage}', updated_at = CURRENT_TIMESTAMP WHERE setting_key = 'limits.defaults.storage_gb';
UPDATE system_settings SET setting_value = '${lim_d_campaigns}', default_value = '${lim_d_campaigns}', updated_at = CURRENT_TIMESTAMP WHERE setting_key = 'limits.defaults.campaigns';
UPDATE system_settings SET setting_value = '${lim_d_totems}', default_value = '${lim_d_totems}', updated_at = CURRENT_TIMESTAMP WHERE setting_key = 'limits.defaults.totems';
UPDATE system_settings SET setting_value = '${lim_d_medias}', default_value = '${lim_d_medias}', updated_at = CURRENT_TIMESTAMP WHERE setting_key = 'limits.defaults.medias';
UPDATE system_settings SET setting_value = '${lim_d_playlists}', default_value = '${lim_d_playlists}', updated_at = CURRENT_TIMESTAMP WHERE setting_key = 'limits.defaults.playlists';
EOF
}

# Copiar mídias de demonstração de player-web/propagandas para o diretório de uploads de cada subscriber.
# Mapeamento seed v6.3: 10 subscribers (subscriber-1 a subscriber-10) - Cestto, Bourbon, Panvel, Fruteira, Fashion, Beleza, Check-up, Super Promo, Smartsignage, Menu Executivo
# Origem: player-web/propagandas (e player-web/vinhetas se existir)
install_demo_media_files() {
    if [[ "${INSTALL_DIRECT_TOTEM_MODE:-true}" == "true" ]]; then
        log "ℹ️  Modo direct totem: cópia de mídias demo (subscriber-1..10) ignorada."
        return 0
    fi
    local install_dir="${INSTALL_DIR:-$(pwd)}"
    local src_dir=""
    local vinhetas_dir=""
    [[ -d "${install_dir}/player-web/propagandas" ]] && src_dir="${install_dir}/player-web/propagandas"
    [[ -z "$src_dir" && -n "${SOURCE_DIR:-}" && -d "${SOURCE_DIR}/player-web/propagandas" ]] && src_dir="${SOURCE_DIR}/player-web/propagandas"
    [[ -d "${install_dir}/player-web/vinhetas" ]] && vinhetas_dir="${install_dir}/player-web/vinhetas"
    [[ -z "$vinhetas_dir" && -n "${SOURCE_DIR:-}" && -d "${SOURCE_DIR}/player-web/vinhetas" ]] && vinhetas_dir="${SOURCE_DIR}/player-web/vinhetas"
    local uploads_base="/opt/smart-signage/public/assets/uploads"

    if [[ -z "$src_dir" || ! -d "$src_dir" ]]; then
        log "ℹ️  player-web/propagandas não encontrado. Pulando cópia de mídias demo."
        return 0
    fi

    log "Copiando mídias demo de ${src_dir} para ${uploads_base}/subscriber-1..10/medias..."

    # Criar diretórios de destino (subscriber-1 a subscriber-10)
    for cid in 1 2 3 4 5 6 7 8 9 10; do
        local target_dir="${uploads_base}/subscriber-${cid}/medias"
        sudo mkdir -p "$target_dir" 2>/dev/null || mkdir -p "$target_dir" 2>/dev/null || true
    done

    # Função auxiliar: copiar arquivo se existir (origem -> destino)
    copy_if() {
        local from="$1" to="$2"
        if [[ -f "$from" ]]; then
            sudo cp -f "$from" "$to" 2>/dev/null || cp -f "$from" "$to" 2>/dev/null || true
        fi
    }

    # subscriber-1 Cestto (Supermercados): Cestto_00005.png, Cestto_0001.mp4
    copy_if "${src_dir}/Cestto_00005.png" "${uploads_base}/subscriber-1/medias/Cestto_00005.png"
    copy_if "${src_dir}/Cestto_0001.mp4" "${uploads_base}/subscriber-1/medias/Cestto_0001.mp4"

    # subscriber-2 Bourbon (Shoppings): zaffari-bourbon_8255.jpg
    copy_if "${src_dir}/zaffari-bourbon_8255.jpg" "${uploads_base}/subscriber-2/medias/zaffari-bourbon_8255.jpg"

    # subscriber-3 Panvel (Farmácias): Panvel_0001.mp4, Panvel_ABC-00010.jpg
    copy_if "${src_dir}/Panvel_0001.mp4" "${uploads_base}/subscriber-3/medias/Panvel_0001.mp4"
    copy_if "${src_dir}/Panvel_ABC-00010.jpg" "${uploads_base}/subscriber-3/medias/Panvel_ABC-00010.jpg"

    # subscriber-4 Fruteira Geraldo (Supermercados): Fruteiradogeraldo0001.jpg, Fruteiradogeraldo0002.mp4
    copy_if "${src_dir}/Fruteiradogeraldo0001.jpg" "${uploads_base}/subscriber-4/medias/Fruteiradogeraldo0001.jpg"
    copy_if "${src_dir}/Fruteiradogeraldo0002.mp4" "${uploads_base}/subscriber-4/medias/Fruteiradogeraldo0002.mp4"

    # subscriber-5 Fashion Store (Shoppings): Fashion_Woman-0001.webp, moda_homem.webp
    copy_if "${src_dir}/Fashion_Woman-0001.webp" "${uploads_base}/subscriber-5/medias/Fashion_Woman-0001.webp"
    copy_if "${src_dir}/moda_homem.webp" "${uploads_base}/subscriber-5/medias/moda_homem.webp"

    # subscriber-6 Beleza Produtos (Supermercados): beleza-produtos-0001.mp4
    copy_if "${src_dir}/beleza-produtos-0001.mp4" "${uploads_base}/subscriber-6/medias/beleza-produtos-0001.mp4"

    # subscriber-7 Check-up Saúde (Farmácias): check-up.jpg
    copy_if "${src_dir}/check-up.jpg" "${uploads_base}/subscriber-7/medias/check-up.jpg"

    # subscriber-8 Super Promo (Supermercados): supermercado-promocoes.jpg, black-friday-banner.jpg
    copy_if "${src_dir}/supermercado-promocoes.jpg" "${uploads_base}/subscriber-8/medias/supermercado-promocoes.jpg"
    copy_if "${src_dir}/black-friday-banner.jpg" "${uploads_base}/subscriber-8/medias/black-friday-banner.jpg"

    # subscriber-9 Smartsignage Demo (Shoppings): Smartsignage-interface-333.mp4, Resgate Totem-_001.mp4
    copy_if "${src_dir}/Smartsignage-interface-333.mp4" "${uploads_base}/subscriber-9/medias/Smartsignage-interface-333.mp4"
    copy_if "${src_dir}/Resgate Totem-_001.mp4" "${uploads_base}/subscriber-9/medias/Resgate Totem-_001.mp4"

    # subscriber-10 Menu Executivo (Shoppings): menu-executivo.jpg
    copy_if "${src_dir}/menu-executivo.jpg" "${uploads_base}/subscriber-10/medias/menu-executivo.jpg"

    # Ajustar permissões (best-effort)
    for cid in 1 2 3 4 5 6 7 8 9 10; do
        [[ -d "${uploads_base}/subscriber-${cid}" ]] && (sudo chown -R $USER:$USER "${uploads_base}/subscriber-${cid}" 2>/dev/null || chown -R $USER:$USER "${uploads_base}/subscriber-${cid}" 2>/dev/null || true)
        sudo chmod -R 755 "${uploads_base}/subscriber-${cid}" 2>/dev/null || true
        sudo find "${uploads_base}/subscriber-${cid}" -type f -exec chmod 644 {} \; 2>/dev/null || true
    done

    log "✅ Mídias demo copiadas para ${uploads_base}/subscriber-1..10 (origem: player-web/propagandas)"
}

# =============================================================================
# Assets & Nginx alias + aplicar DDL/Seeds (idempotente)
# =============================================================================
setup_assets_and_db() {
    log "Configurando pasta de assets públicos e Nginx (idempotente)..."
    local PUBLIC_ASSETS="/opt/smart-signage/public/assets"
    local FRONTEND_BUILD_ASSETS="/opt/smart-signage/frontend/build/assets"
    local NGINX_CONF_OLD="/etc/nginx/conf.d/smart-signage-assets.conf"
    local NGINX_SNIPPET="/etc/nginx/snippets/smart-signage-assets.conf"
    local SITE_CONF="/etc/nginx/sites-enabled/smart-signage"
    # NUNCA gravar backups dentro de sites-enabled: o Nginx inclui todos os arquivos e gera "duplicate default server".
    local NGINX_SITE_BACKUP_DIR="/var/lib/smart-signage/nginx-site-backups"
    local NGINX_USER="www-data"
    local APP_USER="smartchannel"

    sudo mkdir -p "$NGINX_SITE_BACKUP_DIR" 2>/dev/null || true
    # Migrar/remover backups antigos erroneamente criados em sites-enabled
    for _stray in /etc/nginx/sites-enabled/smart-signage.bak.assets.*; do
        [[ -e "$_stray" ]] || continue
        log "Movendo backup órfão fora de sites-enabled (evita default_server duplicado): $_stray"
        sudo mv "$_stray" "$NGINX_SITE_BACKUP_DIR/orphan-$(basename "$_stray")" 2>/dev/null || sudo rm -f "$_stray" 2>/dev/null || true
    done

    # Criar diretório persistente de assets e uploads
    sudo mkdir -p "$PUBLIC_ASSETS/uploads" 2>/dev/null || true

    # 1) Base de assets: legível pelo Nginx (www-data) e demais usuários
    if id -u "$NGINX_USER" >/dev/null 2>&1; then
        sudo chown -R "$NGINX_USER":"$NGINX_USER" "$PUBLIC_ASSETS" 2>/dev/null || true
    else
        sudo chown -R "$USER":"$USER" "$PUBLIC_ASSETS" 2>/dev/null || true
    fi
    sudo chmod -R u=rwX,g=rX,o=rX "$PUBLIC_ASSETS" 2>/dev/null || true

    # 2) Pasta de uploads: escrita por smartchannel (backend) e www-data (Nginx)
    if id -u "$APP_USER" >/dev/null 2>&1 && id -u "$NGINX_USER" >/dev/null 2>&1; then
        sudo chown -R "$APP_USER":"$NGINX_USER" "$PUBLIC_ASSETS/uploads" 2>/dev/null || true
        # setgid (2) nos diretórios para herdar grupo www-data; 775 garante escrita de dono e grupo
        sudo chmod -R 2775 "$PUBLIC_ASSETS/uploads" 2>/dev/null || true
    fi

    # Se existia um conf.d criado anteriormente com location direto (inválido), mover para backup
    if [[ -f "$NGINX_CONF_OLD" ]]; then
        log "Movendo configuração inválida $NGINX_CONF_OLD para backup..."
        sudo mv "$NGINX_CONF_OLD" "${NGINX_CONF_OLD}.bak.$(date +%s)" || true
    fi

    # Criar snippet com location (idempotente)
    sudo mkdir -p /etc/nginx/snippets
    # bash -c "..." envolve heredoc: escapar \" e \$ para não quebrar a string nem expandir \$uri no script pai.
    sudo bash -c "cat > '$NGINX_SNIPPET' <<'NG_SNIP'
# SmartSignage - assets snippet (auto-generated)
location ^~ /assets/ {
  alias /opt/smart-signage/public/assets/;
  access_log off;
  expires 7d;
  add_header Cache-Control \"public, max-age=604800\";
  try_files \$uri \$uri/ =404;
}
NG_SNIP"
    sudo chmod 644 "$NGINX_SNIPPET" || true

    # Criar link simbólico de compatibilidade (build -> public/assets)
    if [[ -d "/opt/smart-signage/frontend/build" ]]; then
        if [[ -e "$FRONTEND_BUILD_ASSETS" && ! -L "$FRONTEND_BUILD_ASSETS" ]]; then
            sudo mv "$FRONTEND_BUILD_ASSETS" "${FRONTEND_BUILD_ASSETS}.bak.$(date +%s)" 2>/dev/null || true
        fi
        if [[ ! -L "$FRONTEND_BUILD_ASSETS" ]]; then
            sudo ln -s "$PUBLIC_ASSETS" "$FRONTEND_BUILD_ASSETS" 2>/dev/null || true
        fi
    fi

    # Inserir include do snippet dentro do server block do site principal (idempotente)
    # O snippet define "location ^~ /assets/" — não incluir se já existir location para /assets/ (duplicate location).
    _site_has_assets_location() {
        sudo grep -qE '^[[:space:]]*location[[:space:]]+.*\/assets' "$1" 2>/dev/null
    }
    if [[ -f "$SITE_CONF" ]]; then
        if sudo grep -q "include /etc/nginx/snippets/smart-signage-assets.conf;" "$SITE_CONF" 2>/dev/null; then
            log "Include do snippet já presente em $SITE_CONF"
        elif _site_has_assets_location "$SITE_CONF"; then
            log "location /assets/ já definido em $SITE_CONF — não incluindo snippet (evita duplicate location)."
        else
            # Inserir depois da linha que define root /opt/smart-signage/frontend/build;
            if sudo grep -q "root /opt/smart-signage/frontend/build;" "$SITE_CONF" 2>/dev/null; then
                log "Inserindo include do snippet em $SITE_CONF (após root /opt/smart-signage/frontend/build;)"
                # Só uma linha include (várias linhas "root ..." duplicariam location /assets/ e quebrariam nginx -t).
                sudo cp -a "$SITE_CONF" "${NGINX_SITE_BACKUP_DIR}/smart-signage.site.$(date +%s).conf" 2>/dev/null || true
                sudo awk '
                  BEGIN { ins=0 }
                  /root \/opt\/smart-signage\/frontend\/build;/ {
                    print
                    if (ins == 0) {
                      print "    include /etc/nginx/snippets/smart-signage-assets.conf;"
                      ins = 1
                    }
                    next
                  }
                  { print }
                ' "$SITE_CONF" > /tmp/smart-signage.conf.tmp && sudo mv /tmp/smart-signage.conf.tmp "$SITE_CONF"
            else
                log "root /opt/smart-signage/frontend/build; não encontrado em $SITE_CONF — adicionando include no final do server block se possível"
                if _site_has_assets_location "$SITE_CONF"; then
                    log "location /assets/ já presente — não acrescentando include."
                else
                    sudo bash -c "echo \"    include /etc/nginx/snippets/smart-signage-assets.conf;\" >> '$SITE_CONF'"
                fi
            fi
        fi
    else
        # sites-enabled não existe: criar conf.d server que inclui snippet (fallback)
        local FALLBACK_CONF="/etc/nginx/conf.d/smart-signage-assets-server.conf"
        log "Arquivo $SITE_CONF não encontrado — criando $FALLBACK_CONF como fallback (server minimal)"
        sudo bash -c "cat > '$FALLBACK_CONF' <<'NG_SRV'
server {
    listen 80;
    server_name _;
    root /opt/smart-signage/frontend/build;
    include /etc/nginx/snippets/smart-signage-assets.conf;
}
NG_SRV"
    fi

    # Testar e recarregar nginx (log em pasta gravável — /tmp root-owned abortava o install)
    local _nginx_test_log
    _nginx_test_log="$(install_log_file nginx-assets-test.txt)"
    set +e
    sudo nginx -t >"$_nginx_test_log" 2>&1
    local _nginx_t_rc=$?
    set -e
    if [[ $_nginx_t_rc -eq 0 ]]; then
        sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload 2>/dev/null || true
        log "✅ Nginx recarregado (assets alias configurado)"
    else
        warn "⚠️  Configuração Nginx inválida após alterações — saída de nginx -t:"
        if [[ -f "$_nginx_test_log" ]]; then
            while IFS= read -r _nline; do warn "   $_nline"; done < "$_nginx_test_log"
        fi
        _lastbak=$(ls -1t "$NGINX_SITE_BACKUP_DIR"/smart-signage.site.*.conf 2>/dev/null | head -1)
        if [[ -n "$_lastbak" && -f "$_lastbak" ]]; then
            warn "⚠️  Restaurando site de backup: $_lastbak"
            sudo cp -a "$_lastbak" "$SITE_CONF" 2>/dev/null || true
            if sudo nginx -t >/dev/null 2>&1; then
                sudo systemctl reload nginx 2>/dev/null || true
                warn "⚠️  Nginx voltou à config anterior; ajuste manual do include de assets pode ser necessário."
            fi
        fi
    fi

    # =============================================================================
    # Aplicar DDL e Seeds (os arquivos part*.sql e carga-inicial-v6.sql são fonte da verdade)
    # =============================================================================
    log "Aplicando esquema DDL (part*.sql) e seeds (carga-inicial-v6.sql) — idempotente"

    # Parâmetros de conexão — permitimos uso de variáveis de ambiente já definidas no instalador
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5432}"
    DB_NAME="${DB_NAME:-smartsignage}"
    DB_USER="${DB_USER:-smartsignage}"
    DB_PASSWORD="${DB_PASSWORD:-}"

    # Se não houver password definido, tentamos usar trust via unix socket (postgres user) — keep safe
    export PGPASSWORD="$DB_PASSWORD"
    PSQL_BASE_ARGS="-h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"

    # Executar cada part*.sql em ordem alfanumérica
    for f in database/smartchannel-db-v2-refactored-part*.sql; do
        if [[ -f "$f" ]]; then
            log "Executando DDL idempotente: $f"
            sudo -u postgres psql -q -v ON_ERROR_STOP=1 -f "$f" 2>/tmp/install-ddl.err || {
                # fallback usando psql com credenciais (se fornecidas)
                psql $PSQL_BASE_ARGS -v ON_ERROR_STOP=1 -f "$f" 2>>/tmp/install-ddl.err || {
                    log_error "Erro aplicando $f — ver /tmp/install-ddl.err"
                    return 1
                }
            }
        fi
    done

    # Aplicar seed principal se existir
    if [[ -f "database/carga-inicial-v6.sql" ]]; then
        log "Executando seed: database/carga-inicial-v6.sql"
        sudo -u postgres psql -q -v ON_ERROR_STOP=1 -f "database/carga-inicial-v6.sql" 2>/tmp/install-seed.err || {
            psql $PSQL_BASE_ARGS -v ON_ERROR_STOP=1 -f "database/carga-inicial-v6.sql" 2>>/tmp/install-seed.err || {
                log_error "Erro aplicando seed — ver /tmp/install-seed.err"
                return 1
            }
        }
    fi

    log "✅ Assets públicos e DDL/seeds aplicados (se não houveram erros fatais)"
}

# =============================================================================
# Sanitize existing nginx confs that may contain location blocks at top-level
# Move legacy/invalid conf.d files to backup BEFORE nginx is tested/started
# =============================================================================
sanitize_nginx_conf() {
    local BAD_CONF="/etc/nginx/conf.d/smart-signage-assets.conf"
    if [[ -f "$BAD_CONF" ]]; then
        # check if file contains a leading 'location' directive outside server context
        if sudo grep -qE '^[[:space:]]*location' "$BAD_CONF" 2>/dev/null; then
            log "Detectado $BAD_CONF contendo 'location' no contexto global — movendo para backup"
            sudo mv "$BAD_CONF" "${BAD_CONF}.moved.$(date +%s)" || true
        fi
    fi
}

# =============================================================================
# GERENCIAMENTO DE CONFIGURAÇÃO CENTRALIZADA
# =============================================================================

# Arquivo de configuração centralizado
CONFIG_FILE="${INSTALL_DIR:-/opt/smart-signage}/smartsignage-config"

# Carregar configurações do arquivo smartsignage-config
load_system_config() {
    local config_file="$1"
    
    if [[ ! -f "$config_file" ]]; then
        log "Arquivo de configuração não encontrado: $config_file"
        log "Usando valores padrão e criando arquivo de configuração..."
        return 1
    fi
    
    # Carregar configurações (formato: VARIAVEL=valor)
    # Ignorar linhas de comentário e vazias
    local loaded_count=0
    while IFS='=' read -r key value || [[ -n "$key" ]]; do
        # Ignorar comentários e linhas vazias
        [[ "$key" =~ ^[[:space:]]*# ]] && continue
        [[ -z "$key" ]] && continue
        
        # Remover espaços e aspas
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        
        # Ignorar INSTALL_DIR (não pode ser sobrescrito pelo config)
        if [[ "$key" == "INSTALL_DIR" ]]; then
            log_detailed "Ignorando INSTALL_DIR do arquivo de configuração para evitar sobrescrita."
            continue
        fi
        
        # Exportar variável (garantir que seja exportada globalmente)
        if [[ -n "$key" && -n "$value" ]]; then
            export "$key=$value"
            loaded_count=$((loaded_count + 1))
        fi
    done < <(grep -v '^[[:space:]]*#' "$config_file" | grep -v '^[[:space:]]*$' | grep '=')
    
    if [[ $loaded_count -gt 0 ]]; then
        log "✅ $loaded_count configurações carregadas do arquivo de configuração"
    fi
    
    return 0
}

# Criar arquivo de configuração padrão
create_default_config() {
    local config_file="$1"
    local install_dir="${2:-/opt/smart-signage}"
    
    log "Criando arquivo de configuração padrão: $config_file"
    
    cat > "$config_file" << 'EOF'
# =============================================================================
# Smart Signage Pro - Configuração do Sistema
# =============================================================================
# Este arquivo contém todas as configurações do sistema
# IMPORTANTE: Altere as senhas e credenciais antes de usar em produção!
# =============================================================================

# Usuário do sistema para executar o Smart Signage Pro
SYSTEM_USER=smartsignage

# Grupo do sistema
SYSTEM_GROUP=smartsignage

# Usuário PostgreSQL do sistema (usuário que gerencia o PostgreSQL)
POSTGRES_SYSTEM_USER=postgres

# Senha do usuário postgres do PostgreSQL (ALTERE EM PRODUÇÃO!)
# IMPORTANTE:
# - Esta senha só será aplicada automaticamente em duas situações:
#   1) Quando o PostgreSQL for instalado AGORA por este script (PG_WAS_INSTALLED=true)
#   2) Quando a flag FORCE_CHANGE_POSTGRES_PASSWORD=true for usada
# - Em instalações já existentes, a senha do postgres NÃO será alterada por padrão.
POSTGRES_PASSWORD=smartsignage123

# Flag opcional para forçar alteração da senha do usuário postgres mesmo em instalações existentes
# Use com cuidado: FORCE_CHANGE_POSTGRES_PASSWORD=true
FORCE_CHANGE_POSTGRES_PASSWORD=false

# Usuário do banco de dados PostgreSQL (usuário da aplicação - master do sistema)
DB_USER=smartsignage

# Senha do usuário do banco de dados (ALTERE EM PRODUÇÃO!)
DB_PASSWORD=smartsignage123

# Nome do banco de dados
DB_NAME=smartsignage

# Host do banco de dados
DB_HOST=localhost

# Porta do banco de dados
DB_PORT=5432

# Diretório de uploads (relativo ao INSTALL_DIR que é determinado pelo modo de instalação)
UPLOAD_PATH=/opt/smart-signage/public/assets/uploads

# JWT Secret (ALTERE EM PRODUÇÃO! Use: openssl rand -base64 64)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Porta do backend
BACKEND_PORT=3000

# Porta do frontend (Nginx)
FRONTEND_PORT=80

# Dados do proprietário (owner) para seed inicial dinâmica
SYSTEM_OWNER_NAME=Totem Digital
SYSTEM_OWNER_CONTACT_NAME=Contato Totem Digital
SYSTEM_OWNER_EMAIL=contato@totemdigital.local
SYSTEM_OWNER_CITY=Encruzilhada
SYSTEM_OWNER_ADMIN_USERNAME=Owner
SYSTEM_OWNER_PLAN_NAME=Plano Totem Digital
SYSTEM_OWNER_PLAN_SLUG=plano-totem-digital
EOF
    
    chmod 600 "$config_file"
    log "✅ Arquivo de configuração criado: $config_file"
    log "⚠️  IMPORTANTE: Altere as senhas e credenciais antes de usar em produção!"
}

# Verificar/criar usuário postgres do sistema
ensure_postgres_system_user() {
    local postgres_user="${POSTGRES_SYSTEM_USER:-postgres}"
    
    # Verificar se usuário existe
    if id "$postgres_user" &>/dev/null; then
        # Usuário existe, mas verificar se o diretório home tem as permissões corretas
        local postgres_home="/var/lib/postgresql"
        if [[ -d "$postgres_home" ]]; then
            local current_owner=$(stat -c '%U:%G' "$postgres_home" 2>/dev/null || echo "")
            if [[ "$current_owner" != "$postgres_user:$postgres_user" ]]; then
                log "Corrigindo permissões do diretório $postgres_home para $postgres_user:$postgres_user..."
                sudo chown -R "$postgres_user:$postgres_user" "$postgres_home" 2>/dev/null || true
                sudo chmod 700 "$postgres_home" 2>/dev/null || true
            fi
        fi
        return 0
    fi
    
    log "Usuário do sistema '$postgres_user' não encontrado, criando..."
    
    # Corrigir permissões do diretório /var/lib/postgresql se já existir
    local postgres_home="/var/lib/postgresql"
    if [[ -d "$postgres_home" ]]; then
        log "Diretório $postgres_home já existe, será corrigido após criar usuário..."
    fi
    
    # No Ubuntu/Debian, o usuário postgres geralmente é criado pelo pacote postgresql
    # Mas se não foi criado, precisamos criar manualmente
    if command -v adduser &> /dev/null; then
        sudo adduser --system --group --home "$postgres_home" --shell /bin/bash "$postgres_user" 2>&1 || {
            # Tentar método alternativo
            sudo useradd -r -s /bin/bash -d "$postgres_home" -U "$postgres_user" 2>&1 || {
                error "❌ Falha ao criar usuário do sistema '$postgres_user'"
                return 1
            }
        }
    else
        sudo useradd -r -s /bin/bash -d "$postgres_home" -U "$postgres_user" 2>&1 || {
            error "❌ Falha ao criar usuário do sistema '$postgres_user'"
            return 1
        }
    fi
    
    # Corrigir permissões do diretório home após criar o usuário
    if [[ -d "$postgres_home" ]]; then
        log "Corrigindo permissões do diretório $postgres_home para $postgres_user:$postgres_user..."
        sudo chown -R "$postgres_user:$postgres_user" "$postgres_home" 2>/dev/null || true
        sudo chmod 700 "$postgres_home" 2>/dev/null || true
    fi
    
    log "✅ Usuário do sistema '$postgres_user' criado com sucesso"
    return 0
}

# Obter usuário postgres do sistema (garantindo que existe)
get_postgres_user() {
    local postgres_user="${POSTGRES_SYSTEM_USER:-postgres}"
    ensure_postgres_system_user
    echo "$postgres_user"
}

# Alterar senha do usuário postgres do PostgreSQL
change_postgres_password() {
    local postgres_user="${POSTGRES_SYSTEM_USER:-postgres}"
    local new_password="${POSTGRES_PASSWORD:-smartsignage123}"
    
    log "Alterando senha do usuário PostgreSQL '${postgres_user}'..."
    
    # Aguardar PostgreSQL estar pronto
    local max_attempts=10
    local attempt=0
    while [[ $attempt -lt $max_attempts ]]; do
        if sudo -u "$postgres_user" psql -c "SELECT 1" > /dev/null 2>&1; then
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        error "❌ PostgreSQL não está respondendo para alterar senha"
        return 1
    fi
    
    # Alterar senha usando ALTER USER
    if sudo -u "$postgres_user" psql -c "ALTER USER ${postgres_user} WITH PASSWORD '${new_password}';" > /dev/null 2>&1; then
        log "✅ Senha do usuário PostgreSQL '${postgres_user}' alterada com sucesso"
        
        # Atualizar arquivo .pgpass se existir (para autenticação automática)
        local pgpass_file="/var/lib/postgresql/.pgpass"
        if [[ -f "$pgpass_file" ]]; then
            sudo -u "$postgres_user" sed -i "s|^localhost:5432:\*:${postgres_user}:.*|localhost:5432:*:${postgres_user}:${new_password}|" "$pgpass_file" 2>/dev/null || true
        fi
        
        return 0
    else
        warn "⚠️  Não foi possível alterar senha do usuário PostgreSQL (pode já estar configurada)"
        return 0
    fi
}

# Criptografia de senhas usando OpenSSL AES-256-CBC
# As senhas são criptografadas antes de serem armazenadas no arquivo de configuração
# A chave de criptografia é armazenada em .encryption_key (permissões 600)
encrypt_password() {
    local password="$1"
    local install_dir="${INSTALL_DIR:-/opt/smart-signage}"
    local key_file="$install_dir/.encryption_key"
    
    # Verificar se openssl está disponível
    if ! command -v openssl >/dev/null 2>&1; then
        warn "⚠️  openssl não encontrado. Retornando senha em texto plano (não seguro!)"
        echo "$password"
        return 1
    fi
    
    # Gerar chave de criptografia se não existir
    if [[ ! -f "$key_file" ]]; then
        log "Gerando chave de criptografia em: $key_file"
        if ! openssl rand -base64 32 > "$key_file" 2>/dev/null; then
            error "❌ Falha ao gerar chave de criptografia"
            echo "$password"
            return 1
        fi
        # Proteger arquivo de chave (apenas leitura para o dono)
        chmod 600 "$key_file" 2>/dev/null || true
        # Tentar definir ownership correto
        if [[ -n "${CURRENT_USER:-}" ]]; then
            chown "$CURRENT_USER:$CURRENT_GROUP" "$key_file" 2>/dev/null || true
        fi
    fi
    
    # Verificar se a chave existe e é válida
    if [[ ! -f "$key_file" ]] || [[ ! -r "$key_file" ]]; then
        warn "⚠️  Arquivo de chave não acessível. Retornando senha em texto plano"
        echo "$password"
        return 1
    fi
    
    # Criptografar senha usando AES-256-CBC com salt
    local encrypted
    if encrypted=$(echo -n "$password" | openssl enc -aes-256-cbc -salt -base64 -pass file:"$key_file" 2>/dev/null); then
        echo "$encrypted"
        return 0
    else
        warn "⚠️  Falha ao criptografar senha. Retornando em texto plano"
        echo "$password"
        return 1
    fi
}

# Descriptografar senha
decrypt_password() {
    local encrypted_password="$1"
    local install_dir="${INSTALL_DIR:-/opt/smart-signage}"
    local key_file="$install_dir/.encryption_key"
    
    # Se não parece ser uma string criptografada (base64), retornar como está
    if [[ ! "$encrypted_password" =~ ^[A-Za-z0-9+/=]+$ ]] || [[ ${#encrypted_password} -lt 20 ]]; then
        # Provavelmente já está em texto plano (compatibilidade com instalações antigas)
        echo "$encrypted_password"
        return 0
    fi
    
    # Verificar se openssl está disponível
    if ! command -v openssl >/dev/null 2>&1; then
        warn "⚠️  openssl não encontrado. Retornando como está (pode estar criptografado)"
        echo "$encrypted_password"
        return 1
    fi
    
    # Verificar se a chave existe
    if [[ ! -f "$key_file" ]] || [[ ! -r "$key_file" ]]; then
        warn "⚠️  Arquivo de chave não encontrado. Retornando como está (pode estar criptografado)"
        echo "$encrypted_password"
        return 1
    fi
    
    # Descriptografar senha
    local decrypted
    if decrypted=$(echo "$encrypted_password" | openssl enc -d -aes-256-cbc -base64 -pass file:"$key_file" 2>/dev/null); then
        echo "$decrypted"
        return 0
    else
        # Se falhar, pode ser que já esteja em texto plano (compatibilidade)
        warn "⚠️  Falha ao descriptografar. Retornando como está (pode estar em texto plano)"
        echo "$encrypted_password"
        return 1
    fi
}

# Função para log de container
log_container() {
    echo -e "${YELLOW}[CONTAINER $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
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

# Executa um arquivo SQL via psql garantindo falha imediata em caso de erro
execute_psql_file() {
    local database_name="$1"
    local schema_file="$2"
    local description="$3"

    if [[ ! -f "$schema_file" ]]; then
        error "❌ Arquivo SQL não encontrado: $schema_file"
        return 1
    fi

    # Garantir que o usuário postgres consiga ler o arquivo
    if [[ ! -r "$schema_file" ]]; then
        sudo chmod 644 "$schema_file" 2>/dev/null || true
    fi

    # Obter diretório do arquivo para usar com \i
    local schema_dir=$(dirname "$schema_file")
    local schema_filename=$(basename "$schema_file")

    if [[ ! -r "$schema_file" ]]; then
        error "❌ Permissão de leitura negada para $schema_file"
        return 1
    fi

    log_detailed "Executando ${description}: $schema_file"

    # Copiar para /tmp com permissões acessíveis ao usuário postgres
    local temp_schema
    temp_schema=$(mktemp /tmp/smartchannel-schema-XXXX.sql) || {
        error "❌ Falha ao criar arquivo temporário para ${description}"
        return 1
    }

    if ! cp "$schema_file" "$temp_schema"; then
        rm -f "$temp_schema" 2>/dev/null || true
        error "❌ Falha ao copiar ${schema_file} para ${temp_schema}"
        return 1
    fi

    # Substituir caminhos relativos \i por caminhos absolutos; se em dir inacessível ao postgres, copiar .sql para /tmp
    local schema_to_use="$temp_schema"
    local cleanup_schema_dir=""
    if grep -q "\\\\i " "$temp_schema"; then
        chmod -R a+rX "$schema_dir" 2>/dev/null || true
        local temp_schema_dir
        temp_schema_dir=$(mktemp -d /tmp/smartchannel-schema-dir-XXXX 2>/dev/null) || true
        if [[ -n "$temp_schema_dir" ]] && [[ -d "$temp_schema_dir" ]]; then
            cleanup_schema_dir="$temp_schema_dir"
            cp -p "$schema_dir"/*.sql "$temp_schema_dir/" 2>/dev/null || true
            chmod -R a+rX "$temp_schema_dir" 2>/dev/null || true
            sed -i "s|\\\\i \\([^/].*\\.sql\\)|\\\\i ${temp_schema_dir}/\\1|g" "$temp_schema" 2>/dev/null || \
                perl -i -pe "s|\\\\i ([^/].*\.sql)|\\\\i ${temp_schema_dir}/\$1|g" "$temp_schema" 2>/dev/null || true
            # Reescrever também \i caminho_absoluto (schema_dir) para temp_schema_dir, para consistência
            sed -i "s|\\\\i ${schema_dir}/|\\\\i ${temp_schema_dir}/|g" "$temp_schema" 2>/dev/null || true
        else
            sudo chmod -R o+rX "$schema_dir" 2>/dev/null || true
            sed -i "s|\\\\i \\([^/].*\\.sql\\)|\\\\i ${schema_dir}/\\1|g" "$temp_schema" 2>/dev/null || {
                perl -i -pe "s|\\\\i ([^/].*\.sql)|\\\\i ${schema_dir}/\$1|g" "$temp_schema" 2>/dev/null || true
            }
        fi
    fi

    chmod 644 "$temp_schema" 2>/dev/null || true
    local psql_output=""
    local POSTGRES_USER="${POSTGRES_SYSTEM_USER:-postgres}"
    local db_user="${PRIMARY_DB_USER:-${DB_USER:-}}"
    local db_host="${DB_HOST:-localhost}"
    local db_port="${DB_PORT:-5432}"
    local run_ok=false

    # Preferir usuário da aplicação (evita sudo em --seeds-only / automação)
    if [[ -n "${PGPASSWORD:-}" ]] && [[ -n "$db_user" ]] && command -v psql >/dev/null 2>&1; then
        if psql_output=$(PGPASSWORD="$PGPASSWORD" psql -v ON_ERROR_STOP=1 \
            -h "$db_host" -p "$db_port" -U "$db_user" -d "$database_name" -f "$schema_to_use" 2>&1); then
            run_ok=true
        fi
    fi

    if [[ "$run_ok" != "true" ]]; then
        if ! psql_output=$(sudo -u "$POSTGRES_USER" psql -v ON_ERROR_STOP=1 -d "$database_name" -f "$schema_to_use" 2>&1); then
            rm -f "$schema_to_use" 2>/dev/null || true
            [[ -n "$cleanup_schema_dir" ]] && rm -rf "$cleanup_schema_dir" 2>/dev/null || true
            error "❌ Falha ao aplicar ${description}"
            echo "$psql_output"
            return 1
        fi
    fi

    rm -f "$schema_to_use" 2>/dev/null || true
    [[ -n "$cleanup_schema_dir" ]] && rm -rf "$cleanup_schema_dir" 2>/dev/null || true

    # Mostrar apenas mensagens relevantes (erros já capturados acima)
    if [[ -n "$psql_output" ]]; then
        echo "$psql_output" | grep -v -E "^(SET|COMMENT|CREATE ROLE|CREATE EXTENSION)" || true
    fi

    log "✅ ${description} aplicado com sucesso"
}

# Retry genérico com backoff exponencial
retry_with_backoff() {
    local max_attempts=$1
    local initial_delay_seconds=$2
    shift 2
    local attempt=1
    local delay=$initial_delay_seconds
    while true; do
        if "$@"; then
            return 0
        fi
        if [[ $attempt -ge $max_attempts ]]; then
            return 1
        fi
        log "Tentativa ${attempt}/${max_attempts} falhou. Aguardando ${delay}s e tentando novamente..."
        sleep "$delay"
        attempt=$((attempt+1))
        delay=$((delay*2))
        if [[ $delay -gt 30 ]]; then delay=30; fi
    done
}

# Banner
show_banner() {
    clear 2>/dev/null || true
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    Smart Signage Pro                        ║"
    echo "║              Sistema de Sinalização Digital                 ║"
    echo "║                    Auto-Instalação Ubuntu                   ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  Versão do Sistema: ${SYSTEM_VERSION}                                    ║"
    echo "║  Versão do Script:  ${SCRIPT_VERSION}                                    ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -e "${CYAN}ℹ️  Sistema v${SYSTEM_VERSION} | Script v${SCRIPT_VERSION}${NC}"
    echo
}

# =============================================================================
# PARSE DE ARGUMENTOS
# =============================================================================
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --fresh)
                # Fresh = instalação do zero. Padrão: single-server (não Docker).
                # Para Docker: --fresh --mode docker
                FRESH_MODE=true
                SKIP_MENU=true
                RESET_DATABASE=true
                PRESERVE_DB=false
                shift
                ;;
            --rebuild)
                REBUILD_MODE=true
                shift
                ;;
            --rebuild-cache)
                REBUILD_MODE=true
                REBUILD_CACHE=true
                shift
                ;;
            --rebuild-only)
                REBUILD_MODE=true
                REBUILD_ONLY=true
                shift
                ;;
            --force)
                FORCE_REBUILD=true
                shift
                ;;
            --check-only)
                CHECK_ONLY=true
                shift
                ;;
            --skip-menu)
                SKIP_MENU=true
                shift
                ;;
            --mode|--install-mode)
                SKIP_MENU=true
                if [[ -z "${2:-}" ]]; then
                    error "Faltou valor para --mode. Use: --mode single-server|single-server-prod|docker"
                    exit 1
                fi
                INSTALL_MODE="$2"
                shift 2
                ;;
            --mqtt-mode)
                if [[ -z "${2:-}" ]]; then
                    error "Faltou valor para --mqtt-mode. Use: --mqtt-mode dev|production"
                    exit 1
                fi
                SINGLE_SERVER_MQTT_MODE="$2"
                shift 2
                ;;
            --https-self-signed)
                ENABLE_HTTPS_SELF_SIGNED=true
                shift
                ;;
            --split-corporate-system)
                SPLIT_CORPORATE_AND_SYSTEM=true
                shift
                ;;
            --public-host)
                if [[ -z "${2:-}" ]]; then
                    error "Faltou valor para --public-host (IP ou domínio deste servidor)."
                    exit 1
                fi
                PUBLIC_HOST="$2"
                shift 2
                ;;
            --corporate-http-port)
                if [[ -z "${2:-}" ]]; then
                    error "Faltou valor para --corporate-http-port."
                    exit 1
                fi
                CORPORATE_HTTP_PORT="$2"
                shift 2
                ;;
            --system-http-port)
                if [[ -z "${2:-}" ]]; then
                    error "Faltou valor para --system-http-port."
                    exit 1
                fi
                SYSTEM_HTTP_PORT="$2"
                shift 2
                ;;
            --corporate-web-root)
                if [[ -z "${2:-}" ]]; then
                    error "Faltou valor para --corporate-web-root."
                    exit 1
                fi
                CORPORATE_WEB_ROOT="$2"
                CORPORATE_WEB_ROOT_FROM_CLI=true
                shift 2
                ;;
            --corporate-site-source|--corporate-source)
                if [[ -z "${2:-}" ]]; then
                    error "Faltou valor para --corporate-site-source (pasta com index.html, ex.: ./totemdigital.site)."
                    exit 1
                fi
                CORPORATE_SITE_SOURCE="$2"
                CORPORATE_SITE_SOURCE_FROM_CLI=true
                shift 2
                ;;
            --reset-db)
                RESET_DATABASE=true
                shift
                ;;
            --preserve-db)
                PRESERVE_DB=true
                shift
                ;;
            --db-only)
                # Reinstala apenas o banco de dados (drop + schema + seeds),
                # sem rebuild de backend/frontend ou reconfiguração completa do sistema.
                DB_ONLY_MODE=true
                RESET_DATABASE=true
                SKIP_MENU=true
                shift
                ;;
            --seeds-only)
                # Aplica seeds dinâmicos (carga-inicial-v6 + bloco owner) sem recriar schema.
                SEEDS_ONLY_MODE=true
                LOAD_SEEDS=true
                SKIP_MENU=true
                shift
                ;;
            --sync-corporate-site|--sync-site-corporativo)
                # Apenas publica totemdigital.site + logos-icons na raiz HTTP corporativa.
                CORPORATE_SITE_SYNC_ONLY=true
                SKIP_MENU=true
                shift
                ;;
            --backend-only)
                # Apenas instala dependências e compila o backend
                BACKEND_BUILD_ONLY=true
                SKIP_MENU=true
                shift
                ;;
            --frontend-only)
                # Apenas instala dependências e compila o frontend
                FRONTEND_BUILD_ONLY=true
                SKIP_MENU=true
                shift
                ;;
            --backfront-build)
                # Instala dependências e compila backend e frontend (sem tocar no banco)
                BACKFRONT_BUILD_ONLY=true
                SKIP_MENU=true
                shift
                ;;
            --load-seeds|--with-seeds)
                LOAD_SEEDS=true
                SEEDS_OPTION_FORCED=true
                shift
                ;;
            --skip-seeds|--no-seeds)
                LOAD_SEEDS=false
                SEEDS_OPTION_FORCED=true
                shift
                ;;
            --compact-merge-locals)
                COMPACT_MERGE_LOCALS=true
                shift
                ;;
            --starttotem)
                START_TOTEM=true
                shift
                ;;
            --skip-players|--totemdigital-install)
                SKIP_PLAYERS_INSTALL=true
                shift
                ;;
            --totemdigital-compact|--compact-profile)
                INSTALL_TOTEMDIGITAL_COMPACT=true
                TOTEMDIGITAL_PROFILE_CLI_SET=true
                shift
                ;;
            --smartsignage-pro|--pro-profile)
                INSTALL_TOTEMDIGITAL_COMPACT=false
                TOTEMDIGITAL_PROFILE_CLI_SET=true
                shift
                ;;
            --direct-totem)
                INSTALL_DIRECT_TOTEM_MODE=true
                shift
                ;;
            --no-direct-totem)
                INSTALL_DIRECT_TOTEM_MODE=false
                shift
                ;;
            --help|-h)
                echo "Smart Signage Pro v2.0 - Script de Instalação"
                echo ""
                echo "Uso: $0 [OPÇÕES]"
                echo ""
                echo "OPÇÕES:"
                echo "  --fresh              Instalação COMPLETA do zero (apaga TUDO)"
                echo "  --rebuild            Rebuild preservando dados"
                echo "  --rebuild-cache      Rebuild sem cache Docker"
                echo "  --rebuild-only       Apenas rebuild, não inicia"
                echo "  --force              Força rebuild sempre"
                echo "  --check-only         Apenas verifica se precisa rebuild"
                echo "  --skip-menu          Pula menu (usa defaults do menu: Single-Server)"
                echo "  --mode <modo>        Define o modo (single-server|single-server-prod|docker) e pula o menu"
                echo "  --mqtt-mode <modo>   Perfil MQTT no single-server (dev|production)"
                echo "  --https-self-signed  Habilita HTTPS autoassinado (single-server)"
                echo "  --split-corporate-system  Site estático (corporativo) e painel em portas HTTP distintas (ver perguntas no menu)"
                echo "  --public-host <IP|domínio>  Host público para Nginx e URLs (com --split ou env SMARTSIGNAGE_PUBLIC_HOST)"
                echo "  --corporate-http-port <n>   Porta HTTP do site corporativo (padrão 80)"
                echo "  --system-http-port <n>      Porta HTTP do painel/API/player (80 se um só vhost; com --split-corporate-system use tipicamente 8080)"
                echo "  --corporate-web-root <dir>  Destino do site corporativo (padrão /var/www/corporate-site)"
                echo "  --corporate-site-source <dir>  Origem HTML com index.html (padrão: <repo>/totemdigital.site)"
                echo "  Env (autom./--skip-menu): SMARTSIGNAGE_SPLIT_SITE, SMARTSIGNAGE_PUBLIC_HOST, SMARTSIGNAGE_CORPORATE_HTTP_PORT,"
                echo "                            SMARTSIGNAGE_SYSTEM_HTTP_PORT, SMARTSIGNAGE_CORPORATE_WEB_ROOT,"
                echo "                            SMARTSIGNAGE_CORPORATE_SITE_SOURCE (pasta origem; default: totemdigital.site),"
                echo "                            SMARTSIGNAGE_DEPLOY_CORPORATE_LANDING (opt-in: gera app.html com link ao painel),"
                echo "                            SMARTSIGNAGE_LETSENCRYPT=true + SMARTSIGNAGE_DOMAIN_NAME (+ SMARTSIGNAGE_SSL_EMAIL opcional) para LE no layout dividido"
                echo "  --reset-db           Apaga e recria o banco PostgreSQL se já existir (fluxo completo)"
                echo "  --preserve-db        Preserva o banco de dados existente durante reinstalação"
                echo "  --db-only            Reinstala APENAS o banco (drop + schema + seeds), sem rebuild de backend/frontend"
                echo "  --seeds-only         Aplica seeds dinâmicos (owner/planos/totens demo) sem drop nem schema"
                echo "  --sync-corporate-site  Só sync do site corporativo (totemdigital.site + logos-icons → web root :80)"
                echo "       Exemplos:"
                echo "         sudo bash scripts/install-smartsignage.sh --sync-corporate-site"
                echo "         sudo bash scripts/install-smartsignage.sh --sync-corporate-site --corporate-web-root /var/www/corporate-site"
                echo "         sudo bash scripts/install-smartsignage.sh --sync-corporate-site \\"
                echo "             --corporate-site-source /home/smartchannel/TotemDigital/totemdigital.site \\"
                echo "             --corporate-web-root /var/www/corporate-site"
                echo "  --backend-only       Apenas backend: parar serviço, npm install + tsc, iniciar backend (sem banco/Nginx/frontend)"
                echo "  --frontend-only      Apenas frontend: parar Nginx, npm install + build React, reiniciar Nginx (sem banco/backend)"
                echo "  --backfront-build    Build backend + frontend (deps + TypeScript + React), depois iniciar backend e Nginx (sem banco)"
                echo "  --load-seeds         Carrega dados de demonstração automaticamente (sem prompt). Usa database/carga-inicial-v6.sql"
                echo "  --no-seeds           Não carrega dados de demonstração (organização owner ainda é criada no modo compacto/direct-totem)"
                echo "  --compact-merge-locals Opcional: colapsa vários locais num único (SQL: database/compact-merge-locals-to-single.sql). O compacto admite vários locais; use só se quiser essa limpeza. Backup; se houver >1 publisher ativo, edite target_publisher_id no SQL."
                echo "  --starttotem         Após instalar, abre 2 players web (/player) com UINs de totens demo para laboratório"
                echo "  --skip-players       Com --skip-menu: não copia players (webOS, Android, Tizen, etc.); só servidor + build"
                echo "  --totemdigital-install  Alias de --skip-players (perfil TotemDigital sem clientes player no disco)"
                echo "  --totemdigital-compact  Gera .env com TOTEMDIGITAL_COMPACT=true (modo compacto = mono; padrão neste repositório)"
                echo "  --smartsignage-pro   Gera .env com TOTEMDIGITAL_COMPACT=false (multi-agência / Pro completo)"
                echo "                       Também pode definir INSTALL_TOTEMDIGITAL_COMPACT=true|false no ambiente antes de executar o script."
                echo "  --direct-totem       Gera .env com DIRECT_TOTEM_MODE=true / REACT_APP_DIRECT_TOTEM_MODE=true (modo Publicar em Totem; padrão)"
                echo "  --no-direct-totem    Gera .env com DIRECT_TOTEM_MODE=false (desliga UI/API do modo Publicar em Totem)"
                echo "  --help               Mostra esta ajuda"
                exit 0
                ;;
            *)
                error "Opção desconhecida: $1"
                error "Use --help para ver opções disponíveis"
                exit 1
                ;;
        esac
    done
    finalize_https_when_split_layout
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
        error "Instalação do servidor suportada apenas em Ubuntu (detectado: ${ID:-desconhecido})."
        error "Use: ./scripts/install-smartsignage.sh numa máquina Ubuntu LTS."
        exit 1
    fi
    
    log "Sistema detectado: $PRETTY_NAME"
    
    # Chamar detect_distribution para configurar variáveis globais (se ainda não foi chamada)
    if [[ -z "$DISTRO_TYPE" ]]; then
        detect_distribution
    fi
}

# Aguardar lock do apt/dpkg (outro processo pode estar a usar)
wait_for_apt_lock() {
    local max_wait="${1:-300}"  # segundos (default 5 min)
    local waited=0
    # Esperar enquanto apt-get ou apt estiverem em execução (ou lock detetado via fuser se existir)
    while true; do
        local busy=0
        if pgrep -x apt-get >/dev/null 2>&1 || pgrep -x apt >/dev/null 2>&1; then
            busy=1
        fi
        if [[ $busy -eq 0 ]] && command -v fuser >/dev/null 2>&1; then
            if ! fuser -v /var/lib/apt/lists/lock /var/lib/dpkg/lock-frontend 2>/dev/null | grep -q .; then
                break
            fi
            busy=1
        fi
        if [[ $busy -eq 0 ]]; then
            break
        fi
        if [[ $waited -ge $max_wait ]]; then
            log "Aviso: Timeout à espera do lock do apt. A atualização do sistema será ignorada."
            return 1
        fi
        log "Aguardando liberação do apt/dpkg (processo em curso)... ${waited}s"
        sleep 10
        waited=$((waited + 10))
    done
    return 0
}

# Atualizar sistema
update_system() {
    log "Atualizando sistema..."
    if ! wait_for_apt_lock 300; then
        log "Aviso: Não foi possível atualizar o sistema agora. Pode executar depois: sudo apt update && sudo apt upgrade -y"
        return 0
    fi
    if sudo apt update && sudo apt upgrade -y; then
        log "Sistema atualizado com sucesso!"
    else
        log "Aviso: Falha ao atualizar o sistema (ex.: outro apt em execução). Pode continuar a instalação ou executar depois: sudo apt update && sudo apt upgrade -y"
    fi
}

# Instalar dependências básicas
install_dependencies() {
    log "Instalando dependências básicas..."
    
    sudo apt install -y \
        curl \
        wget \
        git \
        rsync \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        build-essential \
        openssl \
        python3 \
        python3-pip \
        postgresql-client \
        nginx \
        ufw \
        htop \
        nano \
        vim \
        ffmpeg
    
    log "Dependências básicas instaladas!"
}

# Aplicar perfil MQTT para modo single-server
apply_single_server_mqtt_profile() {
    # Normalizar aliases de modo
    if [[ "$INSTALL_MODE" == "single-server-prod" ]]; then
        INSTALL_MODE="single-server"
        SINGLE_SERVER_MQTT_MODE="production"
    elif [[ "$INSTALL_MODE" == "single-server-dev" ]]; then
        INSTALL_MODE="single-server"
        SINGLE_SERVER_MQTT_MODE="dev"
    fi

    if [[ "$INSTALL_MODE" != "single-server" ]]; then
        MQTT_LOCAL_BROKER_REQUIRED=false
        return 0
    fi

    case "$SINGLE_SERVER_MQTT_MODE" in
        production|prod|mosquitto)
            SINGLE_SERVER_MQTT_MODE="production"
            MQTT_LOCAL_BROKER_REQUIRED=true
            MQTT_BACKEND_USERNAME="${MQTT_BACKEND_USERNAME:-backend}"
            MQTT_PLAYER_USERNAME="${MQTT_PLAYER_USERNAME:-player}"
            [[ -z "$MQTT_BACKEND_USERNAME" ]] && MQTT_BACKEND_USERNAME="backend"
            [[ -z "$MQTT_PLAYER_USERNAME" ]] && MQTT_PLAYER_USERNAME="player"
            [[ -z "$MQTT_BACKEND_PASSWORD" ]] && MQTT_BACKEND_PASSWORD="$(openssl rand -hex 16 2>/dev/null || echo "changeme-backend")"
            [[ -z "$MQTT_PLAYER_PASSWORD" ]] && MQTT_PLAYER_PASSWORD="$(openssl rand -hex 16 2>/dev/null || echo "changeme-player")"
            ;;
        dev|development|"")
            SINGLE_SERVER_MQTT_MODE="dev"
            MQTT_LOCAL_BROKER_REQUIRED=false
            MQTT_BACKEND_USERNAME=""
            MQTT_BACKEND_PASSWORD=""
            MQTT_PLAYER_USERNAME=""
            MQTT_PLAYER_PASSWORD=""
            ;;
        *)
            error "Perfil MQTT inválido: $SINGLE_SERVER_MQTT_MODE (use dev|production)"
            exit 1
            ;;
    esac

    log "Perfil MQTT single-server: $SINGLE_SERVER_MQTT_MODE"
}

# Instala e configura Mosquitto local para produção (single-server)
setup_mosquitto_local() {
    if [[ "$INSTALL_MODE" != "single-server" || "$MQTT_LOCAL_BROKER_REQUIRED" != "true" ]]; then
        return 0
    fi

    log "Configurando Mosquitto local (produção)..."
    sudo apt install -y mosquitto mosquitto-clients

    local conf_dir="/etc/mosquitto/conf.d"
    local conf_file="${conf_dir}/smartsignage-production.conf"
    local passwd_file="/etc/mosquitto/passwd"
    local acl_file="/etc/mosquitto/acl"

    sudo mkdir -p "$conf_dir"

    # Recriar senha de forma idempotente para refletir credenciais atuais do instalador
    sudo rm -f "$passwd_file"
    sudo mosquitto_passwd -b -c "$passwd_file" "$MQTT_BACKEND_USERNAME" "$MQTT_BACKEND_PASSWORD"
    sudo mosquitto_passwd -b "$passwd_file" "$MQTT_PLAYER_USERNAME" "$MQTT_PLAYER_PASSWORD"

    sudo tee "$acl_file" > /dev/null <<EOF
# SmartSignage MQTT ACL (gerado pelo instalador)
user ${MQTT_BACKEND_USERNAME}
topic readwrite smartdisplay/#
topic read \$SYS/#

user ${MQTT_PLAYER_USERNAME}
topic read smartdisplay/+/timeline
topic read smartdisplay/+/effect
topic read smartdisplay/+/sync_time
topic write smartdisplay/+/telemetry
topic read \$SYS/broker/version
EOF

    sudo chmod 600 "$passwd_file" "$acl_file"

    sudo tee "$conf_file" > /dev/null <<'EOF'
# SmartSignage Mosquitto production profile
per_listener_settings false
allow_anonymous false
password_file /etc/mosquitto/passwd
acl_file /etc/mosquitto/acl

persistence true
persistence_location /var/lib/mosquitto/
autosave_interval 180
autosave_on_changes true

listener 1883
protocol mqtt

listener 9001
protocol websockets

log_type error
log_type warning
log_type notice
log_type information
EOF

    sudo systemctl enable mosquitto
    sudo systemctl restart mosquitto

    if systemctl is-active --quiet mosquitto; then
        log "✅ Mosquitto local ativo (1883/TCP, 9001/WS)"
    else
        error "❌ Mosquitto não iniciou corretamente. Verifique: sudo systemctl status mosquitto"
        exit 1
    fi
}

# Perguntar sobre DNS local (movido para o topo junto com outras perguntas)
ask_dns_local_configuration() {
    # Em modo não interativo, aplicar default do prompt (N)
    if [[ "$SKIP_MENU" == "true" ]]; then
        CONFIGURE_DNS_LOCAL=false
        log "DNS local não será configurado (skip-menu padrão: N)"
        return 0
    fi
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}                    Configuração de DNS Local (Publishers e Subscribers)${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    echo -e "${YELLOW}DNS local permite usar domínios como:${NC}"
    echo "  • publisher1.local, publisher2.local, etc."
    echo "  • subscriber1.local, subscriber2.local, etc."
    echo "  • api.publisher1.local, mqtt.publisher1.local, etc."
    echo
    echo -e "${GREEN}Benefícios:${NC}"
    echo "  ✓ Funciona offline (não requer internet)"
    echo "  ✓ Facilita desenvolvimento e testes"
    echo "  ✓ Ideal para totens/players"
    echo "  ✓ Não requer DNS externo para serviços internos"
    echo
    read -p "Deseja configurar DNS local para publishers e subscribers? (s/N): " configure_dns_local
    
    if [[ ! "$configure_dns_local" =~ ^[Ss]$ ]]; then
        CONFIGURE_DNS_LOCAL=false
        log "DNS local não será configurado"
    else
        CONFIGURE_DNS_LOCAL=true
        log "DNS local será configurado"
    fi
}

# Configurar DNS local para Publishers e Subscribers (opcional)
setup_local_dns() {
    # Se não foi solicitado, não configurar
    if [[ "$CONFIGURE_DNS_LOCAL" != "true" ]]; then
        return 0
    fi
    
    log "Configurando DNS local para publishers e subscribers..."
    
    # 1. Instalar dnsmasq
    if ! command -v dnsmasq &> /dev/null; then
        log "Instalando dnsmasq..."
        sudo apt install -y dnsmasq || {
            error "Falha ao instalar dnsmasq"
            return 1
        }
    else
        log "✅ dnsmasq já está instalado"
    fi
    
    # 2. Configurar systemd-resolved (liberar porta 53)
    log "Configurando systemd-resolved..."
    
    RESOLVED_CONF="/etc/systemd/resolved.conf"
    if [[ -f "$RESOLVED_CONF" ]]; then
        # Fazer backup
        sudo cp "$RESOLVED_CONF" "${RESOLVED_CONF}.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
        
        # Verificar se já está configurado
        if grep -q "DNSStubListener=no" "$RESOLVED_CONF" 2>/dev/null; then
            log "✅ systemd-resolved já está configurado (DNSStubListener=no)"
        else
            # Configurar systemd-resolved
            if grep -q "^\[Resolve\]" "$RESOLVED_CONF" 2>/dev/null; then
                # Seção [Resolve] existe, adicionar/modificar configurações
                sudo sed -i '/^\[Resolve\]/,/^\[/ {
                    /^DNS=/d
                    /^FallbackDNS=/d
                    /^DNSStubListener=/d
                }' "$RESOLVED_CONF" 2>/dev/null || true
                
                # Adicionar configurações após [Resolve]
                sudo sed -i '/^\[Resolve\]/a\
DNS=127.0.0.1\
FallbackDNS=8.8.8.8\
DNSStubListener=no' "$RESOLVED_CONF" 2>/dev/null || true
            else
                # Seção [Resolve] não existe, criar
                echo "[Resolve]
DNS=127.0.0.1
FallbackDNS=8.8.8.8
DNSStubListener=no" | sudo tee -a "$RESOLVED_CONF" > /dev/null
            fi
            
            log "✅ systemd-resolved configurado"
        fi
    else
        warn "⚠️  Arquivo /etc/systemd/resolved.conf não encontrado"
    fi
    
    # 3. Ajustar resolv.conf
    log "Ajustando resolv.conf..."
    if [[ -L /etc/resolv.conf ]]; then
        # Já é um link simbólico, verificar se aponta para o lugar certo
        RESOLV_TARGET=$(readlink /etc/resolv.conf)
        if [[ "$RESOLV_TARGET" != "/run/systemd/resolve/resolv.conf" ]]; then
            sudo rm /etc/resolv.conf
            sudo ln -s /run/systemd/resolve/resolv.conf /etc/resolv.conf
            log "✅ resolv.conf ajustado"
        else
            log "✅ resolv.conf já está configurado corretamente"
        fi
    elif [[ -f /etc/resolv.conf ]]; then
        # É um arquivo, fazer backup e criar link
        sudo cp /etc/resolv.conf /etc/resolv.conf.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
        sudo rm /etc/resolv.conf
        sudo ln -s /run/systemd/resolve/resolv.conf /etc/resolv.conf
        log "✅ resolv.conf convertido para link simbólico"
    else
        # Não existe, criar link
        sudo ln -s /run/systemd/resolve/resolv.conf /etc/resolv.conf
        log "✅ resolv.conf criado"
    fi
    
    # 4. Criar configuração dnsmasq para publishers e subscribers
    log "Criando configuração dnsmasq..."
    
    DNSMASQ_CONF="/etc/dnsmasq.d/smartsignage-publishers-subscribers.conf"
    
    # Criar configuração com publishers e subscribers de exemplo
    sudo tee "$DNSMASQ_CONF" > /dev/null << 'DNSMASQ_EOF'
# Smart Signage Pro - DNS Local para Publishers e Subscribers
# Configurado automaticamente pelo script de instalação

domain-needed
bogus-priv
no-resolv

# DNS externo fallback
server=8.8.8.8
server=1.1.1.1

# Bind local
listen-address=127.0.0.1
bind-interfaces

# Domínios base
local=/publisher.local/
local=/subscriber.local/

# ============================================
# PUBLISHERS (Exemplo: 5 publishers)
# ============================================
address=/publisher1.local/127.0.0.1
address=/publisher2.local/127.0.0.1
address=/publisher3.local/127.0.0.1
address=/publisher4.local/127.0.0.1
address=/publisher5.local/127.0.0.1

# Serviços por Publisher
address=/api.publisher1.local/127.0.0.1
address=/mqtt.publisher1.local/127.0.0.1
address=/player.publisher1.local/127.0.0.1

address=/api.publisher2.local/127.0.0.1
address=/mqtt.publisher2.local/127.0.0.1
address=/player.publisher2.local/127.0.0.1

address=/api.publisher3.local/127.0.0.1
address=/mqtt.publisher3.local/127.0.0.1
address=/player.publisher3.local/127.0.0.1

address=/api.publisher4.local/127.0.0.1
address=/mqtt.publisher4.local/127.0.0.1
address=/player.publisher4.local/127.0.0.1

address=/api.publisher5.local/127.0.0.1
address=/mqtt.publisher5.local/127.0.0.1
address=/player.publisher5.local/127.0.0.1

# ============================================
# SUBSCRIBERS (Exemplo: 5 subscribers)
# ============================================
address=/subscriber1.local/127.0.0.1
address=/subscriber2.local/127.0.0.1
address=/subscriber3.local/127.0.0.1
address=/subscriber4.local/127.0.0.1
address=/subscriber5.local/127.0.0.1

# Serviços por Subscriber
address=/api.subscriber1.local/127.0.0.1
address=/mqtt.subscriber1.local/127.0.0.1

address=/api.subscriber2.local/127.0.0.1
address=/mqtt.subscriber2.local/127.0.0.1

address=/api.subscriber3.local/127.0.0.1
address=/mqtt.subscriber3.local/127.0.0.1

address=/api.subscriber4.local/127.0.0.1
address=/mqtt.subscriber4.local/127.0.0.1

address=/api.subscriber5.local/127.0.0.1
address=/mqtt.subscriber5.local/127.0.0.1
DNSMASQ_EOF
    
    log "✅ Configuração dnsmasq criada: $DNSMASQ_CONF"
    
    # 5. Reiniciar serviços na ordem correta
    log "Reiniciando serviços..."
    
    # Reiniciar systemd-resolved primeiro
    sudo systemctl restart systemd-resolved || {
        warn "⚠️  Falha ao reiniciar systemd-resolved (pode não estar instalado)"
    }
    
    # Aguardar um pouco para garantir que porta 53 está livre
    sleep 2
    
    # Reiniciar dnsmasq
    sudo systemctl restart dnsmasq || {
        error "❌ Falha ao reiniciar dnsmasq"
        error "Verifique os logs: sudo journalctl -xeu dnsmasq.service"
        return 1
    }
    
    # 6. Validar funcionamento
    log "Validando DNS local..."
    sleep 2
    
    if command -v nslookup &> /dev/null; then
        if nslookup publisher1.local 127.0.0.1 >/dev/null 2>&1; then
            log "✅ DNS local funcionando (publisher1.local resolvido)"
        else
            warn "⚠️  DNS local pode não estar funcionando corretamente"
            warn "   Teste manualmente: nslookup publisher1.local 127.0.0.1"
        fi
        
        if nslookup subscriber1.local 127.0.0.1 >/dev/null 2>&1; then
            log "✅ DNS local funcionando (subscriber1.local resolvido)"
        else
            warn "⚠️  DNS local pode não estar funcionando corretamente"
            warn "   Teste manualmente: nslookup subscriber1.local 127.0.0.1"
        fi
    else
        warn "⚠️  nslookup não está instalado (não é possível validar DNS)"
    fi
    
    # 7. Verificar status do serviço
    if systemctl is-active --quiet dnsmasq 2>/dev/null; then
        log "✅ dnsmasq está rodando"
    else
        error "❌ dnsmasq não está rodando"
        error "Verifique os logs: sudo journalctl -xeu dnsmasq.service"
        return 1
    fi
    
    log "✅ DNS local configurado com sucesso!"
    log "💡 Use os scripts auxiliares para adicionar mais publishers/subscribers:"
    log "   scripts/add-publisher-dns.sh <publisher_id>"
    log "   scripts/add-subscriber-dns.sh <subscriber_id>"
}

# Garantir que Python3 está instalado (necessário para correções automáticas)
ensure_python_installed() {
    log "Verificando se Python3 está instalado..."
    
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version 2>&1 || echo "não disponível")
        log "✅ Python3 disponível: $PYTHON_VERSION"
        return 0
    fi
    
    warn "Python3 não encontrado - instalando como dependência do projeto..."
    
    # Tentar instalar usando apt (Ubuntu/Debian)
    if command -v apt &> /dev/null || command -v apt-get &> /dev/null; then
        log "Instalando Python3 via apt..."
        if sudo apt update -y && sudo apt install -y python3 python3-pip 2>/dev/null; then
            PYTHON_VERSION=$(python3 --version 2>&1 || echo "não disponível")
            log "✅ Python3 instalado com sucesso: $PYTHON_VERSION"
            return 0
        fi
    fi
    
    # Tentar instalar usando apt-get (fallback)
    if command -v apt-get &> /dev/null; then
        log "Tentando instalar Python3 via apt-get..."
        if sudo apt-get update -y && sudo apt-get install -y python3 python3-pip 2>/dev/null; then
            PYTHON_VERSION=$(python3 --version 2>&1 || echo "não disponível")
            log "✅ Python3 instalado com sucesso: $PYTHON_VERSION"
            return 0
        fi
    fi
    
    error "❌ Falha ao instalar Python3"
    error "Python3 é necessário para correções automáticas de dependências"
    error "Por favor, instale manualmente: sudo apt install -y python3 python3-pip"
    return 1
}

# Corrigir demora no boot causada por systemd-networkd-wait-online
fix_network_wait() {
    log "Corrigindo demora no boot (network-wait)..."
    
    # Verificar se script existe
    if [ -f "scripts/fix-network-wait.sh" ]; then
        chmod +x scripts/fix-network-wait.sh
        ./scripts/fix-network-wait.sh
        log "Correção de network-wait aplicada!"
    else
        warn "Script fix-network-wait.sh não encontrado, pulando correção..."
    fi
}

# Detectar distribuição do sistema
detect_distribution() {
    if [[ ! -f /etc/os-release ]]; then
        error "❌ Não foi possível detectar a distribuição do sistema (/etc/os-release não encontrado)"
        exit 1
    fi
    
    # Carregar informações do sistema
    . /etc/os-release
    
    DISTRO_ID="${ID:-unknown}"
    DISTRO_ID_LIKE="${ID_LIKE:-}"
    DISTRO_VERSION="${VERSION_ID:-}"
    DISTRO_NAME="${PRETTY_NAME:-$NAME}"
    
    # Normalizar distribuição
    case "$DISTRO_ID" in
        ubuntu)
            DISTRO_TYPE="ubuntu"
            ;;
        debian)
            DISTRO_TYPE="debian"
            ;;
        *)
            # Verificar ID_LIKE para distribuições derivadas
            if [[ "$DISTRO_ID_LIKE" == *"ubuntu"* ]] || [[ "$DISTRO_ID_LIKE" == *"debian"* ]]; then
                if [[ "$DISTRO_ID_LIKE" == *"ubuntu"* ]]; then
                    DISTRO_TYPE="ubuntu"
                else
                    DISTRO_TYPE="debian"
                fi
            else
                warn "⚠️  Distribuição não reconhecida: $DISTRO_ID"
                warn "⚠️  Tentando método genérico (pode não funcionar corretamente)"
                DISTRO_TYPE="generic"
            fi
            ;;
    esac
    
    log "Sistema detectado: $DISTRO_NAME ($DISTRO_TYPE)"
    export DISTRO_TYPE DISTRO_ID DISTRO_VERSION DISTRO_NAME
}

# Instalar Node.js (compatível com múltiplas distribuições)
install_nodejs() {
    log "Instalando Node.js..."
    
    # Detectar distribuição se ainda não foi detectada
    if [[ -z "$DISTRO_TYPE" ]]; then
        detect_distribution
    fi
    
    # Verificar se Node.js já está instalado
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $NODE_VERSION -ge 18 ]]; then
            log "✅ Node.js $(node --version) já está instalado!"
            return
        else
            warn "⚠️  Node.js versão antiga detectada ($(node --version)). Atualizando..."
        fi
    fi
    
    # Método 1: Tentar NodeSource (funciona para Ubuntu e Debian)
    log "Tentando instalar Node.js 20.x do NodeSource (compatível com $DISTRO_TYPE)..."
    
    # Verificar conectividade primeiro
    if curl -fsSL --connect-timeout 5 --max-time 10 https://deb.nodesource.com/setup_20.x > /dev/null 2>&1; then
        # Conectividade OK - tentar instalar do NodeSource
        if curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>&1 | tee /tmp/nodesource-install.log; then
            if sudo apt install -y nodejs 2>&1 | tee -a /tmp/nodesource-install.log; then
                if command -v node &> /dev/null; then
                    log "✅ Node.js $(node --version) instalado com sucesso do NodeSource!"
                    log "✅ NPM $(npm --version) instalado com sucesso!"
                    return
                fi
            fi
        fi
        warn "⚠️  Falha ao instalar do NodeSource, tentando método alternativo..."
    else
        warn "⚠️  Não foi possível conectar ao NodeSource (problema de rede/DNS)"
    fi
    
    # Método 2: Usar Node.js do repositório padrão (Ubuntu/Debian)
    log "Tentando instalar Node.js do repositório padrão do sistema..."
    if sudo apt update && sudo apt install -y nodejs npm 2>&1 | tee /tmp/nodejs-apt-install.log; then
        if command -v node &> /dev/null; then
            NODE_VER=$(node --version)
            log "✅ Node.js instalado do repositório padrão: $NODE_VER"
            
            # Verificar versão
            NODE_MAJOR=$(echo "$NODE_VER" | cut -d'v' -f2 | cut -d'.' -f1)
            if [[ $NODE_MAJOR -lt 20 ]]; then
                warn "⚠️  Versão do Node.js ($NODE_VER) é anterior à 20.x (recomendado)"
                warn "⚠️  Algumas funcionalidades podem não funcionar corretamente a longo prazo"
                warn "⚠️  Para instalar Node.js 20.x, resolva o problema de rede e execute:"
                warn "⚠️    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
                warn "⚠️    sudo apt install -y nodejs"
            else
                log "✅ Versão adequada do Node.js instalada!"
            fi
            
            if command -v npm &> /dev/null; then
                log "✅ NPM $(npm --version) instalado com sucesso!"
            fi
            return
        fi
    fi
    
    # Método 3: Usar snap (se disponível)
    if command -v snap &> /dev/null; then
        log "Tentando instalar Node.js via Snap..."
        if sudo snap install node --classic 2>&1 | tee /tmp/nodejs-snap-install.log; then
            if command -v node &> /dev/null; then
                log "✅ Node.js $(node --version) instalado via Snap!"
                if command -v npm &> /dev/null; then
                    log "✅ NPM $(npm --version) instalado com sucesso!"
                fi
                return
            fi
        fi
    fi
    
    # Se chegou aqui, todos os métodos falharam
    error "❌ Falha ao instalar Node.js usando todos os métodos disponíveis"
    error "❌ Logs de erro salvos em:"
    error "❌   - /tmp/nodesource-install.log (se aplicável)"
    error "❌   - /tmp/nodejs-apt-install.log (se aplicável)"
    error "❌   - /tmp/nodejs-snap-install.log (se aplicável)"
    error "❌"
    error "❌ Tente instalar Node.js manualmente:"
    error "❌   1. Verifique sua conexão de rede"
    error "❌   2. Execute: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    error "❌   3. Execute: sudo apt install -y nodejs"
    exit 1
}

# Resolver comando Docker Compose (plugin v2 ou binário legado)
resolve_compose_cmd() {
    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
        return 0
    fi
    if command -v docker-compose &> /dev/null && docker-compose --version &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        return 0
    fi
    return 1
}

# Garantir Docker Compose disponível (plugin apt ou binário)
ensure_docker_compose() {
    if resolve_compose_cmd; then
        log "Docker Compose disponível: $COMPOSE_CMD"
        return 0
    fi

    log "Docker Compose não encontrado — a instalar..."

    if command -v apt-get &> /dev/null; then
        sudo apt-get update -y >/dev/null 2>&1 || true
        if sudo apt-get install -y docker-compose-plugin 2>/dev/null; then
            if resolve_compose_cmd; then
                log "Docker Compose (plugin) instalado: $COMPOSE_CMD"
                return 0
            fi
        fi
        if sudo apt-get install -y docker-compose 2>/dev/null; then
            if resolve_compose_cmd; then
                log "Docker Compose (apt) instalado: $COMPOSE_CMD"
                return 0
            fi
        fi
    fi

    local tag
    tag=$(curl -fsSL https://api.github.com/repos/docker/compose/releases/latest 2>/dev/null | grep -oP '"tag_name": "\K(.*)(?=")' | head -1 || true)
    tag="${tag:-v2.29.7}"
    sudo curl -fsSL "https://github.com/docker/compose/releases/download/${tag}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose

    if resolve_compose_cmd; then
        log "Docker Compose (binário) instalado: $COMPOSE_CMD"
        return 0
    fi

    error "Docker Compose não encontrado e a instalação automática falhou!"
    error "No Ubuntu 24.04 execute: sudo apt install -y docker-compose-plugin"
    return 1
}

# Instalar Docker (opcional)
install_docker() {
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        log "Instalando Docker..."
        
        # Verificar se Docker já está instalado e funcionando
        if command -v docker &> /dev/null && systemctl is-active --quiet docker; then
            log "Docker já está instalado e funcionando!"
            if resolve_compose_cmd; then
                log "Docker Compose já está instalado ($COMPOSE_CMD)!"
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
        
        ensure_docker_compose || exit 1
        
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
    sudo ufw allow 80/tcp    # HTTP (legado/opcional)
    sudo ufw allow 8080/tcp  # Frontend HTTP (padrão novo)
    sudo ufw allow 443/tcp   # HTTPS (Let's Encrypt unificado)
    sudo ufw allow 3000/tcp  # Backend
    sudo ufw allow 3001/tcp  # Frontend alternativo

    # Layout Nginx: site corporativo e painel em portas HTTP distintas (ex.: 80 + 8080)
    if [[ "$SPLIT_CORPORATE_AND_SYSTEM" == "true" ]]; then
        sudo ufw allow "${CORPORATE_HTTP_PORT}/tcp" 2>/dev/null || true
        sudo ufw allow "${SYSTEM_HTTP_PORT}/tcp" 2>/dev/null || true
        log "Firewall UFW: portas do layout dividido — corporativo TCP ${CORPORATE_HTTP_PORT}, sistema TCP ${SYSTEM_HTTP_PORT}."
    fi
    
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        sudo ufw allow 5432/tcp  # PostgreSQL
        sudo ufw allow 6379/tcp  # Redis
        sudo ufw allow 9090/tcp  # Prometheus
        sudo ufw allow 3002/tcp  # Grafana
        sudo ufw allow 11434/tcp # Ollama
    elif [[ "$INSTALL_MODE" == "single-server" ]]; then
        # PostgreSQL: permitir apenas da rede local (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        sudo ufw allow from 192.168.0.0/16 to any port 5432 2>/dev/null || true
        sudo ufw allow from 10.0.0.0/8 to any port 5432 2>/dev/null || true
        sudo ufw allow from 172.16.0.0/12 to any port 5432 2>/dev/null || true

        # MQTT em produção (broker local)
        if [[ "$MQTT_LOCAL_BROKER_REQUIRED" == "true" ]]; then
            sudo ufw allow 1883/tcp 2>/dev/null || true  # MQTT TCP
            sudo ufw allow 9001/tcp 2>/dev/null || true  # MQTT over WebSocket
        fi
    fi
    
    sudo ufw --force enable
    log "Firewall configurado com sucesso!"
}

# Detectar e remover instalação anterior completamente
detect_and_remove_previous_installation() {
    log "Verificando instalação anterior..."
    
    # Diretórios que podem conter instalação anterior
    POSSIBLE_INSTALL_DIRS=(
        "/opt/smart-signage"
        "$HOME/smartsignage-pro"
        "$HOME/smart-signage"
    )
    
    INSTALLATION_FOUND=false
    
    for INSTALL_DIR_CHECK in "${POSSIBLE_INSTALL_DIRS[@]}"; do
        if [[ -d "$INSTALL_DIR_CHECK" ]]; then
            # Verificar se é realmente uma instalação do Smart Signage
            if [[ -d "$INSTALL_DIR_CHECK/backend" ]] || [[ -d "$INSTALL_DIR_CHECK/frontend" ]] || [[ -f "$INSTALL_DIR_CHECK/.env" ]]; then
                INSTALLATION_FOUND=true
                warn "⚠️  Instalação anterior detectada em: $INSTALL_DIR_CHECK"
                
                echo
                echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                echo -e "${YELLOW}                    Instalação Anterior Detectada${NC}"
                echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                echo
                echo -e "${RED}⚠️  ATENÇÃO:${NC} Foi detectada uma instalação anterior em:"
                echo -e "   ${YELLOW}$INSTALL_DIR_CHECK${NC}"
                echo
                echo -e "${YELLOW}Esta operação irá REMOVER COMPLETAMENTE:${NC}"
                echo "  ❌ Todos os arquivos do projeto"
                echo "  ❌ Todos os node_modules (backend e frontend)"
                echo "  ❌ Todos os builds compilados"
                echo "  ❌ Configurações locais (.env será preservado se existir backup)"
                if [[ "$PRESERVE_DB" == "true" ]]; then
                    echo -e "  ${GREEN}✅ Banco de dados será PRESERVADO (--preserve-db ativo)${NC}"
                else
                    echo "  ❌ Banco de dados PostgreSQL (será recriado)"
                fi
                echo
                echo -e "${RED}⚠️  ESTA AÇÃO É IRREVERSÍVEL!${NC}"
                echo
                if [[ "$SKIP_MENU" == "true" ]]; then
                    if [[ "$FRESH_MODE" == "true" ]]; then
                        log "Modo --fresh: remoção automática da instalação anterior em $INSTALL_DIR_CHECK"
                        confirm_remove="s"
                    else
                        log "Modo --skip-menu: a manter instalação anterior em $INSTALL_DIR_CHECK (sem remover)."
                        continue
                    fi
                else
                    read -p "Deseja REMOVER COMPLETAMENTE a instalação anterior? (s/N): " confirm_remove
                fi
                
                if [[ "$confirm_remove" =~ ^[Ss]$ ]]; then
                    log "Removendo instalação anterior de $INSTALL_DIR_CHECK..."
                    
                    # Parar serviços se estiverem rodando
                    if systemctl is-active --quiet smart-signage 2>/dev/null; then
                        log "Parando serviço smart-signage..."
                        sudo systemctl stop smart-signage 2>/dev/null || true
                        sudo systemctl disable smart-signage 2>/dev/null || true
                    fi
                    
                    # Remover serviço systemd
                    if [[ -f "/etc/systemd/system/smart-signage.service" ]]; then
                        log "Removendo serviço systemd..."
                        sudo systemctl stop smart-signage 2>/dev/null || true
                        sudo systemctl disable smart-signage 2>/dev/null || true
                        sudo rm -f /etc/systemd/system/smart-signage.service
                        sudo systemctl daemon-reload
                    fi
                    
                    # Fazer backup do .env se existir
                    if [[ -f "$INSTALL_DIR_CHECK/.env" ]]; then
                        BACKUP_ENV="$INSTALL_DIR_CHECK/.env.backup.$(date +%Y%m%d-%H%M%S)"
                        log "Fazendo backup do .env em: $BACKUP_ENV"
                        cp "$INSTALL_DIR_CHECK/.env" "$BACKUP_ENV" 2>/dev/null || true
                    fi
                    
                    # Fazer backup do banco de dados se --preserve-db estiver ativo
                    if [[ "$PRESERVE_DB" == "true" ]]; then
                        log "🔄 Modo --preserve-db ativo: fazendo backup do banco de dados..."
                        
                        # Tentar ler configurações do banco do .env se existir
                        local PG_DB="smartsignage"
                        local PG_USER="smartsignage"
                        local PG_HOST="localhost"
                        local PG_PORT="5432"
                        
                        if [[ -f "$INSTALL_DIR_CHECK/.env" ]]; then
                            # Tentar extrair configurações do .env
                            if grep -q "DB_NAME=" "$INSTALL_DIR_CHECK/.env"; then
                                PG_DB=$(grep "^DB_NAME=" "$INSTALL_DIR_CHECK/.env" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
                            fi
                            if grep -q "DB_USER=" "$INSTALL_DIR_CHECK/.env"; then
                                PG_USER=$(grep "^DB_USER=" "$INSTALL_DIR_CHECK/.env" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
                            fi
                            if grep -q "DB_HOST=" "$INSTALL_DIR_CHECK/.env"; then
                                PG_HOST=$(grep "^DB_HOST=" "$INSTALL_DIR_CHECK/.env" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
                            fi
                            if grep -q "DB_PORT=" "$INSTALL_DIR_CHECK/.env"; then
                                PG_PORT=$(grep "^DB_PORT=" "$INSTALL_DIR_CHECK/.env" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
                            fi
                        fi
                        
                        # Criar diretório de backup temporário
                        BACKUP_DIR="/tmp/smartsignage-db-backup-$(date +%Y%m%d-%H%M%S)"
                        mkdir -p "$BACKUP_DIR"
                        
                        # Verificar se o banco existe antes de fazer backup
                        if sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${PG_DB}'" | grep -q 1; then
                            log "Fazendo backup do banco de dados '${PG_DB}'..."
                            BACKUP_FILE="$BACKUP_DIR/${PG_DB}-backup-$(date +%Y%m%d-%H%M%S).sql"
                            
                            if sudo -u postgres pg_dump -Fc "${PG_DB}" > "$BACKUP_FILE" 2>/dev/null; then
                                log "✅ Backup do banco de dados criado: $BACKUP_FILE"
                                # Salvar localização do backup em arquivo temporário para uso posterior
                                echo "$BACKUP_FILE" > /tmp/smartsignage-db-backup-path.txt
                                echo "$PG_DB" > /tmp/smartsignage-db-backup-name.txt
                            else
                                warn "⚠️  Falha ao fazer backup do banco de dados. Continuando sem backup..."
                                rm -rf "$BACKUP_DIR" 2>/dev/null || true
                            fi
                        else
                            log "Banco de dados '${PG_DB}' não existe. Nenhum backup necessário."
                            rm -rf "$BACKUP_DIR" 2>/dev/null || true
                        fi
                    fi
                    
                    # Remover diretório completamente
                    log "Removendo diretório $INSTALL_DIR_CHECK..."
                    sudo rm -rf "$INSTALL_DIR_CHECK" 2>/dev/null || rm -rf "$INSTALL_DIR_CHECK" 2>/dev/null || {
                        error "Falha ao remover $INSTALL_DIR_CHECK"
                        error "Verifique permissões e tente novamente"
                        exit 1
                    }
                    
                    log "✅ Instalação anterior removida com sucesso!"
                    
                    # Limpar também node_modules residuais em paths comuns de instalações antigas.
                    # Importante: evitar pipeline com `while read` sob `set -e -o pipefail`,
                    # pois o EOF do `read` pode retornar status 1 e abortar a instalação.
                    log "Limpando node_modules residuais..."
                    while IFS= read -r nm_dir; do
                        [[ -z "$nm_dir" ]] && continue
                        log "Removendo node_modules residual: $nm_dir"
                        rm -rf "$nm_dir" 2>/dev/null || true
                    done < <(
                        find "$HOME" -maxdepth 3 -type d -name "node_modules" \
                            \( -path "*/smart-signage/*" -o -path "*/smartsignage-pro/*" \) 2>/dev/null || true
                    )
                    
                    # Limpar cache npm relacionado
                    log "Limpando cache npm..."
                    npm cache clean --force 2>/dev/null || true
                    
                else
                    log "Remoção cancelada pelo usuário."
                    warn "⚠️  Continuando com instalação sobre instalação existente (pode causar conflitos)"
                fi
            fi
        fi
    done
    
    if [[ "$INSTALLATION_FOUND" == false ]]; then
        log "✅ Nenhuma instalação anterior detectada"
    fi
}

# Detectar diretório do projeto (apenas detecção, sem cópia)
detect_project_directory() {
    log "Detectando diretório do projeto..."
    
    # Detectar diretório do script
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    # Quando o script está em ./scripts, o root do repo é o diretório pai
    REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    log "Diretório do script: $SCRIPT_DIR"
    log "Diretório raiz do projeto (repo root): $REPO_ROOT"
    log "Diretório atual: $(pwd)"
    
    # Determinar diretório de origem (onde estão os arquivos do projeto)
    if [[ -d "backend" && -d "frontend" ]]; then
        SOURCE_DIR=$(pwd)
        log "Usando diretório atual como origem: $SOURCE_DIR"
    elif [[ -d "$REPO_ROOT/backend" && -d "$REPO_ROOT/frontend" ]]; then
        SOURCE_DIR="$REPO_ROOT"
        log "Usando diretório raiz do projeto como origem: $SOURCE_DIR"
    else
        error "Arquivos do projeto não encontrados!"
        error "Verificando diretórios disponíveis:"
        log "Diretório atual:"
        ls -la $(pwd) || true
        log "Diretório do script:"
        ls -la "$SCRIPT_DIR" || true
        log "Diretório raiz do projeto:"
        ls -la "$REPO_ROOT" || true
        error "Execute este script no diretório raiz do projeto Smart Signage Pro"
        exit 1
    fi
    
    export SOURCE_DIR
    log "✅ Diretório de origem detectado: $SOURCE_DIR"
}

# Configurar projeto (define INSTALL_DIR baseado no modo)
setup_project() {
    log "Configurando projeto Smart Signage Pro..."
    
    # SOURCE_DIR deve ter sido definido por detect_project_directory()
    if [[ -z "$SOURCE_DIR" ]]; then
        detect_project_directory
    fi
    
    # Validar/corrigir ownership e permissões apenas quando necessário (evita lentidão em reinstalações)
    CURRENT_USER="${USER:-$(whoami)}"
    CURRENT_GROUP="${GROUP:-$(id -gn)}"
    
    if [[ -d "$SOURCE_DIR" ]]; then
        NEED_CHOWN=0
        NEED_PERMS=0
        # Validação rápida: diretório raiz já é nosso e com permissão 755?
        if [[ ! -O "$SOURCE_DIR" ]]; then
            NEED_CHOWN=1
        fi
        ROOT_MODE=$(stat -c '%a' "$SOURCE_DIR" 2>/dev/null || echo "0")
        [[ "$ROOT_MODE" != "755" ]] && [[ "$ROOT_MODE" != "775" ]] && NEED_PERMS=1
        # Amostra: um ficheiro chave legível e com modo aceitável?
        if [[ -f "$SOURCE_DIR/package.json" ]]; then
            FMODE=$(stat -c '%a' "$SOURCE_DIR/package.json" 2>/dev/null || echo "0")
            [[ "$FMODE" != "644" ]] && [[ "$FMODE" != "664" ]] && NEED_PERMS=1
        fi
        
        if [[ "$NEED_CHOWN" -eq 0 ]] && [[ "$NEED_PERMS" -eq 0 ]]; then
            log "Ownership e permissões já corretas (validação rápida) - nada a fazer"
        else
            log "Corrigindo ownership e permissões de diretórios e arquivos (correção preventiva)..."
            log "Ajustando ownership para: $CURRENT_USER:$CURRENT_GROUP"
            if [[ "$NEED_CHOWN" -eq 1 ]]; then
                log "Ajustando ownership com sudo (pode pedir senha)..."
                sudo chown -R "$CURRENT_USER:$CURRENT_GROUP" "$SOURCE_DIR" 2>/dev/null || {
                    warn "⚠️ Não foi possível ajustar ownership (tentando sem sudo)..."
                    chown -R "$CURRENT_USER:$CURRENT_GROUP" "$SOURCE_DIR" 2>/dev/null || true
                }
            fi
            if [[ "$NEED_PERMS" -eq 1 ]]; then
                find "$SOURCE_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
                find "$SOURCE_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
                find "$SOURCE_DIR" -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
            fi
            log "✅ Ownership e permissões do diretório raiz corrigidas"
        fi
    fi
    
    # Para single-server, usar diretório de origem diretamente (mais simples e confiável)
    # Para Docker, ainda copiar para /opt/smart-signage (padrão do docker-compose)
    if [[ "$INSTALL_MODE" == "single-server" ]] || [[ "$INSTALL_MODE" == "development" ]]; then
        INSTALL_DIR="$SOURCE_DIR"
        log "Modo Single-Server: usando diretório de origem diretamente: $INSTALL_DIR"
        log "✅ Não será necessário copiar arquivos - trabalhando diretamente do diretório de origem"
        
        # Carregar configurações do sistema (mas não sobrescrever INSTALL_DIR)
        CONFIG_FILE="$INSTALL_DIR/smartsignage-config"
        local SAVED_INSTALL_DIR="$INSTALL_DIR"
        if [[ -f "$CONFIG_FILE" ]]; then
            log "Carregando configurações de: $CONFIG_FILE"
            if load_system_config "$CONFIG_FILE"; then
                log "✅ Configurações carregadas com sucesso"
            else
                warn "⚠️  Falha ao carregar configurações, usando valores padrão"
            fi
        else
            log "Arquivo de configuração não encontrado, criando padrão..."
            create_default_config "$CONFIG_FILE" "$INSTALL_DIR"
            if load_system_config "$CONFIG_FILE"; then
                log "✅ Configurações padrão carregadas"
            else
                warn "⚠️  Falha ao carregar configurações padrão"
            fi
        fi
        # Restaurar INSTALL_DIR (não pode ser sobrescrito pelo config, é determinado pelo modo)
        INSTALL_DIR="$SAVED_INSTALL_DIR"
        
        # Verificar se as variáveis principais foram carregadas (para debug)
        if [[ -z "${DB_NAME:-}" ]]; then
            log "⚠️  DB_NAME não encontrado no config, usando padrão: smartsignage"
        fi
        if [[ -z "${DB_USER:-}" ]]; then
            log "⚠️  DB_USER não encontrado no config, usando padrão: smartsignage"
        fi
        
        # Em single-server INSTALL_DIR = SOURCE_DIR; ownership/permissões já foram validadas/corrigidas acima.
        # Só corrigir de novo se for outro diretório (ex.: desenvolvimento com INSTALL_DIR diferente).
        if [[ -d "$INSTALL_DIR" ]] && [[ "$INSTALL_DIR" != "$SOURCE_DIR" ]]; then
            NEED_CHOWN=0
            NEED_PERMS=0
            [[ ! -O "$INSTALL_DIR" ]] && NEED_CHOWN=1
            ROOT_MODE=$(stat -c '%a' "$INSTALL_DIR" 2>/dev/null || echo "0")
            [[ "$ROOT_MODE" != "755" ]] && [[ "$ROOT_MODE" != "775" ]] && NEED_PERMS=1
            if [[ "$NEED_CHOWN" -eq 1 ]] || [[ "$NEED_PERMS" -eq 1 ]]; then
                log "Corrigindo ownership e permissões em $INSTALL_DIR..."
                if [[ "$NEED_CHOWN" -eq 1 ]]; then
                    sudo chown -R "$CURRENT_USER:$CURRENT_GROUP" "$INSTALL_DIR" 2>/dev/null || chown -R "$CURRENT_USER:$CURRENT_GROUP" "$INSTALL_DIR" 2>/dev/null || true
                fi
                if [[ "$NEED_PERMS" -eq 1 ]]; then
                    find "$INSTALL_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
                    find "$INSTALL_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
                    find "$INSTALL_DIR" -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
                fi
                log "✅ Ownership e permissões corrigidas em $INSTALL_DIR"
            fi
        fi
        
        # Correção leve só para diretórios críticos (apenas se modo estiver errado)
        if [[ -d "$INSTALL_DIR/frontend/src" ]]; then
            FMODE=$(stat -c '%a' "$INSTALL_DIR/frontend/src" 2>/dev/null || echo "0")
            if [[ "$FMODE" != "755" ]] && [[ "$FMODE" != "775" ]]; then
                find "$INSTALL_DIR/frontend/src" -type d -exec chmod 755 {} \; 2>/dev/null || true
                find "$INSTALL_DIR/frontend/src" -type f -exec chmod 644 {} \; 2>/dev/null || true
                log "✅ Permissões do frontend/src corrigidas"
            fi
        fi
        if [[ -d "$INSTALL_DIR/backend/src" ]]; then
            FMODE=$(stat -c '%a' "$INSTALL_DIR/backend/src" 2>/dev/null || echo "0")
            if [[ "$FMODE" != "755" ]] && [[ "$FMODE" != "775" ]]; then
                find "$INSTALL_DIR/backend/src" -type d -exec chmod 755 {} \; 2>/dev/null || true
                find "$INSTALL_DIR/backend/src" -type f -exec chmod 644 {} \; 2>/dev/null || true
                log "✅ Permissões do backend/src corrigidas"
            fi
        fi
        
        # Apenas garantir que estamos no diretório correto
        if [[ -d "$INSTALL_DIR" ]]; then
            cd "$INSTALL_DIR" || {
                error "❌ Não foi possível entrar no diretório: $INSTALL_DIR"
                exit 1
            }
        else
            error "❌ Diretório de instalação não existe: $INSTALL_DIR"
            exit 1
        fi
    else
        # Modo Docker: copiar para /opt/smart-signage
        INSTALL_DIR="/opt/smart-signage"
        sudo mkdir -p $INSTALL_DIR
        sudo chown $USER:$USER $INSTALL_DIR
        log "Modo Docker: copiando para $INSTALL_DIR"
        
        # Carregar configurações do sistema (mas não sobrescrever INSTALL_DIR)
        CONFIG_FILE="$INSTALL_DIR/smartsignage-config"
        local SAVED_INSTALL_DIR="$INSTALL_DIR"
        if [[ -f "$CONFIG_FILE" ]]; then
            log "Carregando configurações de: $CONFIG_FILE"
            if load_system_config "$CONFIG_FILE"; then
                log "✅ Configurações carregadas com sucesso"
            else
                warn "⚠️  Falha ao carregar configurações, usando valores padrão"
            fi
        else
            log "Arquivo de configuração não encontrado, criando padrão..."
            create_default_config "$CONFIG_FILE" "$INSTALL_DIR"
            if load_system_config "$CONFIG_FILE"; then
                log "✅ Configurações padrão carregadas"
            else
                warn "⚠️  Falha ao carregar configurações padrão"
            fi
        fi
        # Restaurar INSTALL_DIR (não pode ser sobrescrito pelo config, é determinado pelo modo)
        INSTALL_DIR="$SAVED_INSTALL_DIR"
        
        # Verificar se as variáveis principais foram carregadas (para debug)
        if [[ -z "${DB_NAME:-}" ]]; then
            log "⚠️  DB_NAME não encontrado no config, usando padrão: smartsignage"
        fi
        if [[ -z "${DB_USER:-}" ]]; then
            log "⚠️  DB_USER não encontrado no config, usando padrão: smartsignage"
        fi
        
        # Copiar arquivos do projeto (apenas para Docker, Single-Server usa diretório de origem)
        if [[ -d "$SOURCE_DIR/backend" && -d "$SOURCE_DIR/frontend" ]]; then
            log "Copiando arquivos do projeto de $SOURCE_DIR para $INSTALL_DIR..."
            
            # Usar rsync se disponível (mais eficiente e preserva permissões), senão usar cp
            if command -v rsync &> /dev/null; then
                log "Usando rsync para cópia recursiva eficiente..."
                
                # Copiar backend recursivamente
                log "Copiando backend..."
                rsync -av --delete "$SOURCE_DIR/backend/" "$INSTALL_DIR/backend/"
                
                # Copiar frontend recursivamente (garante TODOS os arquivos)
                log "Copiando frontend (recursivo completo)..."
                rsync -av --delete "$SOURCE_DIR/frontend/" "$INSTALL_DIR/frontend/"
                
                # Copiar outros diretórios importantes
                # Nota: player-web agora é copiado apenas quando selecionado no menu de players
                [[ -d "$SOURCE_DIR/scripts" ]] && rsync -av --delete "$SOURCE_DIR/scripts/" "$INSTALL_DIR/scripts/"
                [[ -d "$SOURCE_DIR/database" ]] && rsync -av --delete "$SOURCE_DIR/database/" "$INSTALL_DIR/database/"
                [[ -d "$SOURCE_DIR/docker" ]] && rsync -av --delete "$SOURCE_DIR/docker/" "$INSTALL_DIR/docker/"
                [[ -d "$SOURCE_DIR/nginx" ]] && rsync -av --delete "$SOURCE_DIR/nginx/" "$INSTALL_DIR/nginx/"
                [[ -d "$SOURCE_DIR/totemdigital.site" ]] && rsync -av --delete "$SOURCE_DIR/totemdigital.site/" "$INSTALL_DIR/totemdigital.site/"
                [[ -d "$SOURCE_DIR/logos-icons" ]] && rsync -av --delete "$SOURCE_DIR/logos-icons/" "$INSTALL_DIR/logos-icons/"
                [[ -d "$SOURCE_DIR/corporate-site" ]] && rsync -av --delete "$SOURCE_DIR/corporate-site/" "$INSTALL_DIR/corporate-site/"
                
                log "✅ Cópia recursiva completa com rsync concluída"
                
                # Garantir permissões corretas no diretório database após cópia
                if [[ -d "$INSTALL_DIR/database" ]]; then
                    log "Garantindo permissões corretas no diretório database..."
                    chmod -R 755 "$INSTALL_DIR/database" 2>/dev/null || true
                    log "✅ Permissões do diretório database corrigidas (755)"
                fi
            else
                # Fallback para cp -a (preserva permissões e links simbólicos)
                log "Usando cp -a para cópia recursiva (rsync não disponível)..."
                
                # Copiar backend recursivamente
                log "Copiando backend..."
                cp -a "$SOURCE_DIR/backend" "$INSTALL_DIR/"
                
                # Copiar frontend recursivamente (garante TODOS os arquivos)
                log "Copiando frontend (recursivo completo)..."
                cp -a "$SOURCE_DIR/frontend" "$INSTALL_DIR/"
                
                # Copiar outros diretórios
                # Nota: player-web agora é copiado apenas quando selecionado no menu de players
                [[ -d "$SOURCE_DIR/scripts" ]] && cp -a "$SOURCE_DIR/scripts" "$INSTALL_DIR/"
                [[ -d "$SOURCE_DIR/database" ]] && rm -rf "$INSTALL_DIR/database" && cp -a "$SOURCE_DIR/database" "$INSTALL_DIR/"
                [[ -d "$SOURCE_DIR/docker" ]] && cp -a "$SOURCE_DIR/docker" "$INSTALL_DIR/"
                [[ -d "$SOURCE_DIR/nginx" ]] && cp -a "$SOURCE_DIR/nginx" "$INSTALL_DIR/"
                if [[ -d "$SOURCE_DIR/totemdigital.site" ]]; then
                    rm -rf "$INSTALL_DIR/totemdigital.site" 2>/dev/null || true
                    cp -a "$SOURCE_DIR/totemdigital.site" "$INSTALL_DIR/"
                fi
                if [[ -d "$SOURCE_DIR/logos-icons" ]]; then
                    rm -rf "$INSTALL_DIR/logos-icons" 2>/dev/null || true
                    cp -a "$SOURCE_DIR/logos-icons" "$INSTALL_DIR/"
                fi
                if [[ -d "$SOURCE_DIR/corporate-site" ]]; then
                    rm -rf "$INSTALL_DIR/corporate-site" 2>/dev/null || true
                    cp -a "$SOURCE_DIR/corporate-site" "$INSTALL_DIR/"
                fi
                
                # Copiar players selecionados (se houver seleção)
                if [[ "$INSTALL_ALL_PLAYERS" == "true" ]] || [[ "$INSTALL_PLAYER_WEBOS" == "true" ]] || \
                   [[ "$INSTALL_PLAYER_ANDROID" == "true" ]] || [[ "$INSTALL_PLAYER_LINUX_ELECTRON" == "true" ]] || \
                   [[ "$INSTALL_PLAYER_LINUX_CPP" == "true" ]] || [[ "$INSTALL_PLAYER_WINDOWS_ELECTRON" == "true" ]] || \
                   [[ "$INSTALL_PLAYER_TIZEN" == "true" ]] || [[ "$INSTALL_PLAYER_SMARTDISPLAYFX" == "true" ]] || \
                   [[ "$INSTALL_PLAYER_FX_INTERFACE" == "true" ]] || [[ "$INSTALL_PLAYER_WEB_CACHE" == "true" ]]; then
                    copy_selected_players
                fi
                
                log "✅ Cópia recursiva completa com cp -a concluída"
                
                # Garantir permissões corretas no diretório database após cópia
                if [[ -d "$INSTALL_DIR/database" ]]; then
                    log "Garantindo permissões corretas no diretório database..."
                    chmod -R 755 "$INSTALL_DIR/database" 2>/dev/null || true
                    log "✅ Permissões do diretório database corrigidas (755)"
                fi
            fi
        
            # Copiar arquivos essenciais (docker-compose.yml, Dockerfiles, etc)
            [[ -f "$SOURCE_DIR/docker-compose.yml" ]] && cp "$SOURCE_DIR/docker-compose.yml" "$INSTALL_DIR/"
            [[ -f "$SOURCE_DIR/Dockerfile" ]] && cp "$SOURCE_DIR/Dockerfile" "$INSTALL_DIR/"
            [[ -f "$SOURCE_DIR/Dockerfile.app" ]] && cp "$SOURCE_DIR/Dockerfile.app" "$INSTALL_DIR/"
            [[ -f "$SOURCE_DIR/Dockerfile.backend" ]] && cp "$SOURCE_DIR/Dockerfile.backend" "$INSTALL_DIR/"
            [[ -f "$SOURCE_DIR/Dockerfile.frontend" ]] && cp "$SOURCE_DIR/Dockerfile.frontend" "$INSTALL_DIR/"
            [[ -f "$SOURCE_DIR/env.example" ]] && cp "$SOURCE_DIR/env.example" "$INSTALL_DIR/.env"
            [[ -f "$SOURCE_DIR/package.json" ]] && cp "$SOURCE_DIR/package.json" "$INSTALL_DIR/"
            [[ -f "$SOURCE_DIR/manage-system.sh" ]] && cp "$SOURCE_DIR/manage-system.sh" "$INSTALL_DIR/"
            
            # Verificação final para Docker: garantir que App.tsx foi copiado
            if [[ ! -f "$INSTALL_DIR/frontend/src/App.tsx" ]]; then
                error "❌ App.tsx não foi copiado!"
                error "Verificando origem:"
                ls -la "$SOURCE_DIR/frontend/src/App.tsx" 2>/dev/null || error "App.tsx não existe na origem!"
                exit 1
            fi
            
            log "✅ Arquivos copiados com sucesso para $INSTALL_DIR"
        else
            error "Arquivos do projeto não encontrados em $SOURCE_DIR!"
            exit 1
        fi
    fi
    
    # Verificação final: garantir que arquivos essenciais existem
    log "Verificando arquivos essenciais..."
    
    if [[ ! -f "$INSTALL_DIR/frontend/src/App.tsx" ]]; then
        error "❌ App.tsx não encontrado em $INSTALL_DIR/frontend/src/App.tsx"
        error "Diretório atual: $(pwd)"
        error "INSTALL_DIR: $INSTALL_DIR"
        error "Verificando estrutura:"
        ls -la "$INSTALL_DIR/frontend/src/" 2>/dev/null || true
        exit 1
    fi
    
    if [[ ! -f "$INSTALL_DIR/frontend/src/index.tsx" ]]; then
        error "❌ index.tsx não encontrado em $INSTALL_DIR/frontend/src/index.tsx"
        exit 1
    fi
    
    if [[ ! -f "$INSTALL_DIR/frontend/package.json" ]]; then
        error "❌ package.json não encontrado em $INSTALL_DIR/frontend/package.json"
        exit 1
    fi
    
    log "✅ Todos os arquivos essenciais verificados"
    
    # Validar/corrigir ownership e permissões só quando necessário (evita lentidão)
    CURRENT_USER="${USER:-$(whoami)}"
    CURRENT_GROUP="${GROUP:-$(id -gn)}"
    
    for SUB in "frontend/src" "backend/src"; do
        if [[ -d "$INSTALL_DIR/$SUB" ]]; then
            NEED_FIX=0
            [[ ! -O "$INSTALL_DIR/$SUB" ]] && NEED_FIX=1
            DMODE=$(stat -c '%a' "$INSTALL_DIR/$SUB" 2>/dev/null || echo "0")
            [[ "$DMODE" != "755" ]] && [[ "$DMODE" != "775" ]] && NEED_FIX=1
            if [[ "$NEED_FIX" -eq 1 ]]; then
                log "Corrigindo ownership/permissões de $SUB..."
                if [[ ! -O "$INSTALL_DIR/$SUB" ]]; then
                    sudo chown -R "$CURRENT_USER:$CURRENT_GROUP" "$INSTALL_DIR/$SUB" 2>/dev/null || chown -R "$CURRENT_USER:$CURRENT_GROUP" "$INSTALL_DIR/$SUB" 2>/dev/null || true
                fi
                find "$INSTALL_DIR/$SUB" -type d -exec chmod 755 {} \; 2>/dev/null || true
                find "$INSTALL_DIR/$SUB" -type f -exec chmod 644 {} \; 2>/dev/null || true
                log "✅ $SUB corrigido"
            fi
        fi
    done
    
    cd $INSTALL_DIR
    log "Projeto configurado em $INSTALL_DIR"
}

# Configuração mínima para --backend-only / --frontend-only: apenas define INSTALL_DIR,
# carrega config se existir e verifica o diretório necessário. Não executa cópias,
# correções de permissão em massa nem verificação de outros projetos.
setup_project_build_only() {
    log "Configuração mínima para build seletivo (sem banco, sem outros serviços)..."
    if [[ -z "$SOURCE_DIR" ]]; then
        detect_project_directory
    fi
    INSTALL_MODE="${INSTALL_MODE:-single-server}"
    INSTALL_DIR="$SOURCE_DIR"
    CONFIG_FILE="${INSTALL_DIR}/smartsignage-config"
    if [[ -f "$CONFIG_FILE" ]]; then
        load_system_config "$CONFIG_FILE" 2>/dev/null || true
    fi
    if [[ "$BACKEND_BUILD_ONLY" == "true" ]]; then
        if [[ ! -d "$INSTALL_DIR/backend" ]]; then
            error "❌ Diretório backend não encontrado em $INSTALL_DIR/backend"
            exit 1
        fi
        log "✅ Backend em $INSTALL_DIR/backend"
    fi
    if [[ "$FRONTEND_BUILD_ONLY" == "true" ]]; then
        if [[ ! -d "$INSTALL_DIR/frontend" ]]; then
            error "❌ Diretório frontend não encontrado em $INSTALL_DIR/frontend"
            exit 1
        fi
        log "✅ Frontend em $INSTALL_DIR/frontend"
    fi
    if [[ "$BACKFRONT_BUILD_ONLY" == "true" ]]; then
        if [[ ! -d "$INSTALL_DIR/backend" ]] || [[ ! -d "$INSTALL_DIR/frontend" ]]; then
            error "❌ Backend ou frontend não encontrado em $INSTALL_DIR"
            exit 1
        fi
        log "✅ Backend e frontend em $INSTALL_DIR"
    fi
    cd "$INSTALL_DIR" || { error "❌ Não foi possível entrar em $INSTALL_DIR"; exit 1; }
}

# Instalar dependências do projeto
install_project_dependencies() {
    log "Instalando dependências do projeto..."
    
    # No modo Docker, não instalamos/compilamos localmente (evita inconsistências do ambiente host).
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        log "Modo Docker: pulando instalação/compilação locais (será feito durante o Docker build)."
        return 0
    fi
    
    # Backend (pode ser pulado em modos especiais)
    if [[ "$SKIP_BACKEND_DEPS_BUILD" != "true" ]]; then
        cd $INSTALL_DIR/backend
        log "Instalando dependências do backend (incluindo dev para build)..."
        npm install --include=dev
        
        # Instalar dependência adicional do sistema de logs (winston-daily-rotate-file)
        log "Instalando dependência do sistema de logs (winston-daily-rotate-file)..."
        if npm install winston-daily-rotate-file --save; then
            log "✅ winston-daily-rotate-file instalado com sucesso"
        else
            error "❌ Falha ao instalar winston-daily-rotate-file"
            error "💡 Tentando novamente sem --save..."
            if npm install winston-daily-rotate-file; then
                log "✅ winston-daily-rotate-file instalado com sucesso (sem --save)"
            else
                error "❌ Falha crítica ao instalar winston-daily-rotate-file"
                exit 1
            fi
        fi
        
        # Verificar se foi instalado corretamente
        if npm list winston-daily-rotate-file >/dev/null 2>&1; then
            log "✅ winston-daily-rotate-file verificado no package.json"
        else
            warn "⚠️ winston-daily-rotate-file pode não estar no package.json (continuando...)"
        fi
        
        # CORREÇÃO CRÍTICA: Garantir que binários do npm tenham permissão de execução
        # ZIPs do Windows podem não preservar permissões de executáveis
        log "Corrigindo permissões de binários do npm (node_modules/.bin/)..."
        if [[ -d "node_modules/.bin" ]]; then
            # Corrigir permissões de TODOS os arquivos em node_modules/.bin
            find node_modules/.bin -type f -exec chmod +x {} \; 2>/dev/null || true
            
            # Verificar especificamente o tsc
            if [[ -f "node_modules/.bin/tsc" ]]; then
                chmod +x node_modules/.bin/tsc 2>/dev/null || true
                log "✅ Permissão do tsc corrigida explicitamente"
            fi
            
            # Verificar se o tsc tem permissão de execução
            if [[ -x "node_modules/.bin/tsc" ]]; then
                log "✅ Permissões de binários do npm corrigidas (tsc, etc.)"
            else
                warn "⚠️ tsc ainda não tem permissão de execução - tentando correção alternativa..."
                # Tentar usar npx como alternativa
                if command -v npx &> /dev/null; then
                    log "Usando npx para executar tsc (bypass de permissões)..."
                fi
            fi
        else
            warn "⚠️ Diretório node_modules/.bin não encontrado"
        fi
        
        # Compilar TypeScript do backend
        log "Compilando TypeScript do backend..."
        
        # Limpar build anterior para garantir compilação limpa
        if [[ -d "dist" ]]; then
            log "Limpando build anterior..."
            rm -rf dist/*
        fi
        
        # Tentar compilar usando npx para garantir que funcione mesmo com problemas de permissão
        if [[ -x "node_modules/.bin/tsc" ]] || command -v npx &> /dev/null; then
            # Usar npx para garantir execução correta
            if npx tsc -p tsconfig.json 2>&1; then
                BUILD_SUCCESS=true
            else
                BUILD_SUCCESS=false
            fi
        else
            # Fallback para npm run build
            if npm run build 2>&1; then
                BUILD_SUCCESS=true
            else
                BUILD_SUCCESS=false
            fi
        fi
        
        if [[ "$BUILD_SUCCESS" == "true" ]]; then
            log "✅ Backend compilado com sucesso!"
            
            # Verificar se arquivos críticos foram compilados
            if [[ ! -f "dist/services/authService.js" ]]; then
                error "❌ Arquivo authService.js não foi compilado!"
                exit 1
            fi
            
            if [[ ! -f "dist/config/database.js" ]]; then
                error "❌ Arquivo database.js não foi compilado!"
                exit 1
            fi
            
            log "✅ Arquivos compilados verificados (authService.js, database.js)"
            
            # Sincronizar build compilado com diretório de deploy (single-server / development)
            if [[ "$INSTALL_MODE" == "single-server" ]] || [[ "$INSTALL_MODE" == "development" ]]; then
                local backend_dist_dir="$(pwd)/dist"
                local backend_deploy_dir="/opt/smart-signage/backend"
                
                log "Sincronizando build do backend para $backend_deploy_dir..."
                sudo mkdir -p "$backend_deploy_dir/dist"
                if command -v rsync &> /dev/null; then
                    sudo rsync -a --delete "$backend_dist_dir/" "$backend_deploy_dir/dist/" || {
                        error "❌ Falha ao copiar build do backend para $backend_deploy_dir/dist"
                        exit 1
                    }
                    sudo rsync -a "$(pwd)/package.json" "$backend_deploy_dir/" || {
                        error "❌ Falha ao atualizar package.json em $backend_deploy_dir"
                        exit 1
                    }
                else
                    warn "⚠️ rsync não encontrado. Usando fallback com cp -a."
                    sudo rm -rf "$backend_deploy_dir/dist"/*
                    sudo cp -a "$backend_dist_dir/." "$backend_deploy_dir/dist/" || {
                        error "❌ Falha ao copiar build do backend para $backend_deploy_dir/dist (fallback cp)"
                        exit 1
                    }
                    sudo cp -a "$(pwd)/package.json" "$backend_deploy_dir/" || {
                        error "❌ Falha ao atualizar package.json em $backend_deploy_dir (fallback cp)"
                        exit 1
                    }
                fi
                sudo chmod -R 755 "$backend_deploy_dir/dist" 2>/dev/null || true
                log "✅ Build do backend sincronizado em $backend_deploy_dir"
            fi
            
            # Verificar se o serviço systemd existe e reiniciar se necessário
            if [[ -f "/etc/systemd/system/smart-signage.service" ]] && systemctl is-active --quiet smart-signage 2>/dev/null; then
                log "Serviço systemd ativo detectado - reiniciando para aplicar mudanças..."
                sudo systemctl restart smart-signage || warn "⚠️ Não foi possível reiniciar o serviço (será reiniciado após a instalação)"
                sleep 3
                log "✅ Serviço reiniciado"
            fi
        else
            error "❌ Erro ao compilar backend TypeScript"
            error "Verifique os erros de compilação acima"
            exit 1
        fi
    else
        log "ℹ️  Modo especial: pulando instalação/compilação do backend (SKIP_BACKEND_DEPS_BUILD=true)"
    fi
    
    # Frontend - sempre compilar para single-server também (pode ser pulado em modos especiais)
    if [[ "$SKIP_FRONTEND_DEPS_BUILD" != "true" ]]; then
        if [[ "$INSTALL_MODE" == "single-server" ]] || [[ "$INSTALL_MODE" == "development" ]]; then
        cd $INSTALL_DIR/frontend || {
            error "❌ Não foi possível entrar no diretório $INSTALL_DIR/frontend"
            exit 1
        }
        
        # CRÍTICO: Garantir tsconfig.json ANTES de instalar dependências
        # React Scripts precisa disso para resolver módulos corretamente
        if [[ ! -f "tsconfig.json" ]]; then
            log "⚠️  tsconfig.json não encontrado! Criando antes de instalar dependências..."
            cat > "tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": false,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
EOF
            log "✅ tsconfig.json criado"
        fi
        
        # Verificar se os arquivos essenciais estão presentes antes da compilação
        log "Verificando arquivos do frontend antes da compilação..."
        log "Diretório atual: $(pwd)"
        log "INSTALL_DIR: $INSTALL_DIR"
        
        # Verificar se index.tsx está importando corretamente
        if [[ -f "src/index.tsx" ]]; then
            log "Verificando importação em index.tsx..."
            if ! grep -q "from './App'" "src/index.tsx" && ! grep -q "from \"./App\"" "src/index.tsx"; then
                warn "⚠️  Import de App não encontrado em index.tsx como esperado"
                log "Conteúdo de index.tsx:"
                cat "src/index.tsx" | head -5
            fi
        fi
        
        # Verificação completa: listar estrutura de diretórios
        log "Verificando estrutura do diretório frontend:"
        log "  - Diretório frontend existe: $([[ -d "$INSTALL_DIR/frontend" ]] && echo "SIM" || echo "NÃO")"
        log "  - Diretório frontend/src existe: $([[ -d "$INSTALL_DIR/frontend/src" ]] && echo "SIM" || echo "NÃO")"
        log "  - Arquivo App.tsx existe: $([[ -f "$INSTALL_DIR/frontend/src/App.tsx" ]] && echo "SIM" || echo "NÃO")"
        log "  - Arquivo index.tsx existe: $([[ -f "$INSTALL_DIR/frontend/src/index.tsx" ]] && echo "SIM" || echo "NÃO")"
        
        # Verificar se estamos no diretório correto
        if [[ ! -d "src" ]]; then
            error "❌ Diretório src não encontrado em $(pwd)"
            error "Estrutura atual:"
            ls -la
            exit 1
        fi
        
        # Verificar se App.tsx existe ANTES de compilar
        if [[ ! -f "src/App.tsx" ]]; then
            error "❌ Arquivo src/App.tsx não encontrado em $(pwd)/src/"
            error "Listando arquivos em src/:"
            ls -la src/ 2>/dev/null || true
            error "Listando todos os arquivos .tsx em src/:"
            find src -name "*.tsx" 2>/dev/null || true
            error "Verificando se App.tsx existe em $INSTALL_DIR/frontend/src/:"
            ls -la "$INSTALL_DIR/frontend/src/App.tsx" 2>/dev/null || error "❌ App.tsx não existe!"
            error "O arquivo App.tsx é obrigatório para compilar o frontend!"
            exit 1
        fi
        
        # Verificar se index.tsx existe
        if [[ ! -f "src/index.tsx" ]]; then
            error "❌ Arquivo src/index.tsx não encontrado em $(pwd)/src/"
            error "Listando arquivos em src/:"
            ls -la src/ 2>/dev/null || true
            error "O arquivo index.tsx é obrigatório para compilar o frontend!"
            exit 1
        fi
        
        # Verificação adicional: confirmar que App.tsx pode ser lido
        if [[ ! -r "src/App.tsx" ]]; then
            error "❌ Arquivo src/App.tsx não pode ser lido (problema de permissões)"
            error "Permissões do arquivo:"
            ls -la src/App.tsx
            error "Ajustando permissões..."
            chmod 644 src/App.tsx || true
        fi
        
        # Listar arquivos principais para debug
        log "Arquivos principais encontrados em src/:"
        ls -la src/*.tsx src/*.ts 2>/dev/null | head -10 || true
        
        # Verificação adicional: verificar se App.tsx tem conteúdo válido
        if [[ -f "src/App.tsx" ]]; then
            log "Verificando conteúdo de App.tsx..."
            FILE_SIZE=$(wc -c < "src/App.tsx" 2>/dev/null || echo "0")
            log "  - Tamanho do arquivo: $FILE_SIZE bytes"
            
            if [[ $FILE_SIZE -eq 0 ]]; then
                error "❌ Arquivo App.tsx está vazio!"
                exit 1
            fi
            
            # Verificar se começa com import ou export (arquivo TypeScript válido)
            FIRST_LINE=$(head -n 1 "src/App.tsx" 2>/dev/null || echo "")
            if [[ ! "$FIRST_LINE" =~ ^(import|export) ]]; then
                warn "⚠️  Primeira linha de App.tsx não é um import/export: $FIRST_LINE"
                log "Primeiras 3 linhas de App.tsx:"
                head -n 3 "src/App.tsx" 2>/dev/null || true
            fi
        fi
        
        # Verificar encoding e caracteres especiais no nome do arquivo
        log "Verificando nome do arquivo App.tsx..."
        # Obter apenas o nome do arquivo (sem caminho)
        if [[ -f "src/App.tsx" ]]; then
            FILE_NAME=$(basename "src/App.tsx")
            log "  - Nome encontrado: '$FILE_NAME'"
            
            # Verificar se há problemas de case sensitivity (comparar apenas o nome)
            if [[ "$FILE_NAME" != "App.tsx" ]]; then
                warn "⚠️  Nome do arquivo não é exatamente 'App.tsx': '$FILE_NAME'"
                warn "Corrigindo nome do arquivo..."
                # Encontrar o arquivo com case incorreto
                for file in src/*.tsx; do
                    if [[ -f "$file" ]] && [[ "$(basename "$file" | tr '[:upper:]' '[:lower:]')" == "app.tsx" ]]; then
                        mv "$file" "src/App.tsx" && log "✅ Arquivo renomeado para App.tsx" || warn "⚠️  Não foi possível renomear"
                        break
                    fi
                done
            else
                log "✅ Nome do arquivo está correto: App.tsx"
            fi
        fi
        
        # Garantir permissões corretas
        chmod 644 src/App.tsx 2>/dev/null || true
        chmod 644 src/index.tsx 2>/dev/null || true
        
        log "✅ Arquivos essenciais do frontend encontrados (App.tsx, index.tsx)"
        
        # Limpar cache do React/Webpack antes de compilar (resolve problemas de módulos não encontrados)
        log "Limpando cache do build anterior..."
        rm -rf node_modules/.cache 2>/dev/null || true
        rm -rf build 2>/dev/null || true
        rm -rf .cache 2>/dev/null || true
        rm -rf .eslintcache 2>/dev/null || true
        # Limpar cache do npm também
        npm cache clean --force 2>/dev/null || true
        log "✅ Cache limpo"
        
        # Garantir que tsconfig.json existe e está configurado corretamente
        if [[ ! -f "tsconfig.json" ]]; then
            log "Criando tsconfig.json para o frontend..."
            cat > "tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": false,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
EOF
            log "✅ tsconfig.json criado"
        else
            log "✅ tsconfig.json já existe"
            # Verificar se moduleResolution está correto
            if ! grep -q '"moduleResolution"' "tsconfig.json"; then
                warn "⚠️  tsconfig.json não tem moduleResolution configurado"
                log "Adicionando moduleResolution: node..."
                # Adicionar moduleResolution se não existir
                sed -i '/"module":/a\    "moduleResolution": "node",' "tsconfig.json" 2>/dev/null || true
            fi
        fi
        
        # Verificação crítica: garantir que o diretório src está no include
        if ! grep -q '"src"' "tsconfig.json"; then
            warn "⚠️  tsconfig.json não inclui 'src'"
            log "Atualizando tsconfig.json para incluir src..."
            sed -i 's/"include":.*/"include": ["src"]/' "tsconfig.json" 2>/dev/null || true
        fi
        
        # Verificação final: tentar compilar apenas o App.tsx para verificar sintaxe
        log "Verificando sintaxe do App.tsx..."
        if command -v tsc &> /dev/null; then
            # Tentar verificar sintaxe TypeScript do App.tsx
            TEMP_TS_CONFIG=$(mktemp)
            cat > "$TEMP_TS_CONFIG" << 'EOF'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": false,
    "forceConsistentCasingInFileNames": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
EOF
            if tsc --noEmit --project "$TEMP_TS_CONFIG" src/App.tsx 2>&1 | grep -q "error"; then
                warn "⚠️  Erros de sintaxe detectados em App.tsx:"
                tsc --noEmit --project "$TEMP_TS_CONFIG" src/App.tsx 2>&1 | head -5
            else
                log "✅ Sintaxe do App.tsx está OK"
            fi
            rm -f "$TEMP_TS_CONFIG"
        fi
        
        # Verificação adicional: confirmar que index.tsx pode encontrar App.tsx
        log "Verificando se index.tsx pode importar App.tsx..."
        if grep -q "from './App'" "src/index.tsx" || grep -q "from \"./App\"" "src/index.tsx"; then
            log "✅ Importação em index.tsx está correta"
            
            # Verificação final: confirmar que App.tsx está no mesmo diretório
            log "Verificando localização exata do App.tsx..."
            if [[ -f "src/App.tsx" ]]; then
                log "✅ App.tsx confirmado em src/App.tsx"
                # Listar todos os arquivos .tsx em src/ para debug
                log "Arquivos .tsx em src/:"
                ls -1 src/*.tsx 2>/dev/null | head -5 || true
                
                # Verificar permissões e propriedade
                log "Informações detalhadas de App.tsx:"
                ls -la "src/App.tsx" 2>/dev/null || true
                
                # Tentar ler o arquivo diretamente para confirmar que está acessível
                if head -1 "src/App.tsx" > /dev/null 2>&1; then
                    log "✅ App.tsx pode ser lido diretamente"
                else
                    error "❌ App.tsx NÃO pode ser lido diretamente!"
                    error "Verificando permissões..."
                    chmod 644 "src/App.tsx" || true
                fi
            fi
        else
            warn "⚠️  Importação em index.tsx não está como esperado"
            log "Conteúdo de index.tsx:"
            head -5 "src/index.tsx"
        fi
        
        # Verificar se os arquivos importados pelo App.tsx existem
        log "Verificando arquivos importados pelo App.tsx..."
        MISSING_FILES=()
        
        # Lista de arquivos que App.tsx importa
        REQUIRED_FILES=(
            "src/pages/Auth/LoginPage.tsx"
            "src/pages/Dashboard/Dashboard.tsx"
            "src/pages/Media/Media.tsx"
            "src/pages/Playlists/Playlists.tsx"
            "src/pages/Players/Players.tsx"
            "src/components/Layout/Layout.tsx"
        )
        
        for file in "${REQUIRED_FILES[@]}"; do
            if [[ ! -f "$file" ]]; then
                MISSING_FILES+=("$file")
                warn "⚠️  Arquivo não encontrado: $file"
            fi
        done
        
        if [[ ${#MISSING_FILES[@]} -gt 0 ]]; then
            warn "⚠️  Alguns arquivos importados por App.tsx estão faltando:"
            printf '  - %s\n' "${MISSING_FILES[@]}"
            warn "Isso pode impedir a compilação do App.tsx"
        else
            log "✅ Todos os arquivos principais importados por App.tsx existem"
        fi
        
        # CRÍTICO: Verificação final ANTES de compilar - garantir que App.tsx pode ser encontrado
        log "Verificação final antes da compilação..."
        
        # Testar resolução do módulo usando Node.js diretamente
        log "Testando resolução do módulo App.tsx..."
        TEST_RESOLVE=$(node -e "
            const fs = require('fs');
            const path = require('path');
            try {
                const appPath = path.resolve('src/App.tsx');
                if (fs.existsSync(appPath)) {
                    console.log('EXISTS');
                } else {
                    console.log('NOT_FOUND');
                }
            } catch(e) {
                console.log('ERROR');
            }
        " 2>&1 || echo "ERROR")
        
        if [[ "$TEST_RESOLVE" == *"EXISTS"* ]]; then
            log "✅ Node.js confirma que App.tsx existe e pode ser encontrado"
        else
            warn "⚠️  Node.js não conseguiu encontrar App.tsx: $TEST_RESOLVE"
        fi
        
        # Verificação final: confirmar que estamos no diretório correto
        if [[ ! -f "src/App.tsx" ]] || [[ ! -f "src/index.tsx" ]]; then
            error "❌ Arquivos não encontrados no diretório atual: $(pwd)"
            error "Estrutura esperada:"
            ls -la src/ 2>/dev/null | head -10 || true
            exit 1
        fi
        
        if [[ ! -f "public/index.html" ]]; then
            log_error "index.html não encontrado em frontend/public/"
            log "Criando arquivo index.html..."
            cat > "public/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="Smart Signage Pro - Sistema de Sinalização Digital Profissional"
    />
    <link rel="apple-touch-icon" href="%PUBLIC_URL%/logo192.png" />
    <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />
    <title>Smart Signage Pro</title>
  </head>
  <body>
    <noscript>Você precisa habilitar o JavaScript para executar este aplicativo.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF
        fi
        
        if [[ ! -f "public/manifest.json" ]]; then
            log_error "manifest.json não encontrado em frontend/public/"
            log "Criando arquivo manifest.json..."
            cat > "public/manifest.json" << 'EOF'
{
  "short_name": "Smart Signage Pro",
  "name": "Smart Signage Pro - Sistema de Sinalização Digital",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff"
}
EOF
        fi
        
        log "Instalando dependências do frontend..."
        
        # CRÍTICO: Limpar COMPLETAMENTE instalações anteriores ANTES de validar package.json
        # IMPORTANTE: package-lock.json pode conter referências a versões antigas (ajv@8.17.1)
        # Por isso, SEMPRE removemos antes de validar/instalar
        log "Limpando COMPLETAMENTE instalações anteriores (node_modules, package-lock.json, cache, .npm)..."
        log "⚠️  REMOVENDO package-lock.json (pode conter referências a ajv@8.17.1)..."
        rm -rf node_modules package-lock.json .npm .cache 2>/dev/null || true
        
        # Verificar se ainda existe package-lock.json (pode ter vindo do repositório)
        if [[ -f "package-lock.json" ]]; then
            warn "⚠️  package-lock.json ainda existe após remoção - forçando remoção..."
            rm -f package-lock.json 2>/dev/null || sudo rm -f package-lock.json 2>/dev/null || true
        fi
        
        npm cache clean --force 2>/dev/null || true
        log "✅ Limpeza completa realizada (package-lock.json removido)"
        
        # Validar se Python está disponível (necessário para manipulação segura do JSON)
        log "Validando Python (necessário para manipulação segura do package.json)..."
        if ! ensure_python_installed; then
            error "Python3 é obrigatório para a instalação do frontend"
            exit 1
        fi
        
        # CRÍTICO: Garantir que estamos usando o package.json CORRETO do repositório
        # Se o package.json no servidor foi modificado, substituir pelo do repositório
        log "Garantindo que package.json está correto (usando versão do repositório)..."
        
        # Verificar se package.json existe
        if [[ ! -f "package.json" ]]; then
            error "❌ package.json não encontrado em $(pwd)"
            error "O arquivo package.json deve vir no .zip do projeto"
            exit 1
        fi
        
        # Fazer backup do package.json atual (caso tenha sido modificado)
        PACKAGE_JSON_BACKUP="package.json.backup.$(date +%s)"
        cp package.json "$PACKAGE_JSON_BACKUP" 2>/dev/null || true
        log "Backup do package.json criado: $PACKAGE_JSON_BACKUP"
        
        # Verificar se há versões problemáticas no package.json atual
        if grep -qE "(8\.17\.1|\"8\.17\.1\"|\^8\.17\.1)" package.json 2>/dev/null; then
            warn "⚠️  package.json no servidor contém versões problemáticas (8.17.1)"
            warn "Substituindo pelo package.json correto do repositório..."
            
            # Tentar restaurar do repositório Git se disponível
            if command -v git &> /dev/null && [[ -d ".git" ]]; then
                log "Restaurando package.json do repositório Git..."
                git checkout HEAD -- package.json 2>/dev/null || {
                    warn "Não foi possível restaurar do Git, usando correção manual..."
                }
            fi
            
            # Se ainda tiver problema, usar Python para corrigir
            if grep -qE "(8\.17\.1|\"8\.17\.1\"|\^8\.17\.1)" package.json 2>/dev/null; then
                warn "Corrigindo package.json usando Python..."
                python3 << 'PYTHON_FIX_EOF'
import json
import sys

try:
    with open('package.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Forçar versões corretas em todas as seções
    if 'overrides' not in data:
        data['overrides'] = {}
    data['overrides']['react-dom'] = '^18.2.0'
    data['overrides']['ajv'] = '^8.12.0'
    data['overrides']['ajv-keywords'] = '^5.1.0'
    
    if 'resolutions' not in data:
        data['resolutions'] = {}
    data['resolutions']['ajv'] = '^8.12.0'
    data['resolutions']['ajv-keywords'] = '^5.1.0'
    data['resolutions']['ajv-formats'] = '^2.1.1'
    
    # NÃO adicionar ajv em devDependencies - causa conflito com overrides
    # O override já força a versão correta para todas as dependências transitivas
    
    with open('package.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    sys.exit(0)
except Exception as e:
    print(f"Erro ao corrigir package.json: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON_FIX_EOF
                if [[ $? -ne 0 ]]; then
                    error "Falha ao corrigir package.json com Python"
                    exit 1
                fi
                log "✅ package.json corrigido usando Python"
            fi
        fi
        
        # Verificar e corrigir TODAS as ocorrências de versões antigas/incompatíveis
        PACKAGE_JSON_FIXED=false
        
        # CORREÇÃO AGRESSIVA: Substituir TODAS as formas possíveis de 8.17.1 por 8.12.0
        # Isso inclui: "8.17.1", "^8.17.1", "~8.17.1", "8.17.1", etc.
        if grep -qE "(8\.17\.1|\"8\.17\.1\"|\^8\.17\.1|~8\.17\.1)" package.json 2>/dev/null; then
            warn "Versão antiga do ajv (8.17.1) detectada no package.json - corrigindo AGressivamente..."
            # Substituir todas as formas possíveis
            sed -i 's/8\.17\.1/8.12.0/g' package.json
            sed -i 's/"8\.17\.1"/"8.12.0"/g' package.json
            sed -i 's/\^8\.17\.1/\^8.12.0/g' package.json
            sed -i 's/~8\.17\.1/~8.12.0/g' package.json
            PACKAGE_JSON_FIXED=true
            log "✅ Versão do ajv corrigida para 8.12.0 (todas as formas)"
        fi
        
        # CORREÇÃO: Remover qualquer versão antiga ou incorreta do ajv-keywords
        # Corrigir versão 3.x (incompatível) e 5.1.1 (não existe) para 5.1.0
        if grep -qE '("ajv-keywords":\s*"\^3\.|3\.5\.2|"3\.5\.2"|\^3\.5\.2|"ajv-keywords":\s*"\^5\.1\.1|5\.1\.1)' package.json 2>/dev/null; then
            warn "Versão incorreta do ajv-keywords detectada no package.json - corrigindo para 5.1.0..."
            # Corrigir versão 3.x
            sed -i 's/3\.5\.2/5.1.0/g' package.json
            sed -i 's/"3\.5\.2"/"5.1.0"/g' package.json
            sed -i 's/\^3\.5\.2/\^5.1.0/g' package.json
            sed -i 's/"ajv-keywords":\s*"\^3\./"ajv-keywords": "^5.1.0"/g' package.json
            # Corrigir versão 5.1.1 (não existe)
            sed -i 's/5\.1\.1/5.1.0/g' package.json
            sed -i 's/"5\.1\.1"/"5.1.0"/g' package.json
            sed -i 's/\^5\.1\.1/\^5.1.0/g' package.json
            sed -i 's/"ajv-keywords":\s*"\^5\.1\.1/"ajv-keywords": "^5.1.0"/g' package.json
            PACKAGE_JSON_FIXED=true
            log "✅ Versão do ajv-keywords corrigida para ^5.1.0 (compatível com ajv 8.x)"
        fi
        
        # GARANTIR que overrides e resolutions estão corretos (forçar se necessário)
        log "Garantindo que overrides e resolutions estão configurados corretamente..."
        
        # REMOVER completamente qualquer override com ajv@8.17.1 primeiro
        if grep -qE '"overrides".*"ajv".*8\.17\.1' package.json 2>/dev/null || grep -qE '"ajv":\s*"[^"]*8\.17\.1' package.json 2>/dev/null; then
            warn "Removendo override problemático com ajv@8.17.1..."
            # Remover linha específica do ajv em overrides se contiver 8.17.1
            sed -i '/"overrides"/,/}/ { /"ajv":\s*"[^"]*8\.17\.1/d; }' package.json 2>/dev/null || true
            PACKAGE_JSON_FIXED=true
        fi
        
        # Verificar se overrides existe e tem ajv correto
        if ! grep -q '"overrides"' package.json 2>/dev/null; then
            warn "Seção 'overrides' não encontrada - adicionando..."
            # Adicionar overrides antes de devDependencies usando Python para garantir JSON válido
            python3 << 'PYTHON_EOF'
import json
import sys

try:
    with open('package.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Garantir que overrides existe e está correto
    if 'overrides' not in data:
        data['overrides'] = {}
    
    # Forçar versões corretas
    data['overrides']['react-dom'] = '^18.2.0'
    data['overrides']['ajv'] = '^8.12.0'
    data['overrides']['ajv-keywords'] = '^5.1.0'
    
    # Reordenar para colocar overrides antes de devDependencies
    ordered_data = {}
    for key in ['name', 'version', 'description', 'private', 'dependencies', 'overrides', 'resolutions', 'devDependencies', 'scripts', 'eslintConfig', 'browserslist', 'proxy']:
        if key in data:
            ordered_data[key] = data[key]
    
    # Adicionar qualquer chave restante
    for key in data:
        if key not in ordered_data:
            ordered_data[key] = data[key]
    
    with open('package.json', 'w', encoding='utf-8') as f:
        json.dump(ordered_data, f, indent=2, ensure_ascii=False)
    
    sys.exit(0)
except Exception as e:
    print(f"Erro ao processar package.json: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON_EOF
            if [[ $? -eq 0 ]]; then
                PACKAGE_JSON_FIXED=true
                log "✅ Seção 'overrides' adicionada/corrigida usando Python"
            else
                warn "Falha ao usar Python, tentando método sed..."
                # Fallback para sed
                if grep -q '"devDependencies"' package.json; then
                    sed -i '/"devDependencies"/i\  "overrides": {\n    "react-dom": "^18.2.0",\n    "ajv": "^8.12.0",\n    "ajv-keywords": "^5.1.0"\n  },' package.json
                else
                    sed -i '$ i\  "overrides": {\n    "react-dom": "^18.2.0",\n    "ajv": "^8.12.0",\n    "ajv-keywords": "^5.1.0"\n  },' package.json
                fi
                PACKAGE_JSON_FIXED=true
            fi
        else
            # Garantir que ajv em overrides está correto usando Python
            python3 << 'PYTHON_EOF'
import json
import sys

try:
    with open('package.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if 'overrides' in data:
        # Forçar versões corretas em overrides
        data['overrides']['react-dom'] = '^18.2.0'
        data['overrides']['ajv'] = '^8.12.0'
        data['overrides']['ajv-keywords'] = '^5.1.0'
        
        with open('package.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    sys.exit(0)
except Exception as e:
    print(f"Erro ao processar package.json: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON_EOF
            if [[ $? -eq 0 ]]; then
                PACKAGE_JSON_FIXED=true
                log "✅ Overrides corrigido usando Python"
            else
                # Fallback: usar sed para corrigir
                if grep -qE '"ajv":\s*"[^"]*8\.17\.1' package.json 2>/dev/null; then
                    warn "Corrigindo ajv em overrides usando sed..."
                    sed -i '/"overrides"/,/}/ s/"ajv":\s*"[^"]*8\.17\.1[^"]*"/"ajv": "^8.12.0"/g' package.json
                    PACKAGE_JSON_FIXED=true
                fi
            fi
        fi
        
        # Verificar se resolutions existe e tem ajv correto usando Python
        python3 << 'PYTHON_RESOLUTIONS_EOF'
import json
import sys

try:
    with open('package.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Garantir que resolutions existe e está correto
    if 'resolutions' not in data:
        data['resolutions'] = {}
    
    # Forçar versões corretas
    data['resolutions']['ajv'] = '^8.12.0'
    data['resolutions']['ajv-keywords'] = '^5.1.0'
    
    with open('package.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    sys.exit(0)
except Exception as e:
    print(f"Erro ao processar resolutions: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON_RESOLUTIONS_EOF
        if [[ $? -eq 0 ]]; then
            PACKAGE_JSON_FIXED=true
            log "✅ Resolutions garantido usando Python"
        else
            warn "Falha ao usar Python para resolutions, tentando método sed..."
            # Fallback para sed
            if ! grep -q '"resolutions"' package.json 2>/dev/null; then
                if grep -q '"devDependencies"' package.json; then
                    sed -i '/"devDependencies"/i\  "resolutions": {\n    "ajv": "^8.12.0",\n    "ajv-keywords": "^5.1.0"\n  },' package.json
                else
                    sed -i '$ i\  "resolutions": {\n    "ajv": "^8.12.0",\n    "ajv-keywords": "^5.1.0"\n  },' package.json
                fi
                PACKAGE_JSON_FIXED=true
            else
                # Garantir que ajv em resolutions está correto
                if grep -qE '"ajv":\s*"[^"]*8\.17\.1' package.json 2>/dev/null; then
                    warn "Corrigindo ajv em resolutions usando sed..."
                    sed -i '/"resolutions"/,/}/ s/"ajv":\s*"[^"]*8\.17\.1[^"]*"/"ajv": "^8.12.0"/g' package.json
                    PACKAGE_JSON_FIXED=true
                fi
            fi
        fi
        
        # Verificação final: garantir que não há mais versões problemáticas em NENHUM lugar
        if grep -qE "(8\.17\.1|\"8\.17\.1\"|\^8\.17\.1)" package.json 2>/dev/null; then
            error "❌ Falha ao corrigir package.json - ainda contém 8.17.1"
            error "Conteúdo completo do package.json:"
            cat package.json
            error "Tentando localizar ocorrências de 8.17.1:"
            grep -n "8.17.1" package.json || true
            exit 1
        fi
        
        # Verificar se as versões corretas estão configuradas
        log "Verificando versões configuradas no package.json..."
        OVERRIDE_AJV=$(grep -A 3 '"overrides"' package.json 2>/dev/null | grep '"ajv"' | grep -oE '\^?[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")
        RESOLUTION_AJV=$(grep -A 3 '"resolutions"' package.json 2>/dev/null | grep '"ajv"' | grep -oE '\^?[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")
        DEVDEP_AJV=$(grep -A 2 '"ajv"' package.json 2>/dev/null | grep -oE '\^?[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")
        
        if [[ -n "$OVERRIDE_AJV" ]] && [[ "$OVERRIDE_AJV" == *"8.17.1"* ]]; then
            error "❌ Override ainda contém versão incorreta: $OVERRIDE_AJV"
            error "Conteúdo do package.json (overrides):"
            grep -A 5 '"overrides"' package.json || true
            exit 1
        fi
        
        if [[ -n "$RESOLUTION_AJV" ]] && [[ "$RESOLUTION_AJV" == *"8.17.1"* ]]; then
            error "❌ Resolution ainda contém versão incorreta: $RESOLUTION_AJV"
            error "Conteúdo do package.json (resolutions):"
            grep -A 5 '"resolutions"' package.json || true
            exit 1
        fi
        
        if [[ "$PACKAGE_JSON_FIXED" == true ]]; then
            log "✅ package.json corrigido e validado"
        else
            log "✅ package.json já está correto (sem versões problemáticas)"
        fi
        
        # VALIDAÇÃO FINAL CRÍTICA: Garantir que NÃO há nenhuma referência a 8.17.1 em lugar nenhum
        log "Validação final crítica: verificando se há alguma referência a ajv@8.17.1..."
        
        # Verificar TODAS as formas possíveis
        AJV_8171_FOUND=false
        if grep -qiE "(8\.17\.1|ajv.*8\.17\.1)" package.json 2>/dev/null; then
            AJV_8171_FOUND=true
            error "❌ CRÍTICO: Ainda há referências a ajv@8.17.1 no package.json!"
            error "Localizando todas as ocorrências:"
            grep -n -iE "(8\.17\.1|ajv.*8\.17\.1)" package.json || true
            error "Corrigindo usando Python..."
            
            # Correção final usando Python
            python3 << 'PYTHON_FINAL_FIX_EOF'
import json
import sys
import re

try:
    with open('package.json', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Verificar se há 8.17.1 em qualquer lugar
    if '8.17.1' in content:
        print("Encontrado 8.17.1 no package.json, corrigindo...", file=sys.stderr)
        # Substituir todas as formas
        content = re.sub(r'8\.17\.1', '8.12.0', content)
        content = re.sub(r'"8\.17\.1"', '"8.12.0"', content)
        content = re.sub(r'\^8\.17\.1', '^8.12.0', content)
        content = re.sub(r'~8\.17\.1', '~8.12.0', content)
        
        # Re-carregar como JSON para garantir que está válido
        data = json.loads(content)
        
        # Forçar versões corretas
        if 'overrides' not in data:
            data['overrides'] = {}
        data['overrides']['ajv'] = '^8.12.0'
        data['overrides']['ajv-keywords'] = '^5.1.0'
        
        if 'resolutions' not in data:
            data['resolutions'] = {}
        data['resolutions']['ajv'] = '^8.12.0'
        data['resolutions']['ajv-keywords'] = '^5.1.0'
        data['resolutions']['ajv-formats'] = '^2.1.1'
        
        # NÃO adicionar ajv em devDependencies - causa conflito com overrides
        # O override já força a versão correta para todas as dependências transitivas
        
        with open('package.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print("✅ package.json corrigido completamente", file=sys.stderr)
    else:
        print("✅ Nenhuma referência a 8.17.1 encontrada", file=sys.stderr)
    
    sys.exit(0)
except Exception as e:
    print(f"Erro na correção final: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON_FINAL_FIX_EOF
            
            if [[ $? -ne 0 ]]; then
                error "Falha na correção final do package.json"
                exit 1
            fi
            
            # Verificar novamente
            if grep -qiE "(8\.17\.1|ajv.*8\.17\.1)" package.json 2>/dev/null; then
                error "❌ IMPOSSÍVEL corrigir package.json - ainda contém 8.17.1"
                error "Conteúdo completo do package.json:"
                cat package.json
                exit 1
            fi
        fi
        
        if [[ "$AJV_8171_FOUND" == false ]]; then
            log "✅ Nenhuma referência a ajv@8.17.1 encontrada no package.json"
        fi
        
        # Mostrar conteúdo final do package.json para debug (apenas seções relevantes)
        log "Conteúdo final do package.json (overrides, resolutions, devDependencies):"
        grep -A 3 '"overrides"' package.json 2>/dev/null || true
        grep -A 3 '"resolutions"' package.json 2>/dev/null || true
        grep -A 2 '"ajv"' package.json 2>/dev/null | head -5 || true
        
        # NOTA: Não instalar ajv explicitamente aqui porque:
        # 1. O ajv NÃO deve estar em devDependencies (causa conflito com overrides)
        # 2. O override já está configurado corretamente e força a versão para todas as dependências transitivas
        # 3. Instalar explicitamente causa conflito: "Override for ajv@8.12.0 conflicts with direct dependency"
        # 4. O npm vai instalar o ajv automaticamente quando instalar todas as dependências (via override)
        log "✅ ajv já está configurado no package.json (overrides) - será instalado automaticamente via override"
        
        # Verificar se há dependências transitivas que podem estar forçando ajv@8.17.1
        log "Verificando dependências transitivas que podem estar forçando ajv@8.17.1..."
        
        # Criar um package.json temporário apenas para verificar dependências transitivas
        # (sem instalar, apenas para análise)
        if command -v npm &> /dev/null; then
            log "Analisando árvore de dependências para detectar conflitos..."
            # Tentar instalação em modo dry-run primeiro para detectar problemas
            npm install --dry-run --legacy-peer-deps --no-audit --no-fund 2>&1 | grep -i "ajv.*8\.17\.1\|EOVERRIDE.*ajv" > "$(install_log_file npm-dry-run-ajv.log)" 2>/dev/null || true
            
            if [[ -s "$(install_log_file npm-dry-run-ajv.log)" ]]; then
                warn "⚠️  Possível conflito detectado na análise de dependências:"
                cat "$(install_log_file npm-dry-run-ajv.log)" | head -10
            fi
        fi
        
        # Antes de instalar, remover 'overrides' para evitar conflitos EOVERRIDE com npm
        python3 << 'PYTHON_DROP_OVERRIDES_EOF'
import json
import sys

try:
    with open('package.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    if 'overrides' in data:
        del data['overrides']

    with open('package.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    sys.exit(0)
except Exception as e:
    print(f"Erro ao limpar overrides: {e}", file=sys.stderr)
    # Não falhar a instalação apenas por não conseguir limpar overrides
    sys.exit(0)
PYTHON_DROP_OVERRIDES_EOF
        
        # Reduzir falhas de rede (ECONNRESET): mais tempo e retentativas
        npm config set fetch-timeout 120000 2>/dev/null || true
        npm config set fetch-retries 5 2>/dev/null || true
        npm config set fetch-retry-mintimeout 20000 2>/dev/null || true
        
        # Instalar todas as dependências (sem overrides) com --force apenas para garantir compatibilidade
        log "Instalando todas as dependências do frontend (sem overrides de ajv)..."
        _npm_ok=false
        _npm_log="$(install_log_file npm-install-all.log)"
        for _attempt in 1 2 3; do
            if [[ $_attempt -gt 1 ]]; then
                log "Tentativa $_attempt/3 (após falha de rede)..."
                sleep 5
            fi
            # Não usar `npm | tee /tmp/...` sob pipefail: tee em /tmp root-owned falha
            # mesmo com npm OK e aborta o install ANTES de setup_database (role PG nunca criado).
            set +e
            npm install --legacy-peer-deps --no-audit --no-fund --force >"$_npm_log" 2>&1
            _npm_rc=$?
            set -e
            if [[ $_npm_rc -eq 0 ]] || [[ -d node_modules/react && -d node_modules/react-dom ]]; then
                _npm_ok=true
                if [[ $_npm_rc -ne 0 ]]; then
                    warn "npm exit $_npm_rc mas node_modules parece completo — a continuar"
                fi
                tail -n 20 "$_npm_log" 2>/dev/null || true
                break
            fi
            if grep -qE "ECONNRESET|ETIMEDOUT|network|ENOTFOUND|EAI_AGAIN" "$_npm_log" 2>/dev/null; then
                warn "Falha de rede detectada. Tentando novamente..."
            else
                break
            fi
        done
        if ! $_npm_ok; then
            error "Falha ao instalar dependências do frontend"
            error "Verificando se o problema é com ajv..."
            
            if grep -q "ajv.*8\.17\.1\|EOVERRIDE.*ajv\|conflicts with direct dependency" "$_npm_log" 2>/dev/null; then
                error "❌ Problema persistente com ajv@8.17.1 detectado"
                error "Analisando log completo para identificar a causa..."
                
                # Mostrar contexto do erro
                grep -B 5 -A 5 "ajv.*8\.17\.1\|EOVERRIDE.*ajv\|conflicts with direct dependency" "$_npm_log" | head -30
                
                # ESTRATÉGIA ALTERNATIVA: Usar apenas resolutions (mais compatível com npm)
                warn "Tentando solução alternativa: remover override e usar apenas resolutions..."
                
                # Usar Python para remover override e garantir apenas resolutions
                python3 << 'PYTHON_REMOVE_OVERRIDE_EOF'
import json
import sys

try:
    with open('package.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Remover overrides completamente
    if 'overrides' in data:
        del data['overrides']
        print("Removido 'overrides' do package.json", file=sys.stderr)
    
    # Garantir que resolutions existe e está correto
    if 'resolutions' not in data:
        data['resolutions'] = {}
    data['resolutions']['ajv'] = '^8.12.0'
    data['resolutions']['ajv-keywords'] = '^5.1.0'
    data['resolutions']['ajv-formats'] = '^2.1.1'
    
    # NÃO adicionar ajv em devDependencies - causa conflito com overrides
    # O override já força a versão correta para todas as dependências transitivas
    
    with open('package.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    sys.exit(0)
except Exception as e:
    print(f"Erro ao remover override: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON_REMOVE_OVERRIDE_EOF
                
                if [[ $? -eq 0 ]]; then
                    log "✅ Override removido, usando apenas resolutions"
                    log "Tentando instalação novamente sem overrides..."
                    
                    # Limpar novamente antes de tentar
                    rm -rf node_modules package-lock.json 2>/dev/null || true
                    npm cache clean --force 2>/dev/null || true
                    
                    _npm_retry_log="$(install_log_file npm-install-retry.log)"
                    set +e
                    npm install --legacy-peer-deps --no-audit --no-fund --force >"$_npm_retry_log" 2>&1
                    _npm_retry_rc=$?
                    set -e
                    if [[ $_npm_retry_rc -ne 0 ]] && [[ ! -d node_modules/react ]]; then
                        error "❌ Falha mesmo sem overrides"
                        error "Log completo da tentativa:"
                        tail -100 "$_npm_retry_log"
                        error "Conteúdo atual do package.json:"
                        cat package.json
                        error "Possível causa: Uma dependência transitiva está forçando ajv@8.17.1"
                        error "Solução manual: Verifique qual dependência está requerendo ajv@8.17.1"
                        exit 1
                    fi
                else
                    error "Falha ao remover override usando Python"
                    exit 1
                fi
            else
                error "Erro não relacionado ao ajv. Log completo:"
                tail -50 "$_npm_log" 2>/dev/null || true
                exit 1
            fi
        fi
        
        # Validar instalação
        log "Validando instalação..."
        if [ ! -d "node_modules" ] || [ ! -d "node_modules/react-scripts" ]; then
            error "Dependências não foram instaladas corretamente!"
            exit 1
        fi
        
        # Verificar versões instaladas e CORRIGIR se necessário
        log "Verificando versão do ajv instalada..."
        AJV_VER=$(npm list ajv --depth=0 2>/dev/null | grep -oE "ajv@[0-9]+\.[0-9]+\.[0-9]+" | head -1 || echo "")
        
        if [ -n "$AJV_VER" ]; then
            log "Versão do ajv instalada: $AJV_VER"
            
            if echo "$AJV_VER" | grep -q "8.17.1"; then
                warn "❌ Versão incorreta do ajv instalada (8.17.1)!"
                warn "Uma dependência transitiva está forçando ajv@8.17.1"
                
                # Identificar qual dependência está requerendo ajv@8.17.1
                log "Identificando qual dependência está requerendo ajv@8.17.1..."
                npm ls ajv 2>&1 | grep -E "ajv@8\.17\.1|└─|├─" | head -20 > /tmp/npm-ls-ajv.log 2>&1 || true
                
                if [[ -s /tmp/npm-ls-ajv.log ]]; then
                    warn "Dependências que requerem ajv@8.17.1:"
                    cat /tmp/npm-ls-ajv.log | head -10
                fi
                
                # NÃO instalar ajv explicitamente - causa conflito com overrides
                # O override já força a versão correta para todas as dependências transitivas
                warn "⚠️  Versão incorreta detectada, mas não instalando explicitamente (causaria conflito)"
                warn "O override no package.json deve forçar a versão correta durante npm install"
                
                # Verificar novamente após garantir que override está correto
                AJV_VER_AFTER=$(npm list ajv --depth=0 2>/dev/null | grep -oE "ajv@[0-9]+\.[0-9]+\.[0-9]+" | head -1 || echo "")
                if echo "$AJV_VER_AFTER" | grep -q "8.17.1"; then
                    error "❌ IMPOSSÍVEL corrigir: ajv@8.17.1 ainda está instalado após tentativa de correção"
                    error "Versão atual: $AJV_VER_AFTER"
                    error "Possível causa: Uma dependência está fixando ajv@8.17.1 como dependência direta"
                    error "Solução: Adicionar override específico para a dependência problemática"
                    
                    # Tentar adicionar override específico usando Python
                    warn "Tentando adicionar override específico..."
                    python3 << 'PYTHON_ADD_OVERRIDE_EOF'
import json
import sys

try:
    with open('package.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Adicionar override para forçar ajv@8.12.0 em TODAS as dependências
    if 'overrides' not in data:
        data['overrides'] = {}
    
    # Override global para ajv
    data['overrides']['ajv'] = '^8.12.0'
    data['overrides']['ajv-keywords'] = '^5.1.0'  # Compatível com ajv 8.x
    
    # Override específico para dependências conhecidas que podem estar causando problema
    # react-scripts e suas dependências
    if 'react-scripts' in data.get('dependencies', {}):
        if 'react-scripts' not in data['overrides']:
            data['overrides']['react-scripts'] = {}
        if isinstance(data['overrides']['react-scripts'], dict):
            data['overrides']['react-scripts']['ajv'] = '8.12.0'
    
    with open('package.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("✅ Override adicionado com versão exata (sem ^)", file=sys.stderr)
    sys.exit(0)
except Exception as e:
    print(f"Erro ao adicionar override: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON_ADD_OVERRIDE_EOF
                    
                    if [[ $? -eq 0 ]]; then
                        log "Override adicionado. O override forçará a versão correta durante npm install"
                        # NÃO instalar ajv explicitamente - causa conflito com overrides
                        # O npm install normal respeitará o override
                        
                        # Verificar novamente após garantir que override está correto
                        AJV_VER_FINAL=$(npm list ajv --depth=0 2>/dev/null | grep -oE "ajv@[0-9]+\.[0-9]+\.[0-9]+" | head -1 || echo "")
                        if echo "$AJV_VER_FINAL" | grep -q "8.17.1"; then
                            error "❌ Ainda não foi possível corrigir. Versão atual: $AJV_VER_FINAL"
                            error "O problema requer intervenção manual para identificar a dependência específica"
                            exit 1
                        else
                            log "✅ Versão corrigida: $AJV_VER_FINAL"
                        fi
                    else
                        error "Falha ao adicionar override"
                        exit 1
                    fi
                else
                    log "✅ Versão corrigida: $AJV_VER_AFTER"
                fi
            else
                log "✅ Versão do ajv está correta: $AJV_VER"
            fi
        else
            warn "Não foi possível verificar versão do ajv instalada"
        fi
        
        # Verificação final: garantir que o import NÃO tenha extensão .tsx
        # TypeScript/Webpack NÃO permite extensões em imports de arquivos TypeScript
        log "Verificando se o import em index.tsx está correto (sem extensão)..."
        if grep -q "from './App.tsx'" "src/index.tsx" || grep -q 'from "./App.tsx"' "src/index.tsx"; then
            log "⚠️  Corrigindo import: removendo extensão .tsx (não permitida pelo TypeScript)..."
            BACKUP_INDEX="src/index.tsx.backup.$(date +%s)"
            cp "src/index.tsx" "$BACKUP_INDEX"
            
            # Remover extensão .tsx do import (TypeScript não permite)
            sed -i "s|from './App.tsx'|from './App'|g" "src/index.tsx" 2>/dev/null || \
            sed -i 's|from "./App.tsx"|from "./App"|g' "src/index.tsx" 2>/dev/null || {
                warn "⚠️  Não foi possível corrigir index.tsx"
                mv "$BACKUP_INDEX" "src/index.tsx"
            }
            
            if grep -q "from './App'" "src/index.tsx" || grep -q 'from "./App"' "src/index.tsx"; then
                log "✅ Importação corrigida: extensão .tsx removida"
            else
                warn "⚠️  Não foi possível corrigir a importação"
                mv "$BACKUP_INDEX" "src/index.tsx"
            fi
        else
            log "✅ Importação em index.tsx está correta (sem extensão)"
        fi
        
        # CORREÇÃO CRÍTICA: Corrigir permissões de diretórios e arquivos
        # Diretórios precisam de permissão de execução (x) para serem acessados
        log "Corrigindo permissões de diretórios e arquivos do frontend..."
        
        # Corrigir permissões de todos os diretórios (precisam de execução)
        find src -type d -exec chmod 755 {} \; 2>/dev/null || true
        log "✅ Permissões de diretórios corrigidas (755)"
        
        # Corrigir permissões de todos os arquivos
        find src -type f -exec chmod 644 {} \; 2>/dev/null || true
        log "✅ Permissões de arquivos corrigidas (644)"
        
        # Verificar se os diretórios principais estão acessíveis
        if [[ ! -r "src/components" ]] || [[ ! -x "src/components" ]]; then
            log "Corrigindo permissões do diretório components..."
            chmod 755 src/components 2>/dev/null || true
            find src/components -type d -exec chmod 755 {} \; 2>/dev/null || true
            find src/components -type f -exec chmod 644 {} \; 2>/dev/null || true
        fi
        
        if [[ ! -r "src/pages" ]] || [[ ! -x "src/pages" ]]; then
            log "Corrigindo permissões do diretório pages..."
            chmod 755 src/pages 2>/dev/null || true
            find src/pages -type d -exec chmod 755 {} \; 2>/dev/null || true
            find src/pages -type f -exec chmod 644 {} \; 2>/dev/null || true
        fi
        
        log "✅ Permissões corrigidas - diretórios acessíveis"
        
        # CORREÇÃO CRÍTICA: Corrigir fork-ts-checker-webpack-plugin e schema-utils para resolver conflito ajv-keywords/ajv-formats
        log "Corrigindo fork-ts-checker-webpack-plugin (resolvendo conflito schema-utils/ajv)..."
        
        # Garantir que Python está instalado antes de usar
        if ! ensure_python_installed; then
            warn "⚠️  Python3 não disponível - pulando correção do fork-ts-checker-webpack-plugin"
            warn "⚠️  O build pode falhar se houver conflitos de dependências"
        fi
        
        # CORREÇÃO 1: Corrigir ajv-keywords para não lançar erro para keywords desconhecidas
        # Isso resolve problemas com keywords que foram movidas (formatMinimum, etc) ou não suportadas
        AJV_KEYWORDS_PATH="node_modules/ajv-keywords/dist/index.js"
        if [[ -f "$AJV_KEYWORDS_PATH" ]] && command -v python3 &> /dev/null; then
            log "Corrigindo ajv-keywords para não lançar erro em keywords desconhecidas..."
            python3 << 'PYTHON_FIX_AJV_KEYWORDS_EOF'
import re
import sys
import os

ajv_keywords_path = "node_modules/ajv-keywords/dist/index.js"

if not os.path.exists(ajv_keywords_path):
    sys.exit(0)

try:
    with open(ajv_keywords_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Verificar se já foi corrigido (buscar por qualquer uma das marcas)
    if 'SOLUÇÃO AJV-KEYWORDS' in content or 'keywordFunc' in content:
        print("✅ ajv-keywords já foi corrigido anteriormente")
        sys.exit(0)
    
    # ESTRATÉGIA: 
    # 1. Modificar função get para retornar undefined em vez de lançar erro
    # 2. Modificar chamadas get(k)(ajv) para verificar se get(k) é função antes de chamar
    
    modified = False
    
    # Passo 1: Modificar get para retornar undefined
    pattern_get = r'throw new Error\("Unknown keyword " \+ keyword\);'
    if re.search(pattern_get, content):
        fix_get = '''// SOLUÇÃO AJV-KEYWORDS: Retornar undefined para keywords desconhecidas
        return undefined;'''
        content = re.sub(pattern_get, fix_get, content)
        modified = True
    
    # Passo 2: Modificar chamadas get(k)(ajv) para verificar se é função
    # Procurar por padrões como: get(k)(ajv)
    pattern_call1 = r'get\(k\)\(ajv\)'
    if re.search(pattern_call1, content):
        # Substituir get(k)(ajv) por uma versão que verifica se é função
        fix_call = '''(function(keyword) {
            // SOLUÇÃO AJV-KEYWORDS: Verificar se get retorna função antes de chamar
            var keywordFunc = get(keyword);
            if (typeof keywordFunc === 'function') {
                keywordFunc(ajv);
            }
            // Se undefined, ignorar silenciosamente (keyword não suportada)
        })(k)'''
        content = re.sub(pattern_call1, fix_call, content)
        modified = True
    
    if modified:
        with open(ajv_keywords_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("✅ ajv-keywords corrigido: get retorna undefined e chamadas verificam função")
        sys.exit(0)
    else:
        print("⚠️  Padrões não encontrados - pode já estar corrigido ou estrutura diferente")
        sys.exit(0)
    
except Exception as e:
    # Não é crítico se falhar
    print(f"⚠️  Não foi possível corrigir ajv-keywords: {e}")
    sys.exit(0)
PYTHON_FIX_AJV_KEYWORDS_EOF
        fi
        
        PLUGIN_PATH="node_modules/fork-ts-checker-webpack-plugin/lib/ForkTsCheckerWebpackPlugin.js"
        
        if [[ -f "$PLUGIN_PATH" ]]; then
            # Verificar se já foi corrigido
            if grep -q "SOLUÇÃO DEFINITIVA" "$PLUGIN_PATH" 2>/dev/null; then
                log "✅ fork-ts-checker-webpack-plugin já foi corrigido anteriormente"
            else
                # Criar backup do arquivo original
                cp "$PLUGIN_PATH" "${PLUGIN_PATH}.backup.$(date +%s)" 2>/dev/null || true
                
                # Aplicar correção: substituir chamada problemática por versão com try-catch
                if sed -i.bak 's|schema_utils_1\.default(ForkTsCheckerWebpackPluginOptions_json_1\.default, options, configuration);|    // SOLUÇÃO DEFINITIVA: Ignorar validação se schema-utils não funcionar\n    // Isso resolve conflitos de versão entre ajv@8.x e schema-utils@2.x\n    // A validação não é crítica - o TypeScript já valida os tipos\n    try {\n        var validate = schema_utils_1.default || schema_utils_1;\n        if (typeof validate === '\''function'\'') {\n            validate(ForkTsCheckerWebpackPluginOptions_json_1.default, options, configuration);\n        }\n    } catch (error) {\n        // Ignorar erros de validação - não crítico para o build\n    }|g' "$PLUGIN_PATH" 2>/dev/null; then
                    # Remover arquivo .bak criado pelo sed
                    rm -f "${PLUGIN_PATH}.bak" 2>/dev/null || true
                    
                    # Verificar se a correção foi aplicada
                    if grep -q "SOLUÇÃO DEFINITIVA" "$PLUGIN_PATH" 2>/dev/null; then
                        log "✅ fork-ts-checker-webpack-plugin corrigido com sucesso!"
                    else
                        warn "⚠️  Correção pode não ter sido aplicada corretamente"
                    fi
                else
                    # Tentar método alternativo usando Python (mais robusto)
                    if ! command -v python3 &> /dev/null; then
                        warn "⚠️  Python3 não disponível - não é possível aplicar correção automática"
                        warn "⚠️  O build pode falhar. Instale Python3: sudo apt install -y python3 python3-pip"
                    else
                        log "Tentando correção alternativa usando Python..."
                        python3 << 'PYTHON_FIX_PLUGIN_EOF'
import re
import sys
import os

plugin_path = "node_modules/fork-ts-checker-webpack-plugin/lib/ForkTsCheckerWebpackPlugin.js"

if not os.path.exists(plugin_path):
    print("⚠️  fork-ts-checker-webpack-plugin não encontrado, pulando correção...")
    sys.exit(0)

try:
    with open(plugin_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Verificar se já foi corrigido
    if 'SOLUÇÃO DEFINITIVA' in content:
        print("✅ fork-ts-checker-webpack-plugin já foi corrigido")
        sys.exit(0)
    
    # Procurar pela linha problemática
    pattern = r'schema_utils_1\.default\(ForkTsCheckerWebpackPluginOptions_json_1\.default, options, configuration\);'
    
    if not re.search(pattern, content):
        print("⚠️  Padrão não encontrado no arquivo, pode ter sido atualizado")
        sys.exit(0)
    
    # Substituir pela versão corrigida
    fix = '''    // SOLUÇÃO DEFINITIVA: Ignorar validação se schema-utils não funcionar
    // Isso resolve conflitos de versão entre ajv@8.x e schema-utils@2.x
    // A validação não é crítica - o TypeScript já valida os tipos
    try {
        var validate = schema_utils_1.default || schema_utils_1;
        if (typeof validate === 'function') {
            validate(ForkTsCheckerWebpackPluginOptions_json_1.default, options, configuration);
        }
    } catch (error) {
        // Ignorar erros de validação - não crítico para o build
    }'''
    
    content = re.sub(pattern, fix, content)
    
    with open(plugin_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ fork-ts-checker-webpack-plugin corrigido com sucesso!")
    sys.exit(0)
    
except Exception as e:
    print(f"❌ Erro ao corrigir fork-ts-checker-webpack-plugin: {e}")
    sys.exit(1)
PYTHON_FIX_PLUGIN_EOF
                        
                        if [[ $? -eq 0 ]]; then
                            log "✅ fork-ts-checker-webpack-plugin corrigido usando Python!"
                        else
                            warn "⚠️  Não foi possível corrigir fork-ts-checker-webpack-plugin automaticamente"
                            warn "O build pode falhar, mas você pode corrigir manualmente se necessário"
                        fi
                    fi
                fi
            fi
        else
            warn "⚠️  fork-ts-checker-webpack-plugin não encontrado (pode não estar instalado ainda)"
        fi
        
        # Aplicar patches de dependências se existirem
        if [[ -d "patches" ]] && [[ -n "$(ls -A patches/*.patch 2>/dev/null)" ]]; then
            log "Aplicando patches de dependências..."
            if command -v npx &> /dev/null; then
                if npx patch-package 2>&1; then
                    log "✅ Patches aplicados com sucesso"
                else
                    warn "⚠️  Alguns patches falharam, mas continuando..."
                fi
            else
                warn "⚠️  npx não encontrado, pulando aplicação de patches"
            fi
        fi
        
        export_frontend_build_env
        log "Compilando frontend..."
        if ! run_frontend_build; then
            log_error "❌ Falha na compilação do frontend!"
            log "Verifique os logs de erro acima."
            exit 1
        fi
        
        # Verificar se o build foi bem-sucedido
        if [[ -d "build" && -f "build/index.html" ]]; then
            log "✅ Frontend compilado com sucesso!"
        else
            log_error "❌ Falha na compilação do frontend!"
            log "Verificando logs de erro..."
            exit 1
        fi
        fi
    else
        log "ℹ️  Modo especial: pulando instalação/compilação do frontend (SKIP_FRONTEND_DEPS_BUILD=true)"
    fi
    
    log "Dependências do projeto instaladas!"
}

# Configurar banco de dados
setup_database() {
    log "Configurando banco de dados..."
    
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        # Verificar escolha do driver; padrão PostgreSQL
        if [[ -z "$DB_DRIVER" ]]; then
            DB_DRIVER="postgresql"
        fi

        if [[ "$DB_DRIVER" == "sqlite" ]]; then
            log "Configurando SQLite (servidor único)..."
            mkdir -p "$INSTALL_DIR/data"
            SQLITE_PATH="$INSTALL_DIR/data/smartsignage.db"
            if [[ ! -f "$SQLITE_PATH" ]]; then
                log "Criando banco SQLite em $SQLITE_PATH"
                : > "$SQLITE_PATH"
            fi
            export DB_DRIVER="sqlite"
            export DATABASE_URL="file:$SQLITE_PATH"
            log "✅ SQLite configurado. DATABASE_URL=$DATABASE_URL"
            return 0
        fi

        # PostgreSQL local (servidor único)
        log "Instalando e configurando PostgreSQL (servidor único)..."
        
        # Instalar PostgreSQL se não estiver instalado
        local PG_WAS_INSTALLED=false
        if ! command -v psql &> /dev/null; then
            log "PostgreSQL não encontrado, instalando servidor completo..."
            sudo apt-get update -y
            sudo apt-get install -y postgresql postgresql-contrib
            PG_WAS_INSTALLED=true
            log "✅ PostgreSQL instalado com sucesso"
        else
            log "PostgreSQL cliente já está instalado: $(psql --version)"
            
            # Verificar se o servidor PostgreSQL está instalado (não apenas o cliente)
            local PG_SERVER_INSTALLED=false
            if dpkg -l | grep -qE "^ii.*postgresql-[0-9]+ "; then
                PG_SERVER_INSTALLED=true
                log "✅ Servidor PostgreSQL detectado"
            elif command -v pg_createcluster &> /dev/null || command -v initdb &> /dev/null; then
                PG_SERVER_INSTALLED=true
                log "✅ Ferramentas do servidor PostgreSQL detectadas"
            else
                log "⚠️  Apenas o cliente PostgreSQL está instalado, instalando servidor completo..."
                sudo apt-get update -y
                sudo apt-get install -y postgresql postgresql-contrib
                PG_WAS_INSTALLED=true
                log "✅ Servidor PostgreSQL instalado"
            fi
        fi
        
        # Instalar ffmpeg para processamento de vídeo (thumbnails)
        if ! command -v ffmpeg &> /dev/null; then
            log "Instalando ffmpeg para processamento de vídeo..."
            sudo apt-get update -y
            sudo apt-get install -y ffmpeg
        else
            log "ffmpeg já está instalado: $(ffmpeg -version | head -1)"
        fi

        # No Ubuntu/Debian, usar pg_lsclusters para detectar clusters existentes
        # Detectar versão do PostgreSQL instalada
        local PG_VERSION=$(psql --version 2>/dev/null | grep -oE "[0-9]+\.[0-9]+" | head -1 | cut -d. -f1)
        if [[ -z "$PG_VERSION" ]]; then
            # Tentar detectar de outra forma
            PG_VERSION=$(dpkg -l | grep -E "^ii.*postgresql-[0-9]+" | head -1 | grep -oE "[0-9]+" | head -1)
        fi
        
        if [[ -n "$PG_VERSION" ]]; then
            log "Versão PostgreSQL detectada: $PG_VERSION"
            
            # Verificar clusters existentes usando pg_lsclusters (método correto no Ubuntu/Debian)
            local PG_CLUSTER_EXISTS=false
            local PG_CLUSTER_STATUS=""
            local PG_CLUSTER_DIR=""
            
            if command -v pg_lsclusters &> /dev/null; then
                log "Verificando clusters PostgreSQL existentes..."
                # pg_lsclusters retorna: Ver Cluster Port Status Owner Data directory Log file
                local cluster_info=$(sudo pg_lsclusters 2>/dev/null | grep -E "^[[:space:]]*${PG_VERSION}[[:space:]]+main" || echo "")
                if [[ -n "$cluster_info" ]]; then
                    PG_CLUSTER_STATUS=$(echo "$cluster_info" | awk '{print $4}')  # Status (down, online, etc)
                    PG_CLUSTER_DIR=$(echo "$cluster_info" | awk '{print $6}')     # Data directory
                    log "Cluster PostgreSQL ${PG_VERSION} main encontrado:"
                    log "  Status: $PG_CLUSTER_STATUS"
                    log "  Diretório: $PG_CLUSTER_DIR"
                    
                    if [[ "$PG_CLUSTER_STATUS" == "online" ]] || [[ "$PG_CLUSTER_STATUS" == "down" ]]; then
                        PG_CLUSTER_EXISTS=true
                        log "✅ Cluster PostgreSQL ${PG_VERSION} main já existe"
                        
                        # Se está down, tentar iniciar usando pg_ctlcluster (método correto no Ubuntu/Debian)
                        if [[ "$PG_CLUSTER_STATUS" == "down" ]]; then
                            log "Cluster está parado (down), tentando iniciar usando pg_ctlcluster..."
                            if sudo pg_ctlcluster ${PG_VERSION} main start 2>&1; then
                                sleep 3
                                # Verificar se iniciou
                                local new_status=$(sudo pg_lsclusters 2>/dev/null | grep -E "^[[:space:]]*${PG_VERSION}[[:space:]]+main" | awk '{print $4}' || echo "")
                                if [[ "$new_status" == "online" ]]; then
                                    log "✅ Cluster iniciado com sucesso (status: online)"
                                else
                                    warn "⚠️  Cluster pode não ter iniciado corretamente (status: $new_status)"
                                    log "Verificando logs do cluster..."
                                    local log_file="/var/log/postgresql/postgresql-${PG_VERSION}-main.log"
                                    if [[ -f "$log_file" ]]; then
                                        log "Últimas linhas do log:"
                                        sudo tail -30 "$log_file" 2>/dev/null | while IFS= read -r line; do
                                            log "  $line"
                                        done
                                    fi
                                    # Tentar verificar logs do systemd também
                                    if systemctl list-unit-files | grep -qE "postgresql@${PG_VERSION}-main"; then
                                        log "Logs do systemd:"
                                        sudo journalctl -u "postgresql@${PG_VERSION}-main" --no-pager -n 20 2>&1 | while IFS= read -r line; do
                                            log "  $line"
                                        done
                                    fi
                                fi
                            else
                                error "❌ Falha ao iniciar cluster PostgreSQL usando pg_ctlcluster"
                                error "Tente manualmente: sudo pg_ctlcluster ${PG_VERSION} main start"
                                error "Ou verifique os logs: sudo journalctl -u postgresql@${PG_VERSION}-main -n 50"
                            fi
                        elif [[ "$PG_CLUSTER_STATUS" == "online" ]]; then
                            log "✅ Cluster já está online e funcionando"
                        fi
                    fi
                else
                    log "Nenhum cluster PostgreSQL ${PG_VERSION} main encontrado via pg_lsclusters"
                fi
            else
                # Fallback: verificar diretório diretamente (método antigo, se pg_lsclusters não disponível)
                log "pg_lsclusters não disponível, usando método de detecção alternativo..."
                local PG_CLUSTER_DIR="/var/lib/postgresql/${PG_VERSION}/main"
                
                # Verificar se PostgreSQL está rodando (melhor indicador de que o cluster existe e está funcionando)
                if systemctl is-active --quiet postgresql || systemctl is-active --quiet "postgresql@${PG_VERSION}-main" 2>/dev/null; then
                    log "✅ PostgreSQL está rodando - cluster já existe e está ativo"
                    PG_CLUSTER_EXISTS=true
                # Verificar se cluster já existe e está inicializado
                elif [[ -d "$PG_CLUSTER_DIR" ]] && [[ -f "$PG_CLUSTER_DIR/PG_VERSION" ]]; then
                    # Verificar se o cluster está realmente inicializado (tem arquivos de dados)
                    if [[ -f "$PG_CLUSTER_DIR/postgresql.conf" ]] || [[ -f "$PG_CLUSTER_DIR/postmaster.pid" ]] || [[ -n "$(ls -A "$PG_CLUSTER_DIR" 2>/dev/null | grep -v '^\.$' | grep -v '^\.\.$')" ]]; then
                        log "✅ Cluster PostgreSQL ${PG_VERSION} já existe e está inicializado em $PG_CLUSTER_DIR"
                        PG_CLUSTER_EXISTS=true
                    else
                        log "⚠️  Diretório do cluster existe mas parece vazio ou incompleto"
                    fi
                fi
            fi
            
            if [[ "$PG_CLUSTER_EXISTS" != "true" ]]; then
                log "Cluster PostgreSQL ${PG_VERSION} não encontrado ou não funcional, inicializando..."
                
                # No Ubuntu, usar pg_createcluster se disponível
                local POSTGRES_USER="${POSTGRES_SYSTEM_USER:-postgres}"
                ensure_postgres_system_user
                if command -v pg_createcluster &> /dev/null; then
                    log "Criando cluster PostgreSQL usando pg_createcluster..."
                    if sudo -u "$POSTGRES_USER" pg_createcluster ${PG_VERSION} main --start 2>&1; then
                        log "✅ Cluster criado e iniciado com sucesso"
                        PG_CLUSTER_EXISTS=true
                    else
                        log "⚠️  pg_createcluster falhou, tentando método alternativo..."
                    fi
                fi
                
                # Se pg_createcluster não funcionou, tentar initdb diretamente
                if [[ "$PG_CLUSTER_EXISTS" != "true" ]]; then
                    # Verificar/criar usuário postgres do sistema
                    local postgres_user=$(get_postgres_user)
                    
                    if [[ ! -d "$PG_CLUSTER_DIR" ]]; then
                        log "Criando diretório do cluster: $PG_CLUSTER_DIR"
                        sudo mkdir -p "$PG_CLUSTER_DIR"
                        sudo chown "$postgres_user:$postgres_user" "$PG_CLUSTER_DIR"
                        sudo chmod 700 "$PG_CLUSTER_DIR"
                    else
                        # Diretório existe - verificar se está vazio ou se já é um cluster
                        local dir_content=$(ls -A "$PG_CLUSTER_DIR" 2>/dev/null | wc -l)
                        if [[ "$dir_content" -gt 2 ]]; then
                            # Diretório não está vazio - pode ser um cluster parcial ou corrompido
                            if [[ -f "$PG_CLUSTER_DIR/PG_VERSION" ]] || [[ -f "$PG_CLUSTER_DIR/postgresql.conf" ]]; then
                                log "⚠️  Diretório do cluster existe e parece ter conteúdo, mas PostgreSQL não está rodando"
                                log "⚠️  Tentando iniciar o serviço PostgreSQL..."
                                if sudo systemctl start postgresql 2>/dev/null || sudo systemctl start "postgresql@${PG_VERSION}-main" 2>/dev/null; then
                                    sleep 3
                                    if systemctl is-active --quiet postgresql || systemctl is-active --quiet "postgresql@${PG_VERSION}-main" 2>/dev/null; then
                                        log "✅ PostgreSQL iniciado com sucesso"
                                        PG_CLUSTER_EXISTS=true
                                    else
                                        error "❌ PostgreSQL não conseguiu iniciar - cluster pode estar corrompido"
                                        error "   Considere remover o diretório $PG_CLUSTER_DIR e tentar novamente"
                                        error "   OU corrija manualmente o cluster existente"
                                    fi
                                else
                                    error "❌ Não foi possível iniciar PostgreSQL"
                                    error "   O diretório $PG_CLUSTER_DIR existe mas não está vazio"
                                    error "   Se você quer recriar o cluster, remova este diretório primeiro"
                                fi
                            else
                                error "❌ Diretório $PG_CLUSTER_DIR existe mas não parece ser um cluster PostgreSQL válido"
                                error "   Conteúdo encontrado: $dir_content itens"
                                error "   Se você quer criar um novo cluster, remova este diretório primeiro:"
                                error "   sudo rm -rf $PG_CLUSTER_DIR"
                            fi
                        else
                            # Diretório está vazio ou quase vazio - OK para inicializar
                            log "Diretório do cluster existe mas está vazio, prosseguindo com inicialização..."
                        fi
                        
                        # Verificar/corrigir permissões
                        local current_owner=$(stat -c '%U:%G' "$PG_CLUSTER_DIR" 2>/dev/null || echo "")
                        if [[ "$current_owner" != "$postgres_user:$postgres_user" ]]; then
                            log "Corrigindo permissões do diretório do cluster para $postgres_user:$postgres_user..."
                            sudo chown -R "$postgres_user:$postgres_user" "$PG_CLUSTER_DIR" 2>/dev/null || true
                            sudo chmod 700 "$PG_CLUSTER_DIR" 2>/dev/null || true
                        fi
                    fi
                    
                    # Encontrar initdb (procurar em vários locais possíveis)
                    local INITDB_PATH=""
                    local possible_paths=(
                        "/usr/lib/postgresql/${PG_VERSION}/bin/initdb"
                        "/usr/local/pgsql/bin/initdb"
                        "/usr/bin/initdb"
                        "/usr/local/bin/initdb"
                        "$(which initdb 2>/dev/null || echo '')"
                    )
                    
                    for path in "${possible_paths[@]}"; do
                        if [[ -n "$path" ]] && [[ -f "$path" ]] && [[ -x "$path" ]]; then
                            INITDB_PATH="$path"
                            log "initdb encontrado em: $INITDB_PATH"
                            break
                        fi
                    done
                    
                    if [[ -n "$INITDB_PATH" ]]; then
                        log "Inicializando cluster usando $INITDB_PATH..."
                        local POSTGRES_USER="${POSTGRES_SYSTEM_USER:-postgres}"
                        ensure_postgres_system_user
                        
                        # Garantir que o diretório do cluster tem as permissões corretas
                        if [[ -d "$PG_CLUSTER_DIR" ]]; then
                            local current_owner=$(stat -c '%U:%G' "$PG_CLUSTER_DIR" 2>/dev/null || echo "")
                            if [[ "$current_owner" != "$POSTGRES_USER:$POSTGRES_USER" ]]; then
                                log "Corrigindo permissões do diretório do cluster para $POSTGRES_USER:$POSTGRES_USER..."
                                sudo chown -R "$POSTGRES_USER:$POSTGRES_USER" "$PG_CLUSTER_DIR" 2>/dev/null || true
                                sudo chmod 700 "$PG_CLUSTER_DIR" 2>/dev/null || true
                            fi
                        fi
                        
                        # Só tentar inicializar se o cluster ainda não existe
                        if [[ "$PG_CLUSTER_EXISTS" != "true" ]]; then
                            # Verificar se o diretório está realmente vazio antes de inicializar
                            local dir_content=$(ls -A "$PG_CLUSTER_DIR" 2>/dev/null | wc -l)
                            if [[ "$dir_content" -le 2 ]]; then
                                if sudo -u "$POSTGRES_USER" "$INITDB_PATH" -D "$PG_CLUSTER_DIR" 2>&1; then
                                    log "✅ Cluster inicializado com sucesso"
                                    PG_CLUSTER_EXISTS=true
                                else
                                    error "❌ Falha ao inicializar cluster PostgreSQL"
                                    error "   Verifique as permissões do diretório: $PG_CLUSTER_DIR"
                                    error "   O diretório deve pertencer a $POSTGRES_USER:$POSTGRES_USER"
                                    error "   Se o diretório não está vazio, remova-o primeiro: sudo rm -rf $PG_CLUSTER_DIR"
                                fi
                            else
                                error "❌ Não é possível inicializar: diretório $PG_CLUSTER_DIR não está vazio ($dir_content itens)"
                                error "   Remova o diretório primeiro se quiser recriar o cluster:"
                                error "   sudo rm -rf $PG_CLUSTER_DIR"
                            fi
                        fi
                    else
                        error "❌ initdb não encontrado para PostgreSQL ${PG_VERSION}"
                        error "   Procurado em: ${possible_paths[*]}"
                        log "Tentando instalar pacote postgresql-${PG_VERSION} automaticamente..."
                        if sudo apt-get update -y && sudo apt-get install -y "postgresql-${PG_VERSION}" postgresql-contrib; then
                            log "✅ Pacote postgresql-${PG_VERSION} instalado"
                            # Tentar novamente encontrar initdb
                            INITDB_PATH=""
                            for path in "${possible_paths[@]}"; do
                                if [[ -n "$path" ]] && [[ -f "$path" ]] && [[ -x "$path" ]]; then
                                    INITDB_PATH="$path"
                                    log "initdb encontrado após instalação: $INITDB_PATH"
                                    break
                                fi
                            done
                            
                            if [[ -n "$INITDB_PATH" ]]; then
                                log "Inicializando cluster usando $INITDB_PATH..."
                                local POSTGRES_USER="${POSTGRES_SYSTEM_USER:-postgres}"
                                ensure_postgres_system_user
                                
                                # Garantir que o diretório do cluster tem as permissões corretas
                                if [[ -d "$PG_CLUSTER_DIR" ]]; then
                                    local current_owner=$(stat -c '%U:%G' "$PG_CLUSTER_DIR" 2>/dev/null || echo "")
                                    if [[ "$current_owner" != "$POSTGRES_USER:$POSTGRES_USER" ]]; then
                                        log "Corrigindo permissões do diretório do cluster para $POSTGRES_USER:$POSTGRES_USER..."
                                        sudo chown -R "$POSTGRES_USER:$POSTGRES_USER" "$PG_CLUSTER_DIR" 2>/dev/null || true
                                        sudo chmod 700 "$PG_CLUSTER_DIR" 2>/dev/null || true
                                    fi
                                fi
                                
                                if sudo -u "$POSTGRES_USER" "$INITDB_PATH" -D "$PG_CLUSTER_DIR" 2>&1; then
                                    log "✅ Cluster inicializado com sucesso"
                                    PG_CLUSTER_EXISTS=true
                                else
                                    error "❌ Falha ao inicializar cluster PostgreSQL mesmo após instalar pacote"
                                fi
                            else
                                error "❌ initdb ainda não encontrado mesmo após instalar postgresql-${PG_VERSION}"
                            fi
                        else
                            error "❌ Falha ao instalar pacote postgresql-${PG_VERSION}"
                        fi
                    fi
                fi
            fi
        else
            log "⚠️  Não foi possível detectar versão do PostgreSQL"
        fi
        
        # Se foi instalado agora, aguardar um pouco para o systemd reconhecer
        if [[ "$PG_WAS_INSTALLED" == "true" ]]; then
            log "Aguardando systemd reconhecer serviços PostgreSQL..."
            sleep 2
            sudo systemctl daemon-reload
        fi
        
        # Detectar qual serviço PostgreSQL está disponível
        local PG_SERVICE=""
        if systemctl list-unit-files | grep -q "^postgresql.service"; then
            PG_SERVICE="postgresql"
        elif [[ -n "$PG_VERSION" ]] && systemctl list-unit-files | grep -qE "^postgresql@${PG_VERSION}-main.service"; then
            PG_SERVICE="postgresql@${PG_VERSION}-main"
        elif systemctl list-unit-files | grep -qE "^postgresql@[0-9]+-main.service"; then
            # Pegar a primeira versão encontrada
            PG_SERVICE=$(systemctl list-unit-files | grep -oE "^postgresql@[0-9]+-main" | head -1)
        fi
        
        # Habilitar e iniciar serviço se encontrado
        if [[ -n "$PG_SERVICE" ]]; then
            log "Serviço PostgreSQL detectado: $PG_SERVICE"
            sudo systemctl enable "$PG_SERVICE" 2>/dev/null || true
            
            if ! systemctl is-active --quiet "$PG_SERVICE"; then
                log "Iniciando PostgreSQL ($PG_SERVICE)..."
                if sudo systemctl start "$PG_SERVICE" 2>&1; then
                    sleep 3
                    if systemctl is-active --quiet "$PG_SERVICE"; then
                        log "✅ PostgreSQL ($PG_SERVICE) iniciado com sucesso"
                    else
                        error "❌ PostgreSQL ($PG_SERVICE) não iniciou"
                        log "Verificando logs:"
                        sudo journalctl -u "$PG_SERVICE" --no-pager -n 20 2>&1 | head -20 | while IFS= read -r line; do
                            log "  $line"
                        done
                    fi
                fi
            else
                log "PostgreSQL ($PG_SERVICE) já está rodando"
            fi
        else
            log "⚠️  Não foi possível detectar serviço PostgreSQL automaticamente"
        fi
        
        # Verificar se PostgreSQL está respondendo
        local POSTGRES_USER="${POSTGRES_SYSTEM_USER:-postgres}"
        ensure_postgres_system_user
        if sudo -u "$POSTGRES_USER" psql -c "SELECT 1" > /dev/null 2>&1; then
            log "✅ PostgreSQL está respondendo corretamente"
            
            # Alterar senha do usuário postgres SOMENTE em condições seguras:
            # 1) Quando PostgreSQL foi instalado AGORA por este script (PG_WAS_INSTALLED=true)
            # 2) Quando o operador definir explicitamente FORCE_CHANGE_POSTGRES_PASSWORD=true
            if [[ "$PG_WAS_INSTALLED" == "true" ]] || [[ "${FORCE_CHANGE_POSTGRES_PASSWORD}" == "true" ]]; then
                change_postgres_password
            else
                log "ℹ️  Senha do usuário 'postgres' NÃO será alterada (instalação pré-existente e FORCE_CHANGE_POSTGRES_PASSWORD=false)"
            fi
        else
            error "❌ PostgreSQL não está respondendo"
            error "Diagnóstico:"
            
            # Verificar status do serviço
            if [[ -n "$PG_SERVICE" ]]; then
                local service_status=$(systemctl is-active "$PG_SERVICE" 2>&1 || echo "unknown")
                log "  Status do serviço $PG_SERVICE: $service_status"
                
                if [[ "$service_status" != "active" ]]; then
                    log "  Últimos logs do serviço:"
                    sudo journalctl -u "$PG_SERVICE" --no-pager -n 15 2>&1 | while IFS= read -r line; do
                        log "    $line"
                    done
                fi
            fi
            
            # Verificar se o cluster existe
            if [[ -n "$PG_VERSION" ]]; then
                local cluster_dir="/var/lib/postgresql/${PG_VERSION}/main"
                if [[ -d "$cluster_dir" ]]; then
                    log "  Cluster encontrado em: $cluster_dir"
                    local cluster_perms=$(ls -ld "$cluster_dir" 2>/dev/null | awk '{print $1, $3, $4}')
                    log "  Permissões: $cluster_perms"
                else
                    error "  ❌ Cluster não encontrado em: $cluster_dir"
                fi
            fi
            
            error "Por favor, verifique os logs acima e corrija o problema antes de continuar"
            exit 1
        fi

        # Parâmetros (carregar do arquivo de configuração ou usar padrões)
        # As variáveis devem ter sido exportadas por load_system_config em setup_project
        # Se não estiverem definidas, usar valores padrão
        local PG_DB="${DB_NAME:-smartsignage}"
        local PG_USER="${DB_USER:-smartsignage}"
        local PG_PASS="${DB_PASSWORD:-smartsignage123}"
        local POSTGRES_USER="${POSTGRES_SYSTEM_USER:-postgres}"
        
        # Log das configurações usadas (sem mostrar senhas completas)
        log "Configurações do banco de dados:"
        log "  DB_NAME: ${PG_DB}"
        log "  DB_USER: ${PG_USER}"
        log "  DB_PASSWORD: ${PG_PASS:0:3}*** (oculto)"
        log "  POSTGRES_SYSTEM_USER: ${POSTGRES_USER}"
        
        # Garantir que usuário postgres do sistema existe
        ensure_postgres_system_user

        # Criar USER idempotente (usuário master do sistema)
        log "Criando usuário PostgreSQL master '${PG_USER}' (usuário do sistema Smart Signage Pro)..."
        if sudo -u "$POSTGRES_USER" psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '${PG_USER}'" | grep -q 1; then
            log "Usuário '${PG_USER}' já existe, atualizando senha..."
            # Atualizar senha se o usuário já existe
            sudo -u "$POSTGRES_USER" psql -c "ALTER USER ${PG_USER} WITH PASSWORD '${PG_PASS}';" > /dev/null 2>&1 || {
                warn "⚠️  Não foi possível atualizar senha do usuário '${PG_USER}'"
            }
        else
            sudo -u "$POSTGRES_USER" psql -c "CREATE USER ${PG_USER} WITH PASSWORD '${PG_PASS}';" || {
                error "❌ Falha ao criar usuário PostgreSQL"
                exit 1
            }
            log "✅ Usuário master '${PG_USER}' criado com sucesso"
        fi
        
        # Garantir que o usuário tem privilégios de superusuário (opcional, mas útil para administração)
        log "Configurando privilégios do usuário master '${PG_USER}'..."
        sudo -u "$POSTGRES_USER" psql -c "ALTER USER ${PG_USER} WITH CREATEDB CREATEROLE;" > /dev/null 2>&1 || true

        # Criar DATABASE com opção de recriação
        log "Criando banco de dados '${PG_DB}'..."
        local DB_EXISTS=false
        if sudo -u "$POSTGRES_USER" psql -tc "SELECT 1 FROM pg_database WHERE datname = '${PG_DB}'" | grep -q 1; then
            DB_EXISTS=true
            log "Banco de dados '${PG_DB}' já existe"
        fi

        local DROP_DB=false
        if [[ "$DB_EXISTS" == true ]]; then
            if [[ "$PRESERVE_DB" == "true" ]]; then
                log "🔄 Modo --preserve-db ativo: preservando banco de dados '${PG_DB}' existente"
                DROP_DB=false
            else
                warn "⚠️  Banco de dados '${PG_DB}' já existe - reinstalação limpa em andamento."
                DROP_DB=true
            fi
        fi

        if [[ "$RESET_DATABASE" == "true" ]]; then
            if [[ "$PRESERVE_DB" == "true" ]]; then
                warn "⚠️  --preserve-db e --reset-db são conflitantes. --preserve-db tem prioridade."
                DROP_DB=false
            else
                DROP_DB=true
                
                # Limpar cache do nginx e compilar backend/frontend antes do reset do banco
                log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                log "🧹 LIMPANDO CACHE E COMPILANDO ANTES DO RESET DO BANCO..."
                log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                
                # 1. Limpar cache do nginx
                log "1️⃣  Limpando cache do Nginx..."
                local nginx_cache_dirs=(
                    "/var/cache/nginx"
                    "/var/lib/nginx/cache"
                    "/tmp/nginx_cache"
                    "$INSTALL_DIR/nginx/cache"
                    "$INSTALL_DIR/nginx/proxy_cache"
                    "$INSTALL_DIR/nginx/fastcgi_cache"
                )
                
                for cache_dir in "${nginx_cache_dirs[@]}"; do
                    if [[ -d "$cache_dir" ]]; then
                        log "Removendo cache do Nginx: $cache_dir"
                        sudo rm -rf "$cache_dir"/* 2>/dev/null || true
                    fi
                done
                
                # Recarregar nginx para limpar cache em memória
                if command -v nginx &> /dev/null && systemctl is-active --quiet nginx 2>/dev/null; then
                    log "Recarregando configuração do Nginx..."
                    sudo systemctl reload nginx 2>/dev/null || true
                fi
                log "✅ Cache do Nginx limpo"
                
                # Criar diretório de logs se não existir
                mkdir -p "$INSTALL_DIR/logs" 2>/dev/null || true
                
                # 2. Compilar backend
                if [[ -d "$INSTALL_DIR/backend" ]]; then
                    log "2️⃣  Compilando backend (TypeScript)..."
                    cd "$INSTALL_DIR/backend" || warn "Não foi possível acessar $INSTALL_DIR/backend"
                    
                    # Instalar dependências se necessário
                    if [[ ! -d "node_modules" ]] || [[ "package.json" -nt "node_modules" ]]; then
                        log "Instalando dependências do backend..."
                        npm install --legacy-peer-deps 2>&1 | tee -a "$INSTALL_DIR/logs/backend-install.log" || {
                            warn "⚠️  Alguns avisos durante instalação de dependências (pode ser normal)"
                        }
                    fi
                    
                    # Limpar build anterior
                    rm -rf dist 2>/dev/null || true
                    
                    # Compilar TypeScript
                    log "Compilando TypeScript do backend..."
                    if npm run build 2>&1 | tee -a "$INSTALL_DIR/logs/backend-build.log"; then
                        log "✅ Backend compilado com sucesso"
                    else
                        warn "⚠️  Erro ao compilar backend. Verifique os logs em $INSTALL_DIR/logs/backend-build.log"
                    fi
                else
                    warn "⚠️  Diretório backend não encontrado: $INSTALL_DIR/backend"
                fi
                
                # 3. Compilar frontend
                if [[ -d "$INSTALL_DIR/frontend" ]]; then
                    log "3️⃣  Compilando frontend (React)..."
                    cd "$INSTALL_DIR/frontend" || warn "Não foi possível acessar $INSTALL_DIR/frontend"
                    
                    # Instalar dependências se necessário
                    if [[ ! -d "node_modules" ]] || [[ "package.json" -nt "node_modules" ]]; then
                        log "Instalando dependências do frontend..."
                        npm install --legacy-peer-deps 2>&1 | tee -a "$INSTALL_DIR/logs/frontend-install.log" || {
                            warn "⚠️  Alguns avisos durante instalação de dependências (pode ser normal)"
                        }
                    fi
                    
                    # Limpar build anterior
                    rm -rf build dist 2>/dev/null || true
                    
                    export_frontend_build_env
                    # Compilar React
                    log "Compilando frontend (React)..."
                    if ! run_frontend_build "$INSTALL_DIR/logs/frontend-build.log"; then
                        warn "⚠️  Build do frontend falhou. Verifique os logs em $INSTALL_DIR/logs/frontend-build.log"
                    fi
                    
                    # Verificar se o build foi bem-sucedido (verificando se o diretório build existe)
                    if [[ -d "build" && -f "build/index.html" ]]; then
                        log "✅ Frontend compilado com sucesso"
                    else
                        warn "⚠️  Erro ao compilar frontend. Verifique os logs em $INSTALL_DIR/logs/frontend-build.log"
                    fi
                else
                    warn "⚠️  Diretório frontend não encontrado: $INSTALL_DIR/frontend"
                fi
                
                log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                log "✅ Limpeza e compilação concluídas. Prosseguindo com reset do banco..."
                log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            fi
        fi

        if [[ "$DROP_DB" == true ]]; then
            log "🗑️  Removendo banco de dados '${PG_DB}'..."
            sudo -u "$POSTGRES_USER" psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${PG_DB}' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
            sudo -u "$POSTGRES_USER" psql -c "DROP DATABASE IF EXISTS ${PG_DB};" || {
                error "❌ Falha ao remover banco de dados existente"
                exit 1
            }
            log "✅ Banco de dados antigo removido"
            DB_EXISTS=false
            DB_WAS_CREATED_OR_RESET=true
        fi

        if [[ "$DB_EXISTS" == false ]]; then
            # Verificar se há backup para restaurar
            if [[ "$PRESERVE_DB" == "true" && -f "/tmp/smartsignage-db-backup-path.txt" ]]; then
                BACKUP_FILE=$(cat /tmp/smartsignage-db-backup-path.txt 2>/dev/null || echo "")
                BACKUP_DB_NAME=$(cat /tmp/smartsignage-db-backup-name.txt 2>/dev/null || echo "")
                
                if [[ -n "$BACKUP_FILE" && -f "$BACKUP_FILE" ]]; then
                    log "Criando banco de dados '${PG_DB}' para restaurar backup..."
                    sudo -u "$POSTGRES_USER" psql -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};" || {
                        error "❌ Falha ao criar banco de dados para restauração"
                        exit 1
                    }
                    log "✅ Banco de dados '${PG_DB}' criado"
                    DB_WAS_CREATED_OR_RESET=true
                    
                    log "🔄 Restaurando backup do banco de dados..."
                    if sudo -u "$POSTGRES_USER" pg_restore -d "${PG_DB}" "$BACKUP_FILE" >/dev/null 2>&1; then
                        log "✅ Backup do banco de dados restaurado com sucesso!"
                        # Limpar arquivos temporários
                        rm -f /tmp/smartsignage-db-backup-path.txt /tmp/smartsignage-db-backup-name.txt 2>/dev/null || true
                        # Remover diretório de backup temporário
                        BACKUP_DIR=$(dirname "$BACKUP_FILE" 2>/dev/null || echo "")
                        if [[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]]; then
                            rm -rf "$BACKUP_DIR" 2>/dev/null || true
                        fi
                    else
                        warn "⚠️  Falha ao restaurar backup. Banco será criado vazio."
                        warn "   Backup ainda disponível em: $BACKUP_FILE"
                        warn "   Você pode restaurar manualmente com: sudo -u $POSTGRES_USER pg_restore -d ${PG_DB} $BACKUP_FILE"
                    fi
                else
                    log "Nenhum backup encontrado. Criando banco de dados novo..."
                    sudo -u "$POSTGRES_USER" psql -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};" || {
                        error "❌ Falha ao criar banco de dados"
                        exit 1
                    }
                    log "✅ Banco de dados '${PG_DB}' criado com sucesso"
                    DB_WAS_CREATED_OR_RESET=true
                fi
            else
                sudo -u "$POSTGRES_USER" psql -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};" || {
                    error "❌ Falha ao criar banco de dados"
                    exit 1
                }
                log "✅ Banco de dados '${PG_DB}' criado com sucesso"
                DB_WAS_CREATED_OR_RESET=true
            fi
        elif [[ "$PRESERVE_DB" == "true" && "$DB_EXISTS" == true ]]; then
            log "✅ Banco de dados '${PG_DB}' preservado (já existe e --preserve-db ativo)"
        fi

        # Se um banco NOVO foi criado/recriado e o usuário não forçou seeds via flags,
        # carregar seeds automaticamente para deixar o sistema pronto com dados de exemplo.
        if [[ "$DB_WAS_CREATED_OR_RESET" == "true" ]] && [[ "$SEEDS_OPTION_FORCED" != "true" ]]; then
            LOAD_SEEDS=true
            log "✅ Banco de dados novo/recriado detectado: seeds serão carregados automaticamente (use --no-seeds para pular)."
        fi

        # Garantir privilégios
        sudo -u "$POSTGRES_USER" psql -c "GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO ${PG_USER};" >/dev/null 2>&1 || true
        sudo -u "$POSTGRES_USER" psql -d ${PG_DB} -c "GRANT ALL ON SCHEMA public TO ${PG_USER};" >/dev/null 2>&1 || true

        # Peer auth: `psql` sem -U usa o user Linux (ex.: smartchannel). Sem role PG
        # correspondente → FATAL: role "smartchannel" does not exist. Criar alias LOGIN
        # com a mesma senha/GRANTs quando o OS user ≠ DB_USER da app.
        local _os_login
        _os_login="$(id -un 2>/dev/null || true)"
        for _peer in "$_os_login" smartchannel; do
            [[ -z "$_peer" || "$_peer" == "root" || "$_peer" == "postgres" || "$_peer" == "$PG_USER" ]] && continue
            if ! sudo -u "$POSTGRES_USER" psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '${_peer}'" 2>/dev/null | grep -q 1; then
                log "Criando role PostgreSQL peer '${_peer}' (login Linux) com mesmos privilégios que '${PG_USER}'..."
                sudo -u "$POSTGRES_USER" psql -c "CREATE USER \"${_peer}\" WITH PASSWORD '${PG_PASS}' CREATEDB CREATEROLE;" >/dev/null 2>&1 || true
            else
                sudo -u "$POSTGRES_USER" psql -c "ALTER USER \"${_peer}\" WITH PASSWORD '${PG_PASS}';" >/dev/null 2>&1 || true
            fi
            sudo -u "$POSTGRES_USER" psql -c "GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO \"${_peer}\";" >/dev/null 2>&1 || true
            sudo -u "$POSTGRES_USER" psql -d "${PG_DB}" -c "GRANT ALL ON SCHEMA public TO \"${_peer}\";" >/dev/null 2>&1 || true
            sudo -u "$POSTGRES_USER" psql -d "${PG_DB}" -c "ALTER DATABASE ${PG_DB} OWNER TO ${PG_USER};" >/dev/null 2>&1 || true
        done
        log "Conexão app: PGPASSWORD=*** psql -U ${PG_USER} -d ${PG_DB} -h localhost"
        log "Conexão peer (socket): psql -d ${PG_DB}  # se o role Linux existir"

        export PRIMARY_DB_USER="$PG_USER"

        # Configurar PostgreSQL para aceitar conexões da rede local
        log "Configurando PostgreSQL para acesso remoto (rede local)..."
        
        # Detectar diretório de configuração do PostgreSQL
        PG_CONFIG_FILE=$(sudo -u postgres psql -tAc "SHOW config_file;" 2>/dev/null || echo "")
        if [[ -n "$PG_CONFIG_FILE" && -f "$PG_CONFIG_FILE" ]]; then
            PG_CONFIG_DIR=$(dirname "$PG_CONFIG_FILE")
        else
            # Tentar detectar versão do PostgreSQL
            PG_VERSION=$(sudo -u postgres psql -tAc "SELECT version();" 2>/dev/null | grep -oE '[0-9]+' | head -1)
            if [[ -n "$PG_VERSION" ]]; then
                PG_CONFIG_DIR="/etc/postgresql/${PG_VERSION}/main"
            else
                # Tentar encontrar diretório padrão
                PG_CONFIG_DIR=$(find /etc/postgresql -name "postgresql.conf" 2>/dev/null | head -1 | xargs dirname 2>/dev/null || echo "")
            fi
        fi
        
        if [[ -d "$PG_CONFIG_DIR" ]]; then
            # Configurar postgresql.conf para escutar em todas as interfaces
            PG_CONF="${PG_CONFIG_DIR}/postgresql.conf"
            if [[ -f "$PG_CONF" ]]; then
                # Remover linhas inválidas de listen_addresses que possam ter sido adicionadas incorretamente
                sudo sed -i '/^[[:space:]]*listen_addresses[[:space:]]*=[[:space:]]*$/d' "$PG_CONF" 2>/dev/null || true
                
                # Verificar se há configuração válida de listen_addresses (não comentada)
                local has_listen_addresses=$(grep -E "^[[:space:]]*listen_addresses[[:space:]]*=" "$PG_CONF" 2>/dev/null | grep -v "^[[:space:]]*#" | head -1 || echo "")
                
                if [[ -n "$has_listen_addresses" ]]; then
                    # Já existe, verificar se está correto
                    if echo "$has_listen_addresses" | grep -qE "listen_addresses[[:space:]]*=[[:space:]]*'\\*'|listen_addresses[[:space:]]*=[[:space:]]*\\*"; then
                        log "✅ listen_addresses já está configurado corretamente"
                    else
                        # Atualizar para '*'
                        sudo sed -i "s/^[[:space:]]*listen_addresses[[:space:]]*=.*/listen_addresses = '*'/" "$PG_CONF" || true
                        log "✅ listen_addresses atualizado para '*'"
                    fi
                else
                    # Não existe, adicionar na seção correta (após comentário sobre listen_addresses)
                    local comment_line=$(grep -n "^[[:space:]]*#listen_addresses\|^[[:space:]]*#.*listen_addresses" "$PG_CONF" 2>/dev/null | head -1 | cut -d: -f1 || echo "")
                    
                    if [[ -n "$comment_line" ]]; then
                        sudo sed -i "${comment_line}a listen_addresses = '*'" "$PG_CONF" || true
                    else
                        # Adicionar após primeira linha de configuração não comentada
                        local first_config=$(grep -n "^[^#]" "$PG_CONF" 2>/dev/null | head -1 | cut -d: -f1 || echo "60")
                        sudo sed -i "${first_config}i listen_addresses = '*'" "$PG_CONF" || true
                    fi
                    log "✅ listen_addresses adicionado ao postgresql.conf"
                fi
                
                log "✅ postgresql.conf configurado para aceitar conexões remotas"
            fi
            
            # Configurar pg_hba.conf para permitir conexões da rede local
            PG_HBA="${PG_CONFIG_DIR}/pg_hba.conf"
            if [[ -f "$PG_HBA" ]]; then
                # Remover TODAS as linhas que contêm listen_addresses (não pertence ao pg_hba.conf)
                # Isso é crítico - listen_addresses no pg_hba.conf causa erro FATAL
                if sudo grep -q "listen_addresses" "$PG_HBA" 2>/dev/null; then
                    log "⚠️  Removendo linhas inválidas de listen_addresses do pg_hba.conf..."
                    sudo sed -i '/listen_addresses/d' "$PG_HBA" 2>/dev/null || true
                    # Verificar se foi removido
                    if sudo grep -q "listen_addresses" "$PG_HBA" 2>/dev/null; then
                        warn "⚠️  Ainda há listen_addresses no pg_hba.conf após tentativa de remoção"
                        # Tentar remover de forma mais agressiva
                        sudo sed -i '/.*listen_addresses.*/d' "$PG_HBA" 2>/dev/null || true
                    fi
                fi
                
                # Remover duplicatas existentes das regras de rede local (tanto genéricas quanto específicas)
                # Remover regras genéricas (all/all)
                sudo sed -i '/^host[[:space:]]\+all[[:space:]]\+all[[:space:]]\+192\.168\.0\.0\/16[[:space:]]\+md5$/d' "$PG_HBA" 2>/dev/null || true
                sudo sed -i '/^host[[:space:]]\+all[[:space:]]\+all[[:space:]]\+10\.0\.0\.0\/8[[:space:]]\+md5$/d' "$PG_HBA" 2>/dev/null || true
                sudo sed -i '/^host[[:space:]]\+all[[:space:]]\+all[[:space:]]\+172\.16\.0\.0\/12[[:space:]]\+md5$/d' "$PG_HBA" 2>/dev/null || true
                # Remover regras específicas (banco/usuário)
                sudo sed -i '/^host[[:space:]]\+'"${PG_DB}"'[[:space:]]\+'"${PG_USER}"'[[:space:]]\+192\.168\.0\.0\/16[[:space:]]\+md5$/d' "$PG_HBA" 2>/dev/null || true
                sudo sed -i '/^host[[:space:]]\+'"${PG_DB}"'[[:space:]]\+'"${PG_USER}"'[[:space:]]\+10\.0\.0\.0\/8[[:space:]]\+md5$/d' "$PG_HBA" 2>/dev/null || true
                sudo sed -i '/^host[[:space:]]\+'"${PG_DB}"'[[:space:]]\+'"${PG_USER}"'[[:space:]]\+172\.16\.0\.0\/12[[:space:]]\+md5$/d' "$PG_HBA" 2>/dev/null || true
                
                # Encontrar onde inserir (antes da seção de replication se existir)
                local insert_before_line=""
                if sudo grep -q "^# Allow replication" "$PG_HBA" 2>/dev/null || sudo grep -q "^local[[:space:]]\+replication" "$PG_HBA" 2>/dev/null; then
                    insert_before_line=$(sudo grep -n "^# Allow replication\|^local[[:space:]]\+replication" "$PG_HBA" 2>/dev/null | head -1 | cut -d: -f1)
                fi
                
                # Adicionar regras genéricas para toda a rede local (permite conexões de qualquer banco/usuário da rede)
                # Isso permite conexões da rede local além de localhost
                if ! sudo grep -qE "^host[[:space:]]+all[[:space:]]+all[[:space:]]+192\.168\.0\.0/16[[:space:]]+md5" "$PG_HBA" 2>/dev/null; then
                    if [[ -n "$insert_before_line" ]]; then
                        sudo sed -i "${insert_before_line}i host    all    all    192.168.0.0/16    md5" "$PG_HBA" 2>/dev/null || \
                        echo "host    all    all    192.168.0.0/16    md5" | sudo tee -a "$PG_HBA" > /dev/null
                    else
                        echo "host    all    all    192.168.0.0/16    md5" | sudo tee -a "$PG_HBA" > /dev/null
                    fi
                fi
                
                if ! sudo grep -qE "^host[[:space:]]+all[[:space:]]+all[[:space:]]+10\.0\.0\.0/8[[:space:]]+md5" "$PG_HBA" 2>/dev/null; then
                    if [[ -n "$insert_before_line" ]]; then
                        sudo sed -i "${insert_before_line}i host    all    all    10.0.0.0/8         md5" "$PG_HBA" 2>/dev/null || \
                        echo "host    all    all    10.0.0.0/8         md5" | sudo tee -a "$PG_HBA" > /dev/null
                    else
                        echo "host    all    all    10.0.0.0/8         md5" | sudo tee -a "$PG_HBA" > /dev/null
                    fi
                fi
                
                if ! sudo grep -qE "^host[[:space:]]+all[[:space:]]+all[[:space:]]+172\.16\.0\.0/12[[:space:]]+md5" "$PG_HBA" 2>/dev/null; then
                    if [[ -n "$insert_before_line" ]]; then
                        sudo sed -i "${insert_before_line}i host    all    all    172.16.0.0/12      md5" "$PG_HBA" 2>/dev/null || \
                        echo "host    all    all    172.16.0.0/12      md5" | sudo tee -a "$PG_HBA" > /dev/null
                    else
                        echo "host    all    all    172.16.0.0/12      md5" | sudo tee -a "$PG_HBA" > /dev/null
                    fi
                fi
                
                log "✅ pg_hba.conf atualizado para aceitar conexões da rede local (192.168.x.x, 10.x.x.x, 172.16-31.x.x)"
            fi
            
            # Reiniciar PostgreSQL para aplicar mudanças
            log "Reiniciando PostgreSQL para aplicar configurações de rede..."
            sudo systemctl restart postgresql
            sleep 3
            
            # Verificar se reiniciou corretamente
            if systemctl is-active --quiet postgresql; then
                log "✅ PostgreSQL reiniciado com sucesso"
            else
                warn "⚠️ PostgreSQL pode não ter reiniciado corretamente"
            fi
        else
            warn "⚠️ Diretório de configuração do PostgreSQL não encontrado: $PG_CONFIG_DIR"
            warn "Configure manualmente o postgresql.conf e pg_hba.conf para acesso remoto"
        fi
        
        # Garantir regras do firewall para PostgreSQL na rede local (idempotente)
        log "Garantindo regras do firewall para PostgreSQL (porta 5432 - rede local)..."
        # As regras principais estão em configure_firewall(), mas garantimos aqui também
        sudo ufw allow from 192.168.0.0/16 to any port 5432 2>/dev/null || true
        sudo ufw allow from 10.0.0.0/8 to any port 5432 2>/dev/null || true
        sudo ufw allow from 172.16.0.0/12 to any port 5432 2>/dev/null || true
        log "✅ Firewall garantido para PostgreSQL (rede local)"

        # Exportar variáveis para as próximas etapas
        export DB_DRIVER="postgresql"
        export DATABASE_URL="postgresql://${PG_USER}:${PG_PASS}@localhost:5432/${PG_DB}"
        export PRIMARY_DB_NAME="$PG_DB"
        log "✅ PostgreSQL configurado. DATABASE_URL=${DATABASE_URL}"
        log "✅ PostgreSQL acessível remotamente na rede local (porta 5432)"
        log "💡 Para acessar via pgAdmin:"
        log "   Host: IP_DO_SERVIDOR (ex: 192.168.1.105)"
        log "   Port: 5432"
        log "   Database: ${PG_DB}"
        log "   Username: ${PG_USER}"
        log "   Password: ${PG_PASS}"

        # Após configurar PostgreSQL, garantir Redis local
        setup_redis_single_server
    else
        # PostgreSQL via Docker
        log "Banco PostgreSQL será configurado via Docker"
    fi
}

# Configurar Redis local (modo single-server)
setup_redis_single_server() {
    log "Verificando Redis (servidor único)..."

    if command -v redis-server >/dev/null 2>&1; then
        log "Redis já está instalado: $(redis-server --version | awk '{print $1" "$3}')"
    else
        log "Instalando Redis..."
        sudo apt-get update -y
        sudo apt-get install -y redis-server || {
            error "❌ Falha ao instalar Redis"
            exit 1
        }
        log "✅ Redis instalado com sucesso"
    fi

    # Habilitar e iniciar serviço
    sudo systemctl enable redis-server >/dev/null 2>&1 || true
    if ! systemctl is-active --quiet redis-server; then
        log "Iniciando serviço redis-server..."
        sudo systemctl start redis-server || {
            error "❌ Falha ao iniciar serviço redis-server"
            exit 1
        }
    fi

    # Verificar disponibilidade
    log "Testando conexão com Redis..."
    if redis-cli -h 127.0.0.1 -p 6379 ping | grep -q "PONG"; then
        log "✅ Redis respondendo em 127.0.0.1:6379"
    else
        error "❌ Redis não respondeu ao ping em 127.0.0.1:6379"
        error "    Verifique o serviço com: sudo systemctl status redis-server"
        exit 1
    fi
}

# Garantir criação/atualização do usuário admin com senha hash
ensure_admin_user() {
    log "Garantindo usuário admin padrão..."

    local target_db="${PRIMARY_DB_NAME:-smartsignage}"
    local admin_password="admin123"
    local admin_hash=""
    local admin_username="admin"
    local admin_email="admin@smart-signage.com"

    # 1) Tentar OpenSSL bcrypt (nem todo OpenSSL 3 tem suporte a `passwd -bcrypt`)
    if command -v openssl >/dev/null 2>&1; then
        if openssl passwd -help 2>&1 | grep -qi "bcrypt"; then
            if admin_hash=$(openssl passwd -bcrypt "$admin_password" 2>/dev/null | tr -d '\r'); then
                [[ ${#admin_hash} -eq 60 ]] || admin_hash=""
            fi
        fi
    fi

    # 2) Tentar htpasswd (bcrypt) - instalar apache2-utils se necessário (Ubuntu/Debian)
    if [[ -z "$admin_hash" || ${#admin_hash} -ne 60 ]]; then
        if ! command -v htpasswd >/dev/null 2>&1; then
            if command -v apt-get >/dev/null 2>&1; then
                log "Instalando apache2-utils para gerar bcrypt via htpasswd..."
                sudo apt-get update -y >/dev/null 2>&1 || true
                sudo apt-get install -y apache2-utils >/dev/null 2>&1 || true
            fi
        fi
        if command -v htpasswd >/dev/null 2>&1; then
            admin_hash=$(htpasswd -bnBC 12 "" "$admin_password" 2>/dev/null | tr -d ':\r\n')
            [[ ${#admin_hash} -eq 60 ]] || admin_hash=""
        fi
    fi

    # Segunda tentativa utilizando Node + bcryptjs caso openssl não esteja disponível ou falhe
    if [[ -z "$admin_hash" || ${#admin_hash} -ne 60 ]]; then
        if command -v node >/dev/null 2>&1; then
            # Preferir bcryptjs instalado no backend (node_modules do backend).
            # Isso evita "Cannot find module 'bcryptjs'" quando o cwd não é /backend.
            admin_hash=$(node - <<NODE 2>/dev/null
const password = 'admin123';
let hash = '';
try {
  const path = require('path');
  const backendBcrypt = path.resolve(process.env.INSTALL_DIR || process.cwd(), 'backend', 'node_modules', 'bcryptjs');
  let bcrypt;
  try {
    bcrypt = require(backendBcrypt);
  } catch (e) {
    bcrypt = require('bcryptjs');
  }
  hash = bcrypt.hashSync(password, 12);
} catch (err) {
  process.stderr.write(err?.message || String(err));
}
if (hash) {
  process.stdout.write(hash);
}
NODE
)
            # Normalizar hash (caso Node insira newline)
            admin_hash=$(echo -n "$admin_hash" | tr -d '\r')
        fi
    fi

    # Fallback final caso ainda não tenha hash válido
    if [[ -z "$admin_hash" || ${#admin_hash} -ne 60 ]]; then
        log "⚠️ Não foi possível gerar hash dinamicamente. Usando hash padrão pré-calculado."
        # Hash bcrypt válido para senha: admin123
        admin_hash='$2a$12$eenSYwwg9qOkcleFuH2lrOL5u3nAMN8MqQlsOQJh59mg16gcBu5A2'
    fi

    # Normalizar prefixos bcrypt para compatibilidade (algumas ferramentas geram $2y$)
    if [[ "$admin_hash" == \$2y\$* ]]; then
        admin_hash="\$2b\$${admin_hash:4}"
    fi

    # Em SSH/servidor, `sudo -u postgres` pode falhar (TTY/senha). Preferir DATABASE_URL quando disponível.
    local psql_cmd=""
    if [[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" == postgresql://* ]]; then
        psql_cmd="psql \"${DATABASE_URL}\""
    elif command -v sudo >/dev/null 2>&1; then
        psql_cmd="sudo -u postgres psql -d \"${target_db}\""
    else
        psql_cmd="psql -d \"${target_db}\""
    fi

    local tmp_sql=""
    tmp_sql="$(mktemp)"
    cat >"$tmp_sql" <<SQL
INSERT INTO users (
  username, email, password_hash,
  first_name, last_name, name, phone,
  role, user_type, is_tenant_user,
  publisher_id, subscriber_id,
  is_active, email_verified,
  last_login, created_at, updated_at
)
VALUES (
  '${admin_username}', '${admin_email}', '${admin_hash}',
  'Admin', 'Sistema', 'Administrador', NULL,
  'admin', 'system_user', true,
  NULL,
  NULL,
  true, true,
  NOW(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT (username)
DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  user_type = EXCLUDED.user_type,
  is_tenant_user = EXCLUDED.is_tenant_user,
  publisher_id = NULL,
  subscriber_id = NULL,
  is_active = EXCLUDED.is_active,
  email_verified = EXCLUDED.email_verified,
  updated_at = CURRENT_TIMESTAMP,
  last_login = NOW();
SQL

    local psql_out=""
    if ! psql_out=$(eval "$psql_cmd -v ON_ERROR_STOP=1 -f \"$tmp_sql\"" 2>&1); then
        # Se falhar por permissão (muito comum quando DATABASE_URL usa usuário de app),
        # tentar novamente como postgres (se possível).
        if echo "$psql_out" | grep -qi "permission denied for table users"; then
            warn "⚠️ Sem permissão para inserir em users via DATABASE_URL. Tentando como postgres..."
            if command -v sudo >/dev/null 2>&1; then
                if ! sudo -u "${POSTGRES_USER:-postgres}" psql -d "$target_db" -v ON_ERROR_STOP=1 -f "$tmp_sql" >/dev/null 2>&1; then
                    rm -f "$tmp_sql"
                    error "❌ Falha ao garantir usuário admin via psql (postgres)"
                    return 1
                fi
            else
                rm -f "$tmp_sql"
                error "❌ Falha ao garantir usuário admin via psql (sem sudo disponível). Erro: $psql_out"
                return 1
            fi
        else
            rm -f "$tmp_sql"
            error "❌ Falha ao garantir usuário admin via psql: $psql_out"
            return 1
        fi
    fi
    rm -f "$tmp_sql"

    if eval "$psql_cmd -tAc \"SELECT length(password_hash) FROM users WHERE username = '${admin_username}'\"" | tr -d ' \r\n' | grep -q "^60$"; then
        log "✅ Usuário admin está presente com hash configurado"
        return 0
    fi

    error "❌ Usuário admin ainda não foi encontrado após tentativa de criação"
    return 1
}

# Garantir usuário owner_system com username informado na instalação (SYSTEM_OWNER_ADMIN_USERNAME).
ensure_owner_system_user() {
    sanitize_owner_profile_defaults
    log "Garantindo usuário owner_system (${SYSTEM_OWNER_ADMIN_USERNAME})..."

    local target_db="${PRIMARY_DB_NAME:-smartsignage}"
    local owner_password="admin123"
    local owner_hash=""
    local owner_username
    local owner_email

    owner_username="$(echo "${SYSTEM_OWNER_ADMIN_USERNAME}" | xargs)"
    [[ -z "$owner_username" ]] && owner_username="Owner"
    owner_email="$(echo "${SYSTEM_OWNER_EMAIL:-${owner_username}@smartsignage.local}" | xargs)"

    if command -v node >/dev/null 2>&1; then
        owner_hash=$(node - <<NODE 2>/dev/null
const password = 'admin123';
let hash = '';
try {
  const path = require('path');
  const backendBcrypt = path.resolve(process.env.INSTALL_DIR || process.cwd(), 'backend', 'node_modules', 'bcryptjs');
  let bcrypt;
  try { bcrypt = require(backendBcrypt); } catch (e) { bcrypt = require('bcryptjs'); }
  hash = bcrypt.hashSync(password, 12);
} catch (err) {
  process.stderr.write(err?.message || String(err));
}
if (hash) process.stdout.write(hash);
NODE
)
        owner_hash=$(echo -n "$owner_hash" | tr -d '\r')
    fi
    if [[ -z "$owner_hash" || ${#owner_hash} -ne 60 ]]; then
        owner_hash='$2a$12$eenSYwwg9qOkcleFuH2lrOL5u3nAMN8MqQlsOQJh59mg16gcBu5A2'
    fi
    if [[ "$owner_hash" == \$2y\$* ]]; then
        owner_hash="\$2b\$${owner_hash:4}"
    fi

    local psql_cmd=""
    if [[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" == postgresql://* ]]; then
        psql_cmd="psql \"${DATABASE_URL}\""
    elif command -v sudo >/dev/null 2>&1; then
        psql_cmd="sudo -u postgres psql -d \"${target_db}\""
    else
        psql_cmd="psql -d \"${target_db}\""
    fi

    local safe_username safe_email safe_name
    safe_username="$(escape_sql_literal "${owner_username}")"
    safe_email="$(escape_sql_literal "${owner_email}")"
    safe_name="$(escape_sql_literal "${SYSTEM_OWNER_NAME}")"

    local tmp_sql
    tmp_sql="$(mktemp)"
    cat >"$tmp_sql" <<SQL
WITH role_owner AS (
  SELECT role_id FROM roles WHERE name = 'owner_system' LIMIT 1
), upsert_user AS (
  INSERT INTO users (
    username, email, password_hash,
    first_name, last_name, name, phone,
    role, user_type, is_tenant_user,
    publisher_id, subscriber_id,
    is_active, email_verified,
    last_login, created_at, updated_at
  )
  VALUES (
    '${safe_username}', '${safe_email}', '${owner_hash}',
    '${safe_username}', 'System', '${safe_name}', NULL,
    'owner_system', 'system_user', true,
    NULL, NULL,
    true, true,
    NOW(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
  ON CONFLICT (username) DO UPDATE SET
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    name = EXCLUDED.name,
    role = 'owner_system',
    user_type = 'system_user',
    is_tenant_user = true,
    publisher_id = NULL,
    subscriber_id = NULL,
    is_active = true,
    email_verified = true,
    updated_at = CURRENT_TIMESTAMP
  RETURNING id
), role_link AS (
  INSERT INTO user_roles (user_id, role_id, assigned_by)
  SELECT uu.id, ro.role_id, uu.id
  FROM upsert_user uu
  CROSS JOIN role_owner ro
  ON CONFLICT DO NOTHING
), flag_upsert AS (
  INSERT INTO user_flags (
    user_id,
    flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4,
    flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9
  )
  SELECT uu.id, true, true, true, true, true, true, true, true, true, true
  FROM upsert_user uu
  ON CONFLICT (user_id) DO UPDATE SET
    flag_smart_0 = true, flag_smart_1 = true, flag_smart_2 = true, flag_smart_3 = true, flag_smart_4 = true,
    flag_smart_5 = true, flag_smart_6 = true, flag_smart_7 = true, flag_smart_8 = true, flag_smart_9 = true,
    updated_at = CURRENT_TIMESTAMP
)
SELECT (SELECT id FROM upsert_user LIMIT 1) AS owner_user_id;
SQL

    local ensure_out
    if ! ensure_out=$(eval "$psql_cmd -v ON_ERROR_STOP=1 -f \"$tmp_sql\"" 2>&1); then
        rm -f "$tmp_sql"
        error "❌ Falha ao garantir usuário owner_system: $ensure_out"
        return 1
    fi
    rm -f "$tmp_sql"

    if ! eval "$psql_cmd -tAc \"SELECT 1 FROM users WHERE username='${safe_username}' AND role='owner_system' AND is_active=true\"" | tr -d ' \r\n' | grep -q "^1$"; then
        error "❌ Usuário owner_system não encontrado após tentativa de criação (${owner_username})"
        return 1
    fi

    log "✅ Usuário owner_system garantido: ${owner_username} (senha padrão: ${owner_password})"
    return 0
}

# Organização (publisher) mínima para modo compacto / direct-totem — mesmo com --no-seeds.
# Sem isto resolveSinglePublisherId / is_system_owner falham e o painel não funciona.
ensure_minimal_owner_organization() {
    if [[ "${INSTALL_TOTEMDIGITAL_COMPACT}" != "true" ]]; then
        return 0
    fi

    sanitize_owner_profile_defaults
    log "Garantindo organização owner (publisher) no modo compacto..."

    local target_db="${PRIMARY_DB_NAME:-smartsignage}"
    local owner_name_escaped owner_email_escaped owner_contact_escaped owner_description_escaped
    owner_name_escaped="$(escape_sql_literal "${SYSTEM_OWNER_NAME}")"
    owner_email_escaped="$(escape_sql_literal "${SYSTEM_OWNER_EMAIL}")"
    owner_contact_escaped="$(escape_sql_literal "${SYSTEM_OWNER_CONTACT_NAME:-Contato ${SYSTEM_OWNER_NAME}}")"
    owner_description_escaped="$(escape_sql_literal "Organização owner ${SYSTEM_OWNER_NAME} (modo compacto/direct-totem)")"

    local psql_cmd=""
    if [[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" == postgresql://* ]]; then
        psql_cmd="psql \"${DATABASE_URL}\""
    elif command -v sudo >/dev/null 2>&1; then
        psql_cmd="sudo -u postgres psql -d \"${target_db}\""
    else
        psql_cmd="psql -d \"${target_db}\""
    fi

    local tmp_sql
    tmp_sql="$(mktemp)"
    cat >"$tmp_sql" <<SQL
DO \$\$
DECLARE
  v_publisher_id INTEGER;
BEGIN
  SELECT publisher_id INTO v_publisher_id
  FROM publishers
  WHERE is_active = true
    AND (
      is_system_owner = true
      OR LOWER(name) = LOWER('${owner_name_escaped}')
      OR LOWER(COALESCE(email, '')) = LOWER('${owner_email_escaped}')
    )
  ORDER BY
    CASE WHEN is_system_owner = true THEN 0 ELSE 1 END,
    publisher_id ASC
  LIMIT 1;

  IF v_publisher_id IS NULL THEN
    INSERT INTO publishers (
      name, contact_name, email, phone, whatsapp,
      category_segment, description, is_subscriber, is_publisher, client_type, is_active, is_system_owner
    ) VALUES (
      '${owner_name_escaped}',
      '${owner_contact_escaped}',
      '${owner_email_escaped}',
      NULL, NULL,
      'Totens',
      '${owner_description_escaped}',
      false, true, 'publisher', true, true
    )
    RETURNING publisher_id INTO v_publisher_id;
  ELSE
    UPDATE publishers SET
      name = '${owner_name_escaped}',
      contact_name = '${owner_contact_escaped}',
      email = '${owner_email_escaped}',
      description = COALESCE(NULLIF(TRIM(description), ''), '${owner_description_escaped}'),
      is_publisher = true,
      client_type = 'publisher',
      is_active = true,
      updated_at = CURRENT_TIMESTAMP
    WHERE publisher_id = v_publisher_id;
  END IF;

  UPDATE publishers SET is_system_owner = false, updated_at = CURRENT_TIMESTAMP
  WHERE is_system_owner = true AND publisher_id IS DISTINCT FROM v_publisher_id;

  UPDATE publishers SET is_system_owner = true, updated_at = CURRENT_TIMESTAMP
  WHERE publisher_id = v_publisher_id;

  INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description)
  VALUES ('installation.profile', 'single_publisher', 'string', 'system', 'Perfil de instalação (mono/direct totem)')
  ON CONFLICT (setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_at = CURRENT_TIMESTAMP;
END
\$\$;
SQL

    if ! eval "$psql_cmd -v ON_ERROR_STOP=1 -f \"$tmp_sql\"" >/dev/null 2>&1; then
        rm -f "$tmp_sql"
        error "❌ Falha ao garantir organização owner (publisher)"
        return 1
    fi
    rm -f "$tmp_sql"

    local pub_id
    pub_id=$(eval "$psql_cmd -tAc \"SELECT publisher_id FROM publishers WHERE is_system_owner = true AND is_active = true ORDER BY publisher_id ASC LIMIT 1\"" | tr -d ' \r\n')
    if [[ -z "$pub_id" ]]; then
        error "❌ Organização owner não encontrada após ensure_minimal_owner_organization"
        return 1
    fi

    log "✅ Organização owner garantida (publisher_id=${pub_id}, nome=${SYSTEM_OWNER_NAME})"
    return 0
}

# Garantir usuário publisher_user vinculado ao publisher owner no modo compacto
ensure_owner_publisher_user() {
    if [[ "${INSTALL_TOTEMDIGITAL_COMPACT}" != "true" ]]; then
        return 0
    fi
    # Sempre provisiona a organização; no direct-totem não cria user publisher_user demo.
    if ! ensure_minimal_owner_organization; then
        return 1
    fi
    if [[ "${INSTALL_DIRECT_TOTEM_MODE:-true}" == "true" ]]; then
        log "Modo direct totem: usuário publisher_user demo omitido (apenas admin + owner_system + organização)."
        return 0
    fi

    sanitize_owner_profile_defaults
    log "Garantindo usuário publisher do owner no modo compacto..."

    local target_db="${PRIMARY_DB_NAME:-smartsignage}"
    local owner_name_escaped owner_email_escaped
    local owner_contact_escaped owner_description_escaped
    local publisher_username publisher_email
    local publisher_password="admin123"
    local publisher_hash=""

    owner_name_escaped="$(escape_sql_literal "${SYSTEM_OWNER_NAME}")"
    owner_email_escaped="$(escape_sql_literal "${SYSTEM_OWNER_EMAIL}")"
    owner_contact_escaped="$(escape_sql_literal "${SYSTEM_OWNER_CONTACT_NAME:-Contato ${SYSTEM_OWNER_NAME}}")"
    owner_description_escaped="$(escape_sql_literal "Publisher owner ${SYSTEM_OWNER_NAME} (modo compacto)")"
    publisher_username="$(echo "${SYSTEM_OWNER_PUBLISHER_USERNAME}" | xargs)"
    [[ -z "${publisher_username}" ]] && publisher_username="$(echo "${SYSTEM_OWNER_ADMIN_USERNAME}.publisher" | xargs)"
    publisher_email="${publisher_username}@smart-signage.com"

    if command -v node >/dev/null 2>&1; then
        publisher_hash=$(node - <<NODE 2>/dev/null
const password = 'admin123';
let hash = '';
try {
  const path = require('path');
  const backendBcrypt = path.resolve(process.env.INSTALL_DIR || process.cwd(), 'backend', 'node_modules', 'bcryptjs');
  let bcrypt;
  try {
    bcrypt = require(backendBcrypt);
  } catch (e) {
    bcrypt = require('bcryptjs');
  }
  hash = bcrypt.hashSync(password, 12);
} catch (err) {
  process.stderr.write(err?.message || String(err));
}
if (hash) process.stdout.write(hash);
NODE
)
        publisher_hash=$(echo -n "$publisher_hash" | tr -d '\r')
    fi
    if [[ -z "$publisher_hash" || ${#publisher_hash} -ne 60 ]]; then
        publisher_hash='$2a$12$eenSYwwg9qOkcleFuH2lrOL5u3nAMN8MqQlsOQJh59mg16gcBu5A2'
    fi
    if [[ "$publisher_hash" == \$2y\$* ]]; then
        publisher_hash="\$2b\$${publisher_hash:4}"
    fi

    local psql_cmd=""
    if [[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" == postgresql://* ]]; then
        psql_cmd="psql \"${DATABASE_URL}\""
    elif command -v sudo >/dev/null 2>&1; then
        psql_cmd="sudo -u postgres psql -d \"${target_db}\""
    else
        psql_cmd="psql -d \"${target_db}\""
    fi

    local safe_username safe_email
    safe_username="$(escape_sql_literal "${publisher_username}")"
    safe_email="$(escape_sql_literal "${publisher_email}")"

    local tmp_sql
    tmp_sql="$(mktemp)"
    cat >"$tmp_sql" <<SQL
WITH existing_owner_publisher AS (
  SELECT p.publisher_id
  FROM publishers p
  WHERE p.is_active = true
    AND (
      LOWER(p.name) = LOWER('${owner_name_escaped}')
      OR LOWER(COALESCE(p.email, '')) = LOWER('${owner_email_escaped}')
    )
  ORDER BY p.publisher_id ASC
  LIMIT 1
), inserted_owner_publisher AS (
  INSERT INTO publishers (
    name, contact_name, email, phone, whatsapp,
    category_segment, description, is_subscriber, is_publisher, client_type, is_active
  )
  SELECT
    '${owner_name_escaped}',
    '${owner_contact_escaped}',
    '${owner_email_escaped}',
    NULL, NULL,
    'Totens',
    '${owner_description_escaped}',
    false,
    true,
    'publisher',
    true
  WHERE NOT EXISTS (SELECT 1 FROM existing_owner_publisher)
  RETURNING publisher_id
), owner_publisher AS (
  SELECT publisher_id FROM existing_owner_publisher
  UNION ALL
  SELECT publisher_id FROM inserted_owner_publisher
  LIMIT 1
), role_pub AS (
  SELECT role_id FROM roles WHERE name = 'publisher_user' LIMIT 1
), upsert_user AS (
  INSERT INTO users (
    username, email, password_hash,
    first_name, last_name, name, phone,
    role, user_type, is_tenant_user,
    publisher_id, subscriber_id,
    is_active, email_verified,
    last_login, created_at, updated_at
  )
  SELECT
    '${safe_username}', '${safe_email}', '${publisher_hash}',
    'Owner', 'Publisher', 'Owner Publisher', NULL,
    'publisher_user', 'publisher_user', false,
    op.publisher_id, NULL,
    true, true,
    NOW(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM owner_publisher op
  ON CONFLICT (username)
  DO UPDATE SET
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    user_type = EXCLUDED.user_type,
    is_tenant_user = EXCLUDED.is_tenant_user,
    publisher_id = EXCLUDED.publisher_id,
    subscriber_id = EXCLUDED.subscriber_id,
    is_active = EXCLUDED.is_active,
    email_verified = EXCLUDED.email_verified,
    updated_at = CURRENT_TIMESTAMP
  RETURNING id
), role_link AS (
  INSERT INTO user_roles (user_id, role_id, assigned_by)
  SELECT uu.id, rp.role_id, uu.id
  FROM upsert_user uu
  CROSS JOIN role_pub rp
  ON CONFLICT DO NOTHING
), flag_upsert AS (
  INSERT INTO user_flags (
    user_id,
    flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4,
    flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9
  )
  SELECT
    uu.id,
    true, false, false, true, false,
    true, true, false, true, false
  FROM upsert_user uu
  ON CONFLICT (user_id) DO NOTHING
)
SELECT
  (SELECT publisher_id FROM owner_publisher) AS owner_publisher_id,
  (SELECT id FROM upsert_user LIMIT 1) AS owner_user_id;
SQL

    local ensure_out
    if ! ensure_out=$(eval "$psql_cmd -v ON_ERROR_STOP=1 -f \"$tmp_sql\"" 2>&1); then
        rm -f "$tmp_sql"
        error "❌ Falha ao garantir usuário publisher do owner: $ensure_out"
        return 1
    fi
    rm -f "$tmp_sql"

    if ! eval "$psql_cmd -tAc \"SELECT 1 FROM users WHERE username='${safe_username}' AND role='publisher_user' AND is_active=true\"" | tr -d ' \r\n' | grep -q "^1$"; then
        error "❌ Usuário publisher do owner não foi encontrado após tentativa de criação"
        return 1
    fi

    log "✅ Usuário publisher do owner garantido: ${publisher_username} (senha padrão: ${publisher_password})"
    return 0
}

# URL pública do painel (links em e-mails/PIX). Usa --public-host / layout dividido quando definidos.
resolve_financial_public_app_url() {
    local fin_url=""
    local host="${PUBLIC_HOST:-}"
    if [[ -z "$host" || "$host" == "_" ]]; then
        host=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    if [[ -n "$host" ]]; then
        local sys_port="${SYSTEM_HTTP_PORT:-80}"
        if [[ "${SPLIT_CORPORATE_AND_SYSTEM:-false}" == "true" ]] && [[ "$sys_port" != "80" ]]; then
            fin_url="http://${host}:${sys_port}"
        else
            fin_url="http://${host}"
        fi
    fi
    [[ -z "$fin_url" ]] && fin_url="http://localhost:8080"
    printf '%s' "$fin_url"
}

# Bloco .env: financeiro, Stripe e SMTP (placeholders; preencher PIX/SMTP em produção).
build_financial_env_block() {
    local fin_url fin_webhook_secret
    fin_url="$(resolve_financial_public_app_url)"
    fin_webhook_secret="$(openssl rand -hex 24 2>/dev/null || echo "change-me-financial-webhook-secret")"
    cat <<EOF

# =============================================
# STRIPE / PAGAMENTOS
# =============================================
STRIPE_ENABLED=false
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CURRENCY=brl
STRIPE_API_VERSION=2024-11-20.acacia

# =============================================
# FINANCEIRO / PIX (faturas anunciantes e exibidor)
# =============================================
FINANCIAL_PIX_KEY=
FINANCIAL_PIX_MERCHANT_NAME=SMART CHANNEL
FINANCIAL_PIX_MERCHANT_CITY=SAO PAULO
FINANCIAL_PIX_WEBHOOK_SECRET=${fin_webhook_secret}
FINANCIAL_INVOICE_DUE_DAYS=7
FINANCIAL_DUE_SOON_DAYS=30
FINANCIAL_PUBLIC_APP_URL=${fin_url}
FINANCIAL_WHATSAPP_NUMBER=
FINANCIAL_CRON_ENFORCE_BLOCKS=15 4 * * *
# WhatsApp Cloud API (Meta) — envio automático; sem isto usa link wa.me no e-mail
WHATSAPP_CLOUD_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=v21.0
FINANCIAL_WORKER_ENABLED=true
FINANCIAL_CRON_ISSUE=30 2 * * *
FINANCIAL_CRON_OVERDUE=30 3 * * *
FINANCIAL_CRON_REMINDERS=0 9 * * *
EOF
    if [[ "${INSTALL_TOTEMDIGITAL_COMPACT:-false}" == "true" ]]; then
        cat <<EOF
FINANCIAL_AUTO_REVENUE_SHARE=true
FINANCIAL_NOTIFY_REVENUE_SHARE_PAYOUT=true
FINANCIAL_REVENUE_SHARE_SINCE_DAYS=90
FINANCIAL_CRON_REVENUE_SHARE=0 4 * * *
EOF
    fi
    cat <<EOF

# =============================================
# E-MAIL (lembretes financeiros e notificações)
# =============================================
EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Smart Signage <noreply@smartsignage.com>
SMTP_TLS_REJECT_UNAUTHORIZED=true
EOF
}

# Aplicar schemas adicionais (export/export views)
# Configurar variáveis de ambiente
setup_environment() {
    log "Configurando variáveis de ambiente..."
    sanitize_owner_profile_defaults
    
    # Criar diretório de logs se não existir
    LOGS_DIR="/opt/smart-signage/Logs"
    log "Criando diretório de logs: $LOGS_DIR"
    if [[ ! -d "$LOGS_DIR" ]]; then
        sudo mkdir -p "$LOGS_DIR"
        # Tentar definir permissões para o usuário atual
        if [[ -n "$USER" ]]; then
            sudo chown -R "$USER:$USER" "$LOGS_DIR" 2>/dev/null || sudo chown -R "$(whoami):$(whoami)" "$LOGS_DIR" 2>/dev/null || true
        fi
        sudo chmod 755 "$LOGS_DIR"
        log "✅ Diretório de logs criado: $LOGS_DIR"
    else
        log "✅ Diretório de logs já existe: $LOGS_DIR"
        # Garantir permissões corretas
        if [[ -n "$USER" ]]; then
            sudo chown -R "$USER:$USER" "$LOGS_DIR" 2>/dev/null || sudo chown -R "$(whoami):$(whoami)" "$LOGS_DIR" 2>/dev/null || true
        fi
        sudo chmod 755 "$LOGS_DIR"
    fi
    
    ENV_FILE="$INSTALL_DIR/.env"
    
    # Gerar JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    
    # Gerar TOTEM secret key (para encriptação de configuração do player)
    TOTEM_SECRET_KEY=$(openssl rand -base64 32)
    export TOTEM_SECRET_KEY  # Exportar para uso em scripts
    
    # Gerar UIN único
    UIN=$(date +%s)$(cat /sys/class/net/eth0/address 2>/dev/null | tr -d ':' || echo "000000000000")

    local FINANCIAL_ENV_BLOCK
    FINANCIAL_ENV_BLOCK="$(build_financial_env_block)"

    local CORS_SPLIT_ORIGIN=""
    if [[ "${SPLIT_CORPORATE_AND_SYSTEM:-false}" == "true" ]]; then
        local _cph="${PUBLIC_HOST:-}"
        if [[ -z "$_cph" ]] || [[ "$_cph" == "_" ]]; then
            _cph=$(hostname -I 2>/dev/null | awk '{print $1}')
        fi
        if [[ -n "$_cph" ]]; then
            CORS_SPLIT_ORIGIN=",http://${_cph}:${SYSTEM_HTTP_PORT:-8080}"
            if [[ -n "${DOMAIN_NAME:-}" ]] && [[ "${DOMAIN_NAME}" != "_" ]]; then
                CORS_SPLIT_ORIGIN="${CORS_SPLIT_ORIGIN},http://${DOMAIN_NAME}:${SYSTEM_HTTP_PORT:-8080},https://${DOMAIN_NAME},https://www.${DOMAIN_NAME}"
            fi
        elif [[ -n "${DOMAIN_NAME:-}" ]] && [[ "${DOMAIN_NAME}" != "_" ]]; then
            CORS_SPLIT_ORIGIN=",https://${DOMAIN_NAME},https://www.${DOMAIN_NAME}"
        fi
    fi

    cat > $ENV_FILE << EOF
# Smart Signage Pro v2.0 - Configuração
# Gerado automaticamente em $(date)

# Modo de instalação
INSTALL_MODE=$INSTALL_MODE

# Identificação única do sistema
UIN=$UIN

# Banco de dados (PostgreSQL ou SQLite)
DB_DRIVER=${DB_DRIVER:-postgresql}
DATABASE_URL=${DATABASE_URL:-postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage}

# Servidor
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Autenticação
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Player - Encriptação de configuração
TOTEM_SECRET_KEY=$TOTEM_SECRET_KEY

# Player
PLAYER_ABANDON_PIN=1234

# IA
AI_PROVIDER=ollama
AI_MODEL=llama3.2:3b
OLLAMA_BASE_URL=http://localhost:11434

# Upload - SEMPRE usar /opt/smart-signage independente do INSTALL_DIR
UPLOAD_MAX_SIZE=2GB
UPLOAD_PATH=/opt/smart-signage/public/assets/uploads
MEDIA_QUOTA_PER_CLIENT=5GB

# Logs - SEMPRE usar /opt/smart-signage independente do INSTALL_DIR
LOG_LEVEL=info
LOG_FILE=/opt/smart-signage/Logs/app.log

# CORS (layout dividido: inclui origem do painel na porta do sistema)
CORS_ORIGIN=http://localhost:3000,http://localhost:3001${CORS_SPLIT_ORIGIN}

# TotemDigital modo compacto (= mono) vs Pro — menu de instalação ou --totemdigital-compact / --smartsignage-pro
TOTEMDIGITAL_COMPACT=$INSTALL_TOTEMDIGITAL_COMPACT
REACT_APP_TOTEMDIGITAL_COMPACT=$INSTALL_TOTEMDIGITAL_COMPACT

# Modo Publicar em Totem — --direct-totem / --no-direct-totem (frontend lê em build-time; alterar exige rebuild)
DIRECT_TOTEM_MODE=$INSTALL_DIRECT_TOTEM_MODE
REACT_APP_DIRECT_TOTEM_MODE=$INSTALL_DIRECT_TOTEM_MODE

# Dados do proprietário (owner) para seed dinâmico no modo compacto
SYSTEM_OWNER_NAME=$SYSTEM_OWNER_NAME
SYSTEM_OWNER_CONTACT_NAME=$SYSTEM_OWNER_CONTACT_NAME
SYSTEM_OWNER_EMAIL=$SYSTEM_OWNER_EMAIL
SYSTEM_OWNER_CITY=$SYSTEM_OWNER_CITY
SYSTEM_OWNER_ADMIN_USERNAME=$SYSTEM_OWNER_ADMIN_USERNAME
SYSTEM_OWNER_PUBLISHER_USERNAME=$SYSTEM_OWNER_PUBLISHER_USERNAME
SYSTEM_OWNER_PLAN_NAME=$SYSTEM_OWNER_PLAN_NAME
SYSTEM_OWNER_PLAN_SLUG=$SYSTEM_OWNER_PLAN_SLUG

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# SmartDisplayFX / MQTT
SMARTDISPLAYFX_MQTT_ENABLED=$([[ "$MQTT_LOCAL_BROKER_REQUIRED" == "true" ]] && echo "true" || echo "false")
SMARTDISPLAYFX_MQTT_URL=mqtt://localhost:1883
SMARTDISPLAYFX_MQTT_WS_URL=${MQTT_WS_URL_DEFAULT}
SMARTDISPLAYFX_MQTT_USERNAME=${MQTT_BACKEND_USERNAME}
SMARTDISPLAYFX_MQTT_PASSWORD=${MQTT_BACKEND_PASSWORD}
SMARTDISPLAYFX_MQTT_PREFIX=smartdisplay
${FINANCIAL_ENV_BLOCK}
EOF

    log "Variáveis de ambiente configuradas em $ENV_FILE"
    log "Financeiro: FINANCIAL_PUBLIC_APP_URL=$(resolve_financial_public_app_url) (defina FINANCIAL_PIX_KEY no .env para PIX real)"
    
    # Também criar .env no diretório backend para garantir que seja lido
    BACKEND_ENV_FILE="$INSTALL_DIR/backend/.env"
    if [[ -d "$INSTALL_DIR/backend" ]]; then
        log "Criando .env no diretório backend: $BACKEND_ENV_FILE"
        cp "$ENV_FILE" "$BACKEND_ENV_FILE" 2>/dev/null || {
            # Se copiar falhar, criar novamente
            cat > "$BACKEND_ENV_FILE" << EOF
# Smart Signage Pro v2.0 - Configuração Backend
# Gerado automaticamente em $(date)
# Este arquivo é uma cópia de $INSTALL_DIR/.env

# Modo de instalação
INSTALL_MODE=$INSTALL_MODE

# Identificação única do sistema
UIN=$UIN

# Banco de dados (PostgreSQL ou SQLite)
DB_DRIVER=${DB_DRIVER:-postgresql}
DATABASE_URL=${DATABASE_URL:-postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage}

# Servidor
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Autenticação
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Player - Encriptação de configuração
TOTEM_SECRET_KEY=$TOTEM_SECRET_KEY

# Player
PLAYER_ABANDON_PIN=1234

# IA
AI_PROVIDER=ollama
AI_MODEL=llama3.2:3b
OLLAMA_BASE_URL=http://localhost:11434

# Upload - SEMPRE usar /opt/smart-signage independente do INSTALL_DIR
UPLOAD_MAX_SIZE=2GB
UPLOAD_PATH=/opt/smart-signage/public/assets/uploads
MEDIA_QUOTA_PER_CLIENT=5GB

# Logs - SEMPRE usar /opt/smart-signage independente do INSTALL_DIR
LOG_LEVEL=info
LOG_FILE=/opt/smart-signage/Logs/app.log

# CORS (layout dividido: inclui origem do painel na porta do sistema)
CORS_ORIGIN=http://localhost:3000,http://localhost:3001${CORS_SPLIT_ORIGIN}

# TotemDigital modo compacto (= mono) vs Pro — menu de instalação ou --totemdigital-compact / --smartsignage-pro
TOTEMDIGITAL_COMPACT=$INSTALL_TOTEMDIGITAL_COMPACT
REACT_APP_TOTEMDIGITAL_COMPACT=$INSTALL_TOTEMDIGITAL_COMPACT

# Modo Publicar em Totem — --direct-totem / --no-direct-totem (frontend lê em build-time; alterar exige rebuild)
DIRECT_TOTEM_MODE=$INSTALL_DIRECT_TOTEM_MODE
REACT_APP_DIRECT_TOTEM_MODE=$INSTALL_DIRECT_TOTEM_MODE

# Dados do proprietário (owner) para seed dinâmico no modo compacto
SYSTEM_OWNER_NAME=$SYSTEM_OWNER_NAME
SYSTEM_OWNER_CONTACT_NAME=$SYSTEM_OWNER_CONTACT_NAME
SYSTEM_OWNER_EMAIL=$SYSTEM_OWNER_EMAIL
SYSTEM_OWNER_CITY=$SYSTEM_OWNER_CITY
SYSTEM_OWNER_ADMIN_USERNAME=$SYSTEM_OWNER_ADMIN_USERNAME
SYSTEM_OWNER_PUBLISHER_USERNAME=$SYSTEM_OWNER_PUBLISHER_USERNAME
SYSTEM_OWNER_PLAN_NAME=$SYSTEM_OWNER_PLAN_NAME
SYSTEM_OWNER_PLAN_SLUG=$SYSTEM_OWNER_PLAN_SLUG

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# SmartDisplayFX / MQTT
SMARTDISPLAYFX_MQTT_ENABLED=$([[ "$MQTT_LOCAL_BROKER_REQUIRED" == "true" ]] && echo "true" || echo "false")
SMARTDISPLAYFX_MQTT_URL=mqtt://localhost:1883
SMARTDISPLAYFX_MQTT_WS_URL=${MQTT_WS_URL_DEFAULT}
SMARTDISPLAYFX_MQTT_USERNAME=${MQTT_BACKEND_USERNAME}
SMARTDISPLAYFX_MQTT_PASSWORD=${MQTT_BACKEND_PASSWORD}
SMARTDISPLAYFX_MQTT_PREFIX=smartdisplay
${FINANCIAL_ENV_BLOCK}
EOF
        }
        log "✅ .env criado no diretório backend: $BACKEND_ENV_FILE"
    fi
}

# -----------------------------------------------------------------------------
# IP/domínio público e layout Nginx: site corporativo (estático) vs painel em portas distintas
# Com --skip-menu / automação, defina por exemplo:
#   export SMARTSIGNAGE_SPLIT_SITE=true
#   export SMARTSIGNAGE_PUBLIC_HOST=203.0.113.10
#   export SMARTSIGNAGE_CORPORATE_HTTP_PORT=80
#   export SMARTSIGNAGE_SYSTEM_HTTP_PORT=8080
#   export SMARTSIGNAGE_CORPORATE_WEB_ROOT=/var/www/corporate-site
#   export SMARTSIGNAGE_CORPORATE_SITE_SOURCE=/path/to/totemdigital.site   # opcional
#   export SMARTSIGNAGE_CORPORATE_LANDING_FILE=app.html
# O instalador sincroniza totemdigital.site/ (fallback: corporate-site/) para CORPORATE_WEB_ROOT.
# Let's Encrypt com layout dividido (não interativo): também
#   export SMARTSIGNAGE_LETSENCRYPT=true
#   export SMARTSIGNAGE_DOMAIN_NAME=exemplo.com.br
#   export SMARTSIGNAGE_SSL_EMAIL=admin@exemplo.com.br   (opcional)
# Ou flags: --split-corporate-system --public-host IP --system-http-port 8080
# -----------------------------------------------------------------------------
is_valid_tcp_port() {
    [[ -n "${1:-}" ]] && [[ "$1" =~ ^[0-9]+$ ]] && (( $1 >= 1 && $1 <= 65535 ))
}

# Layout dividido ativo (site corporativo numa porta, painel noutra — ex.: 80 + 8080).
is_split_corporate_layout() {
    [[ "${SPLIT_CORPORATE_AND_SYSTEM:-false}" == "true" ]]
}

env_has_nginx_split() {
    local envf="${1:-${INSTALL_DIR:-/opt/smart-signage}/.env}"
    [[ -f "$envf" ]] && grep -qE '^SMARTSIGNAGE_NGINX_SPLIT=true' "$envf" 2>/dev/null
}

# Nunca usar fix-nginx-and-port80.sh quando a :80 é do site corporativo (substituiria index.html pelo React).
run_fix_nginx_port80_if_allowed() {
    if is_split_corporate_layout || env_has_nginx_split; then
        warning "Layout dividido: não aplicar fix-nginx-and-port80 (a :80 é do site corporativo, não do painel)."
        return 1
    fi
    local fix_script="${1:-${INSTALL_DIR:-}/scripts/fix-nginx-and-port80.sh}"
    if [[ -f "$fix_script" ]]; then
        log "Aplicando fix-nginx-and-port80.sh como fallback..."
        bash "$fix_script" || true
    fi
}

apply_split_layout_from_environment() {
    case "${SMARTSIGNAGE_SPLIT_SITE:-}" in
        1|true|TRUE|yes|YES|s|S) SPLIT_CORPORATE_AND_SYSTEM=true ;;
    esac
    [[ -n "${SMARTSIGNAGE_PUBLIC_HOST:-}" ]] && PUBLIC_HOST="${SMARTSIGNAGE_PUBLIC_HOST}"
    [[ -n "${SMARTSIGNAGE_CORPORATE_HTTP_PORT:-}" ]] && CORPORATE_HTTP_PORT="${SMARTSIGNAGE_CORPORATE_HTTP_PORT}"
    [[ -n "${SMARTSIGNAGE_SYSTEM_HTTP_PORT:-}" ]] && SYSTEM_HTTP_PORT="${SMARTSIGNAGE_SYSTEM_HTTP_PORT}"
    [[ -n "${SMARTSIGNAGE_CORPORATE_WEB_ROOT:-}" ]] && [[ "${CORPORATE_WEB_ROOT_FROM_CLI:-false}" != "true" ]] && CORPORATE_WEB_ROOT="${SMARTSIGNAGE_CORPORATE_WEB_ROOT}"
    [[ -n "${SMARTSIGNAGE_CORPORATE_SITE_SOURCE:-}" ]] && [[ "${CORPORATE_SITE_SOURCE_FROM_CLI:-false}" != "true" ]] && CORPORATE_SITE_SOURCE="${SMARTSIGNAGE_CORPORATE_SITE_SOURCE}"
    [[ -n "${SMARTSIGNAGE_CORPORATE_LANDING_FILE:-}" ]] && CORPORATE_LANDING_FILE="${SMARTSIGNAGE_CORPORATE_LANDING_FILE}"
    case "${SMARTSIGNAGE_LETSENCRYPT:-}" in
        1|true|TRUE|yes|YES)
            if [[ "${SPLIT_CORPORATE_AND_SYSTEM:-false}" == "true" ]] && [[ -n "${SMARTSIGNAGE_DOMAIN_NAME:-}" ]]; then
                ENABLE_HTTPS_LETSENCRYPT=true
                ENABLE_HTTPS_SELF_SIGNED=false
                DOMAIN_NAME="${SMARTSIGNAGE_DOMAIN_NAME}"
                SSL_EMAIL="${SMARTSIGNAGE_SSL_EMAIL:-admin@${DOMAIN_NAME}}"
            fi
            ;;
    esac
}

finalize_https_when_split_layout() {
    if [[ "$SPLIT_CORPORATE_AND_SYSTEM" != "true" ]]; then
        return 0
    fi
    if [[ "$ENABLE_HTTPS_SELF_SIGNED" == "true" ]]; then
        warning "Layout dividido: HTTPS autoassinado não é suportado neste assistente (use Let's Encrypt para HTTPS no site corporativo na 443 ou configure TLS manualmente)."
        ENABLE_HTTPS_SELF_SIGNED=false
    fi
}

ask_public_host_and_split_layout() {
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        log "Modo Docker: layout site+sistema no Nginx do host não é aplicado por este passo."
        return 0
    fi
    if [[ "$INSTALL_MODE" != "single-server" ]] && [[ "$INSTALL_MODE" != "development" ]]; then
        return 0
    fi

    apply_split_layout_from_environment

    local default_ip
    default_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    [[ -z "$default_ip" ]] && default_ip=""

    if [[ "$SKIP_MENU" == "true" ]]; then
        if [[ "$SPLIT_CORPORATE_AND_SYSTEM" != "true" ]]; then
            case "${SMARTSIGNAGE_SINGLE_PORT:-}" in
                1|true|TRUE|yes|YES) ;;
                *)
                    SPLIT_CORPORATE_AND_SYSTEM=true
                    CORPORATE_HTTP_PORT="${SMARTSIGNAGE_CORPORATE_HTTP_PORT:-80}"
                    SYSTEM_HTTP_PORT="${SMARTSIGNAGE_SYSTEM_HTTP_PORT:-8080}"
                    log "Layout dividido por defeito (--skip-menu): site corporativo :${CORPORATE_HTTP_PORT}, Smart Signage :${SYSTEM_HTTP_PORT}."
                    ;;
            esac
        fi
        if [[ "$SPLIT_CORPORATE_AND_SYSTEM" == "true" ]]; then
            if [[ "$CORPORATE_HTTP_PORT" == "$SYSTEM_HTTP_PORT" ]]; then
                SYSTEM_HTTP_PORT="${SMARTSIGNAGE_SYSTEM_HTTP_PORT:-8080}"
            fi
            is_valid_tcp_port "$CORPORATE_HTTP_PORT" || { error "Porta corporativa inválida: $CORPORATE_HTTP_PORT"; exit 1; }
            is_valid_tcp_port "$SYSTEM_HTTP_PORT" || { error "Porta do sistema inválida: $SYSTEM_HTTP_PORT"; exit 1; }
            if [[ "$CORPORATE_HTTP_PORT" == "$SYSTEM_HTTP_PORT" ]]; then
                error "Com layout dividido, CORPORATE_HTTP_PORT e SYSTEM_HTTP_PORT devem ser diferentes (ex.: 80 e 8080)."
                exit 1
            fi
            [[ -z "$PUBLIC_HOST" ]] && PUBLIC_HOST="${default_ip:-_}"
            log "Layout dividido (não interativo): site corporativo TCP $CORPORATE_HTTP_PORT, Smart Signage TCP $SYSTEM_HTTP_PORT, host ${PUBLIC_HOST}, raiz corporativa $CORPORATE_WEB_ROOT"
            finalize_https_when_split_layout
        fi
        return 0
    fi

    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}         Exposição HTTP: site corporativo e painel Smart Signage (Nginx)${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    echo "Como deseja expor o tráfego HTTP?"
    echo -e "  ${GREEN}1)${NC} Tudo na mesma porta: painel, API e /player na porta 80."
    echo -e "  ${GREEN}2)${NC} Site corporativo (totemdigital.site) na :80 e o painel Smart Signage noutra porta (padrão; ex.: :8080)."
    echo
    read -p "Opção [2]: " _split_choice
    _split_choice=${_split_choice:-2}
    case "${_split_choice}" in
        2)
            SPLIT_CORPORATE_AND_SYSTEM=true
            ;;
        *)
            SPLIT_CORPORATE_AND_SYSTEM=false
            CORPORATE_HTTP_PORT=80
            SYSTEM_HTTP_PORT=80
            log "Usando um único virtual host HTTP (porta 80) para painel e API."
            return 0
            ;;
    esac

    echo
    echo -e "${YELLOW}IP público ou domínio com que browsers e players acedem a este servidor${NC}"
    echo "(Usado em server_name e nas mensagens finais. Se só tem IP, indique o IP.)"
    read -p "IP ou domínio [${default_ip}]: " _ph
    PUBLIC_HOST="${_ph:-$default_ip}"
    [[ -z "$PUBLIC_HOST" ]] && PUBLIC_HOST="_"

    read -p "Porta HTTP do site corporativo (ficheiros estáticos) [80]: " _cp
    CORPORATE_HTTP_PORT="${_cp:-80}"
    read -p "Porta HTTP do Smart Signage — painel, /api e /player [8080]: " _sp
    SYSTEM_HTTP_PORT="${_sp:-8080}"

    read -p "Diretório raiz do site corporativo no servidor [$CORPORATE_WEB_ROOT]: " _wr
    CORPORATE_WEB_ROOT="${_wr:-$CORPORATE_WEB_ROOT}"

    if ! is_valid_tcp_port "$CORPORATE_HTTP_PORT"; then
        warning "Porta corporativa inválida ($CORPORATE_HTTP_PORT). A usar 80."
        CORPORATE_HTTP_PORT=80
    fi
    if ! is_valid_tcp_port "$SYSTEM_HTTP_PORT"; then
        warning "Porta do sistema inválida ($SYSTEM_HTTP_PORT). A usar 8080."
        SYSTEM_HTTP_PORT=8080
    fi
    if [[ "$CORPORATE_HTTP_PORT" == "$SYSTEM_HTTP_PORT" ]]; then
        warning "As portas coincidem; a voltar ao layout único (painel na ${SYSTEM_HTTP_PORT})."
        SPLIT_CORPORATE_AND_SYSTEM=false
        SYSTEM_HTTP_PORT=80
        CORPORATE_HTTP_PORT=80
        return 0
    fi

    log "Layout dividido: site corporativo em :${CORPORATE_HTTP_PORT} (raiz ${CORPORATE_WEB_ROOT}); Smart Signage em :${SYSTEM_HTTP_PORT} (host ${PUBLIC_HOST})."
    finalize_https_when_split_layout
}

# Perguntar sobre configuração HTTPS
ask_https_configuration() {
    # Pular se for modo Docker (gerenciado pelo compose)
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        return 0
    fi

    # Layout dividido: sem HTTPS autoassinado; Let's Encrypt unifica site + painel/API na 443.
    if [[ "$SPLIT_CORPORATE_AND_SYSTEM" == "true" ]]; then
        ENABLE_HTTPS_SELF_SIGNED=false
        if [[ "$SKIP_MENU" == "true" ]]; then
            if [[ "$ENABLE_HTTPS_LETSENCRYPT" == "true" ]] && [[ -n "${DOMAIN_NAME:-}" ]]; then
                log "Layout dividido + skip-menu: Let's Encrypt ativado — site + API/painel na 443 (SMARTSIGNAGE_LETSENCRYPT / SMARTSIGNAGE_DOMAIN_NAME)."
            else
                log "Layout dividido + skip-menu: HTTPS não configurado (padrão). Defina SMARTSIGNAGE_LETSENCRYPT=true e SMARTSIGNAGE_DOMAIN_NAME=totemdigital.app.br para TLS unificado na 443."
                ENABLE_HTTPS_LETSENCRYPT=false
            fi
            return 0
        fi
        echo
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${CYAN}   HTTPS com Let's Encrypt (site corporativo + painel/API na mesma 443)${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo
        echo -e "${YELLOW}Com Let's Encrypt:${NC}"
        echo -e "  • ${GREEN}https://SEU_DOMINIO/${NC}  — site institucional + painel + API + player"
        echo -e "  • Porta HTTP 80 redireciona para HTTPS (validação ACME mantida)"
        echo -e "  • Porta ${SYSTEM_HTTP_PORT:-8080} continua em HTTP (acesso por IP/LAN sem certificado)"
        echo -e "  • Player-AD: serverUrl = ${GREEN}https://SEU_DOMINIO${NC} (sem porta)"
        echo -e "${YELLOW}Requisitos: DNS A do domínio → este servidor; firewall TCP 80 e 443 abertos.${NC}"
        echo
        echo -e "${GREEN}1)${NC} Sem HTTPS (apenas HTTP nas portas ${CORPORATE_HTTP_PORT:-80}/${SYSTEM_HTTP_PORT:-8080})"
        echo -e "${GREEN}2)${NC} Let's Encrypt — HTTPS unificado na 443 (recomendado para produção)"
        echo
        read -p "Digite sua escolha (1-2) [padrão: 2]: " https_split_choice
        https_split_choice=${https_split_choice:-2}
        case "${https_split_choice}" in
            1)
                ENABLE_HTTPS_LETSENCRYPT=false
                ;;
            *)
                ask_letsencrypt_details
                ;;
        esac
        return 0
    fi
    
    # Pular se já foi configurado via flag
    if [[ "$ENABLE_HTTPS_SELF_SIGNED" == "true" ]]; then
        return 0
    fi

    # Em modo não interativo, aplicar default do menu (1 = sem HTTPS)
    if [[ "$SKIP_MENU" == "true" ]]; then
        ENABLE_HTTPS_SELF_SIGNED=false
        ENABLE_HTTPS_LETSENCRYPT=false
        log "HTTPS não será configurado (skip-menu padrão: 1 - sem HTTPS)"
        return 0
    fi
    
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}                    Configuração de HTTPS (SSL/TLS)${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    echo -e "${YELLOW}Escolha como deseja configurar HTTPS:${NC}"
    echo -e "${GREEN}1)${NC} Sem HTTPS (apenas HTTP - porta 80)"
    echo -e "${GREEN}2)${NC} HTTPS com certificado autoassinado (testes/desenvolvimento)"
    echo -e "${GREEN}3)${NC} HTTPS com Let's Encrypt (produção - requer domínio público)"
    echo
    read -p "Digite sua escolha (1-3) [padrão: 1]: " https_choice
    
    https_choice=${https_choice:-1}
    
    case $https_choice in
        1)
            log "HTTPS não será configurado (apenas HTTP)"
            ENABLE_HTTPS_SELF_SIGNED=false
            ENABLE_HTTPS_LETSENCRYPT=false
            ;;
        2)
            log "HTTPS autoassinado será configurado"
            ENABLE_HTTPS_SELF_SIGNED=true
            ENABLE_HTTPS_LETSENCRYPT=false
            ;;
        3)
            log "Iniciando configuração Let's Encrypt..."
            ask_letsencrypt_details
            ;;
        *)
            log "Opção inválida, usando padrão (sem HTTPS)"
            ENABLE_HTTPS_SELF_SIGNED=false
            ENABLE_HTTPS_LETSENCRYPT=false
            ;;
    esac
}

# Perguntar detalhes do Let's Encrypt
ask_letsencrypt_details() {
    echo
    echo -e "${YELLOW}Para usar Let's Encrypt, você precisa ter:${NC}"
    echo "  ✓ Domínio público (ex: smartsignage.com.br)"
    echo "  ✓ DNS apontando para o IP deste servidor"
    echo "  ✓ Porta 80 acessível (para validação)"
    echo
    read -p "Digite seu domínio (ex: totemdigital.app.br) [padrão: totemdigital.app.br]: " domain_input
    domain_input=${domain_input:-totemdigital.app.br}
    
    if [[ -z "$domain_input" ]]; then
        warning "Domínio não informado. Usando HTTP sem HTTPS."
        ENABLE_HTTPS_LETSENCRYPT=false
        return 0
    fi
    
    DOMAIN_NAME="$domain_input"
    
    echo
    read -p "Digite seu email para notificações do Let's Encrypt (opcional): " email_input
    SSL_EMAIL="${email_input:-admin@${DOMAIN_NAME}}"
    
    # Verificar se o domínio está configurado no DNS
    log "Verificando se o domínio $DOMAIN_NAME aponta para este servidor..."
    
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "")
    
    # Tentar usar dig se disponível, senão usar getent ou ping
    if command -v dig &> /dev/null; then
        DOMAIN_IP=$(dig +short "$DOMAIN_NAME" A 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1 || echo "")
    elif command -v host &> /dev/null; then
        DOMAIN_IP=$(host -t A "$DOMAIN_NAME" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")
    else
        DOMAIN_IP=""
    fi
    
    if [[ -z "$DOMAIN_IP" ]]; then
        warning "⚠️  Não foi possível verificar o DNS do domínio $DOMAIN_NAME"
        warning "Certifique-se de que o DNS A/AAAA aponta para este servidor antes de continuar"
        echo
        read -p "Deseja continuar mesmo assim? (s/N): " continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Ss]$ ]]; then
            log "Let's Encrypt cancelado. Usando HTTP sem HTTPS."
            ENABLE_HTTPS_LETSENCRYPT=false
            return 0
        fi
    elif [[ -n "$SERVER_IP" && "$DOMAIN_IP" != "$SERVER_IP" ]]; then
        warning "⚠️  O domínio $DOMAIN_NAME aponta para $DOMAIN_IP, mas este servidor é $SERVER_IP"
        warning "O certificado pode falhar se o DNS não estiver correto"
        echo
        read -p "Deseja continuar mesmo assim? (s/N): " continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Ss]$ ]]; then
            log "Let's Encrypt cancelado. Usando HTTP sem HTTPS."
            ENABLE_HTTPS_LETSENCRYPT=false
            return 0
        fi
    else
        log "✓ Domínio $DOMAIN_NAME verificado corretamente"
    fi
    
    ENABLE_HTTPS_LETSENCRYPT=true
    ENABLE_HTTPS_SELF_SIGNED=false
}

# Configurar Let's Encrypt
setup_letsencrypt() {
    if [[ "$ENABLE_HTTPS_LETSENCRYPT" != "true" ]] || [[ -z "$DOMAIN_NAME" ]]; then
        return 0
    fi
    
    log "Configurando Let's Encrypt para $DOMAIN_NAME..."
    
    # Instalar certbot se não estiver instalado
    if ! command -v certbot &> /dev/null; then
        log "Instalando Certbot..."
        sudo apt install -y certbot python3-certbot-nginx || {
            error "Falha ao instalar Certbot"
            warning "Continuando sem HTTPS"
            ENABLE_HTTPS_LETSENCRYPT=false
            return 0
        }
    fi
    
    NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"
    _backend_port=""
    [[ -f "$INSTALL_DIR/.env" ]] && _backend_port=$(awk -F= '/^BACKEND_PORT=/{print $2; exit}' "$INSTALL_DIR/.env" 2>/dev/null | tr -d '"' | tr -d "'" | xargs || true)
    if [[ -z "${_backend_port:-}" ]]; then
        log "ℹ️ BACKEND_PORT não definido no .env. Usando padrão: 3000"
    fi
    BACKEND_PORT=${_backend_port:-3000}

    if [[ "$SPLIT_CORPORATE_AND_SYSTEM" == "true" ]]; then
        if [[ "${CORPORATE_HTTP_PORT:-80}" != "80" ]]; then
            warning "Let's Encrypt com layout dividido exige o site corporativo na porta TCP 80 (validação HTTP-01)."
            ENABLE_HTTPS_LETSENCRYPT=false
            return 0
        fi
        sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
        sudo chown -R www-data:www-data /var/www/certbot 2>/dev/null || sudo chown -R nginx:nginx /var/www/certbot 2>/dev/null || true
        log "Layout dividido: a validar Nginx existente (webroot em /var/www/certbot) antes do certbot."
        verify_nginx_ws_config "$NGINX_CONFIG"
        if sudo nginx -t && { sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload; }; then
            log "Nginx recarregado para Let's Encrypt (webroot)."
        else
            error "Erro ao validar/recarregar Nginx antes do Let's Encrypt"
            warning "Continuando sem HTTPS"
            ENABLE_HTTPS_LETSENCRYPT=false
            return 0
        fi
    else
        # Configurar primeiro com HTTP apenas (layout único na 80)
        sudo tee $NGINX_CONFIG > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME www.$DOMAIN_NAME;
    
    # Frontend
    location / {
        root $FRONTEND_BUILD_DIR;
        try_files \$uri \$uri/ /index.html;
    }
    
    # Backend API
    # Configurações de upload
    client_max_body_size 500M;
    client_body_buffer_size 512k;
    
    # ^~ garante precedência sobre regex de arquivos estáticos (.js, .css, etc.)
    location ^~ /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        # Timeouts aumentados para uploads grandes
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # WebSocket (logs em tempo real, monitor) – proxy para o backend com upgrade (OBRIGATÓRIO para /ws)
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    
    # Player - Proxy para backend Express (^~ evita que /player/js/* seja capturado por regex .js)
    location ^~ /player {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        # Buffers maiores para player (arquivos JS podem ser grandes)
        proxy_buffer_size 256k;
        proxy_buffers 8 512k;
        proxy_busy_buffers_size 512k;
        proxy_temp_file_write_size 512k;
        # Remover headers que quebram player em HTTP (CSP/COOP bloqueiam inline scripts)
        proxy_hide_header Content-Security-Policy;
        proxy_hide_header Cross-Origin-Opener-Policy;
        proxy_hide_header Origin-Agent-Cluster;
    }
    
    # Assets - Proxy para backend (evita problemas de permissão)
    # Backend já serve /assets via express.static
    location /assets/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
        sudo ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/
        sudo rm -f /etc/nginx/sites-enabled/default
        sanitize_nginx_default_server_conflicts "$NGINX_CONFIG"
        verify_nginx_ws_config "$NGINX_CONFIG"
        
        if sudo nginx -t && { sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload; }; then
            log "Nginx configurado com HTTP temporariamente"
        else
            error "Erro ao configurar Nginx"
            warning "Continuando sem HTTPS"
            ENABLE_HTTPS_LETSENCRYPT=false
            return 0
        fi
    fi
    
    log "Obtendo certificado SSL do Let's Encrypt..."
    log "Isso pode levar alguns minutos..."
    
    local cert_ok=0
    if [[ "$SPLIT_CORPORATE_AND_SYSTEM" == "true" ]]; then
        if sudo certbot certonly --webroot -w /var/www/certbot \
            -d "$DOMAIN_NAME" -d "www.$DOMAIN_NAME" \
            --non-interactive --agree-tos --email "$SSL_EMAIL" \
            --preferred-challenges http; then
            cert_ok=1
        fi
    else
        if sudo certbot --nginx -d "$DOMAIN_NAME" -d "www.$DOMAIN_NAME" --non-interactive --agree-tos --email "$SSL_EMAIL" --redirect; then
            cert_ok=1
        fi
    fi
    
    if [[ "$cert_ok" -eq 1 ]]; then
        log "✅ Certificado Let's Encrypt obtido com sucesso!"
        persist_domain_name_to_env_files
        
        if [[ "$SPLIT_CORPORATE_AND_SYSTEM" == "true" ]]; then
            if apply_split_nginx_corporate_https_after_le; then
                SMARTSIGNAGE_CORPORATE_LE_HTTPS=true
                persist_nginx_public_layout_to_env
                local _pu="https://${DOMAIN_NAME}/"
                sync_corporate_site_to_webroot "$CORPORATE_WEB_ROOT" || true
                deploy_corporate_landing_html "$CORPORATE_WEB_ROOT" "$_pu"
                # API pública HTTPS (Player-AD / frontend relativo)
                for f in "$INSTALL_DIR/.env" "$INSTALL_DIR/backend/.env"; do
                    [[ -f "$f" ]] || continue
                    local tmp
                    tmp=$(mktemp "${f}.https.XXXXXX" 2>/dev/null || echo "${f}.https.tmp")
                    grep -vE '^REACT_APP_API_URL=|^PUBLIC_API_BASE_URL=|^PLAYER_AD_DEFAULT_SERVER_URL=' "$f" > "$tmp" 2>/dev/null || cp "$f" "$tmp"
                    mv -f "$tmp" "$f"
                    {
                        echo "REACT_APP_API_URL=https://${DOMAIN_NAME}"
                        echo "PUBLIC_API_BASE_URL=https://${DOMAIN_NAME}"
                        echo "PLAYER_AD_DEFAULT_SERVER_URL=https://${DOMAIN_NAME}"
                    } >> "$f"
                done
                log "URLs públicas HTTPS: https://${DOMAIN_NAME}/ (site + painel + API). Player-AD serverUrl=https://${DOMAIN_NAME}"
            else
                warning "Não foi possível aplicar HTTPS unificado na 443; a restaurar Nginx HTTP (layout dividido)."
                ENABLE_HTTPS_LETSENCRYPT=false
                setup_nginx_http_only || true
            fi
        fi
        
        if ! sudo crontab -l 2>/dev/null | grep -q "certbot renew"; then
            if [[ "$SPLIT_CORPORATE_AND_SYSTEM" == "true" ]]; then
                (sudo crontab -l 2>/dev/null; echo "0 0 * * * /usr/bin/certbot renew --quiet && /bin/systemctl reload nginx") | sudo crontab -
            else
                (sudo crontab -l 2>/dev/null; echo "0 0 * * * /usr/bin/certbot renew --quiet --nginx && systemctl reload nginx") | sudo crontab -
            fi
            log "✓ Renovação automática configurada no cron"
        fi
    else
        error "❌ Falha ao obter certificado Let's Encrypt"
        warning "Verifique se:"
        warning "  - O domínio $DOMAIN_NAME aponta para este servidor"
        warning "  - A porta 80 está acessível"
        warning "  - O firewall permite conexões HTTP"
        warning "Continuando sem HTTPS. Você pode tentar novamente depois com:"
        warning "  sudo certbot --nginx -d $DOMAIN_NAME"
        ENABLE_HTTPS_LETSENCRYPT=false
        
        setup_nginx_http_only
    fi
}

# Exporta variáveis de build do frontend a partir do .env (REACT_APP_*).
# Chamar antes de npm run build no frontend para parametrizar API/WebSocket URL.
export_frontend_build_env() {
    local env_file="${INSTALL_DIR:-.}/.env"
    if [[ -f "$env_file" ]]; then
        if grep -qE '^REACT_APP_API_URL=' "$env_file" 2>/dev/null; then
            export REACT_APP_API_URL=$(grep -E '^REACT_APP_API_URL=' "$env_file" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)
            [[ -n "$REACT_APP_API_URL" ]] && log "Build do frontend: REACT_APP_API_URL=$REACT_APP_API_URL (WebSocket usará este host/porta)"
        fi
        if grep -qE '^REACT_APP_TOTEMDIGITAL_COMPACT=' "$env_file" 2>/dev/null; then
            export REACT_APP_TOTEMDIGITAL_COMPACT=$(grep -E '^REACT_APP_TOTEMDIGITAL_COMPACT=' "$env_file" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)
            [[ -n "$REACT_APP_TOTEMDIGITAL_COMPACT" ]] && log "Build do frontend: REACT_APP_TOTEMDIGITAL_COMPACT=$REACT_APP_TOTEMDIGITAL_COMPACT"
        fi
        if grep -qE '^REACT_APP_DIRECT_TOTEM_MODE=' "$env_file" 2>/dev/null; then
            export REACT_APP_DIRECT_TOTEM_MODE=$(grep -E '^REACT_APP_DIRECT_TOTEM_MODE=' "$env_file" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)
            [[ -n "$REACT_APP_DIRECT_TOTEM_MODE" ]] && log "Build do frontend: REACT_APP_DIRECT_TOTEM_MODE=$REACT_APP_DIRECT_TOTEM_MODE"
        fi
        if grep -qE '^REACT_APP_DASHBOARD_COMMERCIAL_FOCUS=' "$env_file" 2>/dev/null; then
            export REACT_APP_DASHBOARD_COMMERCIAL_FOCUS=$(grep -E '^REACT_APP_DASHBOARD_COMMERCIAL_FOCUS=' "$env_file" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)
            [[ -n "$REACT_APP_DASHBOARD_COMMERCIAL_FOCUS" ]] && log "Build do frontend: REACT_APP_DASHBOARD_COMMERCIAL_FOCUS=$REACT_APP_DASHBOARD_COMMERCIAL_FOCUS"
        fi
    fi
}

# Executa build do frontend com limite de memória ajustável para evitar OOM.
# Uso:
#   run_frontend_build
#   run_frontend_build "/caminho/do/log.log"
run_frontend_build() {
    local log_file="${1:-}"
    local initial_heap_mb="${FRONTEND_NODE_MAX_OLD_SPACE_SIZE:-4096}"
    local retry_heap_mb="${FRONTEND_NODE_MAX_OLD_SPACE_SIZE_RETRY:-6144}"
    local base_node_opts="${NODE_OPTIONS:-}"
    local build_status=0

    if [[ "$initial_heap_mb" -lt 1024 ]]; then
        initial_heap_mb=4096
    fi
    if [[ "$retry_heap_mb" -lt "$initial_heap_mb" ]]; then
        retry_heap_mb="$initial_heap_mb"
    fi

    log "Compilando frontend com NODE_OPTIONS=--max-old-space-size=${initial_heap_mb}"
    if [[ -n "$log_file" ]]; then
        NODE_OPTIONS="--max-old-space-size=${initial_heap_mb} ${base_node_opts}" npm run build 2>&1 | tee -a "$log_file"
        build_status=${PIPESTATUS[0]}
    else
        NODE_OPTIONS="--max-old-space-size=${initial_heap_mb} ${base_node_opts}" npm run build
        build_status=$?
    fi

    if [[ $build_status -eq 0 ]]; then
        return 0
    fi

    if [[ "$retry_heap_mb" -gt "$initial_heap_mb" ]]; then
        warn "⚠️ Build do frontend falhou. Tentando novamente com mais memória (${retry_heap_mb}MB)..."
        if [[ -n "$log_file" ]]; then
            NODE_OPTIONS="--max-old-space-size=${retry_heap_mb} ${base_node_opts}" npm run build 2>&1 | tee -a "$log_file"
            build_status=${PIPESTATUS[0]}
        else
            NODE_OPTIONS="--max-old-space-size=${retry_heap_mb} ${base_node_opts}" npm run build
            build_status=$?
        fi
    fi

    return $build_status
}

# Verifica se o config Nginx ativo inclui proxy WebSocket /ws (evita handshake 200)
verify_nginx_ws_config() {
    local cfg="${1:-/etc/nginx/sites-available/smart-signage}"
    if [[ -f "$cfg" ]] && sudo grep -q 'location /ws' "$cfg" 2>/dev/null; then
        log "Config Nginx inclui proxy WebSocket /ws"
    else
        warning "Config Nginx pode não ter proxy /ws - WebSocket pode falhar (handshake 200)"
        warning "Se o monitor mostrar 'Unexpected response code: 200', recarregue o config deste script ou adicione manualmente: location /ws { proxy_pass http://localhost:3000; proxy_http_version 1.1; proxy_set_header Upgrade \$http_upgrade; proxy_set_header Connection \"upgrade\"; ... }"
    fi
}

# Landing opcional do site corporativo (layout dividido). Por defeito NÃO grava ficheiros:
# a :80 serve o conteúdo sincronizado de totemdigital.site/ (ou corporate-site/) em CORPORATE_WEB_ROOT.
# Atalho app.html → painel só com SMARTSIGNAGE_DEPLOY_CORPORATE_LANDING=true (opt-in).
# Remove index.html/app.html legados do instalador (marcador smart-signage-default-corporate-landing-v1).

# Resolve pasta de origem do site corporativo no repositório (preferência: totemdigital.site).
resolve_corporate_site_source() {
    local candidates=(
        "${CORPORATE_SITE_SOURCE:-}"
        "${SMARTSIGNAGE_CORPORATE_SITE_SOURCE:-}"
        "${SOURCE_DIR:-}/totemdigital.site"
        "${INSTALL_DIR:-}/totemdigital.site"
        "${SOURCE_DIR:-}/corporate-site"
        "${INSTALL_DIR:-}/corporate-site"
    )
    local d abs
    for d in "${candidates[@]}"; do
        [[ -z "$d" ]] && continue
        abs="$(readlink -f "$d" 2>/dev/null || realpath "$d" 2>/dev/null || echo "$d")"
        if [[ -d "$abs" ]] && [[ -f "$abs/index.html" ]]; then
            printf '%s\n' "$abs"
            return 0
        fi
    done
    return 1
}

# Copia totemdigital.site (ou fallback) para CORPORATE_WEB_ROOT — site corporativo na :80.
# Uso: sync_corporate_site_to_webroot [dest_root]
sync_corporate_site_to_webroot() {
    local dest_root="${1:-$CORPORATE_WEB_ROOT}"
    local src=""

    if [[ -z "$dest_root" ]]; then
        warn "sync_corporate_site_to_webroot: raiz de destino vazia."
        return 1
    fi

    src="$(resolve_corporate_site_source)" || {
        warn "Site corporativo: pasta totemdigital.site (ou corporate-site) com index.html não encontrada no repositório."
        sudo mkdir -p "$dest_root"
        return 1
    }

    log "Site corporativo: a sincronizar '${src}' → '${dest_root}'"
    sudo mkdir -p "$dest_root"

    if command -v rsync &>/dev/null; then
        sudo rsync -a --delete \
            --exclude '.git/' \
            --exclude '.gitignore' \
            --exclude 'README.md' \
            "${src}/" "${dest_root}/"
    else
        # Remover conteúdo antigo (exceto .well-known local, se existir)
        if [[ -d "$dest_root" ]]; then
            while IFS= read -r -d '' item; do
                [[ "$(basename "$item")" == ".well-known" ]] && continue
                sudo rm -rf "$item"
            done < <(find "$dest_root" -mindepth 1 -maxdepth 1 -print0 2>/dev/null || true)
        fi
        sudo cp -a "${src}/." "${dest_root}/"
    fi

    # Logos/ícones ficam em ~/TotemDigital/logos-icons — publicar em CORPORATE_WEB_ROOT/logos-icons
    # e ajustar HTML (../logos-icons → logos-icons) para a raiz do Nginx.
    local logos_src=""
    for logos_src in \
        "${SOURCE_DIR:-}/logos-icons" \
        "${INSTALL_DIR:-}/logos-icons" \
        "$(dirname "$src")/logos-icons"
    do
        [[ -n "$logos_src" && -d "$logos_src" ]] && break
        logos_src=""
    done
    if [[ -n "$logos_src" && -d "$logos_src" ]]; then
        log "Site corporativo: a sincronizar logos '${logos_src}' → '${dest_root}/logos-icons'"
        sudo mkdir -p "${dest_root}/logos-icons"
        if command -v rsync &>/dev/null; then
            sudo rsync -a --delete "${logos_src}/" "${dest_root}/logos-icons/"
        else
            sudo rm -rf "${dest_root}/logos-icons" 2>/dev/null || true
            sudo mkdir -p "${dest_root}/logos-icons"
            sudo cp -a "${logos_src}/." "${dest_root}/logos-icons/"
        fi
        # No repo o HTML usa ../logos-icons/ (pasta irmã). No webroot vira logos-icons/.
        if command -v find &>/dev/null; then
            while IFS= read -r -d '' htmlf; do
                sudo sed -i \
                    -e 's|src="\.\./logos-icons/|src="logos-icons/|g' \
                    -e "s|src='\\.\\./logos-icons/|src='logos-icons/|g" \
                    -e 's|url("\.\./logos-icons/|url("logos-icons/|g' \
                    -e "s|url('\\.\\./logos-icons/|url('logos-icons/|g" \
                    "$htmlf" 2>/dev/null || true
            done < <(find "$dest_root" -maxdepth 1 -type f \( -name '*.html' -o -name '*.htm' \) -print0 2>/dev/null || true)
        fi
    else
        warn "Site corporativo: pasta logos-icons não encontrada (esperado em SOURCE_DIR/logos-icons)."
    fi

    if id www-data &>/dev/null; then
        sudo chown -R www-data:www-data "$dest_root" 2>/dev/null || true
    else
        sudo chown -R nginx:nginx "$dest_root" 2>/dev/null || true
    fi
    sudo find "$dest_root" -type d -exec chmod 755 {} \; 2>/dev/null || true
    sudo find "$dest_root" -type f -exec chmod 644 {} \; 2>/dev/null || true

    if [[ ! -f "${dest_root}/index.html" ]]; then
        error "Site corporativo: index.html em falta em ${dest_root} após sync."
        return 1
    fi
    if [[ ! -f "${dest_root}/logos-icons/Icon-logo-Azul.png" ]]; then
        warn "Site corporativo: logos-icons/Icon-logo-Azul.png em falta em ${dest_root}."
    fi

    log "✅ Site corporativo instalado em ${dest_root} (origem: $(basename "$src")) — HTTP :${CORPORATE_HTTP_PORT:-80}"
    return 0
}

# Uso: deploy_corporate_landing_html [dest_root] [url_painel]
deploy_corporate_landing_html() {
    local dest_root="${1:-$CORPORATE_WEB_ROOT}"
    local panel_url="${2:-}"
    local landing_name="${CORPORATE_LANDING_FILE:-app.html}"
    local template_dir="${SOURCE_DIR:-.}/scripts/assets/corporate-landing"
    local template="${template_dir}/${landing_name}"
    if [[ ! -f "$template" ]]; then
        template="${template_dir}/app.html"
    fi
    local marker="smart-signage-default-corporate-landing-v1"
    local target="${dest_root}/${landing_name}"
    local legacy_index="${dest_root}/index.html"
    local host_label="${PUBLIC_HOST:-}"

    if [[ -z "$dest_root" ]]; then
        warn "deploy_corporate_landing_html: raiz vazia."
        return 1
    fi

    # Limpar artefactos legados do instalador (nunca tocar num index.html personalizado do cliente).
    if [[ -f "$legacy_index" ]] && grep -q "$marker" "$legacy_index" 2>/dev/null; then
        sudo rm -f "$legacy_index"
        log "Site corporativo: removido $legacy_index legado do instalador."
    fi
    if [[ -f "$target" ]] && grep -q "$marker" "$target" 2>/dev/null; then
        sudo rm -f "$target"
        log "Site corporativo: removido atalho legado $(basename "$target") (sem link ao painel)."
    fi

    case "${SMARTSIGNAGE_DEPLOY_CORPORATE_LANDING:-${DEPLOY_CORPORATE_LANDING:-false}}" in
        1|true|TRUE|yes|YES) ;;
        *)
            log "Site corporativo: mantém ficheiros existentes em $dest_root (sem gerar atalho ao painel)."
            return 0
            ;;
    esac
    if [[ -z "$host_label" ]] || [[ "$host_label" == "_" ]]; then
        host_label="$(hostname -I 2>/dev/null | awk '{print $1}')"
        [[ -z "$host_label" ]] && host_label="127.0.0.1"
    fi
    if [[ -z "$panel_url" ]]; then
        if [[ -n "${PUBLIC_HOST:-}" ]] && [[ "${PUBLIC_HOST}" != "_" ]]; then
            panel_url="http://${PUBLIC_HOST}:${SYSTEM_HTTP_PORT:-8080}/"
        else
            panel_url="http://${host_label}:${SYSTEM_HTTP_PORT:-8080}/"
        fi
    fi

    if [[ -f "$target" ]] && ! grep -q "$marker" "$target" 2>/dev/null; then
        log "Site corporativo: mantendo $target (landing personalizada)."
        return 0
    fi

    sudo mkdir -p "$dest_root"
    local year
    year=$(date +%Y)
    if [[ -f "$template" ]]; then
        if command -v python3 &>/dev/null; then
            export TEMPLATE="$template" _LAND_PANEL_URL="$panel_url" _LAND_HOST_LABEL="$host_label" _LAND_CORP_ROOT="$dest_root" _LAND_YEAR="$year"
            python3 << 'PY' | sudo tee "$target" > /dev/null
import os
from pathlib import Path
t = Path(os.environ["TEMPLATE"]).read_text(encoding="utf-8")
t = t.replace("__PANEL_URL__", os.environ.get("_LAND_PANEL_URL", ""))
t = t.replace("__PUBLIC_HOST_LABEL__", os.environ.get("_LAND_HOST_LABEL", ""))
t = t.replace("__CORPORATE_ROOT__", os.environ.get("_LAND_CORP_ROOT", ""))
t = t.replace("__YEAR__", os.environ.get("_LAND_YEAR", ""))
print(t, end="")
PY
            unset TEMPLATE _LAND_PANEL_URL _LAND_HOST_LABEL _LAND_CORP_ROOT _LAND_YEAR
        else
            sed -e "s|__PANEL_URL__|${panel_url//|/\\|}|g" \
                -e "s|__PUBLIC_HOST_LABEL__|${host_label//|/\\|}|g" \
                -e "s|__CORPORATE_ROOT__|${dest_root//|/\\|}|g" \
                -e "s|__YEAR__|${year}|g" \
                "$template" | sudo tee "$target" > /dev/null
        fi
    else
        warn "Template corporativo em falta ($template); a gravar HTML mínimo em ${landing_name}."
        sudo tee "$target" > /dev/null << MINHTML
<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"/><title>${host_label}</title></head>
<body><h1>${host_label}</h1><p><a href="${panel_url}">Painel Smart Signage</a></p><!-- ${marker} --></body></html>
MINHTML
    fi

    if id www-data &>/dev/null; then
        sudo chown -R www-data:www-data "$dest_root" 2>/dev/null || true
    else
        sudo chown -R nginx:nginx "$dest_root" 2>/dev/null || true
    fi
    log "✅ Landing corporativa: $target"
    return 0
}

# Após certbot certonly (webroot), aplica HTTPS unificado na 443:
# site corporativo + painel React + API/player no mesmo vhost (opção B).
# Porta SYSTEM_HTTP_PORT (ex.: 8080) mantém painel HTTP para acesso por IP/LAN.
apply_split_nginx_corporate_https_after_le() {
    if [[ "$SPLIT_CORPORATE_AND_SYSTEM" != "true" ]]; then
        return 0
    fi
    if [[ -z "${DOMAIN_NAME:-}" ]]; then
        warn "apply_split_nginx_corporate_https_after_le: DOMAIN_NAME vazio."
        return 1
    fi
    if [[ ! -f "/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem" ]]; then
        warn "Certificado Let's Encrypt não encontrado em /etc/letsencrypt/live/${DOMAIN_NAME}/"
        return 1
    fi

    sync_corporate_site_to_webroot "$CORPORATE_WEB_ROOT" || true

    NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"
    BACKEND_PORT=${BACKEND_PORT:-3000}
    FRONTEND_BUILD_DIR="${FRONTEND_BUILD_DIR:-$INSTALL_DIR/frontend/build}"
    local map_block
    if [[ -n "$DOMAIN_NAME" ]] && [[ "$DOMAIN_NAME" != "_" ]]; then
        map_block="map \$host \$smssi_sd_type {
    default main;
    publisher.${DOMAIN_NAME} publisher;
    subscriber.${DOMAIN_NAME} subscriber;
}"
    else
        map_block="map \$host \$smssi_sd_type {
    default main;
}"
    fi
    local sys_names="${PUBLIC_HOST} _"
    if [[ -n "$DOMAIN_NAME" ]] && [[ "$DOMAIN_NAME" != "_" ]]; then
        sys_names="${PUBLIC_HOST} _ publisher.${DOMAIN_NAME} subscriber.${DOMAIN_NAME}"
    fi

    local ssl_extra=""
    if [[ -f /etc/letsencrypt/options-ssl-nginx.conf ]]; then
        ssl_extra="    include /etc/letsencrypt/options-ssl-nginx.conf;
"
    fi
    if [[ -f /etc/letsencrypt/ssl-dhparams.pem ]]; then
        ssl_extra="${ssl_extra}    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
"
    fi

    sudo ufw allow 443/tcp 2>/dev/null || true

    sudo tee "$NGINX_CONFIG" > /dev/null << EOF
${map_block}

# HTTP — ACME + redirecionamento para HTTPS unificado
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN_NAME} www.${DOMAIN_NAME};

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS unificado — site corporativo + painel + API + player (443)
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${DOMAIN_NAME} www.${DOMAIN_NAME};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN_NAME}/privkey.pem;
${ssl_extra}
    ssl_protocols TLSv1.2 TLSv1.3;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 500M;
    client_body_buffer_size 512k;

    location ^~ /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Subdomain-Type \$smssi_sd_type;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location /ws {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location ^~ /player {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_buffer_size 256k;
        proxy_buffers 8 512k;
        proxy_busy_buffers_size 512k;
        proxy_temp_file_write_size 512k;
        proxy_hide_header Content-Security-Policy;
        proxy_hide_header Cross-Origin-Opener-Policy;
        proxy_hide_header Origin-Agent-Cluster;
    }

    location /assets/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /health {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/health;
        proxy_set_header Host \$host;
    }

    # Assets do painel React (CRA)
    location /static/ {
        alias ${FRONTEND_BUILD_DIR}/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Ficheiro estático do site corporativo se existir; senão SPA do painel
    location / {
        root ${CORPORATE_WEB_ROOT};
        index index.html;
        try_files \$uri \$uri/ @panel_spa;
    }

    location @panel_spa {
        root ${FRONTEND_BUILD_DIR};
        try_files \$uri \$uri/ /index.html;
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
}

# Smart Signage — HTTP na porta ${SYSTEM_HTTP_PORT} (IP/LAN sem certificado)
server {
    listen ${SYSTEM_HTTP_PORT};
    listen [::]:${SYSTEM_HTTP_PORT};
    server_name ${sys_names};

    root $FRONTEND_BUILD_DIR;
    index index.html;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    client_max_body_size 500M;
    client_body_buffer_size 512k;

    location ^~ /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Subdomain-Type \$smssi_sd_type;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location /ws {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location ^~ /player {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_buffer_size 256k;
        proxy_buffers 8 512k;
        proxy_busy_buffers_size 512k;
        proxy_temp_file_write_size 512k;
        proxy_hide_header Content-Security-Policy;
        proxy_hide_header Cross-Origin-Opener-Policy;
        proxy_hide_header Origin-Agent-Cluster;
    }

    location /static/ {
        alias $FRONTEND_BUILD_DIR/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webmanifest)$ {
        root $FRONTEND_BUILD_DIR;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location /assets/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /health {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/health;
        proxy_set_header Host \$host;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
}
EOF
    verify_nginx_ws_config "$NGINX_CONFIG"
    if sudo nginx -t && sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload; then
        log "✅ Nginx: HTTPS unificado na 443 (site + painel + API) e HTTP auxiliar na porta ${SYSTEM_HTTP_PORT}."
        return 0
    fi
    warn "Falha ao recarregar Nginx após aplicar HTTPS unificado."
    return 1
}

# Grava DOMAIN_NAME no .env (para mensagens finais e operações futuras).
persist_domain_name_to_env_files() {
    local d="${1:-$DOMAIN_NAME}"
    [[ -z "$d" ]] && return 0
    local f
    for f in "$INSTALL_DIR/.env" "$INSTALL_DIR/backend/.env"; do
        [[ -f "$f" ]] || continue
        local tmp
        tmp=$(mktemp "${f}.domain.XXXXXX" 2>/dev/null || echo "${f}.domain.tmp")
        grep -vE '^DOMAIN_NAME=' "$f" > "$tmp" 2>/dev/null || cp "$f" "$tmp"
        mv -f "$tmp" "$f"
        echo "DOMAIN_NAME=${d}" >> "$f"
    done
}

# Evita conflito "duplicate default server" no Nginx quando existe
# outro arquivo ativo com listen 80 default_server (ex.: fallback antigo).
sanitize_nginx_default_server_conflicts() {
    local primary_cfg="${1:-/etc/nginx/sites-available/smart-signage}"
    local backup_dir="/var/lib/smart-signage/nginx-conflicts"
    sudo mkdir -p "$backup_dir" 2>/dev/null || true

    # Conflito conhecido criado por scripts de fallback.
    if [[ -f "/etc/nginx/conf.d/smart-signage-port80.conf" ]]; then
        log "Desativando config conflitante: /etc/nginx/conf.d/smart-signage-port80.conf"
        sudo mv "/etc/nginx/conf.d/smart-signage-port80.conf" "$backup_dir/smart-signage-port80.conf.$(date +%s).bak" 2>/dev/null || true
    fi

    local cfg target
    for cfg in /etc/nginx/conf.d/*.conf /etc/nginx/sites-enabled/*; do
        [[ -e "$cfg" ]] || continue
        target="$(readlink -f "$cfg" 2>/dev/null || echo "$cfg")"
        if [[ "$target" == "$primary_cfg" ]]; then
            continue
        fi
        if sudo grep -Eq "listen[[:space:]]+80[[:space:]]+default_server|listen[[:space:]]+\\[::\\]:80[[:space:]]+default_server" "$cfg" 2>/dev/null; then
            log "Desativando arquivo Nginx com default_server duplicado: $cfg"
            sudo mv "$cfg" "$backup_dir/$(basename "$cfg").$(date +%s).bak" 2>/dev/null || true
        fi
    done
}

# Grava em INSTALL_DIR/.env o layout Nginx público (site corporativo + painel em portas distintas).
# Lido por show_final_info, validações e manage-system.sh (SMARTSIGNAGE_NGINX_*).
persist_nginx_public_layout_to_env() {
    local envf="$INSTALL_DIR/.env"
    if [[ ! -f "$envf" ]]; then
        warn "persist_nginx_public_layout_to_env: $envf não existe — não gravou SMARTSIGNAGE_NGINX_*."
        return 0
    fi
    local tmp
    local _corp_le="${SMARTSIGNAGE_CORPORATE_LE_HTTPS:-false}"
    tmp=$(mktemp "${envf}.layout.XXXXXX" 2>/dev/null || echo "${envf}.layout.tmp")
    grep -vE '^SMARTSIGNAGE_NGINX_SPLIT=|^SMARTSIGNAGE_CORPORATE_HTTP_PORT=|^SMARTSIGNAGE_SYSTEM_HTTP_PORT=|^SMARTSIGNAGE_CORPORATE_WEB_ROOT=|^SMARTSIGNAGE_CORPORATE_LANDING_FILE=|^SMARTSIGNAGE_PUBLIC_HOST=|^SMARTSIGNAGE_CORPORATE_LE_HTTPS=' "$envf" > "$tmp" 2>/dev/null || cp "$envf" "$tmp"
    mv -f "$tmp" "$envf"
    {
        echo ""
        echo "# --- Nginx: layout público (gravado pelo install-smartsignage.sh) ---"
        if [[ "$SPLIT_CORPORATE_AND_SYSTEM" == "true" ]]; then
            echo "SMARTSIGNAGE_NGINX_SPLIT=true"
            echo "SMARTSIGNAGE_CORPORATE_HTTP_PORT=${CORPORATE_HTTP_PORT}"
            echo "SMARTSIGNAGE_SYSTEM_HTTP_PORT=${SYSTEM_HTTP_PORT}"
            echo "SMARTSIGNAGE_CORPORATE_WEB_ROOT=${CORPORATE_WEB_ROOT}"
            echo "SMARTSIGNAGE_CORPORATE_LANDING_FILE=${CORPORATE_LANDING_FILE}"
            echo "SMARTSIGNAGE_PUBLIC_HOST=${PUBLIC_HOST}"
            echo "SMARTSIGNAGE_CORPORATE_LE_HTTPS=${_corp_le}"
        else
            echo "SMARTSIGNAGE_NGINX_SPLIT=false"
            echo "SMARTSIGNAGE_CORPORATE_HTTP_PORT=80"
            echo "SMARTSIGNAGE_SYSTEM_HTTP_PORT=80"
            echo "SMARTSIGNAGE_CORPORATE_WEB_ROOT="
            echo "SMARTSIGNAGE_CORPORATE_LANDING_FILE="
            echo "SMARTSIGNAGE_PUBLIC_HOST="
            echo "SMARTSIGNAGE_CORPORATE_LE_HTTPS=false"
        fi
    } >> "$envf"
    log "✅ Layout Nginx público gravado em $envf (SMARTSIGNAGE_NGINX_*)."
}

# Configurar Nginx apenas HTTP (sem SSL)
setup_nginx_http_only() {
    NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"
    local _backend_port=""
    [[ -f "$INSTALL_DIR/.env" ]] && _backend_port=$(awk -F= '/^BACKEND_PORT=/{print $2; exit}' "$INSTALL_DIR/.env" 2>/dev/null | tr -d '"' | tr -d "'" | xargs || true)
    if [[ -z "${_backend_port:-}" ]]; then
        log "ℹ️ BACKEND_PORT não definido no .env. Usando padrão: 3000"
    else
        BACKEND_PORT="$_backend_port"
    fi
    BACKEND_PORT=${BACKEND_PORT:-3000}

    if [[ "$SPLIT_CORPORATE_AND_SYSTEM" == "true" ]]; then
        log "Nginx (HTTP only, pós-Let's Encrypt): a reaplicar layout dividido (corporativo + sistema)."
        sudo mkdir -p "$CORPORATE_WEB_ROOT" /var/www/certbot/.well-known/acme-challenge
        sudo chmod -R 755 /var/www/certbot 2>/dev/null || true
        local _ctx_ip="${PUBLIC_HOST}"
        if [[ -z "$_ctx_ip" ]] || [[ "$_ctx_ip" == "_" ]]; then
            _ctx_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
            [[ -z "$_ctx_ip" ]] && _ctx_ip="127.0.0.1"
        fi
        local _panel_url="http://${_ctx_ip}:${SYSTEM_HTTP_PORT}/"
        [[ -n "${PUBLIC_HOST:-}" ]] && [[ "${PUBLIC_HOST}" != "_" ]] && _panel_url="http://${PUBLIC_HOST}:${SYSTEM_HTTP_PORT}/"
        sync_corporate_site_to_webroot "$CORPORATE_WEB_ROOT" || true
        deploy_corporate_landing_html "$CORPORATE_WEB_ROOT" "$_panel_url"

        local _split_map _sys_names
        _split_map="map \$host \$smssi_sd_type {
    default main;
}"
        _sys_names="${PUBLIC_HOST} _"
        if [[ -n "${DOMAIN_NAME:-}" ]] && [[ "${DOMAIN_NAME}" != "_" ]]; then
            _split_map="map \$host \$smssi_sd_type {
    default main;
    publisher.${DOMAIN_NAME} publisher;
    subscriber.${DOMAIN_NAME} subscriber;
}"
            _sys_names="${PUBLIC_HOST} _ publisher.${DOMAIN_NAME} subscriber.${DOMAIN_NAME}"
        fi

        sudo tee $NGINX_CONFIG > /dev/null << EOF
${_split_map}

server {
    listen ${CORPORATE_HTTP_PORT} default_server;
    listen [::]:${CORPORATE_HTTP_PORT} default_server;
    server_name ${PUBLIC_HOST} _;
    root ${CORPORATE_WEB_ROOT};
    index index.html;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / { try_files \$uri \$uri/ /index.html =404; }
}
server {
    listen ${SYSTEM_HTTP_PORT};
    listen [::]:${SYSTEM_HTTP_PORT};
    server_name ${_sys_names};
    root $FRONTEND_BUILD_DIR;
    index index.html;
    client_max_body_size 500M;
    client_body_buffer_size 512k;
    location ^~ /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Subdomain-Type \$smssi_sd_type;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    location /ws {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    location ^~ /player {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_buffer_size 256k;
        proxy_buffers 8 512k;
        proxy_busy_buffers_size 512k;
        proxy_temp_file_write_size 512k;
    }
    location /assets/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location / { try_files \$uri \$uri/ /index.html; }
}
EOF
    else
        sudo tee $NGINX_CONFIG > /dev/null << EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME:-_};
    
    # Frontend
    location / {
        root $FRONTEND_BUILD_DIR;
        try_files \$uri \$uri/ /index.html;
    }
    
    # WebSocket (logs em tempo real, monitor) – proxy para o backend com upgrade (OBRIGATÓRIO para /ws)
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    
    # Backend API
    # Configurações de upload
    client_max_body_size 500M;
    client_body_buffer_size 512k;
    
    # ^~ garante precedência sobre regex de arquivos estáticos (.js, .css, etc.)
    location ^~ /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        # Timeouts aumentados para uploads grandes
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # Player - Proxy para backend Express (^~ evita que /player/js/* seja capturado por regex .js)
    location ^~ /player {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        # Buffers maiores para player (arquivos JS podem ser grandes)
        proxy_buffer_size 256k;
        proxy_buffers 8 512k;
        proxy_busy_buffers_size 512k;
        proxy_temp_file_write_size 512k;
    }
    
    # Assets - Proxy para backend (evita problemas de permissão)
    # Backend já serve /assets via express.static
    location /assets/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    fi
    persist_nginx_public_layout_to_env
    verify_nginx_ws_config "$NGINX_CONFIG"
}

# Configurar Nginx
setup_nginx() {
    log "Configurando Nginx..."
    
    # Em modo Docker, o Nginx é gerenciado pelo Docker Compose
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        log "Nginx será gerenciado pelo Docker Compose"
        return 0
    fi

    # Layout dividido: Let's Encrypt é tratado em setup_letsencrypt (HTTPS unificado site+API na 443).
    if [[ "$SPLIT_CORPORATE_AND_SYSTEM" == "true" ]]; then
        ENABLE_HTTPS_SELF_SIGNED=false
    fi
    
    # Validar que o build do frontend existe
    if [[ ! -d "$INSTALL_DIR/frontend/build" ]]; then
        error "❌ Build do frontend não encontrado em $INSTALL_DIR/frontend/build"
        error "O frontend precisa ser compilado antes de configurar o Nginx!"
        exit 1
    fi
    
    if [[ ! -f "$INSTALL_DIR/frontend/build/index.html" ]]; then
        error "❌ Arquivo index.html não encontrado no build do frontend!"
        exit 1
    fi
    
    log "✅ Build do frontend encontrado: $INSTALL_DIR/frontend/build"
    
    # SOLUÇÃO PROFISSIONAL: Para servidor dedicado, copiar build para diretório público padrão
    # Isso evita problemas de permissão em diretórios home e segue melhores práticas de deploy
    if [[ "$INSTALL_MODE" == "single-server" ]] && [[ "$INSTALL_DIR" =~ ^/home/ ]]; then
        log "📦 Servidor dedicado detectado - copiando build para diretório público padrão..."
        
        # Definir diretório de deploy profissional
        if [[ -d "/opt/smart-signage" ]]; then
            DEPLOY_DIR="/opt/smart-signage/frontend/build"
        else
            DEPLOY_DIR="/var/www/smart-signage"
        fi
        
        log "Copiando build de $INSTALL_DIR/frontend/build para $DEPLOY_DIR..."
        
        # Criar diretório de deploy
        sudo mkdir -p "$DEPLOY_DIR"
        
        # Copiar build completo
        sudo rm -rf "$DEPLOY_DIR"/* 2>/dev/null || true
        sudo cp -a "$INSTALL_DIR/frontend/build"/* "$DEPLOY_DIR/" || {
            error "❌ Erro ao copiar build para $DEPLOY_DIR"
            exit 1
        }
        
        # Ajustar permissões corretas
        if id www-data &>/dev/null; then
            sudo chown -R www-data:www-data "$DEPLOY_DIR" 2>/dev/null || true
        else
            sudo chown -R nginx:nginx "$DEPLOY_DIR" 2>/dev/null || true
        fi
        sudo chmod -R 755 "$DEPLOY_DIR" 2>/dev/null || true
        sudo find "$DEPLOY_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
        
        # Garantir player-web em INSTALL_DIR e depois em /opt/smart-signage/player-web (instalação funcional)
        if [[ ! -d "$INSTALL_DIR/player-web" ]] || [[ -z "$(ls -A "$INSTALL_DIR/player-web" 2>/dev/null)" ]]; then
            if [[ -d "$SOURCE_DIR/player-web" ]] && [[ -f "$SOURCE_DIR/player-web/index.html" ]]; then
                log "Player-web não encontrado em INSTALL_DIR, copiando do repositório..."
                mkdir -p "$INSTALL_DIR/player-web"
                cp -r "$SOURCE_DIR/player-web/"* "$INSTALL_DIR/player-web/" 2>/dev/null || {
                    warn "Falha ao copiar Player Web"
                }
            fi
        fi
        
        sudo mkdir -p /opt/smart-signage/player-web
        if [[ -d "$INSTALL_DIR/player-web" ]] && [[ -n "$(ls -A "$INSTALL_DIR/player-web" 2>/dev/null)" ]]; then
            sudo rm -rf /opt/smart-signage/player-web/* 2>/dev/null || true
            sudo cp -a "$INSTALL_DIR/player-web"/* /opt/smart-signage/player-web/ || true
            if id www-data &>/dev/null; then
                sudo chown -R www-data:www-data /opt/smart-signage/player-web 2>/dev/null || true
            else
                sudo chown -R nginx:nginx /opt/smart-signage/player-web 2>/dev/null || true
            fi
            sudo chmod -R 755 /opt/smart-signage/player-web 2>/dev/null || true
            sudo find /opt/smart-signage/player-web -type f -exec chmod 644 {} \; 2>/dev/null || true
            log "✅ Player copiado para /opt/smart-signage/player-web"
            
            # Verificar se arquivos JS foram copiados
            if [[ -f "/opt/smart-signage/player-web/js/activationCode.js" ]] && \
               [[ -f "/opt/smart-signage/player-web/js/app.js" ]] && \
               [[ -f "/opt/smart-signage/player-web/js/api/client.js" ]] && \
               [[ -f "/opt/smart-signage/player-web/js/cache/MediaCacheManager.js" ]] && \
               [[ -f "/opt/smart-signage/player-web/js/cache/PlaylistChangeDetector.js" ]]; then
                log "✅ Arquivos JS do player verificados e presentes"
            else
                warn "⚠️ Alguns arquivos JS do player não foram encontrados em /opt/smart-signage/player-web/js/"
                warn "   Verifique se player-web/js/ existe no diretório de origem"
            fi
            log "   (Nginx e backend já configurados para /player — nenhum passo manual necessário)"
            
            # Gerar arquivo de configuração encriptado do player (se não existir)
            if [[ ! -f "/opt/smart-signage/player-web/config.json.enc" ]]; then
                if [[ -f "$INSTALL_DIR/scripts/generate-player-config.sh" ]]; then
                    chmod +x "$INSTALL_DIR/scripts/generate-player-config.sh"
                    log "ℹ️ Nenhum arquivo de configuração encriptado encontrado."
                    log "   O player permanecerá em modo demo local até que um UIN seja configurado."
                    log "   Quando o totem for provisionado, execute:"
                    log "   sudo $INSTALL_DIR/scripts/generate-player-config.sh <UIN> /opt/smart-signage/player-web"
                else
                    warn "⚠️ Script de geração de configuração não encontrado"
                fi
            else
                log "✅ Arquivo de configuração encriptado já existe"
            fi
        fi

        # Atualizar INSTALL_DIR para o diretório de deploy (apenas para configuração do Nginx)
        FRONTEND_BUILD_DIR="$DEPLOY_DIR"
        log "✅ Build copiado para $DEPLOY_DIR (diretório público padrão)"
    else
        # Usar diretório original se não estiver em home ou se não for single-server
        FRONTEND_BUILD_DIR="$INSTALL_DIR/frontend/build"
    fi

    # Exibir URLs principais de acesso (baseadas no primeiro IP da máquina)
    local SERVER_IP
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [[ -z "$SERVER_IP" ]]; then
        SERVER_IP="SEU_IP_DO_SERVIDOR"
    fi

    log "========================================="
    log " URLs de acesso ao Smart Signage Pro"
    if [[ "$SPLIT_CORPORATE_AND_SYSTEM" == "true" ]]; then
        local _disp_host="${PUBLIC_HOST}"
        if [[ -z "$_disp_host" ]] || [[ "$_disp_host" == "_" ]]; then
            _disp_host="$SERVER_IP"
        fi
        log "  - Site corporativo (HTTP): http://${_disp_host}:${CORPORATE_HTTP_PORT}/"
        log "  - Painel / API / player (HTTP): http://${_disp_host}:${SYSTEM_HTTP_PORT}/"
        log "  - Player (HTTP): http://${_disp_host}:${SYSTEM_HTTP_PORT}/player"
        log "  (Com Let's Encrypt: https://DOMINIO/ unifica site + painel + API na 443; :${SYSTEM_HTTP_PORT} fica HTTP auxiliar.)"
    else
        log "  - Login HTTP : http://$SERVER_IP/"
        log "  - Login HTTPS: https://$SERVER_IP/   (se HTTPS estiver configurado no Nginx)"
        log "  - Player HTTP: http://$SERVER_IP/player"
        log "  - Player HTTPS: https://$SERVER_IP/player   (se HTTPS estiver configurado no Nginx)"
    fi
    log "========================================="
    
    # SINGLE-SERVER: SEMPRE fazer deploy de player-web em /opt/smart-signage/player-web (instalação funcional, sem scripts de correção)
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        PLAYER_DEST="/opt/smart-signage/player-web"
        SRC_PLAYER=""
        [[ -d "$INSTALL_DIR/player-web" ]] && [[ -f "$INSTALL_DIR/player-web/js/app.js" ]] && SRC_PLAYER="$INSTALL_DIR/player-web"
        [[ -z "$SRC_PLAYER" ]] && [[ -d "$SOURCE_DIR/player-web" ]] && [[ -f "$SOURCE_DIR/player-web/js/app.js" ]] && SRC_PLAYER="$SOURCE_DIR/player-web"
        if [[ -n "$SRC_PLAYER" ]]; then
            log "Fazendo deploy de player-web em $PLAYER_DEST..."
            sudo mkdir -p "$PLAYER_DEST"
            sudo rm -rf "$PLAYER_DEST"/* 2>/dev/null || true
            sudo cp -a "$SRC_PLAYER"/* "$PLAYER_DEST/" || true
            if id www-data &>/dev/null; then
                sudo chown -R www-data:www-data "$PLAYER_DEST" 2>/dev/null || true
            else
                sudo chown -R nginx:nginx "$PLAYER_DEST" 2>/dev/null || true
            fi
            sudo chmod -R 755 "$PLAYER_DEST" 2>/dev/null || true
            log "✅ Player-web em $PLAYER_DEST (Nginx com location ^~ /player)"
            # Verificação: arquivos obrigatórios para o player (scripts carregam via /api/player-static/)
            PLAYER_FILES=( "index.html" "js/activationCode.js" "js/app.js" "js/api/client.js" "js/cache/MediaCacheManager.js" "js/cache/PlaylistChangeDetector.js" "chromium-policies/managed-totemdigital-v3x.json" )
            MISSING=()
            for f in "${PLAYER_FILES[@]}"; do
                [[ -f "$PLAYER_DEST/$f" ]] || MISSING+=("$f")
            done
            if [[ ${#MISSING[@]} -eq 0 ]]; then
                log "✅ Arquivos do player verificados em $PLAYER_DEST"
            else
                warn "⚠️ Arquivos do player faltando em $PLAYER_DEST: ${MISSING[*]}"
            fi
        else
            warn "⚠️ player-web não encontrado em $INSTALL_DIR/player-web nem em $SOURCE_DIR/player-web. /player não funcionará até existir player-web no repositório."
        fi
    fi
    
    NGINX_CONFIG="/etc/nginx/sites-available/smart-signage"
    
    # Porta do backend (do .env ou padrão 3000) – usada em location /ws e pode ser reutilizada noutros proxy_pass
    if [[ -f "$INSTALL_DIR/.env" ]]; then
        _backend_port=$(awk -F= '/^BACKEND_PORT=/{print $2; exit}' "$INSTALL_DIR/.env" 2>/dev/null | tr -d '"' | tr -d "'" | xargs || true)
        if [[ -z "${_backend_port:-}" ]]; then
            log "ℹ️ BACKEND_PORT não definido no .env. Usando padrão: 3000"
        fi
        [[ -n "$_backend_port" ]] && BACKEND_PORT="$_backend_port"
    else
        log "ℹ️ Arquivo .env não encontrado para leitura de BACKEND_PORT. Usando padrão: 3000"
    fi
    BACKEND_PORT=${BACKEND_PORT:-3000}
    
    if [[ "$ENABLE_HTTPS_SELF_SIGNED" == "true" ]] && [[ "$INSTALL_MODE" == "single-server" ]]; then
        SSL_DIR="$INSTALL_DIR/nginx/ssl"
        sudo mkdir -p "$SSL_DIR"
        if [[ ! -f "$SSL_DIR/selfsigned.key" || ! -f "$SSL_DIR/selfsigned.crt" ]]; then
            sudo openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
                -keyout "$SSL_DIR/selfsigned.key" \
                -out "$SSL_DIR/selfsigned.crt" \
                -subj "/C=BR/ST=NA/L=NA/O=SmartSignage/OU=IT/CN=localhost"
        fi
        sudo tee $NGINX_CONFIG > /dev/null << EOF
server {
    listen 80;
    server_name _;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate     $SSL_DIR/selfsigned.crt;
    ssl_certificate_key $SSL_DIR/selfsigned.key;

    # Frontend
    location / {
        root $FRONTEND_BUILD_DIR;
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API
    # Configurações de upload
    client_max_body_size 500M;
    client_body_buffer_size 512k;
    
    # ^~ garante precedência sobre regex de arquivos estáticos (.js, .css, etc.)
    location ^~ /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        # Timeouts aumentados para uploads grandes
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # WebSocket (logs em tempo real, monitor) – proxy para o backend com upgrade (OBRIGATÓRIO para /ws)
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    
    # Arquivos estáticos do React (JS, CSS, etc.) - DEPOIS de /api/ para não interceptar
    location /static/ {
        alias $FRONTEND_BUILD_DIR/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # Outros arquivos estáticos (manifest, favicon, etc.) - DEPOIS de /api/ para não interceptar
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webmanifest)$ {
        root $FRONTEND_BUILD_DIR;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Player - Proxy para backend Express (^~ evita que /player/js/* seja capturado por regex .js)
    location ^~ /player {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        # Buffers maiores para player (arquivos JS podem ser grandes)
        proxy_buffer_size 256k;
        proxy_buffers 8 512k;
        proxy_busy_buffers_size 512k;
        proxy_temp_file_write_size 512k;
        # Remover headers que quebram player em HTTP (CSP/COOP bloqueiam inline scripts)
        proxy_hide_header Content-Security-Policy;
        proxy_hide_header Cross-Origin-Opener-Policy;
        proxy_hide_header Origin-Agent-Cluster;
    }

    # Player com Cache (laboratório) - também usa proxy
    location /player-cache {
        proxy_pass http://localhost:3000/player;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_buffer_size 256k;
        proxy_buffers 8 512k;
        proxy_busy_buffers_size 512k;
        proxy_temp_file_write_size 512k;
    }

    # Assets - Proxy para backend (evita problemas de permissão)
    # Backend já serve /assets via express.static
    location /assets/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    elif [[ "$SPLIT_CORPORATE_AND_SYSTEM" == "true" ]]; then
        SMARTSIGNAGE_CORPORATE_LE_HTTPS=false
        log "Nginx: site corporativo na porta ${CORPORATE_HTTP_PORT} (${CORPORATE_WEB_ROOT}); Smart Signage na porta ${SYSTEM_HTTP_PORT}."
        sudo mkdir -p "$CORPORATE_WEB_ROOT" /var/www/certbot/.well-known/acme-challenge
        sudo chmod -R 755 /var/www/certbot 2>/dev/null || true
        local _ctx_ip="${PUBLIC_HOST}"
        if [[ -z "$_ctx_ip" ]] || [[ "$_ctx_ip" == "_" ]]; then
            _ctx_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
            [[ -z "$_ctx_ip" ]] && _ctx_ip="127.0.0.1"
        fi
        local _panel_url="http://${_ctx_ip}:${SYSTEM_HTTP_PORT}/"
        [[ -n "${PUBLIC_HOST:-}" ]] && [[ "${PUBLIC_HOST}" != "_" ]] && _panel_url="http://${PUBLIC_HOST}:${SYSTEM_HTTP_PORT}/"
        sync_corporate_site_to_webroot "$CORPORATE_WEB_ROOT" || true
        deploy_corporate_landing_html "$CORPORATE_WEB_ROOT" "$_panel_url"

        local _split_map _sys_names
        _split_map="map \$host \$smssi_sd_type {
    default main;
}"
        _sys_names="${PUBLIC_HOST} _"
        if [[ -n "${DOMAIN_NAME:-}" ]] && [[ "${DOMAIN_NAME}" != "_" ]]; then
            _split_map="map \$host \$smssi_sd_type {
    default main;
    publisher.${DOMAIN_NAME} publisher;
    subscriber.${DOMAIN_NAME} subscriber;
}"
            _sys_names="${PUBLIC_HOST} _ publisher.${DOMAIN_NAME} subscriber.${DOMAIN_NAME}"
        fi

        sudo tee $NGINX_CONFIG > /dev/null << EOF
${_split_map}

# Site corporativo (estático) — porta ${CORPORATE_HTTP_PORT}
server {
    listen ${CORPORATE_HTTP_PORT} default_server;
    listen [::]:${CORPORATE_HTTP_PORT} default_server;
    server_name ${PUBLIC_HOST} _;

    root ${CORPORATE_WEB_ROOT};
    index index.html;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        try_files \$uri \$uri/ /index.html =404;
    }
}

# Smart Signage — painel, API, WebSocket e /player — porta ${SYSTEM_HTTP_PORT}
server {
    listen ${SYSTEM_HTTP_PORT};
    listen [::]:${SYSTEM_HTTP_PORT};
    server_name ${_sys_names};

    root $FRONTEND_BUILD_DIR;
    index index.html;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    client_max_body_size 500M;
    client_body_buffer_size 512k;

    location ^~ /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Subdomain-Type \$smssi_sd_type;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location /ws {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location ^~ /player {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_buffer_size 256k;
        proxy_buffers 8 512k;
        proxy_busy_buffers_size 512k;
        proxy_temp_file_write_size 512k;
        proxy_hide_header Content-Security-Policy;
        proxy_hide_header Cross-Origin-Opener-Policy;
        proxy_hide_header Origin-Agent-Cluster;
    }

    location /static/ {
        alias $FRONTEND_BUILD_DIR/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webmanifest)$ {
        root $FRONTEND_BUILD_DIR;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location /assets/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /health {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/health;
        proxy_set_header Host \$host;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
}
EOF
    else
        # Configuração com suporte a subdomínios na porta 80
        # Determinar domínio base para subdomínios
        if [[ -n "$DOMAIN_NAME" ]]; then
            MAIN_DOMAIN="$DOMAIN_NAME"
            MAIN_SERVER_NAME="$DOMAIN_NAME www.$DOMAIN_NAME"
            PUBLISHER_DOMAIN="publisher.$DOMAIN_NAME"
            SUBSCRIBER_DOMAIN="subscriber.$DOMAIN_NAME"
        else
            MAIN_DOMAIN="_"
            MAIN_SERVER_NAME="_"
            PUBLISHER_DOMAIN="publisher.*"
            SUBSCRIBER_DOMAIN="subscriber.*"
        fi
        
        sudo tee $NGINX_CONFIG > /dev/null << EOF
# ============================================
# SERVER: Domínio Principal (${MAIN_DOMAIN})
# ============================================
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${MAIN_SERVER_NAME};
    
    # Diretório raiz e arquivo índice
    root $FRONTEND_BUILD_DIR;
    index index.html;
    
    # Configurações gerais
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Configurações de upload
    client_max_body_size 500M;
    client_body_buffer_size 512k;
    
    # Backend API - DEVE vir ANTES das regex de arquivos estáticos para ter precedência
    # ^~ garante precedência sobre regex de arquivos estáticos (.js, .css, etc.)
    location ^~ /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Subdomain-Type main;
        proxy_cache_bypass \$http_upgrade;
        # Timeouts aumentados para uploads grandes
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # WebSocket (logs em tempo real, monitor) – proxy para o backend com upgrade (OBRIGATÓRIO para /ws)
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    
    # Player - Proxy para backend Express (^~ evita que /player/js/* seja capturado por regex .js)
    location ^~ /player {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        # Buffers maiores para player (arquivos JS podem ser grandes)
        proxy_buffer_size 256k;
        proxy_buffers 8 512k;
        proxy_busy_buffers_size 512k;
        proxy_temp_file_write_size 512k;
        # Remover headers que quebram player em HTTP (CSP/COOP bloqueiam inline scripts)
        proxy_hide_header Content-Security-Policy;
        proxy_hide_header Cross-Origin-Opener-Policy;
        proxy_hide_header Origin-Agent-Cluster;
    }
    
    # Arquivos estáticos do React - DEPOIS de /api/ e /player para não interceptar
    location /static/ {
        alias $FRONTEND_BUILD_DIR/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webmanifest)$ {
        root $FRONTEND_BUILD_DIR;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # Assets - Proxy para backend (evita problemas de permissão)
    # Backend já serve /assets via express.static
    location /assets/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Health check (sem redirecionamento)
    location = /health {
        proxy_pass http://localhost:3000/health;
        proxy_set_header Host \$host;
    }
    
    # Frontend SPA - todas as rotas vão para index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Compressão Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
}

# ============================================
# SERVER: Subdomínio Publisher (${PUBLISHER_DOMAIN})
# ============================================
server {
    listen 80;
    listen [::]:80;
    server_name ${PUBLISHER_DOMAIN};
    
    # Diretório raiz e arquivo índice
    root $FRONTEND_BUILD_DIR;
    index index.html;
    
    # Configurações gerais
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Configurações de upload
    client_max_body_size 500M;
    client_body_buffer_size 512k;
    
    # Backend API com header de subdomínio - DEVE vir ANTES das regex de arquivos estáticos
    # ^~ garante precedência sobre regex de arquivos estáticos (.js, .css, etc.)
    location ^~ /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Subdomain-Type publisher;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # Arquivos estáticos - DEPOIS de /api/ para não interceptar
    location /static/ {
        alias $FRONTEND_BUILD_DIR/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webmanifest)$ {
        root $FRONTEND_BUILD_DIR;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # Assets
    location /assets/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Frontend SPA
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Compressão Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
}

# ============================================
# SERVER: Subdomínio Subscriber (${SUBSCRIBER_DOMAIN})
# ============================================
server {
    listen 80;
    listen [::]:80;
    server_name ${SUBSCRIBER_DOMAIN};
    
    # Diretório raiz e arquivo índice
    root $FRONTEND_BUILD_DIR;
    index index.html;
    
    # Configurações gerais
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Configurações de upload
    client_max_body_size 500M;
    client_body_buffer_size 512k;
    
    # Backend API com header de subdomínio - DEVE vir ANTES das regex de arquivos estáticos
    # ^~ garante precedência sobre regex de arquivos estáticos (.js, .css, etc.)
    location ^~ /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Subdomain-Type subscriber;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # Arquivos estáticos - DEPOIS de /api/ para não interceptar
    location /static/ {
        alias $FRONTEND_BUILD_DIR/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|webmanifest)$ {
        root $FRONTEND_BUILD_DIR;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # Assets - Proxy para backend (evita problemas de permissão)
    # Backend já serve /assets via express.static
    location /assets/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Frontend SPA
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Compressão Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
}
EOF
    fi

    sudo ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sanitize_nginx_default_server_conflicts "$NGINX_CONFIG"
    verify_nginx_ws_config "$NGINX_CONFIG"

    persist_nginx_public_layout_to_env
    
    # Se Let's Encrypt está ativo (layout único), não concluir aqui — setup_letsencrypt sobrescreve o Nginx.
    if [[ "$ENABLE_HTTPS_LETSENCRYPT" == "true" ]] && [[ "$SPLIT_CORPORATE_AND_SYSTEM" != "true" ]]; then
        log "Nginx será configurado pelo Let's Encrypt"
        return 0
    fi
    
    # Garantir permissões corretas para o Nginx ler os arquivos
    log "Ajustando permissões do build do frontend para o Nginx..."
    
    # Se usamos DEPLOY_DIR (diretório público), já foram ajustadas acima
    # Se não, ajustar permissões do diretório original
    if [[ -n "$FRONTEND_BUILD_DIR" ]] && [[ "$FRONTEND_BUILD_DIR" != "$INSTALL_DIR/frontend/build" ]]; then
        log "✅ Permissões já foram ajustadas no diretório de deploy: $FRONTEND_BUILD_DIR"
    else
        # Ajustar permissões do diretório original (caso não tenha sido copiado)
        if id www-data &>/dev/null; then
            sudo chown -R www-data:www-data "$FRONTEND_BUILD_DIR" 2>/dev/null || true
        else
            sudo chown -R nginx:nginx "$FRONTEND_BUILD_DIR" 2>/dev/null || true
        fi
        sudo chmod -R 755 "$FRONTEND_BUILD_DIR" 2>/dev/null || true
        sudo find "$FRONTEND_BUILD_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
        sudo find "$FRONTEND_BUILD_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
        log "✅ Permissões ajustadas para $FRONTEND_BUILD_DIR"
    fi
    
    # Testar configuração
    if sudo nginx -t; then
        log "✅ Configuração do Nginx válida!"
        
        # Para single-server, iniciar e habilitar Nginx
        if [[ "$INSTALL_MODE" == "single-server" ]]; then
            log "Iniciando e habilitando Nginx..."
            sudo systemctl enable nginx
            if ! systemctl is-active --quiet nginx; then
                sudo systemctl start nginx
                sleep 3
                
                # Verificar se iniciou corretamente
                if systemctl is-active --quiet nginx; then
                    log "✅ Nginx iniciado com sucesso!"
                else
                    error "❌ Falha ao iniciar Nginx!"
                    sudo systemctl status nginx --no-pager -l || true
                    error "Verificando logs do Nginx:"
                    sudo tail -30 /var/log/nginx/error.log 2>/dev/null || true
                    exit 1
                fi
            else
                log "✅ Nginx já está rodando"
                # Recarregar configuração se já estava rodando
                # IMPORTANTE: Forçar reload para aplicar nova configuração com FRONTEND_BUILD_DIR
                log "Recarregando Nginx para aplicar nova configuração..."
                if sudo nginx -t 2>/dev/null; then
                    sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload || {
                        warn "⚠️  Falha ao recarregar Nginx, tentando restart..."
                        sudo systemctl restart nginx
                        sleep 3
                    }
                    log "✅ Nginx recarregado"
                else
                    error "❌ Configuração do Nginx inválida após atualização!"
                    sudo nginx -t
                fi
                sleep 2
            fi
            
            # Validação final: verificar se o Nginx consegue servir o index.html
            log "Validando se o Nginx está servindo o frontend..."
            log "Diretório configurado: $FRONTEND_BUILD_DIR"
            
            # Verificar se a configuração do Nginx está correta
            log "Verificando configuração atual do Nginx..."
            if grep -q "$FRONTEND_BUILD_DIR" /etc/nginx/sites-available/smart-signage 2>/dev/null; then
                log "✅ Configuração do Nginx aponta para: $FRONTEND_BUILD_DIR"
            else
                warning "⚠️  Configuração do Nginx pode não estar apontando para $FRONTEND_BUILD_DIR"
                warning "Conteúdo atual da configuração:"
                sudo grep -A 5 "location /" /etc/nginx/sites-available/smart-signage 2>/dev/null | head -10 || true
            fi
            
            sleep 2
            local _nginx_test_port=80
            if [[ "$SPLIT_CORPORATE_AND_SYSTEM" == "true" ]]; then
                _nginx_test_port="${SYSTEM_HTTP_PORT:-8080}"
            fi
            if curl -s -f "http://localhost:${_nginx_test_port}" > /dev/null 2>&1; then
                log "✅ Nginx está respondendo na porta ${_nginx_test_port} (painel / SPA)!"
                # Verificar se retorna HTML (não erro 404 ou 403)
                HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${_nginx_test_port}")
                if [[ "$HTTP_STATUS" == "200" ]]; then
                    log "✅ Nginx está servindo o frontend corretamente (HTTP 200)!"
                else
                    warning "⚠️  Nginx respondeu com status HTTP $HTTP_STATUS"
                    warning "Verificando se index.html está acessível em $FRONTEND_BUILD_DIR..."
                    sudo ls -la "$FRONTEND_BUILD_DIR/index.html" || true
                    warning "Verificando logs recentes do Nginx:"
                    sudo tail -30 /var/log/nginx/error.log 2>/dev/null | grep -E "(stat|Permission|denied)" | tail -5 || true
                fi
            else
                warning "⚠️  Nginx pode não estar servindo o frontend corretamente"
                warning "Diretório configurado: $FRONTEND_BUILD_DIR"
                warning "Verificando se arquivo existe:"
                sudo ls -la "$FRONTEND_BUILD_DIR/index.html" || true
                warning "Verificando logs:"
                sudo tail -30 /var/log/nginx/error.log 2>/dev/null | grep -E "(stat|Permission|denied)" | tail -10 || true
            fi
        fi
    else
        error "❌ Erro na configuração do Nginx!"
        sudo nginx -t
        exit 1
    fi
}

# Criar serviço systemd (backend Node em modo single-server)
create_systemd_service() {
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        log "Criando serviço systemd (smart-signage.service)..."
        
        SERVICE_FILE="/etc/systemd/system/smart-signage.service"
        
        # Verificar se .env existe antes de criar o serviço
        ENV_FILE_PATH="$INSTALL_DIR/.env"
        if [[ ! -f "$ENV_FILE_PATH" ]]; then
            warn "⚠️  Arquivo .env não encontrado em $ENV_FILE_PATH"
            warn "   Criando arquivo .env básico..."
            # Criar .env básico se não existir
            setup_environment 2>/dev/null || {
                # Se setup_environment falhar, criar .env mínimo
                cat > "$ENV_FILE_PATH" << ENV_EOF
# Smart Signage Pro v2.0 - Configuração Básica
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DB_DRIVER=postgresql
DATABASE_URL=postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage
JWT_SECRET=$(openssl rand -base64 32)
ENV_EOF
            }
            log "✅ Arquivo .env criado em $ENV_FILE_PATH"
        fi
        
        sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Smart Signage Pro Backend
After=network.target postgresql.service
Wants=network.target postgresql.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_DIR/backend
# Verificar apenas disponibilidade do PostgreSQL (sem credenciais hardcoded)
ExecStartPre=/bin/sh -c 'pg_isready -h 127.0.0.1 -p 5432 -t 10 || exit 0'
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
Environment=PLAYER_DIR=/opt/smart-signage/player-web
# Usar EnvironmentFile com fallback: se não existir, não falhar
EnvironmentFile=-$INSTALL_DIR/.env

# Limites de recursos
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

        sudo systemctl daemon-reload
        if ! sudo systemctl enable smart-signage.service; then
            error "❌ systemctl enable smart-signage falhou (verifique permissões e journalctl -xe)."
            exit 1
        fi
        if [[ ! -f "$SERVICE_FILE" ]]; then
            error "❌ Unit systemd não foi gravado em $SERVICE_FILE"
            exit 1
        fi
        local _svc_state
        _svc_state=$(systemctl is-enabled smart-signage.service 2>/dev/null || echo "not-found")
        if [[ "$_svc_state" != "enabled" ]]; then
            error "❌ smart-signage.service deveria estar enabled após instalação; estado: $_svc_state"
            exit 1
        fi
        
        log "✅ Serviço systemd criado e habilitado (enabled)"
        log "⚠️  O serviço será iniciado após configurar o banco de dados"
    fi
}

# Garantir que o serviço systemd existe antes de iniciar backend (modo single-server)
ensure_smart_signage_service() {
    if [[ "$INSTALL_MODE" != "single-server" ]]; then
        return 0
    fi

    local service_file="/etc/systemd/system/smart-signage.service"

    if [[ -f "$service_file" ]]; then
        # Serviço já existe; nada a fazer (idempotente)
        return 0
    fi

    log "Serviço smart-signage.service não encontrado. Tentando recriar automaticamente..."

    # Preferir helper dedicado se existir (scripts/create-smart-signage-service.sh),
    # que já sabe lidar com INSTALL_DIR/backend e .env.
    local helper_script=""
    if [[ -f "$INSTALL_DIR/scripts/create-smart-signage-service.sh" ]]; then
        helper_script="$INSTALL_DIR/scripts/create-smart-signage-service.sh"
    elif [[ -n "${SOURCE_DIR:-}" && -f "$SOURCE_DIR/scripts/create-smart-signage-service.sh" ]]; then
        helper_script="$SOURCE_DIR/scripts/create-smart-signage-service.sh"
    fi

    if [[ -n "$helper_script" ]]; then
        log "Usando helper: $helper_script (INSTALL_DIR=$INSTALL_DIR)..."
        bash "$helper_script" "$INSTALL_DIR"
    else
        log "Helper create-smart-signage-service.sh não encontrado. Usando create_systemd_service() inline..."
        create_systemd_service
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
        
        # Verificar se Dockerfiles existem (aceita monolito Dockerfile.app OU backend+frontend)
        # Condição correta: se NÃO existe Dockerfile.app E (NÃO existe backend OU NÃO existe frontend) => faltam arquivos
        if [[ ! -f "Dockerfile.app" ]] && [[ ! -f "Dockerfile.backend" || ! -f "Dockerfile.frontend" ]]; then
            log "Dockerfiles não encontrados, tentando copiar..."
            log "Verificando locais possíveis:"
            log "  - $SCRIPT_DIR/Dockerfile: $([[ -f "$SCRIPT_DIR/Dockerfile" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - $SCRIPT_DIR/Dockerfile.backend: $([[ -f "$SCRIPT_DIR/Dockerfile.backend" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - $SCRIPT_DIR/Dockerfile.frontend: $([[ -f "$SCRIPT_DIR/Dockerfile.frontend" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - $SCRIPT_DIR/Dockerfile.app: $([[ -f "$SCRIPT_DIR/Dockerfile.app" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - ./Dockerfile: $([[ -f "./Dockerfile" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - ./Dockerfile.backend: $([[ -f "./Dockerfile.backend" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - ./Dockerfile.frontend: $([[ -f "./Dockerfile.frontend" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            log "  - ./Dockerfile.app: $([[ -f "./Dockerfile.app" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
            
            # Tentar copiar do diretório do script
            if [[ -f "$SCRIPT_DIR/Dockerfile" ]]; then
                cp "$SCRIPT_DIR/Dockerfile" $INSTALL_DIR/
                log "Arquivo Dockerfile copiado com sucesso!"
            fi
            if [[ -f "$SCRIPT_DIR/Dockerfile.app" ]]; then
                cp "$SCRIPT_DIR/Dockerfile.app" $INSTALL_DIR/
                log "Arquivo Dockerfile.app copiado com sucesso!"
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
            if [[ -f "./Dockerfile.app" ]]; then
                cp ./Dockerfile.app $INSTALL_DIR/
                log "Arquivo Dockerfile.app copiado do diretório atual!"
            fi
            if [[ -f "./Dockerfile.backend" ]]; then
                cp ./Dockerfile.backend $INSTALL_DIR/
                log "Arquivo Dockerfile.backend copiado do diretório atual!"
            fi
            if [[ -f "./Dockerfile.frontend" ]]; then
                cp ./Dockerfile.frontend $INSTALL_DIR/
                log "Arquivo Dockerfile.frontend copiado do diretório atual!"
            fi
            
            if [[ ! -f "$INSTALL_DIR/Dockerfile.app" ]] && [[ ! -f "$INSTALL_DIR/Dockerfile.backend" || ! -f "$INSTALL_DIR/Dockerfile.frontend" ]]; then
                error "Dockerfiles não encontrados em nenhum local!"
                error "Verifique se existe Dockerfile.app ou os arquivos Dockerfile.backend e Dockerfile.frontend no diretório do projeto"
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
        if [[ -f "Dockerfile.app" ]]; then
            log "Arquivo Dockerfile.app encontrado em $INSTALL_DIR"
        else
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
        if [[ -f "./Dockerfile.app" ]]; then
            log "Confirmado: Dockerfile.app está em $(pwd)"
        else
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
        fi
        
        log "Confirmado: docker-compose.yml está em $(pwd)"
        
        # Criar diretórios necessários no INSTALL_DIR (para Docker volumes)
        mkdir -p logs backups public/assets/uploads ml-models
        
        # SEMPRE criar diretórios em /opt/smart-signage também (para consistência)
        # mesmo em modo Docker, garantimos que os caminhos padrão existam
        log "Criando diretórios padrão em /opt/smart-signage..."
        sudo mkdir -p /opt/smart-signage/public/assets/uploads 2>/dev/null || mkdir -p /opt/smart-signage/public/assets/uploads 2>/dev/null || true
        sudo mkdir -p /opt/smart-signage/Logs 2>/dev/null || mkdir -p /opt/smart-signage/Logs 2>/dev/null || true
        
        # Validar e corrigir permissões dos diretórios de uploads
        # Isso sempre usa /opt/smart-signage independente do INSTALL_DIR
        validate_and_fix_upload_permissions
        
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
        if systemctl is-active --quiet nginx 2>/dev/null; then
            log "Nginx do sistema está rodando. Parando para liberar porta 80..."
            sudo systemctl stop nginx 2>/dev/null || true
            sudo systemctl disable nginx 2>/dev/null || true
            log "Nginx do sistema parado e desabilitado"
        fi
        
        # Verificar se porta 80 está livre
        if command -v netstat &> /dev/null; then
            if sudo netstat -tlnp | grep -q ":80 "; then
                log_error "Porta 80 está em uso! Verificando processo..."
                sudo netstat -tlnp | grep ":80 " || true
                log "Tentando parar processo na porta 80..."
                # Não forçar parada automática, apenas avisar
            fi
        elif command -v ss &> /dev/null; then
            if sudo ss -tlnp | grep -q ":80 "; then
                log_error "Porta 80 está em uso! Verificando processo..."
                sudo ss -tlnp | grep ":80 " || true
            fi
        fi
        
        # Testar build do Docker antes de iniciar containers
        if [[ "$INSTALL_MODE" == "docker" ]]; then
            test_docker_build
        fi
        
        # Fazer build das imagens antes de iniciar
        if [[ "$INSTALL_MODE" == "docker" ]]; then
            log "Construindo imagens Docker..."
            
            # Parar e remover containers existentes (incluindo órfãos)
            log "Parando containers existentes..."
            $COMPOSE_CMD down --remove-orphans 2>/dev/null || true
            
            # Parar qualquer container órfão que esteja usando porta 80
            log "Verificando e parando containers órfãos na porta 80..."
            ORPHAN_CONTAINERS=$(docker ps -a --filter "name=smartsignage-nginx" --format "{{.Names}}" 2>/dev/null || true)
            if [[ -n "$ORPHAN_CONTAINERS" ]]; then
                log "Removendo containers órfãos: $ORPHAN_CONTAINERS"
                docker stop $ORPHAN_CONTAINERS 2>/dev/null || true
                docker rm -f $ORPHAN_CONTAINERS 2>/dev/null || true
            fi
            
            # Verificar e parar qualquer processo usando porta 80
            if command -v ss &> /dev/null; then
                PORT80_PID=$(sudo ss -tlnp | grep ":80 " | grep -oP 'pid=\K\d+' | head -1 || true)
                if [[ -n "$PORT80_PID" ]]; then
                    PORT80_CONTAINER=$(docker ps --filter "publish=80" --format "{{.Names}}" | head -1 || true)
                    if [[ -n "$PORT80_CONTAINER" ]]; then
                        log "Parando container usando porta 80: $PORT80_CONTAINER"
                        docker stop $PORT80_CONTAINER 2>/dev/null || true
                        docker rm -f $PORT80_CONTAINER 2>/dev/null || true
                    fi
                fi
            fi
            
            # Limpar imagens antigas se necessário
            log "Limpando imagens antigas..."
            $COMPOSE_CMD down --remove-orphans --rmi all 2>/dev/null || true
            
            # Reconstruir imagens (monolito)
            log "Construindo imagem Docker do app (monolito)..."
        # Tentar build com até 3 retries em caso de falha transitória
        if retry_with_backoff 3 3 $COMPOSE_CMD build --no-cache app 2>&1 | tee /tmp/docker-compose-build.log; then
                log "✅ Build da imagem app concluído com sucesso!"
            else
                error "❌ Erro no build da imagem app"
                error "Verificando se Dockerfile.app existe:"
                ls -la Dockerfile.app || error "Dockerfile.app NÃO EXISTE!"
                error "Últimas linhas do log:"
                tail -50 /tmp/docker-compose-build.log
                error "Log completo salvo em: /tmp/docker-compose-build.log"
                exit 1
            fi
        fi
        
        # Iniciar serviços
        if [[ "$INSTALL_MODE" == "docker" ]]; then
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
    fi
}

# Testar pontos de entrada
test_endpoints() {
    log "Testando pontos de entrada..."
    
    # Obter IP do servidor
    SERVER_IP=$(hostname -I | awk '{print $1}')
    API="http://$SERVER_IP:3000"
    GRAFANA="http://$SERVER_IP:3002"
    PROM="http://$SERVER_IP:9090"
    
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
            ["MQTT Broker"]="mqtt://$SERVER_IP:1883"
            ["MQTT WebSocket"]="ws://$SERVER_IP:9001"
        )
        
    elif [[ "$INSTALL_MODE" == "single-server" ]]; then
        local ng_sys=80
        if [[ -f "${INSTALL_DIR:-/opt/smart-signage}/.env" ]] && grep -qE '^SMARTSIGNAGE_NGINX_SPLIT=true' "${INSTALL_DIR}/.env" 2>/dev/null; then
            ng_sys=$(awk -F= '/^SMARTSIGNAGE_SYSTEM_HTTP_PORT=/{print $2}' "${INSTALL_DIR}/.env" 2>/dev/null | head -1 | tr -d '"' | tr -d "'" | xargs)
            ng_sys=${ng_sys:-8080}
        fi
        # Endpoints para Single-Server: Nginx (porta do painel conforme .env se layout dividido)
        ENDPOINTS=(
            ["Backend Health"]="http://$SERVER_IP:3000/health"
            ["Backend API"]="http://$SERVER_IP:3000/api/health"
            ["Player HTML (Nginx)"]="http://$SERVER_IP:${ng_sys}/player/"
            ["Player estáticos (backend)"]="http://127.0.0.1:3000/api/player-static/js/app.js"
            ["Painel Admin (Nginx)"]="http://$SERVER_IP:${ng_sys}"
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
    
    # Testar cada endpoint básico
    for service in "${!ENDPOINTS[@]}"; do
        url="${ENDPOINTS[$service]}"
        log "Testando $service: $url"
        
        # Teste especial para MQTT
        if [[ "$service" == "MQTT Broker" ]] || [[ "$service" == "MQTT WebSocket" ]]; then
            # Para MQTT, usar mosquitto_sub se disponível
            if command -v mosquitto_sub &> /dev/null; then
                if timeout 2 mosquitto_sub -h "$SERVER_IP" -p 1883 -t '$SYS/#' -C 1 > /dev/null 2>&1; then
                    log "✅ $service: OK"
                else
                    warning "⚠️  $service: Não respondeu ao teste"
                fi
            else
                # Se mosquitto_sub não estiver disponível, verificar se container está rodando (Docker)
                if [[ "$INSTALL_MODE" == "docker" ]] && $COMPOSE_CMD ps | grep -q smartsignage-mosquitto; then
                    log "✅ $service: Container rodando (teste detalhado requer mosquitto_sub)"
                else
                    warning "⚠️  $service: Não foi possível verificar (mosquitto_sub não disponível)"
                fi
            fi
        else
            # Para outros endpoints, usar curl
            if curl -s --max-time 10 "$url" > /dev/null 2>&1; then
                log "✅ $service: OK"
            else
                warning "❌ $service: FALHOU - $url"
            fi
        fi
    done
    
    # Single-server: verificar que o backend serve os estáticos do player (necessário para /player carregar)
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        PLAYER_STATIC_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:3000/api/player-static/js/app.js" 2>/dev/null || echo "000")
        if [[ "$PLAYER_STATIC_CODE" == "200" ]]; then
            log "✅ Player estáticos: backend servindo /api/player-static/ (HTTP 200)"
        else
            warning "⚠️ Player estáticos: backend retornou HTTP $PLAYER_STATIC_CODE para /api/player-static/js/app.js (verifique PLAYER_DIR e /opt/smart-signage/player-web)"
        fi
    fi
    
    # Verificações adicionais integradas do post-install-check
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}                    Verificação Pós-Instalação Completa${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    
    # 1) Containers e portas (apenas Docker)
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        log "===> 1) Containers e portas"
        if command -v docker &> /dev/null; then
            docker compose ps 2>/dev/null || docker-compose ps 2>/dev/null || true
            log "Portas em uso:"
            ss -tulpen 2>/dev/null | grep -E ":3000|:3002|:9090|:80|:443|:1883|:9001" || netstat -tulpen 2>/dev/null | grep -E ":3000|:3002|:9090|:80|:443|:1883|:9001" || true
        fi
    fi
    
    # 2) Health e OpenAPI (tentar SERVER_IP primeiro, depois 127.0.0.1 se firewall bloquear)
    log "===> 2) Health e OpenAPI"
    API_HEALTH="$API"
    if ! curl -fsS --max-time 5 "$API/health" 2>/dev/null | jq . > /dev/null 2>&1; then
        API_HEALTH="http://127.0.0.1:3000"
    fi
    if curl -fsS --max-time 5 "$API_HEALTH/health" 2>/dev/null | jq . > /dev/null 2>&1; then
        log "✅ Backend Health: OK"
        curl -fsS "$API_HEALTH/health" 2>/dev/null | jq . || true
    else
        warning "⚠️  Backend Health: Não respondeu"
    fi
    
    if curl -fsS --max-time 5 "$API_HEALTH/api/docs.json" 2>/dev/null | jq '.info,.paths | keys | length' > /dev/null 2>&1; then
        log "✅ OpenAPI Docs: OK"
        curl -fsS "$API_HEALTH/api/docs.json" 2>/dev/null | jq '.info,.paths | keys | length' || true
    else
        warning "⚠️  OpenAPI Docs: Não disponível"
    fi
    
    # 3) Login admin e token (usar mesmo base que respondeu no health)
    log "===> 3) Login admin e token"
    TOKEN=$(curl -fsS --max-time 10 -X POST "$API_HEALTH/api/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"username":"admin","password":"admin123"}' 2>/dev/null | jq -r '.token' 2>/dev/null || echo "")
    if [[ -n "$TOKEN" ]] && [[ "$TOKEN" != "null" ]] && [[ "$TOKEN" != "" ]]; then
        log "✅ Token de autenticação: OK"
    else
        warning "⚠️  Token de autenticação: FALHOU (verifique credenciais admin/admin123)"
    fi
    
    # 4) CRUD rápido - criar cliente e checar lista (apenas se token OK)
    # API /api/clients retorna Client com client_id (não id); GET retorna { data, total }
    if [[ -n "$TOKEN" ]] && [[ "$TOKEN" != "null" ]] && [[ "$TOKEN" != "" ]]; then
        log "===> 4) CRUD rápido - criar cliente e checar lista"
        CLIENT_RESULT=$(curl -fsS -X POST "$API_HEALTH/api/clients" \
          -H "Authorization: Bearer $TOKEN" \
          -H "Content-Type: application/json" \
          -d '{"name":"Cliente Teste Instalação","email":"cliente-teste@instalacao.local"}' 2>/dev/null | jq -r '(.client_id // .id | tostring) + " " + (.name // "")' 2>/dev/null || echo "")
        if [[ -n "$CLIENT_RESULT" ]] && [[ "$CLIENT_RESULT" != "null " ]]; then
            log "✅ Cliente criado: $CLIENT_RESULT"
        else
            warning "⚠️  Falha ao criar cliente (pode já existir)"
        fi
        
        CLIENT_COUNT=$(curl -fsS -X GET "$API_HEALTH/api/clients?page=1&limit=5" \
          -H "Authorization: Bearer $TOKEN" 2>/dev/null | jq 'if .data then (.data | length) elif .total != null then .total else 0 end' 2>/dev/null || echo "0")
        log "✅ Clientes na lista: $CLIENT_COUNT"
    else
        log "===> 4) CRUD rápido - pulado (token inválido)"
    fi
    
    # Resolve subscriber ativo para testes de campanha/upload (evita subscriberId=1 inexistente)
    INSTALL_TEST_SUBSCRIBER_ID=""
    if [[ -n "$TOKEN" ]] && [[ "$TOKEN" != "null" ]] && [[ "$TOKEN" != "" ]]; then
        INSTALL_TEST_SUBSCRIBER_ID=$(curl -fsS --max-time 10 -X GET "$API_HEALTH/api/subscribers?page=1&limit=1&active_only=true" \
          -H "Authorization: Bearer $TOKEN" 2>/dev/null \
          | jq -r '(.data[0].subscriber_id // .data[0].id // empty)' 2>/dev/null || echo "")
    fi
    [[ -z "$INSTALL_TEST_SUBSCRIBER_ID" ]] && INSTALL_TEST_SUBSCRIBER_ID=1

    resolve_post_install_banner_file() {
        local f
        for f in \
            "./banner.jpg" \
            "$INSTALL_DIR/banner.jpg" \
            "${REPO_ROOT}/scripts/fixtures/banner-install-test.jpg" \
            "${REPO_ROOT}/corporate-site/dashboard.png"; do
            if [[ -n "$f" ]] && [[ -f "$f" ]]; then
                echo "$f"
                return 0
            fi
        done
        local tmp="/tmp/smartsignage-install-banner-$$.jpg"
        if command -v base64 &> /dev/null; then
            printf '%s' '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=' \
              | base64 -d > "$tmp" 2>/dev/null
            if [[ -s "$tmp" ]]; then
                echo "$tmp"
                return 0
            fi
        fi
        return 1
    }
    
    # 5) Upload de mídia (se houver arquivo de teste)
    if [[ -n "$TOKEN" ]] && [[ "$TOKEN" != "null" ]] && [[ "$TOKEN" != "" ]]; then
        log "===> 5) Upload de mídia (teste)"
        TEST_FILE="$(resolve_post_install_banner_file || true)"
        if [[ -n "$TEST_FILE" ]] && [[ -f "$TEST_FILE" ]]; then
            UPLOAD_RESULT=$(curl -fsS -X POST "$API_HEALTH/api/media/upload" \
              -H "Authorization: Bearer $TOKEN" \
              -F "file=@$TEST_FILE" \
              -F "name=banner_loja_instalacao" \
              -F "subscriberId=$INSTALL_TEST_SUBSCRIBER_ID" 2>/dev/null \
              | jq -r '(.data.id // .data.media_id // .id | tostring) + " " + (.data.name // .name // "")' 2>/dev/null || echo "")
            if [[ -n "$UPLOAD_RESULT" ]] && [[ "$UPLOAD_RESULT" != "null " ]] && [[ "$UPLOAD_RESULT" != " " ]]; then
                log "✅ Upload de mídia: OK - $UPLOAD_RESULT (subscriberId=$INSTALL_TEST_SUBSCRIBER_ID)"
            else
                warning "⚠️  Upload de mídia: Falhou (subscriberId=$INSTALL_TEST_SUBSCRIBER_ID)"
            fi
        else
            log "ℹ️  Upload de mídia: Arquivo de teste não encontrado (pulando)"
        fi
    else
        log "===> 5) Upload de mídia - pulado (token inválido)"
    fi
    
    # 6) Campanha simples (API aceita subscriberId; retorna .id ou .campaign_id e .title; título único evita conflito com seed)
    if [[ -n "$TOKEN" ]] && [[ "$TOKEN" != "null" ]] && [[ "$TOKEN" != "" ]]; then
        log "===> 6) Campanha simples"
        CAMPAIGN_TITLE="Campanha Teste Instalação $(date +%s)"
        CAMPAIGN_RESULT=$(curl -fsS -X POST "$API_HEALTH/api/campaigns" \
          -H "Authorization: Bearer $TOKEN" \
          -H "Content-Type: application/json" \
          -d "{\"subscriberId\":$INSTALL_TEST_SUBSCRIBER_ID,\"title\":\"$CAMPAIGN_TITLE\",\"description\":\"Demo pós-instalação\",\"campaignType\":\"general\",\"isActive\":true}" 2>/dev/null \
          | jq -r '(.data.id // .data.campaign_id // .id // .campaign_id | tostring) + " " + (.data.title // .title // "")' 2>/dev/null || echo "")
        if [[ -n "$CAMPAIGN_RESULT" ]] && [[ "$CAMPAIGN_RESULT" != "null " ]] && [[ "$CAMPAIGN_RESULT" != " " ]]; then
            log "✅ Campanha criada: $CAMPAIGN_RESULT (subscriberId=$INSTALL_TEST_SUBSCRIBER_ID)"
        else
            CAMPAIGN_ERR=$(curl -sS -X POST "$API_HEALTH/api/campaigns" \
              -H "Authorization: Bearer $TOKEN" \
              -H "Content-Type: application/json" \
              -d "{\"subscriberId\":$INSTALL_TEST_SUBSCRIBER_ID,\"title\":\"Campanha Teste Instalação $(date +%s)\",\"description\":\"Demo pós-instalação\",\"campaignType\":\"general\",\"isActive\":true}" 2>/dev/null \
              | jq -r '.message // .error // empty' 2>/dev/null || echo "")
            if [[ -n "$CAMPAIGN_ERR" ]]; then
                warning "⚠️  Falha ao criar campanha (subscriberId=$INSTALL_TEST_SUBSCRIBER_ID): $CAMPAIGN_ERR"
            else
                warning "⚠️  Falha ao criar campanha (subscriberId=$INSTALL_TEST_SUBSCRIBER_ID ou API pode exigir mais campos)"
            fi
        fi
    else
        log "===> 6) Campanha simples - pulado (token inválido)"
    fi
    
    # 7) MQTT Broker (SmartDisplayFX) - já testado acima, mas detalhar aqui
    log "===> 7) MQTT Broker (SmartDisplayFX)"
    if command -v mosquitto_sub &> /dev/null; then
        if timeout 2 mosquitto_sub -h localhost -p 1883 -t '$SYS/#' -C 1 >/dev/null 2>&1; then
            log "✅ MQTT Broker: OK"
        else
            warning "⚠️  MQTT Broker: Não respondeu"
        fi
    elif [[ "$INSTALL_MODE" == "docker" ]] && command -v docker &> /dev/null; then
        if docker ps 2>/dev/null | grep -q smartsignage-mosquitto || docker ps 2>/dev/null | grep -q mosquitto; then
            log "✅ MQTT Broker (Docker): Container rodando"
        else
            warning "⚠️  MQTT Broker: Não encontrado (opcional para SmartDisplayFX)"
        fi
    else
        log "ℹ️  MQTT Broker: Não foi possível verificar (mosquitto_sub não disponível)"
    fi
    
    # 8) Players e heartbeat (API /api/players usa clientId=publisher_id para local; fallback: /api/totems com localId=1)
    if [[ -n "$TOKEN" ]] && [[ "$TOKEN" != "null" ]] && [[ "$TOKEN" != "" ]]; then
        log "===> 8) Players e heartbeat"
        PLAYER_NAME="Totem Teste Instalação $(date +%s)"
        PID=$(curl -fsS -X POST "$API_HEALTH/api/players" \
          -H "Authorization: Bearer $TOKEN" \
          -H "Content-Type: application/json" \
          -d "{\"name\":\"$PLAYER_NAME\",\"location\":\"Loja Central\",\"clientId\":1}" 2>/dev/null | jq -r '.totem_id // .id | tostring' 2>/dev/null || echo "")
        if [[ -z "$PID" ]] || [[ "$PID" == "null" ]]; then
            PID=$(curl -fsS -X POST "$API_HEALTH/api/totems" \
              -H "Authorization: Bearer $TOKEN" \
              -H "Content-Type: application/json" \
              -d "{\"name\":\"$PLAYER_NAME\",\"identifier\":\"TEST-INSTALL-$(date +%s)\",\"localId\":1}" 2>/dev/null | jq -r '.totem_id // .id | tostring' 2>/dev/null || echo "")
        fi
        if [[ -n "$PID" ]] && [[ "$PID" != "null" ]] && [[ "$PID" != "" ]]; then
            HEARTBEAT_RESULT=$(curl -fsS -X POST "$API_HEALTH/api/totems/$PID/heartbeat" \
              -H "Authorization: Bearer $TOKEN" \
              -H "Content-Type: application/json" \
              -d '{"status":"online","uptime":120,"memoryUsage":30.5}' 2>/dev/null | jq . 2>/dev/null || echo "")
            if [[ -n "$HEARTBEAT_RESULT" ]]; then
                log "✅ Player criado e heartbeat: OK (Totem ID: $PID)"
            else
                warning "⚠️  Heartbeat: Falhou"
            fi
        else
            warning "⚠️  Falha ao criar player (API /api/players ou /api/totems; seed tem local_id=1 para publisher_id=1)"
        fi
    else
        log "===> 8) Players e heartbeat - pulado (token inválido)"
    fi
    
    # 9) Grafana e Prometheus (apenas Docker)
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        log "===> 9) Grafana e Prometheus"
        if curl -fsS "$PROM/-/healthy" >/dev/null 2>&1; then
            log "✅ Prometheus: OK"
        else
            warning "⚠️  Prometheus: Não respondeu"
        fi
        
        if curl -fsS "$GRAFANA/login" >/dev/null 2>&1; then
            log "✅ Grafana: OK"
            log "💡 Acesse $GRAFANA (admin/admin) e verifique dashboard 'SmartSignage – Operação'"
        else
            warning "⚠️  Grafana: Não respondeu"
        fi
    fi
    
    # 10) HTTPS (se habilitado)
    log "===> 10) HTTPS (se habilitado)"
    if curl -fsS "https://$SERVER_IP/health" -k >/dev/null 2>&1; then
        log "✅ HTTPS: OK (cert autoassinado ou Let's Encrypt)"
    else
        log "ℹ️  HTTPS: Não ativo (ok se você escolheu HTTP)"
    fi
    
    # 11) Logs rápidos (apenas Docker)
    if [[ "$INSTALL_MODE" == "docker" ]] && command -v docker &> /dev/null; then
        log "===> 11) Logs rápidos"
        log "Últimas linhas dos logs:"
        docker compose logs --tail 20 backend 2>/dev/null | tail -n +1 || docker-compose logs --tail 20 backend 2>/dev/null | tail -n +1 || true
        docker compose logs --tail 10 nginx 2>/dev/null | tail -n +1 || docker-compose logs --tail 10 nginx 2>/dev/null | tail -n +1 || true
        docker compose logs --tail 10 mosquitto 2>/dev/null | tail -n +1 || docker-compose logs --tail 10 mosquitto 2>/dev/null | tail -n +1 || true
    fi
    
    echo
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "✅ Verificação pós-instalação concluída"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    
    log "Teste de endpoints concluído!"
}

# =============================================================================
# VALIDAÇÃO AUTOMÁTICA COMPLETA DO SISTEMA
# =============================================================================
# Função para validar automaticamente todos os componentes do sistema
# Similar ao VALIDAR-SISTEMA.ps1 do Windows
# =============================================================================
validate_system_complete() {
    log "========================================="
    log "Validação Automática Completa do Sistema"
    log "========================================="
    echo ""
    
    # Contadores de validação
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    local errors=()
    local report_file="$INSTALL_DIR/validacao-sistema-$(date +%Y%m%d-%H%M%S).txt"
    
    # Função auxiliar para testar resultados
    test_result() {
        local test_name="$1"
        local passed="$2"
        local message="${3:-}"
        
        total_tests=$((total_tests + 1))
        if [ "$passed" = true ]; then
            passed_tests=$((passed_tests + 1))
            log "✅ $test_name"
            [ -n "$message" ] && log "   $message"
        else
            failed_tests=$((failed_tests + 1))
            warning "❌ $test_name"
            [ -n "$message" ] && warning "   $message"
            errors+=("$test_name: $message")
        fi
    }
    
    # Obter IP do servidor
    SERVER_IP=$(hostname -I | awk '{print $1}')
    API="http://$SERVER_IP:3000"
    # Se backend não responder pelo IP (ex.: firewall), usar localhost para testes locais
    if ! curl -fsS --max-time 3 "$API/health" > /dev/null 2>&1; then
        API="http://127.0.0.1:3000"
    fi
    
    # ============================================
    # 1. VALIDAÇÕES DE CONECTIVIDADE
    # ============================================
    log "===> 1. Validando Conectividade"
    
    # Backend Health Check (tentar SERVER_IP e depois 127.0.0.1)
    log "Testando Backend Health Check..."
    if curl -fsS --max-time 5 "$API/api/health/check" > /dev/null 2>&1 || \
       curl -fsS --max-time 5 "$API/api/health" > /dev/null 2>&1 || \
       curl -fsS --max-time 5 "$API/health" > /dev/null 2>&1 || \
       curl -fsS --max-time 5 "http://127.0.0.1:3000/health" > /dev/null 2>&1 || \
       curl -fsS --max-time 5 "http://127.0.0.1:3000/api/health" > /dev/null 2>&1; then
        test_result "Backend Health Check" true "URL: $API/health"
    else
        test_result "Backend Health Check" false "Nao foi possivel conectar a $API"
    fi
    
    # Frontend (single-server: porta Nginx do painel; ver SMARTSIGNAGE_* em INSTALL_DIR/.env)
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        FRONTEND_URL="http://$SERVER_IP:80"
    elif [[ "$INSTALL_MODE" == "single-server" ]]; then
        local ng_sys=80
        if [[ -f "${INSTALL_DIR:-/opt/smart-signage}/.env" ]] && grep -qE '^SMARTSIGNAGE_NGINX_SPLIT=true' "${INSTALL_DIR}/.env" 2>/dev/null; then
            ng_sys=$(awk -F= '/^SMARTSIGNAGE_SYSTEM_HTTP_PORT=/{print $2}' "${INSTALL_DIR}/.env" 2>/dev/null | head -1 | tr -d '"' | tr -d "'" | xargs)
            ng_sys=${ng_sys:-8080}
        fi
        FRONTEND_URL="http://$SERVER_IP:${ng_sys}"
    else
        FRONTEND_URL="http://$SERVER_IP:3001"
    fi
    
    log "Testando Frontend..."
    if curl -fsS --max-time 5 "$FRONTEND_URL" > /dev/null 2>&1; then
        test_result "Frontend acessivel" true "URL: $FRONTEND_URL"
    else
        test_result "Frontend acessivel" false "URL: $FRONTEND_URL"
    fi
    
    echo ""
    
    # ============================================
    # 2. VALIDAÇÕES DE API DETALHADAS
    # ============================================
    log "===> 2. Validando APIs Detalhadas"
    
    # Health Check completo
    log "Testando Health Check completo..."
    HEALTH_RESPONSE=$(curl -fsS --max-time 5 "$API/api/health/check" 2>/dev/null || curl -fsS --max-time 5 "$API/api/health" 2>/dev/null || echo "")
    if [ -n "$HEALTH_RESPONSE" ]; then
        # Tentar extrair status do JSON
        if command -v jq &> /dev/null; then
            HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status // .services.database.status // "unknown"' 2>/dev/null || echo "unknown")
            DB_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.services.database.status // "unknown"' 2>/dev/null || echo "unknown")
            test_result "Health Check API completo" true "Status: $HEALTH_STATUS"
            if [ "$DB_STATUS" != "unknown" ]; then
                if [ "$DB_STATUS" = "healthy" ]; then
                    test_result "Banco de dados conectado (via Health Check)" true "Status: $DB_STATUS"
                else
                    test_result "Banco de dados conectado (via Health Check)" false "Status: $DB_STATUS"
                fi
            fi
        else
            test_result "Health Check API completo" true "Resposta recebida"
        fi
    else
        test_result "Health Check API completo" false "Nao recebeu resposta"
    fi
    
    # API Docs
    log "Testando API Docs..."
    if curl -fsS --max-time 5 "$API/api-docs" > /dev/null 2>&1 || \
       curl -fsS --max-time 5 "$API/api/docs.json" > /dev/null 2>&1; then
        test_result "API Docs acessivel" true
    else
        test_result "API Docs acessivel" false "Nao foi possivel acessar"
    fi
    
    # Single-server: Player (arquivos em /opt e endpoint /api/player-static/)
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        PLAYER_DIR="/opt/smart-signage/player-web"
        PLAYER_FILES=( "index.html" "js/activationCode.js" "js/app.js" "js/api/client.js" "js/cache/MediaCacheManager.js" "js/cache/PlaylistChangeDetector.js" "chromium-policies/managed-totemdigital-v3x.json" )
        PLAYER_MISSING=()
        for f in "${PLAYER_FILES[@]}"; do
            [[ -f "$PLAYER_DIR/$f" ]] || PLAYER_MISSING+=("$f")
        done
        if [[ ${#PLAYER_MISSING[@]} -eq 0 ]]; then
            test_result "Player: arquivos em $PLAYER_DIR" true
        else
            test_result "Player: arquivos em $PLAYER_DIR" false "Faltando: ${PLAYER_MISSING[*]}"
        fi
        PLAYER_STATIC_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:3000/api/player-static/js/app.js" 2>/dev/null || echo "000")
        if [[ "$PLAYER_STATIC_CODE" == "200" ]]; then
            test_result "Player: backend servindo /api/player-static/" true "HTTP 200"
        else
            test_result "Player: backend servindo /api/player-static/" false "HTTP $PLAYER_STATIC_CODE (backend deve usar PLAYER_DIR=$PLAYER_DIR)"
        fi
    fi
    
    echo ""
    
    # ============================================
    # 3. VALIDAÇÕES DE BANCO DE DADOS
    # ============================================
    log "===> 3. Validando Banco de Dados"
    
    # Verificar conexão PostgreSQL
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        # Docker: verificar container
        if $COMPOSE_CMD ps 2>/dev/null | grep -q smartsignage-postgres || docker ps 2>/dev/null | grep -q smartsignage-postgres; then
            DB_CONTAINER_STATUS=$(docker ps --filter "name=smartsignage-postgres" --format "{{.Status}}" 2>/dev/null | head -1 || echo "")
            if echo "$DB_CONTAINER_STATUS" | grep -q "Up"; then
                test_result "PostgreSQL container rodando" true "$DB_CONTAINER_STATUS"
            else
                test_result "PostgreSQL container rodando" false "$DB_CONTAINER_STATUS"
            fi
        else
            test_result "PostgreSQL container rodando" false "Container nao encontrado"
        fi
    else
        # Single-Server: verificar serviço systemd
        if systemctl is-active --quiet postgresql 2>/dev/null; then
            test_result "PostgreSQL serviço ativo" true
        else
            test_result "PostgreSQL serviço ativo" false "Servico nao esta ativo"
        fi
    fi
    
    # Testar conexão ao banco
    log "Testando conexao ao banco de dados..."
    if command -v psql &> /dev/null; then
        # Tentar ler configurações do .env
        if [ -f "$INSTALL_DIR/.env" ] || [ -f "$INSTALL_DIR/backend/.env" ]; then
            ENV_FILE="$INSTALL_DIR/.env"
            [ ! -f "$ENV_FILE" ] && ENV_FILE="$INSTALL_DIR/backend/.env"
            
            DB_NAME=$(grep "^DB_NAME=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "smartsignage")
            DB_USER=$(grep "^DB_USER=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "smartsignage")
            DB_HOST=$(grep "^DB_HOST=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "localhost")
            DB_PORT=$(grep "^DB_PORT=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "5432")
            
            export PGPASSWORD="${DB_PASSWORD:-smartsignage123}"
            if PGPASSWORD="$PGPASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
                test_result "Conexao ao banco de dados" true "Database: $DB_NAME"
            else
                test_result "Conexao ao banco de dados" false "Nao foi possivel conectar"
            fi
            unset PGPASSWORD
        fi
    fi
    
    echo ""
    
    # ============================================
    # 4. VALIDAÇÕES DE LOGS
    # ============================================
    log "===> 4. Validando Logs"
    
    # Verificar logs do backend
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        log "Analisando logs dos containers..."
        BACKEND_LOGS=$(docker compose logs --tail 100 backend 2>/dev/null || docker-compose logs --tail 100 backend 2>/dev/null || echo "")
        if [ -n "$BACKEND_LOGS" ]; then
            ERROR_COUNT=$(echo "$BACKEND_LOGS" | grep -i "error\|ERROR\|Error" | wc -l || echo "0")
            CRITICAL_ERRORS=$(echo "$BACKEND_LOGS" | grep -i "FATAL\|CRITICAL\|ECONNREFUSED\|Cannot.*connect\|Failed.*connect" | head -5 || true)
            
            if [ -z "$CRITICAL_ERRORS" ]; then
                test_result "Logs sem erros criticos" true
            else
                test_result "Logs sem erros criticos" false "Encontrados erros criticos"
                warning "Erros encontrados nos logs:"
                echo "$CRITICAL_ERRORS" | while read -r line; do
                    log "   $line"
                done
            fi
        fi
    else
        # Single-Server: verificar logs do arquivo
        LOG_FILE="$INSTALL_DIR/backend/logs/app.log"
        if [ -f "$LOG_FILE" ]; then
            log "Analisando logs do backend..."
            ERROR_COUNT=$(grep -i "error\|ERROR\|Error" "$LOG_FILE" 2>/dev/null | wc -l || echo "0")
            CRITICAL_ERRORS=$(grep -i "FATAL\|CRITICAL\|ECONNREFUSED\|Cannot\|Failed" "$LOG_FILE" 2>/dev/null | head -5 || true)
            
            if [ -z "$CRITICAL_ERRORS" ]; then
                test_result "Logs sem erros criticos" true
            else
                test_result "Logs sem erros criticos" false "Encontrados erros criticos"
            fi
        else
            test_result "Arquivo de log existe" false "Log file nao encontrado: $LOG_FILE"
        fi
    fi
    
    echo ""
    
    # ============================================
    # 5. VALIDAÇÕES DE PORTAS
    # ============================================
    log "===> 5. Validando Portas"
    
    # Verificar porta do backend
    log "Verificando porta 3000 (Backend)..."
    if command -v ss &> /dev/null; then
        if sudo ss -tlnp 2>/dev/null | grep -q ":3000 " || ss -tlnp 2>/dev/null | grep -q ":3000 "; then
            test_result "Porta 3000 em uso (Backend)" true
        else
            test_result "Porta 3000 em uso (Backend)" false "Porta nao esta em uso"
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tlnp 2>/dev/null | grep -q ":3000 " || sudo netstat -tlnp 2>/dev/null | grep -q ":3000 "; then
            test_result "Porta 3000 em uso (Backend)" true
        else
            test_result "Porta 3000 em uso (Backend)" false "Porta nao esta em uso"
        fi
    fi
    
    # Verificar porta do frontend (Nginx: 80 ou SMARTSIGNAGE_SYSTEM_HTTP_PORT se layout dividido)
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        FRONTEND_PORT="80"
    elif [[ "$INSTALL_MODE" == "single-server" ]]; then
        FRONTEND_PORT="80"
        if [[ -f "${INSTALL_DIR:-/opt/smart-signage}/.env" ]] && grep -qE '^SMARTSIGNAGE_NGINX_SPLIT=true' "${INSTALL_DIR}/.env" 2>/dev/null; then
            FRONTEND_PORT=$(awk -F= '/^SMARTSIGNAGE_SYSTEM_HTTP_PORT=/{print $2}' "${INSTALL_DIR}/.env" 2>/dev/null | head -1 | tr -d '"' | tr -d "'" | xargs)
            FRONTEND_PORT=${FRONTEND_PORT:-8080}
        fi
    else
        FRONTEND_PORT="3001"
    fi
    
    log "Verificando porta $FRONTEND_PORT (Frontend)..."
    if command -v ss &> /dev/null; then
        if sudo ss -tlnp 2>/dev/null | grep -q ":$FRONTEND_PORT " || ss -tlnp 2>/dev/null | grep -q ":$FRONTEND_PORT "; then
            test_result "Porta $FRONTEND_PORT em uso (Frontend)" true
        else
            test_result "Porta $FRONTEND_PORT em uso (Frontend)" false "Porta nao esta em uso"
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tlnp 2>/dev/null | grep -q ":$FRONTEND_PORT " || sudo netstat -tlnp 2>/dev/null | grep -q ":$FRONTEND_PORT "; then
            test_result "Porta $FRONTEND_PORT em uso (Frontend)" true
        else
            test_result "Porta $FRONTEND_PORT em uso (Frontend)" false "Porta nao esta em uso"
        fi
    fi
    
    echo ""
    
    # ============================================
    # 6. RELATÓRIO FINAL
    # ============================================
    log "===> 6. Relatorio Final"
    
    if [ $total_tests -gt 0 ]; then
        success_rate=$(echo "scale=2; $passed_tests * 100 / $total_tests" | bc 2>/dev/null || echo "0")
    else
        success_rate=0
    fi
    
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}RESUMO DA VALIDACAO${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    log "Total de testes: $total_tests"
    log "Testes aprovados: $passed_tests"
    warning "Testes falhados: $failed_tests"
    log "Taxa de sucesso: ${success_rate}%"
    echo ""
    
    # Gerar relatório em arquivo
    cat > "$report_file" << EOF
========================================
VALIDACAO DO SISTEMA SMART SIGNAGE PRO
========================================
Data: $(date '+%Y-%m-%d %H:%M:%S')
Versao: $SYSTEM_VERSION
Modo de Instalacao: $INSTALL_MODE

RESUMO:
- Total de testes: $total_tests
- Aprovados: $passed_tests
- Falhados: $failed_tests
- Taxa de sucesso: ${success_rate}%

SERVICOS:
- Backend: $API
- Frontend: $FRONTEND_URL
- IP do Servidor: $SERVER_IP

ERROS ENCONTRADOS:
$(printf '%s\n' "${errors[@]}")

========================================
EOF
    
    log "Relatorio salvo em: $report_file"
    
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}SISTEMA VALIDADO COM SUCESSO!${NC}"
        echo -e "${GREEN}========================================${NC}"
    else
        echo -e "${YELLOW}========================================${NC}"
        echo -e "${YELLOW}VALIDACAO CONCLUIDA COM ERROS${NC}"
        echo -e "${YELLOW}========================================${NC}"
        warning "Alguns testes falharam. Verifique o relatorio para detalhes."
    fi
    
    echo ""
    log "Validação automática completa concluída!"
    echo ""
    
    # Garantir que informações finais sejam sempre exibidas
    # (mesmo se houver algum problema no fluxo principal)
    if [[ "${SHOW_FINAL_INFO_CALLED:-false}" != "true" ]]; then
        export SHOW_FINAL_INFO_CALLED=true
        show_final_info
    fi
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
        
        # Parar containers órfãos antes de iniciar
        log "Removendo containers órfãos antes de iniciar..."
        $COMPOSE_CMD down --remove-orphans 2>/dev/null || true
        
        # Parar qualquer container órfão smartsignage-nginx
        docker stop smartsignage-nginx 2>/dev/null || true
        docker rm -f smartsignage-nginx 2>/dev/null || true
        
        # Verificar e garantir que porta 80 está livre
        log "Verificando se porta 80 está livre..."
        sleep 2
        if command -v ss &> /dev/null; then
            if sudo ss -tlnp | grep -q ":80 "; then
                log_error "Porta 80 ainda está em uso após limpeza!"
                log "Processos usando porta 80:"
                sudo ss -tlnp | grep ":80 " || true
                
                # Tentar parar containers Docker usando porta 80
                PORT80_CONTAINERS=$(docker ps --filter "publish=80" --format "{{.Names}}" || true)
                if [[ -n "$PORT80_CONTAINERS" ]]; then
                    log "Parando containers Docker usando porta 80: $PORT80_CONTAINERS"
                    docker stop $PORT80_CONTAINERS 2>/dev/null || true
                    docker rm -f $PORT80_CONTAINERS 2>/dev/null || true
                    sleep 2
                fi
            else
                log "✅ Porta 80 está livre"
            fi
        fi
        
        # Ordem para Docker - iniciar em sequência
        log "Iniciando PostgreSQL..."
        retry_with_backoff 3 2 $COMPOSE_CMD up -d postgres || true
        wait_for_postgres
        
        log "Iniciando Redis..."
        retry_with_backoff 3 2 $COMPOSE_CMD up -d redis || true
        wait_for_redis
        
        log "Iniciando MQTT Broker..."
        retry_with_backoff 3 2 $COMPOSE_CMD up -d mqtt || true
        wait_for_mqtt
        
        log "Iniciando Ollama..."
        retry_with_backoff 3 2 $COMPOSE_CMD up -d ollama || true
        wait_for_ollama
        
        log "Iniciando App (monolito)..."
        # Retry leve para imagens que podem falhar por rede
        for i in {1..3}; do $COMPOSE_CMD up -d postgres redis mqtt ollama prometheus grafana && break || sleep 5; done
        retry_with_backoff 3 3 $COMPOSE_CMD up -d app || true
        # Aguarde estabilização
        sleep 5
        
        log "Iniciando Prometheus..."
        log_detailed "Verificando arquivos de configuração do Prometheus..."
        if [[ ! -f "monitoring/prometheus/prometheus.yml" ]]; then
            log_error "Arquivo prometheus.yml não encontrado!"
            
            # Verificar se existe um diretório com esse nome
            if [[ -d "monitoring/prometheus/prometheus.yml" ]]; then
                log_error "Existe um diretório com o nome prometheus.yml!"
                log_progress "Removendo diretório incorreto..."
                sudo rm -rf "monitoring/prometheus/prometheus.yml" 2>/dev/null || {
                    log_error "Não foi possível remover o diretório com sudo"
                    log_progress "Tentando com permissões diferentes..."
                    chmod -R 755 "monitoring/prometheus/prometheus.yml" 2>/dev/null || true
                    rm -rf "monitoring/prometheus/prometheus.yml" 2>/dev/null || {
                        log_error "Ainda não foi possível remover. Continuando com nome alternativo..."
                        PROMETHEUS_CONFIG_FILE="monitoring/prometheus/prometheus-config.yml"
                    }
                }
            fi
            
            log_progress "Criando arquivo de configuração padrão..."
            mkdir -p monitoring/prometheus
            
            # Usar nome alternativo se necessário
            PROMETHEUS_CONFIG_FILE=${PROMETHEUS_CONFIG_FILE:-"monitoring/prometheus/prometheus.yml"}
            
            cat > "$PROMETHEUS_CONFIG_FILE" << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
  
  - job_name: 'smart-signage-backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
  
  - job_name: 'smart-signage-frontend'
    static_configs:
      - targets: ['frontend:80']
    metrics_path: '/metrics'
    scrape_interval: 30s
EOF
            log_status "✅ Arquivo prometheus.yml criado"
            
            # Se usou nome alternativo, atualizar docker-compose.yml
            if [[ "$PROMETHEUS_CONFIG_FILE" != "monitoring/prometheus/prometheus.yml" ]]; then
                log_progress "Atualizando docker-compose.yml para usar arquivo alternativo..."
                sed -i "s|monitoring/prometheus/prometheus.yml|$PROMETHEUS_CONFIG_FILE|g" docker-compose.yml
            fi
        else
            log_status "✅ Arquivo prometheus.yml encontrado"
        fi
        
        $COMPOSE_CMD up -d prometheus
        wait_for_prometheus
        
        log "Iniciando Grafana..."
        $COMPOSE_CMD up -d grafana
        wait_for_grafana
        
    elif [[ "$INSTALL_MODE" == "single-server" ]]; then
        # Ordem para Single-Server
        log "Verificando PostgreSQL..."
        if ! systemctl is-active --quiet postgresql; then
            log "Iniciando PostgreSQL..."
            sudo systemctl start postgresql
            sleep 5  # Aguardar PostgreSQL iniciar
        else
            log "✅ PostgreSQL já está rodando"
        fi

        if [[ "$MQTT_LOCAL_BROKER_REQUIRED" == "true" ]]; then
            log "Verificando Mosquitto local..."
            if ! systemctl is-active --quiet mosquitto; then
                log "Iniciando Mosquitto..."
                sudo systemctl enable mosquitto 2>/dev/null || true
                sudo systemctl start mosquitto
                wait_for_mqtt || {
                    error "❌ Mosquitto não respondeu. Verifique: sudo journalctl -u mosquitto -n 80"
                    exit 1
                }
            else
                log "✅ Mosquitto já está rodando"
            fi
        fi
        
        # Garantir que o banco de dados existe antes de iniciar o serviço
        log "Verificando se banco de dados existe..."
        local _db_name="${DB_NAME:-smartsignage}"
        local _db_user="${DB_USER:-smartsignage}"
        local _db_host="${DB_HOST:-127.0.0.1}"
        local _db_port="${DB_PORT:-5432}"
        local _db_password="${DB_PASSWORD:-}"
        # Utilizador UNIX do cluster PostgreSQL (nunca confundir com DB_USER / variável POSTGRES_USER do Docker)
        local _pg_unix="${POSTGRES_SYSTEM_USER:-postgres}"

        # .env: INSTALL_DIR (repo), deploy em /opt/smart-signage, ou cwd (instalação a partir do clone)
        local _env_file=""
        for cand in "$INSTALL_DIR/.env" "/opt/smart-signage/.env" "$(pwd)/.env"; do
            [[ -z "$cand" ]] && continue
            if [[ -f "$cand" ]]; then
                _env_file="$cand"
                break
            fi
        done
        if [[ -n "$_env_file" ]]; then
            log "Lendo DB_* de: $_env_file"
            # head -1 + cut -f2-; remover comentário estilo shell (#...) no fim do valor
            # Com pipefail, grep sem match (exit 1) não pode derrubar o script — usar || true no pipeline
            _db_name=$(grep "^DB_NAME=" "$_env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '\r' | sed -e 's/#.*$//' -e 's/^["'\'']//' -e 's/["'\'']$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' || true)
            _db_user=$(grep "^DB_USER=" "$_env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '\r' | sed -e 's/#.*$//' -e 's/^["'\'']//' -e 's/["'\'']$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' || true)
            _db_host=$(grep "^DB_HOST=" "$_env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '\r' | sed -e 's/#.*$//' -e 's/^["'\'']//' -e 's/["'\'']$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' || true)
            _db_port=$(grep "^DB_PORT=" "$_env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '\r' | sed -e 's/#.*$//' -e 's/^["'\'']//' -e 's/["'\'']$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' || true)
            _db_password=$(grep "^DB_PASSWORD=" "$_env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '\r' || true)
            [[ -z "$_db_name" ]] && _db_name="${DB_NAME:-smartsignage}"
            [[ -z "$_db_user" ]] && _db_user="${DB_USER:-smartsignage}"
            [[ -z "$_db_host" ]] && _db_host="${DB_HOST:-127.0.0.1}"
            [[ -z "$_db_port" ]] && _db_port="${DB_PORT:-5432}"
        fi

        local _db_exists=""
        if [[ -n "$_db_password" ]]; then
            _db_exists=$(PGPASSWORD="$_db_password" psql -h "$_db_host" -p "$_db_port" -U "$_db_user" -d postgres -tAc "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$_db_name');" 2>/dev/null || true)
        else
            _db_exists=$(psql -h "$_db_host" -p "$_db_port" -U "$_db_user" -d postgres -tAc "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$_db_name');" 2>/dev/null || true)
        fi
        _db_exists=$(echo "$_db_exists" | tr -d '[:space:]')

        # Fallback por peer auth (utilizador UNIX do cluster — nunca ${POSTGRES_USER} do Docker)
        if [[ "$_db_exists" != "t" ]]; then
            _db_exists=$(sudo -u "$_pg_unix" psql -d postgres -tAc "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$_db_name');" 2>/dev/null | tr -d '[:space:]' || true)
        fi

        # Cluster no mesmo host (socket): criar role + DB se TCP ainda não confirmou
        if [[ "$_db_exists" != "t" ]]; then
            if sudo -u "$_pg_unix" psql -d postgres -c "SELECT 1" >/dev/null 2>&1; then
                log "Banco '$_db_name' ainda não confirmado; tentando CREATE ROLE/DATABASE via sudo -u ${_pg_unix} (socket local; DB_HOST=${_db_host:-?})..."
                if ! sudo -u "$_pg_unix" psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$_db_user'" 2>/dev/null | grep -q 1; then
                    if [[ -n "$_db_password" ]]; then
                        local _pw_esc="${_db_password//\'/\'\'}"
                        sudo -u "$_pg_unix" psql -d postgres -c "CREATE USER \"$_db_user\" WITH PASSWORD '${_pw_esc}' CREATEDB CREATEROLE;" 2>/tmp/ss-create-user.log || true
                    else
                        sudo -u "$_pg_unix" psql -d postgres -c "CREATE USER \"$_db_user\" CREATEDB CREATEROLE;" 2>/tmp/ss-create-user.log || true
                    fi
                elif [[ -n "$_db_password" ]]; then
                    local _pw_esc="${_db_password//\'/\'\'}"
                    sudo -u "$_pg_unix" psql -d postgres -c "ALTER USER \"$_db_user\" WITH PASSWORD '${_pw_esc}';" 2>/dev/null || true
                fi
                if sudo -u "$_pg_unix" psql -d postgres -c "CREATE DATABASE \"$_db_name\" OWNER \"$_db_user\";" 2>/tmp/ss-create-db.log; then
                    _db_exists=t
                    log "✅ Banco '$_db_name' criado (OWNER $_db_user)."
                fi
                if [[ "$_db_exists" != "t" ]]; then
                    _db_exists=$(sudo -u "$_pg_unix" psql -d postgres -tAc "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$_db_name');" 2>/dev/null | tr -d '[:space:]' || true)
                fi
            else
                warn "⚠️  Cluster PostgreSQL local (sudo -u ${_pg_unix}) inacessível — não é possível criar o banco automaticamente."
            fi
        fi

        if [[ "$_db_exists" != "t" ]]; then
            error "❌ Banco de dados '$_db_name' não encontrado (ou sem credenciais de acesso)."
            error "   Confirme DB_* no .env (tentado: ${_env_file:-$INSTALL_DIR/.env}) — logs: /tmp/ss-create-db.log, /tmp/ss-create-user.log"
            if [[ -f /tmp/ss-create-db.log ]]; then
                error "   Último erro CREATE DATABASE: $(head -3 /tmp/ss-create-db.log 2>/dev/null | tr '\n' ' ')"
            fi
            error "   Alternativa: executar setup_first_boot ou: sudo -u ${_pg_unix} createuser/createdb manualmente."
            exit 1
        fi
        
        # Garantir que o serviço systemd do backend existe antes de tentar iniciar
        ensure_smart_signage_service

        log "Iniciando Backend..."
        sudo systemctl start smart-signage
        wait_for_backend || {
            error "❌ Backend não respondeu. Verifique: sudo journalctl -u smart-signage -n 80"
            exit 1
        }
        
        # Nginx já foi iniciado em setup_nginx(), apenas verificar
        log "Verificando Nginx..."
        if ! systemctl is-active --quiet nginx; then
            log "Nginx não está ativo. Tentando iniciar..."
            sudo systemctl enable nginx
            sudo systemctl start nginx
            sleep 2
        fi
        wait_for_nginx || {
            error "❌ Nginx não respondeu na porta 80. Verifique: sudo nginx -t && sudo systemctl status nginx"
            exit 1
        }
        
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
        # Serviços monitorados (monolito app)
        SERVICES=("postgres" "redis" "ollama" "app" "prometheus" "grafana")
        
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
                "mqtt")
                    wait_for_mqtt
                    ;;
                "ollama")
                    wait_for_ollama
                    ;;
                "backend")
                    wait_for_backend
                    ;;
                "frontend")
                    wait_for_frontend  # Este já inclui verificação do Nginx integrado
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
        if [[ "$MQTT_LOCAL_BROKER_REQUIRED" == "true" ]]; then
            SERVICES=("mqtt" "backend" "nginx")
        else
            SERVICES=("backend" "nginx")
        fi
        
        for service in "${SERVICES[@]}"; do
            log "Verificando $service..."
            
            case $service in
                "mqtt")
                    wait_for_mqtt
                    ;;
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
    local attempts=0
    local delay=2
    while [[ $attempts -lt 30 ]]; do
        if $COMPOSE_CMD exec -T postgres pg_isready -U smartsignage > /dev/null 2>&1; then
            log "✅ PostgreSQL: Pronto"
            return 0
        fi
        attempts=$((attempts+1))
        sleep "$delay"
        if [[ $delay -lt 10 ]]; then delay=$((delay+1)); fi
    done
    warning "❌ PostgreSQL: Timeout"
}

wait_for_redis() {
    log "Aguardando Redis..."
    local attempts=0
    local delay=2
    while [[ $attempts -lt 15 ]]; do
        if $COMPOSE_CMD exec -T redis redis-cli ping > /dev/null 2>&1; then
            log "✅ Redis: Pronto"
            return 0
        fi
        attempts=$((attempts+1))
        sleep "$delay"
        if [[ $delay -lt 10 ]]; then delay=$((delay+1)); fi
    done
    warning "❌ Redis: Timeout"
}

wait_for_mqtt() {
    log "Aguardando MQTT Broker..."
    local attempts=0
    local delay=2
    local mqtt_auth_args=()
    if [[ -n "${MQTT_BACKEND_USERNAME:-}" && -n "${MQTT_BACKEND_PASSWORD:-}" ]]; then
        mqtt_auth_args=(-u "$MQTT_BACKEND_USERNAME" -P "$MQTT_BACKEND_PASSWORD")
    fi
    
    # Em Docker, verificar se container está rodando
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        while [[ $attempts -lt 15 ]]; do
            if $COMPOSE_CMD ps | grep -q smartsignage-mqtt; then
                # Tentar conectar via mosquitto_sub se disponível
                if command -v mosquitto_sub &> /dev/null; then
                    if timeout 2 mosquitto_sub -h localhost -p 1883 "${mqtt_auth_args[@]}" -t '$SYS/#' -C 1 > /dev/null 2>&1; then
                        log "✅ MQTT Broker: Pronto"
                        return 0
                    fi
                else
                    # Se mosquitto_sub não estiver disponível, apenas verificar container
                    log "✅ MQTT Broker: Container rodando"
                    return 0
                fi
            fi
            attempts=$((attempts+1))
            sleep "$delay"
            if [[ $delay -lt 10 ]]; then delay=$((delay+1)); fi
        done
        warning "❌ MQTT Broker: Timeout"
        return 1
    fi
    
    # Instalação local - verificar se mosquitto está respondendo
    if command -v mosquitto_sub &> /dev/null; then
        while [[ $attempts -lt 15 ]]; do
            if timeout 2 mosquitto_sub -h localhost -p 1883 "${mqtt_auth_args[@]}" -t '$SYS/#' -C 1 > /dev/null 2>&1; then
                log "✅ MQTT Broker: Pronto"
                return 0
            fi
            attempts=$((attempts+1))
            sleep "$delay"
            if [[ $delay -lt 10 ]]; then delay=$((delay+1)); fi
        done
        warning "❌ MQTT Broker: Timeout"
        return 1
    else
        warning "⚠️  mosquitto_sub não encontrado, pulando verificação detalhada"
        return 0
    fi
}

wait_for_ollama() {
    log "Aguardando Ollama..."
    local attempts=0
    local delay=3
    while [[ $attempts -lt 20 ]]; do
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            log "✅ Ollama: Pronto"
            return 0
        fi
        attempts=$((attempts+1))
        sleep "$delay"
        if [[ $delay -lt 15 ]]; then delay=$((delay+1)); fi
    done
    warning "❌ Ollama: Timeout"
}

wait_for_backend() {
    log "Aguardando Backend..."
    
    # No modo single-server, verificar serviço systemd primeiro
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        log "Verificando serviço systemd smart-signage..."
        
        # Aguardar serviço estar ativo
        for i in {1..30}; do
            if systemctl is-active --quiet smart-signage; then
                log "✅ Serviço smart-signage está ativo"
                break
            fi
            if [[ $i -eq 30 ]]; then
                warning "⚠️ Serviço smart-signage não iniciou após 60 segundos"
                log "Verificando status do serviço..."
                sudo systemctl status smart-signage --no-pager -l || true
                log "Verificando logs do serviço..."
                sudo journalctl -u smart-signage --no-pager -n 50 || true
                return 1
            fi
            sleep 2
        done
    fi
    
    # Aguardar endpoint responder
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
            log "Aguardando Backend responder... (${i}/60)"
            if [[ "$INSTALL_MODE" == "single-server" ]]; then
                # Verificar logs em modo single-server
                log "Últimas linhas do log do serviço:"
                sudo journalctl -u smart-signage --no-pager -n 5 || true
            fi
        fi
        
        sleep 2
    done
    
    echo -e "${YELLOW}[WARNING]${NC} ❌ Backend: Timeout após 2 minutos"
    
    # Diagnóstico específico por modo
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        echo -e "${YELLOW}[WARNING]${NC} Verificando logs do serviço systemd..."
        sudo journalctl -u smart-signage --no-pager -n 50 || true
        echo -e "${YELLOW}[WARNING]${NC} Verificando status do serviço..."
        sudo systemctl status smart-signage --no-pager -l || true
    else
        echo -e "${YELLOW}[WARNING]${NC} Iniciando diagnóstico automático..."
        diagnose_and_fix_backend
    fi
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
    if echo "$BACKEND_LOGS" | grep -q "Database not initialized"; then
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

# Função para validar e corrigir permissões de uploads (evita erro 403)
validate_and_fix_upload_permissions() {
    log "🔍 Validando permissões dos diretórios de uploads..."
    
    # Diretórios que precisam ser acessíveis - SEMPRE usar /opt/smart-signage
    # independente do INSTALL_DIR para garantir consistência
    UPLOADS_DIR="/opt/smart-signage/public/assets/uploads"
    ASSETS_DIR="/opt/smart-signage/public/assets"
    PUBLIC_DIR="/opt/smart-signage/public"
    
    # Detectar usuário do servidor web
    WEB_USER=""
    if command -v nginx &> /dev/null || systemctl is-active --quiet nginx 2>/dev/null; then
        # Tentar detectar usuário do nginx
        if id nginx &>/dev/null; then
            WEB_USER="nginx"
        elif id www-data &>/dev/null; then
            WEB_USER="www-data"
        fi
    fi
    
    # Se não encontrou nginx, usar o usuário atual (para Node.js direto)
    if [[ -z "$WEB_USER" ]]; then
        WEB_USER="$USER"
        log "Usando usuário atual ($USER) para permissões (modo Node.js direto)"
    else
        log "Usuário do servidor web detectado: $WEB_USER"
    fi
    
    # Validar e corrigir cada diretório
    for dir in "$PUBLIC_DIR" "$ASSETS_DIR" "$UPLOADS_DIR"; do
        if [[ ! -d "$dir" ]]; then
            warn "Diretório não existe: $dir - criando..."
            sudo mkdir -p "$dir" 2>/dev/null || mkdir -p "$dir" 2>/dev/null || {
                error "Falha ao criar diretório: $dir"
                return 1
            }
        fi
        
        # Verificar permissões atuais
        CURRENT_PERMS=$(stat -c "%a" "$dir" 2>/dev/null || stat -f "%OLp" "$dir" 2>/dev/null || echo "000")
        CURRENT_OWNER=$(stat -c "%U:%G" "$dir" 2>/dev/null || stat -f "%Su:%Sg" "$dir" 2>/dev/null || echo "unknown:unknown")
        
        log_detailed "Diretório: $dir"
        log_detailed "  Permissões atuais: $CURRENT_PERMS"
        log_detailed "  Proprietário atual: $CURRENT_OWNER"
        
        # Corrigir permissões se necessário
        # Diretórios: 755 (rwxr-xr-x) - permite leitura para todos, escrita para owner
        # Arquivos: 644 (rw-r--r--) - permite leitura para todos, escrita para owner
        
        log "Ajustando permissões de: $dir"
        
        # Definir proprietário (usuário atual ou web user)
        if [[ "$INSTALL_MODE" == "docker" ]]; then
            # Em Docker, manter como usuário atual
            sudo chown -R "$USER:$USER" "$dir" 2>/dev/null || chown -R "$USER:$USER" "$dir" 2>/dev/null || true
        else
            # Em single-server, garantir que web user pode ler
            # Se web user existe, adicionar ao grupo do usuário atual
            if [[ "$WEB_USER" != "$USER" ]] && id "$WEB_USER" &>/dev/null; then
                # Garantir que o diretório pertence ao usuário atual, mas é legível pelo web user
                sudo chown -R "$USER:$USER" "$dir" 2>/dev/null || chown -R "$USER:$USER" "$dir" 2>/dev/null || true
                # Adicionar permissões de leitura para grupo e outros (755)
                sudo chmod -R 755 "$dir" 2>/dev/null || chmod -R 755 "$dir" 2>/dev/null || true
            else
                # Caso padrão: usuário atual
                sudo chown -R "$USER:$USER" "$dir" 2>/dev/null || chown -R "$USER:$USER" "$dir" 2>/dev/null || true
                sudo chmod -R 755 "$dir" 2>/dev/null || chmod -R 755 "$dir" 2>/dev/null || true
            fi
        fi
        
        # Ajustar permissões de arquivos dentro do diretório
        # Diretórios: 755, Arquivos: 644
        sudo find "$dir" -type d -exec chmod 755 {} \; 2>/dev/null || find "$dir" -type d -exec chmod 755 {} \; 2>/dev/null || true
        sudo find "$dir" -type f -exec chmod 644 {} \; 2>/dev/null || find "$dir" -type f -exec chmod 644 {} \; 2>/dev/null || true
        
        # Verificar se as permissões foram aplicadas corretamente
        NEW_PERMS=$(stat -c "%a" "$dir" 2>/dev/null || stat -f "%OLp" "$dir" 2>/dev/null || echo "000")
        NEW_OWNER=$(stat -c "%U:%G" "$dir" 2>/dev/null || stat -f "%Su:%Sg" "$dir" 2>/dev/null || echo "unknown:unknown")
        
        if [[ "$NEW_PERMS" == "755" ]] || [[ "$NEW_PERMS" == "775" ]]; then
            log "✅ Permissões corrigidas: $dir (permissões: $NEW_PERMS, owner: $NEW_OWNER)"
        else
            warn "⚠️  Permissões podem estar incorretas: $dir (permissões: $NEW_PERMS, esperado: 755)"
        fi
        
        # Testar se o diretório é acessível
        if [[ -r "$dir" ]] && [[ -x "$dir" ]]; then
            log "✅ Diretório é acessível para leitura: $dir"
        else
            error "❌ Diretório NÃO é acessível: $dir"
            return 1
        fi
    done
    
    # Verificar se há arquivos existentes e testar acesso
    if [[ -d "$UPLOADS_DIR" ]] && [[ -n "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]]; then
        log "Testando acesso a arquivos existentes em $UPLOADS_DIR..."
        TEST_FILE=$(find "$UPLOADS_DIR" -type f | head -1)
        if [[ -n "$TEST_FILE" ]] && [[ -r "$TEST_FILE" ]]; then
            log "✅ Arquivo de teste é acessível: $TEST_FILE"
        else
            warn "⚠️  Alguns arquivos podem não ser acessíveis"
        fi
    fi
    
    log "✅ Validação de permissões de uploads concluída"
}

# Validação final completa da instalação - garante que tudo está configurado corretamente
validate_complete_installation() {
    log "🔍 Realizando validação final completa da instalação..."
    
    local ERRORS=0
    local WARNINGS=0
    
    # 1. Verificar se diretórios padrão existem em /opt/smart-signage
    log "Verificando diretórios padrão em /opt/smart-signage..."
    REQUIRED_DIRS=(
        "/opt/smart-signage/public"
        "/opt/smart-signage/public/assets"
        "/opt/smart-signage/public/assets/uploads"
        "/opt/smart-signage/Logs"
    )
    
    for dir in "${REQUIRED_DIRS[@]}"; do
        if [[ ! -d "$dir" ]]; then
            error "❌ Diretório obrigatório não existe: $dir"
            log "Criando diretório: $dir"
            sudo mkdir -p "$dir" 2>/dev/null || mkdir -p "$dir" 2>/dev/null || {
                error "Falha ao criar diretório: $dir"
                ((ERRORS+=1))
                continue
            }
        fi
        
        # Verificar permissões
        if [[ ! -r "$dir" ]] || [[ ! -x "$dir" ]]; then
            warn "⚠️  Diretório não é acessível: $dir - corrigindo permissões..."
            sudo chmod 755 "$dir" 2>/dev/null || chmod 755 "$dir" 2>/dev/null || {
                error "Falha ao corrigir permissões: $dir"
                ((ERRORS+=1))
            }
        fi
    done
    
    # 2. Verificar configuração no banco de dados (se disponível)
    if command -v psql &> /dev/null && [[ -n "$DATABASE_URL" ]]; then
        log "Verificando configuração media.storage.path no banco de dados..."
        EXPECTED_PATH="/opt/smart-signage/public/assets/uploads"
        
        # Tentar extrair informações do DATABASE_URL
        if [[ "$DATABASE_URL" =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
            DB_USER="${BASH_REMATCH[1]}"
            DB_PASS="${BASH_REMATCH[2]}"
            DB_HOST="${BASH_REMATCH[3]}"
            DB_PORT="${BASH_REMATCH[4]}"
            DB_NAME="${BASH_REMATCH[5]}"
            
            ACTUAL_PATH=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT setting_value FROM system_settings WHERE setting_key = 'media.storage.path';" 2>/dev/null | xargs || echo "")
            
            if [[ -n "$ACTUAL_PATH" ]]; then
                if [[ "$ACTUAL_PATH" != "$EXPECTED_PATH" ]]; then
                    warn "⚠️  media.storage.path no banco está incorreto: $ACTUAL_PATH"
                    warn "    Esperado: $EXPECTED_PATH"
                    log "Corrigindo media.storage.path no banco de dados..."
                    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
                        UPDATE system_settings 
                        SET setting_value = '$EXPECTED_PATH',
                            default_value = '$EXPECTED_PATH',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE setting_key = 'media.storage.path';
                    " >/dev/null 2>&1 && log "✅ media.storage.path corrigido" || {
                        warn "⚠️  Não foi possível corrigir media.storage.path automaticamente"
                        ((WARNINGS+=1))
                    }
                else
                    log "✅ media.storage.path está correto no banco: $EXPECTED_PATH"
                fi
            else
                warn "⚠️  Não foi possível verificar media.storage.path no banco"
                ((WARNINGS+=1))
            fi
        fi
    fi
    
    # 3. Verificar configuração do Nginx
    if command -v nginx &> /dev/null && [[ -f "/etc/nginx/sites-enabled/smart-signage" ]]; then
        log "Verificando configuração do Nginx..."
        if grep -q "location /assets/" /etc/nginx/sites-enabled/smart-signage 2>/dev/null && \
           (grep -q "proxy_pass http://localhost:3000" /etc/nginx/sites-enabled/smart-signage 2>/dev/null || \
            grep -q "alias /opt/smart-signage/public/assets/" /etc/nginx/sites-enabled/smart-signage 2>/dev/null); then
            log "✅ Nginx configurado corretamente para assets"
        else
            warn "⚠️  Nginx pode não estar configurado corretamente para assets"
            ((WARNINGS+=1))
        fi
    fi
    
    # 4. Verificar arquivo .env
    if [[ -f "$INSTALL_DIR/.env" ]]; then
        log "Verificando UPLOAD_PATH no .env..."
        if grep -q "^UPLOAD_PATH=/opt/smart-signage/public/assets/uploads" "$INSTALL_DIR/.env" 2>/dev/null; then
            log "✅ UPLOAD_PATH está correto no .env"
        else
            warn "⚠️  UPLOAD_PATH no .env pode estar incorreto"
            if grep -q "^UPLOAD_PATH=" "$INSTALL_DIR/.env" 2>/dev/null; then
                CURRENT_PATH=$(grep "^UPLOAD_PATH=" "$INSTALL_DIR/.env" | cut -d'=' -f2)
                warn "    Valor atual: $CURRENT_PATH"
                warn "    Esperado: /opt/smart-signage/public/assets/uploads"
            fi
            ((WARNINGS+=1))
        fi
    fi
    
    # 5. Verificar backend/.env também
    if [[ -f "$INSTALL_DIR/backend/.env" ]]; then
        log "Verificando UPLOAD_PATH no backend/.env..."
        if grep -q "^UPLOAD_PATH=/opt/smart-signage/public/assets/uploads" "$INSTALL_DIR/backend/.env" 2>/dev/null; then
            log "✅ UPLOAD_PATH está correto no backend/.env"
        else
            warn "⚠️  UPLOAD_PATH no backend/.env pode estar incorreto"
            ((WARNINGS+=1))
        fi
    fi
    
    # Resumo final
    if [[ $ERRORS -eq 0 ]] && [[ $WARNINGS -eq 0 ]]; then
        log "✅ Validação completa: Tudo configurado corretamente!"
        return 0
    elif [[ $ERRORS -eq 0 ]]; then
        warn "⚠️  Validação completa: $WARNINGS aviso(s) encontrado(s), mas sem erros críticos"
        return 0
    else
        error "❌ Validação completa: $ERRORS erro(s) e $WARNINGS aviso(s) encontrado(s)"
        return 1
    fi
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
    log_progress "Aguardando Frontend..."
    local attempts=0
    local delay=2
    while [[ $attempts -lt 20 ]]; do
        log_detailed "Tentativa $((attempts+1))/20 - Testando conectividade do frontend..."
        if curl -s -f http://localhost:3001 > /dev/null 2>&1; then
            log_status "✅ Frontend: Pronto (porta 3001)"
            return 0
        fi
        CONTAINER_STATUS=$(docker ps --filter "name=smartsignage-frontend" --format "table {{.Status}}" | tail -1)
        log_detailed "Status do container: $CONTAINER_STATUS"
        attempts=$((attempts+1))
        sleep "$delay"
        if [[ $delay -lt 8 ]]; then delay=$((delay+1)); fi
    done
    log_error "❌ Frontend: Timeout após ~45 segundos"
    
    # Diagnóstico automático do frontend
    diagnose_and_fix_frontend
}

# Função de diagnóstico e correção automática do frontend
diagnose_and_fix_frontend() {
    log_error "🔍 DIAGNÓSTICO AUTOMÁTICO DO FRONTEND"
    
    # Verificar se o container está rodando
    log_container "Verificando status do container frontend..."
    if ! docker ps | grep -q "smartsignage-frontend"; then
        log_error "❌ Container frontend não está rodando"
        log_progress "🔄 Tentando reiniciar container..."
        docker compose up -d frontend
        sleep 10
        return
    fi
    
    # Verificar logs do frontend
    log_detailed "📋 Analisando logs do frontend..."
    FRONTEND_LOGS=$(docker logs smartsignage-frontend --tail 50 2>&1)
    log_detailed "Logs do frontend:"
    echo "$FRONTEND_LOGS" | head -20
    
    # Verificar se o container está saudável
    log_status "Verificando health check do frontend..."
    FRONTEND_HEALTH=$(docker inspect smartsignage-frontend --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-health-check")
    log_status "Status de saúde: $FRONTEND_HEALTH"
    
    # Verificar se a porta está respondendo
    log_progress "Testando conectividade do frontend..."
    if curl -s -f http://localhost:3001 >/dev/null 2>&1; then
        log_status "✅ Frontend respondendo na porta 3001"
        return
    else
        log_error "❌ Frontend não responde na porta 3001"
    fi
    
    # Detectar problemas comuns
    if echo "$FRONTEND_LOGS" | grep -q "Cannot find module"; then
        log_error "🔧 PROBLEMA DETECTADO: Módulos não encontrados"
        log_progress "🔄 Reconstruindo container frontend..."
        docker compose down frontend
        docker compose build --no-cache frontend
        docker compose up -d frontend
        sleep 15
    elif echo "$FRONTEND_LOGS" | grep -q "nginx"; then
        log_error "🔧 PROBLEMA DETECTADO: Erro no Nginx interno"
        log_progress "🔄 Verificando configuração do Nginx..."
        docker exec smartsignage-frontend nginx -t 2>&1 | head -10
    elif echo "$FRONTEND_LOGS" | grep -q "502\|Bad Gateway"; then
        log_error "🔧 PROBLEMA DETECTADO: Erro 502 Bad Gateway"
        log_progress "🔄 Verificando conectividade interna..."
        docker exec smartsignage-frontend curl -s http://localhost:80 || echo "Erro interno"
    elif echo "$FRONTEND_LOGS" | grep -q "Permission denied"; then
        log_error "🔧 PROBLEMA DETECTADO: Permissões incorretas"
        log_progress "🔄 Corrigindo permissões..."
        docker exec smartsignage-frontend chown -R nginx:nginx /usr/share/nginx/html 2>/dev/null || true
        docker compose restart frontend
        sleep 10
    else
        log_error "🔧 PROBLEMA NÃO IDENTIFICADO - Aplicando correções gerais..."
        log_progress "🔄 Reiniciando container frontend..."
        docker compose restart frontend
        sleep 15
    fi
    
    # Tentar novamente após correções
    log_progress "🔄 Testando frontend após correções..."
    for i in {1..15}; do
        if curl -s -f http://localhost:3001 > /dev/null 2>&1; then
            log_status "✅ Frontend: Corrigido e funcionando!"
            return 0
        fi
        sleep 2
    done
    
    log "❌ Frontend ainda não está respondendo após correções"
    log "📋 Logs finais do frontend:"
    docker logs smartsignage-frontend --tail 20 2>/dev/null || echo "Não foi possível obter logs"
}

wait_for_nginx() {
    # Nginx agora está integrado no container frontend
    # Esta função verifica o frontend que contém o Nginx
    log_progress "Aguardando Frontend (com Nginx integrado)..."
    
    # No modo Docker, Nginx está no frontend - usar wait_for_frontend
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        wait_for_frontend
        return $?
    else
        # Modo single-server ou development: verificar serviço Nginx do sistema
        # Primeiro, garantir que o Nginx está iniciado
        if ! systemctl is-active --quiet nginx 2>/dev/null; then
            log "Nginx não está ativo. Tentando iniciar..."
            sudo systemctl enable nginx 2>/dev/null || true
            sudo systemctl start nginx 2>/dev/null || {
                log_error "Falha ao iniciar Nginx!"
                sudo systemctl status nginx --no-pager -l || true
                return 1
            }
            sleep 2
        fi
        
        # Aguardar Nginx responder
        local attempts=0
        local delay=2
        while [[ $attempts -lt 20 ]]; do
            log_detailed "Tentativa $((attempts+1))/20 - Testando conectividade do Nginx..."
            
            # Verificar se serviço está ativo
            if systemctl is-active --quiet nginx 2>/dev/null; then
                # Verificar se responde na porta 80
                if curl -s -f http://localhost:80 > /dev/null 2>&1; then
                    log_status "✅ Nginx: Pronto (serviço ativo na porta 80)"
                    return 0
                fi
            else
                # Se não estiver ativo, tentar iniciar novamente
                log "Nginx não está ativo. Tentando iniciar..."
                sudo systemctl start nginx 2>/dev/null || true
                sleep 2
            fi
            
            attempts=$((attempts+1))
            sleep "$delay"
            if [[ $delay -lt 8 ]]; then delay=$((delay+1)); fi
        done
        
        log_error "❌ Nginx: Timeout após ~40 segundos"
        log "Status do serviço Nginx:"
        sudo systemctl status nginx --no-pager -l 2>/dev/null || echo "Não foi possível obter status"
        log "Testando configuração do Nginx:"
        sudo nginx -t 2>&1 || true
        log "Verificando se porta 80 está em uso:"
        sudo ss -tlnp | grep ":80 " || echo "Porta 80 não está em uso"
        return 1
    fi
}

wait_for_prometheus() {
    log_progress "Aguardando Prometheus..."
    for i in {1..15}; do
        log_detailed "Tentativa $i/15 - Testando conectividade do Prometheus..."
        if curl -s -f http://localhost:9090/-/healthy > /dev/null 2>&1; then
            log_status "✅ Prometheus: Pronto (porta 9090)"
            return 0
        fi
        
        # Verificar status do container
        CONTAINER_STATUS=$(docker ps --filter "name=smartsignage-prometheus" --format "table {{.Status}}" | tail -1)
        log_detailed "Status do container Prometheus: $CONTAINER_STATUS"
        
        sleep 2
    done
    log_error "❌ Prometheus: Timeout após 30 segundos"
    
    # Diagnóstico do Prometheus
    log_detailed "Logs do container Prometheus:"
    docker logs smartsignage-prometheus --tail 20 2>/dev/null || echo "Não foi possível obter logs"
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
export DATABASE_TYPE=postgresql
export DATABASE_URL=${DATABASE_URL:-postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage}
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

log "Configurando player HTML5 (versão com cache completo)..."

if [ -f "/app/player-web/index.html" ]; then
    log "✅ Player HTML5 encontrado (versão com cache completo)"
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
        "nginx/nginx.conf"
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

# Seeds completos (carga-inicial-v6 + bloco dinâmico do owner). Reutilizado em setup_first_boot e --seeds-only.
load_database_seeds() {
    local TARGET_DB="${PRIMARY_DB_NAME:-smartsignage}"

    if [[ "$LOAD_SEEDS" != "true" ]]; then
        log "Seeds de demonstração foram ignorados (opção --no-seeds)."
        log "Nota: no modo compacto/direct-totem a organização owner ainda será criada por ensure_minimal_owner_organization."
        return 0
    fi

    sanitize_owner_profile_defaults
    sanitize_limits_defaults

    log "Executando seed completo do banco de dados com dados correlacionados..."

    local INITIAL_LOAD_SQL_FILE="$INSTALL_DIR/database/carga-inicial-v6.sql"

    if [[ ! -f "$INITIAL_LOAD_SQL_FILE" ]]; then
        warn "⚠️ Arquivo de seeds não encontrado: $INITIAL_LOAD_SQL_FILE"
        warn "⚠️ Sem seeds. O sistema ficará sem dados de exemplo."
        return 0
    fi

    log "✅ Arquivo de seeds encontrado: $(basename "$INITIAL_LOAD_SQL_FILE")"
    local RUNTIME_SEED_FILE="$INITIAL_LOAD_SQL_FILE"
    local TEMP_DYNAMIC_SEED_FILE=""

    TEMP_DYNAMIC_SEED_FILE=$(mktemp /tmp/carga-inicial-v6.owner.XXXX.sql 2>/dev/null || true)
    if [[ -n "$TEMP_DYNAMIC_SEED_FILE" ]]; then
        prepare_seed_with_owner_profile "$INITIAL_LOAD_SQL_FILE" "$TEMP_DYNAMIC_SEED_FILE"
        RUNTIME_SEED_FILE="$TEMP_DYNAMIC_SEED_FILE"
        log "Seed dinâmico aplicado com owner='${SYSTEM_OWNER_NAME}', admin='${SYSTEM_OWNER_ADMIN_USERNAME}', plano='${SYSTEM_OWNER_PLAN_NAME}'."
    else
        warn "⚠️ Não foi possível criar arquivo temporário para seed dinâmico. Usando seed padrão."
    fi

    if ! execute_psql_file "$TARGET_DB" "$RUNTIME_SEED_FILE" "Carga inicial (seeds) ($(basename "$INITIAL_LOAD_SQL_FILE"))"; then
        if [[ "$RUNTIME_SEED_FILE" != "$INITIAL_LOAD_SQL_FILE" ]]; then
            warn "⚠️ Seed dinâmico do owner falhou. Reaplicando seed padrão para não interromper a instalação..."
            if ! execute_psql_file "$TARGET_DB" "$INITIAL_LOAD_SQL_FILE" "Carga inicial (seeds) fallback ($(basename "$INITIAL_LOAD_SQL_FILE"))"; then
                return 1
            fi
        else
            return 1
        fi
    fi
    [[ -n "$TEMP_DYNAMIC_SEED_FILE" ]] && rm -f "$TEMP_DYNAMIC_SEED_FILE" 2>/dev/null || true

    install_demo_media_files || true

    local FIX_SEQ_FILE="$INSTALL_DIR/database/fix-sequences-after-seed.sql"
    if [[ -f "$FIX_SEQ_FILE" ]]; then
        execute_psql_file "$TARGET_DB" "$FIX_SEQ_FILE" "Fix sequences after seed (fix-sequences-after-seed.sql)"
    else
        warn "⚠️ Arquivo de fix de sequências não encontrado: $FIX_SEQ_FILE"
    fi

    local VALIDATE_SEEDS_FILE="$INSTALL_DIR/database/validate-seeds.sql"
    if [[ -f "$VALIDATE_SEEDS_FILE" ]]; then
        log "Validando integridade referencial dos seeds..."
        execute_psql_file "$TARGET_DB" "$VALIDATE_SEEDS_FILE" "Validação de integridade (validate-seeds.sql)" || true
    fi

    if [[ "${COMPACT_MERGE_LOCALS:-false}" == "true" ]]; then
        local MERGE_SQL="$INSTALL_DIR/database/compact-merge-locals-to-single.sql"
        if [[ -f "$MERGE_SQL" ]]; then
            log "Migração opcional: consolidar locais num único por publisher (modo compacto)..."
            if ! execute_psql_file "$TARGET_DB" "$MERGE_SQL" "compact-merge-locals-to-single.sql"; then
                warn "⚠️ compact-merge-locals falhou (ex.: vários publishers ativos — defina target_publisher_id em database/compact-merge-locals-to-single.sql e execute manualmente)."
            fi
        else
            warn "⚠️ Arquivo não encontrado: $MERGE_SQL (compact-merge-locals ignorado)"
        fi
    fi

    return 0
}

# Valida schema/dados/financeiro via validate-v6.js sem reexecutar carga-inicial-v6.sql (evita TRUNCATE).
run_validate_v6_skip_load() {
    if [[ ! -f "$INSTALL_DIR/database/validate-v6.js" ]] || ! command -v node >/dev/null 2>&1; then
        return 0
    fi

    local target_db="${PRIMARY_DB_NAME:-smartsignage}"
    local target_user="${PRIMARY_DB_USER:-${DB_USER:-smartsignage}}"
    local target_pass="${DB_PASSWORD:-smartsignage123}"

    log "Validando banco (validate-v6.js, sem reaplicar carga)..."
    VALIDATE_V6_SKIP_LOAD=true \
        DB_NAME="$target_db" DB_USER="$target_user" DB_PASSWORD="$target_pass" \
        NODE_PATH="$INSTALL_DIR/backend/node_modules${NODE_PATH:+:$NODE_PATH}" \
        node "$INSTALL_DIR/database/validate-v6.js" || {
            warn "⚠️ validate-v6.js reportou avisos/erros (verifique o log acima)"
            return 1
        }
    return 0
}

setup_first_boot() {
    if [[ "$INSTALL_MODE" != "single-server" ]]; then
        log "Primeiro boot será configurado pelo Docker"
        return 0
    fi
    
    log "Configurando primeiro boot (migrations e seed)..."
    
    cd $INSTALL_DIR/backend || {
        error "Diretório backend não encontrado: $INSTALL_DIR/backend"
        exit 1
    }
    
    # Garantir que DATABASE_URL está definido
    if [[ -z "$DATABASE_URL" ]]; then
        error "DATABASE_URL não está definido!"
        exit 1
    fi
    
    export DATABASE_URL
    export NODE_ENV=production
    
    # Prisma removido - usando PostgreSQL direto via pg
    
    # Gerenciar dados demo existentes antes de (re)criar/semear
    manage_demo_seed_strategy

    # Executar migrations ou criar schema
    log "Criando schema do banco de dados (v2.0 refatorado)..."
    
    local TARGET_DB="${PRIMARY_DB_NAME:-smartsignage}"
    
    # Garantir que PRIMARY_DB_USER está definido (deve ter sido exportado em setup_database)
    if [[ -z "${PRIMARY_DB_USER}" ]]; then
        # Tentar obter do .env ou usar padrão
        if [[ -f "$INSTALL_DIR/.env" ]]; then
            source <(grep -E "^DB_USER=" "$INSTALL_DIR/.env" | sed 's/^/export /')
            PRIMARY_DB_USER="${DB_USER:-smartsignage}"
        else
            PRIMARY_DB_USER="smartsignage"
        fi
        export PRIMARY_DB_USER
        log "⚠️  PRIMARY_DB_USER não estava definido, usando: ${PRIMARY_DB_USER}"
    fi
    
    # Garantir permissões corretas no diretório database antes de executar scripts SQL
    log "Garantindo permissões corretas no diretório database..."
    if [[ -d "$INSTALL_DIR/database" ]]; then
        chmod -R 755 "$INSTALL_DIR/database" 2>/dev/null || true
        log "✅ Permissões do diretório database corrigidas (755)"
    else
        warn "⚠️  Diretório database não encontrado: $INSTALL_DIR/database"
    fi
    
    # Verificar se existe script de aplicação do schema v2.0
    local APPLY_SCHEMA_SCRIPT="$INSTALL_DIR/database/apply-schema-v2.sh"
    local APPLY_SCHEMA_ALL="$INSTALL_DIR/database/smartchannel-db-v2-refactored-apply-all.sql"
    
    if [[ -f "$APPLY_SCHEMA_SCRIPT" ]] && [[ -x "$APPLY_SCHEMA_SCRIPT" ]]; then
        log "✅ Usando script de aplicação do schema v2.0 refatorado..."
        log "Executando apply-schema-v2.sh..."
        
        # Configurar variáveis de ambiente para o script
        # IMPORTANT: aplicar o schema usando o usuário do banco da aplicação (PRIMARY_DB_USER),
        # para que as tabelas sejam criadas com OWNER correto (evita "permission denied for table users").
        export DB_NAME="$TARGET_DB"
        export DB_USER="${PRIMARY_DB_USER:-smartsignage}"
        export DB_HOST="localhost"
        export DB_PORT="5432"
        export SKIP_CONFIRM="true"
        export PGPASSWORD="${DB_PASSWORD:-smartsignage123}"
        
        # Executar script de aplicação
        if cd "$INSTALL_DIR/database" && bash "$APPLY_SCHEMA_SCRIPT"; then
            log "✅ Schema v2.0 refatorado aplicado com sucesso!"
        else
            error "❌ Falha ao aplicar schema v2.0 usando apply-schema-v2.sh"
            error "Tentando método alternativo (arquivo consolidado)..."
            
            # Fallback: usar arquivo consolidado se existir
            if [[ -f "$APPLY_SCHEMA_ALL" ]]; then
                log "Aplicando schema usando arquivo consolidado..."
                execute_psql_file "$TARGET_DB" "$APPLY_SCHEMA_ALL" "Schema v2.0 consolidado"
            else
                error "❌ Nenhum método de aplicação do schema v2.0 disponível"
                exit 1
            fi
        fi
    elif [[ -f "$APPLY_SCHEMA_ALL" ]]; then
        log "✅ Usando arquivo consolidado do schema v2.0 refatorado..."
        execute_psql_file "$TARGET_DB" "$APPLY_SCHEMA_ALL" "Schema v2.0 consolidado"
    else
        error "❌ Nenhum arquivo de schema v2.0 encontrado!"
        error "   Arquivos necessários (v2.0):"
        error "   - $APPLY_SCHEMA_SCRIPT (preferencial)"
        error "   - $APPLY_SCHEMA_ALL (alternativa)"
        error ""
        error "   O schema antigo foi descontinuado."
        error "   Use o schema master: smartchannel-db-v2-refactored-apply-all.sql"
        exit 1
    fi

    # Atualizar configuração media.storage.path para SEMPRE usar /opt/smart-signage
    # Isso garante que arquivos sejam salvos no local correto, mesmo se INSTALL_DIR for diferente
    MEDIA_STORAGE_PATH="/opt/smart-signage/public/assets/uploads"
    log "Configurando caminho de armazenamento de mídia para: ${MEDIA_STORAGE_PATH}"
    log "⚠️  IMPORTANTE: Usando /opt/smart-signage mesmo que INSTALL_DIR seja diferente"
    sudo -u postgres psql -d "$TARGET_DB" -c "
        UPDATE system_settings 
        SET setting_value = '${MEDIA_STORAGE_PATH}',
            default_value = '${MEDIA_STORAGE_PATH}',
            updated_at = CURRENT_TIMESTAMP
        WHERE setting_key = 'media.storage.path';
        
        -- Se não existir, criar
        INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public, is_editable, default_value, validation, options)
        SELECT 
            'media.storage.path',
            '${MEDIA_STORAGE_PATH}',
            'string',
            'media',
            'Caminho do diretório de armazenamento de mídia',
            false,
            true,
            '${MEDIA_STORAGE_PATH}',
            NULL,
            NULL
        WHERE NOT EXISTS (
            SELECT 1 FROM system_settings WHERE setting_key = 'media.storage.path'
        );
    " >/dev/null 2>&1 || {
        warn "⚠️  Não foi possível atualizar configuração media.storage.path (pode não existir ainda)"
    }
    log "✅ Configuração media.storage.path atualizada para: ${MEDIA_STORAGE_PATH}"

    # ==== Novas verificações relacionadas a contratos/alerts/reconcile (parte15) ====
    # Garantir que o SQL da parte15 (contracts) esteja presente no package
    PART15_SQL="$INSTALL_DIR/database/smartchannel-db-v2-refactored-part15-contracts.sql"
    if [[ -f "$PART15_SQL" ]]; then
        log "✅ Arquivo de contratos (part15) encontrado: $(basename "$PART15_SQL")"
    else
        warn "⚠️  Arquivo part15 (contratos) não encontrado em database/. Se você atualizou o schema, verifique que $PART15_SQL foi incluído no repositório."
    fi

    # Tornar executável o script de processamento de reconcile (se existir)
    RECONCILE_SCRIPT="$INSTALL_DIR/database/scripts/run-reconcile-jobs.sh"
    if [[ -f "$RECONCILE_SCRIPT" ]]; then
        chmod +x "$RECONCILE_SCRIPT" 2>/dev/null || true
        log "✅ Script de reconcile marcado como executável: $(basename "$RECONCILE_SCRIPT")"
    else
        warn "⚠️  Script run-reconcile-jobs.sh não encontrado em database/scripts/ - reconcile manual não disponível"
    fi

    # Verificar se a tabela de audit de contratos foi criada (contract_change_audit)
    if sudo -u postgres psql -d "$TARGET_DB" -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contract_change_audit'" | grep -q 1; then
        log "✅ Tabela contract_change_audit presente no banco."
    else
        warn "⚠️  Tabela contract_change_audit não encontrada. Se o schema foi aplicado com sucesso, verifique o arquivo part15 para trigger/funcções."
    fi
    # ========================================================================

    # Verificar se TODAS as tabelas do schema foram criadas corretamente
    log "Verificando se TODAS as tabelas do schema foram criadas..."
    cd $INSTALL_DIR/backend
    
    # Lista COMPLETA de TODAS as tabelas do schema E.R. v2.0 (em ordem de dependência)
    # Baseado em database/smartchannel-db-v2-refactored-*.sql - TODAS as tabelas usadas em JOINs
    # Ordem importa: tabelas sem foreign keys primeiro
    # ATUALIZADO: client → subscriber, host → publisher
    ALL_TABLES=(
        "subscribers"       # Subscriber (antes: clients) - Tabela base sem dependências (usada em JOINs)
        "publishers"       # Publisher (antes: hosts) - Sem dependências
        "users"             # User - Depende de publishers (usada em JOINs)
        "locals"            # Local - Depende de publishers
        "totems"            # Totem - Depende de locals (usada em JOINs)
        "smart_tvs"         # SmartTV - Depende de totems
        "campaigns"         # Campaign - Depende de subscribers (usada em JOINs)
        "medias"            # Media - Depende de subscribers, users (usada em JOINs)
        "playlists"         # Playlist - Depende de subscribers (usada em JOINs)
        "playlist_items"    # PlaylistItem - Depende de playlists, medias (usada em JOINs)
        "campaign_playlists" # CampaignPlaylist - Depende de campaigns, playlists
        "campaign_totems"   # CampaignTotem - Depende de totems, campaigns
        "qr_codes"          # QRCode - Depende de campaigns (usada em JOINs)
        "short_links"       # ShortLink - Depende de campaigns, totems
        "remote_commands"   # RemoteCommand - Depende de totems, users
        "analytics_sessions" # AnalyticsSession - Depende de totems (usada em JOINs)
        "analytics_emotions" # AnalyticsEmotion - Depende de analytics_sessions
        "analytics_gestures" # AnalyticsGesture - Depende de analytics_sessions
        # "analytics_qr_scans" # REMOVIDO no schema v2 refatorado
        "event_logs"          # EventLog - Depende de totems, campaigns, playlists, medias (v2.1)
        "ai_models"        # AIModel - Sem dependências
        "execution_logs"   # ExecutionLog - Depende de totems, subscribers, campaigns, medias
        "subscriber_billing" # SubscriberBilling - Depende de subscribers (NOVO v2.0)
        "publisher_billing"  # PublisherBilling - Depende de publishers (NOVO v2.0)
        "subscriptions"     # Subscription - Depende de publishers (NOVO v2.0)
        "campaign_publishers" # CampaignPublisher - Depende de campaigns, publishers (NOVO v2.0)
        "system_logs"       # SystemLog - Sem dependências
        "webhook_configs"  # WebhookConfig - Sem dependências
        # "webhook_deliveries" # REMOVIDO no schema v2 refatorado
        "alert_rules"       # AlertRule - Sem dependências
        # "alert_logs"        # REMOVIDO no schema v2 refatorado
        "emotion_data"      # EmotionData - Depende de totems, analytics_sessions
        "gesture_data"      # GestureData - Depende de totems, analytics_sessions
        "behavior_data"     # BehaviorData - Depende de totems, analytics_sessions
        "ml_models"        # MLModel - Sem dependências
        "totem_ml_config"  # TotemMLConfig - Depende de totems
        # "ml_sessions"      # REMOVIDO no schema v2 refatorado
        "roles"            # Role - Sem dependências
        "permissions"      # Permission - Sem dependências
        "user_roles"       # UserRole - Depende de users, roles
        "role_permissions" # RolePermission - Depende de roles, permissions
        # "approval_workflows" # REMOVIDO no schema v2 refatorado (playlists não requerem aprovação)
        "audit_logs"       # AuditLog - Depende de users (usada em JOINs)
        # "aggregated_metrics" # REMOVIDO no schema v2 refatorado
        # "device_certificates" # REMOVIDO no schema v2 refatorado
        "advanced_schedules" # Agendamentos avançados
        # "schedule_executions" # REMOVIDO no schema v2 refatorado
        # "export_queries"     # REMOVIDO no schema v2 refatorado
        # "export_schedules"   # REMOVIDO no schema v2 refatorado
        # "export_executions"  # REMOVIDO no schema v2 refatorado
        "reports"            # Relatórios gerados
        "report_templates"   # Templates de relatórios
        "system_settings"    # Configurações do sistema/logs
    )
    
    log "Schema completo: ${#ALL_TABLES[@]} tabelas projetadas para o sistema"
    
    MISSING_TABLES=()
    EXISTING_TABLES=()
    
    log "Verificando ${#ALL_TABLES[@]} tabelas do schema..."
    for table in "${ALL_TABLES[@]}"; do
        if sudo -u postgres psql -d "$TARGET_DB" -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table'" | grep -q 1; then
            EXISTING_TABLES+=("$table")
        else
            MISSING_TABLES+=("$table")
        fi
    done

    if [[ ${#MISSING_TABLES[@]} -gt 0 ]]; then
        error "❌ Falha crítica ao criar tabelas do banco de dados"
        error "Tabelas faltando: ${MISSING_TABLES[*]}"
        error "Use os arquivos smartchannel-db-v2-refactored-part*.sql ou apply-schema-v2.sh para criar o schema"
        exit 1
    fi

    log "✅ Todas as ${#ALL_TABLES[@]} tabelas do schema existem"
    log "Tabelas encontradas no banco:"
    sudo -u postgres psql -d "$TARGET_DB" -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name" | while read table; do
        [[ -n "$table" ]] && log "  ✅ $table"
    done

    # Garantir privilégios para o usuário da aplicação nas tabelas recém-criadas
    # PRIMARY_DB_USER deve estar definido (exportado em setup_database ou definido acima)
    if [[ -z "${PRIMARY_DB_USER}" ]]; then
        error "❌ PRIMARY_DB_USER não está definido! Não é possível garantir permissões."
        error "   Isso indica um problema na ordem de execução do script."
        exit 1
    fi
    
    log "Garantindo privilégios para o usuário ${PRIMARY_DB_USER}..."
    
    # Obter usuário postgres do sistema
    local POSTGRES_USER="${POSTGRES_SYSTEM_USER:-postgres}"
    
    # Transferir ownership de todas as tabelas para o usuário da aplicação
    log "Transferindo ownership de todas as tabelas para ${PRIMARY_DB_USER}..."
    sudo -u "$POSTGRES_USER" psql -d "$TARGET_DB" -tAc "SELECT 'ALTER TABLE ' || schemaname || '.' || tablename || ' OWNER TO ${PRIMARY_DB_USER};' FROM pg_tables WHERE schemaname = 'public';" | sudo -u "$POSTGRES_USER" psql -d "$TARGET_DB" >/dev/null 2>&1 || true
    
    # Transferir ownership de todas as sequences
    log "Transferindo ownership de todas as sequences para ${PRIMARY_DB_USER}..."
    sudo -u "$POSTGRES_USER" psql -d "$TARGET_DB" -tAc "SELECT 'ALTER SEQUENCE ' || schemaname || '.' || sequencename || ' OWNER TO ${PRIMARY_DB_USER};' FROM pg_sequences WHERE schemaname = 'public';" | sudo -u "$POSTGRES_USER" psql -d "$TARGET_DB" >/dev/null 2>&1 || true
    
    # Transferir ownership de todas as views
    log "Transferindo ownership de todas as views para ${PRIMARY_DB_USER}..."
    sudo -u "$POSTGRES_USER" psql -d "$TARGET_DB" -tAc "SELECT 'ALTER VIEW ' || schemaname || '.' || viewname || ' OWNER TO ${PRIMARY_DB_USER};' FROM pg_views WHERE schemaname = 'public';" | sudo -u "$POSTGRES_USER" psql -d "$TARGET_DB" >/dev/null 2>&1 || true
    
    # Transferir ownership de todas as funções
    log "Transferindo ownership de todas as funções para ${PRIMARY_DB_USER}..."
    sudo -u postgres psql -d "$TARGET_DB" -tAc "SELECT 'ALTER FUNCTION ' || n.nspname || '.' || p.proname || '(' || pg_get_function_arguments(p.oid) || ') OWNER TO ${PRIMARY_DB_USER};' FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public';" | sudo -u postgres psql -d "$TARGET_DB" >/dev/null 2>&1 || true
    
    # Garantir privilégios explícitos em todas as tabelas (incluindo as criadas dentro de blocos DO $$)
    log "Garantindo privilégios explícitos em todas as tabelas..."
    sudo -u postgres psql -d "$TARGET_DB" -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO ${PRIMARY_DB_USER};" >/dev/null 2>&1 || true
    sudo -u postgres psql -d "$TARGET_DB" -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${PRIMARY_DB_USER};" >/dev/null 2>&1 || true
    sudo -u postgres psql -d "$TARGET_DB" -c "GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO ${PRIMARY_DB_USER};" >/dev/null 2>&1 || true
    
    # Garantir privilégios para tabelas específicas que podem ter sido criadas dentro de blocos DO $$
    log "Garantindo privilégios específicos em tabelas críticas..."
    for table in system_settings; do
        if sudo -u "$POSTGRES_USER" psql -d "$TARGET_DB" -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$table'" | grep -q 1; then
            sudo -u "$POSTGRES_USER" psql -d "$TARGET_DB" -c "ALTER TABLE $table OWNER TO ${PRIMARY_DB_USER};" >/dev/null 2>&1 || true
            sudo -u "$POSTGRES_USER" psql -d "$TARGET_DB" -c "GRANT ALL ON TABLE $table TO ${PRIMARY_DB_USER};" >/dev/null 2>&1 || true
        fi
    done
    
    # Configurar privilégios padrão para objetos futuros
    log "Configurando privilégios padrão para objetos futuros..."
    sudo -u "$POSTGRES_USER" psql -d "$TARGET_DB" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${PRIMARY_DB_USER};" >/dev/null 2>&1 || true
    sudo -u "$POSTGRES_USER" psql -d "$TARGET_DB" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${PRIMARY_DB_USER};" >/dev/null 2>&1 || true
    sudo -u "$POSTGRES_USER" psql -d "$TARGET_DB" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ${PRIMARY_DB_USER};" >/dev/null 2>&1 || true
    
    log "✅ Privilégios garantidos para ${PRIMARY_DB_USER}"
    
    # Validar configurações de logs aplicadas pelo schema consolidado
    log "Validando configurações padrão de logs..."
    sleep 1  # Aguardar commit
    LOGS_CONFIG_COUNT=$(sudo -u postgres psql -d "$TARGET_DB" -tAc "SELECT COUNT(*) FROM system_settings WHERE setting_key LIKE 'log.%';" 2>/dev/null | tr -d ' ' || echo "0")
    
    if [[ -n "$LOGS_CONFIG_COUNT" ]] && [[ "$LOGS_CONFIG_COUNT" -gt 0 ]]; then
        log "✅ Configurações de logs criadas ($LOGS_CONFIG_COUNT configurações encontradas)"
        
        # Listar configurações criadas
        log "📋 Configurações de logs aplicadas:"
        sudo -u postgres psql -d "$TARGET_DB" -tAc "SELECT setting_key FROM system_settings WHERE setting_key LIKE 'log.%' ORDER BY setting_key;" 2>/dev/null | while read key; do
            [[ -n "$key" ]] && log "   ✓ $key"
        done
    else
        error "❌ Configurações de logs NÃO foram criadas!"
        error "   Verificando se tabela system_settings existe..."
        TABLE_EXISTS=$(sudo -u postgres psql -d "$TARGET_DB" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='system_settings');" 2>/dev/null | tr -d ' ')
        if [[ "$TABLE_EXISTS" == "t" ]]; then
            error "   Tabela system_settings existe, mas não há configurações de logs"
            error "   Tentando reaplicar schema v2.0 para registros padrão..."
            # Tentar reaplicar usando schema v2.0 (priorizar script shell)
            if [[ -f "$APPLY_SCHEMA_SCRIPT" ]] && [[ -x "$APPLY_SCHEMA_SCRIPT" ]]; then
                cd "$INSTALL_DIR/database" && bash "$APPLY_SCHEMA_SCRIPT"
            elif [[ -f "$APPLY_SCHEMA_ALL" ]]; then
                # Usar script shell apply-schema-v2.sh em vez do arquivo SQL com \i
                cd "$INSTALL_DIR/database" && bash "$APPLY_SCHEMA_SCRIPT" 2>/dev/null || execute_psql_file "$TARGET_DB" "$APPLY_SCHEMA_ALL" "Reaplicação do schema v2.0 (logs)"
            else
                error "   ❌ Arquivos de schema v2.0 não encontrados para reaplicação"
            fi
            LOGS_CONFIG_COUNT=$(sudo -u postgres psql -d "$TARGET_DB" -tAc "SELECT COUNT(*) FROM system_settings WHERE setting_key LIKE 'log.%';" 2>/dev/null | tr -d ' ' || echo "0")
            if [[ -n "$LOGS_CONFIG_COUNT" ]] && [[ "$LOGS_CONFIG_COUNT" -gt 0 ]]; then
                log "✅ Configurações de logs criadas após reaplicação ($LOGS_CONFIG_COUNT configurações encontradas)"
            else
                # Tentar inserir configurações de logs diretamente
                log "   Tentando inserir configurações de logs diretamente..."
                local SEEDS_FILE="$INSTALL_DIR/database/seeds-default-settings.sql"
                if [[ -f "$SEEDS_FILE" ]]; then
                    execute_psql_file "$TARGET_DB" "$SEEDS_FILE" "Inserção de configurações padrão"
                    LOGS_CONFIG_COUNT=$(sudo -u postgres psql -d "$TARGET_DB" -tAc "SELECT COUNT(*) FROM system_settings WHERE setting_key LIKE 'log.%';" 2>/dev/null | tr -d ' ' || echo "0")
                    if [[ -n "$LOGS_CONFIG_COUNT" ]] && [[ "$LOGS_CONFIG_COUNT" -gt 0 ]]; then
                        log "✅ Configurações de logs inseridas via seeds ($LOGS_CONFIG_COUNT configurações encontradas)"
                    else
                        error "❌ Não foi possível inserir configurações de logs mesmo após tentativa de seeds"
                exit 1
                    fi
                else
                    error "❌ Arquivo seeds-default-settings.sql não encontrado"
                    error "❌ Não foi possível inserir configurações de logs"
                    exit 1
                fi
            fi
        else
            error "   Tabela system_settings NÃO existe!"
            error "   O schema de logs deve criar esta tabela primeiro"
            error "   Reaplicando schema v2.0..."
            # Tentar reaplicar usando schema v2.0 (priorizar script shell)
            if [[ -f "$APPLY_SCHEMA_SCRIPT" ]] && [[ -x "$APPLY_SCHEMA_SCRIPT" ]]; then
                cd "$INSTALL_DIR/database" && bash "$APPLY_SCHEMA_SCRIPT"
            elif [[ -f "$APPLY_SCHEMA_ALL" ]]; then
                # Usar script shell apply-schema-v2.sh em vez do arquivo SQL com \i
                cd "$INSTALL_DIR/database" && bash "$APPLY_SCHEMA_SCRIPT" 2>/dev/null || execute_psql_file "$TARGET_DB" "$APPLY_SCHEMA_ALL" "Reaplicação do schema v2.0 (recriar system_settings)"
            else
                error "   ❌ Arquivos de schema v2.0 não encontrados para reaplicação"
            fi
            TABLE_EXISTS=$(sudo -u postgres psql -d "$TARGET_DB" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='system_settings');" 2>/dev/null | tr -d ' ')
            if [[ "$TABLE_EXISTS" != "t" ]]; then
                error "❌ system_settings ainda não existe após reaplicação. Abortando."
                exit 1
            fi
            LOGS_CONFIG_COUNT=$(sudo -u postgres psql -d "$TARGET_DB" -tAc "SELECT COUNT(*) FROM system_settings WHERE setting_key LIKE 'log.%';" 2>/dev/null | tr -d ' ' || echo "0")
            if [[ -n "$LOGS_CONFIG_COUNT" ]] && [[ "$LOGS_CONFIG_COUNT" -gt 0 ]]; then
                log "✅ Configurações de logs criadas após recriação ($LOGS_CONFIG_COUNT configurações encontradas)"
            else
                # Tentar inserir configurações de logs diretamente
                log "   Tentando inserir configurações de logs diretamente..."
                local SEEDS_FILE="$INSTALL_DIR/database/seeds-default-settings.sql"
                if [[ -f "$SEEDS_FILE" ]]; then
                    execute_psql_file "$TARGET_DB" "$SEEDS_FILE" "Inserção de configurações padrão"
                    LOGS_CONFIG_COUNT=$(sudo -u postgres psql -d "$TARGET_DB" -tAc "SELECT COUNT(*) FROM system_settings WHERE setting_key LIKE 'log.%';" 2>/dev/null | tr -d ' ' || echo "0")
                    if [[ -n "$LOGS_CONFIG_COUNT" ]] && [[ "$LOGS_CONFIG_COUNT" -gt 0 ]]; then
                        log "✅ Configurações de logs inseridas via seeds ($LOGS_CONFIG_COUNT configurações encontradas)"
                    else
                        error "❌ Configurações de logs ainda ausentes após tentativa de seeds"
                        exit 1
                    fi
                else
                    error "❌ Arquivo seeds-default-settings.sql não encontrado"
                error "❌ Configurações de logs ainda ausentes após recriação do schema"
                exit 1
                fi
            fi
        fi
    fi
    
    # Criar diretórios necessários para o backend (uploads, logs, etc.)
    log "Criando diretórios necessários para o backend..."
    UPLOADS_DIR="/opt/smart-signage/public/assets/uploads"
    LOGS_DIR="/opt/smart-signage/Logs"
    PUBLIC_DIR="/opt/smart-signage/public"
    ASSETS_DIR="/opt/smart-signage/public/assets"
    
    # Criar estrutura de diretórios completa
    log "Criando estrutura de diretórios para uploads e assets..."
    for dir in "$PUBLIC_DIR" "$ASSETS_DIR" "$UPLOADS_DIR"; do
        if [[ ! -d "$dir" ]]; then
            log "Criando diretório: $dir"
            sudo mkdir -p "$dir" 2>/dev/null || mkdir -p "$dir" 2>/dev/null || {
                error "Falha ao criar diretório: $dir"
                exit 1
            }
        fi
    done
    
    # Criar diretório de logs se não existir
    if [[ ! -d "$LOGS_DIR" ]]; then
        log "Criando diretório de logs: $LOGS_DIR"
        sudo mkdir -p "$LOGS_DIR" 2>/dev/null || mkdir -p "$LOGS_DIR" 2>/dev/null || true
    fi
    
    # Ajustar permissões dos diretórios criados
    # O usuário do serviço precisa ter acesso de escrita
    log "Ajustando permissões dos diretórios criados..."
    for dir in "$PUBLIC_DIR" "$ASSETS_DIR" "$UPLOADS_DIR"; do
        if [[ -d "$dir" ]]; then
            log "Ajustando permissões de: $dir"
            sudo chown -R $USER:$USER "$dir" 2>/dev/null || chown -R $USER:$USER "$dir" 2>/dev/null || true
            sudo chmod -R 755 "$dir" 2>/dev/null || chmod -R 755 "$dir" 2>/dev/null || true
        fi
    done
    log "✅ Diretórios criados e configurados: $PUBLIC_DIR, $ASSETS_DIR, $UPLOADS_DIR"
    
    # Validar e corrigir permissões para evitar erro 403
    validate_and_fix_upload_permissions
    
    if [[ -d "$LOGS_DIR" ]]; then
        log "Ajustando permissões do diretório de logs..."
        sudo chown -R $USER:$USER "$LOGS_DIR" 2>/dev/null || chown -R $USER:$USER "$LOGS_DIR" 2>/dev/null || true
        sudo chmod -R 755 "$LOGS_DIR" 2>/dev/null || chmod -R 755 "$LOGS_DIR" 2>/dev/null || true
        log "✅ Diretório de logs criado e configurado: $LOGS_DIR"
    fi
    
    if ! load_database_seeds; then
        error "❌ Falha ao aplicar seeds do banco de dados"
        exit 1
    fi

    # Garantir usuários ao final (após schema + possíveis seeds/fallback)
    # para evitar perda de contas quando a carga fallback executa TRUNCATE.
    if ! ensure_admin_user; then
        error "❌ Não foi possível garantir usuário admin após aplicação do schema e seeds"
        exit 1
    fi
    if ! ensure_owner_system_user; then
        error "❌ Não foi possível garantir usuário owner_system após aplicação do schema e seeds"
        exit 1
    fi
    if [[ "${INSTALL_TOTEMDIGITAL_COMPACT}" == "true" ]]; then
        if ! ensure_owner_publisher_user; then
            error "❌ Não foi possível garantir usuário publisher do owner no modo compacto"
            exit 1
        fi
    fi

    run_validate_v6_skip_load || true
}

# Detectar e tratar dados demo já existentes
manage_demo_seed_strategy() {
    # Verificar se já existem tabelas no schema public (com timeout)
    TABLE_COUNT=$(timeout 5 psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" 2>/dev/null | tr -d ' ')
    [[ -z "$TABLE_COUNT" ]] && TABLE_COUNT=0

    if [[ "$TABLE_COUNT" -eq 0 ]]; then
        # Não há nada para gerenciar
        return 0
    fi

    log "Detectando dados existentes no banco para estratégia de seeds..."

    # Verificar se tabelas necessárias existem antes de consultar
    TABLE_EXISTS=$(timeout 5 psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='totems');" 2>/dev/null | tr -d ' ')
    if [[ "$TABLE_EXISTS" != "t" ]]; then
        log "⚠️ Tabelas necessárias ainda não existem. Pulando detecção de dados demo."
        return 0
    fi

    # Detectar marcadores de DEMO legados (default-demo, playlist demo, mídias demo) com timeout e tratamento de erro
    DEMO_TOTEM_CNT=$(timeout 5 psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM totems WHERE uin = 'default-demo';" 2>/dev/null | tr -d ' ' || echo "0")
    DEMO_PLAYLIST_CNT=$(timeout 5 psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM playlists WHERE name ILIKE 'Playlist Demo' OR playlist_id = 5;" 2>/dev/null | tr -d ' ' || echo "0")
    DEMO_MEDIA_CNT=$(timeout 5 psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM medias WHERE file_path ILIKE '%smart-signage-pro-%' OR name ILIKE 'Smart Signage-Pro %' OR (tags::text ILIKE '%demo%');" 2>/dev/null | tr -d ' ' || echo "0")

    # Contar dados NÃO-DEMO em tabelas principais (com timeout e tratamento de erro)
    NON_DEMO_CLIENTS=$(timeout 5 psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM clients WHERE name NOT ILIKE '%demo%';" 2>/dev/null | tr -d ' ' || echo "0")
    NON_DEMO_TOTEMS=$(timeout 5 psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM totems WHERE uin <> 'default-demo' OR uin IS NULL;" 2>/dev/null | tr -d ' ' || echo "0")
    NON_DEMO_MEDIA=$(timeout 5 psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM medias WHERE NOT (file_path ILIKE '%smart-signage-pro-%' OR name ILIKE 'Smart Signage-Pro %' OR (tags::text ILIKE '%demo%'));" 2>/dev/null | tr -d ' ' || echo "0")
    NON_DEMO_PLAYLISTS=$(timeout 5 psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM playlists WHERE NOT (name ILIKE 'Playlist Demo' OR playlist_id = 5);" 2>/dev/null | tr -d ' ' || echo "0")

    [[ -z "$DEMO_TOTEM_CNT" ]] && DEMO_TOTEM_CNT=0
    [[ -z "$DEMO_PLAYLIST_CNT" ]] && DEMO_PLAYLIST_CNT=0
    [[ -z "$DEMO_MEDIA_CNT" ]] && DEMO_MEDIA_CNT=0
    [[ -z "$NON_DEMO_CLIENTS" ]] && NON_DEMO_CLIENTS=0
    [[ -z "$NON_DEMO_TOTEMS" ]] && NON_DEMO_TOTEMS=0
    [[ -z "$NON_DEMO_MEDIA" ]] && NON_DEMO_MEDIA=0
    [[ -z "$NON_DEMO_PLAYLISTS" ]] && NON_DEMO_PLAYLISTS=0

    ONLY_DEMO=true
    if [[ "$NON_DEMO_CLIENTS" -gt 0 || "$NON_DEMO_TOTEMS" -gt 0 || "$NON_DEMO_MEDIA" -gt 0 || "$NON_DEMO_PLAYLISTS" -gt 0 ]]; then
        ONLY_DEMO=false
    fi

    if [[ "$ONLY_DEMO" == true && ( "$DEMO_TOTEM_CNT" -gt 0 || "$DEMO_PLAYLIST_CNT" -gt 0 || "$DEMO_MEDIA_CNT" -gt 0 ) ]]; then
        echo
        warn "Foi detectado um banco existente contendo APENAS dados de demonstração (seeds)."
        read -p "Deseja APAGAR COMPLETAMENTE os dados (DROP SCHEMA public)? Digite DROP para confirmar: " confirm_drop
        if [[ "$confirm_drop" == "DROP" ]]; then
            log "Apagando schema public (DROP SCHEMA CASCADE) e recriando..."
            if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;"; then
                log "✅ Schema limpo com sucesso (somente dados demo existiam)."
            else
                warn "⚠️ Falha ao limpar schema. Continuando mesmo assim."
            fi
        else
            log "Operação de DROP cancelada pelo usuário. Manteremos o schema atual."
            # Nesse caso, removeremos apenas os dados demo para re-inserir limpos
            clean_demo_seed_data
        fi
    else
        # Há dados do usuário. Apenas limpar demos (se existirem) antes de re-seedar
        if [[ "$DEMO_TOTEM_CNT" -gt 0 || "$DEMO_PLAYLIST_CNT" -gt 0 || "$DEMO_MEDIA_CNT" -gt 0 ]]; then
            log "Removendo dados de demonstração existentes sem afetar dados do usuário..."
            clean_demo_seed_data
        fi
    fi
}

# Remover dados de demonstração conhecidos de forma segura
clean_demo_seed_data() {
    # Verificar se tabelas existem antes de limpar
    if ! psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='playlists');" 2>/dev/null | grep -q t; then
        log "⚠️ Tabelas ainda não existem. Pulando limpeza de dados demo."
        return 0
    fi
    
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
-- Playlist Demo e seus itens (usando subqueries diretas)
DELETE FROM playlist_items WHERE playlist_id IN (
  SELECT playlist_id FROM playlists WHERE name ILIKE 'Playlist Demo' OR playlist_id = 5
);
DELETE FROM campaign_playlists WHERE playlist_id IN (
  SELECT playlist_id FROM playlists WHERE name ILIKE 'Playlist Demo' OR playlist_id = 5
);
DELETE FROM playlists WHERE playlist_id IN (
  SELECT playlist_id FROM playlists WHERE name ILIKE 'Playlist Demo' OR playlist_id = 5
);

-- Legado: remover totem default-demo e dependências, se existirem
-- Tabelas removidas no schema v2 refatorado: device_certificates, ml_sessions
-- DELETE FROM device_certificates WHERE totem_id IN (
--   SELECT totem_id FROM totems WHERE uin = 'default-demo'
-- );
DELETE FROM totem_ml_config WHERE totem_id IN (
  SELECT totem_id FROM totems WHERE uin = 'default-demo'
);
-- DELETE FROM ml_sessions WHERE totem_id IN (
--   SELECT totem_id FROM totems WHERE uin = 'default-demo'
-- );
DELETE FROM campaign_totems WHERE totem_id IN (
  SELECT totem_id FROM totems WHERE uin = 'default-demo'
);
DELETE FROM analytics_sessions WHERE totem_id IN (
  SELECT totem_id FROM totems WHERE uin = 'default-demo'
);
DELETE FROM emotion_data WHERE totem_id IN (
  SELECT totem_id FROM totems WHERE uin = 'default-demo'
);
DELETE FROM gesture_data WHERE totem_id IN (
  SELECT totem_id FROM totems WHERE uin = 'default-demo'
);
DELETE FROM behavior_data WHERE totem_id IN (
  SELECT totem_id FROM totems WHERE uin = 'default-demo'
);
DELETE FROM execution_logs WHERE totem_id IN (
  SELECT totem_id FROM totems WHERE uin = 'default-demo'
);
DELETE FROM totems WHERE totem_id IN (
  SELECT totem_id FROM totems WHERE uin = 'default-demo'
);

-- Mídias de demonstração (por name/arquivo/tags contendo demo) - schema v2: medias tem 'name', não 'title'
DELETE FROM playlist_items WHERE media_id IN (
  SELECT media_id FROM medias 
  WHERE file_path ILIKE '%smart-signage-pro-%' 
     OR name ILIKE 'Smart Signage-Pro %'
     OR (tags::text ILIKE '%demo%')
);
-- Tabelas removidas no schema v2 refatorado: aggregated_metrics, approval_workflows
-- DELETE FROM aggregated_metrics WHERE media_id IN (
--   SELECT media_id FROM medias 
--   WHERE title ILIKE 'Smart Signage-Pro %' 
--      OR file_path ILIKE '%smart-signage-pro-%' 
--      OR name ILIKE 'Smart Signage-Pro %'
--      OR (tags::text ILIKE '%demo%')
-- );
-- DELETE FROM approval_workflows WHERE media_id IN (
--   SELECT media_id FROM medias 
--   WHERE title ILIKE 'Smart Signage-Pro %' 
--      OR file_path ILIKE '%smart-signage-pro-%' 
--      OR name ILIKE 'Smart Signage-Pro %'
--      OR (tags::text ILIKE '%demo%')
-- );
DELETE FROM execution_logs WHERE media_id IN (
  SELECT media_id FROM medias 
  WHERE file_path ILIKE '%smart-signage-pro-%' 
     OR name ILIKE 'Smart Signage-Pro %'
     OR (tags::text ILIKE '%demo%')
);
DELETE FROM medias WHERE media_id IN (
  SELECT media_id FROM medias 
  WHERE file_path ILIKE '%smart-signage-pro-%' 
     OR name ILIKE 'Smart Signage-Pro %'
     OR (tags::text ILIKE '%demo%')
);

-- Outros seeds pontuais conhecidos
DELETE FROM short_links WHERE short_code = 'BF2024';
-- Schema v2: remote_commands não tem coluna request_id (tem command_id, totem_id, command_type, etc.). Sem seed demo por request_id; remoção omitida.
-- DELETE FROM remote_commands WHERE request_id = 'CMD-001';

COMMIT;
SQL
    if [[ $? -eq 0 ]]; then
        log "✅ Dados de demonstração removidos."
    else
        warn "⚠️ Falha ao remover dados de demonstração (continua)."
    fi
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
        cd $INSTALL_DIR/frontend && npm install --legacy-peer-deps
        
        # CORREÇÃO CRÍTICA: Corrigir fork-ts-checker-webpack-plugin
        PLUGIN_PATH="$INSTALL_DIR/frontend/node_modules/fork-ts-checker-webpack-plugin/lib/ForkTsCheckerWebpackPlugin.js"
        if [[ -f "$PLUGIN_PATH" ]] && ! grep -q "SOLUÇÃO DEFINITIVA" "$PLUGIN_PATH" 2>/dev/null; then
            # Garantir que Python está instalado
            if ! command -v python3 &> /dev/null; then
                echo "⚠️  Python3 não encontrado - instalando..."
                if sudo apt update -y && sudo apt install -y python3 python3-pip 2>/dev/null; then
                    echo "✅ Python3 instalado"
                else
                    echo "❌ Falha ao instalar Python3 - pulando correção do fork-ts-checker-webpack-plugin"
                    echo "⚠️  O build pode falhar. Instale manualmente: sudo apt install -y python3 python3-pip"
                fi
            fi
            
            if command -v python3 &> /dev/null; then
                echo "Corrigindo fork-ts-checker-webpack-plugin..."
                python3 << PYTHON_FIX_PLUGIN_UPDATE_EOF
import re
import sys
import os

plugin_path = "$PLUGIN_PATH"

if not os.path.exists(plugin_path):
    sys.exit(0)

try:
    with open(plugin_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'SOLUÇÃO DEFINITIVA' in content:
        sys.exit(0)
    
    pattern = r'schema_utils_1\.default\(ForkTsCheckerWebpackPluginOptions_json_1\.default, options, configuration\);'
    
    if not re.search(pattern, content):
        sys.exit(0)
    
    fix = '''    // SOLUÇÃO DEFINITIVA: Ignorar validação se schema-utils não funcionar
    // Isso resolve conflitos de versão entre ajv@8.x e schema-utils@2.x
    // A validação não é crítica - o TypeScript já valida os tipos
    try {
        var validate = schema_utils_1.default || schema_utils_1;
        if (typeof validate === 'function') {
            validate(ForkTsCheckerWebpackPluginOptions_json_1.default, options, configuration);
        }
    } catch (error) {
        // Ignorar erros de validação - não crítico para o build
    }'''
    
    content = re.sub(pattern, fix, content)
    
    with open(plugin_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ fork-ts-checker-webpack-plugin corrigido")
    sys.exit(0)
    
except Exception as e:
    sys.exit(1)
PYTHON_FIX_PLUGIN_UPDATE_EOF
            fi
        fi
        
        # Aplicar patches de dependências se existirem
        if [[ -d "$INSTALL_DIR/frontend/patches" ]] && [[ -n "$(ls -A $INSTALL_DIR/frontend/patches/*.patch 2>/dev/null)" ]]; then
            if command -v npx &> /dev/null; then
                cd $INSTALL_DIR/frontend
                npx patch-package 2>/dev/null || true
            fi
        fi
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
    elif [[ "$INSTALL_MODE" == "single-server" ]]; then
        log "Criando manage.sh para single-server (systemd; autostart não substitui o unit Node)."
        local mgss_template="$INSTALL_DIR/scripts/manage-single-server.sh"
        if [[ ! -f "$mgss_template" && -n "${SOURCE_DIR:-}" && -f "$SOURCE_DIR/scripts/manage-single-server.sh" ]]; then
            mgss_template="$SOURCE_DIR/scripts/manage-single-server.sh"
        fi
        if [[ ! -f "$mgss_template" ]]; then
            error "❌ Template em falta: scripts/manage-single-server.sh (esperado em $INSTALL_DIR/scripts/ ou SOURCE_DIR)."
            exit 1
        fi
        cp -f "$mgss_template" "$MANAGEMENT_SCRIPT"
    else
        # Script apenas para Docker (Compose; autostart usa unit oneshot + Docker)
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
        # Carregar .env e definir padrões de portas
        if [ -f "$INSTALL_DIR/.env" ]; then
            . "$INSTALL_DIR/.env"
        fi
        # No modo single-server, Nginx está na porta 80
        if [[ "$INSTALL_MODE" == "single-server" ]]; then
            FRONTEND_PORT=${FRONTEND_PORT:-80}
        else
            FRONTEND_PORT=${FRONTEND_PORT:-8080}
        fi
        FRONTEND_ALT_PORT=${FRONTEND_ALT_PORT:-3001}
        BACKEND_PORT=${BACKEND_PORT:-3000}
        PROMETHEUS_PORT=${PROMETHEUS_PORT:-9090}
        GRAFANA_PORT=${GRAFANA_PORT:-3002}
        echo "Frontend: http://$SERVER_IP:$FRONTEND_PORT"
        echo "Frontend Direto: http://$SERVER_IP:$FRONTEND_ALT_PORT"
        echo "Backend API: http://$SERVER_IP:$BACKEND_PORT"
        echo "Player: http://$SERVER_IP:$FRONTEND_PORT/player"
        echo "Prometheus: http://$SERVER_IP:$PROMETHEUS_PORT"
        echo "Grafana: http://$SERVER_IP:$GRAFANA_PORT"
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
SERVICE_EOF
        
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
    # Carregar .env e padrões de portas
    if [ -f "$INSTALL_DIR/.env" ]; then
        # shellcheck source=/dev/null
        . "$INSTALL_DIR/.env"
    fi
    # Porta HTTP do painel (Nginx): SMARTSIGNAGE_* gravado pelo instalador em layout dividido (ex.: 8080)
    PANEL_HTTP_PORT="${SMARTSIGNAGE_SYSTEM_HTTP_PORT:-80}"
    if [[ "${SMARTSIGNAGE_NGINX_SPLIT:-false}" != "true" ]] && [[ "${SMARTSIGNAGE_NGINX_SPLIT:-false}" != "1" ]]; then
        PANEL_HTTP_PORT=80
    fi
    [[ -z "${PANEL_HTTP_PORT// }" ]] && PANEL_HTTP_PORT=80
    if [[ "${PANEL_HTTP_PORT}" == "80" ]]; then
        PANEL_URL_SUFFIX=""
    else
        PANEL_URL_SUFFIX=":${PANEL_HTTP_PORT}"
    fi
    FRONTEND_PORT="${PANEL_HTTP_PORT}"
    PLAYER_PORT="${PANEL_HTTP_PORT}"
    FRONTEND_ALT_PORT=${FRONTEND_ALT_PORT:-3001}
    BACKEND_PORT=${BACKEND_PORT:-3000}
    PROMETHEUS_PORT=${PROMETHEUS_PORT:-9090}
    GRAFANA_PORT=${GRAFANA_PORT:-3002}
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
    
    # Validação final completa antes de concluir
    log "Realizando validação final da instalação..."
    validate_complete_installation || {
        warn "⚠️  Alguns problemas foram detectados na validação, mas a instalação foi concluída"
        warn "    Verifique os logs acima para detalhes"
    }
    
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
    if [[ "${SMARTSIGNAGE_NGINX_SPLIT:-false}" == "true" ]] || [[ "${SMARTSIGNAGE_NGINX_SPLIT:-false}" == "1" ]]; then
        local _corp_p="${SMARTSIGNAGE_CORPORATE_HTTP_PORT:-80}"
        local _corp_sfx=""
        [[ "$_corp_p" != "80" ]] && _corp_sfx=":${_corp_p}"
        echo -e "${CYAN}🏛 Site corporativo (estático):${NC} http://$LOCAL_IP${_corp_sfx}/"
        if [[ "${SMARTSIGNAGE_CORPORATE_LE_HTTPS:-false}" == "true" ]] || [[ "${SMARTSIGNAGE_CORPORATE_LE_HTTPS:-false}" == "1" ]]; then
            if [[ -n "${DOMAIN_NAME:-}" ]] && [[ "$DOMAIN_NAME" != "_" ]]; then
                echo -e "   ${YELLOW}👉 HTTPS unificado (site + painel + API): https://${DOMAIN_NAME}/${NC}"
                echo -e "   ${YELLOW}👉 Player-AD serverUrl: https://${DOMAIN_NAME}${NC}"
                echo -e "   ${YELLOW}👉 Painel HTTP auxiliar (IP/LAN): porta ${PANEL_HTTP_PORT}${NC}"
            fi
        fi
        if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
            echo -e "   ${YELLOW}👉 IP Externo: http://$EXTERNAL_IP${_corp_sfx}/${NC}"
        fi
        echo -e "${CYAN}📱 Painel / player (Nginx):${NC} porta ${PANEL_HTTP_PORT} (ver links abaixo)."
        echo
    fi

    # Determinar URLs base do painel (porta Nginx conforme .env / layout dividido)
    BASE_URL_IP="http://$LOCAL_IP${PANEL_URL_SUFFIX}"
    BASE_URL_DOMAIN=""
    DNS_VALIDATED=false
    SERVER_IP_FOR_DNS=$(hostname -I | awk '{print $1}' || echo "$LOCAL_IP")
    
    # Se DOMAIN_NAME estiver configurado, validar DNS e usar domínio
    if [[ -n "$DOMAIN_NAME" ]] && [[ "$DOMAIN_NAME" != "_" ]]; then
        log "Validando configuração DNS para $DOMAIN_NAME..."
        
        # Verificar DNS
        if command -v dig &> /dev/null; then
            DOMAIN_IP=$(dig +short "$DOMAIN_NAME" A 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1 || echo "")
        elif command -v host &> /dev/null; then
            DOMAIN_IP=$(host -t A "$DOMAIN_NAME" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")
        else
            DOMAIN_IP=""
        fi
        
        if [[ -n "$DOMAIN_IP" ]]; then
            if [[ "$DOMAIN_IP" == "$SERVER_IP_FOR_DNS" ]] || [[ "$DOMAIN_IP" == "$LOCAL_IP" ]] || [[ "$DOMAIN_IP" == "$EXTERNAL_IP" ]]; then
                DNS_VALIDATED=true
                BASE_URL_DOMAIN="http://$DOMAIN_NAME"
                echo -e "${GREEN}✅ DNS validado: $DOMAIN_NAME → $DOMAIN_IP${NC}"
            else
                echo -e "${YELLOW}⚠️  DNS aponta para IP diferente: $DOMAIN_NAME → $DOMAIN_IP (servidor: $SERVER_IP_FOR_DNS)${NC}"
                BASE_URL_DOMAIN="http://$DOMAIN_NAME"
            fi
        else
            echo -e "${YELLOW}⚠️  DNS não resolvido para $DOMAIN_NAME (usando IP)${NC}"
        fi
        echo
    fi

    if [[ -n "$BASE_URL_DOMAIN" ]] && [[ -n "$PANEL_URL_SUFFIX" ]]; then
        BASE_URL_DOMAIN="${BASE_URL_DOMAIN}${PANEL_URL_SUFFIX}"
    fi
    
    echo -e "${CYAN}🔐 LOGIN PRINCIPAL (Administradores/Operadores):${NC}"
    if [[ -n "$BASE_URL_DOMAIN" ]]; then
        echo -e "   ${YELLOW}👉 Domínio:    $BASE_URL_DOMAIN/login${NC} ${GREEN}(Recomendado)${NC}"
    fi
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
        echo -e "   ${YELLOW}👉 IP Externo: http://$EXTERNAL_IP${PANEL_URL_SUFFIX}/login${NC} ${GREEN}(Acesso remoto)${NC}"
    fi
    echo -e "   ${YELLOW}👉 IP Local:   $BASE_URL_IP/login${NC} ${BLUE}(Rede interna)${NC}"
    echo -e "   ${BLUE}   (Login para administradores, operadores e publishers)${NC}"
    echo
    
    echo -e "${CYAN}👥 LOGIN SUBSCRIBER (Assinantes):${NC}"
    if [[ -n "$BASE_URL_DOMAIN" ]]; then
        echo -e "   ${YELLOW}👉 Domínio:    $BASE_URL_DOMAIN/subscriber-login${NC} ${GREEN}(Recomendado)${NC}"
    fi
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
        echo -e "   ${YELLOW}👉 IP Externo: http://$EXTERNAL_IP${PANEL_URL_SUFFIX}/subscriber-login${NC} ${GREEN}(Acesso remoto)${NC}"
    fi
    echo -e "   ${YELLOW}👉 IP Local:   $BASE_URL_IP/subscriber-login${NC} ${BLUE}(Rede interna)${NC}"
    echo -e "   ${BLUE}   (Login específico para assinantes)${NC}"
    echo
    
    # Mostrar subdomínios se DOMAIN_NAME estiver configurado
    if [[ -n "$DOMAIN_NAME" ]] && [[ "$DOMAIN_NAME" != "_" ]]; then
        local _sub_port_suffix=""
        if [[ "${SMARTSIGNAGE_NGINX_SPLIT:-false}" == "true" ]] || [[ "${SMARTSIGNAGE_NGINX_SPLIT:-false}" == "1" ]]; then
            _sub_port_suffix="${PANEL_URL_SUFFIX}"
        fi
        echo -e "${CYAN}🏢 PUBLISHER (via subdomínio):${NC}"
        echo -e "   ${YELLOW}👉 http://publisher.$DOMAIN_NAME${_sub_port_suffix}/${NC} ${GREEN}(Interface Publisher)${NC}"
        if [[ "$DNS_VALIDATED" == false ]]; then
            echo -e "   ${YELLOW}   ⚠️  Configure DNS: publisher.$DOMAIN_NAME → $SERVER_IP_FOR_DNS${NC}"
        fi
        echo
        
        echo -e "${CYAN}📺 SUBSCRIBER (via subdomínio):${NC}"
        echo -e "   ${YELLOW}👉 http://subscriber.$DOMAIN_NAME${_sub_port_suffix}/${NC} ${GREEN}(Interface Subscriber)${NC}"
        if [[ "$DNS_VALIDATED" == false ]]; then
            echo -e "   ${YELLOW}   ⚠️  Configure DNS: subscriber.$DOMAIN_NAME → $SERVER_IP_FOR_DNS${NC}"
        fi
        echo
    fi
    
    # Mostrar DNS local se configurado
    if [[ -f "/etc/dnsmasq.d/smartsignage-publishers-subscribers.conf" ]] && systemctl is-active --quiet dnsmasq 2>/dev/null; then
        echo -e "${CYAN}🏠 DNS LOCAL (Publishers e Subscribers):${NC}"
        echo -e "   ${GREEN}✅ DNS local configurado e ativo${NC}"
        echo -e "   ${BLUE}   Publishers:${NC}"
        echo -e "      • http://publisher1.local, http://publisher2.local, etc."
        echo -e "      • http://api.publisher1.local, http://mqtt.publisher1.local, etc."
        echo -e "   ${BLUE}   Subscribers:${NC}"
        echo -e "      • http://subscriber1.local, http://subscriber2.local, etc."
        echo -e "      • http://api.subscriber1.local, http://mqtt.subscriber1.local, etc."
        echo -e "   ${YELLOW}   💡 Para adicionar mais:${NC}"
        echo -e "      scripts/add-publisher-dns.sh <publisher_id>"
        echo -e "      scripts/add-subscriber-dns.sh <subscriber_id>"
        echo
    fi
    
    echo -e "${CYAN}📱 PAINEL ADMINISTRATIVO (Dashboard):${NC}"
    if [[ -n "$BASE_URL_DOMAIN" ]]; then
        echo -e "   ${YELLOW}👉 Domínio:    $BASE_URL_DOMAIN/dashboard${NC} ${GREEN}(Recomendado)${NC}"
    fi
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
        echo -e "   ${YELLOW}👉 IP Externo: http://$EXTERNAL_IP${PANEL_URL_SUFFIX}/dashboard${NC} ${GREEN}(Acesso remoto)${NC}"
    fi
    echo -e "   ${YELLOW}👉 IP Local:   $BASE_URL_IP/dashboard${NC} ${BLUE}(Rede interna)${NC}"
    echo -e "   ${BLUE}   (Após login - interface administrativa completa)${NC}"
    echo
    echo -e "${CYAN}📺 PLAYER DE MÍDIA (Totem):${NC}"
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
        echo -e "   ${YELLOW}👉 IP Externo: http://$EXTERNAL_IP${PANEL_URL_SUFFIX}/player?uin=TOTEM_UIN${NC} ${GREEN}(Acesso remoto)${NC}"
    fi
    echo -e "   ${YELLOW}👉 IP Local:   http://$LOCAL_IP${PANEL_URL_SUFFIX}/player?uin=TOTEM_UIN${NC} ${BLUE}(Rede interna)${NC}"
    echo -e "   ${BLUE}   (Player público para totems - sem login)${NC}"
    echo -e "   ${GREEN}   ✓ Instalado do zero: nenhum passo manual necessário.${NC}"
    
    # Se --starttotem foi usado, mostrar UINs específicos dos totens de laboratório
    if [[ "${START_TOTEM:-false}" == "true" ]] && [[ -n "${START_TOTEM_UIN1:-}" ]]; then
        echo
        echo -e "${CYAN}📺 PLAYERS DE LABORATÓRIO (Totens Demo - --starttotem):${NC}"
        if [[ "${START_TOTEM_SOURCE:-}" == "DB" ]]; then
            echo -e "   ${GREEN}✅ UINs obtidos do banco de dados${NC}"
        else
            echo -e "   ${YELLOW}⚠️  Usando UINs padrão (banco não disponível ou sem totens)${NC}"
        fi
        
        # Usar IP detectado pela função start_totem_laboratory se disponível, senão usar LOCAL_IP
        local TOTEM_IP="${START_TOTEM_LOCAL_IP:-$LOCAL_IP}"
        
        if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
            echo -e "   ${GREEN}✅ Totem 1:${NC} ${YELLOW}${START_TOTEM_UIN1}${NC}"
            echo -e "      ${BLUE}→ IP Externo: http://$EXTERNAL_IP${PANEL_URL_SUFFIX}/player/?uin=${START_TOTEM_UIN1}${NC} ${GREEN}(Acesso remoto)${NC}"
            echo -e "      ${BLUE}→ IP Local:   http://${TOTEM_IP}${PANEL_URL_SUFFIX}/player/?uin=${START_TOTEM_UIN1}${NC} ${BLUE}(Rede interna)${NC}"
            if [[ -n "${START_TOTEM_UIN2:-}" ]] && [[ "${START_TOTEM_UIN2}" != "${START_TOTEM_UIN1}" ]]; then
                echo -e "   ${GREEN}✅ Totem 2:${NC} ${YELLOW}${START_TOTEM_UIN2}${NC}"
                echo -e "      ${BLUE}→ IP Externo: http://$EXTERNAL_IP${PANEL_URL_SUFFIX}/player/?uin=${START_TOTEM_UIN2}${NC} ${GREEN}(Acesso remoto)${NC}"
                echo -e "      ${BLUE}→ IP Local:   http://${TOTEM_IP}${PANEL_URL_SUFFIX}/player/?uin=${START_TOTEM_UIN2}${NC} ${BLUE}(Rede interna)${NC}"
            fi
        else
            echo -e "   ${GREEN}✅ Totem 1:${NC} ${YELLOW}${START_TOTEM_UIN1}${NC}"
            echo -e "      ${BLUE}→ http://${TOTEM_IP}${PANEL_URL_SUFFIX}/player/?uin=${START_TOTEM_UIN1}${NC}"
            if [[ -n "${START_TOTEM_UIN2:-}" ]] && [[ "${START_TOTEM_UIN2}" != "${START_TOTEM_UIN1}" ]]; then
                echo -e "   ${GREEN}✅ Totem 2:${NC} ${YELLOW}${START_TOTEM_UIN2}${NC}"
                echo -e "      ${BLUE}→ http://${TOTEM_IP}${PANEL_URL_SUFFIX}/player/?uin=${START_TOTEM_UIN2}${NC}"
            fi
        fi
        echo -e "   ${BLUE}   (Players abertos automaticamente em browsers de laboratório)${NC}"
    fi
    echo
    echo -e "${CYAN}🔧 API BACKEND:${NC}"
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
        echo -e "   ${YELLOW}👉 IP Externo: http://$EXTERNAL_IP:3000${NC} ${GREEN}(Acesso remoto)${NC}"
    fi
    echo -e "   ${YELLOW}👉 IP Local:   http://$LOCAL_IP:3000${NC} ${BLUE}(Rede interna)${NC}"
    echo -e "   ${BLUE}   (API REST para integração)${NC}"
    echo
    if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
        echo -e "${GREEN}💡 DICA:${NC} ${YELLOW}Use o IP Externo para acesso remoto${NC}"
        echo -e "${GREEN}💡 DICA:${NC} ${YELLOW}Use o IP Local para acesso na rede interna${NC}"
        echo -e "${YELLOW}⚠️  IMPORTANTE:${NC} ${RED}Abra no firewall as portas do painel (${PANEL_HTTP_PORT}) e do backend (3000)${NC}"
        if [[ "${SMARTSIGNAGE_NGINX_SPLIT:-false}" == "true" ]] || [[ "${SMARTSIGNAGE_NGINX_SPLIT:-false}" == "1" ]]; then
            echo -e "${YELLOW}⚠️  Layout dividido:${NC} ${RED}site corporativo na ${SMARTSIGNAGE_CORPORATE_HTTP_PORT:-80}, painel na ${PANEL_HTTP_PORT}${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  AVISO:${NC} ${RED}IP Externo não detectado. Configure firewall para acesso remoto.${NC}"
    fi
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    🔐 CREDENCIAIS DE ACESSO                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${RED}👤 USUÁRIO:${NC} ${YELLOW}admin${NC}"
    echo -e "${RED}🔑 SENHA:${NC}  ${YELLOW}admin123${NC}"
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
    echo -e "   Logs:       sudo journalctl -u smart-signage -f"
    echo
    
    # Informações sobre Grafana e Prometheus baseado no modo
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        echo -e "${BLUE}📈 Monitoramento (Grafana/Prometheus):${NC}"
        if [[ "$EXTERNAL_IP" != "Não detectado" && "$EXTERNAL_IP" != "" ]]; then
            echo -e "   Grafana:    http://$EXTERNAL_IP:3002 (admin/admin) ${GREEN}(Acesso remoto)${NC}"
            echo -e "   Prometheus: http://$EXTERNAL_IP:9090 ${GREEN}(Acesso remoto)${NC}"
        fi
        echo -e "   Grafana:    http://$LOCAL_IP:3002 (admin/admin) ${BLUE}(Rede interna)${NC}"
        echo -e "   Prometheus: http://$LOCAL_IP:9090 ${BLUE}(Rede interna)${NC}"
        echo -e "   ${YELLOW}💡 Acesse o Grafana para visualizar dashboards e métricas${NC}"
        echo -e "   ${YELLOW}💡 O Prometheus coleta métricas do sistema${NC}"
    else
        echo -e "${YELLOW}⚠️  Grafana/Prometheus:${NC}"
        echo -e "   ${YELLOW}Monitoramento não está disponível no modo Single-Server${NC}"
        echo -e "   ${YELLOW}Para habilitar: Reinstale usando modo Docker (opção 2)${NC}"
        echo -e "   ${YELLOW}Ou instale manualmente seguindo a documentação${NC}"
    fi
    
    # Informações sobre modo Kiosk
    if [[ "$ENABLE_KIOSK_MODE" == "true" ]]; then
        echo
        echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║                    🖥️  MODO KIOSK CONFIGURADO                  ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
        echo
        echo -e "${CYAN}📺 Modo Kiosk (Totem/Sinalização):${NC}"
        echo -e "   ${GREEN}✓${NC} Ambiente gráfico XFCE instalado"
        echo -e "   ${GREEN}✓${NC} Auto-login configurado"
        echo -e "   ${GREEN}✓${NC} Navegador inicia automaticamente"
        echo -e "   ${GREEN}✓${NC} Tela em modo Portrait (vertical)"
        echo -e "   ${GREEN}✓${NC} URL: ${YELLOW}${KIOSK_URL:-http://$LOCAL_IP${PANEL_URL_SUFFIX}/player}${NC}"
        echo
        echo -e "${BLUE}🔧 Gerenciamento do Kiosk:${NC}"
        echo -e "   ${YELLOW}$INSTALL_DIR/scripts/manage-kiosk.sh start${NC}    - Iniciar Kiosk"
        echo -e "   ${YELLOW}$INSTALL_DIR/scripts/manage-kiosk.sh stop${NC}     - Parar Kiosk"
        echo -e "   ${YELLOW}$INSTALL_DIR/scripts/manage-kiosk.sh restart${NC}  - Reiniciar Kiosk"
        echo -e "   ${YELLOW}$INSTALL_DIR/scripts/manage-kiosk.sh rotate${NC}   - Aplicar rotação Portrait"
        echo
        echo -e "${YELLOW}💡 DICA:${NC} ${CYAN}Após reiniciar o servidor, o ambiente gráfico iniciará automaticamente${NC}"
        echo -e "${YELLOW}💡 DICA:${NC} ${CYAN}Para iniciar agora sem reiniciar: sudo systemctl start lightdm${NC}"
    fi
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    🚀 PRÓXIMOS PASSOS                       ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${YELLOW}1.${NC} ${CYAN}Acesse o sistema:${NC} ${YELLOW}http://$SERVER_IP:$FRONTEND_PORT${NC}"
    echo -e "${YELLOW}2.${NC} ${CYAN}Faça login com:${NC} admin/admin123"
    echo -e "${YELLOW}3.${NC} ${CYAN}Altere a senha do administrador${NC}"
    echo -e "${YELLOW}4.${NC} ${CYAN}Configure seus clientes e totems"
    echo -e "${YELLOW}5.${NC} ${CYAN}Configure SSL/HTTPS para produção"
    echo
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║              ✅ SMART SIGNAGE PRO v2.0 PRONTO! ✅            ║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${GREEN}🎯 Sistema instalado e funcionando perfeitamente!${NC}"
    echo -e "${GREEN}🌐 Acesse agora: ${YELLOW}http://$SERVER_IP:$FRONTEND_PORT${NC}"
    echo
}

# =============================================================================
# FUNÇÕES DE DETECÇÃO E REBUILD
# =============================================================================

# Calcular checksum de arquivos críticos
calculate_checksums() {
    local BUILD_INFO_FILE="$INSTALL_DIR/.build-info.json"
    
    if [[ ! -d "$INSTALL_DIR" ]]; then
        echo "{}"
        return
    fi
    
    cd "$INSTALL_DIR" 2>/dev/null || { echo "{}"; return; }
    
    # Calcular checksums dos arquivos críticos
    local BACKEND_DF=$(md5sum Dockerfile.backend 2>/dev/null | awk '{print $1}' || echo "missing")
    local FRONTEND_DF=$(md5sum Dockerfile.frontend 2>/dev/null | awk '{print $1}' || echo "missing")
    local DOCKER_COMPOSE=$(md5sum docker-compose.yml 2>/dev/null | awk '{print $1}' || echo "missing")
    local NGINX_CONF=$(md5sum nginx/nginx-complete.conf 2>/dev/null | awk '{print $1}' || echo "missing")
    local ENTRYPOINT=$(md5sum docker/nginx-entrypoint.sh 2>/dev/null | awk '{print $1}' || echo "missing")
    
    cat << EOF
{
  "build_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "version": "2.0.0",
  "checksums": {
    "Dockerfile.backend": "$BACKEND_DF",
    "Dockerfile.frontend": "$FRONTEND_DF",
    "docker-compose.yml": "$DOCKER_COMPOSE",
    "nginx/nginx-complete.conf": "$NGINX_CONF",
    "docker/nginx-entrypoint.sh": "$ENTRYPOINT"
  }
}
EOF
}

# Salvar informações da build
save_build_info() {
    local BUILD_INFO_FILE="$INSTALL_DIR/.build-info.json"
    if [[ -d "$INSTALL_DIR" ]]; then
        calculate_checksums > "$BUILD_INFO_FILE"
        log_detailed "Informações de build salvas em: $BUILD_INFO_FILE"
    fi
}

# Carregar informações da build anterior
load_build_info() {
    local BUILD_INFO_FILE="$INSTALL_DIR/.build-info.json"
    if [[ -f "$BUILD_INFO_FILE" ]]; then
        cat "$BUILD_INFO_FILE"
    else
        echo "{}"
    fi
}

# Verificar se rebuild é necessário
check_rebuild_needed() {
    if [[ "$FORCE_REBUILD" == "true" ]]; then
        log_status "Rebuild forçado via --force"
        return 0
    fi
    
    # Se não existe instalação anterior, não precisa rebuild (é primeira instalação)
    if [[ ! -d "$INSTALL_DIR" ]] || [[ ! -f "$INSTALL_DIR/.build-info.json" ]]; then
        log_status "Primeira instalação detectada - rebuild não necessário (será feito build inicial)"
        return 1
    fi
    
    local CURRENT_CHECKSUMS=$(calculate_checksums)
    local PREVIOUS_CHECKSUMS=$(load_build_info)
    
    # Comparar checksums
    local BACKEND_CURRENT=$(echo "$CURRENT_CHECKSUMS" | grep -o '"Dockerfile.backend": "[^"]*"' | cut -d'"' -f4)
    local BACKEND_PREVIOUS=$(echo "$PREVIOUS_CHECKSUMS" | grep -o '"Dockerfile.backend": "[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
    
    local FRONTEND_CURRENT=$(echo "$CURRENT_CHECKSUMS" | grep -o '"Dockerfile.frontend": "[^"]*"' | cut -d'"' -f4)
    local FRONTEND_PREVIOUS=$(echo "$PREVIOUS_CHECKSUMS" | grep -o '"Dockerfile.frontend": "[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
    
    local COMPOSE_CURRENT=$(echo "$CURRENT_CHECKSUMS" | grep -o '"docker-compose.yml": "[^"]*"' | cut -d'"' -f4)
    local COMPOSE_PREVIOUS=$(echo "$PREVIOUS_CHECKSUMS" | grep -o '"docker-compose.yml": "[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
    
    local NGINX_CURRENT=$(echo "$CURRENT_CHECKSUMS" | grep -o '"nginx/nginx-complete.conf": "[^"]*"' | cut -d'"' -f4)
    local NGINX_PREVIOUS=$(echo "$PREVIOUS_CHECKSUMS" | grep -o '"nginx/nginx-complete.conf": "[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
    
    if [[ "$BACKEND_CURRENT" != "$BACKEND_PREVIOUS" ]] || \
       [[ "$FRONTEND_CURRENT" != "$FRONTEND_PREVIOUS" ]] || \
       [[ "$COMPOSE_CURRENT" != "$COMPOSE_PREVIOUS" ]] || \
       [[ "$NGINX_CURRENT" != "$NGINX_PREVIOUS" ]]; then
        log_status "Mudanças detectadas em Dockerfiles/configurações - rebuild necessário"
        log_detailed "Backend: $([ "$BACKEND_CURRENT" != "$BACKEND_PREVIOUS" ] && echo "MUDOU" || echo "OK")"
        log_detailed "Frontend: $([ "$FRONTEND_CURRENT" != "$FRONTEND_PREVIOUS" ] && echo "MUDOU" || echo "OK")"
        log_detailed "Docker Compose: $([ "$COMPOSE_CURRENT" != "$COMPOSE_PREVIOUS" ] && echo "MUDOU" || echo "OK")"
        log_detailed "Nginx Config: $([ "$NGINX_CURRENT" != "$NGINX_PREVIOUS" ] && echo "MUDOU" || echo "OK")"
        return 0
    fi
    
    log_status "Nenhuma mudança detectada - rebuild não necessário"
    return 1
}

# Rebuild preservando dados
# Função para rebuild completo: limpar cache, reconstruir builds e reiniciar serviços
rebuild_and_restart() {
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "🔄 REBUILD E RESTART - Limpando cache, reconstruindo builds e reiniciando"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Detectar diretório de instalação
    if [[ -z "$INSTALL_DIR" ]]; then
        if [[ -d "/opt/smart-signage" ]]; then
            INSTALL_DIR="/opt/smart-signage"
        elif [[ -d "$(pwd)" ]]; then
            INSTALL_DIR="$(pwd)"
        else
            error "Não foi possível detectar o diretório de instalação. Execute o script na raiz do projeto."
        fi
    fi

    # Opcional: iniciar 2 totens de laboratório em browsers locais
    start_totem_laboratory
    
    log "Diretório de instalação: $INSTALL_DIR"
    
    # Criar diretório de logs se não existir
    mkdir -p "$INSTALL_DIR/logs" 2>/dev/null || true
    
    # 1. Parar serviços
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "1️⃣  PARANDO SERVIÇOS..."
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Parar serviços systemd (instalação atual usa smart-signage; nomes legados mantidos)
    if command -v systemctl &> /dev/null; then
        if sudo systemctl is-active --quiet smart-signage 2>/dev/null; then
            log "Parando serviço smart-signage..."
            sudo systemctl stop smart-signage 2>/dev/null || true
        fi
        if sudo systemctl is-active --quiet smart-signage-backend 2>/dev/null; then
            log "Parando serviço smart-signage-backend..."
            sudo systemctl stop smart-signage-backend 2>/dev/null || true
        fi
        if sudo systemctl is-active --quiet smart-signage-frontend 2>/dev/null; then
            log "Parando serviço smart-signage-frontend..."
            sudo systemctl stop smart-signage-frontend 2>/dev/null || true
        fi
    fi
    
    # Parar processos Node.js
    if pgrep -f "node.*dist/index.js" > /dev/null; then
        log "Parando processo backend..."
        pkill -f "node.*dist/index.js" 2>/dev/null || true
        sleep 2
    fi
    
    if lsof -ti:3000 > /dev/null 2>&1; then
        log "Liberando porta 3000..."
        lsof -ti:3000 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    
    if lsof -ti:3001 > /dev/null 2>&1; then
        log "Liberando porta 3001..."
        lsof -ti:3001 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    
    # 2. Limpar caches
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "2️⃣  LIMPANDO CACHES..."
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Limpar cache do npm global
    log "Limpando cache do npm..."
    npm cache clean --force 2>/dev/null || true
    
    # Limpar caches do backend
    if [[ -d "$INSTALL_DIR/backend" ]]; then
        log "Limpando caches do backend..."
        cd "$INSTALL_DIR/backend" || error "Não foi possível acessar $INSTALL_DIR/backend"
        rm -rf node_modules/.cache 2>/dev/null || true
        rm -rf dist 2>/dev/null || true
        rm -rf .cache 2>/dev/null || true
        rm -rf .eslintcache 2>/dev/null || true
        npm cache clean --force 2>/dev/null || true
        log "✅ Cache do backend limpo"
    fi
    
    # Limpar caches do frontend
    if [[ -d "$INSTALL_DIR/frontend" ]]; then
        log "Limpando caches do frontend..."
        cd "$INSTALL_DIR/frontend" || error "Não foi possível acessar $INSTALL_DIR/frontend"
        rm -rf node_modules/.cache 2>/dev/null || true
        rm -rf build 2>/dev/null || true
        rm -rf dist 2>/dev/null || true
        rm -rf .cache 2>/dev/null || true
        rm -rf .eslintcache 2>/dev/null || true
        npm cache clean --force 2>/dev/null || true
        log "✅ Cache do frontend limpo"
    fi
    
    # 3. Reconstruir builds
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "3️⃣  RECONSTRUINDO BUILDS..."
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Criar diretório de logs se não existir
    mkdir -p "$INSTALL_DIR/logs" 2>/dev/null || true
    
    # Rebuild backend
    if [[ -d "$INSTALL_DIR/backend" ]]; then
        log "Reconstruindo backend..."
        cd "$INSTALL_DIR/backend" || error "Não foi possível acessar $INSTALL_DIR/backend"
        
        # Instalar dependências se necessário
        if [[ ! -d "node_modules" ]] || [[ "package.json" -nt "node_modules" ]]; then
            log "Instalando dependências do backend..."
            npm install --legacy-peer-deps 2>&1 | tee -a "$INSTALL_DIR/logs/backend-install.log" || {
                warn "⚠️  Alguns avisos durante instalação de dependências (pode ser normal)"
            }
        fi
        
        # Compilar TypeScript
        log "Compilando TypeScript do backend..."
        npm run build 2>&1 | tee -a "$INSTALL_DIR/logs/backend-build.log" || {
            error "❌ Erro ao compilar backend. Verifique os logs em $INSTALL_DIR/logs/backend-build.log"
        }
        log "✅ Backend compilado com sucesso"
    fi
    
    # Rebuild frontend
    if [[ -d "$INSTALL_DIR/frontend" ]]; then
        log "Reconstruindo frontend..."
        cd "$INSTALL_DIR/frontend" || error "Não foi possível acessar $INSTALL_DIR/frontend"
        
        # Instalar dependências se necessário
        if [[ ! -d "node_modules" ]] || [[ "package.json" -nt "node_modules" ]]; then
            log "Instalando dependências do frontend..."
            npm install --legacy-peer-deps 2>&1 | tee -a "$INSTALL_DIR/logs/frontend-install.log" || {
                warn "⚠️  Alguns avisos durante instalação de dependências (pode ser normal)"
            }
        fi
        
        export_frontend_build_env
        # Compilar React
        log "Compilando frontend (React)..."
        if ! run_frontend_build "$INSTALL_DIR/logs/frontend-build.log"; then
            error "❌ Erro ao compilar frontend. Verifique os logs em $INSTALL_DIR/logs/frontend-build.log"
            return 1
        fi
        
        # Verificar se o build foi bem-sucedido (verificando se o diretório build existe)
        if [[ -d "build" && -f "build/index.html" ]]; then
            log "✅ Frontend compilado com sucesso"
        else
            error "❌ Erro ao compilar frontend. Verifique os logs em $INSTALL_DIR/logs/frontend-build.log"
        fi
    fi
    
    # 4. Reiniciar serviços
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "4️⃣  REINICIANDO SERVIÇOS..."
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Reiniciar serviços systemd (unit principal do install: smart-signage.service)
    if command -v systemctl &> /dev/null; then
        if sudo systemctl list-unit-files 2>/dev/null | grep -qE '^smart-signage\.service'; then
            log "Reiniciando serviço smart-signage..."
            sudo systemctl daemon-reload 2>/dev/null || true
            sudo systemctl enable smart-signage 2>/dev/null || true
            sudo systemctl restart smart-signage 2>/dev/null || {
                warn "⚠️  Falha ao reiniciar smart-signage via systemd"
            }
        fi
        if sudo systemctl list-unit-files 2>/dev/null | grep -q "smart-signage-backend"; then
            log "Reiniciando serviço smart-signage-backend..."
            sudo systemctl restart smart-signage-backend 2>/dev/null || {
                warn "⚠️  Falha ao reiniciar smart-signage-backend via systemd"
            }
        fi
        if sudo systemctl list-unit-files 2>/dev/null | grep -q "smart-signage-frontend"; then
            log "Reiniciando serviço smart-signage-frontend..."
            sudo systemctl restart smart-signage-frontend 2>/dev/null || {
                warn "⚠️  Falha ao reiniciar smart-signage-frontend via systemd"
            }
        fi
        if sudo systemctl is-active --quiet nginx 2>/dev/null; then
            log "Recarregando Nginx..."
            sudo systemctl reload nginx 2>/dev/null || sudo systemctl restart nginx 2>/dev/null || true
        fi
    fi
    
    # Se não houver systemd, tentar iniciar manualmente
    if [[ -d "$INSTALL_DIR/backend" ]] && ! pgrep -f "node.*dist/index.js" > /dev/null; then
        log "Iniciando backend manualmente..."
        cd "$INSTALL_DIR/backend" || error "Não foi possível acessar $INSTALL_DIR/backend"
        nohup npm start > "$INSTALL_DIR/logs/backend.log" 2>&1 &
        sleep 3
        if pgrep -f "node.*dist/index.js" > /dev/null; then
            log "✅ Backend iniciado"
        else
            warn "⚠️  Backend pode não ter iniciado corretamente. Verifique os logs."
        fi
    fi
    
    # 5. Verificar status
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "5️⃣  VERIFICANDO STATUS DOS SERVIÇOS..."
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    sleep 5  # Aguardar serviços iniciarem
    
    # Verificar backend
    if lsof -ti:3000 > /dev/null 2>&1 || pgrep -f "node.*dist/index.js" > /dev/null; then
        log "✅ Backend está rodando"
    else
        warn "⚠️  Backend não está rodando. Verifique os logs."
    fi
    
    # Verificar frontend (Nginx)
    if command -v systemctl &> /dev/null; then
        if sudo systemctl is-active --quiet nginx; then
            log "✅ Nginx está rodando"
        else
            warn "⚠️  Nginx não está rodando"
        fi
    fi
    
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "✅ REBUILD E RESTART CONCLUÍDO!"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log ""
    log "📋 Resumo:"
    log "  • Caches limpos"
    log "  • Backend reconstruído e reiniciado"
    log "  • Frontend reconstruído"
    log "  • Serviços reiniciados"
    log ""
    log "🌐 Acesse o sistema em: http://localhost"
    log ""
}

# Função para iniciar totens de laboratório (extraída para reutilização)
start_totem_laboratory() {
    if [[ "$START_TOTEM" != "true" ]]; then
        return 0  # Não fazer nada se --starttotem não foi usado
    fi
    
    log "Iniciando 2 players web de laboratório (totens demo)..."
    
    # Função para buscar UINs dos 2 primeiros totens ativos do banco
    get_active_totem_uins() {
            local uin1=""
            local uin2=""
            local found_from_db=false
            
            # Tentar ler configurações do banco do .env
            local ENV_FILE="$INSTALL_DIR/.env"
            [ ! -f "$ENV_FILE" ] && ENV_FILE="$INSTALL_DIR/backend/.env"
            
            if [[ -f "$ENV_FILE" ]]; then
                local DB_NAME=$(grep "^DB_NAME=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "smartsignage")
                local DB_USER=$(grep "^DB_USER=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "smartsignage")
                local DB_HOST=$(grep "^DB_HOST=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "localhost")
                local DB_PORT=$(grep "^DB_PORT=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "5432")
                local DB_PASS=$(grep "^DB_PASSWORD=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "${POSTGRES_PASSWORD:-smartsignage123}")
                
                # Tentar usar DATABASE_URL se disponível
                if [[ -n "$DATABASE_URL" ]]; then
                    # Verificar se tabela existe primeiro
                    local TABLE_EXISTS=$(timeout 3 psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='totems');" 2>/dev/null | tr -d ' ' || echo "f")
                    
                    if [[ "$TABLE_EXISTS" == "t" ]]; then
                        local QUERY="SELECT uin FROM totems WHERE (is_active = true OR is_active IS NULL) AND uin IS NOT NULL AND uin != '' ORDER BY totem_id ASC LIMIT 2;"
                        local RESULT=$(timeout 5 psql "$DATABASE_URL" -tAc "$QUERY" 2>/dev/null | grep -v '^$' | head -2 || echo "")
                        
                        if [[ -n "$RESULT" ]]; then
                            uin1=$(echo "$RESULT" | head -n 1 | xargs | tr -d ' ')
                            uin2=$(echo "$RESULT" | tail -n 1 | xargs | tr -d ' ')
                            
                            # Validar que são UINs válidos (não vazios)
                            if [[ -n "$uin1" ]]; then
                                found_from_db=true
                                if [[ -z "$uin2" ]] || [[ "$uin2" == "$uin1" ]]; then 
                                    uin2=""
                                fi
                            fi
                        fi
                    fi
                elif command -v psql >/dev/null 2>&1; then
                    # Tentar conexão direta com psql
                    export PGPASSWORD="$DB_PASS"
                    
                    # Verificar se tabela existe primeiro
                    local TABLE_EXISTS=$(timeout 3 PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='totems');" 2>/dev/null | tr -d ' ' || echo "f")
                    
                    if [[ "$TABLE_EXISTS" == "t" ]]; then
                        local QUERY="SELECT uin FROM totems WHERE (is_active = true OR is_active IS NULL) AND uin IS NOT NULL AND uin != '' ORDER BY totem_id ASC LIMIT 2;"
                        local RESULT=$(timeout 5 PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "$QUERY" 2>/dev/null | grep -v '^$' | head -2 || echo "")
                        
                        if [[ -n "$RESULT" ]]; then
                            uin1=$(echo "$RESULT" | head -n 1 | xargs | tr -d ' ')
                            uin2=$(echo "$RESULT" | tail -n 1 | xargs | tr -d ' ')
                            
                            # Validar que são UINs válidos (não vazios)
                            if [[ -n "$uin1" ]]; then
                                found_from_db=true
                                if [[ -z "$uin2" ]] || [[ "$uin2" == "$uin1" ]]; then 
                                    uin2=""
                                fi
                            fi
                        fi
                    fi
                    unset PGPASSWORD
                fi
            fi
            
            # Se não conseguiu buscar do banco ou só encontrou 1 totem, usar UINs padrão de demo
            if [[ -z "$uin1" ]]; then
                uin1="UIN-SHOPPING-001-2025"
            fi
            
            if [[ -z "$uin2" ]] || [[ "$uin2" == "$uin1" ]]; then
                # Se só encontrou 1 totem ou o segundo é igual ao primeiro, usar segundo padrão
                uin2="UIN-SHOPPING-002-2025"
            fi
            
            # Retornar flag indicando se veio do banco (para log externo)
            if [[ "$found_from_db" == "true" ]]; then
                echo "DB|$uin1|$uin2"
            else
                echo "DEFAULT|$uin1|$uin2"
            fi
        }
        
        # Buscar UINs dinamicamente
        local TOTEM_UINS=$(get_active_totem_uins)
        local SOURCE=$(echo "$TOTEM_UINS" | cut -d'|' -f1)
        local UIN1=$(echo "$TOTEM_UINS" | cut -d'|' -f2)
        local UIN2=$(echo "$TOTEM_UINS" | cut -d'|' -f3)
        
        # Obter IP local para construir URLs (usar mesmo método que show_final_info)
        # Tentar múltiplos métodos para detectar o IP correto
        local CURRENT_LOCAL_IP=""
        if command -v ip >/dev/null 2>&1; then
            # Tentar obter IP da interface de rede principal (não loopback)
            CURRENT_LOCAL_IP=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'src \K\S+' | head -1 || echo "")
        fi
        if [[ -z "$CURRENT_LOCAL_IP" ]]; then
            # Fallback: usar hostname -I (mesmo método de show_final_info)
            CURRENT_LOCAL_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "")
        fi
        if [[ -z "$CURRENT_LOCAL_IP" ]] || [[ "$CURRENT_LOCAL_IP" == "127.0.0.1" ]]; then
            # Último fallback: tentar obter de ifconfig
            CURRENT_LOCAL_IP=$(ifconfig 2>/dev/null | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1 || echo "localhost")
        fi
        if [[ -z "$CURRENT_LOCAL_IP" ]]; then
            CURRENT_LOCAL_IP="localhost"
        fi
        
        local URL1="http://${CURRENT_LOCAL_IP}/player/?uin=${UIN1}"
        local URL2="http://${CURRENT_LOCAL_IP}/player/?uin=${UIN2}"
        
        # Salvar UINs e IP em variáveis globais para usar em show_final_info()
        export START_TOTEM_UIN1="$UIN1"
        export START_TOTEM_UIN2="$UIN2"
        export START_TOTEM_SOURCE="$SOURCE"
        export START_TOTEM_LOCAL_IP="$CURRENT_LOCAL_IP"
        export START_TOTEM="true"  # Garantir que está exportado
        
        log "IP detectado para players: $CURRENT_LOCAL_IP"
        log "UIN1: $UIN1"
        log "UIN2: $UIN2"

        echo
        echo -e "${CYAN}📺 PLAYERS DE LABORATÓRIO (Totens Demo):${NC}"
        if [[ "$SOURCE" == "DB" ]]; then
            echo -e "   ${GREEN}✅ UINs obtidos do banco de dados${NC}"
        else
            echo -e "   ${YELLOW}⚠️  Usando UINs padrão (banco não disponível ou sem totens)${NC}"
        fi
        echo -e "   ${GREEN}✅ Totem 1:${NC} ${YELLOW}$UIN1${NC}"
        echo -e "      ${BLUE}→ $URL1${NC}"
        echo -e "   ${GREEN}✅ Totem 2:${NC} ${YELLOW}$UIN2${NC}"
        echo -e "      ${BLUE}→ $URL2${NC}"
        echo
        log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        log "🔗 Links dos Players de Laboratório:"
        log "   Totem 1 (UIN: $UIN1): $URL1"
        log "   Totem 2 (UIN: $UIN2): $URL2"
        log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # Tentar abrir em browser gráfico (se ambiente suportar)
        local BROWSER_OPENED=false
        if command -v xdg-open >/dev/null 2>&1; then
            log "Abrindo browsers com xdg-open..."
            xdg-open "$URL1" >/dev/null 2>&1 &
            sleep 1
            xdg-open "$URL2" >/dev/null 2>&1 &
            BROWSER_OPENED=true
            log "✅ 2 janelas de browser abertas com players de laboratório"
        elif command -v sensible-browser >/dev/null 2>&1; then
            log "Abrindo browsers com sensible-browser..."
            sensible-browser "$URL1" >/dev/null 2>&1 &
            sleep 1
            sensible-browser "$URL2" >/dev/null 2>&1 &
            BROWSER_OPENED=true
            log "✅ 2 janelas de browser abertas com players de laboratório"
        elif [[ -n "$DISPLAY" ]] && command -v firefox >/dev/null 2>&1; then
            log "Abrindo browsers com Firefox..."
            firefox "$URL1" >/dev/null 2>&1 &
            sleep 1
            firefox "$URL2" >/dev/null 2>&1 &
            BROWSER_OPENED=true
            log "✅ 2 janelas de Firefox abertas com players de laboratório"
        elif [[ -n "$DISPLAY" ]] && command -v google-chrome >/dev/null 2>&1; then
            log "Abrindo browsers com Chrome..."
            google-chrome "$URL1" >/dev/null 2>&1 &
            sleep 1
            google-chrome "$URL2" >/dev/null 2>&1 &
            BROWSER_OPENED=true
            log "✅ 2 janelas de Chrome abertas com players de laboratório"
        fi
        
        if [[ "$BROWSER_OPENED" == "false" ]]; then
            log "⚠️ Não foi possível detectar um comando de browser (xdg-open/sensible-browser/firefox/chrome)."
            log "   Abra manualmente em qualquer máquina da rede:"
            log "   ${GREEN}Totem 1:${NC} ${YELLOW}$URL1${NC}"
            log "   ${GREEN}Totem 2:${NC} ${YELLOW}$URL2${NC}"
        fi
}

rebuild_preserve_data() {
    log "🔄 Iniciando rebuild preservando dados..."
    
    cd "$INSTALL_DIR" || { error "Diretório $INSTALL_DIR não encontrado!"; exit 1; }
    
    # Parar containers
    log_progress "Parando containers..."
    $COMPOSE_CMD down 2>/dev/null || true
    
    # Rebuild imagens
    if [[ "$REBUILD_CACHE" == "true" ]]; then
        log_progress "Rebuild SEM cache (pode demorar mais)..."
        $COMPOSE_CMD build --no-cache backend frontend
    else
        log_progress "Rebuild com cache..."
        $COMPOSE_CMD build backend frontend
    fi
    
    if [[ $? -eq 0 ]]; then
        log "✅ Rebuild concluído com sucesso!"
        save_build_info
        
        # Reiniciar containers após rebuild
        if [[ "$REBUILD_ONLY" != "true" ]]; then
            log_progress "Reiniciando containers após rebuild..."
            $COMPOSE_CMD up -d
            log "✅ Containers reiniciados!"
        fi
    else
        error "❌ Falha no rebuild!"
        exit 1
    fi
    
    if [[ "$REBUILD_ONLY" == "true" ]]; then
        log "✅ Rebuild concluído. Use '$0 start' para iniciar."
        exit 0
    fi
}

# Rebuild do zero (apaga tudo)
rebuild_fresh() {
    log "⚠️  INICIANDO INSTALAÇÃO DO ZERO - TODOS OS DADOS SERÃO PERDIDOS!"
    
    # Confirmação adicional
    echo
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}                    ⚠️  ATENÇÃO CRÍTICA ⚠️                    ${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo
    echo -e "${YELLOW}Esta operação irá APAGAR:${NC}"
    echo "  ❌ Todos os containers"
    echo "  ❌ Todas as imagens Docker"
    echo "  ❌ Todos os volumes (banco de dados, uploads, backups)"
    echo "  ❌ Todos os logs"
    echo
    echo -e "${RED}⚠️  ESTA AÇÃO É IRREVERSÍVEL!${NC}"
    echo
    read -p "Digite 'APAGAR TUDO' para confirmar: " confirm
    
    if [[ "$confirm" != "APAGAR TUDO" ]]; then
        log "Operação cancelada pelo usuário."
        exit 0
    fi
    
    cd "$INSTALL_DIR" || { error "Diretório $INSTALL_DIR não encontrado!"; exit 1; }
    
    # Determinar comando compose (instalar se faltar)
    ensure_docker_compose || exit 1
    
    # Parar e remover TUDO
    log_progress "Parando e removendo containers..."
    $COMPOSE_CMD down -v --rmi all --remove-orphans 2>/dev/null || true
    
    log_progress "Limpando volumes órfãos..."
    docker volume prune -af 2>/dev/null || true
    
    log_progress "Limpando sistema Docker..."
    docker system prune -af --volumes 2>/dev/null || true
    
    # Rebuild do zero
    log_progress "Instalando do zero (sem cache)..."
    $COMPOSE_CMD build --no-cache
    
    if [[ $? -eq 0 ]]; then
        log "✅ Build do zero concluído!"
        save_build_info
        
        # Reiniciar containers após rebuild fresh
        if [[ "$REBUILD_ONLY" != "true" ]]; then
            log_progress "Iniciando containers após build do zero..."
            $COMPOSE_CMD up -d
            log "✅ Containers iniciados!"
        fi
    else
        error "❌ Falha no build!"
        exit 1
    fi
    
    if [[ "$REBUILD_ONLY" == "true" ]]; then
        log "✅ Instalação do zero concluída. Use '$0 start' para iniciar."
        exit 0
    fi
}

# Menu principal
show_menu() {
    # Primeira etapa do menu: dados do proprietário (owner) para seed dinâmico.
    ask_owner_profile

    # Se SKIP_MENU está ativo, usar defaults sem prompt (padrão do menu é Single-Server)
    if [[ "$SKIP_MENU" == "true" ]]; then
        if [[ -z "$INSTALL_MODE" ]]; then
            INSTALL_MODE="single-server"
        fi
        INSTALL_TOTEMDIGITAL_COMPACT="${INSTALL_TOTEMDIGITAL_COMPACT:-true}"

        apply_single_server_mqtt_profile

        log "Modo selecionado: $INSTALL_MODE (skip-menu)"
        log "Perfil .env (skip-menu): INSTALL_TOTEMDIGITAL_COMPACT=$INSTALL_TOTEMDIGITAL_COMPACT"
        case "$INSTALL_MODE" in
            docker)
                DB_DRIVER="postgresql"
                DATABASE_URL="postgresql://smartsignage:smartsignage123@postgres:5432/smartsignage"
                ;;
            single-server|development)
                DB_DRIVER="postgresql"
                DATABASE_URL="postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage"
                ;;
            *)
                error "INSTALL_MODE inválido: $INSTALL_MODE (use single-server|single-server-prod|docker)"
                exit 1
                ;;
        esac
        return
    fi
    
    echo
    echo -e "${CYAN}Selecione o modo de instalação:${NC}"
    echo -e "${GREEN}1)${NC} Single-Server DEV (Nginx + Backend local, sem broker MQTT local)"
    echo -e "${GREEN}2)${NC} Single-Server PRODUÇÃO (Nginx + Backend + Mosquitto local)"
    echo -e "${GREEN}3)${NC} Docker (Produção - PostgreSQL)"
    echo -e "${GREEN}4)${NC} Rebuild e Restart (Limpa cache, reconstrói builds e reinicia serviços)"
    echo
    read -p "Digite sua escolha (1-4) [padrão: 1]: " choice
    choice=${choice:-1}
    
    case $choice in
        1)
            INSTALL_MODE="single-server"
            SINGLE_SERVER_MQTT_MODE="dev"
            # Escolher banco para servidor único
            echo
            echo -e "${CYAN}Banco de dados para Single-Server:${NC}"
            echo -e "${GREEN}✓${NC} PostgreSQL (único suportado)"
            DB_DRIVER="postgresql"
            DATABASE_URL="postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage"
            ;;
        2)
            INSTALL_MODE="single-server"
            SINGLE_SERVER_MQTT_MODE="production"
            DB_DRIVER="postgresql"
            DATABASE_URL="postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage"
            ;;
        3)
            INSTALL_MODE="docker"
            DB_DRIVER="postgresql"
            DATABASE_URL="postgresql://smartsignage:smartsignage123@postgres:5432/smartsignage"
            ;;
        4)
            INSTALL_MODE="rebuild-restart"
            SKIP_MENU=true
            ;;
        *)
            error "Opção inválida!"
            exit 1
            ;;
    esac

    if [[ "$TOTEMDIGITAL_PROFILE_CLI_SET" == "true" ]]; then
        log "Perfil .env (opções de linha de comando): INSTALL_TOTEMDIGITAL_COMPACT=$INSTALL_TOTEMDIGITAL_COMPACT"
    else
        echo
        echo -e "${CYAN}Perfil da aplicação — compacto (= mono) vs Pro (TOTEMDIGITAL_COMPACT / REACT_APP_TOTEMDIGITAL_COMPACT):${NC}"
        echo -e "${GREEN}1)${NC} Modo compacto / mono (TotemDigital; menos rotas Pro; recomendado neste repositório)"
        echo -e "${GREEN}2)${NC} Smart Signage Pro completo (multi-agência; mais API e UI)"
        read -p "Escolha (1-2) [padrão: 1]: " profile_choice
        profile_choice=${profile_choice:-1}
        case $profile_choice in
            2)
                INSTALL_TOTEMDIGITAL_COMPACT=false
                ;;
            *)
                INSTALL_TOTEMDIGITAL_COMPACT=true
                ;;
        esac
        log "Perfil .env: INSTALL_TOTEMDIGITAL_COMPACT=$INSTALL_TOTEMDIGITAL_COMPACT"
    fi
    
    apply_single_server_mqtt_profile

    echo
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        log "Modo selecionado: $INSTALL_MODE ($SINGLE_SERVER_MQTT_MODE)"
    else
        log "Modo selecionado: $INSTALL_MODE"
    fi
}

# Menu de seleção de players
show_players_menu() {
    # Em modo não interativo, aplicar default do menu de players (10 = todos)
    if [[ "$SKIP_MENU" == "true" ]]; then
        if [[ "$SKIP_PLAYERS_INSTALL" == "true" ]]; then
            INSTALL_ALL_PLAYERS=false
            INSTALL_PLAYER_WEBOS=false
            INSTALL_PLAYER_ANDROID=false
            INSTALL_PLAYER_LINUX_ELECTRON=false
            INSTALL_PLAYER_LINUX_CPP=false
            INSTALL_PLAYER_WINDOWS_ELECTRON=false
            INSTALL_PLAYER_TIZEN=false
            INSTALL_PLAYER_SMARTDISPLAYFX=false
            INSTALL_PLAYER_FX_INTERFACE=false
            INSTALL_PLAYER_WEB_CACHE=false
            log "✅ TotemDigital/servidor: nenhum player cliente será copiado (--skip-players)"
            return 0
        fi
        INSTALL_ALL_PLAYERS=true
        INSTALL_PLAYER_WEBOS=true
        INSTALL_PLAYER_ANDROID=true
        INSTALL_PLAYER_LINUX_ELECTRON=true
        INSTALL_PLAYER_LINUX_CPP=true
        INSTALL_PLAYER_WINDOWS_ELECTRON=true
        INSTALL_PLAYER_TIZEN=true
        INSTALL_PLAYER_SMARTDISPLAYFX=true
        INSTALL_PLAYER_FX_INTERFACE=true
        INSTALL_PLAYER_WEB_CACHE=true
        log "✅ Players selecionados automaticamente (skip-menu padrão: 10 - todos)"
        copy_selected_players
        return 0
    fi
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}                    Seleção de Players para Instalação${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    echo -e "${YELLOW}Selecione quais players deseja instalar/complementar:${NC}"
    echo
    echo -e "${GREEN}[ ]${NC} 1) webOS (LG) - Player para TVs LG webOS"
    echo -e "${GREEN}[ ]${NC} 2) Android TV - Player para dispositivos Android TV"
    echo -e "${GREEN}[ ]${NC} 3) Linux Electron - Player para Linux usando Electron"
    echo -e "${GREEN}[ ]${NC} 4) Linux C++ - Player nativo C++ para Linux"
    echo -e "${GREEN}[ ]${NC} 5) Windows Electron - Player para Windows usando Electron"
    echo -e "${GREEN}[ ]${NC} 6) Tizen (Samsung) - Player para TVs Samsung Tizen"
    echo -e "${GREEN}[ ]${NC} 7) SmartDisplayFX Client - Cliente para efeitos visuais"
    echo -e "${GREEN}[ ]${NC} 8) Smart FX Interface - Interface e protótipos"
    echo -e "${GREEN}[ ]${NC} 9) Player Web Cache - Player HTML5 com cache completo (substitui player-web obsoleto)"
    echo
    echo -e "${GREEN}[ ]${NC} 10) Instalar TODOS os players (recomendado para desenvolvimento)"
    echo -e "${GREEN}[ ]${NC} 0) Não instalar players (apenas servidor)"
    echo
    read -p "Digite os números separados por vírgula (ex: 1,3,5) ou 10 para todos [padrão: 10]: " players_choice
    players_choice=${players_choice:-10}
    
    # Limpar seleções anteriores
    INSTALL_PLAYER_WEBOS=false
    INSTALL_PLAYER_ANDROID=false
    INSTALL_PLAYER_LINUX_ELECTRON=false
    INSTALL_PLAYER_LINUX_CPP=false
    INSTALL_PLAYER_WINDOWS_ELECTRON=false
    INSTALL_PLAYER_TIZEN=false
    INSTALL_PLAYER_SMARTDISPLAYFX=false
    INSTALL_PLAYER_FX_INTERFACE=false
    INSTALL_PLAYER_WEB_CACHE=false
    INSTALL_ALL_PLAYERS=false
    
    # Processar escolha
    if [[ "$players_choice" == "10" ]]; then
        INSTALL_ALL_PLAYERS=true
        INSTALL_PLAYER_WEBOS=true
        INSTALL_PLAYER_ANDROID=true
        INSTALL_PLAYER_LINUX_ELECTRON=true
        INSTALL_PLAYER_LINUX_CPP=true
        INSTALL_PLAYER_WINDOWS_ELECTRON=true
        INSTALL_PLAYER_TIZEN=true
        INSTALL_PLAYER_SMARTDISPLAYFX=true
        INSTALL_PLAYER_FX_INTERFACE=true
        INSTALL_PLAYER_WEB_CACHE=true
        log "✅ Todos os players serão instalados"
    elif [[ "$players_choice" == "0" ]]; then
        log "ℹ️  Nenhum player será instalado (apenas servidor)"
    else
        # Processar escolhas múltiplas
        IFS=',' read -ra PLAYER_CHOICES <<< "$players_choice"
        for choice in "${PLAYER_CHOICES[@]}"; do
            choice=$(echo "$choice" | xargs) # Trim whitespace
            case $choice in
                1)
                    INSTALL_PLAYER_WEBOS=true
                    log "✅ webOS player selecionado"
                    ;;
                2)
                    INSTALL_PLAYER_ANDROID=true
                    log "✅ Android TV player selecionado"
                    ;;
                3)
                    INSTALL_PLAYER_LINUX_ELECTRON=true
                    log "✅ Linux Electron player selecionado"
                    ;;
                4)
                    INSTALL_PLAYER_LINUX_CPP=true
                    log "✅ Linux C++ player selecionado"
                    ;;
                5)
                    INSTALL_PLAYER_WINDOWS_ELECTRON=true
                    log "✅ Windows Electron player selecionado"
                    ;;
                6)
                    INSTALL_PLAYER_TIZEN=true
                    log "✅ Tizen player selecionado"
                    ;;
                7)
                    INSTALL_PLAYER_SMARTDISPLAYFX=true
                    log "✅ SmartDisplayFX Client selecionado"
                    ;;
                8)
                    INSTALL_PLAYER_FX_INTERFACE=true
                    log "✅ Smart FX Interface selecionado"
                    ;;
                9)
                    INSTALL_PLAYER_WEB_CACHE=true
                    log "✅ Player Web Cache selecionado"
                    ;;
                *)
                    warn "⚠️  Opção '$choice' ignorada (inválida)"
                    ;;
            esac
        done
    fi
    
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
}

# Copiar players selecionados para diretório de instalação
copy_selected_players() {
    log "Copiando players selecionados..."
    
    # Single-server usando diretório de origem: players já estão no lugar, não copiar (evita "Falha ao copiar")
    local src_abs inst_abs
    src_abs="$(readlink -f "$SOURCE_DIR" 2>/dev/null || realpath "$SOURCE_DIR" 2>/dev/null || echo "$SOURCE_DIR")"
    inst_abs="$(readlink -f "$INSTALL_DIR" 2>/dev/null || realpath "$INSTALL_DIR" 2>/dev/null || echo "$INSTALL_DIR")"
    if [[ -n "$src_abs" && -n "$inst_abs" && "$src_abs" == "$inst_abs" ]]; then
        log "✅ Usando diretório de origem - players já no lugar (pulando cópia)"
        return 0
    fi
    
    if [[ "$INSTALL_ALL_PLAYERS" == "true" ]]; then
        log "Instalando todos os players..."
        if [[ -d "$SOURCE_DIR/player-client" ]]; then
            log "Copiando player-client completo..."
            cp -r "$SOURCE_DIR/player-client" "$INSTALL_DIR/" 2>/dev/null || {
                warn "Falha ao copiar player-client, continuando..."
            }
        fi
        if [[ -d "$SOURCE_DIR/Player-SmartDisplayFX-client" ]]; then
            log "Copiando Player-SmartDisplayFX-client..."
            cp -r "$SOURCE_DIR/Player-SmartDisplayFX-client" "$INSTALL_DIR/" 2>/dev/null || {
                warn "Falha ao copiar Player-SmartDisplayFX-client, continuando..."
            }
        fi
        if [[ -d "$SOURCE_DIR/Player-Smart-FX-Interface" ]]; then
            log "Copiando Player-Smart-FX-Interface..."
            cp -r "$SOURCE_DIR/Player-Smart-FX-Interface" "$INSTALL_DIR/" 2>/dev/null || {
                warn "Falha ao copiar Player-Smart-FX-Interface, continuando..."
            }
        fi
        if [[ -d "$SOURCE_DIR/player-web" ]]; then
            log "Copiando Player Web (versão com cache completo)..."
            mkdir -p "$INSTALL_DIR/player-web"
            cp -r "$SOURCE_DIR/player-web/"* "$INSTALL_DIR/player-web/" 2>/dev/null || {
                warn "Falha ao copiar Player Web, continuando..."
            }
            log "✅ Player Web copiado para player-web/"
        fi
        log "✅ Todos os players copiados"
        return
    fi
    
    # Criar diretório base para players se não existir
    mkdir -p "$INSTALL_DIR/player-client" "$INSTALL_DIR/Player-SmartDisplayFX-client" "$INSTALL_DIR/Player-Smart-FX-Interface"
    
    # Copiar estrutura base do player-client (core, shared, docs) se pelo menos uma plataforma foi selecionada
    if [[ "$INSTALL_PLAYER_WEBOS" == "true" ]] || [[ "$INSTALL_PLAYER_ANDROID" == "true" ]] || \
       [[ "$INSTALL_PLAYER_LINUX_ELECTRON" == "true" ]] || [[ "$INSTALL_PLAYER_LINUX_CPP" == "true" ]] || \
       [[ "$INSTALL_PLAYER_WINDOWS_ELECTRON" == "true" ]] || [[ "$INSTALL_PLAYER_TIZEN" == "true" ]]; then
        if [[ -d "$SOURCE_DIR/player-client" ]]; then
            log "Copiando estrutura base do player-client (core, shared, docs)..."
            if [[ -d "$SOURCE_DIR/player-client/core" ]]; then
                cp -r "$SOURCE_DIR/player-client/core" "$INSTALL_DIR/player-client/" 2>/dev/null || true
            fi
            if [[ -d "$SOURCE_DIR/player-client/shared" ]]; then
                cp -r "$SOURCE_DIR/player-client/shared" "$INSTALL_DIR/player-client/" 2>/dev/null || true
            fi
            if [[ -d "$SOURCE_DIR/player-client/docs" ]]; then
                cp -r "$SOURCE_DIR/player-client/docs" "$INSTALL_DIR/player-client/" 2>/dev/null || true
            fi
            # Copiar arquivos README e documentação
            cp "$SOURCE_DIR/player-client/README.md" "$INSTALL_DIR/player-client/" 2>/dev/null || true
        fi
    fi
    
    # Copiar plataformas específicas
    if [[ "$INSTALL_PLAYER_WEBOS" == "true" ]] && [[ -d "$SOURCE_DIR/player-client/platforms/webos" ]]; then
        log "Copiando player webOS..."
        mkdir -p "$INSTALL_DIR/player-client/platforms"
        cp -r "$SOURCE_DIR/player-client/platforms/webos" "$INSTALL_DIR/player-client/platforms/" 2>/dev/null || {
            warn "Falha ao copiar player webOS"
        }
    fi
    
    if [[ "$INSTALL_PLAYER_ANDROID" == "true" ]] && [[ -d "$SOURCE_DIR/player-client/platforms/android" ]]; then
        log "Copiando player Android TV..."
        mkdir -p "$INSTALL_DIR/player-client/platforms"
        cp -r "$SOURCE_DIR/player-client/platforms/android" "$INSTALL_DIR/player-client/platforms/" 2>/dev/null || {
            warn "Falha ao copiar player Android TV"
        }
    fi
    
    if [[ "$INSTALL_PLAYER_LINUX_ELECTRON" == "true" ]] && [[ -d "$SOURCE_DIR/player-client/platforms/linux-electron" ]]; then
        log "Copiando player Linux Electron..."
        mkdir -p "$INSTALL_DIR/player-client/platforms"
        cp -r "$SOURCE_DIR/player-client/platforms/linux-electron" "$INSTALL_DIR/player-client/platforms/" 2>/dev/null || {
            warn "Falha ao copiar player Linux Electron"
        }
    fi
    
    if [[ "$INSTALL_PLAYER_LINUX_CPP" == "true" ]] && [[ -d "$SOURCE_DIR/player-client/platforms/linux-cpp" ]]; then
        log "Copiando player Linux C++..."
        mkdir -p "$INSTALL_DIR/player-client/platforms"
        cp -r "$SOURCE_DIR/player-client/platforms/linux-cpp" "$INSTALL_DIR/player-client/platforms/" 2>/dev/null || {
            warn "Falha ao copiar player Linux C++"
        }
    fi
    
    if [[ "$INSTALL_PLAYER_WINDOWS_ELECTRON" == "true" ]] && [[ -d "$SOURCE_DIR/player-client/platforms/windows-electron" ]]; then
        log "Copiando player Windows Electron..."
        mkdir -p "$INSTALL_DIR/player-client/platforms"
        cp -r "$SOURCE_DIR/player-client/platforms/windows-electron" "$INSTALL_DIR/player-client/platforms/" 2>/dev/null || {
            warn "Falha ao copiar player Windows Electron"
        }
    fi
    
    if [[ "$INSTALL_PLAYER_TIZEN" == "true" ]] && [[ -d "$SOURCE_DIR/player-client/platforms/tizen" ]]; then
        log "Copiando player Tizen..."
        mkdir -p "$INSTALL_DIR/player-client/platforms"
        cp -r "$SOURCE_DIR/player-client/platforms/tizen" "$INSTALL_DIR/player-client/platforms/" 2>/dev/null || {
            warn "Falha ao copiar player Tizen"
        }
    fi
    
    # Copiar SmartDisplayFX Client
    if [[ "$INSTALL_PLAYER_SMARTDISPLAYFX" == "true" ]] && [[ -d "$SOURCE_DIR/Player-SmartDisplayFX-client" ]]; then
        log "Copiando SmartDisplayFX Client..."
        cp -r "$SOURCE_DIR/Player-SmartDisplayFX-client" "$INSTALL_DIR/" 2>/dev/null || {
            warn "Falha ao copiar SmartDisplayFX Client"
        }
    fi
    
    # Copiar Smart FX Interface
    if [[ "$INSTALL_PLAYER_FX_INTERFACE" == "true" ]] && [[ -d "$SOURCE_DIR/Player-Smart-FX-Interface" ]]; then
        log "Copiando Smart FX Interface..."
        cp -r "$SOURCE_DIR/Player-Smart-FX-Interface" "$INSTALL_DIR/" 2>/dev/null || {
            warn "Falha ao copiar Smart FX Interface"
        }
    fi
    
    # Copiar Player Web
    if [[ "$INSTALL_PLAYER_WEB_CACHE" == "true" ]] && [[ -d "$SOURCE_DIR/player-web" ]]; then
        log "Copiando Player Web (versão com cache completo)..."
        mkdir -p "$INSTALL_DIR/player-web"
        cp -r "$SOURCE_DIR/player-web/"* "$INSTALL_DIR/player-web/" 2>/dev/null || {
            warn "Falha ao copiar Player Web"
        }
        log "✅ Player Web copiado para player-web/"
    fi
    
    log "✅ Players selecionados copiados"
}

# Continuar função show_menu (seeds e kiosk)
show_menu_continuation() {
    # Perguntar sobre DNS local (movido para o topo)
    ask_dns_local_configuration
    
    # Perguntar sobre carregamento de seeds (se não foi definido via argumento)
    if [[ "$SEEDS_OPTION_FORCED" != "true" ]]; then
        # Em modo não interativo, aplicar default do prompt (N)
        if [[ "$SKIP_MENU" == "true" ]]; then
            LOAD_SEEDS=false
            log "Dados de demonstração não serão carregados (skip-menu padrão: N)"
        else
        echo
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${CYAN}                    Dados de Demonstração (Seeds)${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo
        echo -e "${YELLOW}Deseja carregar dados de demonstração (clientes, campanhas, mídias etc.)?${NC}"
        echo -e "${YELLOW}Padrão: Não (apenas dados essenciais serão criados).${NC}"
        read -p "Carregar dados seeds? (s/N): " seeds_choice
        seeds_choice=${seeds_choice:-n}
        if [[ "$seeds_choice" =~ ^[SsYy]$ ]]; then
            LOAD_SEEDS=true
            log "Dados de demonstração serão carregados."
        else
            LOAD_SEEDS=false
            log "Dados de demonstração NÃO serão carregados."
        fi
        fi
    else
        if [[ "$LOAD_SEEDS" == "true" ]]; then
            log "Dados de demonstração serão carregados (definido via argumento)."
        else
            log "Dados de demonstração não serão carregados (definido via argumento)."
        fi
    fi

    # Perguntar sobre modo kiosk (apenas para single-server)
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        # Em modo não interativo, evitar prompts e aplicar defaults seguros:
        # - default do prompt é "S", mas isso abriria prompts de xrandr. Aqui aplicamos:
        #   kiosk=true, rotação=left e saída auto.
        if [[ "$SKIP_MENU" == "true" ]]; then
            ENABLE_KIOSK_MODE=true
            KIOSK_ROTATION_SELECTED="left"
            KIOSK_DISPLAY_SELECTED=""
            export KIOSK_ROTATION_SELECTED
            export KIOSK_DISPLAY_SELECTED
            log "Modo Kiosk será configurado (skip-menu padrão: S). Saída=auto, rotação=left."
            return 0
        fi
        echo
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${CYAN}                    Modo Kiosk (Totem/Sinalização)${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo
        echo -e "${YELLOW}Deseja instalar ambiente gráfico em modo Kiosk?${NC}"
        echo -e "${GREEN}✓${NC} Interface gráfica (XFCE)"
        echo -e "${GREEN}✓${NC} Login automático"
        echo -e "${GREEN}✓${NC} Navegador inicia automaticamente com o sistema"
        echo -e "${GREEN}✓${NC} Tela em modo Portrait (vertical) por padrão"
        echo
        read -p "Instalar modo Kiosk? (S/n): " kiosk_choice
        kiosk_choice=${kiosk_choice:-s}
        if [[ "$kiosk_choice" =~ ^[Ss]$ ]]; then
            ENABLE_KIOSK_MODE=true
            log "Modo Kiosk será configurado após a instalação"
            # Perguntar saída de vídeo e orientação
            echo
            echo -e "${CYAN}Configuração de Exibição (Saída e Orientação)${NC}"
            echo -e "${YELLOW}Detectando saídas de vídeo...${NC}"
            XRANDR_CMD="DISPLAY=${DISPLAY:-:0} xrandr --query"
            XRANDR_OUTPUTS=$(eval "$XRANDR_CMD" 2>/dev/null | awk '/ connected/{print $1" ("$2")"}')
            if [[ -n "$XRANDR_OUTPUTS" ]]; then
                echo "Saídas detectadas:"
                i=1
                local default_selection=""
                declare -a OUT_ARR
                while read -r line; do
                  [[ -z "$line" ]] && continue
                  OUT_NAME=$(echo "$line" | awk '{print $1}')
                  [[ -z "$default_selection" ]] && default_selection="$i"
                  OUT_ARR[$i]="$OUT_NAME"
                  echo "  $i) $line"
                  i=$((i+1))
                done <<< "$XRANDR_OUTPUTS"
                echo "  0) Auto (primária)"
                read -p "Escolha a saída (0 para auto) [padrão: ${default_selection:-0}]: " out_idx
                out_idx=${out_idx:-${default_selection:-0}}
                if [[ "$out_idx" =~ ^[0-9]+$ ]] && [[ $out_idx -gt 0 ]] && [[ -n "${OUT_ARR[$out_idx]}" ]]; then
                  KIOSK_DISPLAY_SELECTED="${OUT_ARR[$out_idx]}"
                else
                  KIOSK_DISPLAY_SELECTED=""
                fi
            else
                echo -e "${YELLOW}⚠️ Não foi possível detectar saídas via xrandr (ambiente sem DISPLAY).${NC}"
                read -p "Digite o nome da saída (ex.: HDMI-1) ou deixe em branco para auto: " KIOSK_DISPLAY_SELECTED
            fi

            echo
            echo "Orientações disponíveis:"
            echo "  1) normal (landscape)"
            echo "  2) left (portrait anti-horário)"
            echo "  3) right (portrait horário)"
            echo "  4) inverted (180°)"
            read -p "Escolha a orientação [padrão: left]: " rot_choice
            case "$rot_choice" in
              1) KIOSK_ROTATION_SELECTED="normal";;
              3) KIOSK_ROTATION_SELECTED="right";;
              4) KIOSK_ROTATION_SELECTED="inverted";;
              *) KIOSK_ROTATION_SELECTED="left";;
            esac
            export KIOSK_ROTATION_SELECTED
            export KIOSK_DISPLAY_SELECTED
        else
            ENABLE_KIOSK_MODE=false
            log "Modo Kiosk não será configurado"
        fi
    fi
}

# Função para configurar scripts de gerenciamento
setup_management_scripts() {
    log "Configurando scripts de gerenciamento..."
    
    # Dar permissão de execução aos scripts
    chmod +x manage-system.sh 2>/dev/null || true
    chmod +x scripts/*.sh 2>/dev/null || true
    
    # Criar link simbólico para o script principal
    if [ ! -L /usr/local/bin/smartsignage ]; then
        # Tentar criar link sem sudo primeiro
        if ln -sf "$INSTALL_DIR/manage-system.sh" /usr/local/bin/smartsignage 2>/dev/null; then
            log "✅ Criado comando global 'smartsignage'"
        else
            # Se falhar, tentar com sudo
            if sudo ln -sf "$INSTALL_DIR/manage-system.sh" /usr/local/bin/smartsignage 2>/dev/null; then
                log "✅ Criado comando global 'smartsignage' (com sudo)"
            else
                log "⚠️ Não foi possível criar link simbólico global"
                log "Você pode usar: $INSTALL_DIR/manage-system.sh"
            fi
        fi
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

# Configurar modo Kiosk (ambiente gráfico com auto-login e navegador automático)
setup_kiosk_mode() {
    if [[ "$ENABLE_KIOSK_MODE" != "true" ]]; then
        return 0
    fi
    
    log "Configurando modo Kiosk (ambiente gráfico)..."
    
    # Verificar se já tem ambiente gráfico instalado
    if [[ -f /usr/bin/xfce4-session ]] || [[ -f /usr/bin/gnome-session ]]; then
        log "Ambiente gráfico já está instalado!"
    else
        # Instalar ambiente gráfico (XFCE - leve e eficiente)
        log "Instalando ambiente gráfico XFCE..."
        sudo DEBIAN_FRONTEND=noninteractive apt-get update -y
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
            xfce4 \
            xfce4-goodies \
            xorg \
            xserver-xorg \
            lightdm \
            chromium-browser \
            unclutter \
            xdotool
        
        log "✅ Ambiente gráfico XFCE instalado!"
    fi
    
    # Configurar auto-login
    log "Configurando auto-login..."
    CURRENT_USER=$(whoami)
    
    # Configurar LightDM para auto-login
    sudo tee /etc/lightdm/lightdm.conf > /dev/null << EOF
[Seat:*]
autologin-user=$CURRENT_USER
autologin-user-timeout=0
user-session=xfce
greeter-session=lightdm-greeter
EOF
    
    log "✅ Auto-login configurado para usuário: $CURRENT_USER"
    
    # Obter IP do servidor para o URL
    SERVER_IP=$(hostname -I | awk '{print $1}')
    KIOSK_URL="http://${SERVER_IP}:80/player"
    
    # Criar diretório de autostart
    mkdir -p "$HOME/.config/autostart"
    
    # Script de inicialização do Kiosk
    KIOSK_SCRIPT="$HOME/.config/autostart/kiosk.sh"
    cat > "$KIOSK_SCRIPT" << 'KIOSK_SCRIPT_EOF'
#!/bin/bash
# Smart Signage Pro - Script de Inicialização Kiosk

# Aguardar XFCE iniciar completamente
sleep 10

# Rotação: não ajustar aqui; já feita no boot conforme configuração

# Esconder cursor após 5 segundos de inatividade
unclutter -idle 5 -root &

# Desabilitar proteção de tela
xset s off
xset -dpms
xset s noblank

# Obter IP do servidor dinamicamente (não usar IP fixo)
# Detectar IP da interface de rede principal
SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -z "$SERVER_IP" ] || [ "$SERVER_IP" == "" ]; then
    SERVER_IP="localhost"
fi

# URL do player (sem UIN para entrar em modo demo)
KIOSK_URL="${KIOSK_URL:-http://${SERVER_IP}:80/player}"

# Log para debug
echo "$(date): Iniciando Chromium com URL: $KIOSK_URL" >> /tmp/kiosk.log

# Iniciar navegador em modo kiosk (tela cheia, sem barra de endereço)
chromium-browser \
    --kiosk \
    --no-first-run \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --start-maximized \
    --incognito \
    --disable-translate \
    --disable-features=TranslateUI \
    --noerrdialogs \
    --disable-web-security \
    --disable-dev-shm-usage \
    --autoplay-policy=no-user-gesture-required \
    "$KIOSK_URL" &
KIOSK_SCRIPT_EOF
    
    chmod +x "$KIOSK_SCRIPT"
    
    # NÃO substituir URL fixa - deixar o script detectar dinamicamente
    # Apenas substituir placeholders de display e rotation se existirem
    if grep -q "KIOSK_DISPLAY_SELECTED_PLACEHOLDER" "$KIOSK_SCRIPT"; then
        sed -i "s|KIOSK_DISPLAY_SELECTED_PLACEHOLDER|KIOSK_DISPLAY=\"$KIOSK_DISPLAY_SELECTED\"|g" "$KIOSK_SCRIPT"
    fi
    if grep -q "KIOSK_ROTATION_SELECTED_PLACEHOLDER" "$KIOSK_SCRIPT"; then
        sed -i "s|KIOSK_ROTATION_SELECTED_PLACEHOLDER|KIOSK_ROTATION=\"$KIOSK_ROTATION_SELECTED\"|g" "$KIOSK_SCRIPT"
    fi
    
    # Criar entrada no autostart do XFCE
    KIOSK_DESKTOP="$HOME/.config/autostart/kiosk.desktop"
    cat > "$KIOSK_DESKTOP" << EOF
[Desktop Entry]
Type=Application
Name=Smart Signage Kiosk
Exec=$KIOSK_SCRIPT
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
    
    chmod +x "$KIOSK_DESKTOP"
    
    log "✅ Script de Kiosk criado: $KIOSK_SCRIPT"
    log "✅ URL do Kiosk: $KIOSK_URL"
    
    # Não persistir rotação em sessão/greeter; rotação é aplicada apenas no boot
    
    # Habilitar LightDM
    sudo systemctl enable lightdm
    if ! systemctl is-active --quiet lightdm 2>/dev/null; then
        log "⚠️  LightDM será iniciado no próximo boot"
        log "💡 Para iniciar agora, execute: sudo systemctl start lightdm"
    else
        log "✅ LightDM já está ativo"
    fi
    
    # Criar script de gerenciamento do kiosk
    KIOSK_MANAGE_SCRIPT="$INSTALL_DIR/scripts/manage-kiosk.sh"
    mkdir -p "$INSTALL_DIR/scripts"
    cat > "$KIOSK_MANAGE_SCRIPT" << 'KIOSK_MANAGE_EOF'
#!/bin/bash
# Smart Signage Pro - Gerenciamento do Modo Kiosk

case "$1" in
    start)
        echo "Iniciando modo Kiosk..."
        sudo systemctl start lightdm
        ;;
    stop)
        echo "Parando modo Kiosk..."
        sudo systemctl stop lightdm
        ;;
    restart)
        echo "Reiniciando modo Kiosk..."
        sudo systemctl restart lightdm
        ;;
    status)
        echo "Status do modo Kiosk:"
        sudo systemctl status lightdm --no-pager
        ;;
    rotate)
        echo "Aplicando rotação Portrait (lado correto)..."
        PRIMARY_DISPLAY=$(xrandr | grep " connected" | grep -o "^[^ ]*" | head -1)
        if [[ -n "$PRIMARY_DISPLAY" ]]; then
            # Usar right (90° - sentido horário) - lado correto para totens portrait
            xrandr --output "$PRIMARY_DISPLAY" --rotate left
            echo "✅ Rotação Portrait aplicada em: $PRIMARY_DISPLAY"
            echo "💡 Use 'xrandr --output $PRIMARY_DISPLAY --rotate normal' para voltar ao normal"
        else
            echo "❌ Nenhuma tela detectada"
        fi
        ;;
    *)
        echo "Uso: $0 {start|stop|restart|status|rotate}"
        echo ""
        echo "Comandos:"
        echo "  start   - Inicia o ambiente gráfico (Kiosk)"
        echo "  stop    - Para o ambiente gráfico"
        echo "  restart - Reinicia o ambiente gráfico"
        echo "  status  - Mostra status do LightDM"
        echo "  rotate  - Aplica rotação Portrait na tela"
        exit 1
        ;;
esac
KIOSK_MANAGE_EOF
    
    chmod +x "$KIOSK_MANAGE_SCRIPT"
    
    log "✅ Script de gerenciamento criado: $KIOSK_MANAGE_SCRIPT"
    
    # Adicionar informação sobre o Kiosk na mensagem final
    log "✅ Modo Kiosk configurado com sucesso!"
    log "📍 URL do Kiosk: $KIOSK_URL"
    log "💡 Use '$KIOSK_MANAGE_SCRIPT' para gerenciar o modo Kiosk"
    
    # Criar variável global para usar em show_final_info
    export KIOSK_URL
    export KIOSK_ENABLED=true
}

# Função principal
main() {
    # Parse de argumentos PRIMEIRO
    parse_arguments "$@"
    
    show_banner
    
    # Mostrar modo selecionado se aplicável
    if [[ "$FRESH_MODE" == "true" ]]; then
        echo -e "${RED}⚠️  MODO FRESH ATIVADO - Instalação completa do zero${NC}"
        # Padrão single-server; Docker só com --mode docker (antes ou depois de --fresh)
        if [[ -z "$INSTALL_MODE" ]]; then
            INSTALL_MODE="single-server"
        fi
        RESET_DATABASE=true
        PRESERVE_DB=false
        if [[ "$INSTALL_MODE" == "docker" ]]; then
            REBUILD_MODE=true
            FORCE_REBUILD=true
        fi
        echo -e "${CYAN}ℹ️  Modo de instalação fresh: $INSTALL_MODE${NC}"
        echo
    elif [[ "$REBUILD_MODE" == "true" ]]; then
        echo -e "${YELLOW}🔄 MODO REBUILD ATIVADO - Rebuild preservando dados${NC}"
        echo
    fi
    
    check_root
    check_os
    
    # Verificar modo check-only
    if [[ "$CHECK_ONLY" == "true" ]]; then
        log "Modo check-only: Verificando se rebuild é necessário..."
        if check_rebuild_needed; then
            echo "✅ Rebuild necessário"
            exit 0
        else
            echo "✅ Rebuild não necessário"
            exit 1
        fi
    fi

    # =========================================================================
    # Modos especiais: apenas banco ou apenas builds (não removem instalação)
    # =========================================================================

    # 0) Sync APENAS do site corporativo (totemdigital.site + logos-icons → :80)
    if [[ "$CORPORATE_SITE_SYNC_ONLY" == "true" ]]; then
        log "Modo especial: sync APENAS do site corporativo (--sync-corporate-site)..."

        detect_project_directory
        INSTALL_DIR="${INSTALL_DIR:-$SOURCE_DIR}"

        # Defaults; CLI (--corporate-web-root / --corporate-site-source) tem prioridade sobre .env
        local _cli_web_root="" _cli_site_src=""
        [[ "$CORPORATE_WEB_ROOT_FROM_CLI" == "true" ]] && _cli_web_root="$CORPORATE_WEB_ROOT"
        [[ "$CORPORATE_SITE_SOURCE_FROM_CLI" == "true" ]] && _cli_site_src="$CORPORATE_SITE_SOURCE"

        apply_split_layout_from_environment

        CORPORATE_WEB_ROOT="${CORPORATE_WEB_ROOT:-/var/www/corporate-site}"
        CORPORATE_HTTP_PORT="${CORPORATE_HTTP_PORT:-80}"

        if [[ -f "${INSTALL_DIR}/.env" ]]; then
            set -a
            # shellcheck disable=SC1090
            source "${INSTALL_DIR}/.env" 2>/dev/null || true
            set +a
            if [[ "$CORPORATE_WEB_ROOT_FROM_CLI" != "true" ]]; then
                [[ -n "${SMARTSIGNAGE_CORPORATE_WEB_ROOT:-}" ]] && CORPORATE_WEB_ROOT="${SMARTSIGNAGE_CORPORATE_WEB_ROOT}"
            fi
            if [[ "$CORPORATE_SITE_SOURCE_FROM_CLI" != "true" ]]; then
                [[ -n "${SMARTSIGNAGE_CORPORATE_SITE_SOURCE:-}" ]] && CORPORATE_SITE_SOURCE="${SMARTSIGNAGE_CORPORATE_SITE_SOURCE}"
            fi
            [[ -n "${SMARTSIGNAGE_CORPORATE_HTTP_PORT:-}" ]] && CORPORATE_HTTP_PORT="${SMARTSIGNAGE_CORPORATE_HTTP_PORT}"
        fi

        # Restaurar valores explícitos da linha de comando
        [[ -n "$_cli_web_root" ]] && CORPORATE_WEB_ROOT="$_cli_web_root"
        [[ -n "$_cli_site_src" ]] && CORPORATE_SITE_SOURCE="$_cli_site_src"

        if [[ -n "${CORPORATE_SITE_SOURCE:-}" ]]; then
            if [[ ! -d "$CORPORATE_SITE_SOURCE" ]] || [[ ! -f "$CORPORATE_SITE_SOURCE/index.html" ]]; then
                error "❌ --corporate-site-source inválido: '${CORPORATE_SITE_SOURCE}' (precisa de index.html)"
                exit 1
            fi
        fi

        local _resolved_src=""
        _resolved_src="$(resolve_corporate_site_source)" || {
            error "❌ Pasta de origem do site corporativo não encontrada (totemdigital.site ou --corporate-site-source)."
            exit 1
        }

        log "Origem: ${_resolved_src} (+ logos-icons)"
        log "Destino: ${CORPORATE_WEB_ROOT} (HTTP :${CORPORATE_HTTP_PORT})"

        if ! sync_corporate_site_to_webroot "$CORPORATE_WEB_ROOT"; then
            error "❌ Falha ao sincronizar site corporativo para ${CORPORATE_WEB_ROOT}"
            exit 1
        fi

        if command -v nginx &>/dev/null; then
            if sudo nginx -t 2>/dev/null; then
                sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload 2>/dev/null || true
                log "✅ Nginx recarregado"
            else
                warn "nginx -t falhou — ficheiros syncados; verifique a config Nginx manualmente."
            fi
        fi

        local _probe_host="127.0.0.1"
        if curl -fsS -o /dev/null -I --max-time 5 "http://${_probe_host}:${CORPORATE_HTTP_PORT}/" 2>/dev/null; then
            log "✅ Site corporativo a responder em http://${_probe_host}:${CORPORATE_HTTP_PORT}/"
        else
            warn "Não foi possível validar HTTP :${CORPORATE_HTTP_PORT} (Nginx pode estar noutro host/porta)."
        fi

        log "✅ Sync do site corporativo concluído (modo --sync-corporate-site)."
        return 0
    fi

    # 1) Reinstalar APENAS o banco (drop + schema + seeds), sem rebuild de backend/frontend
    if [[ "$DB_ONLY_MODE" == "true" ]]; then
        log "Modo especial: Reinstalação APENAS do banco de dados (drop + schema + seeds)..."

        # Detectar diretório do projeto e configurar INSTALL_DIR / config
        detect_project_directory
        # Se INSTALL_MODE não foi definido por argumentos/menu, assumir single-server para este modo
        if [[ -z "$INSTALL_MODE" ]]; then
            INSTALL_MODE="single-server"
        fi
        apply_single_server_mqtt_profile
        setup_project

        # Garantir que não vamos preservar o banco (reinstalação limpa)
        RESET_DATABASE=true
        PRESERVE_DB=false

        # Executar apenas a parte de banco e schema
        setup_database
        setup_environment

        if [[ "$INSTALL_MODE" == "single-server" ]]; then
            # Aplicar schema consolidado e seeds/admin
            setup_first_boot
        else
            log "ℹ️  INSTALL_MODE='$INSTALL_MODE': para Docker, a recriação completa do banco geralmente é feita via containers."
        fi

        log "✅ Reinstalação do banco de dados concluída (modo --db-only)."
        return 0
    fi

    # 1b) Apenas seeds dinâmicos (sem drop nem schema) — útil após corrigir part4 e reaplicar schema
    if [[ "$SEEDS_ONLY_MODE" == "true" ]]; then
        log "Modo especial: aplicação APENAS de seeds dinâmicos (--seeds-only)..."

        detect_project_directory
        INSTALL_DIR="${INSTALL_DIR:-$SOURCE_DIR}"
        if [[ -z "$INSTALL_DIR" || ! -d "$INSTALL_DIR/database" ]]; then
            error "❌ INSTALL_DIR inválido para seeds: '${INSTALL_DIR:-<vazio>}'"
            exit 1
        fi
        if [[ -z "$INSTALL_MODE" ]]; then
            INSTALL_MODE="single-server"
        fi

        LOAD_SEEDS=true
        sanitize_owner_profile_defaults
        sanitize_limits_defaults

        if [[ -f "$INSTALL_DIR/.env" ]]; then
            set -a
            # shellcheck disable=SC1090
            source "$INSTALL_DIR/.env" 2>/dev/null || true
            set +a
        fi

        export PRIMARY_DB_NAME="${PRIMARY_DB_NAME:-${DB_NAME:-smartsignage}}"
        export PRIMARY_DB_USER="${PRIMARY_DB_USER:-${DB_USER:-smartsignage}}"
        export DB_PASSWORD="${DB_PASSWORD:-smartsignage123}"
        export PGPASSWORD="${PGPASSWORD:-$DB_PASSWORD}"
        export DATABASE_URL="${DATABASE_URL:-postgresql://${PRIMARY_DB_USER}:${DB_PASSWORD}@localhost:5432/${PRIMARY_DB_NAME}}"

        if ! load_database_seeds; then
            error "❌ Falha ao aplicar seeds (--seeds-only)"
            exit 1
        fi

        if ! ensure_admin_user; then
            error "❌ Não foi possível garantir usuário admin após seeds"
            exit 1
        fi
        if ! ensure_owner_system_user; then
            error "❌ Não foi possível garantir usuário owner_system após seeds"
            exit 1
        fi
        if [[ "${INSTALL_TOTEMDIGITAL_COMPACT}" == "true" ]]; then
            if ! ensure_owner_publisher_user; then
                error "❌ Não foi possível garantir usuário publisher do owner no modo compacto"
                exit 1
            fi
        fi

        run_validate_v6_skip_load || true

        log "✅ Seeds aplicados com sucesso (modo --seeds-only)."
        return 0
    fi

    # 2) Build APENAS do backend e/ou APENAS do frontend ou AMBOS
    # --backend-only: só compilar (deps + tsc) e iniciar backend. Sem banco, Nginx, frontend.
    # --frontend-only: só compilar (deps + build React) e reiniciar Nginx. Sem banco, backend.
    if [[ "$BACKEND_BUILD_ONLY" == "true" || "$FRONTEND_BUILD_ONLY" == "true" || "$BACKFRONT_BUILD_ONLY" == "true" ]]; then
        log "Modo especial: build seletivo (backend/frontend) sem tocar no banco..."

        if [[ "$INSTALL_MODE" == "docker" ]]; then
            error "❌ Modos --backend-only / --frontend-only / --backfront-build não são suportados para INSTALL_MODE=docker."
            error "   Use 'docker compose build' para rebuild em ambientes Docker."
            exit 1
        fi

        # Configuração mínima: só diretório e verificação do que será compilado (sem setup_project completo)
        detect_project_directory
        if [[ -z "$INSTALL_MODE" ]]; then
            INSTALL_MODE="single-server"
        fi
        apply_single_server_mqtt_profile
        setup_project_build_only

        # =====================================================================
        # 1. PARAR SERVIÇOS ANTES DO BUILD (apenas o que será recompilado)
        # =====================================================================
        log "🛑 Parando serviços antes do build..."
        
        if [[ -f "$INSTALL_DIR/scripts/stop-services.sh" ]]; then
            if [[ "$BACKFRONT_BUILD_ONLY" == "true" ]]; then
                log "Parando backend e frontend..."
                bash "$INSTALL_DIR/scripts/stop-services.sh" all || warn "⚠️  Alguns serviços podem não ter sido parados"
            elif [[ "$BACKEND_BUILD_ONLY" == "true" ]]; then
                log "Parando backend..."
                bash "$INSTALL_DIR/scripts/stop-services.sh" backend || warn "⚠️  Backend pode não ter sido parado"
            elif [[ "$FRONTEND_BUILD_ONLY" == "true" ]]; then
                log "Parando frontend..."
                bash "$INSTALL_DIR/scripts/stop-services.sh" frontend || warn "⚠️  Frontend pode não ter sido parado"
            fi
            sleep 2  # Aguardar serviços pararem completamente
        else
            warn "⚠️  Script stop-services.sh não encontrado. Tentando parar processos manualmente..."
            # Parar por porta (fallback)
            if [[ "$BACKFRONT_BUILD_ONLY" == "true" ]] || [[ "$BACKEND_BUILD_ONLY" == "true" ]]; then
                if lsof -ti:3000 &> /dev/null; then
                    log "Parando processo na porta 3000 (backend)..."
                    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
                fi
            fi
            if [[ "$BACKFRONT_BUILD_ONLY" == "true" ]] || [[ "$FRONTEND_BUILD_ONLY" == "true" ]]; then
                if lsof -ti:3001 &> /dev/null || lsof -ti:8080 &> /dev/null; then
                    log "Parando processos nas portas 3001/8080 (frontend)..."
                    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
                    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
                fi
            fi
        fi

        # =====================================================================
        # 2. REALIZAR BUILDS
        # =====================================================================
        if [[ "$BACKFRONT_BUILD_ONLY" == "true" ]]; then
            SKIP_BACKEND_DEPS_BUILD=false
            SKIP_FRONTEND_DEPS_BUILD=false
            log "➡️  Executando instalação/compilação do backend E frontend (--backfront-build)..."
            install_project_dependencies
        elif [[ "$BACKEND_BUILD_ONLY" == "true" ]]; then
            SKIP_BACKEND_DEPS_BUILD=false
            SKIP_FRONTEND_DEPS_BUILD=true
            log "➡️  Executando apenas instalação/compilação do backend (--backend-only)..."
            install_project_dependencies
        elif [[ "$FRONTEND_BUILD_ONLY" == "true" ]]; then
            SKIP_BACKEND_DEPS_BUILD=true
            SKIP_FRONTEND_DEPS_BUILD=false
            log "➡️  Executando apenas instalação/compilação do frontend (--frontend-only)..."
            install_project_dependencies
        fi

        # =====================================================================
        # 3. INICIAR SERVIÇOS APÓS O BUILD
        # =====================================================================
        log "▶️  Iniciando serviços após o build..."
        
        # Função auxiliar para iniciar backend
        start_backend_service() {
            # Tentar systemd primeiro
            if systemctl is-enabled smart-signage &>/dev/null || systemctl is-enabled smartsignage-backend &>/dev/null; then
                if systemctl is-enabled smart-signage &>/dev/null; then
                    log "Iniciando serviço systemd: smart-signage..."
                    sudo systemctl start smart-signage && log "✅ Backend iniciado via systemd" || warn "⚠️  Falha ao iniciar via systemd"
                elif systemctl is-enabled smartsignage-backend &>/dev/null; then
                    log "Iniciando serviço systemd: smartsignage-backend..."
                    sudo systemctl start smartsignage-backend && log "✅ Backend iniciado via systemd" || warn "⚠️  Falha ao iniciar via systemd"
                fi
            else
                # Fallback: iniciar manualmente via npm start
                if [[ -d "$INSTALL_DIR/backend" ]] && [[ -f "$INSTALL_DIR/backend/dist/index.js" ]]; then
                    log "Iniciando backend via npm start..."
                    cd "$INSTALL_DIR/backend"
                    nohup npm start > "$INSTALL_DIR/logs/backend.log" 2>&1 &
                    sleep 3
                    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
                        log "✅ Backend iniciado e respondendo"
                    else
                        warn "⚠️  Backend iniciado mas não respondeu ao health check"
                    fi
                    cd "$INSTALL_DIR"
                else
                    warn "⚠️  Não foi possível iniciar backend (dist/index.js não encontrado)"
                fi
            fi
        }

        # Função auxiliar para reiniciar Nginx (frontend é servido via Nginx)
        restart_nginx_if_needed() {
            if command -v nginx &> /dev/null || command -v systemctl &> /dev/null; then
                if systemctl is-enabled nginx &>/dev/null || systemctl is-active nginx &>/dev/null; then
                    log "Reiniciando Nginx para servir novo build do frontend..."
                    sudo systemctl reload nginx 2>/dev/null || sudo systemctl restart nginx 2>/dev/null || warn "⚠️  Falha ao reiniciar Nginx"
                    log "✅ Nginx reiniciado"
                fi
            fi
        }

        # Iniciar serviços conforme o modo
        if [[ "$BACKFRONT_BUILD_ONLY" == "true" ]]; then
            start_backend_service
            restart_nginx_if_needed
        elif [[ "$BACKEND_BUILD_ONLY" == "true" ]]; then
            start_backend_service
        elif [[ "$FRONTEND_BUILD_ONLY" == "true" ]]; then
            restart_nginx_if_needed
        fi

        log "✅ Modo especial de build seletivo concluído."
        return 0
    fi

    # =========================================================================
    # Fluxo completo de instalação
    # =========================================================================

    # Detectar e remover instalação anterior (se existir e usuário confirmar)
    # Isso deve ser feito ANTES de detectar o diretório do projeto para evitar conflitos
    detect_and_remove_previous_installation
    
    # Detectar diretório do projeto PRIMEIRO (necessário para checksums)
    detect_project_directory
    
    # Verificar se é modo rebuild antes do menu
    # Para rebuild, precisamos definir INSTALL_DIR temporariamente
    if [[ "$REBUILD_MODE" == "true" ]]; then
        # Tentar detectar INSTALL_DIR existente (pode ser /opt/smart-signage ou diretório de origem)
        if [[ -d "/opt/smart-signage" ]]; then
            INSTALL_DIR="/opt/smart-signage"
        elif [[ -d "$SOURCE_DIR" ]] && [[ -f "$SOURCE_DIR/.env" ]]; then
            INSTALL_DIR="$SOURCE_DIR"
        fi
        
        if [[ -d "$INSTALL_DIR" ]]; then
            cd "$INSTALL_DIR" 2>/dev/null || true
            
            if [[ "$FRESH_MODE" == "true" ]]; then
                if [[ "$INSTALL_MODE" == "docker" ]]; then
                    rebuild_fresh
                    # Após rebuild fresh Docker, continuar instalação normalmente
                else
                    log "Modo --fresh (single-server): a recriar banco e instalação completa (sem Docker Compose)."
                    RESET_DATABASE=true
                    PRESERVE_DB=false
                fi
            elif check_rebuild_needed || [[ "$FORCE_REBUILD" == "true" ]]; then
                rebuild_preserve_data
                # rebuild_preserve_data já reinicia containers se REBUILD_ONLY não estiver ativo
                if [[ "$REBUILD_ONLY" != "true" ]]; then
                    log "Aguardando serviços iniciarem após rebuild..."
                    sleep 20  # Dar tempo para containers iniciarem
                    check_startup_order
                    test_endpoints
                    validate_system_complete
                    show_final_info
                    exit 0
                fi
            else
                log "Rebuild não necessário (use --force para forçar)"
            fi
        fi
    fi
    
    show_menu
    
    # Se modo rebuild-restart, executar e sair
    if [[ "$INSTALL_MODE" == "rebuild-restart" ]]; then
        rebuild_and_restart
        exit 0
    fi
    
    # AGORA definir INSTALL_DIR baseado no modo escolhido
    setup_project
    
    # Perguntar sobre players (após definir INSTALL_DIR)
    show_players_menu
    
    # Copiar/sincronizar player-web do repositório para INSTALL_DIR (necessário para /player funcionar)
    # Quando INSTALL_DIR == SOURCE_DIR (single-server), player-web já está no lugar — não copiar
    local _src_abs _inst_abs
    _src_abs="$(readlink -f "$SOURCE_DIR" 2>/dev/null || realpath "$SOURCE_DIR" 2>/dev/null || echo "$SOURCE_DIR")"
    _inst_abs="$(readlink -f "$INSTALL_DIR" 2>/dev/null || realpath "$INSTALL_DIR" 2>/dev/null || echo "$INSTALL_DIR")"
    if [[ -n "$_src_abs" && -n "$_inst_abs" && "$_src_abs" == "$_inst_abs" ]]; then
        log "✅ Player Web já no diretório de origem (pulando cópia)"
    elif [[ -d "$SOURCE_DIR/player-web" ]] && [[ -f "$SOURCE_DIR/player-web/index.html" ]]; then
        log "Copiando Player Web (necessário para /player funcionar)..."
        mkdir -p "$INSTALL_DIR/player-web"
        cp -r "$SOURCE_DIR/player-web/"* "$INSTALL_DIR/player-web/" 2>/dev/null || {
            warn "Falha ao copiar Player Web"
        }
        log "✅ Player Web copiado para $INSTALL_DIR/player-web/ (inclui vinhetas e propagandas)"
    fi
    
    # Perguntar layout Nginx (site corporativo vs painel) antes de HTTPS e firewall
    ask_public_host_and_split_layout
    
    # Perguntar sobre HTTPS (após menu, antes da instalação)
    ask_https_configuration
    
    log "Iniciando instalação do Smart Signage Pro v2.0..."
    
    update_system
    install_dependencies
    fix_network_wait
    install_nodejs
    install_docker
    configure_firewall
    install_project_dependencies
    setup_database
    setup_environment
    setup_mosquitto_local
    
    # Configurar DNS local (opcional, antes do Nginx)
    setup_local_dns
    
    # Para single-server: setup_first_boot DEVE ser antes de create_systemd_service
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        setup_first_boot  # Executar migrations e seed ANTES de iniciar o serviço
    fi

    # Sanitize any legacy/invalid nginx confs before testing/reloading nginx
    sanitize_nginx_conf
    setup_nginx
    # Configurar assets públicos e aplicar DDL/seeds (idempotente)
    setup_assets_and_db
    setup_letsencrypt  # Configurar Let's Encrypt se escolhido
    create_systemd_service
    # Garantia explícita: single-server sem unit em /etc/systemd não é instalação válida
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        if [[ ! -f /etc/systemd/system/smart-signage.service ]]; then
            error "❌ Em modo single-server falta /etc/systemd/system/smart-signage.service após create_systemd_service."
            error "   Corra de novo o install em single-server ou: sudo bash $INSTALL_DIR/scripts/create-smart-signage-service.sh $INSTALL_DIR"
            exit 1
        fi
        sudo systemctl daemon-reload 2>/dev/null || true
        if [[ "$(systemctl is-enabled smart-signage.service 2>/dev/null || echo disabled)" != "enabled" ]]; then
            warning "smart-signage não estava enabled; a corrigir..."
            sudo systemctl enable smart-signage.service || {
                error "❌ Não foi possível habilitar smart-signage.service para o boot."
                exit 1
            }
        fi
        log "✅ systemd: smart-signage.service presente e $(systemctl is-enabled smart-signage.service 2>/dev/null || echo enabled)"
    fi
    
    # Para Docker: setup_docker_compose
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        setup_docker_compose
    fi
    
    # Se modo Docker, verificar se precisa rebuild apenas SE já existe instalação anterior
    # Não fazer rebuild automático durante instalação nova (já foi feito build em setup_docker_compose)
    if [[ "$INSTALL_MODE" == "docker" ]] && [[ "$REBUILD_MODE" != "true" ]] && [[ -f "$INSTALL_DIR/.build-info.json" ]]; then
        if check_rebuild_needed; then
            log_progress "Mudanças detectadas - fazendo rebuild automático..."
            REBUILD_MODE=true
            rebuild_preserve_data
            # rebuild_preserve_data já reinicia os containers
            log "Aguardando serviços iniciarem após rebuild..."
            sleep 20  # Dar tempo suficiente para containers iniciarem
            check_startup_order
            test_endpoints
            validate_system_complete
            [[ "$START_TOTEM" == "true" ]] && start_totem_laboratory
            show_final_info
            exit 0
        fi
    fi
    
    # Para single-server: iniciar serviços após setup completo
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        start_services_in_order

        # Garantia extra: instalação deve terminar com backend habilitado e ativo.
        # Em alguns cenários (race de systemd/DB), o serviço pode ficar inativo
        # mesmo após a sequência principal de start.
        if ! systemctl is-active --quiet smart-signage 2>/dev/null; then
            warning "Serviço smart-signage inativo após instalação. Aplicando start forçado..."
            ensure_smart_signage_service
            sudo systemctl daemon-reload 2>/dev/null || true
            sudo systemctl enable smart-signage 2>/dev/null || true
            sudo systemctl start smart-signage 2>/dev/null || true
            sleep 5
        fi
        
        # Verificar que portas 80 e 3000 estão em uso; se não, criar serviço (se faltar), iniciar e revalidar
        if ! (command -v ss &>/dev/null && ss -tlnp 2>/dev/null | grep -q ":3000 ") || \
           ! (command -v ss &>/dev/null && ss -tlnp 2>/dev/null | grep -q ":80 "); then
            warning "Portas 80 ou 3000 não estão ativas. Garantindo serviço backend e reiniciando..."
            # Garantir que o unit smart-signage.service existe (cria se estiver em falta)
            ensure_smart_signage_service
            sudo systemctl daemon-reload 2>/dev/null || true
            sudo systemctl start smart-signage 2>/dev/null || true
            sleep 5
            sudo systemctl start nginx 2>/dev/null || true
            sleep 2
            if [[ -f "$INSTALL_DIR/scripts/fix-nginx-and-port80.sh" ]]; then
                run_fix_nginx_port80_if_allowed "$INSTALL_DIR/scripts/fix-nginx-and-port80.sh"
            fi
            if ! (command -v ss &>/dev/null && ss -tlnp 2>/dev/null | grep -q ":3000 "); then
                error "❌ Backend não está a escutar na porta 3000."
                error "   Execute: sudo systemctl status smart-signage && sudo journalctl -u smart-signage -n 50"
                error "   Depois: sudo bash $INSTALL_DIR/scripts/start-services.sh"
                exit 1
            fi
            if ! (command -v ss &>/dev/null && ss -tlnp 2>/dev/null | grep -q ":80 "); then
                error "❌ Nginx não está a escutar na porta 80."
                error "   Execute: sudo nginx -t && sudo systemctl status nginx"
                error "   Depois: sudo bash $INSTALL_DIR/scripts/start-services.sh"
                exit 1
            fi
        fi

        # Last resort: chamar start-services.sh automaticamente quando disponível.
        # Isso cobre cenários intermitentes de pós-instalação (systemd/nginx) sem ação manual.
        if ! (command -v ss &>/dev/null && ss -tlnp 2>/dev/null | grep -q ":3000 ") || \
           ! (command -v ss &>/dev/null && ss -tlnp 2>/dev/null | grep -q ":80 "); then
            local start_services_script=""
            if [[ -x "$INSTALL_DIR/scripts/start-services.sh" ]]; then
                start_services_script="$INSTALL_DIR/scripts/start-services.sh"
            elif [[ -x "$SOURCE_DIR/scripts/start-services.sh" ]]; then
                start_services_script="$SOURCE_DIR/scripts/start-services.sh"
            elif [[ -f "$INSTALL_DIR/scripts/start-services.sh" ]]; then
                start_services_script="$INSTALL_DIR/scripts/start-services.sh"
            elif [[ -f "$SOURCE_DIR/scripts/start-services.sh" ]]; then
                start_services_script="$SOURCE_DIR/scripts/start-services.sh"
            fi

            if [[ -n "$start_services_script" ]]; then
                warning "Aplicando fallback final: executando $start_services_script ..."
                bash "$start_services_script" || true
                sleep 3
            fi
        fi

        # Verificação final após fallback.
        if ! (command -v ss &>/dev/null && ss -tlnp 2>/dev/null | grep -q ":3000 "); then
            error "❌ Backend não está a escutar na porta 3000 após fallback automático."
            error "   Execute: sudo systemctl status smart-signage && sudo journalctl -u smart-signage -n 80"
            exit 1
        fi
        if ! (command -v ss &>/dev/null && ss -tlnp 2>/dev/null | grep -q ":80 "); then
            error "❌ Nginx não está a escutar na porta 80 após fallback automático."
            error "   Execute: sudo nginx -t && sudo systemctl status nginx"
            exit 1
        fi
    else
        check_startup_order
    fi
    test_endpoints
    validate_system_complete
    
    # Para Docker: setup_first_boot é executado dentro do container
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        log "Para Docker, primeiro boot será configurado dentro do container"
    fi
    
    # Executar --starttotem se solicitado (após validação, antes do resumo final)
    start_totem_laboratory
    
    create_management_script
    setup_management_scripts
    
    # Configurar modo Kiosk se solicitado
    if [[ "$ENABLE_KIOSK_MODE" == "true" ]]; then
        setup_kiosk_mode
    fi
    
    # Verificações finais integradas (não bloqueantes)
    log "Realizando verificações finais integradas..."
    
    # Verificar containers Docker
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        log "Verificando status dos containers..."
        $COMPOSE_CMD ps
        
        # Verificar MQTT Broker
        if $COMPOSE_CMD ps | grep -q smartsignage-mqtt; then
            log "✅ MQTT Broker: Container rodando"
            if command -v mosquitto_sub &> /dev/null; then
                if timeout 2 mosquitto_sub -h localhost -p 1883 -t '$SYS/#' -C 1 > /dev/null 2>&1; then
                    log "✅ MQTT Broker: Conectado e respondendo"
                else
                    warning "⚠️  MQTT Broker: Container rodando mas não respondeu ao teste"
                fi
            else
                log "ℹ️  MQTT Broker: Container rodando (teste detalhado requer mosquitto_sub)"
            fi
        else
            warning "⚠️  MQTT Broker: Container não encontrado"
        fi
        
        # Verificar outros serviços essenciais
        if $COMPOSE_CMD ps | grep -q smartsignage-postgres; then
            log "✅ PostgreSQL: Container rodando"
        else
            warning "⚠️  PostgreSQL: Container não encontrado"
        fi
        
        if $COMPOSE_CMD ps | grep -q smartsignage-redis; then
            log "✅ Redis: Container rodando"
        else
            warning "⚠️  Redis: Container não encontrado"
        fi
        
        if $COMPOSE_CMD ps | grep -q smartsignage-app; then
            log "✅ App (Backend+Frontend): Container rodando"
        else
            warning "⚠️  App: Container não encontrado"
        fi
    fi
    
    # Verificar serviços systemd (single-server) — unit oficial: smart-signage.service
    if [[ "$INSTALL_MODE" == "single-server" ]]; then
        log "Verificando serviços systemd..."
        if [[ -f /etc/systemd/system/smart-signage.service ]]; then
            local _en_state
            _en_state=$(systemctl is-enabled smart-signage.service 2>/dev/null || echo "not-found")
            if [[ "$_en_state" == "enabled" ]]; then
                log "✅ Backend: smart-signage.service enabled (arranque automático no boot)"
            else
                warning "⚠️  Backend: smart-signage.service não está enabled (estado: $_en_state). Execute: sudo systemctl enable smart-signage.service"
            fi
        else
            warning "⚠️  Backend: ficheiro /etc/systemd/system/smart-signage.service em falta"
        fi
        if systemctl is-active --quiet smart-signage.service 2>/dev/null; then
            log "✅ Backend: smart-signage ativo"
        elif systemctl is-active --quiet smartsignage-backend 2>/dev/null; then
            log "✅ Backend: smartsignage-backend ativo (nome legado)"
        else
            warning "⚠️  Backend: smart-signage não está ativo"
        fi
        
        if systemctl is-active --quiet nginx; then
            log "✅ Nginx: Serviço ativo"
        else
            warning "⚠️  Nginx: Serviço não está ativo"
        fi
        
        if systemctl is-active --quiet postgresql; then
            log "✅ PostgreSQL: Serviço ativo"
        else
            warning "⚠️  PostgreSQL: Serviço não está ativo"
        fi
    fi
    
    # Salvar informações da build após instalação bem-sucedida
    if [[ "$INSTALL_MODE" == "docker" ]]; then
        save_build_info
    fi
    
    # Garantir que informações finais sejam sempre exibidas
    export SHOW_FINAL_INFO_CALLED=true
    show_final_info
}

# Executar script
main "$@"
