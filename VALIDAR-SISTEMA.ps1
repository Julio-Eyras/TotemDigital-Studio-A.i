# ============================================
# Smart Signage Pro - Validação Automática do Sistema
# Windows PowerShell
# ============================================
# Este script executa o sistema completo e valida automaticamente:
# - Backend (Node.js/Express)
# - Frontend (React)
# - Banco de Dados PostgreSQL
# - APIs e Health Checks
# - Logs de erros
# ============================================

$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

# Cores para output
function Write-ColorOutput($ForegroundColor, $Message) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    Write-Output $Message
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Header($text) {
    Write-ColorOutput Cyan "========================================"
    Write-ColorOutput Cyan $text
    Write-ColorOutput Cyan "========================================"
    Write-Host ""
}

function Write-Success($text) {
    Write-ColorOutput Green "[OK] $text"
}

function Write-Error-Custom($text) {
    Write-ColorOutput Red "[ERRO] $text"
}

function Write-Warning-Custom($text) {
    Write-ColorOutput Yellow "[AVISO] $text"
}

function Write-Info($text) {
    Write-ColorOutput Gray "  $text"
}

# Variáveis de configuração
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_USER = "postgres"
$DB_PASSWORD = "postgres"
$DB_NAME = "smartsignage"
$BACKEND_PORT = "3000"
$FRONTEND_PORT = "3001"
$BACKEND_URL = "http://localhost:$BACKEND_PORT"
$FRONTEND_URL = "http://localhost:$FRONTEND_PORT"

# Caminhos
$ROOT_DIR = $PSScriptRoot
$BACKEND_DIR = Join-Path $ROOT_DIR "backend"
$FRONTEND_DIR = Join-Path $ROOT_DIR "frontend"
$BACKEND_ENV = Join-Path $BACKEND_DIR ".env"
$BACKEND_LOGS = Join-Path $BACKEND_DIR "logs"
$REPORT_FILE = Join-Path $ROOT_DIR "validacao-sistema-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"

# Contadores de validação
$script:totalTests = 0
$script:passedTests = 0
$script:failedTests = 0
$script:errors = @()

function Test-Result($testName, $passed, $message = "") {
    $script:totalTests++
    if ($passed) {
        $script:passedTests++
        Write-Success "$testName"
        if ($message) { Write-Info "  $message" }
    } else {
        $script:failedTests++
        Write-Error-Custom "$testName"
        if ($message) { Write-Error-Custom "  $message" }
        $script:errors += "$testName: $message"
    }
}

# ============================================
# 1. VERIFICAÇÕES INICIAIS
# ============================================

Write-Header "1. Verificando Pre-requisitos"

# Node.js
Write-Info "Verificando Node.js..."
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        Test-Result "Node.js instalado" ($versionNumber -ge 18) "Versao: $nodeVersion"
    } else {
        Test-Result "Node.js instalado" $false "Node.js nao encontrado"
    }
} catch {
    Test-Result "Node.js instalado" $false $_.Exception.Message
}

# npm
Write-Info "Verificando npm..."
try {
    $npmVersion = npm --version 2>&1
    Test-Result "npm instalado" ($LASTEXITCODE -eq 0) "Versao: $npmVersion"
} catch {
    Test-Result "npm instalado" $false $_.Exception.Message
}

# PostgreSQL
Write-Info "Verificando PostgreSQL..."
try {
    $pgTest = psql -h $DB_HOST -U $DB_USER -d postgres -c "SELECT version();" 2>&1
    Test-Result "PostgreSQL acessivel" ($LASTEXITCODE -eq 0) "Conectado em $DB_HOST:$DB_PORT"
} catch {
    Test-Result "PostgreSQL acessivel" $false "PostgreSQL nao encontrado ou inacessivel"
}

# Diretórios
Test-Result "Diretorio backend existe" (Test-Path $BACKEND_DIR)
Test-Result "Diretorio frontend existe" (Test-Path $FRONTEND_DIR)
Test-Result "Arquivo .env existe" (Test-Path $BACKEND_ENV)

