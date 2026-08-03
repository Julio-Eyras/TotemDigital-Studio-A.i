#!/usr/bin/env bash
# Solicita parâmetros, exporta variáveis de ambiente e dispara Instala-TotemDigital-Server.sh
#
# Uso:
#   bash scripts/run-instala-totemdigital-prompt.sh
#   bash scripts/run-instala-totemdigital-prompt.sh --defaults-dev   # pré-preenche tipico VPS multi-agência
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALLER="$SCRIPT_DIR/Instala-TotemDigital-Server.sh"

if [[ ! -f "$INSTALLER" ]]; then
  echo "[ERRO] Instalador não encontrado: $INSTALLER" >&2
  exit 1
fi

PRESET_DEV=false
for a in "$@"; do
  case "$a" in
    --defaults-dev|-d) PRESET_DEV=true ;;
    --ajuda|-h|--help)
      cat <<EOF
run-instala-totemdigital-prompt.sh

Pergunta modo, instância, e-mail, owner e opções; exporta env e corre o instalador.

  bash scripts/run-instala-totemdigital-prompt.sh
  bash scripts/run-instala-totemdigital-prompt.sh --defaults-dev
EOF
      exit 0
      ;;
  esac
done

ask() {
  local prompt="$1"
  local default="${2:-}"
  local reply=""
  if [[ -n "$default" ]]; then
    read -r -p "${prompt} [${default}]: " reply || true
    echo "${reply:-$default}"
  else
    read -r -p "${prompt}: " reply || true
    echo "$reply"
  fi
}

ask_yn() {
  local prompt="$1"
  local default="${2:-n}"
  local reply=""
  local hint="s/N"
  [[ "$default" == "s" || "$default" == "y" ]] && hint="S/n"
  read -r -p "${prompt} [${hint}]: " reply || true
  reply="$(echo "${reply:-$default}" | tr '[:upper:]' '[:lower:]')"
  [[ "$reply" == "s" || "$reply" == "y" || "$reply" == "sim" || "$reply" == "yes" ]]
}

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " TotemDigital — assistente de instalação"
echo " Repo: $ROOT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Defaults
MODO_DEFAULT="atualizar"
INST_DEFAULT="dev"
EMAIL_DEFAULT="admin@totemdigital.app.br"
OWNER_USER_DEFAULT="ismael"
OWNER_NAME_DEFAULT="Totem Digital"
BRANCH_DEFAULT="${TDI_GIT_BRANCH:-TotemDigital-MultiAgencia}"
DOMAIN_DEFAULT=""
GIT_PULL_DEFAULT="s"
SIM_DEFAULT="s"
DRY_DEFAULT="n"

if [[ "$PRESET_DEV" == "true" ]]; then
  MODO_DEFAULT="atualizar"
  INST_DEFAULT="dev"
  DOMAIN_DEFAULT="dev.totemdigital.app.br"
  echo "(preset --defaults-dev activo)"
  echo
fi

echo "Modo: producao | atualizar | reparar | docker | wipe"
MODO="$(ask "Modo" "$MODO_DEFAULT")"
case "$MODO" in
  producao|produção|production) MODO=producao ;;
  atualizar|update|upgrade) MODO=atualizar ;;
  reparar|repair|fix) MODO=reparar ;;
  docker) MODO=docker ;;
  wipe|limpo|fresh) MODO=wipe ;;
  *)
    echo "[ERRO] Modo inválido: $MODO" >&2
    exit 1
    ;;
esac

echo "Instância: producao | dev | teste"
INSTANCIA="$(ask "Instância" "$INST_DEFAULT")"
case "$INSTANCIA" in
  producao|prod|produção|production) INSTANCIA=producao ;;
  dev|desenvolvimento|development) INSTANCIA=dev ;;
  teste|test|homolog) INSTANCIA=teste ;;
  *)
    echo "[ERRO] Instância inválida: $INSTANCIA" >&2
    exit 1
    ;;
esac

