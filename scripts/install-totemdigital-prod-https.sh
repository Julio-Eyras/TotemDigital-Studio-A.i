#!/usr/bin/env bash
# Install TotemDigital produção: compact + direct-totem + layout 80/8080 + Let's Encrypt (443).
#
# Uso (utilizador normal, NÃO root):
#   cd ~/TotemDigital-Studio
#   bash scripts/install-totemdigital-prod-https.sh
#   bash scripts/install-totemdigital-prod-https.sh --email admin@totemdigital.app.br
#   DOMAIN=outro.dominio.br bash scripts/install-totemdigital-prod-https.sh
#
# Opções:
#   --domain <fqdn>     Domínio LE / público (default: totemdigital.app.br)
#   --email <addr>      E-mail Let's Encrypt (default: admin@<domínio>)
#   --with-players      Copia todos os players (default: --skip-players)
#   --with-seeds        Carrega seeds demo (default: --no-seeds)
#   --fresh             Install completo do zero (--fresh no install)
#   --interactive       Abre o menu; ainda aplica compact/direct-totem/split/LE via env+flags
#   --dry-run           Só mostra o comando, não executa
#   -h | --help         Esta ajuda
#
# Doc: docs/INSTALL-PRODUCAO-COMPACT-DIRECT-TOTEM-HTTPS-443.md
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  if [[ -n "${SUDO_USER:-}" ]] && [[ "${SUDO_USER}" != "root" ]]; then
    echo "[INFO] A reexecutar como ${SUDO_USER} (o install nao corre como root)..."
    exec sudo -u "$SUDO_USER" -H bash "$0" "$@"
  fi
  echo "[ERRO] Nao execute com sudo/root. Use:"
  echo "  bash scripts/install-totemdigital-prod-https.sh"
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DOMAIN="${DOMAIN:-totemdigital.app.br}"
SSL_EMAIL="${SSL_EMAIL:-}"
SKIP_PLAYERS=true
NO_SEEDS=true
FRESH=false
INTERACTIVE=false
DRY_RUN=false

usage() {
  sed -n '2,22p' "$0" | sed 's/^# \?//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      [[ -n "${2:-}" ]] || { echo "[ERRO] Faltou valor para --domain"; exit 1; }
      DOMAIN="$2"
      shift 2
      ;;
    --email)
      [[ -n "${2:-}" ]] || { echo "[ERRO] Faltou valor para --email"; exit 1; }
      SSL_EMAIL="$2"
      shift 2
      ;;
    --with-players)
      SKIP_PLAYERS=false
      shift
      ;;
    --with-seeds)
      NO_SEEDS=false
      shift
      ;;
    --fresh)
      FRESH=true
      shift
      ;;
    --interactive)
      INTERACTIVE=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[ERRO] Opcao desconhecida: $1"
      usage
      exit 1
      ;;
  esac
done

[[ -n "$SSL_EMAIL" ]] || SSL_EMAIL="admin@${DOMAIN}"

# Layout dividido + Let's Encrypt (lidos com --skip-menu / apply_split_layout_from_environment)
export SMARTSIGNAGE_SPLIT_SITE=true
export SMARTSIGNAGE_CORPORATE_HTTP_PORT=80
export SMARTSIGNAGE_SYSTEM_HTTP_PORT=8080
export SMARTSIGNAGE_PUBLIC_HOST="$DOMAIN"
export SMARTSIGNAGE_LETSENCRYPT=true
export SMARTSIGNAGE_DOMAIN_NAME="$DOMAIN"
export SMARTSIGNAGE_SSL_EMAIL="$SSL_EMAIL"
export INSTALL_TOTEMDIGITAL_COMPACT=true

CMD=(
  bash "$ROOT/scripts/install-smartsignage.sh"
  --mode single-server-prod
  --totemdigital-compact
  --direct-totem
  --split-corporate-system
  --public-host "$DOMAIN"
  --corporate-http-port 80
  --system-http-port 8080
)

if [[ "$INTERACTIVE" != "true" ]]; then
  CMD+=(--skip-menu)
fi
if [[ "$SKIP_PLAYERS" == "true" ]]; then
  CMD+=(--skip-players)
fi
if [[ "$NO_SEEDS" == "true" ]]; then
  CMD+=(--no-seeds)
fi
if [[ "$FRESH" == "true" ]]; then
  CMD+=(--fresh)
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " TotemDigital PRODUÇÃO — compact + direct-totem + HTTPS 443"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Domínio ........ $DOMAIN"
echo "  E-mail LE ...... $SSL_EMAIL"
echo "  Portas HTTP .... site :80 | painel :8080 | HTTPS :443"
echo "  Perfil ......... TOTEMDIGITAL_COMPACT=true"
echo "  Direct-totem ... DIRECT_TOTEM_MODE=true"
echo "  Players ........ $([[ "$SKIP_PLAYERS" == "true" ]] && echo 'nao (skip)' || echo 'sim')"
echo "  Seeds .......... $([[ "$NO_SEEDS" == "true" ]] && echo 'nao' || echo 'sim')"
echo "  Fresh .......... $FRESH"
echo "  Menu ........... $([[ "$INTERACTIVE" == "true" ]] && echo 'sim' || echo 'nao (--skip-menu)')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "Comando:"
printf '  %q' "${CMD[@]}"
echo
echo
echo "URLs esperadas:"
echo "  https://${DOMAIN}/"
echo "  https://${DOMAIN}/login"
echo "  http://<IP>:8080/login"
echo "  Player-AD serverUrl = https://${DOMAIN}"
echo

if [[ "$DRY_RUN" == "true" ]]; then
  echo "[dry-run] Nao executado."
  exit 0
fi

exec "${CMD[@]}"
