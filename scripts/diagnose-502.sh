#!/usr/bin/env bash
# Diagnóstico rápido: 502 Bad Gateway (Nginx → Node) no servidor Linux.
# Uso: ./scripts/diagnose-502.sh
set -euo pipefail

BACKEND_PORT="${BACKEND_PORT:-3000}"
echo "=== 1) Porta ${BACKEND_PORT} (Node) ==="
if ss -tlnp 2>/dev/null | grep -q ":${BACKEND_PORT}\\b" || netstat -tlnp 2>/dev/null | grep -q ":${BACKEND_PORT}\\b"; then
  echo "   Algo está à escuta em :${BACKEND_PORT}"
else
  echo "   NADA à escuta em :${BACKEND_PORT} → 502 é esperado. Arranque o backend."
fi

echo
echo "=== 2) systemd smart-signage ==="
if systemctl list-unit-files 2>/dev/null | grep -q '^smart-signage.service'; then
  systemctl is-active smart-signage 2>/dev/null || true
  systemctl show smart-signage -p WorkingDirectory -p ExecStart --no-pager 2>/dev/null || true
else
  echo "   Unit smart-signage.service não instalada. Crie com: ./scripts/create-smart-signage-service.sh /caminho/do/projeto"
fi

echo
echo "=== 3) Health local (deve ser 200) ==="
curl -sS -o /tmp/health.body -w "HTTP %{http_code}\n" "http://127.0.0.1:${BACKEND_PORT}/api/health" || echo "curl falhou"

echo
echo "=== 4) Nginx últimos erros (upstream) ==="
if [[ -r /var/log/nginx/error.log ]]; then
  sudo tail -n 25 /var/log/nginx/error.log 2>/dev/null || tail -n 25 /var/log/nginx/error.log
else
  echo "   (sem permissão ou ficheiro inexistente — executar: sudo tail -25 /var/log/nginx/error.log)"
fi

echo
echo "=== 5) Dica ==="
echo "   Se health for 000/502: sudo systemctl start smart-signage && cd \\\$WorkingDirectory && npm run build"
echo "   Se Nginx aponta para porta errada: grep -n proxy_pass /etc/nginx/sites-enabled/*"
