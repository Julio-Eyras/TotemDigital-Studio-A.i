# Build script para Windows Electron (PowerShell)

Write-Host "Building Windows Electron app..." -ForegroundColor Green

# Instalar dependências
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Copiar arquivos core
Write-Host "Copying core files..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "renderer/js/core/api" | Out-Null
New-Item -ItemType Directory -Force -Path "renderer/js/core/playlist" | Out-Null
New-Item -ItemType Directory -Force -Path "renderer/js/core/heartbeat" | Out-Null
New-Item -ItemType Directory -Force -Path "renderer/js/core/scheduler" | Out-Null
New-Item -ItemType Directory -Force -Path "renderer/js/core/utils" | Out-Null

Copy-Item "../../core/api/client.js" "renderer/js/core/api/" -Force
Copy-Item "../../core/playlist/manager.js" "renderer/js/core/playlist/" -Force
Copy-Item "../../core/heartbeat/service.js" "renderer/js/core/heartbeat/" -Force
Copy-Item "../../core/scheduler/scheduler.js" "renderer/js/core/scheduler/" -Force
Copy-Item "../../core/utils/logger.js" "renderer/js/core/utils/" -Force
Copy-Item "../../core/utils/cache.js" "renderer/js/core/utils/" -Force
Copy-Item "../../core/utils/error-handler.js" "renderer/js/core/utils/" -Force

# Copiar SmartDisplayFX
Write-Host "Copying SmartDisplayFX modules..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "renderer/js/smartdisplayfx" | Out-Null

Copy-Item "../../shared/smartdisplayfx/SmartDisplayFlowClient.js" "renderer/js/smartdisplayfx/" -Force
Copy-Item "../../shared/smartdisplayfx/FxEngine.js" "renderer/js/smartdisplayfx/" -Force
Copy-Item "../../shared/smartdisplayfx/PlayerBridge.js" "renderer/js/smartdisplayfx/" -Force
Copy-Item "../../shared/smartdisplayfx/config.js" "renderer/js/smartdisplayfx/" -Force
Copy-Item "../../shared/smartdisplayfx/mqtt-wrapper.js" "renderer/js/smartdisplayfx/" -Force

Write-Host "Build complete!" -ForegroundColor Green
Write-Host "Run 'npm start' to test locally" -ForegroundColor Cyan
Write-Host "Run 'npm run build' to create installer" -ForegroundColor Cyan

