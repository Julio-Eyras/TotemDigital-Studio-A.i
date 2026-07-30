#!/usr/bin/env bash
# =============================================================================
# DEPRECATED — use scripts/Instala-TotemDigital-Server.sh
# -----------------------------------------------------------------------------
# Este wrapper mantém-se por compatibilidade. Encaminha para o instalador oficial.
#
#   bash scripts/Instala-TotemDigital-Server.sh
#   bash scripts/Instala-TotemDigital-Server.sh --modo producao --sim
#
# Doc: docs/INSTALA-TOTEMDIGITAL-SERVER.md
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEW="$ROOT/scripts/Instala-TotemDigital-Server.sh"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " [AVISO] install-totemdigital-prod-https.sh está DEPRECIADO"
echo " Use:  bash scripts/Instala-TotemDigital-Server.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

if [[ ! -f "$NEW" ]]; then
  echo "[ERRO] Instalador oficial em falta: $NEW" >&2
  exit 1
fi

FINAL=(bash "$NEW" --modo producao)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) FINAL+=(--dominio "$2"); shift 2 ;;
    --email) FINAL+=(--email "$2"); shift 2 ;;
    --owner-user) FINAL+=(--owner-user "$2"); shift 2 ;;
    --owner-name) FINAL+=(--owner-name "$2"); shift 2 ;;
    --with-players) FINAL+=(--com-players); shift ;;
    --with-seeds) FINAL+=(--com-seeds); shift ;;
    --with-mqtt) FINAL+=(--com-mqtt); shift ;;
    --fresh)
      echo "[AVISO] --fresh no wrapper antigo → use o modo wipe no instalador oficial (confirmação interactiva)."
      FINAL=(bash "$NEW" --modo wipe)
      shift
      ;;
    --yes|--non-interactive) FINAL+=(--sim); shift ;;
    --interactive) shift ;;
    --dry-run) FINAL+=(--dry-run); shift ;;
    -h|--help) exec bash "$NEW" --ajuda ;;
    *) FINAL+=("$1"); shift ;;
  esac
done

exec "${FINAL[@]}"
