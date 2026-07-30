#!/usr/bin/env bash
# =============================================================================
# totemdigital-instancia.sh
# Perfis e fluxos dev/test no mesmo VPS (sem alterar install-smartsignage.sh).
# Sourced por Instala-TotemDigital-Server.sh
# =============================================================================

[[ -n "${TDI_LIB_LOADED:-}" ]] && return 0
TDI_LIB_LOADED=1

readonly TDI_TEMPLATES_DIR="${TDI_TEMPLATES_DIR:-$SCRIPT_DIR/templates/instancia}"

# -----------------------------------------------------------------------------
# Perfil activo (preenchido por tdi_load_profile)
# -----------------------------------------------------------------------------
TDI_ID=""
TDI_LABEL=""
TDI_DOMAIN=""
TDI_CLONE_DIR=""
TDI_OPT_ROOT=""
TDI_DB_NAME=""
TDI_DB_USER=""
TDI_DB_PASSWORD=""
TDI_BACKEND_PORT=""
TDI_HTTP_PORT=""
TDI_SERVICE=""
TDI_NGINX_SITE=""
TDI_RUN_USER="${SUDO_USER:-$(whoami)}"

tdi_random_secret() {
  openssl rand -base64 48 2>/dev/null | tr -d '/+=' | head -c 48
}

tdi_normalize_instancia() {
  local raw="${1:-producao}"
  case "$raw" in
    producao|produção|production|prod) printf '%s' "producao" ;;
    dev|desenvolvimento|development)   printf '%s' "dev" ;;
    teste|test|testing|homolog)        printf '%s' "teste" ;;
    *) return 1 ;;
  esac
}

tdi_is_non_prod() {
  [[ "${INSTANCIA:-producao}" == "dev" || "${INSTANCIA:-producao}" == "teste" ]]
}

tdi_home_clone_base() {
  local home="${HOME:-/home/$TDI_RUN_USER}"
  case "$1" in
    dev)   printf '%s' "${home}/TotemDigital-Studio-dev" ;;
    teste) printf '%s' "${home}/TotemDigital-Studio-test" ;;
    *)     printf '%s' "${ROOT:-}" ;;
  esac
}

tdi_load_profile() {
  local id="${1:-producao}"
  TDI_ID="$id"
  TDI_RUN_USER="${SUDO_USER:-$(whoami)}"

  case "$id" in
    producao)
      TDI_LABEL="Produção"
      TDI_DOMAIN="${DOMAIN:-totemdigital.app.br}"
      TDI_CLONE_DIR="${ROOT}"
      TDI_OPT_ROOT="/opt/smart-signage"
      TDI_DB_NAME="smartsignage"
      TDI_DB_USER="smartsignage"
      TDI_DB_PASSWORD=""
      TDI_BACKEND_PORT="3000"
      TDI_HTTP_PORT="8080"
      TDI_SERVICE="smart-signage"
      TDI_NGINX_SITE="smart-signage"
      ;;
    dev)
      TDI_LABEL="Desenvolvimento"
      TDI_DOMAIN="${DOMAIN:-dev.totemdigital.app.br}"
      TDI_CLONE_DIR="$(tdi_home_clone_base dev)"
      TDI_OPT_ROOT="/opt/totemdigital-dev"
      TDI_DB_NAME="smartsignage_dev"
      TDI_DB_USER="smartsignage_dev"
      TDI_DB_PASSWORD=""
      TDI_BACKEND_PORT="3001"
      TDI_HTTP_PORT="8081"
      TDI_SERVICE="smart-signage-dev"
      TDI_NGINX_SITE="totemdigital-dev"
      ;;
    teste)
      TDI_LABEL="Testes / homologação"
      TDI_DOMAIN="${DOMAIN:-test.totemdigital.app.br}"
      TDI_CLONE_DIR="$(tdi_home_clone_base teste)"
      TDI_OPT_ROOT="/opt/totemdigital-test"
      TDI_DB_NAME="smartsignage_test"
      TDI_DB_USER="smartsignage_test"
      TDI_DB_PASSWORD=""
      TDI_BACKEND_PORT="3002"
      TDI_HTTP_PORT="8082"
      TDI_SERVICE="smart-signage-test"
      TDI_NGINX_SITE="totemdigital-test"
      ;;
    *)
      err "Instância desconhecida: $id (use producao|dev|teste)"
      return 1
      ;;
  esac
}

