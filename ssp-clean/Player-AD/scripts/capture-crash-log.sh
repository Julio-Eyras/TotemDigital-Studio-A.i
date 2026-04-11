#!/usr/bin/env bash
# Captura logs úteis quando o app "para" ou fecha sozinho (não exige ripgrep).
set -euo pipefail

PKG="br.com.smartchannel.playerad"

echo "Limpando buffer..."
adb logcat -c

echo "Iniciando $PKG ..."
adb shell am force-stop "$PKG" 2>/dev/null || true
adb shell am start -n "$PKG/.ui.MainActivity" || true

echo "Aguarde ~5s reproduzindo o erro na TV..."
sleep 5

echo "========== logcat (erros + AndroidRuntime + $PKG) =========="
adb logcat -d -v time | grep -iE "AndroidRuntime|FATAL EXCEPTION|Caused by|$PKG|Player-AD|ExoPlayer|Media3" || true

echo ""
echo "========== buffer crash (Android 7+) =========="
adb logcat -b crash -d -v time 2>/dev/null || echo "(buffer crash indisponível neste device)"
