#!/bin/bash
#
# start-all.sh
# Levanta todos os serviços Smart Signage Pro (backend, frontend) e o proxy Nginx.
# Uso: bash scripts/start-all.sh
#
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
err() { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

log "🚀 Iniciando todos os serviços Smart Signage Pro..."

# 1) Docker Compose (se existir)
if command -v docker &> /dev/null && [ -f "docker-compose.yml" ]; then
  info "Iniciando serviços Docker Compose em background (docker compose up -d)..."
  docker compose up -d || docker-compose up -d || warn "Falha ao subir serviços via Docker Compose (continue tentando outras formas)"
fi

# 2) systemd units (preferencial)
if command -v systemctl &> /dev/null; then
  info "Tentando iniciar unidades systemd (smart-signage / smartsignage-backend / smartsignage-frontend)..."
  if [[ ! -f /etc/systemd/system/smart-signage.service ]]; then
    warn "smart-signage.service não encontrado. Criando..."
    "$SCRIPT_DIR/create-smart-signage-service.sh" "$PROJECT_ROOT" || true
    sudo systemctl daemon-reload 2>/dev/null || true
  fi
  if systemctl list-unit-files 2>/dev/null | grep -q -- "smart-signage.service" || [[ -f /etc/systemd/system/smart-signage.service ]]; then
    sudo systemctl start smart-signage.service 2>/dev/null || warn "Falha ao iniciar smart-signage.service"
    sleep 1
  else
    if systemctl list-unit-files | rg -q --fixed-strings "smartsignage-backend" >/dev/null 2>&1; then
      sudo systemctl start smartsignage-backend || warn "Falha ao iniciar smartsignage-backend"
    fi
    if systemctl list-unit-files | rg -q --fixed-strings "smartsignage-frontend" >/dev/null 2>&1; then
      sudo systemctl start smartsignage-frontend || warn "Falha ao iniciar smartsignage-frontend"
    fi
  fi
else
  warn "systemctl não disponível - pulando etapa de iniciar via systemd"
fi

# 3) Iniciar backend manualmente se não subiu por systemd / docker
if ! pgrep -f "node.*dist/index.js" &>/dev/null && [ -d "backend" ]; then
  info "Iniciando backend em background (nohup npm start)..."
  (cd backend && nohup npm start > ../logs/backend-$(date +%Y%m%d-%H%M%S).log 2>&1 &) || warn "Falha ao iniciar backend manualmente"
  sleep 1
fi

# 4) Iniciar frontend manualmente se não subiu por systemd / docker
if ! pgrep -f "nginx" &>/dev/null && [ -d "frontend/build" ]; then
  info "Frontend build detectado em frontend/build — Nginx deverá servir os assets. Se desejar iniciar dev server, execute 'cd frontend && npm start'."
fi

# 5) Nginx (proxy) - preferir systemctl, fallback para docker/nginx -s reload
if command -v systemctl &> /dev/null; then
  info "Iniciando/garantindo Nginx (systemctl)..."
  sudo systemctl start nginx 2>/dev/null || warn "Falha ao iniciar nginx via systemctl"
else
  # Tentar docker nginx container
  if command -v docker &> /dev/null && docker ps -a --filter "name=smartsignage-nginx" --format "{{.Names}}" | grep -q "smartsignage-nginx"; then
    info "Iniciando container smartsignage-nginx..."
    docker start smartsignage-nginx 2>/dev/null || warn "Falha ao iniciar container smartsignage-nginx"
  else
    warn "systemctl e container nginx não encontrados — não foi possível iniciar nginx automaticamente"
  fi
fi

# 6) Health checks simples
info "Aguardando health endpoints..."
sleep 2
if command -v curl &> /dev/null; then
  if curl -sS --fail http://localhost:3000/health >/dev/null 2>&1; then
    log "✅ Backend respondendo (http://localhost:3000/health)"
  else
    warn "⚠️ Backend não respondeu em http://localhost:3000/health — verifique logs"
  fi
  # Nginx check
  if curl -sS --fail http://localhost/ >/dev/null 2>&1; then
    log "✅ Nginx respondendo em http://localhost/"
  else
    warn "⚠️ Nginx não respondeu em http://localhost/ — verifique status"
  fi
fi

log "✅ Operação concluída. Verifique logs se necessário."

exit 0

