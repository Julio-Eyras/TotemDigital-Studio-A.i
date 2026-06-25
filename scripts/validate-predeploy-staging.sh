#!/usr/bin/env bash
# Verificação pré-deploy staging — TOTEM_SECRET_KEY, NODE_ENV e dependências mínimas.
#
# Uso (no servidor Linux, antes de deploy-staging-vx5.sh):
#   bash scripts/validate-predeploy-staging.sh
#   INSTALL_DIR=/opt/smart-signage bash scripts/validate-predeploy-staging.sh --strict
#   bash scripts/validate-predeploy-staging.sh --generate-key
#
# Exit codes:
#   0 = OK (pode fazer deploy)
#   1 = bloqueado (corrigir .env)
#   2 = avisos apenas (--warn-only)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${INSTALL_DIR:-}"
STRICT=false
WARN_ONLY=false
GENERATE_KEY=false
SKIP_NODE=false

usage() {
  cat <<'EOF'
Uso: validate-predeploy-staging.sh [opções]

Opções:
  --dir PATH        Diretório da instalação (default: auto)
  --strict          Exige TOTEM_SECRET_KEY válida (como produção/staging)
  --warn-only       Nunca bloqueia por avisos (exit 2 se só avisos)
  --generate-key    Mostra comando para gerar chave e sai
  --skip-node       Só validação shell (não executa script Node)
  -h, --help        Esta ajuda

Exemplo (feature branch de segurança no staging):
  cd /opt/smart-signage
  bash scripts/validate-predeploy-staging.sh --strict
  bash scripts/deploy-staging-vx5.sh --branch feature/audit-security-modo-simples-vx5
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) INSTALL_DIR="${2:-}"; shift 2 ;;
    --strict) STRICT=true; shift ;;
    --warn-only) WARN_ONLY=true; shift ;;
    --generate-key) GENERATE_KEY=true; shift ;;
    --skip-node) SKIP_NODE=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Opção desconhecida: $1"
      usage
      exit 1
      ;;
  esac
done

resolve_install_dir() {
  if [[ -n "$INSTALL_DIR" && -d "$INSTALL_DIR/backend" ]]; then
    return 0
  fi
  for candidate in \
    "/opt/smart-signage" \
    "$HOME/TotemDigital" \
    "$HOME/smart-signage" \
    "$(cd "$SCRIPT_DIR/.." && pwd)"; do
    if [[ -d "$candidate/backend" && -f "$candidate/scripts/install-smartsignage.sh" ]]; then
      INSTALL_DIR="$candidate"
      return 0
    fi
  done
  echo "ERRO: INSTALL_DIR não encontrado (backend/ + scripts/install-smartsignage.sh)."
  exit 1
}

if [[ "$GENERATE_KEY" == "true" ]]; then
  echo "Gere uma chave segura e adicione ao .env:"
  echo
  if command -v openssl >/dev/null 2>&1; then
    key="$(openssl rand -base64 32)"
    echo "TOTEM_SECRET_KEY=$key"
  else
    echo "openssl rand -base64 32"
    echo "(openssl não encontrado neste host)"
  fi
  echo
  echo "Edite o .env: sudo nano /opt/smart-signage/.env"
  exit 0
fi

resolve_install_dir
ENV_FILE="$INSTALL_DIR/.env"

echo "============================================================"
echo " Pré-deploy staging — validação de ambiente"
echo "============================================================"
echo "INSTALL_DIR: $INSTALL_DIR"
echo "ENV_FILE:    $ENV_FILE"
echo "STRICT:      $STRICT"
echo

BLOCKED=0
WARNINGS=0

fail() {
  echo "ERRO: $1"
  BLOCKED=1
}

warn() {
  echo "AVISO: $1"
  WARNINGS=$((WARNINGS + 1))
}

pass() {
  echo "OK: $1"
}

if [[ ! -f "$ENV_FILE" ]]; then
  fail ".env não encontrado em $ENV_FILE"
  echo
  echo "Crie o .env ou reinstale. Para gerar chave: bash $0 --generate-key"
  exit 1
fi

# shellcheck disable=SC1090
set +u
source <(grep -E '^(NODE_ENV|TOTEM_SECRET_KEY|TOTEMDIGITAL_COMPACT|PORT)=' "$ENV_FILE" 2>/dev/null | sed 's/\r$//' || true)
set -u

