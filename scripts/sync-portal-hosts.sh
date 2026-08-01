#!/bin/bash
# =============================================================================
# Aplica snippets de portal gerados pelo backend (portalHostService.syncPortalHosts)
# Uso:
#   sudo bash scripts/sync-portal-hosts.sh [runtime_dir]
#   bash scripts/sync-portal-hosts.sh --sim [runtime_dir]   # sem root / sem nginx
# Default runtime_dir: <repo>/runtime/portal-hosts  ou  $PORTAL_HOSTS_RUNTIME_DIR
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
err() { echo -e "${RED}[ERRO]${NC} $1"; }

SIM=0
ARGS=()
for a in "$@"; do
  case "$a" in
    --sim|--dry-run) SIM=1 ;;
    *) ARGS+=("$a") ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="${ARGS[0]:-${PORTAL_HOSTS_RUNTIME_DIR:-$REPO_ROOT/runtime/portal-hosts}}"

NGINX_SRC="$RUNTIME_DIR/totemdigital-portal-tenants.conf"
DNS_SRC="$RUNTIME_DIR/totemdigital-portal-tenants.dnsmasq"

if [[ "$SIM" -eq 1 ]]; then
  SIM_OUT="${PORTAL_SYNC_SIM_DIR:-$REPO_ROOT/runtime/portal-hosts-sim}"
  mkdir -p "$SIM_OUT"
  if [[ ! -f "$NGINX_SRC" ]]; then
    err "Snippet Nginx não encontrado: $NGINX_SRC"
    err "Gere primeiro via API POST /api/installation/portal/sync (ou o sim-portal-pipeline)"
    exit 1
  fi
  cp -f "$NGINX_SRC" "$SIM_OUT/totemdigital-portal-tenants.conf"
  [[ -f "$DNS_SRC" ]] && cp -f "$DNS_SRC" "$SIM_OUT/totemdigital-portal-tenants.dnsmasq" || true
  [[ -f "$RUNTIME_DIR/manifest.json" ]] && cp -f "$RUNTIME_DIR/manifest.json" "$SIM_OUT/manifest.json" || true
  {
    echo "SIMULAÇÃO sync-portal-hosts — nginx/dnsmasq NÃO recarregados"
    echo "source=$RUNTIME_DIR"
    echo "dest=$SIM_OUT"
    date -Iseconds 2>/dev/null || date
  } > "$SIM_OUT/SIM.txt"
  log "Simulação: ficheiros copiados para $SIM_OUT (sem root)"
  exit 0
fi

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  err "Execute como root (sudo) ou use --sim"
  exit 1
fi

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

INST_NGINX="${PORTAL_NGINX_SITE:-}"
if [[ -n "$INST_NGINX" && -f "$INST_NGINX" ]]; then
  if ! grep -q "totemdigital-portal-tenants.conf" "$INST_NGINX"; then
    # Auto-wire: descomentar/inserir include após o cabeçalho se houver marcador
    if grep -q "TDI_PORTAL_SNIPPET_INCLUDE\|# include /etc/nginx/snippets/totemdigital-portal-tenants.conf" "$INST_NGINX"; then
      sed -i.bak \
        -e 's|# include /etc/nginx/snippets/totemdigital-portal-tenants.conf;.*|include /etc/nginx/snippets/totemdigital-portal-tenants.conf;|' \
        -e 's|# @@TDI_PORTAL_SNIPPET_INCLUDE@@|include /etc/nginx/snippets/totemdigital-portal-tenants.conf;|' \
        "$INST_NGINX" || true
      if grep -q "totemdigital-portal-tenants.conf" "$INST_NGINX"; then
        log "Include do snippet activado em $INST_NGINX"
      else
        warn "Não foi possível auto-activar include em $INST_NGINX — adicione manualmente: include $NGINX_DST;"
      fi
    else
      # Inserir após a primeira linha de comentário do ficheiro
      tmp="$(mktemp)"
      {
        head -n 3 "$INST_NGINX"
        echo "include $NGINX_DST;"
        tail -n +4 "$INST_NGINX"
      } > "$tmp"
      cp -f "$tmp" "$INST_NGINX"
      rm -f "$tmp"
      log "Include inserido em $INST_NGINX"
    fi
  else
    log "Include do portal já presente em $INST_NGINX"
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
