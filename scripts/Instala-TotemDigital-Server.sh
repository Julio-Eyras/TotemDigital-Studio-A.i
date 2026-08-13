#!/usr/bin/env bash
# =============================================================================
# Instala-TotemDigital-Server.sh
# -----------------------------------------------------------------------------
# Instalador oficial TotemDigital (servidor) — produto final, menu em português.
#
# NÃO altera install-smartsignage.sh: envolve-o e organiza modos claros.
#
# Uso (utilizador normal, NÃO root):
#   cd ~/TotemDigital-Studio
#   bash scripts/Instala-TotemDigital-Server.sh
#   bash scripts/Instala-TotemDigital-Server.sh --modo producao --sim
#   bash scripts/Instala-TotemDigital-Server.sh --ajuda
#
# Doc: docs/INSTALA-TOTEMDIGITAL-SERVER.md
# =============================================================================
set -euo pipefail

readonly SCRIPT_VERSION="1.1.2"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly ENGINE="$SCRIPT_DIR/install-smartsignage.sh"
readonly FIX_ENV="$SCRIPT_DIR/fix-env-shell-quoting.sh"
readonly FIX_HTTPS="$SCRIPT_DIR/apply-https-unified-443.sh"
readonly TDI_LIB="$SCRIPT_DIR/lib/totemdigital-instancia.sh"
# shellcheck source=lib/totemdigital-instancia.sh
source "$TDI_LIB"

# Cores (só se terminal)
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_RED=$'\033[31m'
  C_CYAN=$'\033[36m'
else
  C_RESET= C_BOLD= C_DIM= C_GREEN= C_YELLOW= C_RED= C_CYAN=
fi

# -----------------------------------------------------------------------------
# Estado / defaults
# -----------------------------------------------------------------------------
MODO=""                         # producao|atualizar|reparar|docker|wipe
INSTANCIA="${INSTANCIA:-producao}" # producao|dev|teste
INSTANCIA_SET=false
DOMAIN="${DOMAIN:-totemdigital.app.br}"
SSL_EMAIL="${SSL_EMAIL:-}"
OWNER_USER="${OWNER_USER:-Owner}"
OWNER_NAME="${OWNER_NAME:-Totem Digital}"
SKIP_PLAYERS=true
NO_SEEDS=true
WITH_MQTT=false
NON_INTERACTIVE=false
DRY_RUN=false
DO_GIT_PULL=false

# -----------------------------------------------------------------------------
# Utilitários de UI
# -----------------------------------------------------------------------------
log()   { echo "${C_CYAN}[INFO]${C_RESET} $*"; }
ok()    { echo "${C_GREEN}[OK]${C_RESET} $*"; }
warn()  { echo "${C_YELLOW}[AVISO]${C_RESET} $*"; }
err()   { echo "${C_RED}[ERRO]${C_RESET} $*" >&2; }
title() {
  echo
  echo "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
  echo "${C_BOLD} $*${C_RESET}"
  echo "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
}
pause_enter() {
  [[ "$NON_INTERACTIVE" == "true" ]] && return 0
  read -r -p "Prima Enter para continuar (Ctrl+C cancela)... " _
}

ask() {
  # ask "Pergunta" "default" → imprime valor escolhido em stdout
  local prompt="$1"
  local def="${2-}"
  local ans
  if [[ "$NON_INTERACTIVE" == "true" ]]; then
    printf '%s' "$def"
    return 0
  fi
  if [[ -n "$def" ]]; then
    read -r -p "$prompt [$def]: " ans || true
    printf '%s' "${ans:-$def}"
  else
    read -r -p "$prompt: " ans || true
    printf '%s' "$ans"
  fi
}

ask_yn() {
  # ask_yn "Pergunta" "n" → true/false (exit code 0 = sim)
  local prompt="$1"
  local def="${2:-n}"
  local ans
  if [[ "$NON_INTERACTIVE" == "true" ]]; then
    [[ "$def" =~ ^[sSyY] ]] && return 0 || return 1
  fi
  read -r -p "$prompt [s/N]: " ans || true
  ans="${ans:-$def}"
  [[ "$ans" =~ ^[sSyY] ]]
}

# -----------------------------------------------------------------------------
# Pré-voo
# -----------------------------------------------------------------------------
ensure_not_root() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    if [[ -n "${SUDO_USER:-}" ]] && [[ "$SUDO_USER" != "root" ]]; then
      log "A reexecutar como ${SUDO_USER} (não correr como root)..."
      exec sudo -u "$SUDO_USER" -H bash "$0" "$@"
    fi
    err "Não execute com sudo/root."
    err "  bash scripts/Instala-TotemDigital-Server.sh"
    exit 1
  fi
}

