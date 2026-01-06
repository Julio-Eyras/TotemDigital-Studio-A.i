# ============================================
# Smart Signage Pro - Instalar e Levantar Sistema
# Windows PowerShell
# ============================================
# Este script instala e inicia todo o sistema automaticamente
# ============================================

$ErrorActionPreference = "Stop"
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
    Write-ColorOutput -ForegroundColor Yellow "[AVISO] $text"
}

function Write-Info($text) {
    Write-ColorOutput -ForegroundColor Gray "  $text"
}

# Variáveis
$ROOT_DIR = $PSScriptRoot
$BACKEND_DIR = Join-Path $ROOT_DIR "backend"
$FRONTEND_DIR = Join-Path $ROOT_DIR "frontend"
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_USER = "postgres"
$DB_PASSWORD = "postgres"
$DB_NAME = "smartsignage"
$BACKEND_PORT = 3000
$FRONTEND_PORT = 3001

Write-Header "Smart Signage Pro - Instalacao e Inicializacao Completa"

# ============================================
# 1. PARAR SERVICOS EXISTENTES
# ============================================

Write-Header "1. Parando Servicos Existentes"

function Stop-ServiceOnPort {
    param([int]$Port, [string]$ServiceName)
    
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($conn) {
            $pid = $conn.OwningProcess
            $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($process) {
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                Write-Success "$ServiceName (porta $Port) parado"
                Start-Sleep -Seconds 2
                return $true
            }
        }
        return $false
    } catch {
        return $false
    }
}

Stop-ServiceOnPort -Port $BACKEND_PORT -ServiceName "Backend"
Stop-ServiceOnPort -Port $FRONTEND_PORT -ServiceName "Frontend"

Write-Host ""

# ============================================
# 2. VERIFICAR PRE-REQUISITOS
# ============================================

Write-Header "2. Verificando Pre-requisitos"

# Verificar Node.js
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Node.js encontrado: $nodeVersion"
        $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        if ($versionNumber -lt 18) {
            Write-Error-Custom "Node.js versao 18+ e necessario. Versao atual: $nodeVersion"
            exit 1
        }
    } else {
        throw "Node.js nao encontrado"
    }
} catch {
    Write-Error-Custom "Node.js nao encontrado. Por favor, instale Node.js 18+ primeiro."
    Write-Info "Download: https://nodejs.org/"
    exit 1
}

# Verificar npm
try {
    $npmVersion = npm --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "npm encontrado: $npmVersion"
    } else {
        throw "npm nao encontrado"
    }
} catch {
    Write-Error-Custom "npm nao encontrado."
    exit 1
}

Write-Host ""

# ============================================
# 3. CONFIGURAR BACKEND
# ============================================

Write-Header "3. Configurando Backend"

if (-not (Test-Path $BACKEND_DIR)) {
    Write-Error-Custom "Diretorio 'backend' nao encontrado!"
    exit 1
}

$BACKEND_ENV = Join-Path $BACKEND_DIR ".env"

# Criar .env se nao existir
if (-not (Test-Path $BACKEND_ENV)) {
    Write-Info "Criando arquivo .env do backend..."
    
    $jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    $twoFactorKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    $DATABASE_URL = "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    $corsOrigin = "http://localhost:$BACKEND_PORT,http://localhost:$FRONTEND_PORT,http://localhost:8080"
    $allowedFileTypes = "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,audio/mp3,audio/wav,audio/ogg"
    $smtpFrom = 'Smart Signage <noreply@smartsignage.com>'
    $dateStr = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

    $envContent = @"
# Smart Signage Pro v2.1 - Configuracao Local
# Gerado automaticamente em $dateStr

NODE_ENV=development
PORT=$BACKEND_PORT
HOST=0.0.0.0

DB_DRIVER=postgresql
DATABASE_URL=$DATABASE_URL
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_POOL_SIZE=20
DB_CONNECTION_TIMEOUT=30000

JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

TWO_FACTOR_ENCRYPTION_KEY=$twoFactorKey

PLAYER_ABANDON_PIN=1234
BCRYPT_ROUNDS=12

CORS_ORIGIN=$corsOrigin

CACHE_ENABLED=false
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

LOG_LEVEL=info
LOG_FILE=./logs/app.log
LOG_ENABLE_CONSOLE=true

AI_PROVIDER=ollama
AI_MODEL=llama3.2:3b
OLLAMA_BASE_URL=http://localhost:11434

EMAIL_ENABLED=false
FRONTEND_URL=http://localhost:$FRONTEND_PORT

DEBUG=true
VERBOSE_LOGGING=true
"@

    try {
        [System.IO.File]::WriteAllText($BACKEND_ENV, $envContent, [System.Text.Encoding]::UTF8)
        Write-Success ".env criado em: backend/.env"
    } catch {
        Write-Error-Custom "Erro ao criar arquivo .env: $_"
        exit 1
    }
} else {
    Write-Info ".env ja existe, mantendo configuracao atual"
}

# Instalar dependências do backend
Write-Info "Instalando dependencias do backend..."
Push-Location $BACKEND_DIR
try {
    npm install 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Dependencias do backend instaladas"
    } else {
        Write-Warning-Custom "Pode ter havido problemas ao instalar dependencias"
    }
} catch {
    Write-Warning-Custom "Erro ao instalar dependencias: $_"
}
Pop-Location

