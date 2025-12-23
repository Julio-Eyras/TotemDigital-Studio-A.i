# Script para Aplicar Schema SQL (PowerShell)
# Aplica o arquivo smartchannel-db.sql de forma segura

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DbFile = Join-Path $ScriptDir "..\smartchannel-db.sql"

Write-Host "🚀 Aplicando schema SQL..." -ForegroundColor Green

# Verificar se o arquivo existe
if (-not (Test-Path $DbFile)) {
    Write-Host "❌ Erro: Arquivo $DbFile não encontrado" -ForegroundColor Red
    exit 1
}

# Solicitar confirmação
$confirm = Read-Host "⚠️  Deseja aplicar o schema no banco de dados? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "Operação cancelada" -ForegroundColor Yellow
    exit 0
}

# Solicitar informações de conexão
$dbHost = Read-Host "Host (localhost)"
if ([string]::IsNullOrEmpty($dbHost)) { $dbHost = "localhost" }

$dbPort = Read-Host "Port (5432)"
if ([string]::IsNullOrEmpty($dbPort)) { $dbPort = "5432" }

$dbName = Read-Host "Database"

$dbUser = Read-Host "User (postgres)"
if ([string]::IsNullOrEmpty($dbUser)) { $dbUser = "postgres" }

$dbPass = Read-Host "Password" -AsSecureString
$dbPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPass)
)

# Aplicar schema
Write-Host "📝 Aplicando schema..." -ForegroundColor Green

$env:PGPASSWORD = $dbPassPlain

try {
    & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $DbFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Schema aplicado com sucesso!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "❌ Erro ao aplicar schema" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erro: $_" -ForegroundColor Red
    exit 1
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

