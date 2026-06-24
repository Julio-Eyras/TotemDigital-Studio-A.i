#!/usr/bin/env bash
# Deploy staging — Publicar em Tela Vx5 (Ondas A/B/C)
# Automatiza: backup .env → git pull → build → sync frontend → restart → smoke /health
#
# Uso (no servidor Linux, via SSH):
#   bash scripts/deploy-staging-vx5.sh
#   INSTALL_DIR=/opt/smart-signage bash scripts/deploy-staging-vx5.sh
#   bash scripts/deploy-staging-vx5.sh --no-build    # só pull + restart (build já feito)
#   bash scripts/deploy-staging-vx5.sh --no-pull     # só build + restart (código já atualizado)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="${BRANCH:-Smart-Signage-Studio-Vx5}"
NO_PULL=false
NO_BUILD=false
INSTALL_DIR="${INSTALL_DIR:-}"

usage() {
  cat <<'EOF'
Uso: deploy-staging-vx5.sh [opções]

Opções:
  --dir PATH       Diretório da instalação (default: auto ou INSTALL_DIR)
  --branch NAME    Branch git (default: Smart-Signage-Studio-Vx5)
  --no-pull        Pula git fetch/checkout/pull
  --no-build       Pula compilação (delega sync+restart ao deploy-backfront-build --no-build)
  -h, --help       Esta ajuda

Variáveis de ambiente:
  INSTALL_DIR      Caminho do repositório no servidor
  BRANCH           Branch a fazer deploy

Pré-validação (recomendado antes do deploy):
  bash scripts/validate-predeploy-staging.sh --strict
  bash scripts/validate-predeploy-staging.sh --generate-key

Exemplo (SSH no staging — feature segurança):
  ssh usuario@217.216.91.135
  cd /opt/smart-signage
  bash scripts/validate-predeploy-staging.sh --strict
  bash scripts/deploy-staging-vx5.sh --branch feature/audit-security-modo-simples-vx5

Após o deploy, homologue em:
  http://SEU_HOST:8080/quick-publish?mode=create
  Ver docs/PROCEDIMENTOS_HOMOLOGACAO_PUBLICAR_EM_TELA_Vx5.pdf
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)
      INSTALL_DIR="${2:-}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:-}"
      shift 2
      ;;
    --no-pull) NO_PULL=true; shift ;;
    --no-build) NO_BUILD=true; shift ;;
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
  echo "Erro: não foi possível localizar INSTALL_DIR (backend/ + scripts/install-smartsignage.sh)."
  echo "Use: INSTALL_DIR=/caminho bash $0"
  exit 1
}

run_predeploy_validation() {
  local validate_script="$INSTALL_DIR/scripts/validate-predeploy-staging.sh"
  if [[ ! -f "$validate_script" ]]; then
    echo "⚠️  validate-predeploy-staging.sh não encontrado — pulando validação estrita."
    warn_env_keys
    return 0
  fi
  echo "[3/7] Validação pré-deploy (TOTEM_SECRET_KEY / NODE_ENV)..."
  if INSTALL_DIR="$INSTALL_DIR" bash "$validate_script" --strict; then
    echo "✓ Pré-deploy OK"
  else
    echo
    echo "Deploy abortado. Corrija o .env e tente novamente."
    echo "  bash scripts/validate-predeploy-staging.sh --generate-key"
    exit 1
  fi
  warn_env_keys
}

warn_env_keys() {
  local env_file="$INSTALL_DIR/.env"
  [[ -f "$env_file" ]] || return 0
  local missing=()
  for key in TOTEMDIGITAL_COMPACT MENU_LIVE_REFRESH_SECONDS TOTEM_SECRET_KEY; do
    if ! grep -qE "^${key}=" "$env_file" 2>/dev/null; then
      missing+=("$key")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "⚠️  .env sem chaves recomendadas para Vx5: ${missing[*]}"
    echo "    Edite $env_file antes da homologação (ver PDF de procedimentos)."
  fi
  if grep -qE '^TOTEM_SECRET_KEY=smart-signage-totem-secret-key-2025-change-in-production' "$env_file" 2>/dev/null; then
    echo "⚠️  TOTEM_SECRET_KEY está com valor padrão inseguro — altere antes de produção."
  fi
  if ! grep -qE '^AI_VIDEO_' "$env_file" 2>/dev/null; then
    echo "ℹ️  AI_VIDEO_* não configurado — vídeo IA Premium ficará em fila informativa (202)."
  fi
}

