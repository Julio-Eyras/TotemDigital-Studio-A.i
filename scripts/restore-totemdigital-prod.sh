#!/usr/bin/env bash
# =============================================================================
# restore-totemdigital-prod.sh
# -----------------------------------------------------------------------------
# Restaura um backup criado por backup-totemdigital-prod.sh.
#
# Uso:
#   bash scripts/restore-totemdigital-prod.sh ~/backups/producao-20260806_175500
#   bash scripts/restore-totemdigital-prod.sh ~/backups/producao-... --with-env
#   bash scripts/restore-totemdigital-prod.sh ~/backups/dev-... --instancia dev
#
# ATENÇÃO: substitui BD e uploads da instância alvo.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BACKUP_DIR=""
INSTANCIA=""
WITH_ENV=false
WITH_LE=false
WITH_NGINX=false
NON_INTERACTIVE=false
DRY_RUN=false
KEEP_STOPPED=false

log()  { echo "[INFO] $*"; }
ok()   { echo "[OK] $*"; }
warn() { echo "[AVISO] $*" >&2; }
err()  { echo "[ERRO] $*" >&2; }

usage() {
  cat <<'EOF'
Restore integral TotemDigital (VPS nativo).

  bash scripts/restore-totemdigital-prod.sh <pasta-backup> [opções]

Opções:
  --instancia <id>   producao|dev|teste (default: lê MANIFEST.txt ou producao)
  --with-env         Restaura .env para clone/opt (cuidado com secrets/paths)
  --with-nginx       Copia site Nginx + recarrega nginx
  --with-le          Extrai letsencrypt.tar.gz para /etc (requer backup LE)
  --keep-stopped     Não reinicia o serviço no fim
  --sim / --yes      Confirma automaticamente (escreve RESTAURAR)
  --dry-run          Mostra o plano sem alterar
  --ajuda            Esta ajuda
EOF
}

resolve_profile() {
  case "$INSTANCIA" in
    producao|prod)
      INSTANCIA=producao
      LABEL="produção"
      OPT_ROOT="/opt/smart-signage"
      DB_NAME="smartsignage"
      SERVICE="smart-signage"
      NGINX_SITE="smart-signage"
      CLONE_DIR="${CLONE_DIR_OVERRIDE:-$HOME/TotemDigital-Studio}"
      ;;
    dev)
      LABEL="desenvolvimento"
      OPT_ROOT="/opt/totemdigital-dev"
      DB_NAME="smartsignage_dev"
      SERVICE="smart-signage-dev"
      NGINX_SITE="totemdigital-dev"
      CLONE_DIR="${CLONE_DIR_OVERRIDE:-$HOME/TotemDigital-Studio-multiagencia}"
      if [[ ! -d "$CLONE_DIR" && -d "$HOME/TotemDigital-Studio-dev" ]]; then
        CLONE_DIR="$HOME/TotemDigital-Studio-dev"
      fi
      ;;
    teste|test)
      INSTANCIA=teste
      LABEL="teste"
      OPT_ROOT="/opt/totemdigital-test"
      DB_NAME="smartsignage_test"
      SERVICE="smart-signage-test"
      NGINX_SITE="totemdigital-test"
      CLONE_DIR="${CLONE_DIR_OVERRIDE:-$HOME/TotemDigital-Studio-test}"
      ;;
    *)
      err "Instância inválida: $INSTANCIA"
      exit 1
      ;;
  esac
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --instancia|--instance) INSTANCIA="${2:-}"; shift 2 ;;
    --clone-dir) CLONE_DIR_OVERRIDE="${2:-}"; shift 2 ;;
    --with-env) WITH_ENV=true; shift ;;
    --with-nginx) WITH_NGINX=true; shift ;;
    --with-le) WITH_LE=true; shift ;;
    --keep-stopped) KEEP_STOPPED=true; shift ;;
    --sim|--yes|-y) NON_INTERACTIVE=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --ajuda|--help|-h) usage; exit 0 ;;
    -*)
      err "Opção desconhecida: $1"
      usage
      exit 1
      ;;
    *)
      if [[ -z "$BACKUP_DIR" ]]; then
        BACKUP_DIR="$1"
        shift
      else
        err "Argumento extra: $1"
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$BACKUP_DIR" ]]; then
  err "Indique a pasta do backup."
  usage
  exit 1
fi

BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"

if [[ -z "$INSTANCIA" && -f "${BACKUP_DIR}/MANIFEST.txt" ]]; then
  INSTANCIA="$(grep -E '^instancia=' "${BACKUP_DIR}/MANIFEST.txt" | head -1 | cut -d= -f2- || true)"
fi
INSTANCIA="${INSTANCIA:-producao}"
resolve_profile

DUMP_FC="${BACKUP_DIR}/${DB_NAME}.dump"
DUMP_SQL="${BACKUP_DIR}/${DB_NAME}.sql"
# fallback: qualquer .dump na pasta
if [[ ! -f "$DUMP_FC" ]]; then
  DUMP_FC="$(find "$BACKUP_DIR" -maxdepth 1 -name '*.dump' | head -1 || true)"
fi
if [[ ! -f "$DUMP_SQL" ]]; then
  DUMP_SQL="$(find "$BACKUP_DIR" -maxdepth 1 -name '*.sql' | head -1 || true)"
fi

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Restore TotemDigital — instância ${INSTANCIA} (${LABEL})"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Origem ........ ${BACKUP_DIR}"
echo "  Deploy ........ ${OPT_ROOT}"
echo "  BD ............ ${DB_NAME}"
echo "  Serviço ....... ${SERVICE}"
echo "  Restaurar .env . ${WITH_ENV}"
echo "  Restaurar nginx  ${WITH_NGINX}"
echo "  Restaurar LE ... ${WITH_LE}"
echo "  Dry-run ....... ${DRY_RUN}"
echo

if [[ ! -f "$DUMP_FC" && ! -f "$DUMP_SQL" ]]; then
  err "Não encontrei dump (.dump ou .sql) em ${BACKUP_DIR}"
  exit 1
fi

if [[ "$NON_INTERACTIVE" != "true" ]]; then
  echo "ATENÇÃO: isto SUBSTITUI a base '${DB_NAME}' e os uploads em ${OPT_ROOT}."
  read -r -p "Escreva exactamente RESTAURAR para continuar: " conf
  [[ "$conf" == "RESTAURAR" ]] || { warn "Cancelado."; exit 1; }
fi

if [[ "$DRY_RUN" == "true" ]]; then
  log "Dry-run: usaria dump=${DUMP_FC:-$DUMP_SQL}"
  [[ -f "${BACKUP_DIR}/uploads.tar.gz" ]] && log "Dry-run: restauraria uploads.tar.gz"
  [[ "$WITH_ENV" == "true" ]] && log "Dry-run: restauraria ficheiros .env"
  ok "Dry-run concluído (nada alterado)."
  exit 0
fi

log "A parar ${SERVICE}..."
sudo systemctl stop "$SERVICE" 2>/dev/null || true

# --- BD ---
log "A garantir base ${DB_NAME}..."
if ! sudo -u postgres psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb "$DB_NAME" || true
fi

if [[ -f "$DUMP_FC" ]]; then
  log "pg_restore a partir de $(basename "$DUMP_FC")..."
  TMP_DUMP="$(mktemp /tmp/td-restore-XXXXXX.dump)"
  cp -f "$DUMP_FC" "$TMP_DUMP"
  chmod 644 "$TMP_DUMP"
  # --clean: remove objectos existentes; --if-exists evita erros em schema novo
  sudo -u postgres pg_restore -d "$DB_NAME" --clean --if-exists --no-owner --no-acl "$TMP_DUMP" \
    || warn "pg_restore terminou com avisos (comum com extensões/owners) — verifique a BD"
  rm -f "$TMP_DUMP"
  ok "BD restaurada (custom dump)"
elif [[ -f "$DUMP_SQL" ]]; then
  log "psql a partir de $(basename "$DUMP_SQL")..."
  TMP_SQL="$(mktemp /tmp/td-restore-XXXXXX.sql)"
  cp -f "$DUMP_SQL" "$TMP_SQL"
  chmod 644 "$TMP_SQL"
  sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=0 -f "$TMP_SQL" \
    || warn "Restore SQL com avisos"
  rm -f "$TMP_SQL"
  ok "BD restaurada (SQL)"
fi

