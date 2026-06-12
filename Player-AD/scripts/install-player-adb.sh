#!/usr/bin/env bash
# Linux/macOS. No Windows use: Player-AD\instalar-dispositivo.cmd ou scripts\install-player-adb.ps1
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
  echo "Buscando APK (release, senão debug)..."
  APK_PATH="$(ls -1t "$APP_ROOT/build/outputs/apk/release/"*.apk 2>/dev/null | head -n 1 || true)"
  if [[ -z "$APK_PATH" || ! -f "$APK_PATH" ]]; then
    echo "Compilando release..."
    if [[ -x "$APP_ROOT/gradlew" ]]; then
      (cd "$APP_ROOT" && ./gradlew assembleRelease --no-daemon) || true
    elif command -v gradle >/dev/null 2>&1; then
      (cd "$APP_ROOT" && gradle assembleRelease) || true
    fi
    APK_PATH="$(ls -1t "$APP_ROOT/build/outputs/apk/release/"*.apk 2>/dev/null | head -n 1 || true)"
  fi
  if [[ -z "$APK_PATH" || ! -f "$APK_PATH" ]]; then
    echo "Release indisponível ou falhou (ex.: mergeReleaseResources); compilando debug..."
    if [[ ! -x "$APP_ROOT/gradlew" ]]; then chmod +x "$APP_ROOT/gradlew"; fi
    (cd "$APP_ROOT" && ./gradlew assembleDebug --no-daemon)
    APK_PATH="$(ls -1t "$APP_ROOT/build/outputs/apk/debug/"*.apk 2>/dev/null | head -n 1 || true)"
  fi
fi

if [[ -z "$APK_PATH" || ! -f "$APK_PATH" ]]; then
  echo "❌ APK não encontrado. Informe o caminho do APK como 1º argumento."
  exit 1
fi

echo "APK: $APK_PATH"
adb devices | sed -n '1,3p'

echo "Instalando APK..."
if ! adb install -r -d -g "$APK_PATH"; then
  adb uninstall br.com.smartchannel.playerad 2>/dev/null || true
  adb install -r -d -g "$APK_PATH"
fi

if [[ -n "$CONFIG_JSON_PATH" ]]; then
  if [[ ! -f "$CONFIG_JSON_PATH" ]]; then
    echo "❌ config json não encontrado: $CONFIG_JSON_PATH"
    exit 1
  fi
  echo "Enviando config para /sdcard/smartsignage/player-config.json ..."
  adb shell "mkdir -p /sdcard/smartsignage" >/dev/null 2>&1 || true
  adb push "$CONFIG_JSON_PATH" "/sdcard/smartsignage/player-config.json"
fi

KIOSK_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/configure-android-kiosk.sh"
if [[ -x "$KIOSK_SCRIPT" ]]; then
  echo "Provisionando kiosk Android (portrait + launcher)..."
  bash "$KIOSK_SCRIPT" --rotation "${USER_ROTATION:-1}"
elif [[ -f "$KIOSK_SCRIPT" ]]; then
  bash "$KIOSK_SCRIPT" --rotation "${USER_ROTATION:-1}"
fi

echo "✅ Instalação concluída."
echo "Abrir o app: SmartSignage Player-AD (ou reiniciar a TV)."