if [[ -z "$DOMAIN_DEFAULT" ]]; then
  case "$INSTANCIA" in
    dev) DOMAIN_DEFAULT="dev.totemdigital.app.br" ;;
    teste) DOMAIN_DEFAULT="teste.totemdigital.app.br" ;;
    *) DOMAIN_DEFAULT="totemdigital.app.br" ;;
  esac
fi

DOMAIN="$(ask "Domínio (vazio = default do instalador)" "$DOMAIN_DEFAULT")"
SSL_EMAIL="$(ask "E-mail (Let's Encrypt + owner)" "$EMAIL_DEFAULT")"
OWNER_USER="$(ask "Utilizador admin owner" "$OWNER_USER_DEFAULT")"
OWNER_NAME="$(ask "Nome da organização" "$OWNER_NAME_DEFAULT")"
TDI_GIT_BRANCH="$(ask "Branch Git (TDI_GIT_BRANCH)" "$BRANCH_DEFAULT")"

DO_GIT_PULL=false
NON_INTERACTIVE=false
DRY_RUN=false
WITH_MQTT=false
WITH_PLAYERS=false
WITH_SEEDS=false

if [[ "$MODO" == "atualizar" ]]; then
  ask_yn "Executar git pull no clone da instância?" "$GIT_PULL_DEFAULT" && DO_GIT_PULL=true
fi

ask_yn "Modo não interactivo (--sim)?" "$SIM_DEFAULT" && NON_INTERACTIVE=true
ask_yn "Dry-run (só plano, não executa)?" "$DRY_DEFAULT" && DRY_RUN=true
ask_yn "Instalar/activar Mosquitto (--com-mqtt)?" "n" && WITH_MQTT=true
ask_yn "Copiar players cliente (--com-players)?" "n" && WITH_PLAYERS=true
ask_yn "Carregar seeds demo (--com-seeds)?" "n" && WITH_SEEDS=true

# Ambiente
export TDI_GIT_BRANCH
export SSL_EMAIL
export SYSTEM_OWNER_ADMIN_USERNAME="$OWNER_USER"
export SYSTEM_OWNER_NAME="$OWNER_NAME"
export SYSTEM_OWNER_EMAIL="$SSL_EMAIL"
export SMARTSIGNAGE_SSL_EMAIL="$SSL_EMAIL"
[[ -n "$DOMAIN" ]] && export SMARTSIGNAGE_DOMAIN="$DOMAIN"

CMD=(bash "$INSTALLER" --modo "$MODO" --instancia "$INSTANCIA" --email "$SSL_EMAIL" --owner-user "$OWNER_USER" --owner-name "$OWNER_NAME")
[[ -n "$DOMAIN" ]] && CMD+=(--dominio "$DOMAIN")
[[ "$DO_GIT_PULL" == "true" ]] && CMD+=(--git-pull)
[[ "$NON_INTERACTIVE" == "true" ]] && CMD+=(--sim)
[[ "$DRY_RUN" == "true" ]] && CMD+=(--dry-run)
[[ "$WITH_MQTT" == "true" ]] && CMD+=(--com-mqtt)
[[ "$WITH_PLAYERS" == "true" ]] && CMD+=(--com-players)
[[ "$WITH_SEEDS" == "true" ]] && CMD+=(--com-seeds)

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Variáveis de ambiente"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  TDI_GIT_BRANCH=$TDI_GIT_BRANCH"
echo "  SSL_EMAIL=$SSL_EMAIL"
echo "  SYSTEM_OWNER_ADMIN_USERNAME=$OWNER_USER"
echo "  SYSTEM_OWNER_NAME=$OWNER_NAME"
echo "  SYSTEM_OWNER_EMAIL=$SSL_EMAIL"
[[ -n "$DOMAIN" ]] && echo "  SMARTSIGNAGE_DOMAIN=$DOMAIN"
echo
echo " Comando:"
printf '  '
printf '%q ' "${CMD[@]}"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

if ! ask_yn "Confirmar e disparar o instalador?" "s"; then
  echo "Cancelado."
  exit 0
fi

cd "$ROOT"
exec "${CMD[@]}"