tdi_render_template() {
  local tpl="$1"
  local out="$2"
  [[ -f "$tpl" ]] || { err "Template em falta: $tpl"; return 1; }

  local content ssl_extra=""
  content="$(cat "$tpl")"

  if sudo test -f /etc/letsencrypt/options-ssl-nginx.conf 2>/dev/null; then
    ssl_extra="    include /etc/letsencrypt/options-ssl-nginx.conf;"
  fi
  if sudo test -f /etc/letsencrypt/ssl-dhparams.pem 2>/dev/null; then
    ssl_extra="${ssl_extra}
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;"
  fi

  local jwt="${TDI_JWT_SECRET:-$(tdi_random_secret)}"
  local tfa="${TDI_2FA_KEY:-$(tdi_random_secret)}"
  local totem="${TDI_TOTEM_SECRET:-$(tdi_random_secret)}"
  local dbpass="${TDI_DB_PASSWORD:-$(tdi_random_secret)}"
  TDI_JWT_SECRET="$jwt"
  TDI_2FA_KEY="$tfa"
  TDI_TOTEM_SECRET="$totem"
  TDI_DB_PASSWORD="$dbpass"

  local pairs=(
    "@@TDI_ID@@|$TDI_ID"
    "@@TDI_LABEL@@|$TDI_LABEL"
    "@@TDI_DOMAIN@@|$TDI_DOMAIN"
    "@@TDI_CLONE_DIR@@|$TDI_CLONE_DIR"
    "@@TDI_OPT_ROOT@@|$TDI_OPT_ROOT"
    "@@TDI_DB_NAME@@|$TDI_DB_NAME"
    "@@TDI_DB_USER@@|$TDI_DB_USER"
    "@@TDI_DB_PASSWORD@@|$dbpass"
    "@@TDI_BACKEND_PORT@@|$TDI_BACKEND_PORT"
    "@@TDI_HTTP_PORT@@|$TDI_HTTP_PORT"
    "@@TDI_SERVICE@@|$TDI_SERVICE"
    "@@TDI_NGINX_SITE@@|$TDI_NGINX_SITE"
    "@@TDI_RUN_USER@@|$TDI_RUN_USER"
    "@@TDI_JWT_SECRET@@|$jwt"
    "@@TDI_2FA_KEY@@|$tfa"
    "@@TDI_TOTEM_SECRET@@|$totem"
    "@@TDI_SSL_EXTRA@@|$ssl_extra"
    "@@OWNER_USER@@|${OWNER_USER:-Owner}"
    "@@OWNER_NAME@@|${OWNER_NAME:-Totem Digital}"
    "@@SSL_EMAIL@@|${SSL_EMAIL:-admin@${TDI_DOMAIN}}"
  )

  local pair key val
  for pair in "${pairs[@]}"; do
    key="${pair%%|*}"
    val="${pair#*|}"
    content="${content//${key}/${val}}"
  done

  if [[ "$DRY_RUN" == "true" ]]; then
    log "Dry-run: escreveria $out"
    return 0
  fi

  printf '%s\n' "$content" > "$out"
}

tdi_show_profile_plan() {
  title "Plano da instância: ${TDI_LABEL} (${TDI_ID})"
  echo "  Domínio ........... ${TDI_DOMAIN}"
  echo "  Clone ............. ${TDI_CLONE_DIR}"
  echo "  Deploy (/opt) ..... ${TDI_OPT_ROOT}"
  echo "  Base de dados ..... ${TDI_DB_NAME} (user ${TDI_DB_USER})"
  echo "  Backend ........... :${TDI_BACKEND_PORT}"
  echo "  Painel HTTP ....... :${TDI_HTTP_PORT}"
  echo "  systemd ........... ${TDI_SERVICE}.service"
  echo "  Nginx ............. /etc/nginx/sites-available/${TDI_NGINX_SITE}"
  echo
}

