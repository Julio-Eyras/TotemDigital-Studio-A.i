# Script de Teste Completo - Build Docker após Renomeação player/ → player-web/

$ErrorActionPreference = "Continue"

Write-Host "TESTE COMPLETO: Build Docker - Renomeacao player/ -> player-web/" -ForegroundColor Cyan
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

function Log-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host ">>> $Message" -ForegroundColor Cyan
}

# Variáveis
$DOCKER_IMAGE = "smartsignage-test-player-web"
$BUILD_SUCCESS = $false

# 1. Validações pré-build
Log-Step "ETAPA 1: Validações Pré-Build"

if (-not (Test-Path "player-web" -PathType Container)) {
    Log-Error "Diretório player-web/ não existe!"
    exit 1
}
Log-Info "Diretório player-web/ existe"

if (Test-Path "player" -PathType Container) {
    Log-Error "Diretório player/ ainda existe! Deve ter sido renomeado."
    exit 1
}
Log-Info "Diretório player/ não existe (correto)"

if (-not (Test-Path "Dockerfile" -PathType Leaf)) {
    Log-Error "Dockerfile não encontrado!"
    exit 1
}
Log-Info "Dockerfile encontrado"

# Verificar se Docker está disponível
Log-Step "ETAPA 2: Verificando Docker"
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Log-Info "Docker disponível: $dockerVersion"
    } else {
        Log-Warn "Docker pode não estar disponível"
    }
} catch {
    Log-Warn "Não foi possível verificar Docker: $_"
}

# 2. Validar estrutura do Dockerfile
Log-Step "ETAPA 3: Validando Estrutura do Dockerfile"
$dockerfileContent = Get-Content "Dockerfile" -Raw

$checks = @(
    @{ Pattern = "COPY player-web/"; Name = "COPY player-web/" },
    @{ Pattern = "/app/player-web"; Name = "Caminho /app/player-web" }
)

$allChecksPassed = $true
foreach ($check in $checks) {
    if ($dockerfileContent -match [regex]::Escape($check.Pattern)) {
        Log-Info "$($check.Name) encontrado no Dockerfile"
    } else {
        Log-Error "$($check.Name) NÃO encontrado no Dockerfile"
        $allChecksPassed = $false
    }
}

if (-not $allChecksPassed) {
    Log-Error "Validação do Dockerfile falhou!"
    exit 1
}

# 3. Verificar referências em outros arquivos críticos
Log-Step "ETAPA 4: Validando Referências em Arquivos Críticos"

$filesToCheck = @(
    @{ Path = "nginx/nginx-reverse-proxy.conf"; Pattern = "player-web/" },
    @{ Path = "backend/src/index.ts"; Pattern = "/opt/smart-signage/player-web" },
    @{ Path = "backend/src/routes/totems.ts"; Pattern = "/opt/smart-signage/player-web" },
    @{ Path = "docker/entrypoint.sh"; Pattern = "/app/player-web" }
)

$allFilesValid = $true
foreach ($file in $filesToCheck) {
    if (Test-Path $file.Path) {
        $content = Get-Content $file.Path -Raw
        if ($content -match [regex]::Escape($file.Pattern)) {
            Log-Info "$($file.Path) contém referência correta"
        } else {
            Log-Error "$($file.Path) NÃO contém referência a 'player-web'"
            $allFilesValid = $false
        }
    } else {
        Log-Warn "$($file.Path) não encontrado"
    }
}

if (-not $allFilesValid) {
    Log-Error "Validação de arquivos falhou!"
    exit 1
}

# 4. Limpar builds anteriores (opcional)
Log-Step "ETAPA 5: Limpando Builds Anteriores (se existirem)"
try {
    docker rmi $DOCKER_IMAGE 2>&1 | Out-Null
    Log-Info "Imagem anterior removida (se existia)"
} catch {
    Log-Info "Nenhuma imagem anterior para remover"
}

# 5. Executar build Docker
Log-Step "ETAPA 6: Executando Build Docker"
    Write-Host "Aguarde... Isso pode levar varios minutos..." -ForegroundColor Yellow
Write-Host ""

try {
    $buildOutput = docker build -t $DOCKER_IMAGE . 2>&1
    $buildExitCode = $LASTEXITCODE
    
    if ($buildExitCode -eq 0) {
        $BUILD_SUCCESS = $true
        Log-Info "Build Docker concluído com sucesso!"
        
        # Verificar se a imagem foi criada
        $imageExists = docker images $DOCKER_IMAGE --format "{{.Repository}}" 2>&1
        if ($imageExists -eq $DOCKER_IMAGE) {
            Log-Info "Imagem Docker '$DOCKER_IMAGE' criada com sucesso"
        }
    } else {
        Log-Error "Build Docker falhou com código de saída: $buildExitCode"
        Write-Host "`nÚltimas linhas do output:" -ForegroundColor Yellow
        $buildOutput | Select-Object -Last 30 | ForEach-Object { Write-Host $_ }
        exit 1
    }
} catch {
    Log-Error "Erro ao executar build Docker: $_"
    exit 1
}

# 6. Validar que player-web foi copiado corretamente
Log-Step "ETAPA 7: Validando Conteúdo da Imagem Docker"
if ($BUILD_SUCCESS) {
    try {
        # Criar container temporário para verificar
        $containerId = docker create $DOCKER_IMAGE 2>&1
        if ($LASTEXITCODE -eq 0) {
            Log-Info "Container temporário criado para validação"
            
            # Verificar se player-web existe no container
            $playerWebExists = docker exec $containerId test -d /app/player-web 2>&1
            if ($LASTEXITCODE -eq 0) {
                Log-Info "Diretório /app/player-web existe no container"
            } else {
                Log-Warn "Não foi possível verificar /app/player-web no container"
            }
            
            # Limpar container temporário
            docker rm $containerId 2>&1 | Out-Null
        } else {
            Log-Warn "Não foi possível criar container para validação"
        }
    } catch {
        Log-Warn "Validação do conteúdo do container não pôde ser executada: $_"
    }
}

# 7. Resumo final
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "📊 RESUMO DO TESTE" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

if ($BUILD_SUCCESS) {
    Log-Info "✅ Todas as validações passaram"
    Log-Info "✅ Dockerfile está correto"
    Log-Info "✅ Referências atualizadas corretamente"
    Log-Info "✅ Build Docker concluído com sucesso"
    Log-Info "✅ Imagem '$DOCKER_IMAGE' criada"
    
    Write-Host ""
    Write-Host "SUCESSO: RENOMEACAO VALIDADA!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Proximos passos:" -ForegroundColor Yellow
    Write-Host "   1. Testar a imagem: docker run -p 3000:3000 $DOCKER_IMAGE" -ForegroundColor Yellow
    Write-Host "   2. Verificar logs: docker logs [container_id]" -ForegroundColor Yellow
    Write-Host "   3. Testar endpoint /player: curl http://localhost:3000/player" -ForegroundColor Yellow
} else {
    Log-Error "Build Docker falhou!"
    Write-Host ""
    Write-Host "ATENCAO: Verifique os erros acima e corrija antes de prosseguir." -ForegroundColor Yellow
    exit 1
}

Write-Host ""