preflight() {
  title "Pré-voo — verificações"
  local fail=0

  cd "$ROOT" || { err "Raiz do repo inválida: $ROOT"; exit 1; }

  if [[ ! -f "$ENGINE" ]]; then
    err "Motor em falta: $ENGINE"
    fail=1
  else
    ok "Motor: install-smartsignage.sh"
  fi

  if ! command -v git >/dev/null 2>&1; then
    err "git não encontrado"
    fail=1
  else
    local br remote
    br="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
    remote="$(git remote get-url origin 2>/dev/null || echo '?')"
    ok "Git branch=${br}"
    echo "         origin=${remote}"
    if [[ "$br" != "SmartSignage-direc-totem" ]]; then
      warn "Branch actual não é SmartSignage-direc-totem — confirme se é intencional."
    fi
  fi

  if ! command -v node >/dev/null 2>&1; then
    warn "Node.js ainda não instalado (o motor pode instalar)."
  else
    ok "Node $(node -v 2>/dev/null || true)"
  fi

  if ! command -v nginx >/dev/null 2>&1; then
    warn "Nginx ainda não instalado (o motor pode instalar)."
  else
    ok "Nginx presente"
  fi

  local ipv4
  ipv4="$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -Eo '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1 || true)"
  [[ -n "$ipv4" ]] && ok "IPv4 local: $ipv4" || warn "IPv4 local não detectado"

  if [[ -n "$DOMAIN" ]] && command -v getent >/dev/null 2>&1; then
    local dns
    dns="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1}' | head -1 || true)"
    if [[ -n "$dns" ]]; then
      ok "DNS A ${DOMAIN} → ${dns}"
      if [[ -n "$ipv4" && "$dns" != "$ipv4" ]]; then
        warn "DNS ($dns) ≠ IPv4 desta máquina ($ipv4). Let's Encrypt pode falhar."
      fi
    else
      warn "DNS A de ${DOMAIN} não resolvido (LE pode falhar)."
    fi
  fi

  if [[ -d /opt/smart-signage ]]; then
    ok "Instalação anterior detectada em /opt/smart-signage"
  else
    log "Sem /opt/smart-signage (primeira instalação ou path diferente)."
  fi

  if [[ $fail -ne 0 ]]; then
    err "Pré-voo falhou. Corrija e tente de novo."
    exit 1
  fi
  echo
}

# -----------------------------------------------------------------------------
# Export / comando do motor (sem alterar o motor)
# -----------------------------------------------------------------------------
export_totem_env() {
  export TOTEMDIGITAL_INSTALL_PRESET=true
  export SMARTSIGNAGE_SPLIT_SITE=true
  export SMARTSIGNAGE_CORPORATE_HTTP_PORT=80
  export SMARTSIGNAGE_SYSTEM_HTTP_PORT=8080
  export SMARTSIGNAGE_PUBLIC_HOST="$DOMAIN"
  export SMARTSIGNAGE_DOMAIN_NAME="$DOMAIN"
  export SMARTSIGNAGE_SSL_EMAIL="$SSL_EMAIL"
  export INSTALL_TOTEMDIGITAL_COMPACT=true
  export SYSTEM_OWNER_ADMIN_USERNAME="$OWNER_USER"
  export SYSTEM_OWNER_NAME="$OWNER_NAME"
  export SYSTEM_OWNER_EMAIL="$SSL_EMAIL"
  export TOTEMDIGITAL_WITH_MQTT="$([[ "$WITH_MQTT" == "true" ]] && echo true || echo false)"
}

build_engine_cmd_producao() {
  # Array global ENGINE_CMD
  ENGINE_CMD=(
    bash "$ENGINE"
    --totemdigital-preset
    --mode single-server-prod
    --totemdigital-compact
    --direct-totem
    --split-corporate-system
    --public-host "$DOMAIN"
    --corporate-http-port 80
    --system-http-port 8080
  )
  export SMARTSIGNAGE_LETSENCRYPT=true
  if [[ "$WITH_MQTT" == "true" ]]; then
    ENGINE_CMD+=(--mqtt-mode production)
  else
    ENGINE_CMD+=(--mqtt-mode dev)
  fi
  ENGINE_CMD+=(--skip-menu)
  [[ "$SKIP_PLAYERS" == "true" ]] && ENGINE_CMD+=(--skip-players)
  [[ "$NO_SEEDS" == "true" ]] && ENGINE_CMD+=(--no-seeds)
}

