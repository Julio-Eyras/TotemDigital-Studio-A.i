# ============================================
# Smart Signage Pro - Script de Instalação Completa
# Windows PowerShell
# ============================================
# Este script instala e configura todo o sistema:
# - Backend (Node.js/Express)
# - Frontend (React)
# - Banco de Dados PostgreSQL
# ============================================

# Configurações
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
    Write-ColorOutput -ForegroundColor Cyan -Message "========================================"
    Write-ColorOutput -ForegroundColor Cyan -Message $text
    Write-ColorOutput -ForegroundColor Cyan -Message "========================================"
    Write-Host ""
}

function Write-Success($text) {
    Write-ColorOutput -ForegroundColor Green -Message "[OK] $text"
}

function Write-Error-Custom($text) {
    Write-ColorOutput -ForegroundColor Red -Message "[ERRO] $text"
}

function Write-Warning-Custom($text) {
    Write-ColorOutput -ForegroundColor Yellow -Message "[AVISO] $text"
}

function Write-Info($text) {
    Write-ColorOutput -ForegroundColor Gray -Message "  $text"
}

# Variáveis de configuração
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_USER = "postgres"
$DB_PASSWORD = "postgres"
$DB_NAME = "smartsignage"
$BACKEND_PORT = "3000"
$FRONTEND_PORT = "3001"

# Caminhos
$ROOT_DIR = $PSScriptRoot
$BACKEND_DIR = Join-Path $ROOT_DIR "backend"
$FRONTEND_DIR = Join-Path $ROOT_DIR "frontend"
$DATABASE_DIR = Join-Path $ROOT_DIR "database"
$BACKEND_ENV = Join-Path $BACKEND_DIR ".env"

# ============================================
# 1. VERIFICAÇÕES INICIAIS
# ============================================

Write-Header "Smart Signage Pro - Instalação Completa"

Write-Host "Verificando pré-requisitos..." -ForegroundColor Yellow
Write-Host ""

# Verificar Node.js
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Node.js encontrado: $nodeVersion"
        
        # Verificar versão mínima (18+)
        $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        if ($versionNumber -lt 18) {
            Write-Error-Custom "Node.js versão 18+ é necessário. Versão atual: $nodeVersion"
            exit 1
        }
    } else {
        throw "Node.js não encontrado"
    }
} catch {
    Write-Error-Custom "Node.js não encontrado. Por favor, instale Node.js 18+ primeiro."
    Write-Info "Download: https://nodejs.org/"
    exit 1
}

# Verificar npm
try {
    $npmVersion = npm --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "npm encontrado: $npmVersion"
    } else {
        throw "npm não encontrado"
    }
} catch {
    Write-Error-Custom "npm não encontrado."
    exit 1
}

# Verificar PostgreSQL (opcional - apenas aviso)
Write-Host ""
Write-Info "Verificando PostgreSQL..."
$pgFound = $false
try {
    $pgVersion = psql --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "PostgreSQL encontrado: $pgVersion"
        $pgFound = $true
        
        # Testar conexão
        $env:PGPASSWORD = $DB_PASSWORD
        $testConn = psql -h $DB_HOST -U $DB_USER -d postgres -c 'SELECT version();' 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Conexao com PostgreSQL estabelecida"
        } else {
            Write-Warning-Custom "Não foi possível conectar ao PostgreSQL. Verifique se está rodando."
            Write-Info "O script tentará usar Node.js para criar o banco."
        }
    }
} catch {
    Write-Warning-Custom "psql não encontrado no PATH. O script usará Node.js para configurar o banco."
}

Write-Host ""

# ============================================
# 2. CONFIGURAR BACKEND
# ============================================

Write-Header "1. Configurando Backend"

# Verificar se diretório backend existe
if (-not (Test-Path $BACKEND_DIR)) {
    Write-Error-Custom "Diretório 'backend' não encontrado!"
    exit 1
}

# Criar arquivo .env do backend
Write-Info "Criando arquivo .env do backend..."

if (Test-Path $BACKEND_ENV) {
    $backupPath = "$BACKEND_ENV.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $BACKEND_ENV $backupPath -Force
    Write-Info "Backup do .env existente criado em: $(Split-Path $backupPath -Leaf)"
}

# Gerar JWT secrets aleatórios
$jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$twoFactorKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

$DATABASE_URL = "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Construir conteúdo .env linha por linha para evitar problemas com caracteres especiais
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

# =============================================
# BANCO DE DADOS (PostgreSQL)
# =============================================
DB_DRIVER=postgresql
DATABASE_URL=$DATABASE_URL
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_POOL_SIZE=20
DB_CONNECTION_TIMEOUT=30000

