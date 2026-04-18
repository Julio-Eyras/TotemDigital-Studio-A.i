#!/usr/bin/env bash
# Validação pós-deploy — modo compacto TotemDigital (backend + build frontend + Nginx).
# Uso no servidor: ./scripts/post-deploy-compact-check.sh
# Variáveis opcionais: BACKEND_PORT FRONTEND_BUILD DEPLOY_FRONTEND
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_BUILD="${FRONTEND_BUILD:-$REPO_DIR/frontend/build}"
DEPLOY_FRONTEND="${DEPLOY_FRONTEND:-/opt/smart-signage/frontend/build}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== TotemDigital — verificação pós-deploy (compacto) ==="
echo "Repo: $REPO_DIR"
echo

echo "=== 1) systemd: smart-signage ==="
if systemctl cat smart-signage.service &>/dev/null; then
  ACTIVE="$(systemctl is-active smart-signage 2>/dev/null || echo unknown)"
  if [[ "$ACTIVE" == "active" ]]; then
    echo -e "${GREEN}✓ serviço ativo${NC}"
  else
    echo -e "${RED}✗ estado: $ACTIVE (esperado: active)${NC}"
    echo "   Tente: sudo systemctl start smart-signage"
  fi
  systemctl show smart-signage -p WorkingDirectory -p ExecStart --no-pager 2>/dev/null || true
else
  echo -e "${YELLOW}! unit smart-signage.service não encontrada${NC}"
  echo "   Crie com: ./scripts/create-smart-signage-service.sh $REPO_DIR"
fi
echo

echo "=== 2) Health backend (127.0.0.1:${BACKEND_PORT}/api/health) ==="
CODE="$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${BACKEND_PORT}/api/health" 2>/dev/null || echo "000")"
if [[ "$CODE" == "200" ]]; then
  echo -e "${GREEN}✓ HTTP $CODE${NC}"
else
  echo -e "${RED}✗ HTTP $CODE${NC}"
  echo "   Confirme TOTEMDIGITAL_COMPACT no .env e rebuild em \$(WorkingDirectory)/backend"
fi
echo

echo "=== 3) Build local do frontend (fonte) ==="
if [[ -f "$FRONTEND_BUILD/index.html" ]]; then
  echo -e "${GREEN}✓ $FRONTEND_BUILD/index.html existe${NC}"
  if grep -q "Smart Signage Compact" "$FRONTEND_BUILD/index.html" 2>/dev/null; then
    echo -e "${GREEN}  index.html referencia marca Compact${NC}"
  else
    echo -e "${YELLOW}  index.html sem título Compact (pode ser build antigo ou Pro)${NC}"
  fi
  MAIN_JS="$(find "$FRONTEND_BUILD/static/js" -name 'main*.js' 2>/dev/null | head -1)"
  if [[ -n "$MAIN_JS" ]] && grep -q "Smart Signage Compact" "$MAIN_JS" 2>/dev/null; then
    echo -e "${GREEN}  bundle main contém Smart Signage Compact${NC}"
  elif [[ -n "$MAIN_JS" ]]; then
    echo -e "${YELLOW}  bundle main sem string Compact — rode: cd frontend && npm run build (usa .env.production)${NC}"
  fi
else
  echo -e "${YELLOW}! não encontrado: $FRONTEND_BUILD — rode: cd frontend && npm ci && npm run build${NC}"
fi
echo

echo "=== 4) Deploy Nginx (cópia típica) ==="
if [[ -f "$DEPLOY_FRONTEND/index.html" ]]; then
  echo -e "${GREEN}✓ $DEPLOY_FRONTEND/index.html existe${NC}"
else
  echo -e "${YELLOW}! $DEPLOY_FRONTEND não tem index.html — copie o build:${NC}"
  echo "   sudo mkdir -p $DEPLOY_FRONTEND && sudo cp -a $REPO_DIR/frontend/build/* $DEPLOY_FRONTEND/"
fi
echo

echo "=== 5) Nginx (teste de configuração) ==="
NGINX_OUT="$(nginx -t 2>&1 || true)"
NGINX_OK=0
if echo "$NGINX_OUT" | grep -q 'syntax is ok'; then
  NGINX_OK=1
elif command -v sudo >/dev/null 2>&1; then
  NGINX_SUDO="$(sudo -n nginx -t 2>&1 || true)"
  if echo "$NGINX_SUDO" | grep -q 'syntax is ok'; then
    NGINX_OK=1
  fi
fi
if [[ "$NGINX_OK" -eq 1 ]]; then
  echo -e "${GREEN}✓ sintaxe Nginx OK${NC}"
else
  echo "$NGINX_OUT" | tail -3
  echo -e "${YELLOW}! confirme no servidor: sudo nginx -t${NC}"
fi
echo

echo "=== 6) HTTP local (porta 80) ==="
H80="$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1/ 2>/dev/null || echo "000")"
echo "GET http://127.0.0.1/ → HTTP $H80 (200/301/302 são comuns)"
echo

echo "=== Resumo ==="
echo "Marca no browser: login e menu devem mostrar **Smart Signage Compact** com build compacto."
echo "Documentação: docs/technical/04-instalacao.md (verificação visual + comandos)."
echo "Diagnóstico 502: ./scripts/diagnose-502.sh"
