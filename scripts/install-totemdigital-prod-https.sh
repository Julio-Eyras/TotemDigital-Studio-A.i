#!/usr/bin/env bash
# Install TotemDigital produção: compact + direct-totem + layout 80/8080 + Let's Encrypt (443).
#
# Por omissão abre o MENU com defaults pré-selecionados (Enter em cada passo).
# Mosquitto NÃO é instalado (só necessário para SmartDisplayFX).
#
# Uso (utilizador normal, NÃO root):
#   cd ~/TotemDigital-Studio
#   bash scripts/install-totemdigital-prod-https.sh
#   bash scripts/install-totemdigital-prod-https.sh --email admin@totemdigital.app.br
#   bash scripts/install-totemdigital-prod-https.sh --yes   # sem menu (totalmente automático)
#
# Opções:
#   --domain <fqdn>       Domínio LE / público (default: totemdigital.app.br)
#   --email <addr>        E-mail Let's Encrypt e owner (default: admin@<domínio>)
#   --owner-user <name>   Utilizador admin inicial (default: Owner)
#   --owner-name <text>   Nome da organização (default: Totem Digital)
#   --with-players        Copia todos os players (default: nenhum)
#   --with-seeds          Carrega seeds demo (default: não)
#   --with-mqtt           Instala Mosquitto (só SmartDisplayFX)
#   --fresh               Install completo do zero (--fresh no install)
#   --yes                 Sem menu (--skip-menu; totalmente automático)
#   --dry-run             Só mostra o comando, não executa
#   -h | --help           Esta ajuda
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
OWNER_USER="${OWNER_USER:-Owner}"
OWNER_NAME="${OWNER_NAME:-Totem Digital}"
SKIP_PLAYERS=true
NO_SEEDS=true
WITH_MQTT=false
FRESH=false
NON_INTERACTIVE=false
DRY_RUN=false

usage() {
  sed -n '2,28p' "$0" | sed 's/^# \?//'
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
    --owner-user)
      [[ -n "${2:-}" ]] || { echo "[ERRO] Faltou valor para --owner-user"; exit 1; }
      OWNER_USER="$2"
      shift 2
      ;;
    --owner-name)
      [[ -n "${2:-}" ]] || { echo "[ERRO] Faltou valor para --owner-name"; exit 1; }
      OWNER_NAME="$2"
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
    --with-mqtt)
      WITH_MQTT=true
      shift
      ;;
    --fresh)
      FRESH=true
      shift
      ;;
    --yes|--non-interactive)
      NON_INTERACTIVE=true
      shift
      ;;
    --interactive)
      NON_INTERACTIVE=false
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

export TOTEMDIGITAL_INSTALL_PRESET=true
export SMARTSIGNAGE_SPLIT_SITE=true
export SMARTSIGNAGE_CORPORATE_HTTP_PORT=80
export SMARTSIGNAGE_SYSTEM_HTTP_PORT=8080
export SMARTSIGNAGE_PUBLIC_HOST="$DOMAIN"
export SMARTSIGNAGE_LETSENCRYPT=true
export SMARTSIGNAGE_DOMAIN_NAME="$DOMAIN"
export SMARTSIGNAGE_SSL_EMAIL="$SSL_EMAIL"
export INSTALL_TOTEMDIGITAL_COMPACT=true
export SYSTEM_OWNER_ADMIN_USERNAME="$OWNER_USER"
export SYSTEM_OWNER_NAME="$OWNER_NAME"
export SYSTEM_OWNER_EMAIL="$SSL_EMAIL"
export TOTEMDIGITAL_WITH_MQTT="$([[ "$WITH_MQTT" == "true" ]] && echo true || echo false)"

CMD=(
  bash "$ROOT/scripts/install-smartsignage.sh"
  --totemdigital-preset
  --mode single-server-prod
  --totemdigital-compact
  --direct-totem
  --split-corporate-system
  --public-host "$DOMAIN"
  --corporate-http-port 80
  --system-http-port 8080
)

if [[ "$WITH_MQTT" == "true" ]]; then
  CMD+=(--mqtt-mode production)
else
  CMD+=(--mqtt-mode dev)
fi

if [[ "$NON_INTERACTIVE" == "true" ]]; then
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
echo "  Owner admin .... $OWNER_USER ($OWNER_NAME)"
echo "  Portas HTTP .... site :80 | painel :8080 | HTTPS :443"
echo "  Perfil ......... TOTEMDIGITAL_COMPACT=true"
echo "  Direct-totem ... DIRECT_TOTEM_MODE=true"
echo "  Mosquitto ...... $([[ "$WITH_MQTT" == "true" ]] && echo 'sim (--with-mqtt)' || echo 'nao (default)')"
echo "  Players ........ $([[ "$SKIP_PLAYERS" == "true" ]] && echo 'nao' || echo 'sim')"
echo "  Seeds .......... $([[ "$NO_SEEDS" == "true" ]] && echo 'nao' || echo 'sim')"
echo "  Fresh .......... $FRESH"
echo "  Menu ........... $([[ "$NON_INTERACTIVE" == "true" ]] && echo 'nao (--yes)' || echo 'sim (defaults pre-selecionados; Enter aceita)')"
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
echo "  Login inicial ...... ${OWNER_USER} / admin123"
echo

if [[ "$DRY_RUN" == "true" ]]; then
  echo "[dry-run] Nao executado."
  exit 0
fi

if systemctl is-failed --quiet mosquitto 2>/dev/null || \
   systemctl is-active --quiet mosquitto 2>/dev/null; then
  if [[ "$WITH_MQTT" != "true" ]]; then
    echo "[INFO] A desactivar mosquitto (nao necessario para este perfil TotemDigital)..."
    sudo systemctl stop mosquitto 2>/dev/null || true
    sudo systemctl disable mosquitto 2>/dev/null || true
    sudo systemctl reset-failed mosquitto 2>/dev/null || true
  fi
fi

"${CMD[@]}"
_install_rc=$?

if [[ $_install_rc -eq 0 ]]; then
  echo
  echo "[INFO] A garantir Nginx HTTPS unificado na 443 (site + /login + /api)..."
  bash "$ROOT/scripts/apply-https-unified-443.sh" || true
fi

exit $_install_rc
