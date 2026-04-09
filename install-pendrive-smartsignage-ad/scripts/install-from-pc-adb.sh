#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

command -v adb >/dev/null 2>&1 || { echo "adb nao encontrado"; exit 1; }
APK="$(ls -1t "$ROOT"/apk/*.apk 2>/dev/null | head -n 1 || true)"
[[ -n "$APK" && -f "$APK" ]] || { echo "Nenhum APK em $ROOT/apk"; exit 1; }

adb install -r -d -g "$APK" || {
  adb uninstall br.com.smartchannel.smartsignagead || true
  adb install -r -d -g "$APK"
}

if [[ -f "$ROOT/config/app-config.example.json" ]]; then
  adb shell "mkdir -p /sdcard/smartsignage-ad" >/dev/null 2>&1 || true
  adb push "$ROOT/config/app-config.example.json" /sdcard/smartsignage-ad/app-config.json
fi

echo "Concluido."
