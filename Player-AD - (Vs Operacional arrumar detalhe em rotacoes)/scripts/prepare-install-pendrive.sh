#!/usr/bin/env bash
# Copia o APK release mais recente e o modelo de config para install-pendrive/ na raiz do repositório.
set -euo pipefail

PLAYER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$PLAYER_DIR/.." && pwd)"
DEST="$REPO_ROOT/install-pendrive"

echo "== Preparar pasta install-pendrive =="
echo "Destino: $DEST"

mkdir -p "$DEST/apk" "$DEST/config"

# APK assinado (exclui -unsigned)
APK_PATH="$(ls -1t "$PLAYER_DIR"/build/outputs/apk/release/*.apk 2>/dev/null | grep -v -- '-unsigned.apk' | head -n 1 || true)"

if [[ -z "$APK_PATH" || ! -f "$APK_PATH" ]]; then
  echo "❌ APK release não encontrado. Compile antes:"
  echo "   (cd \"$PLAYER_DIR\" && ./gradlew assembleRelease)"
  exit 1
fi

cp -f "$APK_PATH" "$DEST/apk/"
echo "✔ Copiado: $(basename "$APK_PATH") → install-pendrive/apk/"

if [[ -f "$PLAYER_DIR/scripts/generate-default-player-config.json" ]]; then
  cp -f "$PLAYER_DIR/scripts/generate-default-player-config.json" "$DEST/config/exemplo-player-config.json"
  echo "✔ Atualizado: install-pendrive/config/exemplo-player-config.json"
fi

echo ""
echo "✅ Pendrive: copie TODO o conteúdo de:"
echo "   $DEST"
echo "   para a raiz do USB (ver install-pendrive/README.md)."
