#!/usr/bin/env bash
# =============================================================================
# backup-totemdigital-prod.sh
# -----------------------------------------------------------------------------
# Backup integral da instância TotemDigital em VPS (systemd + PostgreSQL nativo).
# Inclui: BD, uploads, .env, Nginx, unit systemd e (opcional) Let's Encrypt.
#
# Uso:
#   bash scripts/backup-totemdigital-prod.sh
#   bash scripts/backup-totemdigital-prod.sh --instancia producao
#   bash scripts/backup-totemdigital-prod.sh --instancia dev --out ~/backups/dev-manual
#   bash scripts/backup-totemdigital-prod.sh --keep-running --sim
#
# Restore: scripts/restore-totemdigital-prod.sh <pasta-do-backup>
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

INSTANCIA="producao"
OUT_DIR=""
KEEP_RUNNING=false
NON_INTERACTIVE=false
INCLUDE_LE=true
INCLUDE_SQL_TEXT=true

log()  { echo "[INFO] $*"; }
ok()   { echo "[OK] $*"; }
warn() { echo "[AVISO] $*" >&2; }
err()  { echo "[ERRO] $*" >&2; }

usage() {
  cat <<'EOF'
Backup integral TotemDigital (VPS nativo).

  bash scripts/backup-totemdigital-prod.sh [opções]

Opções:
  --instancia <id>   producao (default) | dev | teste
  --out <dir>        Pasta de destino (default: ~/backups/<id>-YYYYMMDD_HHMMSS)
  --keep-running     Não para o serviço systemd durante o dump
  --sem-le           Não inclui /etc/letsencrypt
  --sem-sql          Só dump custom (-Fc); não gera .sql texto
  --sim / --yes      Sem prompts
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
      err "Instância inválida: $INSTANCIA (use producao|dev|teste)"
      exit 1
      ;;
  esac
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --instancia|--instance) INSTANCIA="${2:-}"; shift 2 ;;
    --out|--dest) OUT_DIR="${2:-}"; shift 2 ;;
    --clone-dir) CLONE_DIR_OVERRIDE="${2:-}"; shift 2 ;;
    --keep-running) KEEP_RUNNING=true; shift ;;
    --sem-le|--no-le) INCLUDE_LE=false; shift ;;
    --sem-sql|--no-sql) INCLUDE_SQL_TEXT=false; shift ;;
    --sim|--yes|-y) NON_INTERACTIVE=true; shift ;;
    --ajuda|--help|-h) usage; exit 0 ;;
    *) err "Opção desconhecida: $1"; usage; exit 1 ;;
  esac
done

resolve_profile

STAMP="$(date +%Y%m%d_%H%M%S)"
if [[ -z "$OUT_DIR" ]]; then
  OUT_DIR="${HOME}/backups/${INSTANCIA}-${STAMP}"
fi

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Backup TotemDigital — instância ${INSTANCIA} (${LABEL})"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploy ........ ${OPT_ROOT}"
echo "  BD ............ ${DB_NAME}"
echo "  Serviço ....... ${SERVICE}"
echo "  Clone ......... ${CLONE_DIR}"
echo "  Destino ....... ${OUT_DIR}"
echo "  Parar serviço . $([[ "$KEEP_RUNNING" == "true" ]] && echo NÃO || echo SIM)"
echo

if [[ "$NON_INTERACTIVE" != "true" ]]; then
  read -r -p "Continuar com o backup? [S/n] " ans
  ans="${ans:-S}"
  [[ "$ans" =~ ^[SsYy]$ ]] || { warn "Cancelado."; exit 1; }
fi

mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR" 2>/dev/null || true

SERVICE_WAS_ACTIVE=false
if systemctl is-active --quiet "$SERVICE" 2>/dev/null; then
  SERVICE_WAS_ACTIVE=true
fi

STOPPED_BY_US=false
if [[ "$KEEP_RUNNING" != "true" && "$SERVICE_WAS_ACTIVE" == "true" ]]; then
  log "A parar ${SERVICE} para snapshot coerente..."
  sudo systemctl stop "$SERVICE"
  STOPPED_BY_US=true
  sleep 1
fi

cleanup_restart() {
  if [[ "$STOPPED_BY_US" == "true" ]]; then
    log "A reiniciar ${SERVICE}..."
    sudo systemctl start "$SERVICE" || warn "Falha ao reiniciar ${SERVICE}"
  fi
}
trap cleanup_restart EXIT

# --- Base de dados ---
log "Dump PostgreSQL (${DB_NAME})..."
if ! sudo -u postgres psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  err "Base de dados '${DB_NAME}' não existe."
  exit 1
fi

