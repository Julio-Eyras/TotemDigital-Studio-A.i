#!/usr/bin/env bash
# Copia o Player-AD release do kit git e designa-o como APK oficial (produção).
# Não apaga a BD. Idempotente.
set -euo pipefail

REPO=""
BACKEND_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --backend-dir) BACKEND_DIR="$2"; shift 2 ;;
    -h|--help)
      echo "Uso: $0 --repo <clone> --backend-dir <pasta-backend>"
      echo "Requer: DB_NAME, DB_USER, PGPASSWORD (ou DB_PASSWORD). Opcional: DB_HOST DB_PORT"
      exit 0
      ;;
    *) echo "Argumento inválido: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$REPO" && -n "$BACKEND_DIR" ]] || {
  echo "Uso: $0 --repo <clone> --backend-dir <pasta-backend>" >&2
  exit 2
}

APK=""
# Preferir nome versionado Player-AD-Vs{ver}-build-{code}.apk
shopt -s nullglob
CANDIDATES=( "$REPO"/install-pendrive/apk/Player-AD-Vs*-build-*.apk )
shopt -u nullglob
if ((${#CANDIDATES[@]} > 0)); then
  # Mais recente por mtime
  APK="$(ls -1t "${CANDIDATES[@]}" | head -n 1)"
elif [[ -f "$REPO/install-pendrive/apk/Player-AD-release.apk" ]]; then
  APK="$REPO/install-pendrive/apk/Player-AD-release.apk"
fi
if [[ -z "$APK" || ! -f "$APK" ]]; then
  echo "[AVISO] APK oficial ausente no git (Player-AD-Vs*-build-*.apk)"
  exit 0
fi

VER="2.14"
CODE="114"
GRADLE="$REPO/Player-AD/build.gradle"
if [[ -f "$GRADLE" ]]; then
  VER="$(grep -E "versionName" "$GRADLE" | head -n1 | sed -E "s/.*versionName[[:space:]]+'([^']+)'.*/\1/" || true)"
  CODE="$(grep -E "versionCode" "$GRADLE" | head -n1 | sed -E "s/.*versionCode[[:space:]]+([0-9]+).*/\1/" || true)"
  VER="${VER:-2.14}"
  CODE="${CODE:-114}"
fi

APK_BASENAME="$(basename "$APK")"
# Se o ficheiro ainda for o legado, normalizar o nome na cópia OTA
if [[ "$APK_BASENAME" == "Player-AD-release.apk" ]]; then
  APK_BASENAME="Player-AD-Vs${VER}-build-${CODE}.apk"
fi

DEST_DIR="$BACKEND_DIR/uploads/ota-updates"
DEST="$DEST_DIR/$APK_BASENAME"
INSTALLER_SRC="$REPO/install-pendrive/apk/Instala-Player-TotemDigital.apk"
INSTALLER_DEST="$DEST_DIR/Instala-Player-TotemDigital.apk"
copy_apk() {
  local src="$1" dest="$2"
  local dest_dir
  dest_dir="$(dirname "$dest")"
  if mkdir -p "$dest_dir" 2>/dev/null && [[ -w "$dest_dir" ]]; then
    cp -f "$src" "$dest"
  else
    sudo mkdir -p "$dest_dir"
    sudo cp -f "$src" "$dest"
    sudo chmod a+r "$dest"
  fi
}
copy_apk "$APK" "$DEST"
if [[ -f "$INSTALLER_SRC" ]]; then
  copy_apk "$INSTALLER_SRC" "$INSTALLER_DEST"
  echo "[OK] Instalador copiado — ${INSTALLER_DEST}"
else
  echo "[AVISO] Instala-Player-TotemDigital.apk ausente no kit git"
fi

SIZE="$(stat -c%s "$DEST" 2>/dev/null || stat -f%z "$DEST")"
SHA="$(sha256sum "$DEST" | awk '{print $1}')"

DB_NAME="${DB_NAME:-}"
DB_USER="${DB_USER:-}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
export PGPASSWORD="${PGPASSWORD:-${DB_PASSWORD:-}}"

if [[ -z "$DB_NAME" || -z "$DB_USER" || -z "$PGPASSWORD" ]]; then
  echo "[AVISO] DB_NAME/DB_USER/PGPASSWORD em falta — APK copiado para $DEST mas não designado na BD."
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[AVISO] psql não encontrado — APK em $DEST sem designação."
  exit 0
fi

# Escape mínimo para literais SQL
sql_escape() {
  printf '%s' "${1//\'/\'\'}"
}

DEST_SQL="$(sql_escape "$DEST")"
SHA_SQL="$(sql_escape "$SHA")"
VER_SQL="$(sql_escape "$VER")"
APK_BASENAME_SQL="$(sql_escape "$APK_BASENAME")"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE
  v_id INTEGER;
  v_owner INTEGER;
BEGIN
  SELECT id INTO v_owner
  FROM users
  WHERE lower(role::text) IN ('owner_system', 'admin_sql', 'admin')
  ORDER BY id
  LIMIT 1;

  UPDATE ota_updates
  SET
    file_path = '${DEST_SQL}',
    file_size = ${SIZE},
    checksum = '${SHA_SQL}',
    version_code = ${CODE},
    original_filename = '${APK_BASENAME_SQL}',
    package_name = 'br.com.smartchannel.playerad',
    status = 'active',
    is_active = true,
    released_at = COALESCE(released_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP,
    description = 'Player-AD oficial (kit git, assembleRelease, debuggable=false)'
  WHERE id = (
    SELECT id FROM ota_updates
    WHERE platform = 'android' AND version = '${VER_SQL}'
    ORDER BY id DESC
    LIMIT 1
  )
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    INSERT INTO ota_updates (
      version, version_code, platform, package_name, original_filename,
      file_path, file_size, checksum, description, status, is_active, released_at, created_by
    ) VALUES (
      '${VER_SQL}', ${CODE}, 'android', 'br.com.smartchannel.playerad', '${APK_BASENAME_SQL}',
      '${DEST_SQL}', ${SIZE}, '${SHA_SQL}',
      'Player-AD oficial (kit git, assembleRelease, debuggable=false)',
      'active', true, CURRENT_TIMESTAMP, v_owner
    )
    RETURNING id INTO v_id;
  END IF;

  INSERT INTO player_release_channels (
    platform, channel, designated_update_id, designated_by, designated_at
  ) VALUES (
    'android', 'production', v_id, v_owner, CURRENT_TIMESTAMP
  )
  ON CONFLICT (platform, channel) DO UPDATE SET
    designated_update_id = EXCLUDED.designated_update_id,
    designated_by = EXCLUDED.designated_by,
    designated_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP;
END
\$\$;
SQL

echo "[OK] Player-AD ${VER} (${CODE}) designado — ${DEST} (${SIZE} bytes)"
if [[ -f "$INSTALLER_DEST" ]]; then
  echo "[OK] Download do instalador (boot logo + Player-AD): ${INSTALLER_DEST}"
fi
