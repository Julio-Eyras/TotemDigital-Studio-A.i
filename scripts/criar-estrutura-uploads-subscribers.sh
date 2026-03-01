#!/usr/bin/env bash
# Cria a estrutura uploads/subscriber-X/medias para todos os subscribers
# que possuem mídias no banco. Útil para garantir permissões antes de uploads.
# Uso: ./scripts/criar-estrutura-uploads-subscribers.sh

set -e

UPLOADS_BASE="${UPLOAD_PATH:-/opt/smart-signage/public/assets/uploads}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Base de uploads: $UPLOADS_BASE"

if [[ ! -d "$UPLOADS_BASE" ]]; then
  echo "Criando diretório base: $UPLOADS_BASE"
  mkdir -p "$UPLOADS_BASE"
fi

# Se existir .env no backend com UPLOAD_PATH, usar
if [[ -f "$PROJECT_ROOT/backend/.env" ]]; then
  source "$PROJECT_ROOT/backend/.env" 2>/dev/null || true
  if [[ -n "$UPLOAD_PATH" ]]; then
    UPLOADS_BASE="$UPLOAD_PATH"
    echo "Usando UPLOAD_PATH do backend/.env: $UPLOADS_BASE"
  fi
fi

# Lista de subscriber_id que têm mídia no banco (fallback se não tiver psql)
# Você pode substituir pela consulta ao PostgreSQL se preferir.
SUBSCRIBER_IDS=""

if command -v psql &>/dev/null; then
  # Tenta obter do banco (variáveis de ambiente ou .env)
  DB_URL="${DATABASE_URL:-}"
  if [[ -z "$DB_URL" && -f "$PROJECT_ROOT/backend/.env" ]]; then
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5432}"
    DB_NAME="${DB_NAME:-smartchannel}"
    DB_USER="${DB_USER:-smartchannel}"
    DB_PASS="${DB_PASSWORD:-}"
    if [[ -n "$DB_PASS" ]]; then
      export PGPASSWORD="$DB_PASS"
    fi
    SUBSCRIBER_IDS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT DISTINCT subscriber_id FROM medias WHERE is_active IS NOT DISTINCT FROM true ORDER BY 1;" 2>/dev/null || true)
    unset PGPASSWORD 2>/dev/null || true
  elif [[ -n "$DB_URL" ]]; then
    SUBSCRIBER_IDS=$(psql "$DB_URL" -t -A -c "SELECT DISTINCT subscriber_id FROM medias WHERE is_active IS NOT DISTINCT FROM true ORDER BY 1;" 2>/dev/null || true)
  fi
fi

if [[ -z "$SUBSCRIBER_IDS" ]]; then
  echo "Não foi possível conectar ao banco ou não há medias. Criando pastas para subscriber-1 a subscriber-20 por padrão."
  for i in $(seq 1 20); do
    SUBSCRIBER_IDS="$SUBSCRIBER_IDS $i"
  done
fi

count=0
for sid in $SUBSCRIBER_IDS; do
  sid=$(echo "$sid" | tr -d ' ')
  [[ -z "$sid" ]] && continue
  dir="$UPLOADS_BASE/subscriber-$sid/medias"
  if [[ ! -d "$dir" ]]; then
    mkdir -p "$dir"
    echo "  Criado: $dir"
    ((count++)) || true
  fi
done

if [[ $count -eq 0 && -n "$SUBSCRIBER_IDS" ]]; then
  echo "Estrutura já existia ou nenhuma pasta criada."
else
  echo "Pronto. Pastas criadas/verificadas. Ajuste permissões se necessário:"
  echo "  sudo chown -R smartchannel:www-data $UPLOADS_BASE"
  echo "  sudo chmod -R 755 $UPLOADS_BASE"
fi