Write-Host ""

# ============================================
# 2. INSTALAÇÃO E CONFIGURAÇÃO
# ============================================

Write-Header "2. Instalando e Configurando Sistema"

# Instalar dependências do backend
Write-Info "Instalando dependencias do backend..."
Push-Location $BACKEND_DIR
try {
    npm install 2>&1 | Out-Null
    Test-Result "Dependencias backend instaladas" ($LASTEXITCODE -eq 0)
} catch {
    Test-Result "Dependencias backend instaladas" $false $_.Exception.Message
}
Pop-Location

# Instalar dependências do frontend
Write-Info "Instalando dependencias do frontend..."
Push-Location $FRONTEND_DIR
try {
    npm install 2>&1 | Out-Null
    Test-Result "Dependencias frontend instaladas" ($LASTEXITCODE -eq 0)
} catch {
    Test-Result "Dependencias frontend instaladas" $false $_.Exception.Message
}
Pop-Location

# Compilar backend
Write-Info "Compilando backend..."
Push-Location $BACKEND_DIR
try {
    npm run build 2>&1 | Out-Null
    Test-Result "Backend compilado" ($LASTEXITCODE -eq 0)
} catch {
    Test-Result "Backend compilado" $false $_.Exception.Message
}
Pop-Location

# Configurar banco de dados
Write-Info "Configurando banco de dados..."
Push-Location $BACKEND_DIR
try {
    $dbOutput = node scripts/setup-database.js 2>&1
    $dbSuccess = ($LASTEXITCODE -eq 0) -or ($dbOutput -match "Configuracao do banco de dados concluida" -or $dbOutput -match "Schema aplicado com sucesso")
    Test-Result "Banco de dados configurado" $dbSuccess
} catch {
    Test-Result "Banco de dados configurado" $false $_.Exception.Message
}
Pop-Location

Write-Host ""

# ============================================
# 3. INICIAR SERVIÇOS
# ============================================

Write-Header "3. Iniciando Servicos"

# Parar serviços existentes
Write-Info "Parando servicos existentes..."
$portsToStop = @($BACKEND_PORT, $FRONTEND_PORT)
foreach ($port in $portsToStop) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {
        # Ignorar erros ao parar
    }
}
Start-Sleep -Seconds 2

# Iniciar Backend
Write-Info "Iniciando Backend..."
Push-Location $BACKEND_DIR
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:BACKEND_DIR
    npm run dev 2>&1
}
Pop-Location
Start-Sleep -Seconds 5

# Iniciar Frontend
Write-Info "Iniciando Frontend..."
Push-Location $FRONTEND_DIR
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:FRONTEND_DIR
    npm start 2>&1
}
Pop-Location
Start-Sleep -Seconds 10

Write-Host ""

# ============================================
# 4. VALIDAÇÕES DE CONECTIVIDADE
# ============================================

Write-Header "4. Validando Conectividade"

# Aguardar serviços iniciarem
Write-Info "Aguardando servicos iniciarem (30 segundos)..."
$maxWait = 30
$waited = 0
$backendReady = $false
$frontendReady = $false

while ($waited -lt $maxWait -and (-not $backendReady -or -not $frontendReady)) {
    Start-Sleep -Seconds 2
    $waited += 2
    
    # Testar Backend
    if (-not $backendReady) {
        try {
            # Tentar rota de health check
            $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/health/quick" -Method GET -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                $backendReady = $true
                Write-Info "Backend respondendo..."
            }
        } catch {
            # Tentar rota alternativa
            try {
                $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/health" -Method GET -TimeoutSec 2 -ErrorAction Stop
                if ($response.StatusCode -eq 200) {
                    $backendReady = $true
                    Write-Info "Backend respondendo..."
                }
            } catch {
                # Ainda não está pronto
            }
        }
    }
    
    # Testar Frontend
    if (-not $frontendReady) {
        try {
            $response = Invoke-WebRequest -Uri $FRONTEND_URL -Method GET -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                $frontendReady = $true
                Write-Info "Frontend respondendo..."
            }
        } catch {
            # Ainda não está pronto
        }
    }
}

