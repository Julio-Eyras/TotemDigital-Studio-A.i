#!/usr/bin/env bash
# Repara 502 no upload + 500/ciclo nginx no frontend (Ubuntu, layout /opt/smart-signage)
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[fix-server]${NC} $*"; }
warn() { echo -e "${YELLOW}[fix-server]${NC} $*"; }
err() { echo -e "${RED}[fix-server]${NC} $*" >&2; }

INSTALL_DIR="${INSTALL_DIR:-$HOME/TotemDigital}"
BACKEND_DIR="${INSTALL_DIR}/backend"
FRONTEND_DIR="${INSTALL_DIR}/frontend"
DEPLOY_FRONTEND="${DEPLOY_FRONTEND:-/opt/smart-signage/frontend/build}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/smart-signage}"
SERVICE="${SERVICE:-smart-signage}"
RUN_USER="${RUN_USER:-$(whoami)}"
OPT_BASE="/opt/smart-signage"
UPLOADS="${UPLOADS:-$OPT_BASE/public/assets/uploads}"
ASSETS="${ASSETS:-$OPT_BASE/public/assets}"

wait_for_health() {
  local i code
  for i in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:3000/api/health 2>/dev/null || echo "000")
    if [[ "$code" == "200" ]]; then
      log "Backend OK (tentativa $i)"
      return 0
    fi
    sleep 1
  done
  return 1
}

bootstrap_opt_dirs() {
  log "Criando estrutura $OPT_BASE (uploads + frontend)..."
  sudo mkdir -p \
    "$UPLOADS" \
    "$ASSETS" \
    "$OPT_BASE/public" \
    "$DEPLOY_FRONTEND" \
    "$OPT_BASE/player-web" 2>/dev/null || true

  # Backend (smartchannel) grava uploads; nginx (www-data) lê assets
  sudo chown -R "$RUN_USER:$RUN_USER" "$OPT_BASE/public" "$OPT_BASE/frontend" 2>/dev/null || true
  sudo chmod -R u+rwX "$OPT_BASE/public" 2>/dev/null || true
  sudo chmod -R a+rX "$DEPLOY_FRONTEND" 2>/dev/null || true

  if [[ -w "$UPLOADS" ]]; then
    log "Uploads gravável: $UPLOADS"
  else
    err "Ainda sem escrita em $UPLOADS — execute: sudo chown -R $RUN_USER:$RUN_USER $OPT_BASE/public"
    return 1
  fi
}

log "=== TotemDigital — reparo upload 502 + frontend 500 ==="

# 0) Código mais recente
if [[ -d "$INSTALL_DIR/.git" ]]; then
  log "git pull..."
  git -C "$INSTALL_DIR" pull --ff-only || warn "git pull falhou"
  git -C "$INSTALL_DIR" log -1 --oneline 2>/dev/null || true
fi

if [[ -f "$INSTALL_DIR/scripts/apply-remote-command-types-compat.sh" ]]; then
  log "Compat chk_remote_command_type (tipos sync P1)..."
  INSTALL_DIR="$INSTALL_DIR" bash "$INSTALL_DIR/scripts/apply-remote-command-types-compat.sh" || warn "compat remote_commands falhou"
fi

if [[ -f "$INSTALL_DIR/scripts/apply-totem-playlist-deactivate-compat.sh" ]]; then
  log "Compat cascade_totem_deactivate (totem_playlists status)..."
  INSTALL_DIR="$INSTALL_DIR" bash "$INSTALL_DIR/scripts/apply-totem-playlist-deactivate-compat.sh" || warn "compat totem_playlist deactivate falhou"
fi

# 1) Diretórios ANTES de tudo (causa #1 do crash no upload)
bootstrap_opt_dirs || exit 1

log "=== Diagnóstico ==="
systemctl is-active "$SERVICE" 2>/dev/null || warn "$SERVICE inactivo"
command -v ffmpeg >/dev/null && log "ffmpeg OK" || warn "sudo apt install -y ffmpeg"

if [[ -f "$DEPLOY_FRONTEND/index.html" ]]; then
  log "Frontend deploy: $DEPLOY_FRONTEND/index.html OK"
else
  warn "Falta $DEPLOY_FRONTEND/index.html (nginx ciclo 500 em /subscribers)"
fi

journalctl -u "$SERVICE" -n 40 --no-pager 2>/dev/null | grep -iE 'error|fatal|killed|ENOMEM|upload|multer|uncaught|gravável|EACCES' | tail -12 || true

log "=== Build backend + restart ==="
if [[ -d "$BACKEND_DIR" ]]; then
  (cd "$BACKEND_DIR" && npm run build)
  sudo systemctl restart "$SERVICE"
  if ! wait_for_health; then
    err "Backend não subiu — veja: sudo journalctl -u $SERVICE -n 80 --no-pager"
    exit 1
  fi
fi

log "=== Build + deploy frontend ==="
BUILD_SRC="$FRONTEND_DIR/build"
if [[ -f "$FRONTEND_DIR/package.json" ]]; then
  log "npm run build (frontend)..."
  (cd "$FRONTEND_DIR" && {
    if [[ -f package-lock.json ]] && npm ci --no-audit --no-fund 2>/dev/null; then
      log "npm ci OK"
    else
      warn "npm ci falhou (lock dessincronizado) — usando npm install"
      npm install --no-audit --no-fund
    fi
    GENERATE_SOURCEMAP=false npm run build
  })
fi

if [[ -f "$BUILD_SRC/index.html" ]]; then
  sudo rsync -a --delete "$BUILD_SRC/" "$DEPLOY_FRONTEND/" 2>/dev/null || \
    sudo cp -a "$BUILD_SRC/." "$DEPLOY_FRONTEND/"
  sudo chmod -R a+rX "$DEPLOY_FRONTEND"
  log "Deploy OK: $(wc -c < "$DEPLOY_FRONTEND/index.html") bytes em index.html"
else
  warn "Sem build local — frontend continuará com erro 500"
fi

if sudo nginx -t 2>/dev/null; then
  sudo systemctl reload nginx
  log "Nginx recarregado"
fi

HTTP_ROOT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "http://127.0.0.1:8080/" 2>/dev/null || echo "000")
HTTP_SUB=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "http://127.0.0.1:8080/subscribers" 2>/dev/null || echo "000")
log "Teste: / => HTTP $HTTP_ROOT | /subscribers => HTTP $HTTP_SUB | /api/health => HTTP $(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:8080/api/health 2>/dev/null || echo 000)"

log ""
log "Pronto. Tente upload no painel."
log "Se falhar: sudo journalctl -u $SERVICE -f"
