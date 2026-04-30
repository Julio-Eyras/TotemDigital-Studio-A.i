#!/usr/bin/env bash
set -euo pipefail

# Valida a carga demo dinâmica após instalação.
# Uso:
#   ./scripts/validate-compact-demo-dynamic.sh
# Opcional:
#   DB=smartsignage ./scripts/validate-compact-demo-dynamic.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${DB:-smartsignage}"

cd "$ROOT_DIR"
DB="$DB" ./scripts/validate-demo-dynamic.sh