build_engine_cmd_docker() {
  ENGINE_CMD=(
    bash "$ENGINE"
    --mode docker
    --totemdigital-compact
    --direct-totem
  )
  if [[ "$WITH_MQTT" == "true" ]]; then
    ENGINE_CMD+=(--mqtt-mode production)
  else
    ENGINE_CMD+=(--mqtt-mode dev)
  fi
  ENGINE_CMD+=(--skip-menu)
  [[ "$SKIP_PLAYERS" == "true" ]] && ENGINE_CMD+=(--skip-players)
  [[ "$NO_SEEDS" == "true" ]] && ENGINE_CMD+=(--no-seeds)
}

build_engine_cmd_wipe() {
  build_engine_cmd_producao
  ENGINE_CMD+=(--fresh)
}

maybe_disable_mosquitto() {
  if [[ "$WITH_MQTT" == "true" ]]; then
    return 0
  fi
  if systemctl is-failed --quiet mosquitto 2>/dev/null || \
     systemctl is-active --quiet mosquitto 2>/dev/null; then
    log "A desactivar mosquitto (não necessário sem SmartDisplayFX)..."
    sudo systemctl stop mosquitto 2>/dev/null || true
    sudo systemctl disable mosquitto 2>/dev/null || true
    sudo systemctl reset-failed mosquitto 2>/dev/null || true
  fi
}

run_engine() {
  export_totem_env
  maybe_disable_mosquitto
  echo
  log "Comando do motor:"
  printf '  %q' "${ENGINE_CMD[@]}"
  echo
  echo
  if [[ "$DRY_RUN" == "true" ]]; then
    warn "Dry-run: motor NÃO executado."
    return 0
  fi
  "${ENGINE_CMD[@]}"
}

# -----------------------------------------------------------------------------
# Pós-passos (organização no instalador novo — não mexem no motor)
# -----------------------------------------------------------------------------
post_fix_env_quoting() {
  if [[ -x "$FIX_ENV" ]] || [[ -f "$FIX_ENV" ]]; then
    log "A garantir .env com aspas shell-safe..."
    bash "$FIX_ENV" "$ROOT/.env" "$ROOT/backend/.env" 2>/dev/null || bash "$FIX_ENV" || true
  fi
}

post_fix_financial_https() {
  local f="$ROOT/.env"
  [[ -f "$f" ]] || return 0
  [[ -n "$DOMAIN" ]] || return 0
  local https_url="https://${DOMAIN}"
  local tmp
  tmp="$(mktemp)"
  if grep -qE '^FINANCIAL_PUBLIC_APP_URL=' "$f" 2>/dev/null; then
    grep -vE '^FINANCIAL_PUBLIC_APP_URL=' "$f" > "$tmp" || true
    echo "FINANCIAL_PUBLIC_APP_URL=\"${https_url}\"" >> "$tmp"
    mv -f "$tmp" "$f"
    log "FINANCIAL_PUBLIC_APP_URL → ${https_url}"
  else
    echo "FINANCIAL_PUBLIC_APP_URL=\"${https_url}\"" >> "$f"
    rm -f "$tmp"
  fi
  if [[ -f "$ROOT/backend/.env" ]]; then
    cp -f "$f" "$ROOT/backend/.env" 2>/dev/null || true
  fi
}

post_https_unified() {
  if [[ -f "$FIX_HTTPS" ]]; then
    log "A garantir Nginx HTTPS unificado (443)..."
    bash "$FIX_HTTPS" || warn "apply-https-unified-443 terminou com aviso."
  fi
}

post_rebuild_frontend_https() {
  local api="https://${DOMAIN}/api"
  local fe="$ROOT/frontend"
  [[ -d "$fe" ]] || return 0
  [[ -f "$fe/package.json" ]] || return 0
  if [[ ! -d "$fe/node_modules" ]]; then
    log "frontend/node_modules ausente — instalando dependências determinísticas..."
    (cd "$fe" && npm ci)
  fi
  log "Rebuild frontend com REACT_APP_API_URL=${api} ..."
  if [[ "$DRY_RUN" == "true" ]]; then
    warn "Dry-run: rebuild não executado."
    return 0
  fi
  (
    cd "$fe"
    export REACT_APP_API_URL="$api"
    export REACT_APP_TOTEMDIGITAL_COMPACT=true
    export REACT_APP_DIRECT_TOTEM_MODE=true
    export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
    npm run build
  )
  if [[ -d /opt/smart-signage/frontend/build ]]; then
    sudo rsync -a --delete "$fe/build/" /opt/smart-signage/frontend/build/ || true
    ok "Build copiado para /opt/smart-signage/frontend/build"
  fi
}

