# ============================================
# Smart Signage Pro - Parar Nginx e Limpar Caches
# Windows PowerShell
# ============================================
# Este script:
# 1. Para o servico Nginx (se estiver rodando)
# 2. Limpa todos os caches (nginx, npm, node, backend, frontend)
# ============================================

$ErrorActionPreference = "Continue"
$ProgressPreference = "Continue"

# Cores para output
function Write-ColorOutput {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ForegroundColor,
        [Parameter(Mandatory=$true)]
        [string]$Message
    )
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    Write-Output $Message
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Header($text) {
    Write-Host ""
    Write-ColorOutput -ForegroundColor Cyan "========================================"
    Write-ColorOutput -ForegroundColor Cyan $text
    Write-ColorOutput -ForegroundColor Cyan "========================================"
    Write-Host ""
}

function Write-Success($text) {
    Write-ColorOutput -ForegroundColor Green "[OK] $text"
}

function Write-Error-Custom($text) {
    Write-ColorOutput -ForegroundColor Red "[ERRO] $text"
}

function Write-Warning-Custom($text) {
    Write-ColorOutput -ForegroundColor Yellow "[!] $text"
}

function Write-Info($text) {
    Write-ColorOutput -ForegroundColor Gray "  -> $text"
}

# Variaveis
$ROOT_DIR = $PSScriptRoot
$BACKEND_DIR = Join-Path $ROOT_DIR "backend"
$FRONTEND_DIR = Join-Path $ROOT_DIR "frontend"
$NGINX_DIR = Join-Path $ROOT_DIR "nginx"

Write-Header "Smart Signage Pro - Parar Nginx e Limpar Caches"

# ============================================
# 1. PARAR NGINX
# ============================================

Write-Header "1. Parando Nginx"

$nginxStopped = $false

# Tentar parar Nginx como servico Windows
Write-Info "Verificando servico Nginx..."
try {
    $nginxService = Get-Service -Name "nginx" -ErrorAction SilentlyContinue
    if ($nginxService) {
        if ($nginxService.Status -eq "Running") {
            Stop-Service -Name "nginx" -Force -ErrorAction SilentlyContinue
            Write-Success "Servico Nginx parado"
            $nginxStopped = $true
        } else {
            Write-Info "Servico Nginx ja esta parado"
        }
    }
} catch {
    Write-Info "Servico Nginx nao encontrado no Windows Services"
}

# Tentar parar processos Nginx
Write-Info "Verificando processos Nginx..."
$nginxProcesses = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
if ($nginxProcesses) {
    foreach ($proc in $nginxProcesses) {
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Success "Processo Nginx parado (PID: $($proc.Id))"
            $nginxStopped = $true
        } catch {
            Write-Warning-Custom "Nao foi possivel parar processo Nginx (PID: $($proc.Id))"
        }
    }
} else {
    Write-Info "Nenhum processo Nginx encontrado"
}

# Verificar porta 80 (padrao Nginx)
Write-Info "Verificando porta 80..."
try {
    $conn80 = Get-NetTCPConnection -LocalPort 80 -ErrorAction SilentlyContinue
    if ($conn80) {
        $pid80 = $conn80.OwningProcess
        $process80 = Get-Process -Id $pid80 -ErrorAction SilentlyContinue
        if ($process80 -and $process80.ProcessName -like "*nginx*") {
            Stop-Process -Id $pid80 -Force -ErrorAction SilentlyContinue
            Write-Success "Processo na porta 80 (Nginx) parado (PID: $pid80)"
            $nginxStopped = $true
        }
    }
} catch {
    Write-Info "Nenhum processo na porta 80"
}

if (-not $nginxStopped) {
    Write-Info "Nginx nao estava rodando"
}

Start-Sleep -Seconds 2

# ============================================
# 2. LIMPAR CACHES
# ============================================

Write-Header "2. Limpando Todos os Caches"

$totalCleaned = 0