tdi_ensure_clone() {
  if [[ -d "$TDI_CLONE_DIR/.git" ]]; then
    ok "Clone existente: $TDI_CLONE_DIR"
    return 0
  fi

  local parent remote="${TDI_GIT_REMOTE:-}"
  parent="$(dirname "$TDI_CLONE_DIR")"
  [[ -d "$parent" ]] || mkdir -p "$parent"

  if [[ -z "$remote" ]] && [[ -d "${ROOT:-}/.git" ]]; then
    remote="$(git -C "${ROOT}" remote get-url origin 2>/dev/null || true)"
  fi
  remote="${remote:-https://github.com/Julio-Eyras/TotemDigital-Studio.git}"

  log "A clonar repositório para ${TDI_CLONE_DIR} ..."
  if [[ "$DRY_RUN" == "true" ]]; then
    warn "Dry-run: git clone não executado."
    return 0
  fi
  git clone --branch SmartSignage-direc-totem "$remote" "$TDI_CLONE_DIR"
  ok "Clone criado."
}

tdi_ensure_deploy_dirs() {
  local dirs=(
    "$TDI_OPT_ROOT/frontend/build"
    "$TDI_OPT_ROOT/public/assets/uploads"
    "$TDI_OPT_ROOT/logs"
    "$TDI_OPT_ROOT/player-web"
    "$TDI_OPT_ROOT/backups"
  )
  if [[ "$DRY_RUN" == "true" ]]; then
    log "Dry-run: criaria dirs em ${TDI_OPT_ROOT}"
    return 0
  fi
  for d in "${dirs[@]}"; do
    sudo mkdir -p "$d"
  done
  sudo chown -R "$TDI_RUN_USER:$TDI_RUN_USER" "$TDI_OPT_ROOT"
}

tdi_sync_player_web() {
  local src=""
  if [[ -d /opt/smart-signage/player-web ]]; then
    src="/opt/smart-signage/player-web"
  elif [[ -d "${ROOT}/player-web" ]]; then
    src="${ROOT}/player-web"
  elif [[ -d "$TDI_CLONE_DIR/player-web" ]]; then
    src="$TDI_CLONE_DIR/player-web"
  fi
  [[ -n "$src" ]] || { warn "player-web não encontrado — pasta vazia em ${TDI_OPT_ROOT}/player-web"; return 0; }
  if [[ "$DRY_RUN" == "true" ]]; then
    log "Dry-run: rsync player-web de $src"
    return 0
  fi
  sudo rsync -a "$src/" "$TDI_OPT_ROOT/player-web/"
  sudo chown -R "$TDI_RUN_USER:$TDI_RUN_USER" "$TDI_OPT_ROOT/player-web"
}

tdi_read_existing_db_password() {
  local envf="$TDI_CLONE_DIR/.env"
  [[ -f "$envf" ]] || return 1
  TDI_DB_PASSWORD="$(grep -E '^DB_PASSWORD=' "$envf" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
  [[ -n "$TDI_DB_PASSWORD" ]]
}

tdi_ensure_database() {
  local wipe="${1:-false}"
  tdi_read_existing_db_password || true

  if [[ "$DRY_RUN" == "true" ]]; then
    log "Dry-run: PostgreSQL user/db ${TDI_DB_USER}/${TDI_DB_NAME}"
    return 0
  fi

  local pass="${TDI_DB_PASSWORD:-}"
  if [[ -z "$pass" ]]; then
    pass="$(tdi_random_secret)"
    TDI_DB_PASSWORD="$pass"
  fi

  if [[ "$wipe" == "true" ]]; then
    log "A recriar base ${TDI_DB_NAME} (wipe)..."
    sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL || true
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TDI_DB_NAME}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${TDI_DB_NAME};
DROP ROLE IF EXISTS ${TDI_DB_USER};
SQL
    pass="$(tdi_random_secret)"
    TDI_DB_PASSWORD="$pass"
  elif tdi_read_existing_db_password; then
    pass="$TDI_DB_PASSWORD"
  else
    pass="$(tdi_random_secret)"
    TDI_DB_PASSWORD="$pass"
  fi

  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${TDI_DB_USER}') THEN
    CREATE ROLE ${TDI_DB_USER} LOGIN PASSWORD '${pass}';
  ELSIF '${wipe}' = 'true' THEN
    ALTER ROLE ${TDI_DB_USER} WITH PASSWORD '${pass}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${TDI_DB_NAME} OWNER ${TDI_DB_USER}'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${TDI_DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${TDI_DB_NAME} TO ${TDI_DB_USER};
SQL
  ok "PostgreSQL: ${TDI_DB_NAME}"
}