post_apply_schema() {
  local env_file="/opt/smart-signage/.env"
  [[ -f "$env_file" ]] || env_file="$ROOT/.env"
  if [[ ! -f "$env_file" ]]; then
    warn "Arquivo .env não encontrado — schema não reaplicado automaticamente."
    return 0
  fi
  local db_name db_user db_host db_port db_password
  db_name="$(grep '^DB_NAME=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\"' | tr -d "'" | xargs || true)"
  db_user="$(grep '^DB_USER=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\"' | tr -d "'" | xargs || true)"
  db_host="$(grep '^DB_HOST=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\"' | tr -d "'" | xargs || true)"
  db_port="$(grep '^DB_PORT=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\"' | tr -d "'" | xargs || true)"
  db_password="$(grep '^DB_PASSWORD=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true)"
  log "A aplicar schema definitivo de forma idempotente..."
  DB_NAME="${db_name:-smartsignage}" \
  DB_USER="${db_user:-smartsignage}" \
  DB_HOST="${db_host:-localhost}" \
  DB_PORT="${db_port:-5432}" \
  PGPASSWORD="${db_password:-smartsignage123}" \
  SKIP_CONFIRM=true \
    bash "$ROOT/database/apply-schema-v2.sh"
}

post_provision_official_apk() {
  local env_file="/opt/smart-signage/.env"
  [[ -f "$env_file" ]] || env_file="$ROOT/.env"
  local be="/opt/smart-signage/backend"
  [[ -d "$be" ]] || be="$ROOT/backend"
  if [[ ! -f "$env_file" ]]; then
    warn ".env não encontrado — APK oficial não designado automaticamente."
    return 0
  fi
  local db_name db_user db_host db_port db_password
  db_name="$(grep '^DB_NAME=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\"' | tr -d "'" | xargs || true)"
  db_user="$(grep '^DB_USER=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\"' | tr -d "'" | xargs || true)"
  db_host="$(grep '^DB_HOST=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\"' | tr -d "'" | xargs || true)"
  db_port="$(grep '^DB_PORT=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\"' | tr -d "'" | xargs || true)"
  db_password="$(grep '^DB_PASSWORD=' "$env_file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true)"
  log "A designar Player-AD oficial do kit git ..."
  if [[ "$DRY_RUN" == "true" ]]; then
    warn "Dry-run: APK não designado."
    return 0
  fi
  DB_NAME="${db_name:-smartsignage}" \
  DB_USER="${db_user:-smartsignage}" \
  DB_HOST="${db_host:-localhost}" \
  DB_PORT="${db_port:-5432}" \
  PGPASSWORD="${db_password:-smartsignage123}" \
    bash "$ROOT/scripts/provision-official-player-apk.sh" \
      --repo "$ROOT" \
      --backend-dir "$be" \
    || warn "Não foi possível designar o APK oficial do kit."
}

post_rebuild_backend() {
  local be="$ROOT/backend"
  [[ -d "$be" ]] || return 0
  if [[ ! -d "$be/node_modules" ]]; then
    log "backend/node_modules ausente — instalando dependências determinísticas..."
    (cd "$be" && npm ci)
  fi
  log "A compilar backend..."
  if [[ "$DRY_RUN" == "true" ]]; then
    warn "Dry-run: compile não executado."
    return 0
  fi
  (
    cd "$be"
    if [[ ! -d node_modules/typescript ]] && [[ ! -x node_modules/.bin/tsc ]]; then
      npm install --include=dev 2>/dev/null || npm install
    fi
    npm run build || {
      [[ -x ./node_modules/.bin/tsc ]] && ./node_modules/.bin/tsc -p tsconfig.json
    }
  )
  if [[ -d /opt/smart-signage/backend ]]; then
    sudo rsync -a "$be/dist/" /opt/smart-signage/backend/dist/ 2>/dev/null || true
    sudo rsync -a "$be/package.json" /opt/smart-signage/backend/ 2>/dev/null || true
    [[ -d "$ROOT/docs" ]] && sudo rsync -a --delete "$ROOT/docs/" /opt/smart-signage/docs/ 2>/dev/null || true
  fi
  if systemctl is-active --quiet smart-signage 2>/dev/null; then
    sudo systemctl restart smart-signage || true
    ok "smart-signage reiniciado"
  fi
}