# ============================================
# 4. CONFIGURAR BANCO DE DADOS
# ============================================

Write-Host ""
Write-Header "4. Configurando Banco de Dados"

$setupScript = Join-Path $BACKEND_DIR "scripts\setup-database.js"
if (-not (Test-Path $setupScript)) {
    $setupScript = Join-Path $ROOT_DIR "setup-database-node.js"
}

if (Test-Path $setupScript) {
    Write-Info "Criando banco de dados e aplicando schema..."
    Push-Location $BACKEND_DIR
    try {
        node $setupScript 2>&1 | Out-Null
        Write-Success "Banco de dados configurado"
    } catch {
        Write-Warning-Custom "Pode ter havido problemas ao configurar o banco"
    }
    Pop-Location
} else {
    Write-Warning-Custom "Script de setup do banco nao encontrado"
}

# Compilar backend
Write-Info "Compilando backend..."
Push-Location $BACKEND_DIR
try {
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Backend compilado"
    } else {
        Write-Warning-Custom "Pode ter havido problemas ao compilar"
    }
} catch {
    Write-Warning-Custom "Erro ao compilar: $_"
}
Pop-Location

# ============================================
# 5. CONFIGURAR FRONTEND
# ============================================

Write-Host ""
Write-Header "5. Configurando Frontend"

if (-not (Test-Path $FRONTEND_DIR)) {
    Write-Error-Custom "Diretorio 'frontend' nao encontrado!"
    exit 1
}

# Instalar dependências do frontend
Write-Info "Instalando dependencias do frontend..."
Push-Location $FRONTEND_DIR
try {
    npm install 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Dependencias do frontend instaladas"
    } else {
        Write-Warning-Custom "Pode ter havido problemas ao instalar dependencias"
    }
} catch {
    Write-Warning-Custom "Erro ao instalar dependencias: $_"
}
Pop-Location

# ============================================
# 6. INICIAR SERVICOS
# ============================================

Write-Host ""
Write-Header "6. Iniciando Servicos"

# Criar diretório de logs se não existir
$logsDir = Join-Path $BACKEND_DIR "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

# Iniciar Backend
Write-Info "Iniciando Backend..."
Push-Location $BACKEND_DIR
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:BACKEND_DIR
    npm run dev
}
Write-Success "Backend iniciado (Job ID: $($backendJob.Id))"
Pop-Location

# Aguardar backend iniciar
Write-Info "Aguardando backend iniciar..."
Start-Sleep -Seconds 5

# Verificar se backend está rodando
$backendRunning = $false
for ($i = 0; $i -lt 10; $i++) {
    $conn = Get-NetTCPConnection -LocalPort $BACKEND_PORT -ErrorAction SilentlyContinue
    if ($conn) {
        $backendRunning = $true
        Write-Success "Backend esta rodando na porta $BACKEND_PORT"
        break
    }
    Start-Sleep -Seconds 2
}

if (-not $backendRunning) {
    Write-Warning-Custom "Backend pode nao ter iniciado corretamente"
}

# Iniciar Frontend
Write-Host ""
Write-Info "Iniciando Frontend..."
Push-Location $FRONTEND_DIR
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:FRONTEND_DIR
    npm start
}
Write-Success "Frontend iniciado (Job ID: $($frontendJob.Id))"
Pop-Location

# Aguardar frontend iniciar
Write-Info "Aguardando frontend iniciar..."
Start-Sleep -Seconds 10

# ============================================
# 7. RESUMO FINAL
# ============================================

Write-Host ""
Write-Header "Sistema Iniciado!"

Write-Host "Servicos rodando:" -ForegroundColor Green
Write-Host ""
Write-ColorOutput -ForegroundColor White "  Backend:  http://localhost:$BACKEND_PORT"
Write-ColorOutput -ForegroundColor White "  Frontend: http://localhost:$FRONTEND_PORT"
Write-Host ""

Write-Host "Jobs:" -ForegroundColor Cyan
Write-ColorOutput -ForegroundColor White "  Backend Job ID:  $($backendJob.Id)"
Write-ColorOutput -ForegroundColor White "  Frontend Job ID: $($frontendJob.Id)"
Write-Host ""

Write-Host "Para parar os servicos:" -ForegroundColor Yellow
Write-ColorOutput -ForegroundColor White "  Execute: .\PARAR-SERVICOS.ps1"
Write-ColorOutput -ForegroundColor White "  Ou pressione Ctrl+C nos terminais"
Write-Host ""

Write-Host "Logs do Backend:" -ForegroundColor Cyan
Write-ColorOutput -ForegroundColor White "  backend\logs\app.log"
Write-Host ""

Write-ColorOutput -ForegroundColor Green "========================================"
Write-ColorOutput -ForegroundColor Green "Sistema pronto para uso!"
Write-ColorOutput -ForegroundColor Green "========================================"
Write-Host ""

# Salvar Job IDs para referência futura
$pidsFile = Join-Path $ROOT_DIR ".pids"
@{
    BackendJobId = $backendJob.Id
    FrontendJobId = $frontendJob.Id
    StartedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
} | ConvertTo-Json | Out-File $pidsFile -Encoding UTF8

Write-Info "Job IDs salvos em: .pids"

