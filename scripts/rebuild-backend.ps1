# Smart Signage Pro - Script para Rebuild e Restart do Backend (Windows)
# Limpa cache, recompila TypeScript e reinicia o servidor backend

$ErrorActionPreference = "Stop"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🔄 REBUILD E RESTART DO BACKEND" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# 1. Parar processos do backend
Write-Host "1️⃣  Parando processos do backend..." -ForegroundColor Yellow

# Verificar porta 3000 primeiro
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    $pidPort = $port3000.OwningProcess
    Write-Host "   Parando processo na porta 3000 (PID: $pidPort)..." -ForegroundColor Gray
    Stop-Process -Id $pidPort -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Write-Host "   ✅ Processo na porta 3000 parado" -ForegroundColor Green
}

# Parar processos Node.js que possam estar rodando o backend
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
$stoppedAny = $false

foreach ($proc in $nodeProcesses) {
    try {
        # Verificar se o processo está rodando algo relacionado ao backend
        $procPath = $proc.Path
        if ($procPath -and (
            $procPath -like "*SmartSignage-Pro*backend*" -or
            $procPath -like "*backend*dist*index.js*"
        )) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Host "   ✅ Processo backend parado (PID: $($proc.Id))" -ForegroundColor Green
            $stoppedAny = $true
        }
    } catch {
        # Ignorar erros ao acessar propriedades do processo
    }
}

if (-not $stoppedAny -and -not $port3000) {
    Write-Host "   ℹ️  Nenhum processo backend encontrado" -ForegroundColor Gray
}

Start-Sleep -Seconds 2

# 2. Limpar cache e build antigo
Write-Host ""
Write-Host "2️⃣  Limpando cache e builds antigos..." -ForegroundColor Yellow

Set-Location "$PSScriptRoot\.."

if (Test-Path "backend\dist") {
    Remove-Item "backend\dist" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Pasta backend\dist removida" -ForegroundColor Green
}

if (Test-Path "backend\node_modules\.cache") {
    Remove-Item "backend\node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Cache do node_modules removido" -ForegroundColor Green
}

# Limpar cache do TypeScript
if (Test-Path "backend\*.tsbuildinfo") {
    Get-ChildItem "backend\*.tsbuildinfo" | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Cache do TypeScript removido" -ForegroundColor Green
}

# Limpar cache do npm
Write-Host "   Limpando cache do npm..." -ForegroundColor Gray
npm cache clean --force 2>$null | Out-Null

Write-Host "   ✅ Cache limpo" -ForegroundColor Green

# 3. Recompilar backend
Write-Host ""
Write-Host "3️⃣  Recompilando backend (TypeScript)..." -ForegroundColor Yellow

Set-Location "backend"

# Verificar dependências
if (-not (Test-Path "node_modules")) {
    Write-Host "   Instalando dependências..." -ForegroundColor Gray
    npm install
}

# Compilar
Write-Host "   Executando build..." -ForegroundColor Gray
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ ERRO ao compilar backend!" -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ Backend recompilado com sucesso!" -ForegroundColor Green

Set-Location ".."

# 4. Reiniciar backend
Write-Host ""
Write-Host "4️⃣  Reiniciando backend..." -ForegroundColor Yellow

Set-Location "backend"

# Verificar se build foi criado
if (-not (Test-Path "dist\index.js")) {
    Write-Host "   ❌ Arquivo dist\index.js não encontrado!" -ForegroundColor Red
    exit 1
}

# Iniciar em background
Write-Host "   Iniciando servidor..." -ForegroundColor Gray

# Criar diretório de logs se não existir
if (-not (Test-Path "..\logs")) {
    New-Item -ItemType Directory -Path "..\logs" | Out-Null
}

# Iniciar processo em background (usando Start-Process para não bloquear)
$logFile = "..\logs\backend-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$startScript = @"
cd backend
npm start
"@

$startScript | Out-File -FilePath "start-backend-temp.ps1" -Encoding UTF8
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm start 2>&1 | Tee-Object -FilePath '$logFile'" -WorkingDirectory "backend" -PassThru -WindowStyle Hidden
$backendPID = $backendProcess.Id
Write-Host "   ✅ Backend iniciado (PID: $backendPID)" -ForegroundColor Green
Remove-Item "start-backend-temp.ps1" -ErrorAction SilentlyContinue

# Aguardar um pouco e verificar se iniciou
Start-Sleep -Seconds 3

# Verificar health check
Write-Host "   Verificando health check..." -ForegroundColor Gray
$maxAttempts = 30
$attempt = 0
$backendReady = $false

while ($attempt -lt $maxAttempts -and -not $backendReady) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
            Write-Host "   ✅ Backend iniciado e respondendo!" -ForegroundColor Green
        }
    } catch {
        $attempt++
        if ($attempt -ge $maxAttempts) {
            Write-Host "   ⚠️  Backend pode não ter iniciado corretamente" -ForegroundColor Yellow
            Write-Host "   Verifique os logs em: logs\backend-*.log" -ForegroundColor Yellow
            Write-Host "   Ou execute manualmente: cd backend && npm start" -ForegroundColor Yellow
        } else {
            Start-Sleep -Seconds 2
        }
    }
}

Set-Location ".."

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ REBUILD E RESTART DO BACKEND CONCLUÍDO!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 STATUS:" -ForegroundColor Blue
Write-Host "   • Backend: http://localhost:3000" -ForegroundColor White
Write-Host "   • Health: http://localhost:3000/health" -ForegroundColor White
if ($backendPID) {
    Write-Host "   • PID: $backendPID" -ForegroundColor White
}
Write-Host ""
Write-Host "🔧 COMANDOS ÚTEIS:" -ForegroundColor Blue
Write-Host "   • Ver logs: Get-Content logs\backend-*.log -Tail 50 -Wait" -ForegroundColor White
Write-Host "   • Parar backend: Stop-Process -Id $backendPID -Force" -ForegroundColor White
Write-Host "   • Parar todos Node: Get-Process node | Stop-Process -Force" -ForegroundColor White
Write-Host ""