show_final_summary() {
  if tdi_is_non_prod; then
    tdi_load_profile "$INSTANCIA" 2>/dev/null || true
    tdi_show_final_summary
    return 0
  fi
  title "Concluído — TotemDigital Server (produção)"
  local ipv4
  ipv4="$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -Eo '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1 || echo '<IP>')"
  echo "  Site ............. https://${DOMAIN}/"
  echo "  Login painel ..... https://${DOMAIN}/login"
  echo "  API .............. https://${DOMAIN}/api"
  echo "  Painel HTTP ...... http://${ipv4}:8080/login"
  echo "  Player-AD ........ serverUrl=https://${DOMAIN}"
  echo "  Owner admin ...... ${OWNER_USER} / admin123  ${C_DIM}(altere a senha)${C_RESET}"
  echo
  echo "  Repo ............. $ROOT"
  echo "  Motor ............ scripts/install-smartsignage.sh (inalterado)"
  echo
  echo "${C_DIM}Player-AD APK instala-se no aparelho (ADB/pendrive), não neste script.${C_RESET}"
  echo
}

# -----------------------------------------------------------------------------
# Modos
# -----------------------------------------------------------------------------
modo_producao() {
  if tdi_is_non_prod; then
    title "Modo 1 — Instalação instância ${INSTANCIA} (HTTPS 443)"
    echo "Stack isolada: clone próprio, BD própria, portas e Nginx dedicados."
    echo "NÃO usa install-smartsignage.sh — produção em /opt/smart-signage fica intacta."
    echo
    pause_enter
    collect_common_params
    tdi_instancia_install
    return $?
  fi
  title "Modo 1 — Instalação de produção (HTTPS 443)"
  echo "Perfil: compact + direct-totem + site :80 + painel :8080 + Let's Encrypt."
  if [[ "$WITH_MQTT" == "true" ]]; then
    echo "Mosquitto: SIM"
  else
    echo "Mosquitto: NÃO (recomendado para TotemDigital sem SmartDisplayFX)"
  fi
  echo
  echo "${C_YELLOW}Atenção:${C_RESET} o motor pode recriar a BD se detectar reinstalação limpa."
  echo "Para só actualizar código sem wipe, use o modo 2."
  echo
  pause_enter
  collect_common_params
  build_engine_cmd_producao
  run_engine
  local rc=$?
  if [[ $rc -eq 0 ]]; then
    post_fix_env_quoting
    post_fix_financial_https
    post_https_unified
  fi
  return $rc
}

modo_atualizar() {
  if tdi_is_non_prod; then
    title "Modo 2 — Actualizar instância ${INSTANCIA} (SEM apagar BD)"
    pause_enter
    collect_common_params_light
    tdi_instancia_update
    return $?
  fi
  title "Modo 2 — Actualizar / reaplicar (SEM apagar a base de dados)"
  echo "Isto faz:"
  echo "  • (opcional) git pull"
  echo "  • compile backend + rebuild frontend com /api HTTPS"
  echo "  • reparar .env (aspas) + Nginx 443"
  echo "  • reiniciar smart-signage"
  echo
  echo "NÃO executa install-smartsignage completo → NÃO faz DROP DATABASE."
  echo
  pause_enter
  collect_common_params_light
  if [[ "$DO_GIT_PULL" == "true" ]] || ask_yn "Executar git pull origin agora?" "n"; then
    if [[ "$DRY_RUN" == "true" ]]; then
      warn "Dry-run: git pull não executado."
    else
      git -C "$ROOT" pull --ff-only || warn "git pull falhou — continue com o código local."
    fi
  fi
  post_fix_env_quoting
  post_fix_financial_https
  post_apply_schema
  post_rebuild_backend
  post_provision_official_apk
  post_rebuild_frontend_https
  post_https_unified
  ok "Actualização concluída (sem wipe da BD)."
  return 0
}

modo_reparar() {
  if tdi_is_non_prod; then
    title "Modo 3 — Reparar instância ${INSTANCIA}"
    pause_enter
    collect_common_params_light
    tdi_instancia_repair
    return $?
  fi
  title "Modo 3 — Só reparar (rápido)"
  echo "Corrige:"
  echo "  • .env com aspas (evita CHANNEL: command not found)"
  echo "  • FINANCIAL_PUBLIC_APP_URL em HTTPS"
  echo "  • Nginx HTTPS unificado 443 (site + /login + /api)"
  echo
  pause_enter
  collect_common_params_light
  if [[ "$DRY_RUN" == "true" ]]; then
    warn "Dry-run: reparos não aplicados."
    return 0
  fi
  post_fix_env_quoting
  post_fix_financial_https
  post_https_unified
  ok "Reparos concluídos."
  return 0
}

