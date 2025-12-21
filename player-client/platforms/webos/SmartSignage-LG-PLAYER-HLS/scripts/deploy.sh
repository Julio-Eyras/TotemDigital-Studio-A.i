#!/bin/bash
# Script para deploy do app na TV LG

if [ -z "$1" ]; then
    echo "❌ Erro: Nome do dispositivo não fornecido"
    echo "Uso: ./deploy.sh <device-name>"
    echo ""
    echo "Para listar dispositivos: ares-setup-device"
    exit 1
fi

DEVICE_NAME=$1
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# Buscar arquivo .ipk mais recente
IPK_FILE=$(ls -t *.ipk 2>/dev/null | head -1)

if [ -z "$IPK_FILE" ]; then
    echo "❌ Erro: Nenhum arquivo .ipk encontrado"
    echo "   Execute ./build.sh primeiro"
    exit 1
fi

echo "📦 Instalando $IPK_FILE no dispositivo $DEVICE_NAME..."

# Instalar
ares-install "$IPK_FILE" -d "$DEVICE_NAME"

if [ $? -eq 0 ]; then
    echo "✅ Instalação concluída!"
    echo "🚀 Para executar: ares-launch com.smartsignage.lgplayer.hls -d $DEVICE_NAME"
else
    echo "❌ Erro na instalação"
    exit 1
fi

