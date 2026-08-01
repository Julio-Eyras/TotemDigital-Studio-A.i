#!/bin/bash
# =============================================================================
# Emite certificado Let's Encrypt wildcard (DNS-01) para portais TotemDigital
# Uso:
#   sudo bash scripts/issue-portal-wildcard-cert.sh \
#     --base-domain totemdigital.app.br --email ops@example.com [--sim]
# Requer: certbot + certbot-dns-cloudflare (ou --manual)
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
err() { echo -e "${RED}[ERRO]${NC} $1"; }

SIM=0
BASE_DOMAIN=""
EMAIL="${LETSENCRYPT_EMAIL:-${PORTAL_SSL_EMAIL:-}}"
CERT_NAME=""
ZONE_ID="${PORTAL_CLOUDFLARE_ZONE_ID:-}"
CREDS_FILE="${PORTAL_CLOUDFLARE_CREDENTIALS:-/etc/letsencrypt/cloudflare.ini}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sim|--dry-run) SIM=1; shift ;;
    --base-domain) BASE_DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --cert-name) CERT_NAME="$2"; shift 2 ;;
    --zone-id) ZONE_ID="$2"; shift 2 ;;
    --creds) CREDS_FILE="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *) err "Arg desconhecido: $1"; exit 1 ;;
  esac
done

BASE_DOMAIN="$(echo "$BASE_DOMAIN" | tr '[:upper:]' '[:lower:]' | sed -E 's#^https?://##; s#/.*##')"
if [[ -z "$BASE_DOMAIN" ]]; then
  err "Indique --base-domain"
  exit 1
fi
if [[ -z "$EMAIL" ]]; then
  err "Indique --email ou LETSENCRYPT_EMAIL"
  exit 1
fi
if [[ -z "$CERT_NAME" ]]; then
  CERT_NAME="portal-wildcard-${BASE_DOMAIN//./-}"
fi

DOMAINS=(
  "*.publisher.${BASE_DOMAIN}"
  "*.subscriber.${BASE_DOMAIN}"
  "publisher.${BASE_DOMAIN}"
  "subscriber.${BASE_DOMAIN}"
  "${BASE_DOMAIN}"
)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SIM_DIR="${PORTAL_SSL_SIM_DIR:-$REPO_ROOT/runtime/portal-ssl-sim/$CERT_NAME}"

if [[ "$SIM" -eq 1 ]]; then
  mkdir -p "$SIM_DIR"
  {
    echo "SIMULAÇÃO DNS-01 — certbot NÃO executado"
    echo "cert_name=$CERT_NAME"
    echo "email=$EMAIL"
    echo "zone_id=${ZONE_ID:-n/a}"
    echo "creds=$CREDS_FILE"
    echo "domains:"
    printf '  - %s\n' "${DOMAINS[@]}"
  } > "$SIM_DIR/README.txt"
  printf '%s\n' "${DOMAINS[@]}" > "$SIM_DIR/domains.txt"
  # Artefactos falsos para testes de path Nginx
  mkdir -p "$SIM_DIR/live"
  echo "SIM-CERT" > "$SIM_DIR/live/fullchain.pem"
  echo "SIM-KEY" > "$SIM_DIR/live/privkey.pem"
  log "Simulação escrita em $SIM_DIR"
  exit 0
fi

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  err "Emissão real requer root (sudo)"
  exit 1
fi

if ! command -v certbot >/dev/null 2>&1; then
  err "certbot não encontrado"
  exit 1
fi

DOMAIN_ARGS=()
for d in "${DOMAINS[@]}"; do
  DOMAIN_ARGS+=(-d "$d")
done

if [[ -f "$CREDS_FILE" ]] || [[ -n "${CLOUDFLARE_API_TOKEN:-}${PORTAL_CLOUDFLARE_API_TOKEN:-}" ]]; then
  if [[ ! -f "$CREDS_FILE" ]]; then
    mkdir -p "$(dirname "$CREDS_FILE")"
    TOKEN="${PORTAL_CLOUDFLARE_API_TOKEN:-$CLOUDFLARE_API_TOKEN}"
    umask 077
    cat > "$CREDS_FILE" <<EOF
# Gerado por issue-portal-wildcard-cert.sh
dns_cloudflare_api_token = ${TOKEN}
EOF
    chmod 600 "$CREDS_FILE"
    log "Credentials Cloudflare escritas em $CREDS_FILE"
  fi
  if ! certbot plugins 2>/dev/null | grep -qi cloudflare; then
    warn "Plugin certbot-dns-cloudflare não detectado — tente: pip install certbot-dns-cloudflare"
  fi
  certbot certonly \
    --dns-cloudflare \
    --dns-cloudflare-credentials "$CREDS_FILE" \
    --dns-cloudflare-propagation-seconds "${PORTAL_CF_PROPAGATION_SECONDS:-30}" \
    --cert-name "$CERT_NAME" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    "${DOMAIN_ARGS[@]}"
else
  warn "Sem token/creds Cloudflare — modo manual DNS-01 (interativo)"
  certbot certonly \
    --manual \
    --preferred-challenges dns \
    --cert-name "$CERT_NAME" \
    --email "$EMAIL" \
    --agree-tos \
    "${DOMAIN_ARGS[@]}"
fi

log "Certificado em /etc/letsencrypt/live/${CERT_NAME}/"
log "Actualize ssl_certificate / ssl_certificate_key no Nginx e faça reload"
