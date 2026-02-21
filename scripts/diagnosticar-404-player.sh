#!/bin/bash
# Diagnóstico de 404 nos arquivos JS do player.
# NOTA: Com install-smartsignage.sh o player já deve funcionar; use para diagnóstico pontual.
# Execute no servidor: bash scripts/diagnosticar-404-player.sh

echo "=========================================="
echo "DIAGNÓSTICO 404 - Player JS"
echo "=========================================="
echo ""

BACKEND_URL="${1:-http://127.0.0.1:3000}"
NGINX_URL="${2:-http://192.168.1.110}"

echo "1) Testando BACKEND direto (porta 3000)"
echo "   Página: $BACKEND_URL/player/"
HTTP_PAGE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/player/" 2>/dev/null || echo "ERRO")
echo "   Página /player/: $HTTP_PAGE"
echo "   JS:     $BACKEND_URL/player/js/app.js"
HTTP_JS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/player/js/app.js" 2>/dev/null || echo "ERRO")
echo "   JS app.js: $HTTP_JS"
if [ "$HTTP_PAGE" = "200" ] && [ "$HTTP_JS" = "200" ]; then
  echo "   Conclusão: Backend OK. O 404 vem do NGINX (não faz proxy de /player)."
elif [ "$HTTP_PAGE" != "200" ]; then
  echo "   Conclusão: Backend NÃO serve /player/ (código $HTTP_PAGE). Verifique /opt/smart-signage/player-web/index.html e se o backend está rodando."
else
  echo "   Conclusão: Backend serve a página mas não o JS. Verifique /opt/smart-signage/player-web/js/."
fi
echo ""

echo "2) Endpoint de diagnóstico do backend"
echo "   URL: $BACKEND_URL/api/debug/player-static"
curl -s "$BACKEND_URL/api/debug/player-static" 2>/dev/null | head -20 || echo "   (backend não respondeu)"
echo ""
echo ""

echo "3) Testando via NGINX (porta 80)"
echo "   Página: $NGINX_URL/player/"
HTTP_NGINX_PAGE=$(curl -s -o /dev/null -w "%{http_code}" "$NGINX_URL/player/" 2>/dev/null || echo "ERRO")
echo "   /player/: $HTTP_NGINX_PAGE"
HTTP_NGINX_JS=$(curl -s -o /dev/null -w "%{http_code}" "$NGINX_URL/player/js/app.js" 2>/dev/null || echo "ERRO")
echo "   /player/js/app.js: $HTTP_NGINX_JS"
if [ "$HTTP_NGINX_PAGE" != "200" ]; then
  echo "   -> Se a página dá 404, Nginx NÃO está repassando /player para o backend. Rode: sudo bash scripts/corrigir-player-completo.sh"
fi
echo ""

echo "4) Arquivos em /opt/smart-signage/player-web/"
if [ -d "/opt/smart-signage/player-web" ]; then
  echo "   Diretório existe."
  ls -la /opt/smart-signage/player-web/ 2>/dev/null | head -10
  if [ -d "/opt/smart-signage/player-web/js" ]; then
    echo "   js/ existe. Conteúdo:"
    ls -la /opt/smart-signage/player-web/js/ 2>/dev/null
    [ -d "/opt/smart-signage/player-web/js/api" ] && ls -la /opt/smart-signage/player-web/js/api/ 2>/dev/null
    [ -d "/opt/smart-signage/player-web/js/cache" ] && ls -la /opt/smart-signage/player-web/js/cache/ 2>/dev/null
  else
    echo "   js/ NÃO existe - os arquivos não foram copiados."
  fi
else
  echo "   Diretório NÃO existe. Rode o install ou copie player-web para /opt/smart-signage/."
fi
echo ""

echo "5) Configuração do Nginx para /player"
if [ -f "/etc/nginx/sites-available/smart-signage" ]; then
  echo "   Trecho do config:"
  grep -A 15 "location.*/player" /etc/nginx/sites-available/smart-signage 2>/dev/null | head -25
  if grep -q "proxy_pass.*3000" /etc/nginx/sites-available/smart-signage 2>/dev/null; then
    echo "   -> Nginx está configurado com proxy_pass (correto)."
  fi
  if grep -q "location ^~ /player" /etc/nginx/sites-available/smart-signage 2>/dev/null; then
    echo "   -> location ^~ /player presente (evita que /player/js/* caia em regex .js)."
  elif grep -q "location /player " /etc/nginx/sites-available/smart-signage 2>/dev/null; then
    echo "   -> location /player sem ^~. /player/js/* está sendo capturado por regex de .js e retorna 404."
    echo "   Corrija com: sudo bash scripts/corrigir-nginx-player-404.sh"
    echo "   Ou manualmente: sudo sed -i 's/location \\/player {/location ^~ \\/player {/g' /etc/nginx/sites-available/smart-signage && sudo nginx -t && sudo systemctl reload nginx"
  fi
  if grep -q "alias.*player-web" /etc/nginx/sites-available/smart-signage 2>/dev/null; then
    echo "   -> Nginx está com ALIAS (antigo). Precisa mudar para proxy_pass."
    echo "   Rode: sudo bash scripts/corrigir-player-completo.sh"
  fi
else
  echo "   Arquivo de config do Nginx não encontrado."
fi
echo ""

echo "=========================================="
echo "Resumo:"
echo "- Página /player/ em 404: Nginx não faz proxy de /player OU backend não acha index.html. Rode: sudo bash scripts/corrigir-player-completo.sh"
echo "- Backend 200 e Nginx 404: Nginx sem location ^~ /player. Rode: sudo bash scripts/corrigir-nginx-player-404.sh"
echo "- Backend 404: Falta /opt/smart-signage/player-web (index.html, js/). Rode: sudo bash scripts/corrigir-player-completo.sh"
echo "=========================================="
