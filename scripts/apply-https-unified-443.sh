#!/usr/bin/env bash
# Atalho: reaplica Nginx HTTPS unificado (443) com certificado Let's Encrypt já emitido.
# Uso (no servidor):
#   cd ~/TotemDigital-Studio && git pull && sudo bash scripts/apply-https-unified-443.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec bash "$ROOT/scripts/install-smartsignage.sh" --apply-le-https-only "$@"
