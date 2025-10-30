#!/usr/bin/env bash
set -euo pipefail

banner() {
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║             Smart Signage Pro - LIMPEZA TOTAL               ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
}

confirm() {
  echo
  echo "⚠️  ESTA AÇÃO É IRREVERSÍVEL!"
  echo "Será APAGADO:" 
  echo "  - Todos os containers (parados e em execução)"
  echo "  - Todas as imagens não utilizadas"
  echo "  - Todos os volumes Docker (dados de banco, uploads, etc.)"
  echo "  - Redes Docker não utilizadas"
  echo "  - Diretórios do projeto: /opt/smart-signage (e opcional ~/smart-signage)"
  echo
  read -r -p "Digite exatamente 'APAGAR TUDO' para confirmar: " CONF
  if [[ "${CONF:-}" != "APAGAR TUDO" ]]; then
    echo "Cancelado pelo usuário."
    exit 1
  fi
}

clean_compose() {
  echo "[1/7] Derrubando stacks docker-compose se existir..."
  (cd /opt/smart-signage 2>/dev/null && docker compose down --volumes --remove-orphans) || true
}

clean_containers() {
  echo "[2/7] Removendo todos os containers..."
  docker ps -aq | xargs -r docker rm -f || true
}

clean_images() {
  echo "[3/7] Removendo imagens não utilizadas..."
  docker image prune -af || true
}

clean_volumes() {
  echo "[4/7] Removendo volumes (DADOS SERÃO PERDIDOS)..."
  docker volume prune -f || true
}

clean_networks() {
  echo "[5/7] Removendo redes não utilizadas..."
  docker network prune -f || true
}

system_prune() {
  echo "[6/7] Limpando sistema Docker..."
  docker system prune -af || true
}

remove_dirs() {
  echo "[7/7] Removendo diretórios do projeto..."
  sudo rm -rf /opt/smart-signage || true
  read -r -p "Remover também ~/smart-signage? (y/N): " RMD
  if [[ "${RMD:-}" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    rm -rf "$HOME/smart-signage" || true
  fi
}

main() {
  banner
  confirm
  clean_compose
  clean_containers
  clean_images
  clean_volumes
  clean_networks
  system_prune
  remove_dirs
  echo "✅ Limpeza concluída."
}

main "$@"


