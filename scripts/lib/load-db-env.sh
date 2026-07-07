#!/usr/bin/env bash
# Carrega só variáveis de PostgreSQL do .env (sem `source` completo — evita linhas com espaços).
load_db_env_from_file() {
  local env_file="${1:-}"
  [[ -f "$env_file" ]] || return 0

  local line key val
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" ]] && continue
    [[ "$line" != *"="* ]] && continue

    key="${line%%=*}"
    val="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#"${key%%[![:space:]]*}"}"

    case "$key" in
      DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD|PGPASSWORD)
        if [[ "$val" =~ ^\".*\"$ ]]; then
          val="${val:1:${#val}-2}"
        elif [[ "$val" =~ ^\'.*\'$ ]]; then
          val="${val:1:${#val}-2}"
        fi
        export "$key=$val"
        ;;
    esac
  done < <(grep -E '^(DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD|PGPASSWORD)=' "$env_file" 2>/dev/null || true)
}
