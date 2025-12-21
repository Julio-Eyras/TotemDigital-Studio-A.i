# Script de Teste Simples - Build Docker apos Renomeacao player/ -> player-web/

$ErrorActionPreference = "Continue"

Write-Host "TESTE COMPLETO: Build Docker - Renomeacao player/ -> player-web/" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

function Log-Info {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Log-Warn {
    param([string]$Message)
    Write-Host "[AVISO] $Message" -ForegroundColor Yellow
}

function Log-Error {
    param([string]$Message)
    Write-Host "[ERRO] $Message" -ForegroundColor Red
}

$DOCKER_IMAGE = "smartsignage-test-player-web"
$BUILD_SUCCESS = $false

# 1. Validacoes pre-build
Write-Host ""
Write-Host "ETAPA 1: Validacoes Pre-Build" -ForegroundColor Cyan

if (-not (Test-Path "player-web" -PathType Container)) {
    Log-Error "Diretorio player-web/ nao existe!"
    exit 1
}
Log-Info "Diretorio player-web/ existe"

if (Test-Path "player" -PathType Container) {
    Log-Error "Diretorio player/ ainda existe! Deve ter sido renomeado."
    exit 1
}
Log-Info "Diretorio player/ nao existe (correto)"

if (-not (Test-Path "Dockerfile" -PathType Leaf)) {
    Log-Error "Dockerfile nao encontrado!"
    exit 1
}
Log-Info "Dockerfile encontrado"

# 2. Verificar Docker
Write-Host ""
Write-Host "ETAPA 2: Verificando Docker" -ForegroundColor Cyan
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Log-Info "Docker disponivel: $dockerVersion"
    } else {
        Log-Warn "Docker pode nao estar disponivel"
        Write-Host "NOTA: Build Docker nao sera executado, apenas validacao de arquivos"
    }
} catch {
    Log-Warn "Nao foi possivel verificar Docker: $_"
    Write-Host "NOTA: Build Docker nao sera executado, apenas validacao de arquivos"
}

# 3. Validar estrutura do Dockerfile
Write-Host ""
Write-Host "ETAPA 3: Validando Estrutura do Dockerfile" -ForegroundColor Cyan
$dockerfileContent = Get-Content "Dockerfile" -Raw

if ($dockerfileContent -match "COPY player-web/") {
    Log-Info "Dockerfile contem 'COPY player-web/'"
} else {
    Log-Error "Dockerfile NAO contem 'COPY player-web/'"
    exit 1
}

if ($dockerfileContent -match "/app/player-web") {
    Log-Info "Dockerfile contem '/app/player-web'"
} else {
    Log-Error "Dockerfile NAO contem '/app/player-web'"
    exit 1
}

# 4. Verificar referencias em outros arquivos criticos
Write-Host ""
Write-Host "ETAPA 4: Validando Referencias em Arquivos Criticos" -ForegroundColor Cyan

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
            Log-Info "$($file.Path) contem referencia correta"
        } else {
            Log-Error "$($file.Path) NAO contem referencia a 'player-web'"
            $allFilesValid = $false
        }
    } else {
        Log-Warn "$($file.Path) nao encontrado"
    }
}

if (-not $allFilesValid) {
    Log-Error "Validacao de arquivos falhou!"
    exit 1
}

# 5. Limpar builds anteriores (opcional)
Write-Host ""
Write-Host "ETAPA 5: Limpando Builds Anteriores" -ForegroundColor Cyan
try {
    docker rmi $DOCKER_IMAGE 2>&1 | Out-Null
    Log-Info "Imagem anterior removida (se existia)"
} catch {
    Log-Info "Nenhuma imagem anterior para remover"
}

# 6. Executar build Docker
Write-Host ""
Write-Host "ETAPA 6: Executando Build Docker" -ForegroundColor Cyan
Write-Host "Aguarde... Isso pode levar varios minutos..." -ForegroundColor Yellow
Write-Host ""

try {
    docker build -t $DOCKER_IMAGE . 2>&1 | Tee-Object -Variable buildOutput
    $buildExitCode = $LASTEXITCODE
    
    if ($buildExitCode -eq 0) {
        $BUILD_SUCCESS = $true
        Log-Info "Build Docker concluido com sucesso!"
        
        # Verificar se a imagem foi criada
        $imageExists = docker images $DOCKER_IMAGE --format "{{.Repository}}" 2>&1
        if ($imageExists -eq $DOCKER_IMAGE) {
            Log-Info "Imagem Docker '$DOCKER_IMAGE' criada com sucesso"
        }
    } else {
        Log-Error "Build Docker falhou com codigo de saida: $buildExitCode"
        Write-Host ""
        Write-Host "Ultimas linhas do output:" -ForegroundColor Yellow
        $buildOutput | Select-Object -Last 30 | ForEach-Object { Write-Host $_ }
        exit 1
    }
} catch {
    Log-Error "Erro ao executar build Docker: $_"
    exit 1
}

# 7. Resumo final
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "RESUMO DO TESTE" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

if ($BUILD_SUCCESS) {
    Log-Info "Todas as validacoes passaram"
    Log-Info "Dockerfile esta correto"
    Log-Info "Referencias atualizadas corretamente"
    Log-Info "Build Docker concluido com sucesso"
    Log-Info "Imagem '$DOCKER_IMAGE' criada"
    
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

