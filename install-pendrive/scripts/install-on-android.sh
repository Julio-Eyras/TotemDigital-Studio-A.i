#!/system/bin/sh
# Player-AD — instalação a partir do pendrive no próprio Android.
#
# Sem root: use o gestor de ficheiros e toque no APK em apk/ (método recomendado).
# Com root:   su -c "sh /caminho/do/pendrive/install-pendrive/scripts/install-on-android.sh"
# Via ADB:    adb shell su -c "sh /mnt/media_rw/XXXX/install-pendrive/scripts/install-on-android.sh"

log() { echo "[install-pendrive] $*"; }

find_base() {
  # Layout: USB/install-pendrive/apk/
  for _root in /storage/usbotg /mnt/usb_storage /mnt/usb; do
    [ -e "$_root" ] || continue
    if [ -d "$_root/install-pendrive/apk" ]; then
      echo "$_root/install-pendrive"
      return 0
    fi
  done
  # Volumes com rótulo (ex.: /mnt/media_rw/ABCD-1234)
  for _root in /mnt/media_rw/*; do
    [ -e "$_root" ] || continue
    if [ -d "$_root/install-pendrive/apk" ]; then
      echo "$_root/install-pendrive"
      return 0
    fi
  done
  # Conteúdo copiado para a raiz do USB (apk/ + LEIA-ME na raiz)
  for _root in /storage/usbotg /mnt/usb_storage /mnt/media_rw/*; do
    [ -e "$_root" ] || continue
    if [ -d "$_root/apk" ]; then
      echo "$_root"
      return 0
    fi
  done
  return 1
}

BASE="$(find_base)" || BASE=""
if [ -z "$BASE" ]; then
  log "Pasta não encontrada. Procure o USB: ls /storage /mnt/usb_storage /mnt/media_rw"
  log "Esperado: .../install-pendrive/apk/*.apk ou .../apk/*.apk na raiz do pendrive."
  exit 1
fi

APK=""
for f in "$BASE"/apk/*.apk; do
  if [ -f "$f" ]; then
    APK="$f"
    break
  fi
done

if [ -z "$APK" ]; then
  log "Nenhum .apk em $BASE/apk/"
  exit 1
fi

log "APK: $APK"

if command -v su >/dev/null 2>&1 && su -c "id" >/dev/null 2>&1; then
  log "Instalando com su (root)..."
  su -c "pm install -r -d -g \"$APK\""
  exit $?
fi

log "Sem root: abra o gestor de ficheiros em $BASE/apk/ e toque no .apk"
log "Ou ligue o aparelho ao PC e use: bash scripts/install-from-pc-adb.sh"
exit 1
