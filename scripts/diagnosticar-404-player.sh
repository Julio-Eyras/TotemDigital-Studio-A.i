#!/bin/bash
# Descobre ONDE está o 404 dos arquivos JS do player
# Execute no servidor: bash scripts/diagnosticar-404-player.sh

echo "=========================================="
echo "DIAGNÓSTICO 404 - Player JS"
echo "=========================================="
echo ""

BACKEND_URL="${1:-http://127.0.0.1:3000}"
NGINX_URL="${2:-http://192.168.1.110}"

echo "1) Testando BACKEND direto (porta 3000)"
echo "   URL: $BACKEND_URL/player/js/app.js"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/player/js/app.js" 2>/dev/null || echo "ERRO")
if [ "$HTTP" = "200" ]; then
  echo "   Resultado: 200 OK - Backend serve o arquivo."
  echo "   Conclusão: O 404 vem do NGINX (não está fazendo proxy ou está servindo com alias)."
else
  echo "   Resultado: $HTTP"
  echo "   Conclusão: Backend NÃO está servindo. Verifique se os arquivos existem e se o backend foi reiniciado."
fi
echo ""

echo "2) Endpoint de diagnóstico do backend"
echo "   URL: $BACKEND_URL/api/debug/player-static"
curl -s "$BACKEND_URL/api/debug/player-static" 2>/dev/null | head -20 || echo "   (backend não respondeu)"
echo ""
echo ""

echo "3) Testando via NGINX (porta 80)"
echo "   URL: $NGINX_URL/player/js/app.js"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$NGINX_URL/player/js/app.js" 2>/dev/null || echo "ERRO")
if [ "$HTTP" = "200" ]; then
  echo "   Resultado: 200 OK"
else
  echo "   Resultado: $HTTP"
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
  grep -A 15 "location /player" /etc/nginx/sites-available/smart-signage 2>/dev/null | head -25
  if grep -q "proxy_pass.*3000" /etc/nginx/sites-available/smart-signage 2>/dev/null; then
    echo "   -> Nginx está configurado com proxy_pass (correto)."
  elif grep -q "alias.*player-web" /etc/nginx/sites-available/smart-signage 2>/dev/null; then
    echo "   -> Nginx está com ALIAS (antigo). Precisa mudar para proxy_pass."
    echo "   Rode: sudo bash scripts/corrigir-player-completo.sh"
  fi
else
  echo "   Arquivo de config do Nginx não encontrado."
fi
echo ""

echo "=========================================="
echo "Resumo:"
echo "- Se backend (1) retorna 200 e Nginx (3) retorna 404: Nginx não está fazendo proxy. Corrija o config e recarregue: sudo nginx -t && sudo systemctl reload nginx"
echo "- Se backend (1) retorna 404: Arquivos não existem ou backend não foi atualizado. Copie player-web para /opt/smart-signage/player-web e reinicie o backend."
echo "=========================================="
