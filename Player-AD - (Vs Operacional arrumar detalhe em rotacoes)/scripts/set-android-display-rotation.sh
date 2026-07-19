#!/usr/bin/env bash
# Ajusta rotação física do display via ADB — independente do Player-AD.
# Uso: set-android-display-rotation.sh [0|1|2|3]
#   1 = 90° portrait (padrão totem em painel landscape)
set -euo pipefail

USER_ROTATION="${1:-1}"
if [[ ! "$USER_ROTATION" =~ ^[0-3]$ ]]; then
  echo "Uso: $0 [0|1|2|3]" >&2
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "❌ adb não encontrado no PATH." >&2
  exit 1
fi

run_setting() {
  local label="$1"
  shift
  if adb shell "$@" >/dev/null 2>&1; then
    echo "✔ $label"
    return 0
  fi
  if adb shell "su -c '$*'" >/dev/null 2>&1; then
    echo "✔ $label (via su)"
    return 0
  fi
  echo "⚠ $label (falhou — fabricante pode bloquear settings)"
  return 1
}

echo "== Rotação de display via ADB (user_rotation=$USER_ROTATION) =="

run_setting "Desativar rotação automática" settings put system accelerometer_rotation 0 || true
run_setting "Fixar user_rotation" settings put system user_rotation "$USER_ROTATION" || true

USER_ROT=$(adb shell settings get system user_rotation 2>/dev/null | tr -d '\r')
ACCEL=$(adb shell settings get system accelerometer_rotation 2>/dev/null | tr -d '\r')

echo "Estado atual: user_rotation=${USER_ROT:-?} accelerometer_rotation=${ACCEL:-?}"

if [[ "$USER_ROT" == "$USER_ROTATION" && "$ACCEL" == "0" ]]; then
  echo "✅ Portrait confirmado no SO."
  exit 0
fi

echo "⚠ Portrait não confirmado. Use diagnose-android-box.ps1 ou menu de fábrica da box."
exit 1