modo_docker() {
  if tdi_is_non_prod; then
    err "Modo Docker não suporta --instancia dev|teste nesta versão."
    err "Use --instancia producao ou instale dev/test com --modo producao --instancia dev."
    return 1
  fi
  title "Modo 4 — Docker"
  echo "Usa o motor: install-smartsignage.sh --mode docker"
  echo "Perfil TotemDigital compact + direct-totem."
  echo
  pause_enter
  collect_common_params
  build_engine_cmd_docker
  # Docker tipicamente sem LE split no mesmo wrapper — env ainda exportado
  unset SMARTSIGNAGE_LETSENCRYPT || true
  run_engine
  local rc=$?
  if [[ $rc -eq 0 ]]; then
    post_fix_env_quoting || true
  fi
  return $rc
}

modo_wipe() {
  if tdi_is_non_prod; then
    title "Modo 5 — Wipe instância ${INSTANCIA} (APAGA SÓ ESTA BD)"
    echo "${C_RED}${C_BOLD}PERIGO:${C_RESET} apaga apenas ${INSTANCIA} (BD isolada)."
    echo "Produção (/opt/smart-signage · smartsignage) NÃO é afectada."
    echo
    pause_enter
    collect_common_params
    tdi_instancia_wipe
    return $?
  fi
  title "Modo 5 — Reinstalação LIMPA (APAGA DADOS)"
  echo "${C_RED}${C_BOLD}PERIGO:${C_RESET} isto pede ao motor --fresh e pode"
  echo "  • apagar a base de dados PostgreSQL smartsignage"
  echo "  • recriar schema e owner mínimos"
  echo
  echo "Uploads em disco podem permanecer; a BD NÃO."
  echo
  if [[ "$NON_INTERACTIVE" == "true" ]]; then
    err "Wipe recusado em --sim/--yes. Corra em modo interactivo e confirme."
    return 1
  fi
  local conf1 conf2
  read -r -p "Escreva exactamente APAGAR para continuar: " conf1
  [[ "$conf1" == "APAGAR" ]] || { err "Cancelado."; return 1; }
  collect_common_params
  read -r -p "Confirme o domínio a instalar [$DOMAIN]: " conf2
  conf2="${conf2:-$DOMAIN}"
  [[ "$conf2" == "$DOMAIN" ]] || { err "Domínio não confere. Cancelado."; return 1; }
  echo
  warn "Última confirmação: vai apagar dados da BD."
  pause_enter
  build_engine_cmd_wipe
  run_engine
  local rc=$?
  if [[ $rc -eq 0 ]]; then
    post_fix_env_quoting
    post_fix_financial_https
    post_https_unified
  fi
  return $rc
}

collect_common_params() {
  DOMAIN="$(ask "Domínio público (Let's Encrypt)" "$DOMAIN")"
  SSL_EMAIL="$(ask "E-mail (LE + owner)" "${SSL_EMAIL:-admin@${DOMAIN}}")"
  OWNER_USER="$(ask "Utilizador admin owner" "$OWNER_USER")"
  OWNER_NAME="$(ask "Nome da organização" "$OWNER_NAME")"
  if ask_yn "Instalar Mosquitto (só SmartDisplayFX)?" "n"; then WITH_MQTT=true; else WITH_MQTT=false; fi
  if ask_yn "Copiar players cliente (webOS/Tizen/…)?" "n"; then SKIP_PLAYERS=false; else SKIP_PLAYERS=true; fi
  if ask_yn "Carregar seeds de demonstração?" "n"; then NO_SEEDS=false; else NO_SEEDS=true; fi
}

collect_common_params_light() {
  DOMAIN="$(ask "Domínio público" "$DOMAIN")"
  SSL_EMAIL="$(ask "E-mail" "${SSL_EMAIL:-admin@${DOMAIN}}")"
}

# -----------------------------------------------------------------------------
# Menu
# -----------------------------------------------------------------------------
ask_instancia_interactive() {
  [[ "$INSTANCIA_SET" == "true" ]] && return 0
  [[ "$NON_INTERACTIVE" == "true" ]] && return 0
  echo
  echo "  Instância actual: ${C_BOLD}${INSTANCIA}${C_RESET}"
  echo "    1) producao   2) dev   3) teste   [Enter mantém]"
  local choice
  read -r -p "Instância [${INSTANCIA}]: " choice || true
  choice="${choice:-$INSTANCIA}"
  case "$choice" in
    1|producao|prod) INSTANCIA=producao ;;
    2|dev) INSTANCIA=dev ;;
    3|teste|test) INSTANCIA=teste ;;
    "") ;;
    *) warn "Instância inválida — mantém ${INSTANCIA}." ;;
  esac
}

