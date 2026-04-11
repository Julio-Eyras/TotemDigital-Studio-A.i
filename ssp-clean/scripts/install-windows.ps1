# =============================================
# SmartSignage Pro - Script de Instalação Windows
# =============================================
# Este script instala e configura o sistema completo
# =============================================

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "SmartSignage Pro - Instalação Windows" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se está no diretório correto
if (-not (Test-Path "backend\package.json")) {
    Write-Host "❌ ERRO: Execute este script na raiz do projeto SmartSignage-Pro" -ForegroundColor Red
    exit 1
}

# =============================================
# 1. VERIFICAR PRÉ-REQUISITOS
# =============================================
Write-Host "[1/7] Verificando pré-requisitos..." -ForegroundColor Yellow

# Verificar Node.js
try {
    $nodeVersion = node --version
    Write-Host "   ✅ Node.js encontrado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js não encontrado!" -ForegroundColor Red
    Write-Host "   📥 Instale Node.js 18+ de: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Verificar npm
try {
    $npmVersion = npm --version
    Write-Host "   ✅ npm encontrado: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ npm não encontrado!" -ForegroundColor Red
    exit 1
}

# Verificar PostgreSQL
try {
    $pgVersion = psql --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ PostgreSQL encontrado" -ForegroundColor Green
    } else {
        throw "PostgreSQL não encontrado"
    }
} catch {
    Write-Host "   ⚠️  PostgreSQL não encontrado no PATH" -ForegroundColor Yellow
    Write-Host "   ℹ️  Certifique-se de que o PostgreSQL está instalado" -ForegroundColor Yellow
}

