# Smart Signage Pro - Script para Rebuild e Restart do Frontend (Windows)
# Limpa cache, recompila React e reinicia o servidor de desenvolvimento

$ErrorActionPreference = "Stop"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🔄 REBUILD E RESTART DO FRONTEND" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# 1. Parar processos do frontend
Write-Host "1️⃣  Parando processos do frontend..." -ForegroundColor Yellow

# Parar processo do React dev server (porta 3001)
$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($port3001) {
    $pidPort = $port3001.OwningProcess
    Write-Host "   Parando processo na porta 3001 (PID: $pidPort)..." -ForegroundColor Gray
    Stop-Process -Id $pidPort -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Parar processos Node relacionados ao frontend
$frontendProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*react-scripts*" -or
    $_.CommandLine -like "*react-app-rewired*" -or
    ($_.Path -like "*SmartSignage-Pro*frontend*")
}

if ($frontendProcesses) {
    foreach ($proc in $frontendProcesses) {
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Host "   ✅ Processo parado (PID: $($proc.Id))" -ForegroundColor Green
        } catch {
            Write-Host "   ⚠️  Erro ao parar processo $($proc.Id): $_" -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "   ℹ️  Nenhum processo frontend encontrado" -ForegroundColor Gray
}

# 2. Limpar cache e build antigo
Write-Host ""
Write-Host "2️⃣  Limpando cache e builds antigos..." -ForegroundColor Yellow

Set-Location "$PSScriptRoot\.."

# Limpar build de produção
if (Test-Path "frontend\build") {
    Remove-Item "frontend\build" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Pasta frontend\build removida" -ForegroundColor Green
}

# Limpar cache do webpack/react
if (Test-Path "frontend\node_modules\.cache") {
    Remove-Item "frontend\node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Cache do webpack/react removido" -ForegroundColor Green
}

# Limpar cache do React
if (Test-Path "frontend\.cache") {
    Remove-Item "frontend\.cache" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Cache do React removido" -ForegroundColor Green
}

# Limpar cache do ESLint
if (Test-Path "frontend\.eslintcache") {
    Remove-Item "frontend\.eslintcache" -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Cache do ESLint removido" -ForegroundColor Green
}

# Limpar cache do npm
Write-Host "   Limpando cache do npm..." -ForegroundColor Gray
npm cache clean --force 2>$null | Out-Null

# Limpar cache do webpack (dentro de node_modules)
Get-ChildItem "frontend\node_modules" -Recurse -Directory -Filter ".cache" -ErrorAction SilentlyContinue | 
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "   ✅ Cache limpo completamente" -ForegroundColor Green

# 3. Recompilar frontend (build de produção)
Write-Host ""
Write-Host "3️⃣  Recompilando frontend (React)..." -ForegroundColor Yellow

Set-Location "frontend"

# Verificar dependências
if (-not (Test-Path "node_modules")) {
    Write-Host "   Instalando dependências..." -ForegroundColor Gray
    npm install
}

# Aplicar patches
Write-Host "   Aplicando patches..." -ForegroundColor Gray
if (Test-Path "node_modules\.bin\patch-package.cmd") {
    & "node_modules\.bin\patch-package.cmd" 2>$null | Out-Null
}

# Compilar (build de produção)
Write-Host "   Executando build..." -ForegroundColor Gray
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ ERRO ao compilar frontend!" -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ Frontend recompilado com sucesso!" -ForegroundColor Green

Set-Location ".."

# 4. Verificar se build foi criado
Write-Host ""
Write-Host "4️⃣  Verificando build..." -ForegroundColor Yellow

if (-not (Test-Path "frontend\build\index.html")) {
    Write-Host "   ❌ Arquivo frontend\build\index.html não encontrado!" -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ Build criado com sucesso!" -ForegroundColor Green
Write-Host "   📁 Localização: frontend\build\" -ForegroundColor Gray

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ REBUILD DO FRONTEND CONCLUÍDO!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 STATUS:" -ForegroundColor Blue
Write-Host "   • Frontend compilado: frontend\build\" -ForegroundColor White
Write-Host ""
Write-Host "💡 PRÓXIMOS PASSOS:" -ForegroundColor Blue
Write-Host "   • Se usar Nginx: Reinicie o Nginx para servir o novo build" -ForegroundColor White
Write-Host "   • Se usar dev server: Execute 'cd frontend && npm start'" -ForegroundColor White
Write-Host ""
