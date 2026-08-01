#!/bin/bash
# =============================================================================
# Aplica snippets de portal gerados pelo backend (portalHostService.syncPortalHosts)
# Uso: sudo bash scripts/sync-portal-hosts.sh [runtime_dir]
# Default runtime_dir: <repo>/runtime/portal-hosts  ou  $PORTAL_HOSTS_RUNTIME_DIR
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
err() { echo -e "${RED}[ERRO]${NC} $1"; }

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  err "Execute como root (sudo)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="${1:-${PORTAL_HOSTS_RUNTIME_DIR:-$REPO_ROOT/runtime/portal-hosts}}"

NGINX_SRC="$RUNTIME_DIR/totemdigital-portal-tenants.conf"
DNS_SRC="$RUNTIME_DIR/totemdigital-portal-tenants.dnsmasq"

NGINX_DST="${PORTAL_NGINX_SNIPPET:-/etc/nginx/snippets/totemdigital-portal-tenants.conf}"
DNS_DST="${PORTAL_DNSMASQ_CONF:-/etc/dnsmasq.d/totemdigital-portal-tenants.conf}"

if [[ ! -f "$NGINX_SRC" ]]; then
  err "Snippet Nginx não encontrado: $NGINX_SRC"
  err "Gere primeiro via API POST /api/installation/portal/sync"
  exit 1
fi

mkdir -p "$(dirname "$NGINX_DST")"
cp -f "$NGINX_SRC" "$NGINX_DST"
log "Nginx snippet → $NGINX_DST"

# Garantir include no conf da instância se existir marcador
INST_NGINX="${PORTAL_NGINX_SITE:-}"
if [[ -n "$INST_NGINX" && -f "$INST_NGINX" ]]; then
  if ! grep -q "totemdigital-portal-tenants.conf" "$INST_NGINX"; then
    warn "Adicione manualmente: include $NGINX_DST;  e use \$td_portal_sd_type / \$td_portal_tenant_slug nos proxy_set_header"
  fi
fi

if command -v nginx >/dev/null 2>&1; then
  nginx -t
  systemctl reload nginx || service nginx reload || true
  log "Nginx recarregado"
else
  warn "nginx não encontrado no PATH"
fi

if [[ -f "$DNS_SRC" ]]; then
  mkdir -p "$(dirname "$DNS_DST")"
  cp -f "$DNS_SRC" "$DNS_DST"
  log "dnsmasq → $DNS_DST"
  if systemctl is-active --quiet dnsmasq 2>/dev/null; then
    systemctl restart dnsmasq
    log "dnsmasq reiniciado"
  else
    warn "dnsmasq não está activo — conf copiada mas não aplicada"
  fi
fi

log "Sync de portal hosts concluído"
