#!/usr/bin/env bash
# Executar no PC (Linux/macOS/Git Bash) com o Android ligado por USB e Depuração USB ativa.
# Uso (a partir da pasta install-pendrive):
#   bash scripts/install-from-pc-adb.sh
#   bash scripts/install-from-pc-adb.sh /caminho/para/outro.apk
#   bash scripts/install-from-pc-adb.sh "" config/exemplo-player-config.json
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK_ARG="${1:-}"
CONFIG_JSON="${2:-}"

if ! command -v adb >/dev/null 2>&1; then
  echo "❌ 'adb' não encontrado. Instale Android Platform Tools e adicione ao PATH."
  exit 1
fi

APK_PATH=""
if [[ -n "$APK_ARG" && -f "$APK_ARG" ]]; then
  APK_PATH="$APK_ARG"
else
  # Preferir player versionado; nunca o instalador de boot por defeito
  APK_PATH="$(ls -1t "$ROOT"/apk/Player-AD-Vs*-build-*.apk 2>/dev/null | head -n 1 || true)"
  if [[ -z "$APK_PATH" || ! -f "$APK_PATH" ]]; then
    APK_PATH="$(ls -1t "$ROOT"/apk/Player-AD*.apk 2>/dev/null | grep -v Instala-Player | head -n 1 || true)"
  fi
fi

if [[ -z "$APK_PATH" || ! -f "$APK_PATH" ]]; then
  echo "❌ Nenhum APK encontrado em: $ROOT/apk/"
  echo "   Coloque um ficheiro .apk em apk/ ou passe o caminho como 1º argumento."
  exit 1
fi

echo "== Instalar Player-AD via ADB =="
echo "APK: $APK_PATH"
adb devices | sed -n '1,5p'

echo ""
echo "Instalando..."
adb install -r -d -g "$APK_PATH"

if [[ -n "$CONFIG_JSON" ]]; then
  CFG="$CONFIG_JSON"
  [[ "$CFG" != /* ]] && CFG="$ROOT/$CFG"
  if [[ ! -f "$CFG" ]]; then
    echo "❌ Config não encontrada: $CFG"
    exit 1
  fi
  echo "Enviando config para /sdcard/smartsignage/player-config.json ..."
  adb shell "mkdir -p /sdcard/smartsignage" >/dev/null 2>&1 || true
  adb push "$CFG" "/sdcard/smartsignage/player-config.json"
fi

echo "✅ Concluído."