# =============================================
# AUTENTICACAO JWT
# =============================================
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# =============================================
# AUTENTICACAO DE DOIS FATORES (2FA)
# =============================================
TWO_FACTOR_ENCRYPTION_KEY=$twoFactorKey

# =============================================
# SEGURANCA
# =============================================
PLAYER_ABANDON_PIN=1234
BCRYPT_ROUNDS=12

# =============================================
# CORS
# =============================================
CORS_ORIGIN=$corsOrigin

# =============================================
# RATE LIMITING
# =============================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_REQUESTS=5
UPLOAD_RATE_LIMIT_WINDOW_MS=3600000
UPLOAD_RATE_LIMIT_MAX_REQUESTS=20
SENSITIVE_RATE_LIMIT_WINDOW_MS=600000
SENSITIVE_RATE_LIMIT_MAX_REQUESTS=10
MAX_PAYLOAD_SIZE=10MB

# =============================================
# UPLOAD DE ARQUIVOS
# =============================================
UPLOAD_MAX_SIZE=100MB
UPLOAD_PATH=./public/assets/uploads
MEDIA_QUOTA_PER_CLIENT=5GB
ALLOWED_FILE_TYPES=$allowedFileTypes

# =============================================
# REDIS / CACHE (opcional - desabilitado por padrao)
# =============================================
CACHE_ENABLED=false
CACHE_TTL=3600
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# =============================================
# LOGGING
# =============================================
LOG_LEVEL=info
LOG_FILE=./logs/app.log
LOG_MAX_SIZE=10MB
LOG_MAX_FILES=5
LOG_ENABLE_CONSOLE=true

# =============================================
# IA / SMART PLAYLIST (opcional)
# =============================================
AI_PROVIDER=ollama
AI_MODEL=llama3.2:3b
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_TIMEOUT=30000

# =============================================
# EMAIL (desabilitado por padrao)
# =============================================
EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=$smtpFrom
SMTP_TLS_REJECT_UNAUTHORIZED=true
FRONTEND_URL=http://localhost:$FRONTEND_PORT

# =============================================
# MONITORAMENTO (opcional)
# =============================================
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=false

# =============================================
# BACKUP
# =============================================
BACKUP_ENABLED=false
BACKUP_INTERVAL=24h
BACKUP_RETENTION_DAYS=30
BACKUP_PATH=./backups

# =============================================
# ANALYTICS
# =============================================
ANALYTICS_ENABLED=true
ANALYTICS_RETENTION_DAYS=365
ANALYTICS_BATCH_SIZE=1000

# =============================================
# STRIPE / PAGAMENTOS (desabilitado)
# =============================================
STRIPE_ENABLED=false

# =============================================
# DESENVOLVIMENTO
# =============================================
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

# Instalar dependências do backend
Write-Host ""
Write-Info "Instalando dependências do backend..."
Write-Info "Isso pode levar alguns minutos..."

Push-Location $BACKEND_DIR
try {
    npm install 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Dependências do backend instaladas com sucesso!"
    } else {
        Write-Error-Custom "Erro ao instalar dependências do backend"
        Pop-Location
        exit 1
    }
} catch {
    Write-Error-Custom "Erro ao instalar dependências: $_"
    Pop-Location
    exit 1
}
Pop-Location

# ============================================
# 3. CONFIGURAR BANCO DE DADOS
# ============================================

Write-Host ""
Write-Header "2. Configurando Banco de Dados"

# Criar diretório de logs se não existir
$logsDir = Join-Path $BACKEND_DIR "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

# Executar script Node.js para configurar banco
Write-Info "Criando banco de dados e aplicando schema..."

$setupScript = Join-Path $BACKEND_DIR "scripts\setup-database.js"

if (Test-Path $setupScript) {
    Push-Location $BACKEND_DIR
    try {
        node scripts/setup-database.js 2>&1 | Tee-Object -Variable output
        
        # Verificar se houve sucesso (procura por mensagens de sucesso)
        if ($output -match "Configuração do banco de dados concluída" -or 
            $output -match "Schema aplicado com sucesso") {
            Write-Success "Banco de dados configurado com sucesso!"
        } else {
            Write-Warning-Custom "Pode ter havido problemas ao configurar o banco. Verifique os logs acima."
            Write-Info "Se necessario, execute manualmente: cd backend; node scripts/setup-database.js"
        }
    } catch {
        Write-Warning-Custom "Erro ao executar script de setup do banco: $_"
        Write-Info "Voce pode executar manualmente: cd backend; node scripts/setup-database.js"
    }
    Pop-Location
} else {
    Write-Warning-Custom "Script de setup do banco não encontrado: $setupScript"
    Write-Info "Execute manualmente os scripts SQL na pasta database/"
}

# ============================================
# 4. COMPILAR BACKEND
# ============================================

Write-Host ""
Write-Header "3. Compilando Backend"

Push-Location $BACKEND_DIR
Write-Info "Compilando TypeScript para JavaScript..."
try {
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Backend compilado com sucesso!"
    } else {
        Write-Error-Custom "Erro ao compilar backend"
        Pop-Location
        exit 1
    }
} catch {
    Write-Error-Custom "Erro ao compilar: $_"
    Pop-Location
    exit 1
}
Pop-Location

# ============================================
# 5. CONFIGURAR FRONTEND
# ============================================

Write-Host ""
Write-Header "4. Configurando Frontend"

# Verificar se diretório frontend existe
if (-not (Test-Path $FRONTEND_DIR)) {
    Write-Error-Custom "Diretório 'frontend' não encontrado!"
    exit 1
}

# Instalar dependências do frontend
Write-Info "Instalando dependências do frontend..."
Write-Info "Isso pode levar vários minutos..."

Push-Location $FRONTEND_DIR
try {
    npm install 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Dependências do frontend instaladas com sucesso!"
    } else {
        Write-Error-Custom "Erro ao instalar dependências do frontend"
        Pop-Location
        exit 1
    }
} catch {
    Write-Error-Custom "Erro ao instalar dependências: $_"
    Pop-Location
    exit 1
}
Pop-Location

# ============================================
# 6. RESUMO E PRÓXIMOS PASSOS
# ============================================

Write-Host ""
Write-Header "Instalação Concluída!"

Write-Host "Todos os componentes foram instalados e configurados com sucesso!" -ForegroundColor Green
Write-Host ""

Write-Host "Proximos Passos:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Iniciar Backend:" -ForegroundColor Yellow
Write-ColorOutput -ForegroundColor White -Message "   cd backend"
Write-ColorOutput -ForegroundColor White -Message "   npm run dev    # Modo desenvolvimento (com hot-reload)"
Write-ColorOutput -ForegroundColor White -Message "   npm start      # Modo producao"
Write-Host ""

Write-Host "2. Iniciar Frontend (em OUTRO terminal):" -ForegroundColor Yellow
Write-ColorOutput -ForegroundColor White -Message "   cd frontend"
Write-ColorOutput -ForegroundColor White -Message "   npm start"
Write-Host ""

Write-Host "3. Acessar o Sistema:" -ForegroundColor Yellow
Write-ColorOutput -ForegroundColor White -Message "   Frontend: http://localhost:$FRONTEND_PORT"
Write-ColorOutput -ForegroundColor White -Message "   Backend API: http://localhost:$BACKEND_PORT"
Write-ColorOutput -ForegroundColor White -Message "   Health Check: http://localhost:$BACKEND_PORT/api/health"
Write-Host ""

Write-Host "Configuracoes Aplicadas:" -ForegroundColor Cyan
Write-ColorOutput -ForegroundColor White -Message "   Banco de Dados: $DB_NAME"
Write-ColorOutput -ForegroundColor White -Message "   Host: $DB_HOST"
Write-ColorOutput -ForegroundColor White -Message "   Port: $DB_PORT"
Write-ColorOutput -ForegroundColor White -Message "   User: $DB_USER"
Write-Host ""

Write-Host "Arquivos Importantes:" -ForegroundColor Cyan
Write-ColorOutput -ForegroundColor White -Message "   Backend .env: backend\.env"
Write-ColorOutput -ForegroundColor White -Message "   Logs Backend: backend\logs\app.log"
Write-ColorOutput -ForegroundColor White -Message "   Scripts SQL: database\"
Write-Host ""

Write-Host "Dicas:" -ForegroundColor Cyan
Write-ColorOutput -ForegroundColor White -Message "   - Mantenha o backend rodando enquanto usa o frontend"
Write-ColorOutput -ForegroundColor White -Message "   - Verifique os logs se houver problemas"
Write-ColorOutput -ForegroundColor White -Message "   - O backend precisa estar rodando antes de usar o frontend"
Write-Host ""

Write-Host "Documentacao:" -ForegroundColor Cyan
Write-ColorOutput -ForegroundColor White -Message "   Guia de Instalacao: GUIA_INSTALACAO_LOCAL.md"
Write-Host ""

Write-ColorOutput -ForegroundColor Green -Message "========================================"
Write-ColorOutput -ForegroundColor Green -Message "Sistema pronto para uso!"
Write-ColorOutput -ForegroundColor Green -Message "========================================"
Write-Host ""