# Limpar cache do Nginx
Write-Info "Limpando cache do Nginx..."
$nginxCacheDirs = @(
    "C:\nginx\cache",
    "C:\nginx\proxy_cache",
    "C:\nginx\fastcgi_cache",
    "C:\nginx\client_body_temp",
    "C:\nginx\proxy_temp",
    "C:\nginx\fastcgi_temp",
    "C:\nginx\uwsgi_temp",
    "C:\nginx\scgi_temp",
    "$ROOT_DIR\nginx\cache",
    "$ROOT_DIR\nginx\proxy_cache",
    "$ROOT_DIR\nginx\fastcgi_cache",
    "$ROOT_DIR\nginx\client_body_temp",
    "$ROOT_DIR\nginx\proxy_temp",
    "$ROOT_DIR\nginx\fastcgi_temp",
    "$ROOT_DIR\nginx\uwsgi_temp",
    "$ROOT_DIR\nginx\scgi_temp"
)

foreach ($dir in $nginxCacheDirs) {
    if (Test-Path $dir) {
        try {
            Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
            Write-Success "Cache do Nginx removido: $dir"
            $totalCleaned++
        } catch {
            Write-Warning-Custom "Nao foi possivel remover: $dir"
        }
    }
}

# Limpar logs do Nginx (opcional - descomente se quiser limpar logs tambem)
Write-Info "Limpando logs do Nginx..."
$nginxLogDirs = @(
    "C:\nginx\logs",
    "$ROOT_DIR\nginx\logs"
)

foreach ($dir in $nginxLogDirs) {
    if (Test-Path $dir) {
        try {
            Get-ChildItem "$dir\*.log" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
            Write-Success "Logs do Nginx removidos: $dir"
            $totalCleaned++
        } catch {
            Write-Warning-Custom "Nao foi possivel remover logs de: $dir"
        }
    }
}

# Limpar cache do Backend
Write-Info "Limpando cache do Backend..."
$backendCleaned = $false

if (Test-Path "$BACKEND_DIR\node_modules\.cache") {
    Remove-Item "$BACKEND_DIR\node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Success "Cache do node_modules (backend) removido"
    $backendCleaned = $true
    $totalCleaned++
}

Get-ChildItem "$BACKEND_DIR\*.tsbuildinfo" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
    Write-Success "Cache TypeScript removido: $($_.Name)"
    $backendCleaned = $true
    $totalCleaned++
}

if (Test-Path "$BACKEND_DIR\dist") {
    Remove-Item "$BACKEND_DIR\dist" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Success "Diretorio dist (backend) removido"
    $backendCleaned = $true
    $totalCleaned++
}

if (Test-Path "$BACKEND_DIR\.cache") {
    Remove-Item "$BACKEND_DIR\.cache" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Success "Cache do backend removido"
    $backendCleaned = $true
    $totalCleaned++
}

if (-not $backendCleaned) {
    Write-Info "Nenhum cache do backend encontrado"
}

# Limpar cache do Frontend
Write-Info "Limpando cache do Frontend..."
$frontendCleaned = $false

if (Test-Path "$FRONTEND_DIR\node_modules\.cache") {
    Remove-Item "$FRONTEND_DIR\node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Success "Cache do webpack/react (frontend) removido"
    $frontendCleaned = $true
    $totalCleaned++
}

if (Test-Path "$FRONTEND_DIR\.cache") {
    Remove-Item "$FRONTEND_DIR\.cache" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Success "Cache do React removido"
    $frontendCleaned = $true
    $totalCleaned++
}

if (Test-Path "$FRONTEND_DIR\.eslintcache") {
    Remove-Item "$FRONTEND_DIR\.eslintcache" -Force -ErrorAction SilentlyContinue
    Write-Success "Cache do ESLint removido"
    $frontendCleaned = $true
    $totalCleaned++
}

Get-ChildItem "$FRONTEND_DIR\node_modules" -Recurse -Directory -Filter ".cache" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    Write-Success "Cache do webpack removido: $($_.Name)"
    $frontendCleaned = $true
    $totalCleaned++
}

