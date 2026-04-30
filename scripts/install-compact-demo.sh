#!/usr/bin/env bash
set -euo pipefail

# Instala em modo Compact com seed habilitado.
# Uso:
#   ./scripts/install-compact-demo.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"
TOTEMDIGITAL_COMPACT=true LOAD_SEEDS=true bash scripts/install-smartsignage.sh
