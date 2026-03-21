#!/usr/bin/env bash
set -euo pipefail

PLAYER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="$PLAYER_DIR"

APK_PATH="${1:-}"
CONFIG_JSON_PATH="${2:-}"

echo "== Player-AD install via adb =="

if ! command -v adb >/dev/null 2>&1; then
  echo "❌ 'adb' não encontrado no PATH."
  exit 1
fi

if [[ -z "$APK_PATH" ]]; then
  echo "Buscando APK release..."
  # Se Gradle estiver disponível e o build ainda não tiver acontecido, tenta build.
  if [[ ! -d "$APP_ROOT/build/outputs/apk/release" ]]; then
    echo "Tentando build release..."
    if [[ -x "$APP_ROOT/gradlew" ]]; then
      (cd "$APP_ROOT" && ./gradlew assembleRelease)
    elif command -v gradle >/dev/null 2>&1; then
      (cd "$APP_ROOT" && gradle assembleRelease)
    else
      echo "❌ Nem ./gradlew nem 'gradle' encontrados. Gere o APK via Android Studio/Gradle."
      exit 1
    fi
  fi
  APK_PATH="$(ls -1t "$APP_ROOT/build/outputs/apk/release/"*.apk 2>/dev/null | head -n 1 || true)"
fi

if [[ -z "$APK_PATH" || ! -f "$APK_PATH" ]]; then
  echo "❌ APK não encontrado. Informe o caminho do APK como 1º argumento."
  exit 1
fi

echo "APK: $APK_PATH"
adb devices | sed -n '1,3p'

echo "Instalando APK..."
adb install -r "$APK_PATH"

if [[ -n "$CONFIG_JSON_PATH" ]]; then
  if [[ ! -f "$CONFIG_JSON_PATH" ]]; then
    echo "❌ config json não encontrado: $CONFIG_JSON_PATH"
    exit 1
  fi
  echo "Enviando config para /sdcard/smartsignage/player-config.json ..."
  adb shell "mkdir -p /sdcard/smartsignage" >/dev/null 2>&1 || true
  adb push "$CONFIG_JSON_PATH" "/sdcard/smartsignage/player-config.json"
fi

echo "✅ Instalação concluída."
echo "Abrir o app: SmartSignage Player-AD (ou reiniciar a TV)."

