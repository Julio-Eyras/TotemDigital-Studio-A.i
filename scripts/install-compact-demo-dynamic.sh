#!/usr/bin/env bash
set -euo pipefail

# Instala em modo Compact com seed habilitado e demo dinâmica forçada.
# Uso:
#   ./scripts/install-compact-demo-dynamic.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"
TOTEMDIGITAL_COMPACT=true LOAD_SEEDS=true SYSTEM_ENABLE_DYNAMIC_DEMO_SEED=true bash scripts/install-smartsignage.sh