NODE_ENV="${NODE_ENV:-development}"
TOTEM_SECRET_KEY="${TOTEM_SECRET_KEY:-}"
TOTEMDIGITAL_COMPACT="${TOTEMDIGITAL_COMPACT:-}"

echo "[1/4] NODE_ENV=$NODE_ENV"

if [[ "$NODE_ENV" == "production" ]]; then
  STRICT=true
  pass "NODE_ENV=production — regras estritas aplicadas automaticamente"
fi

echo "[2/4] TOTEM_SECRET_KEY"

if [[ -z "${TOTEM_SECRET_KEY// }" ]]; then
  if [[ "$STRICT" == "true" ]]; then
    fail "TOTEM_SECRET_KEY ausente (obrigatória em staging/produção)"
    echo "      Gere: bash $SCRIPT_DIR/validate-predeploy-staging.sh --generate-key"
  else
    warn "TOTEM_SECRET_KEY ausente — OK só em development local"
  fi
else
  pass "TOTEM_SECRET_KEY definida (${#TOTEM_SECRET_KEY} caracteres, valor oculto)"
  if [[ ${#TOTEM_SECRET_KEY} -lt 16 ]]; then
    if [[ "$STRICT" == "true" ]]; then
      fail "TOTEM_SECRET_KEY curta demais (mín. 16 caracteres)"
    else
      warn "TOTEM_SECRET_KEY curta (mín. recomendado 16)"
    fi
  fi
  if [[ "$TOTEM_SECRET_KEY" == "smart-signage-totem-secret-key-2025-change-in-production" ]]; then
    if [[ "$STRICT" == "true" ]]; then
      fail "TOTEM_SECRET_KEY usa valor padrão inseguro do código antigo"
    else
      warn "TOTEM_SECRET_KEY usa valor padrão inseguro"
    fi
  fi
  if [[ "$TOTEM_SECRET_KEY" == "dev-only-totem-secret-not-for-production" ]]; then
    if [[ "$STRICT" == "true" ]]; then
      fail "TOTEM_SECRET_KEY usa fallback de desenvolvimento"
    else
      warn "TOTEM_SECRET_KEY usa fallback de desenvolvimento"
    fi
  fi
fi

echo "[3/4] Variáveis recomendadas Studio Vx5"
if [[ -z "${TOTEMDIGITAL_COMPACT// }" ]]; then
  warn "TOTEMDIGITAL_COMPACT não definido — recomendado: true"
else
  pass "TOTEMDIGITAL_COMPACT=$TOTEMDIGITAL_COMPACT"
fi
if ! grep -qE '^MENU_LIVE_REFRESH_SECONDS=' "$ENV_FILE" 2>/dev/null; then
  warn "MENU_LIVE_REFRESH_SECONDS ausente — Onda B (cardápio ao vivo) usa default ou fica desativada"
fi

echo "[4/4] Validação Node (mesmas regras do backend feature security)"
NODE_SCRIPT="$INSTALL_DIR/backend/scripts/validate-totem-secret-env.mjs"
if [[ "$SKIP_NODE" == "true" ]]; then
  warn "Validação Node ignorada (--skip-node)"
elif [[ ! -f "$NODE_SCRIPT" ]]; then
  warn "Script Node não encontrado ($NODE_SCRIPT) — faça git pull da branch com segurança ou use --skip-node"
elif ! command -v node >/dev/null 2>&1; then
  warn "node não encontrado — validação shell apenas"
else
  if (cd "$INSTALL_DIR/backend" && node "$NODE_SCRIPT" --env-file "$ENV_FILE"); then
    pass "validate-totem-secret-env.mjs"
  else
    fail "validate-totem-secret-env.mjs falhou"
  fi
fi

echo
if [[ "$BLOCKED" -gt 0 ]]; then
  echo "RESULTADO: BLOQUEADO — corrija o .env antes do deploy."
  echo "  bash $SCRIPT_DIR/validate-predeploy-staging.sh --generate-key"
  exit 1
fi

if [[ "$WARNINGS" -gt 0 ]]; then
  echo "RESULTADO: OK com $WARNINGS aviso(s)."
  if [[ "$WARN_ONLY" == "true" ]]; then
    exit 2
  fi
  exit 0
fi

echo "RESULTADO: OK — pode executar deploy-staging-vx5.sh"
exit 0
