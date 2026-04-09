#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="$ROOT/scripts"

echo "== Player-LXN Ubuntu one-click installer =="
echo "Root: $ROOT"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Nao execute como root. Use usuario normal com sudo."
  exit 1
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo nao encontrado."
  exit 1
fi

echo ""
echo ">> Instalando dependencias (python3 + chromium-browser)..."
sudo apt update
sudo apt install -y python3 chromium-browser

echo ""
echo ">> Ajustando permissao de scripts..."
chmod +x "$SCRIPTS_DIR"/*.sh

echo ""
echo ">> Executando instalacao principal..."
"$SCRIPTS_DIR/install-player-lxn.sh"

echo ""
echo ">> Validando status..."
"$SCRIPTS_DIR/status-player-lxn.sh" || true

echo ""
echo "Concluido."
echo "Se necessario, reinicie sessao grafica para autostart do kiosk."
