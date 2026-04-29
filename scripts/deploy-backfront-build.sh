#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_BUILD_DIR="$ROOT_DIR/frontend/build"
TARGET_BUILD_DIR="/opt/smart-signage/frontend/build"
NO_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --no-build)
      NO_BUILD=true
      ;;
    -h|--help)
      echo "Uso: $0 [--no-build]"
      echo
      echo "Opcoes:"
      echo "  --no-build   Pula compilacao e executa apenas sync + restart/reload + status"
      exit 0
      ;;
    *)
      echo "Opcao desconhecida: $arg"
      echo "Use --help para ver as opcoes disponiveis."
      exit 1
      ;;
  esac
done

echo "============================================================"
echo " SmartSignage - Deploy Back + Front Build"
echo "============================================================"
echo "Projeto: $ROOT_DIR"
echo "Origem build frontend: $SOURCE_BUILD_DIR"
echo "Destino build frontend: $TARGET_BUILD_DIR"
echo "Pular build: $NO_BUILD"
echo

if ! command -v rsync >/dev/null 2>&1; then
  echo "Erro: rsync não encontrado. Instale com: sudo apt-get install -y rsync"
  exit 1
fi

if [[ "$NO_BUILD" == "false" ]]; then
  echo "[1/5] Executando build backend + frontend..."
  bash "$ROOT_DIR/scripts/install-smartsignage.sh" --backfront-build
else
  echo "[1/5] Build ignorado por --no-build."
fi

if [[ ! -d "$SOURCE_BUILD_DIR" ]] || [[ ! -f "$SOURCE_BUILD_DIR/index.html" ]]; then
  echo "Erro: build do frontend não encontrado em $SOURCE_BUILD_DIR"
  echo "Execute sem --no-build para gerar um novo build."
  exit 1
fi

echo "[2/5] Sincronizando build do frontend para $TARGET_BUILD_DIR..."
sudo mkdir -p "$TARGET_BUILD_DIR"
sudo rsync -av --delete "$SOURCE_BUILD_DIR/" "$TARGET_BUILD_DIR/"

echo "[3/5] Reiniciando backend (smart-signage)..."
sudo systemctl restart smart-signage

echo "[4/5] Recarregando Nginx..."
sudo systemctl reload nginx

echo "[5/5] Validando status dos serviços..."
sudo systemctl status smart-signage --no-pager -l || true
sudo systemctl status nginx --no-pager -l || true

echo
echo "Deploy concluído com sucesso."
echo "Dica: no navegador use Ctrl+Shift+R para evitar cache antigo."
