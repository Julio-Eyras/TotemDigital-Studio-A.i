#!/bin/bash
#
# rebuild-and-restart-service.sh
# Para: parar serviço(s), compilar backend + frontend e voltar a subir o serviço
# Uso: execute na raiz do projeto: bash scripts/rebuild-and-restart-service.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
err() { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

#
# Opções:
#   --no-nginx    : não recarregar/restartar o nginx
#   --no-restart  : não subir/reiniciar serviços ao final (útil para somente compilar)
#
NO_NGINX=false
NO_RESTART=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-nginx)
      NO_NGINX=true
      shift
      ;;
    --no-restart)
      NO_RESTART=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--no-nginx] [--no-restart]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--no-nginx] [--no-restart]"
      exit 1
      ;;
  esac
done

cd "$PROJECT_ROOT"

log "Iniciando: parar serviços, rebuild e restart"
if [[ "$NO_NGINX" == "true" ]]; then
  warn "Opção --no-nginx ativada: o Nginx NÃO será recarregado ao final."
fi
if [[ "$NO_RESTART" == "true" ]]; then
  warn "Opção --no-restart ativada: os serviços NÃO serão iniciados ao final."
fi

# 1) Parar serviço principal se existir
if command -v systemctl >/dev/null 2>&1; then
  if systemctl list-unit-files | rg -q --fixed-strings "smart-signage.service" >/dev/null 2>&1; then
    info "Parando serviço systemd: smart-signage.service"
    sudo systemctl stop smart-signage.service || warn "Falha ao parar smart-signage.service (continuando)"
  else
    info "smart-signage.service não encontrado. Tentando parar serviços backend/frontend separados."
    sudo systemctl stop smart-signage-backend 2>/dev/null || true
    sudo systemctl stop smart-signage-frontend 2>/dev/null || true
  fi
else
  warn "systemctl não disponível, tentando script de parada local"
  bash "$SCRIPT_DIR/stop-all.sh" || warn "stop-all.sh falhou (continuando)"
fi

# 2) Rebuild backend
if [[ -f "$SCRIPT_DIR/rebuild-backend.sh" ]]; then
  info "Executando rebuild-backend.sh"
  bash "$SCRIPT_DIR/rebuild-backend.sh"
else
  warn "rebuild-backend.sh não encontrado. Tentando processo manual."
  (cd backend && npm install && npm run build) || err "Erro ao compilar backend"
fi

# 3) Rebuild frontend
if [[ -f "$SCRIPT_DIR/rebuild-frontend.sh" ]]; then
  info "Executando rebuild-frontend.sh"
  bash "$SCRIPT_DIR/rebuild-frontend.sh"
else
  warn "rebuild-frontend.sh não encontrado. Tentando processo manual."
  (cd frontend && npm install && npm run build) || err "Erro ao compilar frontend"
fi

# 4) Subir serviço (salvo se --no-restart)
if [[ "$NO_RESTART" != "true" ]]; then
  if command -v systemctl >/dev/null 2>&1; then
    if systemctl list-unit-files | rg -q --fixed-strings "smart-signage.service" >/dev/null 2>&1; then
      info "Iniciando serviço systemd: smart-signage.service"
      sudo systemctl start smart-signage.service || warn "Falha ao iniciar smart-signage.service"
    else
      info "Iniciando serviços backend/frontend separados (systemd units se existirem)"
      if systemctl list-unit-files | rg -q --fixed-strings "smart-signage-backend" >/dev/null 2>&1; then
        sudo systemctl start smart-signage-backend || warn "Falha ao iniciar smart-signage-backend"
      else
        info "Iniciando backend em background..."
        (cd backend && nohup npm start > ../logs/backend-$(date +%Y%m%d-%H%M%S).log 2>&1 &)
      fi
      if systemctl list-unit-files | rg -q --fixed-strings "smart-signage-frontend" >/dev/null 2>&1; then
        sudo systemctl start smart-signage-frontend || warn "Falha ao iniciar smart-signage-frontend"
      fi
    fi
  else
    warn "systemctl não disponível — pulando etapa de start (use --no-restart para comportamento explícito)"
  fi
else
  info "--no-restart fornecido: pulando etapa de iniciar/reiniciar serviços"
fi

# 5) Reiniciar nginx (opcional), salvo se --no-nginx
if [[ "$NO_NGINX" != "true" ]]; then
  if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx 2>/dev/null; then
    info "Recarregando Nginx"
    sudo systemctl reload nginx || sudo systemctl restart nginx || warn "Não foi possível reiniciar nginx"
  fi
else
  info "--no-nginx fornecido: pulando recarga/restart do Nginx"
fi

log "Operação concluída. Verifique logs se necessário."

exit 0