# postgres pode não escrever em ~/backups — dump via stdout
sudo -u postgres pg_dump -Fc -d "$DB_NAME" > "${OUT_DIR}/${DB_NAME}.dump"
ok "Dump custom: ${OUT_DIR}/${DB_NAME}.dump"

if [[ "$INCLUDE_SQL_TEXT" == "true" ]]; then
  sudo -u postgres pg_dump -d "$DB_NAME" > "${OUT_DIR}/${DB_NAME}.sql"
  ok "Dump SQL: ${OUT_DIR}/${DB_NAME}.sql"
fi

# --- Uploads ---
UPLOADS_SRC="${OPT_ROOT}/public/assets/uploads"
if [[ -d "$UPLOADS_SRC" ]]; then
  log "A empacotar uploads (${UPLOADS_SRC})..."
  sudo tar -czf "${OUT_DIR}/uploads.tar.gz" -C "${OPT_ROOT}/public/assets" uploads
  sudo chown "$(id -u):$(id -g)" "${OUT_DIR}/uploads.tar.gz" 2>/dev/null || true
  ok "uploads.tar.gz"
else
  warn "Pasta de uploads em falta: ${UPLOADS_SRC}"
  : > "${OUT_DIR}/uploads.MISSING.txt"
fi

# --- .env ---
log "A copiar ficheiros .env..."
copy_env() {
  local src="$1" dest="$2"
  if [[ -f "$src" ]]; then
    if [[ -r "$src" ]]; then
      cp -a "$src" "$dest"
    else
      sudo cp -a "$src" "$dest"
      sudo chown "$(id -u):$(id -g)" "$dest"
    fi
    chmod 600 "$dest" 2>/dev/null || true
    ok "env: $(basename "$dest")"
  fi
}
copy_env "${CLONE_DIR}/.env" "${OUT_DIR}/clone.env"
copy_env "${CLONE_DIR}/backend/.env" "${OUT_DIR}/clone-backend.env"
copy_env "${OPT_ROOT}/.env" "${OUT_DIR}/opt.env"
copy_env "${OPT_ROOT}/backend/.env" "${OUT_DIR}/opt-backend.env"

# --- Nginx / systemd ---
log "A copiar Nginx e systemd..."
for f in \
  "/etc/nginx/sites-available/${NGINX_SITE}" \
  "/etc/nginx/sites-enabled/${NGINX_SITE}" \
  "/etc/systemd/system/${SERVICE}.service"
do
  if sudo test -e "$f" 2>/dev/null; then
    base="$(basename "$f")"
    sudo cp -a "$f" "${OUT_DIR}/${base}"
    sudo chown "$(id -u):$(id -g)" "${OUT_DIR}/${base}" 2>/dev/null || true
    ok "config: ${base}"
  fi
done

# --- Let's Encrypt ---
if [[ "$INCLUDE_LE" == "true" ]] && sudo test -d /etc/letsencrypt 2>/dev/null; then
  log "A empacotar Let's Encrypt (pode demorar)..."
  sudo tar -czf "${OUT_DIR}/letsencrypt.tar.gz" -C /etc letsencrypt
  sudo chown "$(id -u):$(id -g)" "${OUT_DIR}/letsencrypt.tar.gz" 2>/dev/null || true
  ok "letsencrypt.tar.gz"
fi

# --- Manifest ---
MANIFEST="${OUT_DIR}/MANIFEST.txt"
{
  echo "TotemDigital backup"
  echo "created_at=$(date -Iseconds)"
  echo "hostname=$(hostname -f 2>/dev/null || hostname)"
  echo "instancia=${INSTANCIA}"
  echo "label=${LABEL}"
  echo "opt_root=${OPT_ROOT}"
  echo "db_name=${DB_NAME}"
  echo "service=${SERVICE}"
  echo "nginx_site=${NGINX_SITE}"
  echo "clone_dir=${CLONE_DIR}"
  echo "script_root=${ROOT}"
  echo "keep_running=${KEEP_RUNNING}"
  echo "git_head=$(git -C "${CLONE_DIR}" rev-parse HEAD 2>/dev/null || echo n/a)"
  echo "git_branch=$(git -C "${CLONE_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo n/a)"
  echo "---"
  ls -lh "$OUT_DIR" | sed 's/^/  /'
} > "$MANIFEST"

# checksums
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$OUT_DIR" && sha256sum -- * 2>/dev/null | grep -v 'SHA256SUMS' > SHA256SUMS || true)
fi

ok "Manifest: ${MANIFEST}"
echo
echo "Backup concluído:"
echo "  ${OUT_DIR}"
echo
echo "Restore:"
echo "  bash ${SCRIPT_DIR}/restore-totemdigital-prod.sh \"${OUT_DIR}\""
echo
