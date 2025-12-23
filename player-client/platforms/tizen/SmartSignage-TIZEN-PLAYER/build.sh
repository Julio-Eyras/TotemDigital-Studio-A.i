#!/bin/bash
# Build script para Tizen app

echo "Building Tizen app..."

# Diretório do app
APP_DIR="app"
SRC_DIR="src"

# Limpar diretório do app (exceto manifest files)
echo "Cleaning app directory..."
find "$APP_DIR" -type f ! -name "*.xml" ! -name "*.png" -delete
find "$APP_DIR" -type d -empty -delete

# Copiar arquivos core para o app
echo "Copying core files..."
mkdir -p "$APP_DIR/js/core/api"
mkdir -p "$APP_DIR/js/core/playlist"
mkdir -p "$APP_DIR/js/core/heartbeat"
mkdir -p "$APP_DIR/js/core/scheduler"
mkdir -p "$APP_DIR/js/core/utils"
mkdir -p "$APP_DIR/js/core/media"

cp ../../core/api/client.js "$APP_DIR/js/core/api/"
cp ../../core/playlist/manager.js "$APP_DIR/js/core/playlist/"
cp ../../core/heartbeat/service.js "$APP_DIR/js/core/heartbeat/"
cp ../../core/scheduler/scheduler.js "$APP_DIR/js/core/scheduler/"
cp ../../core/utils/logger.js "$APP_DIR/js/core/utils/"
cp ../../core/utils/cache.js "$APP_DIR/js/core/utils/"
cp ../../core/utils/error-handler.js "$APP_DIR/js/core/utils/"

# Copiar SmartDisplayFX
echo "Copying SmartDisplayFX modules..."
mkdir -p "$APP_DIR/js/smartdisplayfx"
cp ../../shared/smartdisplayfx/SmartDisplayFlowClient.js "$APP_DIR/js/smartdisplayfx/"
cp ../../shared/smartdisplayfx/FxEngine.js "$APP_DIR/js/smartdisplayfx/"
cp ../../shared/smartdisplayfx/PlayerBridge.js "$APP_DIR/js/smartdisplayfx/"
cp ../../shared/smartdisplayfx/config.js "$APP_DIR/js/smartdisplayfx/"
cp ../../shared/smartdisplayfx/mqtt-wrapper.js "$APP_DIR/js/smartdisplayfx/"
cp ../../shared/smartdisplayfx/FxUtils.js "$APP_DIR/js/smartdisplayfx/"
cp ../../shared/smartdisplayfx/ParticleSystem.js "$APP_DIR/js/smartdisplayfx/"

# Verificar se index.html tem MQTT script (já deve estar, mas verificar)
if ! grep -q "unpkg.com/mqtt" "$APP_DIR/index.html" 2>/dev/null; then
    echo "Warning: MQTT script not found in index.html. Make sure it's included for SmartDisplayFX."
fi

# Verificar se config.xml tem permissão de internet
if ! grep -q "privilege.*internet" "$APP_DIR/config.xml" 2>/dev/null; then
    echo "Warning: Internet privilege not found in config.xml. SmartDisplayFX MQTT may not work."
fi

# Copiar arquivos fonte
echo "Copying source files..."
cp -r "$SRC_DIR"/* "$APP_DIR/"

# Copiar config.xml
if [ -f "app/config.xml" ]; then
    echo "config.xml already in app directory"
else
    echo "Warning: config.xml not found"
fi

# Criar diretório de ícones se não existir
if [ ! -f "$APP_DIR/icon.png" ]; then
    echo "Warning: icon.png not found in app directory"
fi

# Criar pacote .wgt
echo "Creating .wgt package..."
tizen package -t wgt -s <certificate-profile> -- "$APP_DIR"

if [ $? -eq 0 ]; then
    echo "Build complete!"
    echo "Package: SmartSignagePlayer.wgt"
else
    echo "Build failed!"
    echo "Note: You need to configure a certificate profile for Tizen"
    exit 1
fi

