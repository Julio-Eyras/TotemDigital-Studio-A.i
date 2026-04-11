# ============================================
# Smart Signage Pro - Iniciar Sistema Local
# Windows PowerShell
# ============================================
# Este script:
# 1. Limpa caches (nginx, npm, node)
# 2. Faz rebuild completo (backend + frontend)
# 3. Inicia backend e frontend em janelas separadas
# 4. Abre o browser na página de login
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

# Variáveis
# Observação: este script fica em ./scripts. O ROOT_DIR deve ser o diretório raiz do projeto.
$ROOT_DIR = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$BACKEND_DIR = Join-Path $ROOT_DIR "backend"
$FRONTEND_DIR = Join-Path $ROOT_DIR "frontend"
$NGINX_DIR = Join-Path $ROOT_DIR "nginx"
$BACKEND_PORT = 3000
$FRONTEND_PORT = 3001
$LOGIN_URL = "http://localhost:$FRONTEND_PORT"

Write-Header "Smart Signage Pro - Iniciar Sistema Local"

# ============================================
# 1. PARAR SERVIÇOS EXISTENTES
# ============================================

Write-Header "1. Parando Servicos Existentes e Liberando Portas"

function Stop-ServiceOnPort {
    param([int]$Port, [string]$ServiceName)
    
    $stopped = $false
    
    try {
        # Tentar varias vezes para garantir que a porta seja liberada
        for ($attempt = 1; $attempt -le 5; $attempt++) {
            $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
            if ($conn) {
                $processId = $conn.OwningProcess
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($process) {
                    $processName = $process.ProcessName
                    $processPath = $process.Path
                    
                    Write-Info "Encontrado processo na porta ${Port}: $processName (PID: $processId)"
                    Write-Info "Caminho: $processPath"
                    
                    # Parar processo
                    try {
                        Stop-Process -Id $processId -Force -ErrorAction Stop
                        Write-Success "$ServiceName (porta ${Port}, PID: $processId, $processName) parado com sucesso"
                        $stopped = $true
                        Start-Sleep -Seconds 1
                    } catch {
                        Write-Warning-Custom "Tentativa ${attempt}: Erro ao parar processo $processId - $_"
                        # Tentar kill mais agressivo
                        try {
                            taskkill /F /PID $processId 2>&1 | Out-Null
                            Write-Success "$ServiceName (porta ${Port}, PID: $processId) parado via taskkill"
                            $stopped = $true
                            Start-Sleep -Seconds 1
                        } catch {
                            Write-Warning-Custom "Nao foi possivel parar processo $processId"
                        }
                    }
                }
            } else {
                if ($stopped) {
                    Write-Success "Porta ${Port} liberada"
                } else {
                    Write-Info "Nenhum servico encontrado na porta ${Port}"
                }
                break
            }
        }
        
        return $stopped
    } catch {
        Write-Info "Verificacao da porta ${Port} concluida"
        return $false
    }
}

function Test-HttpOk {
    param(
        [Parameter(Mandatory=$true)][string]$Url,
        [int]$TimeoutSeconds = 3
    )

    try {
        # Invoke-WebRequest é mais estável para retornar StatusCode
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSeconds -Method GET
        return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300)
    } catch {
        return $false
    }
}

function Wait-For-HttpOk {
    param(
        [Parameter(Mandatory=$true)][string]$Url,
        [int]$MaxAttempts = 20,
        [int]$DelaySeconds = 2
    )

    for ($i = 1; $i -le $MaxAttempts; $i++) {
        if (Test-HttpOk -Url $Url) {
            return $true
        }
        Start-Sleep -Seconds $DelaySeconds
    }

    return $false
}

function Test-BackendHealthy {
    param(
        [Parameter(Mandatory=$true)][string]$Url,
        [int]$TimeoutSeconds = 3
    )

    try {
        $r = Invoke-RestMethod -Uri $Url -TimeoutSec $TimeoutSeconds -Method GET
        if (-not $r) { return $false }

        # Preferir o healthcheck completo (inclui DB)
        $statusOk = ($r.status -eq "healthy")
        $dbOk = $false
        try {
            $dbOk = ($r.checks.database.status -eq "healthy")
        } catch { $dbOk = $false }

        return ($statusOk -and $dbOk)
    } catch {
        return $false
    }
}

