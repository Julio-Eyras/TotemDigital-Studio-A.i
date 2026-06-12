#!/usr/bin/env bash
# Provisiona Android TV/box para totem vertical + kiosk após instalar Player-AD.
# Uso: configure-android-kiosk.sh [--rotation 1] [--no-home] [--no-immersive-policy]
set -euo pipefail

PACKAGE_ID="${PACKAGE_ID:-br.com.smartchannel.playerad}"
MAIN_ACTIVITY="${MAIN_ACTIVITY:-br.com.smartchannel.playerad/.ui.MainActivity}"
# 0=0°, 1=90° (portrait típico em painel landscape), 2=180°, 3=270°
USER_ROTATION="${USER_ROTATION:-1}"
SET_HOME=true
IMMERSIVE_POLICY=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rotation)
      USER_ROTATION="${2:-1}"
      shift 2
      ;;
    --no-home)
      SET_HOME=false
      shift
      ;;
    --no-immersive-policy)
      IMMERSIVE_POLICY=false
      shift
      ;;
    -h|--help)
      echo "Uso: $0 [--rotation 0|1|2|3] [--no-home] [--no-immersive-policy]"
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $1" >&2
      exit 1
      ;;
  esac
done

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
  echo "⚠ $label (ignorado — pode não ser suportado neste fabricante)"
  return 1
}

echo "== Player-AD: provisionamento kiosk Android =="
echo "Pacote: $PACKAGE_ID"
echo "Rotação user_rotation=$USER_ROTATION"

run_setting "Desativar rotação automática" settings put system accelerometer_rotation 0 || true
run_setting "Fixar orientação portrait (user_rotation)" settings put system user_rotation "$USER_ROTATION" || true

if [[ "$IMMERSIVE_POLICY" == "true" ]]; then
  run_setting "Política immersive.full (barras ocultas)" settings put global policy_control immersive.full=* || true
fi

run_setting "Manter tela ligada com energia" settings put global stay_on_while_plugged_in 3 || true

if [[ "$SET_HOME" == "true" ]]; then
  if adb shell cmd package set-home-activity "$MAIN_ACTIVITY" 2>/dev/null | grep -qi "success\|Success"; then
    echo "✔ Launcher padrão: $MAIN_ACTIVITY"
  elif adb shell cmd package set-home-activity "$MAIN_ACTIVITY" >/dev/null 2>&1; then
    echo "✔ Launcher padrão: $MAIN_ACTIVITY"
  else
    echo "⚠ Launcher padrão não definido (execute manualmente ou confirme no 1º boot)"
  fi
fi

# Lock task whitelist — só funciona com device owner / perfil gerido
if adb shell dpm set-lock-task-packages "$PACKAGE_ID" "$PACKAGE_ID" 2>/dev/null; then
  echo "✔ Lock task whitelist (device owner)"
else
  echo "⚠ Lock task whitelist indisponível (normal sem device owner; app usa startLockTask se permitido)"
fi

echo "✅ Provisionamento kiosk concluído."
