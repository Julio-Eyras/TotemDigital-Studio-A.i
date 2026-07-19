#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLAYER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_CONFIG="$SCRIPT_DIR/generate-default-player-config.json"
PROPAGANDA_PATTERN="${PROPAGANDA_PATTERN:-}"
VINHETA_PATTERN="${VINHETA_PATTERN:-}"
UNINSTALL_FIRST=0
APP_ID="br.com.smartchannel.playerad"

# Retorna quantidade de linhas "device" em adb devices
count_adb_devices() {
  adb devices 2>/dev/null | awk 'NR>1 && $2=="device" { c++ } END { print c+0 }'
}

# Aguarda pelo menos um device online (USB instável costuma sumir após stream install)
wait_for_adb_device() {
  local max_sec="${1:-90}"
  local i=0
  adb start-server >/dev/null 2>&1 || true
  while [[ "$i" -lt "$max_sec" ]]; do
    if [[ "$(count_adb_devices)" -ge 1 ]]; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

echo "== Auto Install Player-AD =="

if ! command -v adb >/dev/null 2>&1; then
  echo "❌ adb não encontrado no PATH."
  echo "   Instale android-platform-tools e tente novamente."
  exit 1
fi

# Parse de argumentos opcionais:
# --propaganda "/caminho/propaganda-*.mp4"
# --vinheta    "/caminho/vinheta-*.mp4"
# --uninstall-first  desinstala o pacote antes de instalar (útil se assinatura mudou)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --propaganda)
      PROPAGANDA_PATTERN="${2:-}"
      shift 2
      ;;
    --vinheta)
      VINHETA_PATTERN="${2:-}"
      shift 2
      ;;
    --uninstall-first)
      UNINSTALL_FIRST=1
      shift 1
      ;;
    *)
      echo "Uso: $0 [--uninstall-first] [--propaganda \"...\"] [--vinheta \"...\"]"
      exit 1
      ;;
  esac
done

# 1) Detectar Android SDK
SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "${SDK_DIR}" ]]; then
  if [[ -d "$HOME/Android/Sdk" ]]; then
    SDK_DIR="$HOME/Android/Sdk"
  elif [[ -d "/opt/android-sdk" ]]; then
    SDK_DIR="/opt/android-sdk"
  fi
fi

if [[ -z "${SDK_DIR}" || ! -d "${SDK_DIR}" ]]; then
  echo "❌ Android SDK não encontrado."
  echo "   Defina ANDROID_HOME ou ANDROID_SDK_ROOT (ex.: $HOME/Android/Sdk)."
  exit 1
fi

echo "✔ SDK: $SDK_DIR"

# 2) Gerar local.properties automático
cat > "$PLAYER_DIR/local.properties" <<EOF
sdk.dir=$SDK_DIR
EOF
echo "✔ local.properties gerado em $PLAYER_DIR/local.properties"

# 3) Garantir gradle wrapper
if [[ ! -x "$PLAYER_DIR/gradlew" ]]; then
  echo "❌ gradlew não encontrado em $PLAYER_DIR."
  echo "   Gere o wrapper antes (Gradle 8.7)."
  exit 1
fi

# 4) Build release
echo "== Compilando APK release =="
(cd "$PLAYER_DIR" && ./gradlew clean assembleRelease)

# APK assinado (sem sufixo -unsigned). Sem signingConfig no Gradle o adb falha com INSTALL_PARSE_FAILED_NO_CERTIFICATES.
APK_PATH="$(ls -1t "$PLAYER_DIR"/build/outputs/apk/release/*release.apk 2>/dev/null | grep -v -- '-unsigned.apk' | head -n 1 || true)"
if [[ -z "$APK_PATH" || ! -f "$APK_PATH" ]]; then
  echo "❌ APK release assinado não encontrado em build/outputs/apk/release."
  echo "   Confira se build.gradle (release) tem signingConfig (ex.: signingConfigs.debug para dev)."
  exit 1
fi

echo "✔ APK: $APK_PATH"

# 5) Instalar via adb
echo "== Instalando APK via adb =="
if ! wait_for_adb_device 90; then
  echo "❌ Nenhum dispositivo adb em até 90s."
  echo "   Verifique cabo USB, porta (evite hub), depur USB e rode: adb devices"
  exit 1
fi
adb devices
if [[ "$UNINSTALL_FIRST" -eq 1 ]]; then
  echo "   (--uninstall-first) removendo pacote existente, se houver..."
  adb uninstall "$APP_ID" >/dev/null 2>&1 || true
fi

