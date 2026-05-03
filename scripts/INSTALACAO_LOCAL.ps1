# Smart Signage Pro - Instalação Local
# Para Windows PowerShell
# 
# Este script instala e configura o backend e frontend na máquina local
# Banco de dados: PostgreSQL (localhost, user: postgres, password: postgres)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Smart Signage Pro - Instalação Local" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Variáveis de configuração
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_USER = "postgres"
$DB_PASSWORD = "postgres"
$DB_NAME = "smartsignage"
$BACKEND_PORT = "3000"
$FRONTEND_PORT = "3001"

# Verificar se Node.js está instalado
Write-Host "Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "Node.js encontrado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERRO: Node.js não encontrado. Por favor, instale Node.js 18+ primeiro." -ForegroundColor Red
    exit 1
}

# Verificar se npm está instalado
Write-Host "Verificando npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "npm encontrado: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "ERRO: npm não encontrado." -ForegroundColor Red
    exit 1
}

# Verificar se PostgreSQL está rodando
Write-Host ""
Write-Host "Verificando PostgreSQL..." -ForegroundColor Yellow
$env:PGPASSWORD = $DB_PASSWORD
try {
    $psqlCheck = & psql -h $DB_HOST -U $DB_USER -d postgres -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "PostgreSQL está rodando e acessível" -ForegroundColor Green
    } else {
        Write-Host "AVISO: Não foi possível conectar ao PostgreSQL. Verifique se está rodando." -ForegroundColor Yellow
        Write-Host "Tentando continuar mesmo assim..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "AVISO: psql não encontrado no PATH. Verificando conexão manualmente..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Configurando Backend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Criar arquivo .env do backend
$backendEnvPath = "backend\.env"
if (Test-Path $backendEnvPath) {
    Write-Host "Arquivo .env do backend já existe. Fazendo backup..." -ForegroundColor Yellow
    Copy-Item $backendEnvPath "$backendEnvPath.backup"
}

$DATABASE_URL = "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

$backendEnvContent = @"
# Smart Signage Pro v2.1 - Configuração Local
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
# AUTENTICAÇÃO JWT
# =============================================
JWT_SECRET=dev-secret-key-change-in-production-$(Get-Random)
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# =============================================
# AUTENTICAÇÃO DE DOIS FATORES (2FA)
# =============================================
TWO_FACTOR_ENCRYPTION_KEY=dev-2fa-key-change-in-production-$(Get-Random)

# =============================================
# SEGURANÇA
# =============================================
PLAYER_ABANDON_PIN=1234
BCRYPT_ROUNDS=12

# =============================================
# CORS
# =============================================
CORS_ORIGIN=http://localhost:$BACKEND_PORT,http://localhost:$FRONTEND_PORT,http://localhost:8080

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
MAX_PAYLOAD_SIZE=0

# =============================================
# UPLOAD DE ARQUIVOS
# =============================================
UPLOAD_MAX_SIZE=2GB
UPLOAD_PATH=./public/assets/uploads
MEDIA_QUOTA_PER_CLIENT=5GB
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,audio/mp3,audio/wav,audio/ogg

# =============================================
# REDIS / CACHE (opcional - pode estar desabilitado)
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
# EMAIL (desabilitado por padrão)
# =============================================
EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Smart Signage <noreply@smartsignage.com>
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

Set-Content -Path $backendEnvPath -Value $backendEnvContent -Encoding UTF8
Write-Host "Arquivo .env do backend criado em: $backendEnvPath" -ForegroundColor Green

# Instalar dependências do backend
Write-Host ""
Write-Host "Instalando dependências do backend..." -ForegroundColor Yellow
Set-Location backend
if (Test-Path "node_modules") {
    Write-Host "node_modules já existe. Pulando instalação..." -ForegroundColor Yellow
} else {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: Falha ao instalar dependências do backend" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
}
Write-Host "Dependências do backend instaladas com sucesso!" -ForegroundColor Green
Set-Location ..

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "2. Configurando Banco de Dados" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Criar banco de dados se não existir
Write-Host "Criando banco de dados '$DB_NAME' se não existir..." -ForegroundColor Yellow
$env:PGPASSWORD = $DB_PASSWORD
$createDbQuery = "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'"
$dbExists = & psql -h $DB_HOST -U $DB_USER -d postgres -t -c $createDbQuery 2>&1

if ($dbExists -match "1") {
    Write-Host "Banco de dados '$DB_NAME' já existe." -ForegroundColor Yellow
} else {
    Write-Host "Criando banco de dados '$DB_NAME'..." -ForegroundColor Yellow
    & psql -h $DB_HOST -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Banco de dados criado com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "AVISO: Não foi possível criar o banco automaticamente. Crie manualmente:" -ForegroundColor Yellow
        Write-Host "psql -U $DB_USER -c `"CREATE DATABASE $DB_NAME;`"" -ForegroundColor Yellow
    }
}

# Executar scripts SQL
Write-Host ""
Write-Host "Executando scripts SQL de criação do schema..." -ForegroundColor Yellow

$sqlFiles = @(
    "database\smartchannel-db-v2-refactored-part1-schema-setup.sql",
    "database\smartchannel-db-v2-refactored-part2-tables-base.sql",
    "database\smartchannel-db-v2-refactored-part3-tables-dependent.sql",
    "database\smartchannel-db-v2-refactored-part4-billing-contracts.sql",
    "database\smartchannel-db-v2-refactored-part5-tables-relationships.sql",
    "database\smartchannel-db-v2-refactored-part6-tables-other.sql",
    "database\smartchannel-db-v2-refactored-part7-foreign-keys.sql",
    "database\smartchannel-db-v2-refactored-part8-indexes.sql",
    "database\smartchannel-db-v2-refactored-part9-triggers-functions.sql",
    "database\smartchannel-db-v2-refactored-part10-views.sql",
    "database\smartchannel-db-v2-refactored-part11-playlist-mix.sql",
    "database\smartchannel-db-v2-refactored-part12-playlist-mix-functions.sql"
)

foreach ($sqlFile in $sqlFiles) {
    if (Test-Path $sqlFile) {
        Write-Host "  Executando: $sqlFile" -ForegroundColor Gray
        $env:PGPASSWORD = $DB_PASSWORD
        Get-Content $sqlFile | & psql -h $DB_HOST -U $DB_USER -d $DB_NAME 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  AVISO: Erros ao executar $sqlFile (pode ser esperado se já foi executado antes)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  AVISO: Arquivo não encontrado: $sqlFile" -ForegroundColor Yellow
    }
}

# Executar seeds se existirem
if (Test-Path "database\seeds-default-settings.sql") {
    Write-Host "Executando seeds (dados iniciais)..." -ForegroundColor Yellow
    $env:PGPASSWORD = $DB_PASSWORD
    Get-Content "database\seeds-default-settings.sql" | & psql -h $DB_HOST -U $DB_USER -d $DB_NAME 2>&1 | Out-Null
}

Write-Host "Schema do banco de dados configurado!" -ForegroundColor Green

# Compilar backend
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "3. Compilando Backend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Set-Location backend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Falha ao compilar backend" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "Backend compilado com sucesso!" -ForegroundColor Green
Set-Location ..

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "4. Configurando Frontend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Instalar dependências do frontend
Write-Host "Instalando dependências do frontend..." -ForegroundColor Yellow
Set-Location frontend
if (Test-Path "node_modules") {
    Write-Host "node_modules já existe. Pulando instalação..." -ForegroundColor Yellow
} else {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: Falha ao instalar dependências do frontend" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
}
Write-Host "Dependências do frontend instaladas com sucesso!" -ForegroundColor Green
Set-Location ..

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Instalação Concluída!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Iniciar Backend:" -ForegroundColor Yellow
Write-Host "   cd backend" -ForegroundColor White
Write-Host "   npm run dev    # Modo desenvolvimento" -ForegroundColor White
Write-Host "   npm start      # Modo produção" -ForegroundColor White
Write-Host ""
Write-Host "2. Iniciar Frontend (em outro terminal):" -ForegroundColor Yellow
Write-Host "   cd frontend" -ForegroundColor White
Write-Host "   npm start" -ForegroundColor White
Write-Host ""
Write-Host "3. Acessar:" -ForegroundColor Yellow
Write-Host "   Frontend: http://localhost:$FRONTEND_PORT" -ForegroundColor White
Write-Host "   Backend API: http://localhost:$BACKEND_PORT" -ForegroundColor White
Write-Host ""
Write-Host "Configurações do banco:" -ForegroundColor Cyan
Write-Host "   Host: $DB_HOST" -ForegroundColor White
Write-Host "   Port: $DB_PORT" -ForegroundColor White
Write-Host "   Database: $DB_NAME" -ForegroundColor White
Write-Host "   User: $DB_USER" -ForegroundColor White
Write-Host ""