apply_instancia_domain_defaults() {
  case "$INSTANCIA" in
    dev)
      if [[ "$DOMAIN" == "totemdigital.app.br" ]]; then
        DOMAIN="dev.totemdigital.app.br"
      fi
      ;;
    teste)
      if [[ "$DOMAIN" == "totemdigital.app.br" ]]; then
        DOMAIN="test.totemdigital.app.br"
      fi
      ;;
  esac
}

show_menu() {
  title "TotemDigital Server — Instalador v${SCRIPT_VERSION}"
  echo "  Repositório: $ROOT"
  echo "  Instância: ${INSTANCIA}  ${C_DIM}(--instancia producao|dev|teste)${C_RESET}"
  echo
  echo "  Escolha o modo:"
  echo
  echo "  ${C_BOLD}1)${C_RESET} Instalação de ${C_BOLD}produção${C_RESET} (HTTPS 443)     ${C_DIM}recomendado — install novo${C_RESET}"
  echo "  ${C_BOLD}2)${C_RESET} ${C_BOLD}Actualizar${C_RESET} / reaplicar código          ${C_DIM}sem apagar a base de dados${C_RESET}"
  echo "  ${C_BOLD}3)${C_RESET} Só ${C_BOLD}reparar${C_RESET} (.env + Nginx HTTPS)       ${C_DIM}rápido${C_RESET}"
  echo "  ${C_BOLD}4)${C_RESET} ${C_BOLD}Docker${C_RESET}                                 ${C_DIM}motor --mode docker${C_RESET}"
  echo "  ${C_BOLD}5)${C_RESET} Reinstalação ${C_RED}LIMPA (wipe)${C_RESET}              ${C_DIM}APAGA a BD — confirmação dupla${C_RESET}"
  echo "  ${C_BOLD}0)${C_RESET} Sair"
  echo
}

menu_loop() {
  while true; do
    show_menu
    local choice
    read -r -p "Opção [1]: " choice || true
    choice="${choice:-1}"
    case "$choice" in
      1) MODO=producao; break ;;
      2) MODO=atualizar; break ;;
      3) MODO=reparar; break ;;
      4) MODO=docker; break ;;
      5) MODO=wipe; break ;;
      0|q|Q) echo "Sair."; exit 0 ;;
      *) warn "Opção inválida."; sleep 1 ;;
    esac
  done
}

