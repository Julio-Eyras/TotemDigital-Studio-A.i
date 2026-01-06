# Script para iniciar o sistema localmente em modo desenvolvimento
# Uso: .\scripts\start-local-dev.ps1

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Smart Signage Pro - Modo Desenvolvimento" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se Node.js está instalado
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js encontrado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js não encontrado. Instale Node.js 18+ primeiro." -ForegroundColor Red
    exit 1
}

# Verificar se o banco de dados está configurado
Write-Host ""
Write-Host "📋 Verificando configuração..." -ForegroundColor Yellow

# Verificar arquivo .env no backend
if (-not (Test-Path "backend\.env")) {
    Write-Host "⚠️  Arquivo backend\.env não encontrado!" -ForegroundColor Yellow
    Write-Host "   Copiando .env.example para .env..." -ForegroundColor Yellow
    if (Test-Path "backend\.env.example") {
        Copy-Item "backend\.env.example" "backend\.env"
        Write-Host "   ✅ Arquivo .env criado. Configure as variáveis necessárias." -ForegroundColor Green
    } else {
        Write-Host "   ❌ Arquivo .env.example não encontrado!" -ForegroundColor Red
    }
}

# Verificar se as dependências estão instaladas
Write-Host ""
Write-Host "📦 Verificando dependências..." -ForegroundColor Yellow

if (-not (Test-Path "backend\node_modules")) {
    Write-Host "   📥 Instalando dependências do backend..." -ForegroundColor Yellow
    Set-Location backend
    npm install
    Set-Location ..
    Write-Host "   ✅ Dependências do backend instaladas" -ForegroundColor Green
} else {
    Write-Host "   ✅ Dependências do backend OK" -ForegroundColor Green
}

if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "   📥 Instalando dependências do frontend..." -ForegroundColor Yellow
    Set-Location frontend
    npm install
    Set-Location ..
    Write-Host "   ✅ Dependências do frontend instaladas" -ForegroundColor Green
} else {
    Write-Host "   ✅ Dependências do frontend OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Iniciando serviços..." -ForegroundColor Cyan
Write-Host ""

# Iniciar backend em uma nova janela
Write-Host "   📡 Iniciando Backend (porta 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; npm run dev"

# Aguardar alguns segundos
Start-Sleep -Seconds 3

# Iniciar frontend em uma nova janela
Write-Host "   🎨 Iniciando Frontend (porta 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; npm start"

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Serviços iniciados!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 Acessos:" -ForegroundColor Cyan
Write-Host "   Backend API:  http://localhost:3000" -ForegroundColor White
Write-Host "   Frontend:     http://localhost:3001" -ForegroundColor White
Write-Host "   API Docs:     http://localhost:3000/api-docs" -ForegroundColor White
Write-Host ""
Write-Host "💡 Para parar os serviços, feche as janelas do PowerShell" -ForegroundColor Yellow
Write-Host ""