tdi_write_env() {
  local tpl="$TDI_TEMPLATES_DIR/env.instancia.example"
  local out="$TDI_CLONE_DIR/.env"
  if [[ -f "$out" ]]; then
    warn ".env já existe em $out — a preservar segredos (rebuild: modo atualizar)."
    tdi_read_existing_db_password || true
    if [[ -x "${FIX_ENV:-}" ]] || [[ -f "${FIX_ENV:-}" ]]; then
      bash "${FIX_ENV}" "$out" "$TDI_CLONE_DIR/backend/.env" 2>/dev/null || true
    fi
    return 0
  fi
  tdi_render_template "$tpl" "$out"
  if [[ "$DRY_RUN" != "true" ]]; then
    cp -f "$out" "$TDI_CLONE_DIR/backend/.env" 2>/dev/null || true
    if [[ -x "${FIX_ENV:-}" ]] || [[ -f "${FIX_ENV:-}" ]]; then
      bash "${FIX_ENV}" "$out" "$TDI_CLONE_DIR/backend/.env" 2>/dev/null || true
    fi
    ok ".env em $out"
  fi
}

tdi_apply_schema() {
  local schema_script="$TDI_CLONE_DIR/database/apply-schema-v2.sh"
  [[ -f "$schema_script" ]] || { err "apply-schema-v2.sh não encontrado em $TDI_CLONE_DIR"; return 1; }
  if [[ "$DRY_RUN" == "true" ]]; then
    log "Dry-run: aplicaria schema em ${TDI_DB_NAME}"
    return 0
  fi
  log "A aplicar schema v2 em ${TDI_DB_NAME} ..."
  (
    cd "$TDI_CLONE_DIR/database"
    export DB_NAME="$TDI_DB_NAME"
    export DB_USER="$TDI_DB_USER"
    export PGPASSWORD="$TDI_DB_PASSWORD"
    export SKIP_CONFIRM=true
    bash ./apply-schema-v2.sh
  )
  ok "Schema aplicado."
}

tdi_load_seeds() {
  [[ "${NO_SEEDS:-true}" == "false" ]] || return 0
  local loader="$TDI_CLONE_DIR/database/check-and-load-v6.js"
  [[ -f "$loader" ]] || { warn "check-and-load-v6.js ausente — seeds ignorados."; return 0; }
  if [[ "$DRY_RUN" == "true" ]]; then
    log "Dry-run: carregaria seeds v6"
    return 0
  fi
  log "A carregar seeds v6 ..."
  (
    cd "$TDI_CLONE_DIR/database"
    export DATABASE_URL="postgresql://${TDI_DB_USER}:${TDI_DB_PASSWORD}@localhost:5432/${TDI_DB_NAME}"
    node check-and-load-v6.js || warn "Seeds terminaram com aviso."
  )
}

tdi_npm_install_build() {
  local be="$TDI_CLONE_DIR/backend"
  local fe="$TDI_CLONE_DIR/frontend"
  local api="https://${TDI_DOMAIN}/api"

  if [[ "$DRY_RUN" == "true" ]]; then
    log "Dry-run: npm install + build em $TDI_CLONE_DIR"
    return 0
  fi

  log "npm install backend ..."
  (cd "$be" && npm ci 2>/dev/null || npm install)
  log "Compilar backend ..."
  (cd "$be" && npm run build 2>/dev/null || npx tsc -p tsconfig.json)

  log "npm install frontend ..."
  (cd "$fe" && npm ci 2>/dev/null || npm install)
  log "Build frontend (REACT_APP_API_URL=${api}) ..."
  (
    cd "$fe"
    export REACT_APP_API_URL="$api"
    export REACT_APP_TOTEMDIGITAL_COMPACT=true
    export REACT_APP_DIRECT_TOTEM_MODE=true
    export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
    npm run build
  )
  ok "Build concluído."
}

tdi_rsync_deploy() {
  if [[ "$DRY_RUN" == "true" ]]; then
    log "Dry-run: rsync para ${TDI_OPT_ROOT}"
    return 0
  fi
  sudo rsync -a --delete "$TDI_CLONE_DIR/frontend/build/" "$TDI_OPT_ROOT/frontend/build/"
  sudo rsync -a "$TDI_CLONE_DIR/backend/dist/" "$TDI_OPT_ROOT/backend/dist/" 2>/dev/null || sudo mkdir -p "$TDI_OPT_ROOT/backend/dist" && sudo rsync -a "$TDI_CLONE_DIR/backend/dist/" "$TDI_OPT_ROOT/backend/dist/"
  sudo rsync -a "$TDI_CLONE_DIR/backend/package.json" "$TDI_OPT_ROOT/backend/" 2>/dev/null || true
  sudo chown -R "$TDI_RUN_USER:$TDI_RUN_USER" "$TDI_OPT_ROOT"
  ok "Deploy em ${TDI_OPT_ROOT}"
}

