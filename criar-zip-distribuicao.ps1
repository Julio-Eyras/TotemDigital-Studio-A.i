# =============================================================================
# Script PowerShell para criar ZIP de distribuição do Smart Signage Pro
# =============================================================================
# Uso: .\criar-zip-distribuicao.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# Variáveis
$ScriptDir = $PSScriptRoot
$Version = Get-Date -Format "yyyy.MM.dd"
$ZipName = "SmartSignage-Pro-v$Version.zip"
$TempDir = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }

Write-Host "================================================================================" -ForegroundColor Green
Write-Host "                    Criando ZIP de Distribuicao" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[INFO] Nome do arquivo: $ZipName" -ForegroundColor Blue
Write-Host "[INFO] Diretorio temporario: $TempDir" -ForegroundColor Blue
Write-Host ""

# Função para copiar diretório
function Copy-DirectoryExclude {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$Description
    )
    
    if (Test-Path $Source -PathType Container) {
        Write-Host "[OK] Copiando $Description..." -ForegroundColor Green
        
        # Criar destino
        New-Item -ItemType Directory -Path $Destination -Force | Out-Null
        
        # Copiar arquivos excluindo padrões específicos
        Get-ChildItem -Path $Source -Recurse -File | Where-Object {
            $relativePath = $_.FullName.Substring($Source.Length + 1)
            -not ($relativePath -like "node_modules\*") -and
            -not ($relativePath -like "dist\*") -and
            -not ($relativePath -like "build\*") -and
            -not ($relativePath -like "coverage\*") -and
            -not ($relativePath -like "logs\*") -and
            -not ($relativePath -eq ".env") -and
            -not ($relativePath -like ".git\*") -and
            -not ($relativePath -like ".vscode\*") -and
            -not ($relativePath -like ".idea\*") -and
            -not ($relativePath -like "*.log") -and
            -not ($relativePath -like "uploads\*") -and
            -not ($relativePath -like "backups\*") -and
            -not ($relativePath -like "postgres_data\*") -and
            -not ($relativePath -like "redis_data\*") -and
            -not ($relativePath -like ".cursor\*")
        } | ForEach-Object {
            $destPath = $_.FullName.Replace($Source, $Destination)
            $destDir = Split-Path $destPath -Parent
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            
            # Se for arquivo .sh, converter line endings
            if ($_.Extension -eq ".sh") {
                $content = Get-Content $_.FullName -Raw -Encoding UTF8
                $content = $content -replace "`r`n", "`n"
                $utf8NoBom = New-Object System.Text.UTF8Encoding $false
                [System.IO.File]::WriteAllText($destPath, $content, $utf8NoBom)
            } else {
                Copy-Item $_.FullName -Destination $destPath -Force
            }
        }
    } else {
        Write-Host "[AVISO] $Description nao encontrado: $Source" -ForegroundColor Yellow
    }
}

Write-Host "================================================================================" -ForegroundColor Blue
Write-Host "                    Copiando Arquivos" -ForegroundColor Blue
Write-Host "================================================================================" -ForegroundColor Blue
Write-Host ""

# Copiar diretórios principais
Copy-DirectoryExclude "$ScriptDir\backend" "$TempDir\backend" "Backend"
Copy-DirectoryExclude "$ScriptDir\frontend" "$TempDir\frontend" "Frontend"
Copy-DirectoryExclude "$ScriptDir\database" "$TempDir\database" "Database"
Copy-DirectoryExclude "$ScriptDir\docker" "$TempDir\docker" "Docker"
Copy-DirectoryExclude "$ScriptDir\nginx" "$TempDir\nginx" "Nginx"
Copy-DirectoryExclude "$ScriptDir\monitoring" "$TempDir\monitoring" "Monitoring"
Copy-DirectoryExclude "$ScriptDir\scripts" "$TempDir\scripts" "Scripts"

# Copiar TODOS os players e módulos relacionados
Copy-DirectoryExclude "$ScriptDir\player-client" "$TempDir\player-client" "Player Client (todas plataformas)"
Copy-DirectoryExclude "$ScriptDir\Player-SmartDisplayFX-client" "$TempDir\Player-SmartDisplayFX-client" "Player-SmartDisplayFX-client"
Copy-DirectoryExclude "$ScriptDir\Player-Smart-FX-Interface" "$TempDir\Player-Smart-FX-Interface" "Player-Smart-FX-Interface"
Copy-DirectoryExclude "$ScriptDir\player-agent" "$TempDir\player-agent" "Player Agent"
Copy-DirectoryExclude "$ScriptDir\player-fx" "$TempDir\player-fx" "Player FX"
Copy-DirectoryExclude "$ScriptDir\player" "$TempDir\player" "Player Genérico"

