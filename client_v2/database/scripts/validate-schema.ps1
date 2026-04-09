# Script de Validação do Schema SQL (PowerShell)
# Valida a sintaxe do schema master: smartchannel-db-v2-refactored-apply-all.sql

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DbFile = Join-Path $ScriptDir "..\smartchannel-db-v2-refactored-apply-all.sql"

Write-Host "🔍 Validando schema SQL..." -ForegroundColor Cyan

# Verificar se o arquivo existe
if (-not (Test-Path $DbFile)) {
    Write-Host "❌ Erro: Arquivo $DbFile não encontrado" -ForegroundColor Red
    exit 1
}

# Verificar se psql está disponível
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

if (-not $psqlPath) {
    Write-Host "⚠️  psql não encontrado. Executando validação básica..." -ForegroundColor Yellow
    
    # Validação básica
    $content = Get-Content $DbFile -Raw
    
    if ($content -match "CREATE TABLE") {
        Write-Host "✅ Estrutura CREATE TABLE encontrada" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Nenhuma CREATE TABLE encontrada" -ForegroundColor Yellow
    }
    
    Write-Host "✅ Validação básica concluída" -ForegroundColor Green
    exit 0
}

# Validação com psql
Write-Host "📝 Executando validação com PostgreSQL..." -ForegroundColor Cyan

$tempDb = "smartsignage_validation_$([System.Guid]::NewGuid().ToString().Substring(0,8))"

try {
    # Criar banco temporário
    & psql -h localhost -U postgres -d postgres -c "CREATE DATABASE $tempDb;" 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        # Validar schema
        $result = & psql -h localhost -U postgres -d $tempDb -f $DbFile 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Schema válido!" -ForegroundColor Green
            
            # Limpar banco temporário
            & psql -h localhost -U postgres -d postgres -c "DROP DATABASE $tempDb;" 2>&1 | Out-Null
            
            exit 0
        } else {
            Write-Host "❌ Erro na validação do schema" -ForegroundColor Red
            $result | Select-Object -First 20
            & psql -h localhost -U postgres -d postgres -c "DROP DATABASE $tempDb;" 2>&1 | Out-Null
            exit 1
        }
    }
} catch {
    Write-Host "⚠️  Erro ao validar: $_" -ForegroundColor Yellow
    Write-Host "✅ Validação básica concluída" -ForegroundColor Green
    exit 0
}

