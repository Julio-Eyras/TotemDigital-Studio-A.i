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

GRADLE="$PLAYER_DIR/build.gradle"
VER=$(grep -E "versionName" "$GRADLE" | head -n1 | sed -E "s/.*versionName[[:space:]]+'([^']+)'.*/\1/")
CODE=$(grep -E "versionCode" "$GRADLE" | head -n1 | sed -E "s/.*versionCode[[:space:]]+([0-9]+).*/\1/")
FE_VER=$(python3 -c "import json; print(json.load(open('$REPO_ROOT/frontend/package.json'))['version'])" 2>/dev/null || echo '?')
BE_VER=$(python3 -c "import json; print(json.load(open('$REPO_ROOT/backend/package.json'))['version'])" 2>/dev/null || echo '?')
TODAY=$(date +%Y-%m-%d)
if [[ -f "$DEST/LEIA-ME.txt" && -n "$VER" ]]; then
  sed -i -E "s/Player-AD[[:space:]]+[0-9.]+ \(versionCode [0-9]+\)/Player-AD ${VER} (versionCode ${CODE})/" "$DEST/LEIA-ME.txt"
  sed -i -E "s/Front [0-9.]+ \/ Back [0-9.]+/Front ${FE_VER} \/ Back ${BE_VER}/" "$DEST/LEIA-ME.txt"
  echo "✔ LEIA-ME: Player-AD ${VER} (versionCode ${CODE})"
fi
cat > "$DEST/KIT-VERSION.txt" <<EOF
TotemDigital — Kit de campo (pendrive)
Player-AD:     ${VER} (versionCode ${CODE})
Painel:        Front ${FE_VER} / Back ${BE_VER}
Branch:        main
Data kit:      ${TODAY}
Homologação:   docs/hardware/HOMOLOGACAO-TV-BOX-PLAYER-AD-2.12.md
Campo:         TV_BOX_3 PASS 2026-08-13 (Player-AD 2.12 / 112)

Regenerar (com APK release compilado):
  cd Player-AD
  ./scripts/prepare-install-pendrive.sh
EOF
echo "✔ KIT-VERSION.txt: Player-AD ${VER} (${CODE}) · FE ${FE_VER} · BE ${BE_VER}"

echo ""
echo "✅ Pendrive: copie TODO o conteúdo de:"
echo "   $DEST"
echo "   para a raiz do USB (ver install-pendrive/README.md)."
