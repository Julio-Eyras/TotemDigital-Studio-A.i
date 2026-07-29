#!/usr/bin/env bash
# Correcção imediata do 405 /login no Nginx.
# Substitui `rewrite ^ /index.html break` por `try_files /index.html =404`
# em todos os location blocks do smart-signage (aceita POST/métodos no SPA).
# Uso: bash scripts/fix-nginx-405-login.sh
set -euo pipefail

NGINX_CONF="/etc/nginx/sites-available/smart-signage"
NGINX_ENABLED="/etc/nginx/sites-enabled/smart-signage"

if [[ ! -f "$NGINX_CONF" ]]; then
    echo "[ERRO] $NGINX_CONF não encontrado."
    echo "       Verifique: ls /etc/nginx/sites-available/"
    exit 1
fi

echo "[INFO] Config actual:"
grep -n "rewrite\|try_files\|location.*login" "$NGINX_CONF" || true

# Backup
sudo cp "$NGINX_CONF" "${NGINX_CONF}.bak.$(date +%s)"
echo "[INFO] Backup criado."

# Substituir rewrite ^ /index.html break por try_files /index.html =404
if sudo grep -q "rewrite \^ /index.html break" "$NGINX_CONF"; then
    sudo sed -i 's|rewrite \^ /index\.html break;|try_files /index.html =404;|g' "$NGINX_CONF"
    echo "[OK] Substituição feita."
else
    echo "[INFO] Nenhum 'rewrite ^ /index.html break' encontrado — config pode já estar correcta."
fi

echo "[INFO] Config após correcção:"
grep -n "rewrite\|try_files\|location.*login" "$NGINX_CONF" || true

# Testar e recarregar
if sudo nginx -t 2>&1; then
    sudo systemctl reload nginx
    echo "[OK] Nginx recarregado com sucesso."
    echo ""
    echo "Teste agora: curl -s -o /dev/null -w '%{http_code}' -X POST https://totemdigital.app.br/api/auth/login"
else
    echo "[ERRO] nginx -t falhou — a restaurar backup..."
    sudo cp "${NGINX_CONF}.bak.$(date +%s | head -c 10)" "$NGINX_CONF" 2>/dev/null || true
    exit 1
fi

# Verificar se o backend está a responder
echo ""
echo "[INFO] Verificando backend..."
if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "[OK] Backend responde em :3000"
else
    echo "[AVISO] Backend não responde em :3000 — verificar:"
    echo "  sudo systemctl status smart-signage"
    echo "  sudo journalctl -u smart-signage -n 50"
fi

# Testar login via API directamente
echo ""
echo "[INFO] Teste de login via API (admin/admin123)..."
_resp=$(curl -sf -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' 2>&1 || echo "FALHOU")
if echo "$_resp" | grep -q "token\|accessToken\|jwt"; then
    echo "[OK] Login API funciona — problema era só no Nginx."
elif echo "$_resp" | grep -q "Invalid\|invalid\|Unauthorized\|unauthorized"; then
    echo "[AVISO] Nginx OK mas credenciais rejeitadas — verificar utilizador admin no banco:"
    echo "  sudo -u postgres psql -d smartsignage -c \"SELECT username, role, active FROM users WHERE username='admin';\""
else
    echo "[AVISO] Resposta inesperada da API: $_resp"
    echo "  Verificar: sudo journalctl -u smart-signage -n 30"
fi