# --- Uploads ---
if [[ -f "${BACKUP_DIR}/uploads.tar.gz" ]]; then
  log "A restaurar uploads..."
  sudo mkdir -p "${OPT_ROOT}/public/assets"
  # backup actual dos uploads (rede de segurança)
  if [[ -d "${OPT_ROOT}/public/assets/uploads" ]]; then
    SAFE="${OPT_ROOT}/public/assets/uploads.pre-restore.$(date +%Y%m%d_%H%M%S)"
    sudo mv "${OPT_ROOT}/public/assets/uploads" "$SAFE" || true
    warn "Uploads anteriores movidos para: ${SAFE}"
  fi
  sudo tar -xzf "${BACKUP_DIR}/uploads.tar.gz" -C "${OPT_ROOT}/public/assets"
  # dono: utilizador do serviço se possível
  RUN_USER="$(ps -o user= -C node 2>/dev/null | head -1 | tr -d ' ' || true)"
  RUN_USER="${RUN_USER:-${SUDO_USER:-$USER}}"
  if id "$RUN_USER" >/dev/null 2>&1; then
    sudo chown -R "${RUN_USER}:${RUN_USER}" "${OPT_ROOT}/public/assets/uploads" 2>/dev/null || true
  fi
  ok "Uploads restaurados"
else
  warn "uploads.tar.gz em falta — mídias não restauradas"
fi

# --- .env ---
if [[ "$WITH_ENV" == "true" ]]; then
  log "A restaurar .env..."
  restore_env() {
    local src="$1" dest="$2"
    [[ -f "$src" ]] || return 0
    sudo mkdir -p "$(dirname "$dest")"
    if [[ -f "$dest" ]]; then
      sudo cp -a "$dest" "${dest}.bak.$(date +%Y%m%d_%H%M%S)"
    fi
    sudo cp -a "$src" "$dest"
    sudo chmod 600 "$dest" 2>/dev/null || true
    ok "Restaurado: ${dest}"
  }
  restore_env "${BACKUP_DIR}/clone.env" "${CLONE_DIR}/.env"
  restore_env "${BACKUP_DIR}/clone-backend.env" "${CLONE_DIR}/backend/.env"
  restore_env "${BACKUP_DIR}/opt.env" "${OPT_ROOT}/.env"
  restore_env "${BACKUP_DIR}/opt-backend.env" "${OPT_ROOT}/backend/.env"
fi

# --- Nginx ---
if [[ "$WITH_NGINX" == "true" ]]; then
  if [[ -f "${BACKUP_DIR}/${NGINX_SITE}" ]]; then
    log "A restaurar Nginx site ${NGINX_SITE}..."
    sudo cp -a "${BACKUP_DIR}/${NGINX_SITE}" "/etc/nginx/sites-available/${NGINX_SITE}"
    sudo ln -sfn "/etc/nginx/sites-available/${NGINX_SITE}" "/etc/nginx/sites-enabled/${NGINX_SITE}"
    sudo nginx -t && sudo systemctl reload nginx
    ok "Nginx restaurado"
  else
    warn "Ficheiro Nginx '${NGINX_SITE}' em falta no backup"
  fi
  if [[ -f "${BACKUP_DIR}/${SERVICE}.service" ]]; then
    sudo cp -a "${BACKUP_DIR}/${SERVICE}.service" "/etc/systemd/system/${SERVICE}.service"
    sudo systemctl daemon-reload
    ok "Unit systemd restaurada"
  fi
fi

# --- Let's Encrypt ---
if [[ "$WITH_LE" == "true" ]]; then
  if [[ -f "${BACKUP_DIR}/letsencrypt.tar.gz" ]]; then
    log "A restaurar Let's Encrypt..."
    sudo tar -xzf "${BACKUP_DIR}/letsencrypt.tar.gz" -C /etc
    ok "Let's Encrypt restaurado"
  else
    warn "letsencrypt.tar.gz em falta"
  fi
fi

if [[ "$KEEP_STOPPED" != "true" ]]; then
  log "A iniciar ${SERVICE}..."
  sudo systemctl start "$SERVICE" || warn "Falha ao iniciar ${SERVICE}"
  sleep 2
  if systemctl is-active --quiet "$SERVICE"; then
    ok "${SERVICE} activo"
  else
    warn "${SERVICE} não está active — journalctl -u ${SERVICE} -n 50"
  fi
else
  warn "Serviço mantido parado (--keep-stopped)"
fi

echo
ok "Restore concluído a partir de ${BACKUP_DIR}"
echo