function Wait-For-BackendHealthy {
    param(
        [Parameter(Mandatory=$true)][string]$Url,
        [int]$MaxAttempts = 25,
        [int]$DelaySeconds = 2
    )

    for ($i = 1; $i -le $MaxAttempts; $i++) {
        if (Test-BackendHealthy -Url $Url) {
            return $true
        }
        Start-Sleep -Seconds $DelaySeconds
    }

    return $false
}

function Try-Check-PostgresConnectivity {
    param(
        [Parameter(Mandatory=$true)][string]$BackendDir
    )

    # Checagens leves (sem criar DB): porta + tentativa de SELECT 1 via pg (se possível)
    $pgPortOpen = $false
    try {
        $pgPortOpen = [bool](Test-NetConnection -ComputerName "localhost" -Port 5432 -InformationLevel Quiet)
    } catch { }

    if (-not $pgPortOpen) {
        Write-Warning-Custom "PostgreSQL não parece estar acessível em localhost:5432"
        return $false
    }

    # Tentar conectar usando o DATABASE_URL do backend/.env (se existir).
    $envPath = Join-Path $BackendDir ".env"
    if (-not (Test-Path $envPath)) {
        Write-Warning-Custom "Arquivo backend/.env não encontrado para validar DATABASE_URL"
        return $false
    }

    $raw = Get-Content $envPath -Raw -ErrorAction SilentlyContinue
    if (-not $raw) {
        Write-Warning-Custom "Não foi possível ler backend/.env para validar DATABASE_URL"
        return $false
    }

    $m = [regex]::Match($raw, "(?m)^\s*DATABASE_URL\s*=\s*(.+?)\s*$")
    if (-not $m.Success) {
        Write-Warning-Custom "DATABASE_URL não encontrado em backend/.env"
        return $false
    }

    $dbUrl = $m.Groups[1].Value.Trim()
    if ($dbUrl.StartsWith('"') -and $dbUrl.EndsWith('"')) { $dbUrl = $dbUrl.Trim('"') }
    if ($dbUrl.StartsWith("'") -and $dbUrl.EndsWith("'")) { $dbUrl = $dbUrl.Trim("'") }

    try {
        Push-Location $BackendDir
        $env:DATABASE_URL = $dbUrl
        $cmd = "node -e `"const {Client}=require('pg'); const cs=process.env.DATABASE_URL; const c=new Client({connectionString:cs}); c.connect().then(()=>c.query('SELECT 1')).then(()=>{console.log('PG_OK')}).catch(e=>{console.error('PG_ERR:'+e.message); process.exit(1)}).finally(()=>c.end().catch(()=>{}));`""
        $out = Invoke-Expression $cmd 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "PostgreSQL acessível e DATABASE_URL válido (SELECT 1 OK)"
            return $true
        }
        Write-Warning-Custom "Falha ao validar conexão com PostgreSQL via DATABASE_URL: $out"
        return $false
    } catch {
        Write-Warning-Custom "Erro ao validar conexão PostgreSQL via pg: $_"
        return $false
    } finally {
        Pop-Location
    }
}

# Parar processos Node.js que podem estar usando as portas
Write-Info "Parando processos Node.js relacionados..."
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        try {
            $procPath = $proc.Path
            # Verificar se esta relacionado ao projeto OU se esta usando as portas
            $usingPort = $false
            try {
                $conns = Get-NetTCPConnection -OwningProcess $proc.Id -ErrorAction SilentlyContinue
                if ($conns) {
                    $ports = $conns | Where-Object { $_.LocalPort -eq $BACKEND_PORT -or $_.LocalPort -eq $FRONTEND_PORT }
                    if ($ports) {
                        $usingPort = $true
                    }
                }
            } catch { }
            
            if ($procPath -like "*$ROOT_DIR*" -or $usingPort) {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                Write-Success "Processo Node.js parado (PID: $($proc.Id), Porta em uso: $usingPort)"
            }
        } catch {
            # Ignorar erros
        }
    }
}

# Parar processos Nginx que podem estar usando as portas
Write-Info "Parando processos Nginx..."
$nginxProcesses = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
if ($nginxProcesses) {
    foreach ($proc in $nginxProcesses) {
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Success "Processo Nginx parado (PID: $($proc.Id))"
        } catch {
            try {
                taskkill /F /PID $proc.Id 2>&1 | Out-Null
                Write-Success "Processo Nginx parado via taskkill (PID: $($proc.Id))"
            } catch {
                Write-Warning-Custom "Nao foi possivel parar processo Nginx (PID: $($proc.Id))"
            }
        }
    }
}

# Parar servico Nginx do Windows (se existir)
Write-Info "Verificando servico Nginx do Windows..."
try {
    $nginxService = Get-Service -Name "nginx" -ErrorAction SilentlyContinue
    if ($nginxService -and $nginxService.Status -eq "Running") {
        Stop-Service -Name "nginx" -Force -ErrorAction SilentlyContinue
        Write-Success "Servico Nginx do Windows parado"
    }
} catch {
    Write-Info "Servico Nginx nao encontrado ou ja parado"
}

Start-Sleep -Seconds 2

# Agora parar processos especificos nas portas
Write-Info "Liberando portas $BACKEND_PORT e $FRONTEND_PORT..."
$backendStopped = Stop-ServiceOnPort -Port $BACKEND_PORT -ServiceName "Backend"
$frontendStopped = Stop-ServiceOnPort -Port $FRONTEND_PORT -ServiceName "Frontend"

# Verificacao final das portas
Start-Sleep -Seconds 2
Write-Info "Verificacao final das portas..."
$finalBackend = Get-NetTCPConnection -LocalPort $BACKEND_PORT -ErrorAction SilentlyContinue
$finalFrontend = Get-NetTCPConnection -LocalPort $FRONTEND_PORT -ErrorAction SilentlyContinue

if ($finalBackend) {
    Write-Warning-Custom "ATENCAO: Porta $BACKEND_PORT ainda esta em uso! Tentando forcar liberacao..."
    $finalBackend | ForEach-Object {
        try {
            taskkill /F /PID $_.OwningProcess 2>&1 | Out-Null
            Write-Success "Processo forçado a parar (PID: $($_.OwningProcess))"
        } catch { }
    }
    Start-Sleep -Seconds 1
}

if ($finalFrontend) {
    Write-Warning-Custom "ATENCAO: Porta $FRONTEND_PORT ainda esta em uso! Tentando forcar liberacao..."
    $finalFrontend | ForEach-Object {
        try {
            taskkill /F /PID $_.OwningProcess 2>&1 | Out-Null
            Write-Success "Processo forçado a parar (PID: $($_.OwningProcess))"
        } catch { }
    }
    Start-Sleep -Seconds 1
}

Write-Success "Portas liberadas e processos parados!"

# ============================================
# 2. LIMPAR CACHES
# ============================================

Write-Header "2. Limpando Caches"

# Limpar cache do Nginx (se existir)
Write-Info "Limpando cache do Nginx..."
$nginxCacheDirs = @(
    "C:\nginx\cache",
    "C:\nginx\proxy_cache",
    "$ROOT_DIR\nginx\cache",
    "$ROOT_DIR\nginx\proxy_cache"
)

$nginxCleaned = $false
foreach ($dir in $nginxCacheDirs) {
    if (Test-Path $dir) {
        try {
            Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
            Write-Success "Cache do Nginx removido: $dir"
            $nginxCleaned = $true
        } catch {
            Write-Warning-Custom "Nao foi possivel remover: $dir"
        }
    }
}

if (-not $nginxCleaned) {
    Write-Info "Nenhum cache do Nginx encontrado"
}

# Limpar cache do Backend
Write-Info "Limpando cache do Backend..."
$backendCleaned = $false

if (Test-Path "$BACKEND_DIR\node_modules\.cache") {
    Remove-Item "$BACKEND_DIR\node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Success "Cache do node_modules (backend) removido"
    $backendCleaned = $true
}

Get-ChildItem "$BACKEND_DIR\*.tsbuildinfo" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
    Write-Success "Cache TypeScript removido: $($_.Name)"
    $backendCleaned = $true
}

if (Test-Path "$BACKEND_DIR\dist") {
    Remove-Item "$BACKEND_DIR\dist" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Success "Diretório dist (backend) removido para rebuild limpo"
    $backendCleaned = $true
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
}

if (Test-Path "$FRONTEND_DIR\.cache") {
    Remove-Item "$FRONTEND_DIR\.cache" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Success "Cache do React removido"
    $frontendCleaned = $true
}

if (Test-Path "$FRONTEND_DIR\.eslintcache") {
    Remove-Item "$FRONTEND_DIR\.eslintcache" -Force -ErrorAction SilentlyContinue
    Write-Success "Cache do ESLint removido"
    $frontendCleaned = $true
}

Get-ChildItem "$FRONTEND_DIR\node_modules" -Recurse -Directory -Filter ".cache" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    Write-Success "Cache do webpack removido: $($_.Name)"
    $frontendCleaned = $true
}

if (Test-Path "$FRONTEND_DIR\build") {
    Remove-Item "$FRONTEND_DIR\build" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Success "Diretório build (frontend) removido para rebuild limpo"
    $frontendCleaned = $true
}

if (-not $frontendCleaned) {
    Write-Info "Nenhum cache do frontend encontrado"
}

# Limpar cache do NPM
Write-Info "Limpando cache do NPM..."
try {
    npm cache clean --force 2>&1 | Out-Null
    Write-Success "Cache do npm limpo"
} catch {
    Write-Warning-Custom "Erro ao limpar cache do npm: $_"
}

# Limpar cache do Node.js (temp)
Write-Info "Limpando arquivos temporários do Node.js..."
$tempDirs = @(
    "$env:TEMP\npm-*",
    "$env:TEMP\yarn-*",
    "$env:TEMP\pnpm-*"
)

foreach ($pattern in $tempDirs) {
    Get-ChildItem $pattern -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
        Write-Success "Temp removido: $($_.Name)"
    }
}

Write-Success "Limpeza de caches concluída!"

# ============================================
# 3. VERIFICAR PRE-REQUISITOS
# ============================================

Write-Header "3. Verificando Pre-requisitos"

# Verificar Node.js
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Node.js encontrado: $nodeVersion"
        $versionMatch = $nodeVersion -match "v(\d+)"
        if ($versionMatch) {
            $versionNumber = [int]$matches[1]
            if ($versionNumber -lt 18) {
                Write-Error-Custom "Node.js versao 18+ e necessario. Versao atual: $nodeVersion"
                exit 1
            }
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

# Verificar diretórios
if (-not (Test-Path $BACKEND_DIR)) {
    Write-Error-Custom "Diretorio backend nao encontrado!"
    exit 1
}

if (-not (Test-Path $FRONTEND_DIR)) {
    Write-Error-Custom "Diretorio frontend nao encontrado!"
    exit 1
}

# ============================================
# 4. CONFIGURAR BACKEND
# ============================================

Write-Header "4. Configurando Backend"

$BACKEND_ENV = Join-Path $BACKEND_DIR ".env"

# Criar .env se nao existir
if (-not (Test-Path $BACKEND_ENV)) {
    Write-Info "Criando arquivo .env do backend..."
    
    $jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    $twoFactorKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    $DATABASE_URL = "postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage"
    $corsOrigin = "http://localhost:$BACKEND_PORT,http://localhost:$FRONTEND_PORT,http://localhost:8080"
    $dateStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    $envContent = @"
# Smart Signage Pro v2.1 - Configuracao Local
# Gerado automaticamente em $dateStr

NODE_ENV=development
PORT=$BACKEND_PORT
HOST=0.0.0.0

DB_DRIVER=postgresql
DATABASE_URL=$DATABASE_URL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=smartsignage
DB_USER=smartsignage
DB_PASSWORD=smartsignage123
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

# ============================================
# 5. REBUILD COMPLETO
# ============================================

Write-Header "5. Rebuild Completo do Sistema"

# Rebuild Backend
Write-Info "Instalando dependências do backend..."
Push-Location $BACKEND_DIR
try {
    npm install 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Dependências do backend instaladas"
    } else {
        Write-Warning-Custom "Pode ter havido problemas ao instalar dependências do backend"
    }
} catch {
    Write-Warning-Custom "Erro ao instalar dependências do backend: $_"
}
Pop-Location

Write-Info "Compilando backend..."
Push-Location $BACKEND_DIR
try {
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Backend compilado com sucesso"
    } else {
        Write-Error-Custom "Erro ao compilar backend"
        Pop-Location
        exit 1
    }
} catch {
    Write-Error-Custom "Erro ao compilar backend: $_"
    Pop-Location
    exit 1
}
Pop-Location

# Rebuild Frontend
Write-Info "Instalando dependências do frontend..."
Push-Location $FRONTEND_DIR
try {
    npm install 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Dependências do frontend instaladas"
    } else {
        Write-Warning-Custom "Pode ter havido problemas ao instalar dependências do frontend"
    }
} catch {
    Write-Warning-Custom "Erro ao instalar dependências do frontend: $_"
}
Pop-Location

Write-Success "Rebuild completo concluído!"

# ============================================
# 6. INICIAR SERVIÇOS EM JANELAS SEPARADAS
# ============================================

Write-Header "6. Iniciando Servicos em Janelas Separadas"

# Criar diretorio de logs se nao existir
$logsDir = Join-Path $BACKEND_DIR "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

# Criar script temporário para iniciar backend
$backendScript = Join-Path $env:TEMP "start-backend.ps1"
$lines = @(
    "Set-Location `"$BACKEND_DIR`"",
    "Write-Host `"========================================`" -ForegroundColor Cyan",
    "Write-Host `"BACKEND - Smart Signage Pro`" -ForegroundColor Cyan",
    "Write-Host `"========================================`" -ForegroundColor Cyan",
    "Write-Host `"`"",
    "Write-Host `"Iniciando backend na porta $BACKEND_PORT...`" -ForegroundColor Yellow",
    "Write-Host `"Pressione Ctrl+C para parar`" -ForegroundColor Gray",
    "Write-Host `"`"",
    "npm run dev"
)
$backendScriptContent = $lines -join "`r`n"
[System.IO.File]::WriteAllText($backendScript, $backendScriptContent, [System.Text.Encoding]::UTF8)

# Criar script temporário para iniciar frontend
$frontendScript = Join-Path $env:TEMP "start-frontend.ps1"
$lines = @(
    "Set-Location `"$FRONTEND_DIR`"",
    "Write-Host `"========================================`" -ForegroundColor Cyan",
    "Write-Host `"FRONTEND - Smart Signage Pro`" -ForegroundColor Cyan",
    "Write-Host `"========================================`" -ForegroundColor Cyan",
    "Write-Host `"`"",
    "Write-Host `"Iniciando frontend na porta $FRONTEND_PORT...`" -ForegroundColor Yellow",
    "Write-Host `"Pressione Ctrl+C para parar`" -ForegroundColor Gray",
    "Write-Host `"`"",
    "npm start"
)
$frontendScriptContent = $lines -join "`r`n"
[System.IO.File]::WriteAllText($frontendScript, $frontendScriptContent, [System.Text.Encoding]::UTF8)

# Iniciar Backend em nova janela
Write-Info "Iniciando Backend em nova janela..."
Start-Process powershell.exe -ArgumentList "-NoExit", "-File", "`"$backendScript`"" -WindowStyle Normal
Write-Success "Backend iniciado em nova janela"

# Aguardar backend iniciar (checar health de verdade, não só porta)
Write-Info "Aguardando backend iniciar (healthcheck + banco)..."
$backendHealthUrl = "http://localhost:$BACKEND_PORT/api/health/check"
$backendRunning = Wait-For-BackendHealthy -Url $backendHealthUrl -MaxAttempts 25 -DelaySeconds 2

if (-not $backendRunning) {
    Write-Warning-Custom "Backend não respondeu em $backendHealthUrl. Verifique a janela do backend."
    Write-Info "Diagnóstico rápido: validando PostgreSQL/DATABASE_URL (sem criar banco)..."
    [void](Try-Check-PostgresConnectivity -BackendDir $BACKEND_DIR)
} else {
    Write-Success "Backend respondeu OK em: $backendHealthUrl"
}

# Iniciar Frontend em nova janela
Write-Info "Iniciando Frontend em nova janela..."
Start-Process powershell.exe -ArgumentList "-NoExit", "-File", "`"$frontendScript`"" -WindowStyle Normal
Write-Success "Frontend iniciado em nova janela"

# Aguardar frontend iniciar
Write-Info "Aguardando frontend iniciar..."
Start-Sleep -Seconds 12

# Verificar se frontend está rodando
$frontendRunning = $false
for ($i = 0; $i -lt 20; $i++) {
    $conn = Get-NetTCPConnection -LocalPort $FRONTEND_PORT -ErrorAction SilentlyContinue
    if ($conn) {
        $frontendRunning = $true
        Write-Success "Frontend está rodando na porta $FRONTEND_PORT"
        break
    }
    Start-Sleep -Seconds 2
}

if (-not $frontendRunning) {
    Write-Warning-Custom "Frontend pode nao ter iniciado corretamente. Verifique a janela do frontend."
}

# ============================================
# 7. ABRIR BROWSER
# ============================================

Write-Header "7. Abrindo Browser"

if ($frontendRunning) {
    Write-Info "Abrindo página de login no browser..."
    Start-Sleep -Seconds 3
    Start-Process $LOGIN_URL
    Write-Success "Browser aberto em: $LOGIN_URL"
} else {
    Write-Warning-Custom "Frontend ainda nao esta pronto. Abra manualmente: $LOGIN_URL"
    Start-Process $LOGIN_URL
}

# ============================================
# 8. RESUMO FINAL
# ============================================

Write-Host ""
Write-Header "Sistema Iniciado!"

Write-Host "Servicos rodando:" -ForegroundColor Green
Write-Host ""
Write-ColorOutput -ForegroundColor White "  Backend:  http://localhost:$BACKEND_PORT"
Write-ColorOutput -ForegroundColor White "  Frontend: http://localhost:$FRONTEND_PORT"
Write-ColorOutput -ForegroundColor White "  Login:    $LOGIN_URL"
Write-Host ""

Write-Host "Janelas abertas:" -ForegroundColor Cyan
Write-ColorOutput -ForegroundColor White "  • Backend: Nova janela PowerShell"
Write-ColorOutput -ForegroundColor White "  • Frontend: Nova janela PowerShell"
Write-ColorOutput -ForegroundColor White "  • Browser: Página de login"
Write-Host ""

Write-Host "Para parar os servicos:" -ForegroundColor Yellow
Write-ColorOutput -ForegroundColor White "  • Feche as janelas do PowerShell (Backend e Frontend)"
Write-ColorOutput -ForegroundColor White "  • Ou execute: .\scripts\PARAR-SERVICOS.ps1"
Write-Host ""

Write-Host "Logs:" -ForegroundColor Cyan
Write-ColorOutput -ForegroundColor White "  • Backend: backend\logs\app.log"
Write-Host ""

Write-ColorOutput -ForegroundColor Green "========================================"
Write-ColorOutput -ForegroundColor Green "Sistema pronto para uso!"
Write-ColorOutput -ForegroundColor Green "========================================"
Write-Host ""
