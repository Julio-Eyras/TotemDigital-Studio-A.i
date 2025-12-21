#!/bin/bash
# Install script para webOS app

TV_IP=${1:-"192.168.1.100"}
PACKAGE="com.smartsignage.player_1.0.0_all.ipk"

echo "Installing webOS app on TV at $TV_IP..."

# Verificar se pacote existe
if [ ! -f "$PACKAGE" ]; then
    echo "Error: Package $PACKAGE not found. Run build.sh first."
    exit 1
fi

# Instalar
ares-install --device "$TV_IP" "$PACKAGE"

if [ $? -eq 0 ]; then
    echo "Installation successful!"
    echo "Launching app..."
    ares-launch --device "$TV_IP" com.smartsignage.player
else
    echo "Installation failed!"
    exit 1
fi

