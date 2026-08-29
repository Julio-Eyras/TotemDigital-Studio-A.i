#!/usr/bin/env bash
# Copia logo de kit para o data dir do Player-Linux (splash ~3 s no arranque).
# NÃO instala bootanimation Android nem plymouth — isso é firmware/SO, ver
# docs/hardware/SOC-BOOT-PATHS.md. Plymouth no totem: pacote da distro, não este player.
set -euo pipefail

DATA="${DATA:-/var/lib/player-linux}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-}"

if [[ -z "$SRC" ]]; then
  for cand in \
    "$ROOT/branding" \
    "$ROOT/../install-pendrive/bootanimation" \
    "$ROOT/../install-pendrive/branding" \
    "$ROOT/../branding"; do
    if [[ -f "$cand/logo.png" ]]; then
      SRC="$cand"
      break
    fi
  done
fi

if [[ -z "$SRC" || ! -f "$SRC/logo.png" ]]; then
  echo "Uso: $0 [pasta-com-logo.png]" >&2
  echo "Coloque logo.png (retrato 720×1280 ou 1080×1920) em Player-Linux/branding/ ou passe o caminho." >&2
  echo "Splash no player: $DATA/branding/logo.png" >&2
  echo "Plymouth / boot logo de firmware: NÃO aplicado (kit Linux ≠ APK 1.7)." >&2
  exit 1
fi

install -d "$DATA/branding"
install -m 0644 "$SRC/logo.png" "$DATA/branding/logo.png"
if [[ -f "$SRC/splash.png" ]]; then
  install -m 0644 "$SRC/splash.png" "$DATA/branding/splash.png"
fi
if id -u playerlinux >/dev/null 2>&1; then
  chown -R playerlinux:playerlinux "$DATA/branding" 2>/dev/null || true
fi
echo "Branding: $DATA/branding/logo.png (splash ~3 s no arranque do player-linux)"
echo "Plymouth/bootanimation de SoC: instalar no SO, não neste script."
