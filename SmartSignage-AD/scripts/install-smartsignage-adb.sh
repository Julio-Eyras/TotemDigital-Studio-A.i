#!/usr/bin/env bash
# Linux/macOS: compila SmartSignage-AD (debug) e instala no dispositivo via adb.
# Requer ANDROID_HOME ou ANDROID_SDK_ROOT, ou sdk.dir em ../local.properties
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG="br.com.smartchannel.smartsignagead"
APK="$ROOT/app/build/outputs/apk/debug/app-debug.apk"
CONFIG="${ROOT}/config/app-config.example.json"

CLEAN=false
SKIP_BUILD=false
NO_CONFIG=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --clean) CLEAN=true ;;
    --skip-build) SKIP_BUILD=true ;;
    --no-config) NO_CONFIG=true ;;
    *) echo "Uso: $0 [--clean] [--skip-build] [--no-config]"; exit 1 ;;
  esac
  shift
done

if ! command -v adb >/dev/null 2>&1; then
  echo "adb não encontrado no PATH."
  exit 1
fi

if [[ ! -x "$ROOT/gradlew" ]]; then
  chmod +x "$ROOT/gradlew"
fi

if [[ "$SKIP_BUILD" != "true" ]]; then
  if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" && ! -f "$ROOT/local.properties" ]]; then
    echo "Defina ANDROID_HOME (ou ANDROID_SDK_ROOT) ou crie:"
    echo "  $ROOT/local.properties"
    echo '  com uma linha: sdk.dir=/caminho/para/Android/Sdk'
    exit 1
  fi
  cd "$ROOT"
  if [[ "$CLEAN" == "true" ]]; then
    ./gradlew clean --no-daemon
  fi
  ./gradlew assembleDebug --no-daemon
fi

if [[ ! -f "$APK" ]]; then
  echo "APK não encontrado: $APK (assembleDebug precisa concluir sem erro)"
  exit 1
fi

adb devices | sed -n '1,5p'
echo "Instalando: $APK"
if ! adb install -r -d -g "$APK"; then
  adb uninstall "$PKG" 2>/dev/null || true
  adb install -r -d -g "$APK"
fi

if [[ "$NO_CONFIG" != "true" && -f "$CONFIG" ]]; then
  adb shell mkdir -p /sdcard/smartsignage-ad 2>/dev/null || true
  adb push "$CONFIG" /sdcard/smartsignage-ad/app-config.json
fi

echo "Concluído. Pacote: $PKG"
