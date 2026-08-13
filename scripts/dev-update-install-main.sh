#!/usr/bin/env bash
# Atualiza a instância DEV (clone ~/TotemDigital-Studio-dev) a partir de origin/main.
# Não apaga a BD. Uso no servidor:
#   bash scripts/dev-update-install-main.sh
set -euo pipefail

cd ~/TotemDigital-Studio-dev
git pull --ff-only origin main
bash scripts/Instala-TotemDigital-Server.sh --modo atualizar --instancia dev --git-pull --sim \
  --dominio dev.totemdigital.app.br --email admin@totemdigital.app.br --owner-user ismael
