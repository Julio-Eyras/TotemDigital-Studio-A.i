#!/usr/bin/env bash
# Copia o APK release mais recente e o modelo de config para install-pendrive/ na raiz do repositório.
# Nome oficial: Player-AD-Vs{versionName}-build-{versionCode}.apk
set -euo pipefail

PLAYER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$PLAYER_DIR/.." && pwd)"
DEST="$REPO_ROOT/install-pendrive"

echo "== Preparar pasta install-pendrive =="
echo "Destino: $DEST"

mkdir -p "$DEST/apk" "$DEST/config"

GRADLE="$PLAYER_DIR/build.gradle"
VER=$(grep -E "versionName" "$GRADLE" | head -n1 | sed -E "s/.*versionName[[:space:]]+'([^']+)'.*/\1/")
CODE=$(grep -E "versionCode" "$GRADLE" | head -n1 | sed -E "s/.*versionCode[[:space:]]+([0-9]+).*/\1/")
DEST_APK_NAME="Player-AD-Vs${VER}-build-${CODE}.apk"

# APK assinado (exclui -unsigned); preferir o nome versionado
APK_PATH="$(ls -1t "$PLAYER_DIR"/build/outputs/apk/release/Player-AD-Vs*-build-*.apk 2>/dev/null | head -n 1 || true)"
if [[ -z "$APK_PATH" || ! -f "$APK_PATH" ]]; then
  APK_PATH="$(ls -1t "$PLAYER_DIR"/build/outputs/apk/release/*.apk 2>/dev/null | grep -v -- '-unsigned.apk' | head -n 1 || true)"
fi

if [[ -z "$APK_PATH" || ! -f "$APK_PATH" ]]; then
  echo "❌ APK release não encontrado. Compile antes:"
  echo "   (cd \"$PLAYER_DIR\" && ./gradlew assembleRelease)"
  exit 1
fi

# Remover APKs antigos do kit (mantém instalador versionado até copiar o novo)
find "$DEST/apk" -maxdepth 1 -type f -name '*.apk' ! -name 'Instala-Player-TotemDigital*' -delete 2>/dev/null || true

cp -f "$APK_PATH" "$DEST/apk/$DEST_APK_NAME"
echo "✔ Copiado: $(basename "$APK_PATH") → install-pendrive/apk/${DEST_APK_NAME} (não altera boot)"

INSTALLER_SRC="$(ls -1t "$REPO_ROOT"/Player-AD-Installer/build/outputs/apk/release/Instala-Player-TotemDigital-Vs*-build-*.apk 2>/dev/null | head -n 1 || true)"
INSTALLER_DEST_NAME=""
if [[ -n "$INSTALLER_SRC" && -f "$INSTALLER_SRC" ]]; then
  find "$DEST/apk" -maxdepth 1 -type f -name 'Instala-Player-TotemDigital*.apk' -delete 2>/dev/null || true
  INSTALLER_DEST_NAME="$(basename "$INSTALLER_SRC")"
  cp -f "$INSTALLER_SRC" "$DEST/apk/$INSTALLER_DEST_NAME"
  echo "✔ Copiado: ${INSTALLER_DEST_NAME} (logo boot + Player-AD)"
else
  EXISTING="$(ls -1t "$DEST"/apk/Instala-Player-TotemDigital-Vs*-build-*.apk 2>/dev/null | head -n 1 || true)"
  if [[ -n "$EXISTING" && -f "$EXISTING" ]]; then
    INSTALLER_DEST_NAME="$(basename "$EXISTING")"
    echo "✔ Mantido: ${INSTALLER_DEST_NAME} já no kit"
  else
    echo "⚠ Instala-Player-TotemDigital-Vs*-build-*.apk ausente — compile Player-AD-Installer"
  fi
fi

if [[ -f "$PLAYER_DIR/scripts/generate-default-player-config.json" ]]; then
  cp -f "$PLAYER_DIR/scripts/generate-default-player-config.json" "$DEST/config/exemplo-player-config.json"
  echo "✔ Atualizado: install-pendrive/config/exemplo-player-config.json"
fi

FE_VER=$(python3 -c "import json; print(json.load(open('$REPO_ROOT/frontend/package.json'))['version'])" 2>/dev/null || echo '?')
BE_VER=$(python3 -c "import json; print(json.load(open('$REPO_ROOT/backend/package.json'))['version'])" 2>/dev/null || echo '?')
TODAY=$(date +%Y-%m-%d)
if [[ -f "$DEST/LEIA-ME.txt" && -n "$VER" ]]; then
  sed -i -E "s/Player-AD[[:space:]]+[0-9.]+ \(versionCode [0-9]+\)/Player-AD ${VER} (versionCode ${CODE})/" "$DEST/LEIA-ME.txt"
  sed -i -E "s/Front [0-9.]+ \/ Back [0-9.]+/Front ${FE_VER} \/ Back ${BE_VER}/" "$DEST/LEIA-ME.txt"
  sed -i -E "s|apk/Player-AD[^[:space:]]+|apk/${DEST_APK_NAME}|g" "$DEST/LEIA-ME.txt"
  if [[ -n "$INSTALLER_DEST_NAME" ]]; then
    sed -i -E "s|apk/Instala-Player-TotemDigital[^[:space:]]*|apk/${INSTALLER_DEST_NAME}|g" "$DEST/LEIA-ME.txt"
  fi
  echo "✔ LEIA-ME: Player-AD ${VER} (versionCode ${CODE})"
fi
cat > "$DEST/KIT-VERSION.txt" <<EOF
TotemDigital — Kit de campo (pendrive)
Player-AD:     ${VER} (versionCode ${CODE})
Painel:        Front ${FE_VER} / Back ${BE_VER}
Branch:        main
Data kit:      ${TODAY}
APK git:       install-pendrive/apk/${DEST_APK_NAME} (sem debug; não altera boot)
Instalador:    install-pendrive/apk/${INSTALLER_DEST_NAME:-Instala-Player-TotemDigital-Vs*-build-*.apk} (logo boot + Player-AD)
Homologação:   docs/hardware/HOMOLOGACAO-TV-BOX-PLAYER-AD-2.12.md (base 2.12)
Campo:         TV_BOX_3 — ${VER} / ${CODE} (kit ${TODAY}); base PASS 2.12 / 112 (2026-08-13)

Regenerar (com APK release compilado):
  cd Player-AD
  ./scripts/prepare-install-pendrive.sh
EOF
echo "✔ KIT-VERSION.txt: Player-AD ${VER} (${CODE}) · FE ${FE_VER} · BE ${BE_VER}"

echo ""
echo "✅ Pendrive: copie TODO o conteúdo de:"
echo "   $DEST"
echo "   para a raiz do USB (ver install-pendrive/README.md)."
