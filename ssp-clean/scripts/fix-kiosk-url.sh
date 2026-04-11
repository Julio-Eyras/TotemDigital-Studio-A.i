#!/bin/bash

# ================================================================
# Script para Corrigir URL do Kiosk no Autostart
# ================================================================
# Remove URLs hardcoded e usa variável dinâmica
# ================================================================

echo "🔧 Corrigindo URL do Kiosk no autostart..."

# Verificar se o arquivo de autostart existe
KIOSK_SCRIPT="$HOME/.config/autostart/kiosk.sh"

if [ ! -f "$KIOSK_SCRIPT" ]; then
    echo "⚠️ Script de kiosk não encontrado: $KIOSK_SCRIPT"
    exit 1
fi

# Obter IP atual do servidor
SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
    SERVER_IP="localhost"
fi

# URL padrão do player (sem UIN, para entrar em modo demo)
KIOSK_URL="http://${SERVER_IP}:80/player"

echo "📍 URL detectada: $KIOSK_URL"

# Backup do script original
if [ -f "$KIOSK_SCRIPT" ]; then
    cp "$KIOSK_SCRIPT" "${KIOSK_SCRIPT}.bak.$(date +%Y%m%d_%H%M%S)"
    echo "💾 Backup criado"
fi

# Corrigir URL no script (remover qualquer IP hardcoded)
sed -i "s|http://192\.168\.1\.102|http://${SERVER_IP}|g" "$KIOSK_SCRIPT"
sed -i "s|http://192\.168\.1\.1|http://${SERVER_IP}|g" "$KIOSK_SCRIPT"

# Garantir que a URL seja dinâmica
if ! grep -q "KIOSK_URL=\"\${KIOSK_URL:-" "$KIOSK_SCRIPT"; then
    # Substituir URL fixa por variável dinâmica
    sed -i "s|KIOSK_URL=\".*\"|KIOSK_URL=\"\${KIOSK_URL:-http://${SERVER_IP}:80/player}\"|g" "$KIOSK_SCRIPT"
fi

# Verificar se há referências ao IP problemático
if grep -q "192.168.1.102" "$KIOSK_SCRIPT"; then
    echo "⚠️ Ainda há referências ao IP 192.168.1.102 no script"
    echo "📝 Edite manualmente: $KIOSK_SCRIPT"
else
    echo "✅ Script corrigido - IP hardcoded removido"
fi

# Mostrar URL final
echo ""
echo "📊 URL configurada no script:"
grep "KIOSK_URL=" "$KIOSK_SCRIPT" | head -1

echo ""
echo "✅ Correção concluída!"
echo "💡 Para aplicar, reinicie o ambiente gráfico:"
echo "   sudo systemctl restart lightdm"