if (Test-Path "$FRONTEND_DIR\build") {
    Remove-Item "$FRONTEND_DIR\build" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Success "Diretorio build (frontend) removido"
    $frontendCleaned = $true
    $totalCleaned++
}

if (Test-Path "$FRONTEND_DIR\.next") {
    Remove-Item "$FRONTEND_DIR\.next" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Success "Diretorio .next (frontend) removido"
    $frontendCleaned = $true
    $totalCleaned++
}

if (-not $frontendCleaned) {
    Write-Info "Nenhum cache do frontend encontrado"
}

# Limpar cache do NPM
Write-Info "Limpando cache do NPM..."
try {
    $npmCacheOutput = npm cache clean --force 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Cache do npm limpo"
        $totalCleaned++
    } else {
        Write-Warning-Custom "Aviso ao limpar cache do npm (pode ser normal)"
        $totalCleaned++
    }
} catch {
    Write-Warning-Custom "Erro ao limpar cache do npm: $_"
}

# Limpar cache do Yarn (se existir)
Write-Info "Verificando cache do Yarn..."
try {
    $yarnVersion = yarn --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        yarn cache clean 2>&1 | Out-Null
        Write-Success "Cache do Yarn limpo"
        $totalCleaned++
    }
} catch {
    Write-Info "Yarn nao encontrado (pulando)"
}

# Limpar cache do PNPM (se existir)
Write-Info "Verificando cache do PNPM..."
try {
    $pnpmVersion = pnpm --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        pnpm store prune 2>&1 | Out-Null
        Write-Success "Cache do PNPM limpo"
        $totalCleaned++
    }
} catch {
    Write-Info "PNPM nao encontrado (pulando)"
}

# Limpar cache do Node.js (temp)
Write-Info "Limpando arquivos temporarios do Node.js..."
$tempDirs = @(
    "$env:TEMP\npm-*",
    "$env:TEMP\yarn-*",
    "$env:TEMP\pnpm-*",
    "$env:TEMP\*npm*",
    "$env:TEMP\*node*"
)

foreach ($pattern in $tempDirs) {
    Get-ChildItem $pattern -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
            Write-Success "Temp removido: $($_.Name)"
            $totalCleaned++
        } catch {
            # Ignorar erros de arquivos em uso
        }
    }
}

# Limpar cache do Windows (opcional - arquivos temporarios gerais)
Write-Info "Limpando cache do sistema..."
$systemCacheDirs = @(
    "$env:LOCALAPPDATA\Temp",
    "$env:TEMP"
)

foreach ($dir in $systemCacheDirs) {
    if (Test-Path $dir) {
        try {
            Get-ChildItem $dir -Filter "*cache*" -Recurse -ErrorAction SilentlyContinue | 
                Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | 
                Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
            Write-Success "Cache do sistema limpo parcialmente: $dir"
            $totalCleaned++
        } catch {
            # Ignorar erros
        }
    }
}

# ============================================
# 3. RESUMO FINAL
# ============================================

Write-Host ""
Write-Header "Limpeza Concluida!"

Write-Host "Resumo:" -ForegroundColor Green
Write-Host ""
Write-ColorOutput -ForegroundColor White "  Nginx: Parado"
Write-ColorOutput -ForegroundColor White "  Caches removidos: $totalCleaned"
Write-Host ""

Write-Host "Caches limpos:" -ForegroundColor Cyan
Write-ColorOutput -ForegroundColor White "  - Nginx (cache, logs, temp)"
Write-ColorOutput -ForegroundColor White "  - Backend (node_modules, TypeScript, dist)"
Write-ColorOutput -ForegroundColor White "  - Frontend (webpack, React, build, .next)"
Write-ColorOutput -ForegroundColor White "  - NPM/Yarn/PNPM"
Write-ColorOutput -ForegroundColor White "  - Node.js temporarios"
Write-Host ""

Write-ColorOutput -ForegroundColor Green "========================================"
Write-ColorOutput -ForegroundColor Green "Limpeza concluida com sucesso!"
Write-ColorOutput -ForegroundColor Green "========================================"
Write-Host ""
