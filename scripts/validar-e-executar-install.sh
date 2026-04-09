#!/usr/bin/env bash
# =============================================================================
# SmartSignage Pro - Validar artefactos do install e executar instalação (emulação)
# =============================================================================
# 1. Valida que existem: install-smartsignage.sh, start-services.sh,
#    fix-nginx-and-port80.sh e que o install contém verificação de portas 80/3000.
# 2. Executa o install em modo não interativo: --skip-menu --mode single-server
# Uso: bash scripts/validar-e-executar-install.sh
#      sudo bash scripts/validar-e-executar-install.sh  (recomendado para install)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_SCRIPT="$ROOT_DIR/scripts/install-smartsignage.sh"
START_SERVICES="$ROOT_DIR/scripts/start-services.sh"
FIX_NGINX="$ROOT_DIR/scripts/fix-nginx-and-port80.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ok() { echo -e "${GREEN}[OK]${NC} $1"; }
err() { echo -e "${RED}[ERRO]${NC} $1"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Validar e Executar Install (emulação)${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# --- 1. Validação de ficheiros e conteúdo ---
VALID=0

if [[ -f "$INSTALL_SCRIPT" ]]; then
    ok "install-smartsignage.sh existe"
else
    err "install-smartsignage.sh não encontrado: $INSTALL_SCRIPT"
    VALID=1
fi

if [[ -f "$START_SERVICES" ]]; then
    ok "start-services.sh existe"
else
    err "start-services.sh não encontrado: $START_SERVICES"
    VALID=1
fi

if [[ -f "$FIX_NGINX" ]]; then
    ok "fix-nginx-and-port80.sh existe"
else
    warn "fix-nginx-and-port80.sh não encontrado (opcional)"
fi

if [[ -f "$INSTALL_SCRIPT" ]] && grep -q "start-services.sh" "$INSTALL_SCRIPT" && grep -q "Portas 80 ou 3000" "$INSTALL_SCRIPT"; then
    ok "Install contém verificação de portas 80/3000 e referência a start-services.sh"
else
    err "Install não contém verificação de portas ou referência a start-services.sh"
    VALID=1
fi

if [[ $VALID -ne 0 ]]; then
    err "Validação falhou. Corrija os itens em falta."
    exit 1
fi

echo ""
info "Validação concluída. A executar instalação (emulação) com --skip-menu --mode single-server..."
echo ""

# --- 2. Execução do install ---
cd "$ROOT_DIR"
chmod +x "$INSTALL_SCRIPT" "$START_SERVICES" 2>/dev/null || true

# Executar install; pode pedir sudo durante o processo
# Para execução totalmente não interativa: sudo bash scripts/validar-e-executar-install.sh
bash "$INSTALL_SCRIPT" --skip-menu --mode single-server
EXIT_CODE=$?
if [[ $EXIT_CODE -eq 0 ]]; then
    echo ""
    ok "Instalação concluída com sucesso."
    info "Para verificar serviços: sudo bash $START_SERVICES"
    exit 0
else
    echo ""
    err "Instalação terminou com erros (código: $EXIT_CODE)."
    info "Para subir apenas serviços: sudo bash $START_SERVICES"
    exit $EXIT_CODE
fi