health_smoke() {
  local port=3001
  if [[ -f "$INSTALL_DIR/.env" ]]; then
    local parsed
    parsed="$(grep -E '^PORT=' "$INSTALL_DIR/.env" | tail -1 | cut -d= -f2 | tr -d '"' | tr -d "'" | xargs || true)"
    [[ -n "$parsed" ]] && port="$parsed"
  fi
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl não disponível — smoke HTTP ignorado."
    return 0
  fi
  echo "[smoke] GET http://127.0.0.1:${port}/health"
  local body
  body="$(curl -sf "http://127.0.0.1:${port}/health" 2>/dev/null || true)"
  if [[ -n "$body" ]]; then
    echo "$body" | head -c 400
    echo
    if echo "$body" | grep -q 'studioMode'; then
      echo "✓ Health respondeu (verifique studioMode no JSON acima)."
    else
      echo "⚠️  Health OK mas studioMode não encontrado no corpo — conferir TOTEMDIGITAL_COMPACT."
    fi
  else
    echo "⚠️  Não foi possível contactar /health na porta ${port}. Verifique journalctl -u smart-signage."
    return 0
  fi
  echo "[smoke] GET http://127.0.0.1:${port}/api/health"
  local api_body
  api_body="$(curl -sf "http://127.0.0.1:${port}/api/health" 2>/dev/null || true)"
  if [[ -n "$api_body" ]]; then
    echo "$api_body" | head -c 200
    echo
    echo "✓ /api/health respondeu."
  else
    echo "⚠️  /api/health não respondeu — backend pode estar a arrancar."
  fi
}

resolve_install_dir
cd "$INSTALL_DIR"

echo "============================================================"
echo " TotemDigital — Deploy staging Vx5 (Publicar em Tela)"
echo "============================================================"
echo "INSTALL_DIR: $INSTALL_DIR"
echo "BRANCH:      $BRANCH"
echo "NO_PULL:     $NO_PULL"
echo "NO_BUILD:    $NO_BUILD"
echo

if [[ -f "$INSTALL_DIR/.env" ]]; then
  backup="$INSTALL_DIR/.env.backup.$(date +%Y%m%d-%H%M%S)"
  cp "$INSTALL_DIR/.env" "$backup"
  echo "[1/7] Backup .env → $backup"
else
  echo "[1/7] .env não encontrado — continuando sem backup."
fi

if [[ "$NO_PULL" == "false" ]]; then
  echo "[2/7] Atualizando git ($BRANCH)..."
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
  echo "HEAD: $(git log -1 --oneline)"
else
  echo "[2/7] Git pull ignorado (--no-pull). HEAD: $(git log -1 --oneline 2>/dev/null || echo '?')"
fi

run_predeploy_validation

echo "[4/7] Build + sync + restart..."
if [[ "$NO_BUILD" == "true" ]]; then
  bash "$INSTALL_DIR/scripts/deploy-backfront-build.sh" --no-build
else
  bash "$INSTALL_DIR/scripts/deploy-backfront-build.sh"
fi

echo "[5/7] Status dos serviços..."
sudo systemctl is-active smart-signage 2>/dev/null && echo "✓ smart-signage ativo" || echo "⚠️  smart-signage não reportou active"
sudo systemctl is-active nginx 2>/dev/null && echo "✓ nginx ativo" || echo "⚠️  nginx não reportou active"

echo "[6/7] Smoke HTTP..."
health_smoke

echo
echo "Deploy Vx5 concluído."
echo "Painel: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'SEU_HOST'):8080"
echo "Homologação: docs/PROCEDIMENTOS_HOMOLOGACAO_PUBLICAR_EM_TELA_Vx5.pdf (§7)"
echo "No browser: Ctrl+Shift+R para evitar cache."
