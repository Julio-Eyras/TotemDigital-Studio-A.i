#!/usr/bin/env bash
# Diagnóstico e correções comuns para 502 no POST /api/media/upload (Ubuntu + nginx + systemd)
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[fix-upload]${NC} $*"; }
warn() { echo -e "${YELLOW}[fix-upload]${NC} $*"; }
err() { echo -e "${RED}[fix-upload]${NC} $*" >&2; }

INSTALL_DIR="${INSTALL_DIR:-$HOME/TotemDigital}"
BACKEND_DIR="${INSTALL_DIR}/backend"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/smart-signage}"
SERVICE="${SERVICE:-smart-signage}"
UPLOADS="${UPLOADS:-/opt/smart-signage/public/assets/uploads}"

log "=== Diagnóstico upload / backend ==="
log "INSTALL_DIR=$INSTALL_DIR"

echo "--- systemctl $SERVICE ---"
systemctl is-active "$SERVICE" 2>/dev/null || warn "Serviço $SERVICE inactivo"
systemctl status "$SERVICE" --no-pager -l 2>/dev/null | tail -15 || true

echo "--- git HEAD ---"
if [[ -d "$INSTALL_DIR/.git" ]]; then
  git -C "$INSTALL_DIR" log -1 --oneline 2>/dev/null || true
else
  warn "Repositório git não encontrado em $INSTALL_DIR"
fi

echo "--- API local ---"
curl -s -o /dev/null -w "127.0.0.1:3000/api/health => HTTP %{http_code}\n" --max-time 5 http://127.0.0.1:3000/api/health || err "Backend não responde em :3000"

echo "--- ffmpeg / uploads ---"
command -v ffmpeg >/dev/null && log "ffmpeg: $(ffmpeg -version 2>/dev/null | head -1)" || warn "ffmpeg NÃO instalado (sudo apt install -y ffmpeg)"
command -v ffprobe >/dev/null && log "ffprobe OK" || warn "ffprobe NÃO instalado"

if [[ -d "$UPLOADS" ]]; then
  if [[ -w "$UPLOADS" ]]; then
    log "Uploads gravável: $UPLOADS"
  else
    warn "Sem permissão de escrita em $UPLOADS"
  fi
else
  warn "Pasta uploads não existe: $UPLOADS"
fi

echo "--- nginx frontend (/) ---"
if [[ -f "$NGINX_SITE" ]]; then
  FRONT_ROOT=$(grep -E '^\s*root\s+' "$NGINX_SITE" | head -1 | awk '{print $2}' | tr -d ';' || true)
  if [[ -n "$FRONT_ROOT" ]]; then
    if [[ -f "$FRONT_ROOT/index.html" ]]; then
      log "Frontend index: $FRONT_ROOT/index.html"
    else
      warn "index.html ausente em $FRONT_ROOT (nginx devolve 500 no /)"
    fi
  fi
else
  warn "Config nginx não encontrada: $NGINX_SITE"
fi

echo "--- journalctl (últimos erros) ---"
journalctl -u "$SERVICE" -n 40 --no-pager 2>/dev/null | grep -iE 'error|fatal|ENOMEM|killed|upload|ffmpeg|multer' | tail -20 || true

log "=== Aplicar correções ==="

# Permissões uploads
if [[ -d "$(dirname "$UPLOADS")" ]]; then
  sudo mkdir -p "$UPLOADS"
  sudo chown -R "${SUDO_USER:-$(whoami)}:${SUDO_USER:-$(whoami)}" "$(dirname "$UPLOADS")" 2>/dev/null || \
    sudo chmod -R u+rwX "$UPLOADS" 2>/dev/null || true
fi

# Build + restart backend
if [[ -d "$BACKEND_DIR" ]]; then
  log "Compilando backend..."
  (cd "$BACKEND_DIR" && npm run build)
  sudo systemctl restart "$SERVICE"
  sleep 2
  curl -s -o /dev/null -w "Após restart: /api/health => HTTP %{http_code}\n" --max-time 5 http://127.0.0.1:3000/api/health || err "Backend ainda não responde"
else
  warn "Backend não encontrado em $BACKEND_DIR"
fi

# Patch nginx: timeouts + proxy_request_buffering para /api/
if [[ -f "$NGINX_SITE" ]] && ! grep -q 'proxy_request_buffering off' "$NGINX_SITE" 2>/dev/null; then
  warn "Considere adicionar em location ^~ /api/ do nginx:"
  echo "    proxy_request_buffering off;"
  echo "    proxy_read_timeout 600s;"
  echo "    proxy_send_timeout 600s;"
fi

log "Concluído. Teste upload no painel e, se falhar:"
log "  sudo journalctl -u $SERVICE -f"
log "  sudo tail -f /var/log/nginx/error.log"
