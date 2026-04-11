# Script de Teste PowerShell - Validação Build Docker após Renomeação player/ → player-web/

$ErrorActionPreference = "Stop"

Write-Host "🧪 TESTE: Validação Build Docker - Renomeação player/ → player-web/" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Funções
function Log-Info {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Log-Warn {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Log-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

# 1. Verificar se diretório player-web existe
Write-Host "1️⃣  Verificando diretório player-web/..." -ForegroundColor Cyan
if (Test-Path "player-web" -PathType Container) {
    Log-Info "Diretório player-web/ existe"
    if (Test-Path "player-web/index.html" -PathType Leaf) {
        Log-Info "Arquivo player-web/index.html encontrado"
    } else {
        Log-Warn "player-web/index.html não encontrado"
    }
} else {
    Log-Error "Diretório player-web/ NÃO existe!"
    exit 1
}

# 2. Verificar se diretório player NÃO existe (deve ter sido renomeado)
Write-Host ""
Write-Host "2️⃣  Verificando que diretório player/ não existe..." -ForegroundColor Cyan
if (Test-Path "player" -PathType Container) {
    Log-Error "Diretório player/ ainda existe! Deveria ter sido renomeado."
    exit 1
} else {
    Log-Info "Diretório player/ não existe (correto - foi renomeado)"
}

# 3. Verificar referências em Dockerfile
Write-Host ""
Write-Host "3️⃣  Verificando Dockerfile..." -ForegroundColor Cyan
$dockerfileContent = Get-Content "Dockerfile" -Raw
if ($dockerfileContent -match "COPY player-web/") {
    Log-Info "Dockerfile contém 'COPY player-web/'"
} else {
    Log-Error "Dockerfile NÃO contém 'COPY player-web/'"
    exit 1
}

if ($dockerfileContent -match "/app/player-web") {
    Log-Info "Dockerfile contém '/app/player-web'"
} else {
    Log-Error "Dockerfile NÃO contém '/app/player-web'"
    exit 1
}

# 4. Verificar referências em nginx
Write-Host ""
Write-Host "4️⃣  Verificando nginx/nginx-reverse-proxy.conf..." -ForegroundColor Cyan
$nginxContent = Get-Content "nginx/nginx-reverse-proxy.conf" -Raw
if ($nginxContent -match "alias /usr/share/nginx/html/player-web/") {
    Log-Info "Nginx config contém 'player-web/'"
} else {
    Log-Error "Nginx config NÃO contém 'player-web/'"
    exit 1
}

# 5. Verificar referências no backend
Write-Host ""
Write-Host "5️⃣  Verificando backend/src/index.ts..." -ForegroundColor Cyan
$backendIndexContent = Get-Content "backend/src/index.ts" -Raw
if ($backendIndexContent -match "/opt/smart-signage/player-web") {
    Log-Info "Backend index.ts contém '/opt/smart-signage/player-web'"
} else {
    Log-Error "Backend index.ts NÃO contém '/opt/smart-signage/player-web'"
    exit 1
}

Write-Host ""
Write-Host "6️⃣  Verificando backend/src/routes/totems.ts..." -ForegroundColor Cyan
$backendTotemsContent = Get-Content "backend/src/routes/totems.ts" -Raw
if ($backendTotemsContent -match "/opt/smart-signage/player-web") {
    Log-Info "Backend totems.ts contém '/opt/smart-signage/player-web'"
} else {
    Log-Error "Backend totems.ts NÃO contém '/opt/smart-signage/player-web'"
    exit 1
}

# 6. Verificar docker/entrypoint.sh
Write-Host ""
Write-Host "7️⃣  Verificando docker/entrypoint.sh..." -ForegroundColor Cyan
$entrypointContent = Get-Content "docker/entrypoint.sh" -Raw
if ($entrypointContent -match "/app/player-web") {
    Log-Info "Entrypoint.sh contém '/app/player-web'"
} else {
    Log-Error "Entrypoint.sh NÃO contém '/app/player-web'"
    exit 1
}

# 7. Verificar se não há referências antigas ao diretório player/ (exceto em URLs públicas)
Write-Host ""
Write-Host "8️⃣  Verificando referências antigas ao diretório 'player/'..." -ForegroundColor Cyan
$oldRefs = Select-String -Path "Dockerfile*" -Pattern "COPY player/" -ErrorAction SilentlyContinue | Where-Object { $_.Line -notmatch "player-web" }
if ($oldRefs) {
    Log-Error "Encontradas referências antigas ao diretório 'player/':"
    $oldRefs | ForEach-Object { Write-Host "   $($_.Filename):$($_.LineNumber) - $($_.Line)" }
    exit 1
} else {
    Log-Info "Nenhuma referência antiga ao diretório 'player/' encontrada"
}

# 8. Verificar scripts de instalação
Write-Host ""
Write-Host "9️⃣  Verificando scripts de instalação..." -ForegroundColor Cyan
$installScriptContent = Get-Content "scripts/install-smartsignage.sh" -Raw
if ($installScriptContent -match "\$INSTALL_DIR/player-web") {
    Log-Info "install-smartsignage.sh contém referências a player-web"
} else {
    Log-Warn "install-smartsignage.sh pode não ter todas as referências atualizadas"
}

# 9. Verificar scripts de configuração
Write-Host ""
Write-Host "🔟 Verificando scripts de configuração..." -ForegroundColor Cyan
$createUinContent = Get-Content "scripts/create-totem-uin.sh" -Raw
if ($createUinContent -match "player-web") {
    Log-Info "scripts/create-totem-uin.sh contém referências a player-web"
} else {
    Log-Warn "scripts/create-totem-uin.sh pode não ter todas as referências atualizadas"
}

# 10. Resumo final
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "📊 RESUMO DA VALIDAÇÃO" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""
Log-Info "✅ Diretório player-web/ existe"
Log-Info "✅ Diretório player/ não existe (renomeado)"
Log-Info "✅ Dockerfile atualizado"
Log-Info "✅ Nginx config atualizado"
Log-Info "✅ Backend paths atualizados"
Log-Info "✅ Entrypoint atualizado"
Log-Info "✅ Nenhuma referência antiga encontrada"
Write-Host ""
Write-Host "🎉 TODAS AS VALIDAÇÕES PASSARAM!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Próximo passo: Executar build Docker completo:" -ForegroundColor Yellow
Write-Host "   docker build -t smartsignage-test ." -ForegroundColor Yellow
Write-Host ""