# Validar Backend
Test-Result "Backend acessivel" $backendReady "URL: $BACKEND_URL"

# Validar Frontend
Test-Result "Frontend acessivel" $frontendReady "URL: $FRONTEND_URL"

Write-Host ""

# ============================================
# 5. VALIDAÇÕES DE API
# ============================================

Write-Header "5. Validando APIs"

if ($backendReady) {
    # Health Check
    Write-Info "Testando /api/health/check..."
    try {
        $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/health/check" -Method GET -TimeoutSec 5 -ErrorAction Stop
        $healthData = $response.Content | ConvertFrom-Json
        Test-Result "Health Check API" ($response.StatusCode -eq 200) "Status: $($healthData.status)"
    } catch {
        # Tentar rota alternativa
        try {
            $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
            $healthData = $response.Content | ConvertFrom-Json
            Test-Result "Health Check API" ($response.StatusCode -eq 200) "Status: $($healthData.status)"
        } catch {
            Test-Result "Health Check API" $false $_.Exception.Message
        }
    }
    
    # API Docs
    Write-Info "Testando /api-docs..."
    try {
        $response = Invoke-WebRequest -Uri "$BACKEND_URL/api-docs" -Method GET -TimeoutSec 5 -ErrorAction Stop
        Test-Result "API Docs acessivel" ($response.StatusCode -eq 200)
    } catch {
        Test-Result "API Docs acessivel" $false $_.Exception.Message
    }
    
    # Verificar se banco está conectado (via health check)
    Write-Info "Verificando conexao com banco de dados..."
    try {
        $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/health/check" -Method GET -TimeoutSec 5 -ErrorAction Stop
        $healthData = $response.Content | ConvertFrom-Json
        $dbStatus = $healthData.services.database.status
        Test-Result "Banco de dados conectado" ($dbStatus -eq "healthy") "Status: $dbStatus"
    } catch {
        # Tentar rota alternativa
        try {
            $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
            $healthData = $response.Content | ConvertFrom-Json
            $dbStatus = $healthData.services.database.status
            Test-Result "Banco de dados conectado" ($dbStatus -eq "healthy") "Status: $dbStatus"
        } catch {
            Test-Result "Banco de dados conectado" $false $_.Exception.Message
        }
    }
} else {
    Write-Warning-Custom "Backend nao esta acessivel, pulando validacoes de API"
}

Write-Host ""

# ============================================
# 6. VALIDAÇÕES DE LOGS
# ============================================

Write-Header "6. Validando Logs"

# Verificar logs do backend
$logFile = Join-Path $BACKEND_LOGS "app.log"
if (Test-Path $logFile) {
    Write-Info "Analisando logs do backend..."
    $logContent = Get-Content $logFile -Tail 100 -ErrorAction SilentlyContinue
    $errorCount = ($logContent | Select-String -Pattern "error|ERROR|Error" -CaseSensitive:$false).Count
    $criticalErrors = $logContent | Select-String -Pattern "FATAL|CRITICAL|ECONNREFUSED|Cannot|Failed" -CaseSensitive:$false
    
    Test-Result "Logs sem erros criticos" ($criticalErrors.Count -eq 0) "Encontrados $($criticalErrors.Count) erros criticos"
    
    if ($criticalErrors.Count -gt 0) {
        Write-Warning-Custom "Erros encontrados nos logs:"
        $criticalErrors | Select-Object -First 5 | ForEach-Object {
            Write-Info "  $($_.Line)"
        }
    }
} else {
    Test-Result "Arquivo de log existe" $false "Log file nao encontrado: $logFile"
}

