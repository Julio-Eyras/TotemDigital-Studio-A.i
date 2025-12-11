#!/bin/bash
# Build script para Windows Electron

echo "Building Windows Electron app..."

# Instalar dependências
echo "Installing dependencies..."
npm install

# Copiar arquivos core
echo "Copying core files..."
mkdir -p renderer/js/core/api
mkdir -p renderer/js/core/playlist
mkdir -p renderer/js/core/heartbeat
mkdir -p renderer/js/core/scheduler
mkdir -p renderer/js/core/utils

cp ../../core/api/client.js renderer/js/core/api/
cp ../../core/playlist/manager.js renderer/js/core/playlist/
cp ../../core/heartbeat/service.js renderer/js/core/heartbeat/
cp ../../core/scheduler/scheduler.js renderer/js/core/scheduler/
cp ../../core/utils/logger.js renderer/js/core/utils/
cp ../../core/utils/cache.js renderer/js/core/utils/
cp ../../core/utils/error-handler.js renderer/js/core/utils/

# Copiar SmartDisplayFX
echo "Copying SmartDisplayFX modules..."
mkdir -p renderer/js/smartdisplayfx
cp ../../shared/smartdisplayfx/SmartDisplayFlowClient.js renderer/js/smartdisplayfx/
cp ../../shared/smartdisplayfx/FxEngine.js renderer/js/smartdisplayfx/
cp ../../shared/smartdisplayfx/PlayerBridge.js renderer/js/smartdisplayfx/
cp ../../shared/smartdisplayfx/config.js renderer/js/smartdisplayfx/
cp ../../shared/smartdisplayfx/mqtt-wrapper.js renderer/js/smartdisplayfx/
cp ../../shared/smartdisplayfx/FxUtils.js renderer/js/smartdisplayfx/
cp ../../shared/smartdisplayfx/ParticleSystem.js renderer/js/smartdisplayfx/

# Verificar se package.json tem dependência mqtt
if ! grep -q '"mqtt"' package.json 2>/dev/null; then
    echo "Warning: mqtt dependency not found in package.json. SmartDisplayFX MQTT may not work."
fi

# Verificar se index.html tem MQTT script
if ! grep -q "unpkg.com/mqtt" renderer/index.html 2>/dev/null; then
    echo "Warning: MQTT script not found in index.html. Make sure it's included for SmartDisplayFX."
fi

echo "Build complete!"
echo "Run 'npm start' to test locally"
echo "Run 'npm run build' to create installer"

