#!/bin/bash
# Atualiza o backend no servidor: build + sincroniza para /opt se necessário + restart.
# Use após git pull para aplicar correções (last_heartbeat, UNION dispatch, etc.).
# Executar: cd ~/SmartSignage-Pro && bash scripts/atualizar-backend-no-servidor.sh

set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_DIR/backend"
OPT_BACKEND="/opt/smart-signage/backend"

echo "=========================================="
echo "Atualizar Backend no Servidor"
echo "=========================================="
echo ""

if [ ! -d "$BACKEND_DIR" ] || [ ! -f "$BACKEND_DIR/package.json" ]; then
    echo "❌ Execute a partir do repositório: cd ~/SmartSignage-Pro && bash scripts/atualizar-backend-no-servidor.sh"
    exit 1
fi

echo "1️⃣ Build do backend em $BACKEND_DIR..."
cd "$BACKEND_DIR"
npm run build
echo "   ✅ Build concluído"
echo ""

# Se o serviço roda de /opt, copiar dist para lá
if [ -d "$OPT_BACKEND" ] && [ "$(readlink -f "$OPT_BACKEND")" != "$(readlink -f "$BACKEND_DIR")" ]; then
    echo "2️⃣ Sincronizando dist para $OPT_BACKEND..."
    sudo cp -a "$BACKEND_DIR/dist" "$OPT_BACKEND/"
    echo "   ✅ Sincronizado"
else
    echo "2️⃣ Serviço usa o backend do repositório. Nada a sincronizar."
fi
echo ""

echo "3️⃣ Reiniciando smart-signage..."
if systemctl is-active --quiet smart-signage 2>/dev/null; then
    sudo systemctl restart smart-signage
    echo "   ✅ Reiniciado"
else
    echo "   ⚠️ Serviço smart-signage não está ativo. Inicie com: sudo systemctl start smart-signage"
fi
echo ""

echo "=========================================="
echo "✅ Concluído. Teste: http://SEU_IP/player/?uin=UIN-SHOPPING-001-2025"
echo "=========================================="
