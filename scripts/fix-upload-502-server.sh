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
UPLOADS="${UPLOADS:-/opt/smart-signage/public/assets/uploads}"
ASSETS="${ASSETS:-/opt/smart-signage/public/assets}"

log "=== Diagnóstico (TotemDigital / Smart Signage) ==="

echo "--- git ---"
if [[ -d "$INSTALL_DIR/.git" ]]; then
  git -C "$INSTALL_DIR" fetch origin 2>/dev/null || true
  git -C "$INSTALL_DIR" log -1 --oneline 2>/dev/null || true
else
  warn "Sem git em $INSTALL_DIR"
fi

echo "--- backend ---"
systemctl is-active "$SERVICE" 2>/dev/null || warn "$SERVICE inactivo"
curl -s -o /dev/null -w "127.0.0.1:3000/api/health => HTTP %{http_code}\n" --max-time 5 http://127.0.0.1:3000/api/health || warn "Backend não responde em :3000"

echo "--- frontend deploy ($DEPLOY_FRONTEND) ---"
if [[ -f "$DEPLOY_FRONTEND/index.html" ]]; then
  log "index.html OK ($(stat -c%s "$DEPLOY_FRONTEND/index.html" 2>/dev/null || stat -f%z "$DEPLOY_FRONTEND/index.html") bytes)"
else
  warn "FALTA $DEPLOY_FRONTEND/index.html → nginx ciclo 500 em / e /subscribers"
fi

echo "--- uploads ($UPLOADS) ---"
command -v ffmpeg >/dev/null && log "ffmpeg OK" || warn "Instale: sudo apt install -y ffmpeg"
[[ -d "$UPLOADS" ]] || warn "Pasta uploads não existe"
[[ -w "$UPLOADS" ]] 2>/dev/null && log "uploads gravável" || warn "uploads SEM escrita para $(whoami)"

echo "--- últimos erros backend ---"
journalctl -u "$SERVICE" -n 60 --no-pager 2>/dev/null | grep -iE 'error|fatal|killed|ENOMEM|heap|upload|ffmpeg|multer|uncaught' | tail -15 || true

log "=== Correções ==="

# 1) Código mais recente (upload sem ffmpeg síncrono)
if [[ -d "$INSTALL_DIR/.git" ]]; then
  log "git pull..."
  git -C "$INSTALL_DIR" pull --ff-only || warn "git pull falhou — corrija conflitos manualmente"
fi

# 2) Permissões assets/uploads (backend grava como smartchannel)
log "Permissões em $ASSETS..."
sudo mkdir -p "$UPLOADS"
sudo chown -R "$(whoami):$(whoami)" "$ASSETS" 2>/dev/null || sudo chmod -R u+rwX "$ASSETS"

# 3) Build backend
if [[ -d "$BACKEND_DIR" ]]; then
  log "npm run build (backend)..."
  (cd "$BACKEND_DIR" && npm run build)
  sudo systemctl restart "$SERVICE"
  sleep 3
  curl -s -o /dev/null -w "Após restart: health => HTTP %{http_code}\n" --max-time 8 http://127.0.0.1:3000/api/health || err "Backend ainda down — veja: sudo journalctl -u $SERVICE -n 80"
fi

# 4) Frontend: build local + deploy para /opt/smart-signage/frontend/build
BUILD_SRC="$FRONTEND_DIR/build"
if [[ ! -f "$BUILD_SRC/index.html" ]]; then
  log "Build do frontend em $FRONTEND_DIR..."
  if [[ -f "$FRONTEND_DIR/package.json" ]]; then
    (cd "$FRONTEND_DIR" && npm ci && GENERATE_SOURCEMAP=false npm run build)
  else
    err "Frontend não encontrado em $FRONTEND_DIR"
  fi
fi

if [[ -f "$BUILD_SRC/index.html" ]]; then
  log "Copiar frontend → $DEPLOY_FRONTEND"
  sudo mkdir -p "$DEPLOY_FRONTEND"
  sudo rsync -a --delete "$BUILD_SRC/" "$DEPLOY_FRONTEND/" 2>/dev/null || \
    sudo cp -a "$BUILD_SRC/." "$DEPLOY_FRONTEND/"
  sudo chown -R "$(whoami):$(whoami)" "$(dirname "$DEPLOY_FRONTEND")" 2>/dev/null || true
  sudo chmod -R a+rX "$DEPLOY_FRONTEND"
  log "index.html deploy: $(ls -la "$DEPLOY_FRONTEND/index.html")"
else
  warn "Sem build do frontend — painel continuará com erro 500"
fi

# 5) Nginx reload
if sudo nginx -t 2>/dev/null; then
  sudo systemctl reload nginx
  log "Nginx recarregado"
else
  warn "nginx -t falhou — corrija $NGINX_SITE"
  sudo nginx -t || true
fi

# 6) Teste rápido
HTTP_ROOT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:8080/" 2>/dev/null || echo "000")
HTTP_SUB=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:8080/subscribers" 2>/dev/null || echo "000")
log "Teste local: / => HTTP $HTTP_ROOT | /subscribers => HTTP $HTTP_SUB (esperado 200)"

log ""
log "Próximo passo: tente upload no painel."
log "Se 502 voltar, durante o upload execute noutro terminal:"
log "  sudo journalctl -u $SERVICE -f"
log "  sudo dmesg | tail -5   # ver se OOM Killer matou o node"
