#!/usr/bin/env bash
# Instalação LIMPA de produção Direct Totem a partir da branch main.
# ATENÇÃO: --fresh pode remover a instalação e recriar a base de dados.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOMAIN="${SMARTSIGNAGE_PUBLIC_HOST:-totemdigital.app.br}"
OWNER_USER="${SYSTEM_OWNER_ADMIN_USERNAME:-ismael}"
OWNER_NAME="${SYSTEM_OWNER_NAME:-Totem Digital}"
OWNER_EMAIL="${SYSTEM_OWNER_EMAIL:-admin@totemdigital.app.br}"
STASH_CREATED=""

cd "$REPO_ROOT"

if [[ "${CONFIRM_FRESH_PRODUCTION:-}" != "YES" ]]; then
  echo "ATENÇÃO: esta operação executa uma instalação limpa de produção (--fresh)."
  echo "A instalação existente e a base de dados podem ser recriadas."
  read -r -p "Digite INSTALAR para continuar: " confirmation
  if [[ "$confirmation" != "INSTALAR" ]]; then
    echo "Instalação cancelada."
    exit 1
  fi
fi

# Preserva alterações e relatórios locais para que não bloqueiem a troca de branch.
if [[ -n "$(git status --porcelain)" ]]; then
  STASH_CREATED="backup instalacao main $(date +%Y%m%d-%H%M%S)"
  git stash push -u -m "$STASH_CREATED"
  echo "Alterações locais preservadas no stash: $STASH_CREATED"
fi

# FETCH_HEAD evita depender do refspec local do origin, que pode apontar apenas
# para uma branch histórica.
git fetch origin main
MAIN_COMMIT="$(git rev-parse FETCH_HEAD)"
if git show-ref --verify --quiet refs/heads/main; then
  git switch main
  git merge --ff-only "$MAIN_COMMIT"
else
  git switch -c main "$MAIN_COMMIT"
fi

echo "Branch: $(git branch --show-current)"
echo "Commit: $(git log -1 --oneline)"
echo "Frontend: $(node -p "require('./frontend/package.json').version")"
echo "Backend: $(node -p "require('./backend/package.json').version")"

export TDI_GIT_BRANCH=main
export TOTEMDIGITAL_INSTALL_PRESET=true
export INSTALL_TOTEMDIGITAL_COMPACT=true
export SYSTEM_OWNER_ADMIN_USERNAME="$OWNER_USER"
export SYSTEM_OWNER_NAME="$OWNER_NAME"
export SYSTEM_OWNER_EMAIL="$OWNER_EMAIL"

export SMARTSIGNAGE_SPLIT_SITE=true
export SMARTSIGNAGE_PUBLIC_HOST="$DOMAIN"
export SMARTSIGNAGE_DOMAIN_NAME="$DOMAIN"
export SMARTSIGNAGE_SSL_EMAIL="$OWNER_EMAIL"
export SMARTSIGNAGE_LETSENCRYPT=true
export SMARTSIGNAGE_CORPORATE_HTTP_PORT=80
export SMARTSIGNAGE_SYSTEM_HTTP_PORT=8080

bash "$REPO_ROOT/scripts/install-smartsignage.sh" \
  --fresh \
  --mode single-server-prod \
  --totemdigital-preset \
  --totemdigital-compact \
  --direct-totem \
  --split-corporate-system \
  --public-host "$DOMAIN" \
  --corporate-http-port 80 \
  --system-http-port 8080 \
  --mqtt-mode dev \
  --skip-players \
  --no-seeds \
  --skip-menu

echo "Instalação limpa concluída a partir da branch main."
if [[ -n "$STASH_CREATED" ]]; then
  echo "Backup local preservado. Consulte com: git stash list"
fi