set +e
INSTALL_RC=1
INSTALL_OUT=""
for attempt in 1 2 3 4 5; do
  if ! wait_for_adb_device 30; then
    echo "   ⚠ Tentativa $attempt/5: adb sem device; reiniciando servidor adb..."
    adb kill-server >/dev/null 2>&1 || true
    sleep 2
    adb start-server >/dev/null 2>&1 || true
    wait_for_adb_device 45 || true
  fi
  echo ""
  echo "   Tentativa $attempt/5: adb install -r -d -g ..."
  # Captura stdout+stderr para não misturar com próxima linha e para ver Failure [...] completo
  INSTALL_OUT="$(adb install -r -d -g "$APK_PATH" 2>&1)"
  INSTALL_RC=$?
  echo "$INSTALL_OUT"
  if [[ $INSTALL_RC -eq 0 ]]; then
    break
  fi
  if echo "$INSTALL_OUT" | grep -qi "no devices"; then
    echo "   ⚠ Device sumiu durante install — reiniciando adb e aguardando..."
    adb kill-server >/dev/null 2>&1 || true
    sleep 2
    adb start-server >/dev/null 2>&1 || true
  fi
  echo "   (aguardando 6s antes da próxima tentativa...)"
  sleep 6
done
set -e

if [[ $INSTALL_RC -ne 0 ]]; then
  echo ""
  echo "❌ adb install falhou após 5 tentativas (código: $INSTALL_RC)."
  echo "   Última saída:"
  echo "$INSTALL_OUT" | sed 's/^/   | /'
  echo ""
  echo "   Rode manualmente com device estável:"
  echo "     adb devices"
  echo "     adb install -r -d -g \"$APK_PATH\""
  echo ""
  echo "   Causas frequentes:"
  echo "   • USB/cabo/porta instável (device some → 'no devices/emulators found')"
  echo "   • INSTALL_FAILED_UPDATE_INCOMPATIBLE → adb uninstall $APP_ID && adb install ..."
  echo "     ou:  $0 --uninstall-first"
  echo "   • Pouco espaço no dispositivo"
  exit "$INSTALL_RC"
fi
echo "✔ APK instalado."

# 6) Enviar configuração padrão (se existir)
if [[ -f "$DEFAULT_CONFIG" ]]; then
  echo "== Enviando player-config padrão =="
  adb shell "mkdir -p /sdcard/smartsignage" >/dev/null 2>&1 || true
  adb push "$DEFAULT_CONFIG" "/sdcard/smartsignage/player-config.json"
  echo "✔ Config enviada para /sdcard/smartsignage/player-config.json"
fi

echo "✅ Auto install concluído."
echo "   Abra o app na Android TV ou reinicie o dispositivo para testar boot auto-start."

# 7) (Opcional) push direto de múltiplas propagandas/vinhetas para storage externo do app
if [[ -n "$PROPAGANDA_PATTERN" || -n "$VINHETA_PATTERN" ]]; then
  echo "== Enviando mídias opcionais para storage externo do app =="
  adb shell "mkdir -p /sdcard/Android/data/br.com.smartchannel.playerad/files/propagandas" >/dev/null 2>&1 || true
  adb shell "mkdir -p /sdcard/Android/data/br.com.smartchannel.playerad/files/vinhetas" >/dev/null 2>&1 || true

  if [[ -n "$PROPAGANDA_PATTERN" ]]; then
    mapfile -t PROPAGANDA_FILES < <(compgen -G "$PROPAGANDA_PATTERN" || true)
    if [[ ${#PROPAGANDA_FILES[@]} -eq 0 ]]; then
      echo "❌ Nenhum arquivo de propaganda encontrado para: $PROPAGANDA_PATTERN"
      exit 1
    fi
    for f in "${PROPAGANDA_FILES[@]}"; do
      adb push "$f" "/sdcard/Android/data/br.com.smartchannel.playerad/files/propagandas/"
    done
    echo "✔ Propagandas enviadas: ${#PROPAGANDA_FILES[@]} arquivo(s)."
  fi

  if [[ -n "$VINHETA_PATTERN" ]]; then
    mapfile -t VINHETA_FILES < <(compgen -G "$VINHETA_PATTERN" || true)
    if [[ ${#VINHETA_FILES[@]} -eq 0 ]]; then
      echo "❌ Nenhum arquivo de vinheta encontrado para: $VINHETA_PATTERN"
      exit 1
    fi
    for f in "${VINHETA_FILES[@]}"; do
      adb push "$f" "/sdcard/Android/data/br.com.smartchannel.playerad/files/vinhetas/"
    done
    echo "✔ Vinhetas enviadas: ${#VINHETA_FILES[@]} arquivo(s)."
  fi
fi