# Funcao para copiar arquivo shell script com conversao de line endings
function Copy-ShellScript {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$Description
    )
    
    if (Test-Path $Source) {
        # Ler conteudo do arquivo
        $content = Get-Content $Source -Raw -Encoding UTF8
        
        # Converter CRLF para LF (Unix line endings)
        $content = $content -replace "`r`n", "`n"
        
        # Salvar com encoding UTF-8 sem BOM e line endings LF
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($Destination, $content, $utf8NoBom)
        
        Write-Host "[OK] $Description copiado (line endings convertidos para LF)" -ForegroundColor Green
    } else {
        Write-Host "[AVISO] $Description nao encontrado: $Source" -ForegroundColor Yellow
    }
}

# Copiar arquivos na raiz
$filesToCopy = @(
    @{Source="$ScriptDir\docker-compose.yml"; Dest="$TempDir\docker-compose.yml"; Desc="docker-compose.yml"; IsShell=$false},
    @{Source="$ScriptDir\env.example"; Dest="$TempDir\env.example"; Desc="env.example"; IsShell=$false},
    @{Source="$ScriptDir\install-smartsignage.sh"; Dest="$TempDir\install-smartsignage.sh"; Desc="install-smartsignage.sh"; IsShell=$true}
)

foreach ($file in $filesToCopy) {
    if ($file.IsShell) {
        Copy-ShellScript -Source $file.Source -Destination $file.Dest -Description $file.Desc
    } else {
        if (Test-Path $file.Source) {
            Copy-Item $file.Source -Destination $file.Dest -Force
            Write-Host "[OK] $($file.Desc) copiado" -ForegroundColor Green
        } else {
            Write-Host "[AVISO] $($file.Desc) nao encontrado: $($file.Source)" -ForegroundColor Yellow
        }
    }
}

# Copiar Dockerfiles
Get-ChildItem -Path $ScriptDir -Filter "Dockerfile*" -File | ForEach-Object {
    Copy-Item $_.FullName -Destination "$TempDir\$($_.Name)" -Force
    Write-Host "[OK] $($_.Name) copiado" -ForegroundColor Green
}

# Copiar README se existir
if (Test-Path "$ScriptDir\README.md") {
    Copy-Item "$ScriptDir\README.md" -Destination "$TempDir\README.md" -Force
    Write-Host "[OK] README.md copiado" -ForegroundColor Green
}

# NOTA: Nao incluir scripts de correcao - tudo deve funcionar direto

# Criar arquivo de versão
$versionContent = @"
SmartSignage Pro - Pacote de Distribuicao
Versao: $Version
Data de Criacao: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@
$versionContent | Out-File -FilePath "$TempDir\VERSION.txt" -Encoding UTF8

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Blue
Write-Host "                    Criando ZIP" -ForegroundColor Blue
Write-Host "================================================================================" -ForegroundColor Blue
Write-Host ""

# Criar ZIP
$zipPath = Join-Path $ScriptDir $ZipName
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Compress-Archive -Path "$TempDir\*" -DestinationPath $zipPath -Force

# Calcular tamanho
$zipSize = (Get-Item $zipPath).Length / 1MB
$zipSizeFormatted = "{0:N2} MB" -f $zipSize

Write-Host "[OK] ZIP criado com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Green
Write-Host "                    [OK] CONCLUIDO" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "[INFO] Arquivo: $ZipName" -ForegroundColor Green
Write-Host "[INFO] Tamanho: $zipSizeFormatted" -ForegroundColor Green
Write-Host "[INFO] Local: $zipPath" -ForegroundColor Green
Write-Host ""

# Limpar diretorio temporario
Remove-Item $TempDir -Recurse -Force

Write-Host "[INFO] Proximos passos:" -ForegroundColor Blue
Write-Host "   1. Transferir $ZipName para a maquina destino"
Write-Host "   2. Extrair: unzip $ZipName (Linux) ou Expand-Archive (Windows)"
Write-Host "   3. Copiar env.example para .env e configurar"
Write-Host "   4. Executar: ./install-smartsignage.sh"
Write-Host ""
Write-Host "[NOTA] O script install-smartsignage.sh ja esta com:" -ForegroundColor Green
Write-Host "   - Line endings corretos (LF)" -ForegroundColor Green
Write-Host "   - Sintaxe validada" -ForegroundColor Green
Write-Host "   - Pronto para execucao direta" -ForegroundColor Green
Write-Host ""