tdi_install_systemd() {
  local tpl="$TDI_TEMPLATES_DIR/systemd.service.tpl"
  local unit="/etc/systemd/system/${TDI_SERVICE}.service"
  local tmp
  tmp="$(mktemp)"
  tdi_render_template "$tpl" "$tmp"
  if [[ "$DRY_RUN" == "true" ]]; then
    rm -f "$tmp"
    return 0
  fi
  sudo cp -f "$tmp" "$unit"
  rm -f "$tmp"
  sudo systemctl daemon-reload
  sudo systemctl enable "${TDI_SERVICE}.service"
  ok "systemd: ${TDI_SERVICE}.service"
}

tdi_ensure_le_cert() {
  if sudo test -f "/etc/letsencrypt/live/${TDI_DOMAIN}/fullchain.pem" 2>/dev/null; then
    ok "Certificado LE já existe para ${TDI_DOMAIN}"
    return 0
  fi
  if [[ "$DRY_RUN" == "true" ]]; then
    warn "Dry-run: certbot para ${TDI_DOMAIN} não executado."
    return 0
  fi
  sudo mkdir -p /var/www/certbot
  log "A pedir certificado Let's Encrypt para ${TDI_DOMAIN} ..."
  sudo certbot certonly --webroot -w /var/www/certbot \
    -d "$TDI_DOMAIN" \
    --email "${SSL_EMAIL:-admin@${TDI_DOMAIN}}" \
    --agree-tos --non-interactive --keep-until-expiring || {
      err "certbot falhou — confirme DNS A de ${TDI_DOMAIN} para este VPS."
      return 1
    }
  ok "Certificado obtido."
}

tdi_install_nginx() {
  local tpl="$TDI_TEMPLATES_DIR/nginx.instancia.conf.tpl"
  local avail="/etc/nginx/sites-available/${TDI_NGINX_SITE}"
  local enabled="/etc/nginx/sites-enabled/${TDI_NGINX_SITE}"
  local tmp
  tmp="$(mktemp)"
  tdi_render_template "$tpl" "$tmp"
  if [[ "$DRY_RUN" == "true" ]]; then
    rm -f "$tmp"
    return 0
  fi
  sudo cp -f "$tmp" "$avail"
  rm -f "$tmp"
  sudo ln -sf "$avail" "$enabled"
  sudo ufw allow 443/tcp 2>/dev/null || true
  sudo ufw allow "${TDI_HTTP_PORT}/tcp" 2>/dev/null || true
  sudo nginx -t
  sudo systemctl reload nginx
  ok "Nginx: ${TDI_NGINX_SITE}"
}

tdi_restart_service() {
  if [[ "$DRY_RUN" == "true" ]]; then
    return 0
  fi
  sudo systemctl restart "${TDI_SERVICE}.service" || sudo systemctl start "${TDI_SERVICE}.service"
  sleep 2
  if systemctl is-active --quiet "${TDI_SERVICE}.service"; then
    ok "${TDI_SERVICE} activo"
  else
    warn "${TDI_SERVICE} não está active — journalctl -u ${TDI_SERVICE} -n 40"
    return 1
  fi
}

tdi_instancia_install() {
  tdi_load_profile "$INSTANCIA" || return 1
  tdi_show_profile_plan
  pause_enter

  tdi_ensure_clone || return 1
  tdi_ensure_deploy_dirs
  tdi_sync_player_web
  tdi_ensure_database false
  tdi_write_env
  tdi_apply_schema || return 1
  tdi_load_seeds
  tdi_npm_install_build || return 1
  tdi_rsync_deploy
  tdi_install_systemd
  tdi_ensure_le_cert || return 1
  tdi_install_nginx || return 1
  tdi_restart_service || return 1
  return 0
}

