#!/usr/bin/env bash
# Empacota player-linux num .deb com timestamps fixos (SOURCE_DATE_EPOCH).
# Correr em WSL/Ubuntu a partir de Player-Linux/.
set -euo pipefail
export LC_ALL=C
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${VERSION:-0.1.0}"
ARCH="${ARCH:-amd64}"
if [[ -z "${SOURCE_DATE_EPOCH:-}" ]]; then
  SOURCE_DATE_EPOCH="$(git -C "$ROOT/.." log -1 --pretty=%ct 2>/dev/null || echo 1700000000)"
fi
export SOURCE_DATE_EPOCH

BUILD="${ROOT}/build-deb"
DEST="$(mktemp -d /tmp/player-linux-deb.XXXXXX)"
cleanup() { rm -rf "$DEST"; }
trap cleanup EXIT
OUT="${ROOT}/player-linux_${VERSION}_${ARCH}.deb"
cmake -S "$ROOT" -B "${BUILD}/cmake" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX=/opt/player-linux
cmake --build "${BUILD}/cmake" --target player-linux -j"$(nproc)"

BIN="${BUILD}/cmake/player-linux"
if [[ ! -x "$BIN" ]]; then
  echo "binário em falta: $BIN" >&2
  exit 1
fi
strip --strip-unneeded "$BIN" 2>/dev/null || true

mkdir -p "$DEST/opt/player-linux/bin" \
  "$DEST/opt/player-linux/share" \
  "$DEST/lib/systemd/system" \
  "$DEST/usr/share/player-linux" \
  "$DEST/DEBIAN"

install -m 0755 "$BIN" "$DEST/opt/player-linux/bin/player-linux"
install -m 0644 "$ROOT/config/exemplo-player-config.json" "$DEST/usr/share/player-linux/exemplo-player-config.json"
install -m 0644 "$ROOT/scripts/player-linux.service" "$DEST/lib/systemd/system/player-linux.service"
install -m 0755 "$ROOT/scripts/kiosk-escape.sh" "$DEST/opt/player-linux/bin/kiosk-escape.sh"
install -m 0755 "$ROOT/scripts/apply-branding.sh" "$DEST/opt/player-linux/bin/apply-branding.sh"
install -m 0755 "$ROOT/scripts/player-linux-xsession.sh" "$DEST/opt/player-linux/share/player-linux-xsession.sh"
if [[ -f "$ROOT/scripts/player-linux.desktop" ]]; then
  mkdir -p "$DEST/etc/xdg/autostart"
  install -m 0644 "$ROOT/scripts/player-linux.desktop" "$DEST/etc/xdg/autostart/player-linux.desktop"
fi

cat > "$DEST/DEBIAN/control" <<EOF
Package: player-linux
Version: ${VERSION}
Section: misc
Priority: optional
Architecture: ${ARCH}
Depends: libc6, libcurl4
Recommends: gstreamer1.0-plugins-good, chromium, zenity | x11-utils
Maintainer: TotemDigital Lab <lab@local>
Description: Player-Linux (parity Player-AD 2.15)
 Kiosk de sinalização digital. Instalar binário e unidade systemd juntos.
EOF

cat > "$DEST/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e
DATA=/var/lib/player-linux
if ! id playerlinux >/dev/null 2>&1; then
  useradd --system --home "$DATA" --shell /usr/sbin/nologin playerlinux || true
fi
mkdir -p "$DATA/propagandas" "$DATA/vinhetas" "$DATA/ota" "$DATA/screenshots" "$DATA/telemetry" "$DATA/branding"
if [ ! -f "$DATA/player-config.json" ] && [ -f /usr/share/player-linux/exemplo-player-config.json ]; then
  cp /usr/share/player-linux/exemplo-player-config.json "$DATA/player-config.json"
fi
chown -R playerlinux:playerlinux "$DATA" 2>/dev/null || true
if command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload || true
  systemctl enable player-linux.service || true
fi
EOF

cat > "$DEST/DEBIAN/prerm" <<'EOF'
#!/bin/sh
set -e
if [ "$1" = "remove" ] && command -v systemctl >/dev/null 2>&1; then
  systemctl stop player-linux.service 2>/dev/null || true
fi
EOF

chmod 0755 "$DEST/DEBIAN/postinst" "$DEST/DEBIAN/prerm"
chmod 0755 "$DEST/DEBIAN"
chmod 0644 "$DEST/DEBIAN/control"
find "$DEST" -type d -exec chmod 0755 {} +
chmod 0755 "$DEST/opt/player-linux/bin/player-linux" \
  "$DEST/opt/player-linux/bin/kiosk-escape.sh" \
  "$DEST/opt/player-linux/bin/apply-branding.sh" \
  "$DEST/opt/player-linux/share/player-linux-xsession.sh" \
  "$DEST/DEBIAN/postinst" "$DEST/DEBIAN/prerm"

(
  cd "$DEST"
  find opt usr lib etc -type f 2>/dev/null | LC_ALL=C sort | while read -r f; do
    md5sum "$f"
  done
) > "$DEST/DEBIAN/md5sums"
chmod 0644 "$DEST/DEBIAN/md5sums"

find "$DEST" -exec touch -h -d "@${SOURCE_DATE_EPOCH}" {} +
dpkg-deb --root-owner-group -Zgzip -z9 --build "$DEST" "$OUT"
echo "SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}"
echo "deb: $OUT"
sha256sum "$OUT"
