#!/usr/bin/env bash
# Atualiza a instância PRODUÇÃO (clone ~/TotemDigital-Studio) a partir de origin/main.
# Não apaga a BD. Uso no servidor:
#   bash scripts/pro-update-install-main.sh
set -euo pipefail

cd ~/TotemDigital-Studio
git fetch origin && git checkout main && git pull --ff-only origin main
bash scripts/Instala-TotemDigital-Server.sh \
  --modo atualizar \
  --instancia producao \
  --git-pull \
  --sim \
  --dominio totemdigital.app.br \
  --email admin@totemdigital.app.br \
  --owner-user ismael \
  --owner-name "Totem Digital"
