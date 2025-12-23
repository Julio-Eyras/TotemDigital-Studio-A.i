# Script de Criação de Distribuição - SmartSignage Pro
# Cria diretório de distribuição limpo com apenas arquivos necessários

$ErrorActionPreference = "Stop"

# Configurações
$PROJECT_ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $PROJECT_ROOT -or $PROJECT_ROOT -eq "") {
    $PROJECT_ROOT = Get-Location
}
$DIST_DIR = Join-Path (Split-Path -Parent $PROJECT_ROOT) "SmartSignage-Pro-install"
$ZIP_FILE = Join-Path (Split-Path -Parent $PROJECT_ROOT) "SmartSignage-Pro-install.zip"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SmartSignage Pro - Distribuicao" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se diretório do projeto existe
if (-not (Test-Path $PROJECT_ROOT)) {
    Write-Host "ERRO: Diretorio do projeto nao encontrado: $PROJECT_ROOT" -ForegroundColor Red
    exit 1
}

# Limpar diretório de distribuição anterior (se existir)
if (Test-Path $DIST_DIR) {
    Write-Host "Removendo distribuicao anterior..." -ForegroundColor Yellow
    Remove-Item -Path $DIST_DIR -Recurse -Force
}

# Criar diretório de distribuição
Write-Host "Criando diretorio de distribuicao: $DIST_DIR" -ForegroundColor Green
New-Item -ItemType Directory -Path $DIST_DIR -Force | Out-Null

# Definir diretórios principais a copiar
$MAIN_DIRECTORIES = @(
    "backend",
    "frontend", 
    "database",
    "docs",
    "scripts",
    "nginx",
    "systemd",
    "docker",
    "player-web",
    "player-client",
    "player-agent",
    "player-fx"
)

# Definir padrões de exclusão (apenas diretórios e arquivos específicos, NUNCA .ts)
$EXCLUDE_DIRECTORIES = @(
    "node_modules",
    "dist",
    "build",
    ".next",
    "out",
    "coverage",
    ".nyc_output",
    "logs",
    ".cache",
    ".parcel-cache",
    ".turbo",
    ".vite",
    ".git",
    ".vscode",
    ".idea",
    "uploads",
    "backups",
    "public/assets/uploads",
    "public/assets/backups",
    "postgres_data",
    "redis_data",
    ".pnp",
    ".pnp.js",
    ".yarn",
    "yarn-error.log",
    "npm-debug.log*",
    ".eslintcache",
    ".tsbuildinfo",
    "*.tsbuildinfo",
    ".env.local",
    ".env.development.local",
    ".env.test.local",
    ".env.production.local"
)

$EXCLUDE_FILES = @(
    "*.log",
    "*.pem",
    "*.key",
    "*.crt",
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    "Thumbs.db",
    ".DS_Store",
    "*.swp",
    "*.swo",
    "*~",
    "package-lock.json",
    "yarn.lock",
    "*.pid",
    "*.seed",
    "*.pid.lock",
    "*.lcov",
    ".npm",
    ".yarn-integrity"
)

# Arquivos de teste (excluir apenas testes, manter source)
$EXCLUDE_TEST_FILES = @(
    "*.test.ts",
    "*.spec.ts",
    "*.test.js",
    "*.spec.js"
)