usage() {
  cat <<EOF
Instala-TotemDigital-Server.sh v${SCRIPT_VERSION}

Instalador oficial TotemDigital (servidor). Menu em português.
Envolve install-smartsignage.sh sem o alterar.

Uso:
  bash scripts/Instala-TotemDigital-Server.sh
  bash scripts/Instala-TotemDigital-Server.sh --modo producao --sim
  bash scripts/Instala-TotemDigital-Server.sh --modo atualizar --dominio totemdigital.app.br
  bash scripts/Instala-TotemDigital-Server.sh --modo reparar
  bash scripts/Instala-TotemDigital-Server.sh --modo producao --instancia dev --sim
  bash scripts/Instala-TotemDigital-Server.sh --modo atualizar --instancia teste --git-pull
  bash scripts/Instala-TotemDigital-Server.sh --modo docker --sim
  bash scripts/Instala-TotemDigital-Server.sh --dry-run --modo producao --instancia dev

Opções:
  --modo <nome>     producao | atualizar | reparar | docker | wipe
  --instancia <id>  producao | dev | teste  (default: producao)
  --dominio <fqdn>  Domínio (default por instância)
  --email <addr>    E-mail LE / owner
  --owner-user <u>  Admin inicial
  --owner-name <t>  Nome da organização
  --com-mqtt        Instala/activa Mosquitto
  --com-players     Copia players cliente
  --com-seeds       Seeds demo
  --git-pull        No modo atualizar, faz git pull
  --sim | --yes     Não interactivo (defaults; wipe bloqueado)
  --dry-run         Mostra o plano / comando, não executa
  --ajuda | -h      Esta ajuda

Doc: docs/INSTALA-TOTEMDIGITAL-SERVER.md
     docs/MULTI-INSTANCIA-PROD-DEV-TESTE.md
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --modo|--mode)
        MODO="${2:-}"; shift 2
        case "$MODO" in
          producao|produção|production) MODO=producao ;;
          atualizar|update|upgrade) MODO=atualizar ;;
          reparar|repair|fix) MODO=reparar ;;
          docker) MODO=docker ;;
          wipe|limpo|fresh) MODO=wipe ;;
          *) err "Modo inválido: $MODO"; usage; exit 1 ;;
        esac
        ;;
      --dominio|--domain) DOMAIN="${2:-}"; shift 2 ;;
      --email) SSL_EMAIL="${2:-}"; shift 2 ;;
      --owner-user) OWNER_USER="${2:-}"; shift 2 ;;
      --owner-name) OWNER_NAME="${2:-}"; shift 2 ;;
      --com-mqtt|--with-mqtt) WITH_MQTT=true; shift ;;
      --com-players|--with-players) SKIP_PLAYERS=false; shift ;;
      --com-seeds|--with-seeds) NO_SEEDS=false; shift ;;
      --instancia|--instance)
        local _raw="${2:-}"
        INSTANCIA="$(tdi_normalize_instancia "$_raw")" || { err "Instância inválida: $_raw"; usage; exit 1; }
        INSTANCIA_SET=true
        shift 2
        ;;
      --git-pull) DO_GIT_PULL=true; shift ;;
      --sim|--yes|--non-interactive) NON_INTERACTIVE=true; shift ;;
      --dry-run) DRY_RUN=true; shift ;;
      --ajuda|-h|--help) usage; exit 0 ;;
      *) err "Opção desconhecida: $1"; usage; exit 1 ;;
    esac
  done
  [[ -n "$SSL_EMAIL" ]] || SSL_EMAIL="admin@${DOMAIN}"
  apply_instancia_domain_defaults
}

run_selected_mode() {
  case "$MODO" in
    producao)  modo_producao ;;
    atualizar) modo_atualizar ;;
    reparar)   modo_reparar ;;
    docker)    modo_docker ;;
    wipe)      modo_wipe ;;
    *) err "Modo não definido."; exit 1 ;;
  esac
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
  # Re-pass args after root re-exec
  local _args=("$@")
  ensure_not_root "${_args[@]}"
  parse_args "$@"
  cd "$ROOT"
  preflight

  if [[ -z "$MODO" ]]; then
    if [[ "$NON_INTERACTIVE" == "true" ]]; then
      MODO=producao
      log "Sem --modo e com --sim → modo producao."
    else
      menu_loop
    fi
  fi

  if [[ "$MODO" != "docker" ]]; then
    ask_instancia_interactive
  fi
  apply_instancia_domain_defaults
  tdi_load_profile "$INSTANCIA" 2>/dev/null || true

  title "Plano: modo=${MODO} · instância=${INSTANCIA} · domínio=${DOMAIN}"
  if tdi_is_non_prod; then
    echo "  Clone ............ ${TDI_CLONE_DIR:-?}"
    echo "  Deploy ........... ${TDI_OPT_ROOT:-?}"
    echo "  BD ............... ${TDI_DB_NAME:-?}"
    echo "  Backend .......... :${TDI_BACKEND_PORT:-?}"
    echo "  Painel HTTP ...... :${TDI_HTTP_PORT:-?}"
  fi
  echo "  E-mail ........... $SSL_EMAIL"
  echo "  Owner ............ $OWNER_USER ($OWNER_NAME)"
  echo "  MQTT ............. $([[ "$WITH_MQTT" == "true" ]] && echo sim || echo nao)"
  echo "  Players .......... $([[ "$SKIP_PLAYERS" == "true" ]] && echo nao || echo sim)"
  echo "  Seeds ............ $([[ "$NO_SEEDS" == "true" ]] && echo nao || echo sim)"
  echo "  Dry-run .......... $DRY_RUN"
  echo
  if [[ "$NON_INTERACTIVE" != "true" ]]; then
    pause_enter
  fi

  local rc=0
  run_selected_mode || rc=$?
  show_final_summary
  if [[ $rc -ne 0 ]]; then
    err "Terminou com código $rc. Veja o log acima."
  else
    ok "Instalador terminou com sucesso."
  fi
  exit "$rc"
}

main "$@"
