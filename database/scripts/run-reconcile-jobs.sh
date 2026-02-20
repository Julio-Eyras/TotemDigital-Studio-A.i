#!/usr/bin/env bash
set -euo pipefail

# Usage:
# PGPASSWORD=xxx ./run-reconcile-jobs.sh -h host -p port -U user -d db -n 100

LIMIT=100
HOST="localhost"
PORT=5432
USER="${USER:-postgres}"
DB="smartsignage"

while getopts "h:P:U:d:n:" opt; do
  case ${opt} in
    h) HOST="${OPTARG}" ;;
    P) PORT="${OPTARG}" ;;
    U) USER="${OPTARG}" ;;
    d) DB="${OPTARG}" ;;
    n) LIMIT="${OPTARG}" ;;
    *) echo "Usage: $0 [-h host] [-P port] [-U user] [-d db] [-n limit]"; exit 1 ;;
  esac
done

echo "[reconcile] Processing up to ${LIMIT} pending reconcile jobs on ${HOST}:${PORT}/${DB} as ${USER}"

psql "host=${HOST} port=${PORT} dbname=${DB} user=${USER}" -v ON_ERROR_STOP=1 <<'SQL'
SELECT * FROM process_pending_reconcile_jobs(:'LIMIT');
SQL

echo "[reconcile] Done"