# Verificar Redis
$redisInstalled = $false
try {
    # Verificar se redis-server está no PATH
    $redisCheck = redis-server --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Redis encontrado" -ForegroundColor Green
        $redisInstalled = $true
    } else {
        throw "Redis não encontrado"
    }
} catch {
    # Verificar se Redis está rodando como serviço
    $redisService = Get-Service -Name "Redis" -ErrorAction SilentlyContinue
    if ($redisService) {
        Write-Host "   ✅ Redis (serviço) encontrado" -ForegroundColor Green
        $redisInstalled = $true
    } else {
        Write-Host "   ⚠️  Redis não encontrado. Tentando instalar..." -ForegroundColor Yellow
        
        # Tentar instalar via Chocolatey
        try {
            $chocoVersion = choco --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   📦 Chocolatey encontrado. Instalando Redis..." -ForegroundColor Cyan
                Write-Host "   ⚠️  Esta operação pode requerer permissões de administrador" -ForegroundColor Yellow
                
                # Instalar Redis via Chocolatey (pode precisar de permissões elevadas)
                $installOutput = choco install redis-64 -y 2>&1
                
                if ($LASTEXITCODE -eq 0 -or ($installOutput -match "already installed")) {
                    Write-Host "   ✅ Redis instalado via Chocolatey" -ForegroundColor Green
                    $redisInstalled = $true
                    
                    # Aguardar um pouco para o serviço ser criado
                    Start-Sleep -Seconds 2
                    
                    # Tentar iniciar o serviço Redis
                    $redisService = Get-Service -Name "Redis" -ErrorAction SilentlyContinue
                    if ($redisService) {
                        if ($redisService.Status -ne "Running") {
                            Start-Service -Name "Redis" -ErrorAction SilentlyContinue
                        }
                    }
                } else {
                    Write-Host "   ⚠️  Falha ao instalar Redis via Chocolatey" -ForegroundColor Yellow
                    Write-Host "   [DICA] Tente executar como administrador: choco install redis-64 -y" -ForegroundColor Yellow
                }
            }
        } catch {
            # Chocolatey não disponível, continuar sem Redis
            Write-Host "   ⚠️  Chocolatey não encontrado. Redis não será instalado automaticamente." -ForegroundColor Yellow
        }
        
        if (-not $redisInstalled) {
            Write-Host "   ⚠️  Redis não foi instalado automaticamente" -ForegroundColor Yellow
            Write-Host "   ℹ️  Instale Redis manualmente ou use Docker:" -ForegroundColor Yellow
            Write-Host "      - Chocolatey: choco install redis-64" -ForegroundColor Gray
            Write-Host "      - Docker: docker run -d -p 6379:6379 redis" -ForegroundColor Gray
            Write-Host "      - Manual: https://github.com/microsoftarchive/redis/releases" -ForegroundColor Gray
            Write-Host "   ℹ️  O sistema funcionará sem Redis (CACHE_ENABLED=false)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""

# =============================================
# 2. CONFIGURAR BACKEND .ENV
# =============================================
Write-Host "[2/8] Configurando backend..." -ForegroundColor Yellow

# Atualizar configurações para PostgreSQL local e Redis
$cacheEnabled = if ($redisInstalled) { "true" } else { "false" }

if (-not (Test-Path "backend\.env")) {
    Write-Host "   📝 Criando arquivo .env do backend..." -ForegroundColor Cyan
    Copy-Item "backend\env.example" "backend\.env" -ErrorAction SilentlyContinue
} else {
    Write-Host "   📝 Atualizando arquivo .env do backend..." -ForegroundColor Cyan
}

# Atualizar configurações no .env
$envContent = Get-Content "backend\.env" -ErrorAction SilentlyContinue
if ($envContent) {
    $envContent = $envContent -replace "DB_USER=smartsignage", "DB_USER=postgres" `
                              -replace "DB_PASSWORD=smartsignage123", "DB_PASSWORD=postgres" `
                              -replace "DATABASE_URL=postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage", "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartsignage" `
                              -replace "NODE_ENV=production", "NODE_ENV=development" `
                              -replace "CACHE_ENABLED=true", "CACHE_ENABLED=$cacheEnabled" `
                              -replace "CACHE_ENABLED=false", "CACHE_ENABLED=$cacheEnabled"
    
    # Se CACHE_ENABLED nao existir, adicionar
    if ($envContent -notmatch "CACHE_ENABLED=") {
        $envContent += "CACHE_ENABLED=$cacheEnabled"
    }
    
    $envContent | Set-Content "backend\.env"
    Write-Host "   ✅ Arquivo .env configurado (Redis: $cacheEnabled)" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Não foi possível ler/criar arquivo .env" -ForegroundColor Yellow
}

Write-Host ""

# =============================================
# 3. INSTALAR DEPENDÊNCIAS DO BACKEND
# =============================================
Write-Host "[3/8] Instalando dependências do backend..." -ForegroundColor Yellow
Set-Location backend

try {
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Dependências do backend instaladas" -ForegroundColor Green
    } else {
        throw "Erro ao instalar dependências"
    }
} catch {
    Write-Host "   ❌ Erro ao instalar dependências do backend" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..

Write-Host ""

# =============================================
# 4. BUILD DO BACKEND
# =============================================
Write-Host "[4/8] Compilando backend..." -ForegroundColor Yellow
Set-Location backend

try {
    npm run build
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Backend compilado com sucesso" -ForegroundColor Green
    } else {
        throw "Erro na compilação"
    }
} catch {
    Write-Host "   ❌ Erro ao compilar backend" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..

Write-Host ""

# =============================================
# 5. CONFIGURAR BANCO DE DADOS
# =============================================
Write-Host "[5/8] Configurando banco de dados..." -ForegroundColor Yellow

Set-Location backend

try {
    node scripts\setup-database.js
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Banco de dados configurado" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Avisos no banco de dados (pode continuar)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Erro ao configurar banco (pode continuar)" -ForegroundColor Yellow
}

Set-Location ..

Write-Host ""

# =============================================
# 6. CORRIGIR DEPENDÊNCIAS DO FRONTEND
# =============================================
Write-Host "[6/8] Corrigindo e instalando dependências do frontend..." -ForegroundColor Yellow
Set-Location frontend

# Instalar ajv e dependências relacionadas explicitamente
Write-Host "   📦 Instalando ajv e dependências..." -ForegroundColor Cyan
npm install ajv@8.12.0 ajv-keywords@5.1.0 ajv-formats@2.1.1 --save-dev

# Limpar cache e reinstalar
Write-Host "   🧹 Limpando cache..." -ForegroundColor Cyan
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue

# Reinstalar dependências
Write-Host "   📦 Reinstalando dependências..." -ForegroundColor Cyan
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Dependências do frontend instaladas" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Alguns avisos podem aparecer (pode continuar)" -ForegroundColor Yellow
}

Set-Location ..

Write-Host ""

# =============================================
# 7. VERIFICAR E INICIAR REDIS (SE INSTALADO)
# =============================================
Write-Host "[7/8] Verificando Redis..." -ForegroundColor Yellow

if ($redisInstalled) {
    try {
        # Verificar se o serviço Redis está rodando
        $redisService = Get-Service -Name "Redis" -ErrorAction SilentlyContinue
        if ($redisService) {
            if ($redisService.Status -ne "Running") {
                Write-Host "   🔄 Iniciando serviço Redis..." -ForegroundColor Cyan
                Start-Service -Name "Redis" -ErrorAction Stop
                Write-Host "   ✅ Redis iniciado" -ForegroundColor Green
            } else {
                Write-Host "   ✅ Redis já está rodando" -ForegroundColor Green
            }
        } else {
            # Tentar iniciar redis-server diretamente
            Write-Host "   ⚠️  Serviço Redis não encontrado. Inicie manualmente se necessário." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ⚠️  Não foi possível iniciar Redis automaticamente" -ForegroundColor Yellow
        Write-Host "   ℹ️  Inicie manualmente: redis-server" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  Redis não está instalado. Cache desabilitado." -ForegroundColor Yellow
}

Write-Host ""

# =============================================
# 8. RESUMO E PRÓXIMOS PASSOS
# =============================================
Write-Host "[8/8] Instalação concluída!" -ForegroundColor Yellow
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Iniciar o backend:" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Gray
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Em outro terminal, iniciar o frontend:" -ForegroundColor White
Write-Host "   cd frontend" -ForegroundColor Gray
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Acessar o sistema:" -ForegroundColor White
Write-Host "   Backend:  http://localhost:3000" -ForegroundColor Gray
Write-Host "   Frontend: http://localhost:3001" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  NOTAS:" -ForegroundColor Yellow
if ($redisInstalled) {
    Write-Host "   - Redis está instalado e configurado (CACHE_ENABLED=$cacheEnabled)" -ForegroundColor Gray
} else {
    Write-Host "   - Redis não está instalado (CACHE_ENABLED=false)" -ForegroundColor Gray
    Write-Host "   - O sistema funcionará sem Redis para desenvolvimento" -ForegroundColor Gray
    Write-Host "   - Para ativar cache, instale Redis e configure CACHE_ENABLED=true" -ForegroundColor Gray
}
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan

