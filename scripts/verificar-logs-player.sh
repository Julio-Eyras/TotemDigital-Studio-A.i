#!/bin/bash
# Script para verificar logs relacionados ao player

echo "=== Logs do Player ==="
echo ""
echo "1. Verificando diretório de logs..."
if [ -d "/opt/smart-signage/Logs" ]; then
    echo "✅ Diretório de logs encontrado: /opt/smart-signage/Logs"
else
    echo "❌ Diretório de logs não encontrado"
    exit 1
fi

echo ""
echo "2. Últimas mensagens sobre player (últimas 50 linhas):"
echo "---"
grep -i "player\|static\|js/" /opt/smart-signage/Logs/app-current.log 2>/dev/null | tail -50 || \
grep -i "player\|static\|js/" /opt/smart-signage/Logs/app-$(date +%Y-%m-%d).log 2>/dev/null | tail -50 || \
echo "Nenhum log encontrado"

echo ""
echo "3. Verificando diretório do player no servidor:"
if [ -d "/opt/smart-signage/player-web" ]; then
    echo "✅ Diretório encontrado: /opt/smart-signage/player-web"
    echo "   Conteúdo:"
    ls -la /opt/smart-signage/player-web/ | head -10
    echo ""
    if [ -d "/opt/smart-signage/player-web/js" ]; then
        echo "✅ Diretório js/ encontrado"
        ls -la /opt/smart-signage/player-web/js/
    else
        echo "❌ Diretório js/ NÃO encontrado"
    fi
else
    echo "❌ Diretório /opt/smart-signage/player-web NÃO encontrado"
    echo ""
    echo "Verificando se existe player-web-cache (nome antigo):"
    if [ -d "/opt/smart-signage/player-web-cache" ]; then
        echo "⚠️  Diretório antigo encontrado: /opt/smart-signage/player-web-cache"
        echo "   Execute: sudo mv /opt/smart-signage/player-web-cache /opt/smart-signage/player-web"
    fi
fi

echo ""
echo "4. Para ver logs em tempo real, execute:"
echo "   tail -f /opt/smart-signage/Logs/app-current.log | grep -i 'player\|static'"
