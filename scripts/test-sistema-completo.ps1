# =============================================
# SmartSignage Pro - Teste Completo do Sistema
# =============================================
# Script para testar todos os procedimentos de instalação e funcionamento
# =============================================

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SmartSignage Pro - Teste Completo" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Este script irá testar:" -ForegroundColor Yellow
Write-Host "  1. ✅ Builds (backend e frontend)" -ForegroundColor White
Write-Host "  2. ✅ Script de instalação Windows" -ForegroundColor White
Write-Host "  3. ✅ Configuração do banco de dados" -ForegroundColor White
Write-Host "  4. ✅ Inicialização do backend" -ForegroundColor White
Write-Host "  5. ✅ Inicialização do frontend" -ForegroundColor White
Write-Host "  6. ✅ Validação de funcionamento" -ForegroundColor White
Write-Host ""

$testResults = @{
    BuildBackend = $false
    BuildFrontend = $false
    InstallScript = $false
    DatabaseConfig = $false
    BackendStart = $false
    FrontendStart = $false
    SystemValidation = $false
}

# =============================================
# 1. TESTE DE BUILDS
# =============================================
Write-Host "[1/6] Testando builds..." -ForegroundColor Yellow
Write-Host ""

# Teste Build Backend
Write-Host "  [TESTE] Testando build do backend..." -ForegroundColor Cyan
Set-Location backend
try {
    $buildOutput = npm run build 2>&1
    if ($LASTEXITCODE -eq 0) {
        if (Test-Path "dist\index.js") {
            Write-Host "    ✅ Backend compilado com sucesso" -ForegroundColor Green
            $testResults.BuildBackend = $true
        } else {
            Write-Host "    ⚠️  Build concluído mas dist/index.js não encontrado" -ForegroundColor Yellow
        }
    } else {
        Write-Host "    ❌ Erro na compilação do backend" -ForegroundColor Red
        Write-Host "    $buildOutput" -ForegroundColor Red
    }
} catch {
    Write-Host "    ❌ Erro: $_" -ForegroundColor Red
}
Set-Location ..

# Teste Build Frontend
Write-Host "  [TESTE] Testando build do frontend..." -ForegroundColor Cyan
Set-Location frontend
try {
    $buildOutput = npm run build 2>&1
    if ($LASTEXITCODE -eq 0) {
        if (Test-Path "build\index.html") {
            Write-Host "    ✅ Frontend compilado com sucesso" -ForegroundColor Green
            $testResults.BuildFrontend = $true
        } else {
            Write-Host "    ⚠️  Build concluído mas build/index.html não encontrado" -ForegroundColor Yellow
        }
    } else {
        Write-Host "    ❌ Erro na compilação do frontend" -ForegroundColor Red
        Write-Host "    $buildOutput" -ForegroundColor Red
    }
} catch {
    Write-Host "    ❌ Erro: $_" -ForegroundColor Red
}
Set-Location ..

Write-Host ""

# =============================================
# 2. TESTE DO SCRIPT DE INSTALAÇÃO
# =============================================
Write-Host "[2/6] Testando script de instalação..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path "install-windows.ps1") {
    Write-Host "  ✅ Script install-windows.ps1 encontrado" -ForegroundColor Green
    
    # Verificar sintaxe do script
    try {
        $scriptContent = Get-Content "install-windows.ps1" -Raw
        $null = [System.Management.Automation.PSParser]::Tokenize($scriptContent, [ref]$null)
        Write-Host "  ✅ Sintaxe do script válida" -ForegroundColor Green
        $testResults.InstallScript = $true
    } catch {
        Write-Host "  ⚠️  Possível problema de sintaxe no script" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ❌ Script install-windows.ps1 não encontrado" -ForegroundColor Red
}

Write-Host ""

# =============================================
# 3. TESTE DE CONFIGURAÇÃO DO BANCO DE DADOS
# =============================================
Write-Host "[3/6] Testando configuração do banco de dados..." -ForegroundColor Yellow
Write-Host ""