tdi_instancia_update() {
  tdi_load_profile "$INSTANCIA" || return 1
  tdi_show_profile_plan

  [[ -d "$TDI_CLONE_DIR" ]] || { err "Clone em falta: $TDI_CLONE_DIR — corra modo producao com --instancia ${INSTANCIA}"; return 1; }

  if [[ "$DO_GIT_PULL" == "true" ]] || ask_yn "Executar git pull no clone ${INSTANCIA}?" "n"; then
    if [[ "$DRY_RUN" != "true" ]]; then
      git -C "$TDI_CLONE_DIR" pull --ff-only || warn "git pull falhou."
    fi
  fi

  if [[ -f "$TDI_CLONE_DIR/.env" ]]; then
    tdi_read_existing_db_password || true
    if [[ -x "${FIX_ENV:-}" ]] || [[ -f "${FIX_ENV:-}" ]]; then
      bash "${FIX_ENV}" "$TDI_CLONE_DIR/.env" "$TDI_CLONE_DIR/backend/.env" 2>/dev/null || true
    fi
  else
    tdi_ensure_database false
    tdi_write_env
  fi

  tdi_npm_install_build || return 1
  tdi_rsync_deploy
  tdi_install_systemd
  tdi_ensure_le_cert || true
  tdi_install_nginx || true
  tdi_restart_service || return 1
  ok "Actualização da instância ${INSTANCIA} concluída (BD preservada)."
  return 0
}

tdi_instancia_repair() {
  tdi_load_profile "$INSTANCIA" || return 1
  tdi_show_profile_plan
  [[ -d "$TDI_CLONE_DIR" ]] || { err "Clone em falta: $TDI_CLONE_DIR"; return 1; }

  if [[ -x "${FIX_ENV:-}" ]] || [[ -f "${FIX_ENV:-}" ]]; then
    bash "${FIX_ENV}" "$TDI_CLONE_DIR/.env" "$TDI_CLONE_DIR/backend/.env" 2>/dev/null || bash "${FIX_ENV}" || true
  fi
  tdi_install_systemd
  tdi_ensure_le_cert || true
  tdi_install_nginx || true
  tdi_restart_service || true
  ok "Reparos da instância ${INSTANCIA} concluídos."
  return 0
}

tdi_instancia_wipe() {
  tdi_load_profile "$INSTANCIA" || return 1
  tdi_show_profile_plan

  if [[ "$NON_INTERACTIVE" == "true" ]]; then
    err "Wipe da instância ${INSTANCIA} recusado em --sim/--yes."
    return 1
  fi
  local conf1 conf2
  read -r -p "Escreva exactamente APAGAR para continuar: " conf1
  [[ "$conf1" == "APAGAR" ]] || { err "Cancelado."; return 1; }
  read -r -p "Confirme o domínio desta instância [$TDI_DOMAIN]: " conf2
  conf2="${conf2:-$TDI_DOMAIN}"
  [[ "$conf2" == "$TDI_DOMAIN" ]] || { err "Domínio não confere. Cancelado."; return 1; }

  tdi_ensure_clone || return 1
  tdi_ensure_deploy_dirs
  tdi_sync_player_web
  tdi_ensure_database true
  tdi_write_env
  tdi_apply_schema || return 1
  tdi_load_seeds
  tdi_npm_install_build || return 1
  tdi_rsync_deploy
  tdi_install_systemd
  tdi_ensure_le_cert || true
  tdi_install_nginx || true
  tdi_restart_service || return 1
  warn "Wipe concluído só em ${TDI_DB_NAME} — produção intacta."
  return 0
}

tdi_show_final_summary() {
  local ipv4
  ipv4="$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -Eo '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1 || echo '<IP>')"
  title "Concluído — instância ${TDI_LABEL} (${TDI_ID})"
  echo "  Site ............. https://${TDI_DOMAIN}/"
  echo "  Login painel ..... https://${TDI_DOMAIN}/login"
  echo "  API .............. https://${TDI_DOMAIN}/api"
  echo "  Painel HTTP ...... http://${ipv4}:${TDI_HTTP_PORT}/login"
  echo "  Player-AD ........ serverUrl=https://${TDI_DOMAIN}  ${C_DIM}(só laboratório)${C_RESET}"
  echo "  systemd .......... ${TDI_SERVICE}.service"
  echo "  BD ............... ${TDI_DB_NAME}"
  echo "  Clone ............ ${TDI_CLONE_DIR}"
  echo "  Deploy ........... ${TDI_OPT_ROOT}"
  echo
}