# Verificar jobs do PowerShell
Write-Info "Verificando jobs do PowerShell..."
$backendJobStatus = Get-Job -Id $backendJob.Id -ErrorAction SilentlyContinue
$frontendJobStatus = Get-Job -Id $frontendJob.Id -ErrorAction SilentlyContinue

Test-Result "Backend job rodando" ($backendJobStatus.State -eq "Running") "Estado: $($backendJobStatus.State)"
Test-Result "Frontend job rodando" ($frontendJobStatus.State -eq "Running") "Estado: $($frontendJobStatus.State)"

Write-Host ""

# ============================================
# 7. VALIDAÇÕES DE PORTAS
# ============================================

Write-Header "7. Validando Portas"

# Verificar porta do backend
Write-Info "Verificando porta $BACKEND_PORT..."
$backendPort = Get-NetTCPConnection -LocalPort $BACKEND_PORT -ErrorAction SilentlyContinue
Test-Result "Porta $BACKEND_PORT em uso (Backend)" ($null -ne $backendPort) "PID: $($backendPort.OwningProcess)"

# Verificar porta do frontend
Write-Info "Verificando porta $FRONTEND_PORT..."
$frontendPort = Get-NetTCPConnection -LocalPort $FRONTEND_PORT -ErrorAction SilentlyContinue
Test-Result "Porta $FRONTEND_PORT em uso (Frontend)" ($null -ne $frontendPort) "PID: $($frontendPort.OwningProcess)"

Write-Host ""

# ============================================
# 8. RELATÓRIO FINAL
# ============================================

Write-Header "8. Relatorio Final"

$successRate = if ($script:totalTests -gt 0) { [math]::Round(($script:passedTests / $script:totalTests) * 100, 2) } else { 0 }

Write-ColorOutput Cyan "========================================"
Write-ColorOutput Cyan "RESUMO DA VALIDACAO"
Write-ColorOutput Cyan "========================================"
Write-Host ""
Write-Info "Total de testes: $script:totalTests"
Write-Success "Testes aprovados: $script:passedTests"
Write-Error-Custom "Testes falhados: $script:failedTests"
Write-Info "Taxa de sucesso: $successRate%"
Write-Host ""

# Gerar relatório em arquivo
$reportContent = @"
========================================
VALIDACAO DO SISTEMA SMART SIGNAGE PRO
========================================
Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Versao: 2.1.0

RESUMO:
- Total de testes: $script:totalTests
- Aprovados: $script:passedTests
- Falhados: $script:failedTests
- Taxa de sucesso: $successRate%

SERVICOS:
- Backend: $BACKEND_URL
- Frontend: $FRONTEND_URL
- Banco de Dados: $DB_HOST`:$DB_PORT/$DB_NAME

ERROS ENCONTRADOS:
$($script:errors -join "`n")

========================================
"@

$reportContent | Out-File -FilePath $REPORT_FILE -Encoding UTF8
Write-Success "Relatorio salvo em: $REPORT_FILE"

if ($script:failedTests -eq 0) {
    Write-ColorOutput Green "========================================"
    Write-ColorOutput Green "SISTEMA VALIDADO COM SUCESSO!"
    Write-ColorOutput Green "========================================"
    Write-Host ""
    Write-Info "Backend: $BACKEND_URL"
    Write-Info "Frontend: $FRONTEND_URL"
    Write-Info "API Docs: $BACKEND_URL/api-docs"
    Write-Info "Health Check: $BACKEND_URL/api/health/check"
    Write-Host ""
    Write-Info "Para parar os servicos, execute: .\PARAR-SERVICOS.ps1"
} else {
    Write-ColorOutput Yellow "========================================"
    Write-ColorOutput Yellow "VALIDACAO CONCLUIDA COM ERROS"
    Write-ColorOutput Yellow "========================================"
    Write-Host ""
    Write-Warning-Custom "Alguns testes falharam. Verifique o relatorio para detalhes."
    Write-Host ""
    Write-Info "Relatorio: $REPORT_FILE"
}

Write-Host ""