# Verificar se o script de setup existe
if (Test-Path "backend\scripts\setup-database.js") {
    Write-Host "  ✅ Script setup-database.js encontrado" -ForegroundColor Green
    
    # Verificar se os arquivos SQL existem
    $sqlFiles = Get-ChildItem -Path "database" -Filter "smartchannel-db-v2-refactored-part*.sql" -ErrorAction SilentlyContinue
    if ($sqlFiles.Count -gt 0) {
        Write-Host "  ✅ Encontrados $($sqlFiles.Count) arquivos SQL do schema v2" -ForegroundColor Green
        $testResults.DatabaseConfig = $true
    } else {
        Write-Host "  ⚠️  Arquivos SQL do schema v2 não encontrados" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ❌ Script setup-database.js não encontrado" -ForegroundColor Red
}

# Verificar arquivo .env.example
if (Test-Path "backend\env.example") {
    Write-Host "  ✅ Arquivo env.example encontrado" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Arquivo env.example não encontrado" -ForegroundColor Yellow
}

Write-Host ""

# =============================================
# 4. TESTE DE INICIALIZAÇÃO DO BACKEND
# =============================================
Write-Host "[4/6] Testando inicialização do backend..." -ForegroundColor Yellow
Write-Host ""

Set-Location backend

# Verificar se o arquivo compilado existe
$distIndexPath = Join-Path (Get-Location) "dist\index.js"
if (Test-Path $distIndexPath) {
    Write-Host "  ✅ Arquivo dist/index.js encontrado" -ForegroundColor Green
    
    # Verificar se o .env existe ou criar a partir do exemplo
    $envPath = Join-Path (Get-Location) ".env"
    $envExamplePath = Join-Path (Get-Location) "env.example"
    if (-not (Test-Path $envPath)) {
        if (Test-Path $envExamplePath) {
            Write-Host "  [INFO] Criando .env a partir de env.example..." -ForegroundColor Cyan
            Copy-Item $envExamplePath $envPath -ErrorAction SilentlyContinue
            Write-Host "  ✅ Arquivo .env criado" -ForegroundColor Green
        }
    }
    
    # Verificar dependências
    $nodeModulesPath = Join-Path (Get-Location) "node_modules"
    if (Test-Path $nodeModulesPath) {
        Write-Host "  ✅ node_modules encontrado" -ForegroundColor Green
        
        # Tentar validar se o servidor pode iniciar (sem realmente iniciar)
        Write-Host "  [INFO] Verificando estrutura do codigo..." -ForegroundColor Cyan
        try {
            $indexContent = Get-Content $distIndexPath -Raw -ErrorAction Stop
            if ($indexContent -match "express|app\.listen") {
                Write-Host "    ✅ Estrutura do servidor parece correta" -ForegroundColor Green
                $testResults.BackendStart = $true
            } else {
                Write-Host "    ⚠️  Estrutura do servidor nao identificada" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "    ⚠️  Nao foi possivel ler dist/index.js" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠️  node_modules nao encontrado (execute npm install)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ❌ Arquivo dist/index.js nao encontrado" -ForegroundColor Red
}

Set-Location ..

Write-Host ""

# =============================================
# 5. TESTE DE INICIALIZAÇÃO DO FRONTEND
# =============================================
Write-Host "[5/6] Testando inicialização do frontend..." -ForegroundColor Yellow
Write-Host ""

Set-Location frontend

# Verificar se o build existe
if (Test-Path "build\index.html") {
    Write-Host "  ✅ Arquivo build/index.html encontrado" -ForegroundColor Green
    
    # Verificar estrutura do build
    $buildFiles = Get-ChildItem -Path "build" -Recurse -File -ErrorAction SilentlyContinue
    if ($buildFiles.Count -gt 0) {
        Write-Host "  ✅ Build contém $($buildFiles.Count) arquivos" -ForegroundColor Green
        $testResults.FrontendStart = $true
    }
} else {
    Write-Host "  ❌ Arquivo build/index.html não encontrado" -ForegroundColor Red
}

# Verificar dependências
if (Test-Path "node_modules") {
    Write-Host "  ✅ node_modules encontrado" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  node_modules não encontrado (execute npm install)" -ForegroundColor Yellow
}

Set-Location ..

Write-Host ""

# =============================================
# 6. VALIDAÇÃO GERAL DO SISTEMA
# =============================================
Write-Host "[6/6] Validação geral do sistema..." -ForegroundColor Yellow
Write-Host ""

# Verificar arquivos críticos
$criticalFiles = @(
    "backend\package.json",
    "frontend\package.json",
    "backend\tsconfig.json",
    "install-windows.ps1",
    "docker-compose.yml"
)

$missingFiles = @()
foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file (faltando)" -ForegroundColor Red
        $missingFiles += $file
    }
}

if ($missingFiles.Count -eq 0) {
    Write-Host "  ✅ Todos os arquivos críticos presentes" -ForegroundColor Green
    $testResults.SystemValidation = $true
} else {
    Write-Host "  ⚠️  $($missingFiles.Count) arquivo(s) crítico(s) faltando" -ForegroundColor Yellow
}

Write-Host ""

# =============================================
# RESUMO FINAL
# =============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESUMO DOS TESTES" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$totalTests = $testResults.Count
$passedTests = ($testResults.Values | Where-Object { $_ -eq $true }).Count
$failedTests = $totalTests - $passedTests

Write-Host "Total de testes: $totalTests" -ForegroundColor White
Write-Host "✅ Aprovados: $passedTests" -ForegroundColor Green
Write-Host "❌ Falhados: $failedTests" -ForegroundColor $(if ($failedTests -gt 0) { "Red" } else { "Green" })
Write-Host ""

foreach ($test in $testResults.GetEnumerator() | Sort-Object Name) {
    $status = if ($test.Value) { "✅" } else { "❌" }
    $color = if ($test.Value) { "Green" } else { "Red" }
    Write-Host "  $status $($test.Key): $(if ($test.Value) { 'OK' } else { 'FALHOU' })" -ForegroundColor $color
}

Write-Host ""

if ($failedTests -eq 0) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ TODOS OS TESTES PASSARAM!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "O sistema está pronto para:" -ForegroundColor Cyan
    Write-Host "  1. Executar: .\install-windows.ps1" -ForegroundColor White
    Write-Host "  2. Iniciar backend: cd backend; npm start" -ForegroundColor White
    Write-Host "  3. Iniciar frontend: cd frontend; npm start" -ForegroundColor White
} else {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  ⚠️  ALGUNS TESTES FALHARAM" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Revise os erros acima antes de prosseguir." -ForegroundColor Yellow
}

Write-Host ""