# Função para converter line endings de arquivos .sh de CRLF para LF
function Convert-ShellScriptLineEndings {
    param(
        [string]$Directory
    )
    
    if (-not (Test-Path $Directory)) {
        return
    }
    
    Write-Host "    Convertendo line endings de arquivos .sh (CRLF -> LF)..." -ForegroundColor Gray
    
    $shFiles = Get-ChildItem -Path $Directory -Recurse -Filter "*.sh" -File -ErrorAction SilentlyContinue
    $convertedCount = 0
    
    foreach ($file in $shFiles) {
        try {
            # Ler arquivo como texto bruto
            $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
            
            # Substituir CRLF (\r\n) e CR (\r) por LF (\n)
            $content = $content -replace "`r`n", "`n"
            $content = $content -replace "`r", "`n"
            
            # Escrever de volta com apenas LF
            # Usar WriteAllText sem BOM para compatibilidade com Linux
            $utf8NoBom = New-Object System.Text.UTF8Encoding $false
            [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
            
            $convertedCount++
        } catch {
            Write-Host "      ⚠️  Erro ao converter $($file.Name): $_" -ForegroundColor Yellow
        }
    }
    
    if ($convertedCount -gt 0) {
        Write-Host "    Convertidos: $convertedCount arquivos .sh" -ForegroundColor Gray
    }
}

# Função otimizada para copiar diretório (mais rápida)
function Copy-DirectoryClean {
    param(
        [string]$SourcePath,
        [string]$DestPath,
        [string[]]$ExcludeDirs,
        [string[]]$ExcludeFiles,
        [string[]]$ExcludeTests
    )
    
    if (-not (Test-Path $SourcePath)) {
        return 0
    }
    
    Write-Host "  Copiando: $(Split-Path $SourcePath -Leaf)" -ForegroundColor Cyan
    $startTime = Get-Date
    
    try {
        # Usar robocopy (MUITO mais rápido que Get-ChildItem recursivo)
        $robocopyAvailable = $true
        try {
            $null = Get-Command robocopy -ErrorAction Stop
        } catch {
            $robocopyAvailable = $false
        }
        
        if ($robocopyAvailable) {
            # Construir argumentos do robocopy (com progresso)
            $robocopyArgs = @(
                "`"$SourcePath`"",
                "`"$DestPath`"",
                "/E",              # Incluir subdiretórios vazios
                "/NFL",            # Não listar arquivos
                "/NDL",            # Não listar diretórios
                "/NJH",            # Não mostrar cabeçalho
                "/R:1",            # 1 tentativa (mais rápido)
                "/W:1"             # Aguardar 1 segundo
            )
            
            # Adicionar exclusões de diretórios
            foreach ($excludeDir in $ExcludeDirs) {
                $robocopyArgs += "/XD", "`"$excludeDir`""
            }
            
            # Executar robocopy diretamente (mais simples e confiável)
            Write-Host "    Iniciando copia (aguarde, pode demorar alguns minutos)..." -ForegroundColor Yellow
            
            # Executar robocopy em background job simples
            $jobScript = {
                param($Source, $Dest, $ExcludeDirs)
                $args = @("/E", "/R:1", "/W:1")
                foreach ($dir in $ExcludeDirs) {
                    $args += "/XD", $dir
                }
                & robocopy $Source $Dest $args | Out-Null
            }
            
            $job = Start-Job -ScriptBlock $jobScript -ArgumentList $SourcePath, $DestPath, $ExcludeDirs
            
            # Monitorar progresso
            $lastMessage = 0
            while ($job.State -eq "Running") {
                Start-Sleep -Seconds 3
                $elapsedTime = (Get-Date) - $startTime
                $secondsElapsed = [math]::Round($elapsedTime.TotalSeconds)
                
                # Mostrar progresso a cada 10 segundos
                if ($secondsElapsed -ge ($lastMessage + 10)) {
                    Write-Host "    Copiando... ($secondsElapsed segundos)" -ForegroundColor Gray
                    $lastMessage = $secondsElapsed
                }
            }
            
            $exitCode = Receive-Job $job
            Remove-Job $job -Force
            Write-Host "    Copia concluida!" -ForegroundColor Green
            
            # Contar arquivos copiados (excluindo testes) - de forma mais rápida
            Write-Host "    Removendo arquivos excluidos..." -ForegroundColor Gray
            
            # Remover arquivos de teste primeiro (mais rápido)
            foreach ($excludeTest in $ExcludeTests) {
                Get-ChildItem -Path $DestPath -Recurse -File -Filter $excludeTest -ErrorAction SilentlyContinue | 
                    Remove-Item -Force -ErrorAction SilentlyContinue
            }
            
            # Remover outros arquivos excluídos
            foreach ($excludeFile in $ExcludeFiles) {
                Get-ChildItem -Path $DestPath -Recurse -File -Filter $excludeFile -ErrorAction SilentlyContinue | 
                    Remove-Item -Force -ErrorAction SilentlyContinue
            }
            
            # Contar arquivos restantes
            $copiedCount = (Get-ChildItem -Path $DestPath -Recurse -File -ErrorAction SilentlyContinue).Count
            $elapsedTime = (Get-Date) - $startTime
            
            Write-Host "    Arquivos: $copiedCount (tempo: $([math]::Round($elapsedTime.TotalSeconds))s)" -ForegroundColor Gray
            
            # CRÍTICO: Converter line endings de arquivos .sh de CRLF para LF
            # Arquivos criados no Windows têm CRLF, mas Linux precisa de LF para o shebang funcionar
            Convert-ShellScriptLineEndings -Directory $DestPath
            
            return $copiedCount
        } else {
            # Fallback: usar Copy-Item com -Recurse (mais simples e rápido)
            Write-Host "    ⚠️  robocopy nao disponivel - usando metodo alternativo (mais lento)..." -ForegroundColor Yellow
            
            # Criar estrutura de diretórios primeiro
            $sourceDirs = Get-ChildItem -Path $SourcePath -Recurse -Directory -ErrorAction SilentlyContinue
            foreach ($dir in $sourceDirs) {
                $relativePath = $dir.FullName.Substring($SourcePath.Length + 1)
                $shouldExclude = $false
                
                foreach ($excludeDir in $ExcludeDirs) {
                    if ($relativePath -like "*\$excludeDir\*" -or $relativePath -like "*\$excludeDir" -or $dir.Name -eq $excludeDir) {
                        $shouldExclude = $true
                        break
                    }
                }
                
                if (-not $shouldExclude) {
                    $destDirPath = Join-Path $DestPath $relativePath
                    if (-not (Test-Path $destDirPath)) {
                        New-Item -ItemType Directory -Path $destDirPath -Force | Out-Null
                    }
                }
            }
            
            # Copiar arquivos
            $sourceFiles = Get-ChildItem -Path $SourcePath -Recurse -File -ErrorAction SilentlyContinue
            $copiedCount = 0
            
            foreach ($file in $sourceFiles) {
                $relativePath = $file.FullName.Substring($SourcePath.Length + 1)
                $shouldExclude = $false
                
                # Verificar se está em diretório excluído
                $parentPath = Split-Path $relativePath -Parent
                foreach ($excludeDir in $ExcludeDirs) {
                    if ($parentPath -like "*\$excludeDir\*" -or $parentPath -like "*\$excludeDir") {
                        $shouldExclude = $true
                        break
                    }
                }
                
                # Verificar padrões de arquivo
                if (-not $shouldExclude) {
                    foreach ($excludeFile in $ExcludeFiles) {
                        if ($file.Name -like $excludeFile) {
                            $shouldExclude = $true
                            break
                        }
                    }
                }
                
                # Verificar testes
                if (-not $shouldExclude) {
                    foreach ($excludeTest in $ExcludeTests) {
                        if ($file.Name -like $excludeTest) {
                            $shouldExclude = $true
                            break
                        }
                    }
                }
                
                if (-not $shouldExclude) {
                    $destFilePath = Join-Path $DestPath $relativePath
                    $destParent = Split-Path $destFilePath -Parent
                    if (-not (Test-Path $destParent)) {
                        New-Item -ItemType Directory -Path $destParent -Force | Out-Null
                    }
                    Copy-Item -Path $file.FullName -Destination $destFilePath -Force -ErrorAction SilentlyContinue
                    $copiedCount++
                }
            }
            
            Write-Host "    Arquivos: $copiedCount" -ForegroundColor Gray
            
            # CRÍTICO: Converter line endings de arquivos .sh de CRLF para LF (fallback method)
            Convert-ShellScriptLineEndings -Directory $DestPath
            
            return $copiedCount
        }
    } catch {
        Write-Host "    ❌ Erro: $_" -ForegroundColor Red
        return 0
    }
}

# Copiar diretórios principais
Write-Host "`nCopiando diretorios principais..." -ForegroundColor Green
$totalCopied = 0

foreach ($dir in $MAIN_DIRECTORIES) {
    $sourcePath = Join-Path $PROJECT_ROOT $dir
    if (Test-Path $sourcePath) {
        $destPath = Join-Path $DIST_DIR $dir
        $count = Copy-DirectoryClean -SourcePath $sourcePath -DestPath $destPath -ExcludeDirs $EXCLUDE_DIRECTORIES -ExcludeFiles $EXCLUDE_FILES -ExcludeTests $EXCLUDE_TEST_FILES
        $totalCopied += $count
    }
}

# Copiar arquivos da raiz (importantes)
Write-Host "`nCopiando arquivos da raiz..." -ForegroundColor Green
$rootFiles = @(
    "package.json",
    "tsconfig.json",
    "README.md",
    "LICENSE*",
    "CHANGELOG*",
    "*.md",
    "*.sh",
    "*.ps1",
    "*.bat",
    "Dockerfile*",
    "docker-compose*.yml",
    "docker-compose*.yaml",
    ".dockerignore",
    ".gitignore",
    ".eslintignore",
    ".prettierrc*",
    ".editorconfig",
    "env.example",
    "*.config.js",
    "*.config.ts"
)

# Arquivos específicos importantes (garantir inclusão)
$importantRootFiles = @(
    "install-windows.ps1",
    "install-smartsignage.ps1",
    "install-smartsignage.sh",
    "fix-frontend-ajv.ps1",
    "criar-zip-distribuicao.ps1",
    "docker-compose.yml",
    "Dockerfile",
    "Dockerfile.backend",
    "Dockerfile.frontend",
    "Dockerfile.app",
    "Dockerfile.workers"
)

$rootFilesCopied = 0

# Primeiro, copiar arquivos importantes específicos
foreach ($importantFile in $importantRootFiles) {
    $sourcePath = Join-Path $PROJECT_ROOT $importantFile
    if (Test-Path $sourcePath) {
        $destPath = Join-Path $DIST_DIR $importantFile
        Copy-Item -Path $sourcePath -Destination $destPath -Force -ErrorAction SilentlyContinue
        Write-Host "  Copiado: $importantFile" -ForegroundColor Green
        $rootFilesCopied++
        $totalCopied++
    }
}

# Depois, copiar arquivos por padrão
foreach ($pattern in $rootFiles) {
    $files = Get-ChildItem -Path $PROJECT_ROOT -Filter $pattern -File -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        # Pular se já foi copiado na lista de importantes
        if ($importantRootFiles -contains $file.Name) {
            continue
        }
        
        # Excluir arquivos específicos
        if ($file.Name -eq ".env" -or 
            $file.Name -like ".env.*" -or 
            $file.Name -eq "package-lock.json" -or 
            $file.Name -eq "yarn.lock" -or
            $file.Extension -eq ".log" -or
            $file.Name -like "*.test.*" -or
            $file.Name -like "*.spec.*") {
            continue
        }
        
        $destPath = Join-Path $DIST_DIR $file.Name
        Copy-Item -Path $file.FullName -Destination $destPath -Force -ErrorAction SilentlyContinue
        Write-Host "  Copiado: $($file.Name)" -ForegroundColor Gray
        $rootFilesCopied++
        $totalCopied++
    }
}

# CRÍTICO: Converter line endings de TODOS os arquivos .sh da raiz (incluindo install-smartsignage.sh)
Write-Host "  Convertendo line endings de scripts .sh da raiz..." -ForegroundColor Gray
$rootShFiles = Get-ChildItem -Path $DIST_DIR -Filter "*.sh" -File -ErrorAction SilentlyContinue
foreach ($file in $rootShFiles) {
    try {
        $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $content = $content -replace "`r`n", "`n"
        $content = $content -replace "`r", "`n"
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
        Write-Host "    Convertido: $($file.Name)" -ForegroundColor Gray
    } catch {
        Write-Host "    ⚠️  Erro ao converter $($file.Name): $_" -ForegroundColor Yellow
    }
}

# Criar arquivo README de distribuição
Write-Host "`nCriando README de distribuicao..." -ForegroundColor Green
$readmeContent = @"
# SmartSignage Pro - Distribuição de Instalação

Esta é uma distribuição limpa do SmartSignage Pro contendo apenas os arquivos necessários para instalação e execução.

**Gerado em:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

## Estrutura

- **backend/** - Código fonte do backend (TypeScript)
- **frontend/** - Código fonte do frontend (React/TypeScript)
- **database/** - Scripts SQL e esquema do banco de dados
- **docs/** - Documentação completa do sistema
- **scripts/** - Scripts auxiliares de instalação e manutenção
- **nginx/** - Configurações do Nginx
- **systemd/** - Arquivos de serviço systemd
- **docker/** - Arquivos Docker (Dockerfile, docker-compose)
- **player-web/** - Player web HTML5
- **player-client/** - Players para Smart TVs (Android, Tizen, webOS)
- **player-agent/** - Agente de sincronização
- **player-fx/** - Player de efeitos visuais

## Instalação

### Linux/Ubuntu

\`\`\`bash
chmod +x install-smartsignage.sh
sudo ./install-smartsignage.sh
\`\`\`

### Windows

\`\`\`powershell
.\install-windows.ps1
\`\`\`

O script de instalação do Windows irá:
- Verificar e instalar automaticamente Node.js, npm, PostgreSQL e Redis (via Chocolatey)
- Instalar todas as dependências do backend e frontend
- Compilar o backend TypeScript
- Configurar o banco de dados automaticamente
- Corrigir problemas comuns (como o módulo ajv no frontend)

## Pré-requisitos

- Node.js 18+ e npm
- PostgreSQL 15+
- Nginx (instalado automaticamente no Linux)
- Redis (opcional, mas recomendado)

## Notas Importantes

- Esta distribuição **NÃO inclui** \`node_modules\` - os scripts de instalação executarão \`npm install\` automaticamente
- Arquivos de configuração (.env) devem ser criados a partir dos exemplos (.env.example)
- Builds de produção serão gerados automaticamente pelos scripts de instalação
- O script \`install-windows.ps1\` configura tudo automaticamente, incluindo o banco de dados
- Consulte a pasta \`docs/\` para documentação completa do sistema
- Scripts SQL do banco de dados estão em \`database/smartchannel-db-v2-refactored-part*.sql\`
- O script \`backend/scripts/setup-database.js\` é usado para configurar o banco de dados automaticamente

## Documentação

- README.md - Visão geral do projeto
- docs/README.md - Índice da documentação completa
- docs/GUIA_INSTALACAO_PLAYERS.md - Guia de instalação de players
- docs/CONFIGURACAO_BANCO_DADOS.md - Configuração do banco de dados

---

**Versão:** $(Get-Date -Format "yyyy-MM-dd")
"@

$readmePath = Join-Path $DIST_DIR "README-DISTRIBUICAO.md"
Set-Content -Path $readmePath -Value $readmeContent -Encoding UTF8
Write-Host "  Criado: README-DISTRIBUICAO.md" -ForegroundColor Gray

# Conversão final de line endings para TODOS os scripts .sh na distribuição
Write-Host "`nConvertendo line endings de TODOS os scripts .sh..." -ForegroundColor Green
Convert-ShellScriptLineEndings -Directory $DIST_DIR
Write-Host "✅ Conversão de line endings concluída" -ForegroundColor Green

# Validar arquivos críticos
Write-Host "`nValidando arquivos críticos..." -ForegroundColor Green
$criticalFiles = @(
    "install-windows.ps1",
    "install-smartsignage.sh",
    "backend\package.json",
    "frontend\package.json",
    "backend\scripts\setup-database.js",
    "database\smartchannel-db-v2-refactored-part1-tables.sql",
    "backend\env.example",
    "docker-compose.yml"
)

$missingFiles = @()
foreach ($criticalFile in $criticalFiles) {
    $checkPath = Join-Path $DIST_DIR $criticalFile
    if (-not (Test-Path $checkPath)) {
        $missingFiles += $criticalFile
        Write-Host "  ⚠️  Faltando: $criticalFile" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ Encontrado: $criticalFile" -ForegroundColor Gray
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "`n⚠️  AVISO: Alguns arquivos críticos não foram encontrados:" -ForegroundColor Yellow
    foreach ($missing in $missingFiles) {
        Write-Host "    - $missing" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n✅ Todos os arquivos críticos foram encontrados!" -ForegroundColor Green
}

# Estatísticas finais
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Distribuição Criada com Sucesso!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📁 Diretório: $DIST_DIR" -ForegroundColor White
Write-Host ""

# Calcular tamanho
$totalSize = (Get-ChildItem -Path $DIST_DIR -Recurse -File -ErrorAction SilentlyContinue | 
    Measure-Object -Property Length -Sum).Sum
$totalSizeMB = [math]::Round($totalSize / 1MB, 2)
Write-Host "📊 Estatísticas:" -ForegroundColor Cyan
Write-Host "   Tamanho total: $totalSizeMB MB" -ForegroundColor White

# Contar arquivos
$fileCount = (Get-ChildItem -Path $DIST_DIR -Recurse -File -ErrorAction SilentlyContinue).Count
$dirCount = (Get-ChildItem -Path $DIST_DIR -Recurse -Directory -ErrorAction SilentlyContinue).Count
Write-Host "   Arquivos: $fileCount" -ForegroundColor White
Write-Host "   Diretórios: $dirCount" -ForegroundColor White
Write-Host "   Arquivos processados: $totalCopied" -ForegroundColor White
Write-Host ""

# Listar diretórios principais incluídos
Write-Host "📦 Diretórios incluídos:" -ForegroundColor Cyan
foreach ($dir in $MAIN_DIRECTORIES) {
    $dirPath = Join-Path $DIST_DIR $dir
    if (Test-Path $dirPath) {
        $dirFileCount = (Get-ChildItem -Path $dirPath -Recurse -File -ErrorAction SilentlyContinue).Count
        Write-Host "   ✅ $dir ($dirFileCount arquivos)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  $dir (não encontrado)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Informar sobre exclusões
Write-Host "🚫 Arquivos excluídos (como esperado):" -ForegroundColor Cyan
Write-Host "   - node_modules/ (serão instalados pelos scripts)" -ForegroundColor Gray
Write-Host "   - dist/, build/ (serão gerados durante instalação)" -ForegroundColor Gray
Write-Host "   - logs/, coverage/, .cache/ (temporários)" -ForegroundColor Gray
Write-Host "   - .env, .env.* (configurações locais)" -ForegroundColor Gray
Write-Host "   - *.log, *.test.*, *.spec.* (arquivos de teste e logs)" -ForegroundColor Gray
Write-Host ""

# Perguntar se deseja criar ZIP
Write-Host "Deseja criar arquivo ZIP? (S/N)" -ForegroundColor Yellow
$response = Read-Host

if ($response -eq "S" -or $response -eq "s" -or $response -eq "Y" -or $response -eq "y") {
    Write-Host "`nCriando arquivo ZIP..." -ForegroundColor Green
    
    # Garantir que o diretório do ZIP existe
    $zipDir = Split-Path -Parent $ZIP_FILE
    if (-not (Test-Path $zipDir)) {
        Write-Host "  Criando diretório para ZIP: $zipDir" -ForegroundColor Cyan
        New-Item -ItemType Directory -Path $zipDir -Force | Out-Null
    }
    
    # Tentar remover arquivo ZIP existente se houver
    if (Test-Path $ZIP_FILE) {
        try {
            # Verificar se o arquivo está bloqueado
            $fileInfo = Get-Item $ZIP_FILE -ErrorAction SilentlyContinue
            if ($fileInfo) {
                Write-Host "  Removendo arquivo ZIP existente..." -ForegroundColor Yellow
                Remove-Item -Path $ZIP_FILE -Force -ErrorAction Stop
                Start-Sleep -Seconds 1
            }
        } catch {
            Write-Host "  AVISO: Nao foi possivel remover arquivo ZIP existente." -ForegroundColor Yellow
            Write-Host "  O arquivo pode estar aberto ou em uso." -ForegroundColor Yellow
            Write-Host "  Tentando criar com nome alternativo..." -ForegroundColor Yellow
            
            # Criar nome alternativo com timestamp
            $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
            $zipDir = Split-Path -Parent $ZIP_FILE
            $zipBaseName = [System.IO.Path]::GetFileNameWithoutExtension($ZIP_FILE)
            $ZIP_FILE = Join-Path $zipDir "$zipBaseName-$timestamp.zip"
        }
    }
    
    try {
        # Tentar criar ZIP
        Compress-Archive -Path $DIST_DIR -DestinationPath $ZIP_FILE -CompressionLevel Optimal -ErrorAction Stop
        
        # Verificar se foi criado
        if (Test-Path $ZIP_FILE) {
            $zipSize = (Get-Item $ZIP_FILE).Length / 1MB
            Write-Host "  ZIP criado com sucesso!" -ForegroundColor Green
            Write-Host "  Arquivo: $ZIP_FILE" -ForegroundColor White
            Write-Host "  Tamanho: $([math]::Round($zipSize, 2)) MB" -ForegroundColor White
        } else {
            Write-Host "  ERRO: Arquivo ZIP nao foi criado." -ForegroundColor Red
        }
    } catch {
        Write-Host "  ERRO ao criar arquivo ZIP: $_" -ForegroundColor Red
        Write-Host "  Tentando metodo alternativo..." -ForegroundColor Yellow
        
        # Método alternativo usando .NET
        try {
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $compressionLevel = [System.IO.Compression.CompressionLevel]::Optimal
            [System.IO.Compression.ZipFile]::CreateFromDirectory($DIST_DIR, $ZIP_FILE, $compressionLevel, $false)
            
            if (Test-Path $ZIP_FILE) {
                $zipSize = (Get-Item $ZIP_FILE).Length / 1MB
                Write-Host "  ZIP criado com metodo alternativo!" -ForegroundColor Green
                Write-Host "  Arquivo: $ZIP_FILE" -ForegroundColor White
                Write-Host "  Tamanho: $([math]::Round($zipSize, 2)) MB" -ForegroundColor White
            }
        } catch {
            Write-Host "  ERRO: Nao foi possivel criar ZIP com nenhum metodo." -ForegroundColor Red
            Write-Host "  Detalhes: $_" -ForegroundColor Red
            Write-Host "  O diretorio de distribuicao esta disponivel em: $DIST_DIR" -ForegroundColor Yellow
        }
    }
}

Write-Host "`nConcluido!" -ForegroundColor Green
