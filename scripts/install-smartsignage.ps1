# =============================================================================
# Smart Signage Pro - Script de Auto-Instalação para Windows
# =============================================================================
# Versão do Sistema: 2.1.0
# Versão do Script: 1.0.0
# =============================================================================
# Este script instala automaticamente o Smart Signage Pro em sistemas Windows
# Suporta 2 modos: Single-Server, Docker
#
# Uso: .\install-smartsignage.ps1 [OPÇÕES]
# =============================================================================

# Requer PowerShell 5.1 ou superior
#Requires -Version 5.1

# Configuração de erro
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# =============================================================================
# VARIÁVEIS GLOBAIS E FLAGS
# =============================================================================
$SYSTEM_VERSION = "2.1.0"
$SCRIPT_VERSION = "1.0.0"

$FRESH_MODE = $false
$REBUILD_MODE = $false
$REBUILD_CACHE = $false
$REBUILD_ONLY = $false
$FORCE_REBUILD = $false
$CHECK_ONLY = $false
$SKIP_MENU = $false
$INSTALL_MODE = ""
$ENABLE_HTTPS_SELF_SIGNED = $false
$ENABLE_HTTPS_LETSENCRYPT = $false
$DOMAIN_NAME = ""
$SSL_EMAIL = ""
$ENABLE_KIOSK_MODE = $false
$RESET_DATABASE = $false
$PRESERVE_DB = $false
$LOAD_SEEDS = $false
$SEEDS_OPTION_FORCED = $false

# Variáveis para seleção de players
$INSTALL_PLAYER_WEBOS = $false
$INSTALL_PLAYER_ANDROID = $false
$INSTALL_PLAYER_LINUX_ELECTRON = $false
$INSTALL_PLAYER_LINUX_CPP = $false
$INSTALL_PLAYER_WINDOWS_ELECTRON = $false
$INSTALL_PLAYER_TIZEN = $false
$INSTALL_PLAYER_SMARTDISPLAYFX = $false
$INSTALL_PLAYER_FX_INTERFACE = $false
$INSTALL_ALL_PLAYERS = $false

# Diretórios
$INSTALL_DIR = ""
$SOURCE_DIR = ""

# =============================================================================
# FUNÇÕES DE LOGGING
# =============================================================================
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor Green
}

function Write-LogDetailed {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[DETALHADO $timestamp] $Message" -ForegroundColor Blue
}

function Write-LogError {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[ERRO $timestamp] $Message" -ForegroundColor Red
}

function Write-LogProgress {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[PROGRESSO $timestamp] $Message" -ForegroundColor Cyan
}

function Write-LogStatus {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[STATUS $timestamp] $Message" -ForegroundColor Magenta
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[AVISO] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERRO] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

# =============================================================================
# BANNER
# =============================================================================
function Show-Banner {
    Clear-Host
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
    Write-Host "║                    Smart Signage Pro                        ║" -ForegroundColor Magenta
    Write-Host "║              Sistema de Sinalização Digital                 ║" -ForegroundColor Magenta
    Write-Host "║                  Auto-Instalação Windows                    ║" -ForegroundColor Magenta
    Write-Host "╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Magenta
    Write-Host "║  Versão do Sistema: $SYSTEM_VERSION                                    ║" -ForegroundColor Magenta
    Write-Host "║  Versão do Script:  $SCRIPT_VERSION                                    ║" -ForegroundColor Magenta
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
    Write-Host "ℹ️  Sistema v$SYSTEM_VERSION | Script v$SCRIPT_VERSION" -ForegroundColor Cyan
    Write-Host ""
}

# =============================================================================
# PARSE DE ARGUMENTOS
# =============================================================================
function Parse-Arguments {
    param([string[]]$Arguments)
    
    for ($i = 0; $i -lt $Arguments.Length; $i++) {
        switch ($Arguments[$i]) {
            "--fresh" {
                $script:FRESH_MODE = $true
                $script:REBUILD_MODE = $true
                $script:FORCE_REBUILD = $true
                $script:SKIP_MENU = $true
                $script:INSTALL_MODE = "docker"
            }
            "--rebuild" {
                $script:REBUILD_MODE = $true
            }
            "--rebuild-cache" {
                $script:REBUILD_MODE = $true
                $script:REBUILD_CACHE = $true
            }
            "--rebuild-only" {
                $script:REBUILD_MODE = $true
                $script:REBUILD_ONLY = $true
            }
            "--force" {
                $script:FORCE_REBUILD = $true
            }
            "--check-only" {
                $script:CHECK_ONLY = $true
            }
            "--skip-menu" {
                $script:SKIP_MENU = $true
            }
            "--mode" {
                $script:SKIP_MENU = $true
                if ($i + 1 -ge $Arguments.Length) {
                    Write-LogError "Faltou valor para --mode. Use: --mode single-server|docker"
                    exit 1
                }
                $script:INSTALL_MODE = $Arguments[$i + 1]
                $i++
            }
            "--https-self-signed" {
                $script:ENABLE_HTTPS_SELF_SIGNED = $true
            }
            "--reset-db" {
                $script:RESET_DATABASE = $true
            }
            "--preserve-db" {
                $script:PRESERVE_DB = $true
            }
            "--load-seeds" {
                $script:LOAD_SEEDS = $true
                $script:SEEDS_OPTION_FORCED = $true
            }
            "--skip-seeds" {
                $script:LOAD_SEEDS = $false
                $script:SEEDS_OPTION_FORCED = $true
            }
            "--help" {
                Show-Help
                exit 0
            }
            "-h" {
                Show-Help
                exit 0
            }
            default {
                Write-Warn "Opção desconhecida: $($Arguments[$i])"
            }
        }
    }
}

function Show-Help {
    Write-Host "Smart Signage Pro v2.0 - Script de Instalação Windows"
    Write-Host ""
    Write-Host "Uso: .\install-smartsignage.ps1 [OPÇÕES]"
    Write-Host ""
    Write-Host "OPÇÕES:"
    Write-Host "  --fresh              Instalação COMPLETA do zero (apaga TUDO)"
    Write-Host "  --rebuild            Rebuild preservando dados"
    Write-Host "  --rebuild-cache      Rebuild sem cache Docker"
    Write-Host "  --rebuild-only       Apenas rebuild, não inicia"
    Write-Host "  --force              Força rebuild sempre"
    Write-Host "  --check-only         Apenas verifica se precisa rebuild"
    Write-Host "  --skip-menu          Pula menu (usa defaults do menu: Single-Server)"
    Write-Host "  --mode <modo>        Define o modo (single-server|docker) e pula o menu"
    Write-Host "  --https-self-signed  Habilita HTTPS autoassinado (single-server)"
    Write-Host "  --reset-db           Apaga e recria o banco PostgreSQL se já existir"
    Write-Host "  --preserve-db         Preserva o banco de dados existente"
    Write-Host "  --load-seeds         Carrega dados de demonstração automaticamente"
    Write-Host "  --skip-seeds         Não carrega dados de demonstração"
    Write-Host "  --help, -h           Mostra esta ajuda"
}

# =============================================================================
# VERIFICAÇÕES INICIAIS
# =============================================================================
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-OS {
    Write-Log "Verificando sistema operacional..."
    
    $os = Get-CimInstance Win32_OperatingSystem
    $osName = $os.Caption
    $osVersion = $os.Version
    
    Write-Log "Sistema detectado: $osName ($osVersion)"
    
    # Verificar se é Windows 10 ou superior
    if ([int]$osVersion.Split('.')[0] -lt 10) {
        Write-LogError "Windows 10 ou superior é necessário"
        exit 1
    }
    
    Write-Log "✅ Sistema operacional compatível"
}

function Test-ProjectDirectory {
    Write-Log "Detectando diretório do projeto..."
    
    $scriptPath = $PSScriptRoot
    if (-not $scriptPath) {
        $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    }
    
    if (Test-Path "$scriptPath\backend" -PathType Container) {
        $script:SOURCE_DIR = $scriptPath
        Write-Log "✅ Diretório de origem detectado: $SOURCE_DIR"
        return $true
    }
    
    Write-LogError "Diretório do projeto não encontrado. Execute o script na raiz do projeto."
    exit 1
}

# =============================================================================
# INSTALAÇÃO DE DEPENDÊNCIAS
# =============================================================================
function Install-Chocolatey {
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Log "✅ Chocolatey já está instalado"
        return
    }
    
    Write-Log "Instalando Chocolatey..."
    
    try {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        Write-Log "✅ Chocolatey instalado com sucesso"
    } catch {
        Write-LogError "Falha ao instalar Chocolatey: $_"
        exit 1
    }
}

function Install-NodeJS {
    Write-Log "Instalando Node.js..."
    
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $nodeVersion = (node --version) -replace 'v', ''
        $majorVersion = [int]$nodeVersion.Split('.')[0]
        
        if ($majorVersion -ge 18) {
            Write-Log "✅ Node.js v$(node --version) já está instalado!"
            return
        } else {
            Write-Warn "Node.js versão antiga detectada. Atualizando..."
        }
    }
    
    Write-Log "Instalando Node.js 18.x via Chocolatey..."
    
    try {
        choco install nodejs-lts --version=18.20.4 -y
        Write-Log "✅ Node.js instalado com sucesso!"
        
        # Atualizar PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        # Verificar instalação
        if (Get-Command node -ErrorAction SilentlyContinue) {
            Write-Log "✅ Node.js $(node --version) instalado com sucesso!"
            Write-Log "✅ NPM $(npm --version) instalado com sucesso!"
        } else {
            Write-LogError "Node.js instalado mas não encontrado no PATH. Reinicie o PowerShell."
            exit 1
        }
    } catch {
        Write-LogError "Falha ao instalar Node.js: $_"
        Write-LogError "Tente instalar manualmente: choco install nodejs-lts -y"
        exit 1
    }
}

function Install-PostgreSQL {
    Write-Log "Verificando PostgreSQL..."
    
    if (Get-Command psql -ErrorAction SilentlyContinue) {
        Write-Log "✅ PostgreSQL já está instalado"
        return
    }
    
    Write-Log "Instalando PostgreSQL via Chocolatey..."
    
    try {
        choco install postgresql --params '/Password:smartsignage123' -y
        Write-Log "✅ PostgreSQL instalado com sucesso!"
        
        # Adicionar ao PATH
        $pgPath = "C:\Program Files\PostgreSQL\16\bin"
        if (Test-Path $pgPath) {
            $env:Path += ";$pgPath"
        }
    } catch {
        Write-LogError "Falha ao instalar PostgreSQL: $_"
        Write-LogError "Tente instalar manualmente: choco install postgresql -y"
        exit 1
    }
}

function Install-Docker {
    Write-Log "Verificando Docker..."
    
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        $dockerVersion = docker --version
        Write-Log "✅ Docker já está instalado: $dockerVersion"
        
        # Verificar se Docker está rodando
        try {
            docker ps | Out-Null
            Write-Log "✅ Docker está rodando"
        } catch {
            Write-Warn "Docker instalado mas não está rodando. Iniciando Docker Desktop..."
            Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
            Write-Log "Aguardando Docker iniciar..."
            Start-Sleep -Seconds 30
        }
        return
    }
    
    Write-Log "Instalando Docker Desktop via Chocolatey..."
    
    try {
        choco install docker-desktop -y
        Write-Log "✅ Docker Desktop instalado com sucesso!"
        Write-Warn "⚠️  Reinicie o computador e execute o script novamente para continuar"
        exit 0
    } catch {
        Write-LogError "Falha ao instalar Docker: $_"
        Write-LogError "Tente instalar manualmente: choco install docker-desktop -y"
        exit 1
    }
}

function Install-Git {
    Write-Log "Verificando Git..."
    
    if (Get-Command git -ErrorAction SilentlyContinue) {
        Write-Log "✅ Git já está instalado"
        return
    }
    
    Write-Log "Instalando Git via Chocolatey..."
    
    try {
        choco install git -y
        Write-Log "✅ Git instalado com sucesso!"
    } catch {
        Write-LogError "Falha ao instalar Git: $_"
        exit 1
    }
}

function Install-Dependencies {
    Write-Log "Instalando dependências básicas..."
    
    Install-Chocolatey
    Install-Git
    Install-NodeJS
    Install-PostgreSQL
    Install-Docker
    
    Write-Log "✅ Dependências básicas instaladas!"
}

# =============================================================================
# CONFIGURAÇÃO DE FIREWALL
# =============================================================================
function Configure-Firewall {
    Write-Log "Configurando firewall..."
    
    $ports = @(80, 3000, 8080, 5432, 6379, 1883, 9090, 3002)
    
    foreach ($port in $ports) {
        try {
            $rule = Get-NetFirewallRule -DisplayName "Smart Signage Pro - Port $port" -ErrorAction SilentlyContinue
            if (-not $rule) {
                New-NetFirewallRule -DisplayName "Smart Signage Pro - Port $port" `
                    -Direction Inbound `
                    -LocalPort $port `
                    -Protocol TCP `
                    -Action Allow | Out-Null
                Write-Log "✅ Porta $port aberta no firewall"
            } else {
                Write-Log "✅ Porta $port já está configurada"
            }
        } catch {
            Write-Warn "⚠️  Não foi possível configurar porta $port (pode requerer privilégios de administrador)"
        }
    }
    
    Write-Log "✅ Firewall configurado com sucesso!"
}

# =============================================================================
# MENU DE SELEÇÃO
# =============================================================================
function Show-Menu {
    if ($SKIP_MENU) {
        if ([string]::IsNullOrWhiteSpace($INSTALL_MODE)) {
            $script:INSTALL_MODE = "single-server"
        }
        return
    }
    
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host "                    Seleção de Modo de Instalação"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host ""
    Write-Host "Selecione o modo de instalação:"
    Write-Host "1) Single-Server (Appliance dedicado)"
    Write-Host "2) Docker (Produção - PostgreSQL)"
    Write-Host ""
    
    $choice = Read-Host "Digite sua escolha (1-2) [padrão: 1]"
    
    if ([string]::IsNullOrWhiteSpace($choice)) {
        $choice = "1"
    }
    
    switch ($choice) {
        "1" {
            $script:INSTALL_MODE = "single-server"
            Write-Log "Modo selecionado: single-server"
        }
        "2" {
            $script:INSTALL_MODE = "docker"
            Write-Log "Modo selecionado: docker"
        }
        default {
            Write-LogError "Opção inválida"
            exit 1
        }
    }
}

function Show-PlayersMenu {
    if ($SKIP_MENU) {
        return
    }
    
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host "                    Seleção de Players para Instalação"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host ""
    Write-Host "Selecione quais players deseja instalar/complementar:"
    Write-Host ""
    Write-Host "[ ] 1) webOS (LG) - Player para TVs LG webOS"
    Write-Host "[ ] 2) Android TV - Player para dispositivos Android TV"
    Write-Host "[ ] 3) Linux Electron - Player para Linux usando Electron"
    Write-Host "[ ] 4) Linux C++ - Player nativo C++ para Linux"
    Write-Host "[ ] 5) Windows Electron - Player para Windows usando Electron"
    Write-Host "[ ] 6) Tizen (Samsung) - Player para TVs Samsung Tizen"
    Write-Host "[ ] 7) SmartDisplayFX Client - Cliente para efeitos visuais"
    Write-Host "[ ] 8) Smart FX Interface - Interface e protótipos"
    Write-Host ""
    Write-Host "[ ] 9) Instalar TODOS os players (recomendado para desenvolvimento)"
    Write-Host "[ ] 0) Não instalar players (apenas servidor)"
    Write-Host ""
    
    $choice = Read-Host "Digite os números separados por vírgula (ex: 1,3,5) ou 9 para todos [padrão: 0]"
    
    if ([string]::IsNullOrWhiteSpace($choice)) {
        $choice = "0"
    }
    
    if ($choice -eq "9") {
        $script:INSTALL_ALL_PLAYERS = $true
        Write-Log "✅ Todos os players serão instalados"
    } elseif ($choice -ne "0") {
        $choices = $choice -split ','
        foreach ($c in $choices) {
            switch ($c.Trim()) {
                "1" { $script:INSTALL_PLAYER_WEBOS = $true }
                "2" { $script:INSTALL_PLAYER_ANDROID = $true }
                "3" { $script:INSTALL_PLAYER_LINUX_ELECTRON = $true }
                "4" { $script:INSTALL_PLAYER_LINUX_CPP = $true }
                "5" { $script:INSTALL_PLAYER_WINDOWS_ELECTRON = $true }
                "6" { $script:INSTALL_PLAYER_TIZEN = $true }
                "7" { $script:INSTALL_PLAYER_SMARTDISPLAYFX = $true }
                "8" { $script:INSTALL_PLAYER_FX_INTERFACE = $true }
            }
        }
    }
}

# =============================================================================
# CONFIGURAÇÃO DO PROJETO
# =============================================================================
function Setup-Project {
    Write-Log "Configurando projeto Smart Signage Pro..."
    
    if ($INSTALL_MODE -eq "single-server") {
        # Para single-server, usar diretório de origem diretamente
        $script:INSTALL_DIR = $SOURCE_DIR
        Write-Log "Modo Single-Server: usando diretório de origem diretamente: $INSTALL_DIR"
        Write-Log "✅ Não será necessário copiar arquivos - trabalhando diretamente do diretório de origem"
    } else {
        # Para Docker, pode usar diretório de origem ou criar em C:\SmartSignage-Pro
        $script:INSTALL_DIR = $SOURCE_DIR
        Write-Log "Modo Docker: usando diretório: $INSTALL_DIR"
    }
    
    # Verificar arquivos essenciais
    $essentialFiles = @(
        "backend\package.json",
        "frontend\package.json",
        "docker-compose.yml"
    )
    
    foreach ($file in $essentialFiles) {
        $fullPath = Join-Path $INSTALL_DIR $file
        if (-not (Test-Path $fullPath)) {
            Write-LogError "Arquivo essencial não encontrado: $fullPath"
            exit 1
        }
    }
    
    Write-Log "✅ Todos os arquivos essenciais verificados"
    Write-Log "Projeto configurado em $INSTALL_DIR"
}

# =============================================================================
# INSTALAÇÃO DE DEPENDÊNCIAS DO PROJETO
# =============================================================================
function Install-ProjectDependencies {
    Write-Log "Instalando dependências do projeto..."
    
    # Backend
    Write-Log "Instalando dependências do backend (incluindo dev para build)..."
    Push-Location "$INSTALL_DIR\backend"
    try {
        npm install
        Write-Log "✅ Dependências do backend instaladas"
    } catch {
        Write-LogError "Falha ao instalar dependências do backend: $_"
        exit 1
    } finally {
        Pop-Location
    }
    
    # Frontend
    Write-Log "Instalando dependências do frontend..."
    Push-Location "$INSTALL_DIR\frontend"
    try {
        npm install
        Write-Log "✅ Dependências do frontend instaladas"
    } catch {
        Write-LogError "Falha ao instalar dependências do frontend: $_"
        exit 1
    } finally {
        Pop-Location
    }
    
    Write-Log "✅ Dependências do projeto instaladas!"
}

# =============================================================================
# COMPILAÇÃO
# =============================================================================
function Build-Backend {
    Write-Log "Compilando TypeScript do backend..."
    Write-Log "Limpando build anterior..."
    
    Push-Location "$INSTALL_DIR\backend"
    try {
        if (Test-Path "dist") {
            Remove-Item -Recurse -Force "dist"
        }
        
        npm run build
        Write-Log "✅ Backend compilado com sucesso!"
    } catch {
        Write-LogError "Falha ao compilar backend: $_"
        exit 1
    } finally {
        Pop-Location
    }
}

function Build-Frontend {
    Write-Log "Compilando frontend..."
    
    Push-Location "$INSTALL_DIR\frontend"
    try {
        npm run build
        Write-Log "✅ Frontend compilado com sucesso!"
    } catch {
        Write-LogError "Falha ao compilar frontend: $_"
        exit 1
    } finally {
        Pop-Location
    }
}

# =============================================================================
# CONFIGURAÇÃO DE BANCO DE DADOS
# =============================================================================
function Setup-Database {
    Write-Log "Configurando banco de dados..."
    
    # Verificar se PostgreSQL está rodando
    try {
        $pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
        if ($pgService) {
            if ($pgService.Status -ne "Running") {
                Write-Log "Iniciando serviço PostgreSQL..."
                Start-Service $pgService.Name
            }
            Write-Log "✅ PostgreSQL está rodando"
        } else {
            Write-Warn "⚠️  Serviço PostgreSQL não encontrado. Verifique a instalação."
        }
    } catch {
        Write-Warn "⚠️  Não foi possível verificar o serviço PostgreSQL: $_"
    }
    
    # Criar banco de dados se não existir (ou resetar se solicitado)
    $dbName = "smartsignage"
    $dbUser = "smartsignage"
    $dbPassword = "smartsignage123"
    
    try {
        $env:PGPASSWORD = $dbPassword
        $createDbQuery = "SELECT 1 FROM pg_database WHERE datname = '$dbName'"
        $dbExists = psql -U postgres -tAc $createDbQuery 2>&1
        $dbWasCreatedOrReset = $false

        # Reset explícito do banco (se existir) — preserva quando --preserve-db estiver ativo
        if ($RESET_DATABASE -and -not $PRESERVE_DB -and $dbExists -and $dbExists.Trim() -eq "1") {
            Write-Log "Reset solicitado: removendo banco de dados $dbName..."
            try {
                # Finalizar conexões para permitir DROP DATABASE
                psql -U postgres -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$dbName' AND pid <> pg_backend_pid();" 2>&1 | Out-Null
            } catch {
                Write-Warn "⚠️  Não foi possível finalizar conexões ativas (continuando): $_"
            }

            psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS $dbName;" 2>&1 | Out-Null
            $dbExists = ""
            $dbWasCreatedOrReset = $true
            Write-Log "✅ Banco removido"
        }
        
        if (-not $dbExists -or $dbExists.Trim() -ne "1") {
            Write-Log "Criando banco de dados $dbName..."
            psql -U postgres -d postgres -c "CREATE DATABASE $dbName;" 2>&1 | Out-Null
            Write-Log "✅ Banco de dados criado"
            $dbWasCreatedOrReset = $true
        } else {
            Write-Log "✅ Banco de dados já existe"
        }
        
        # Criar usuário se não existir
        $userExists = psql -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$dbUser'" 2>&1
        if (-not $userExists -or $userExists.Trim() -ne "1") {
            Write-Log "Criando usuário $dbUser..."
            psql -U postgres -c "CREATE USER $dbUser WITH PASSWORD '$dbPassword';" 2>&1 | Out-Null
            psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;" 2>&1 | Out-Null
            Write-Log "✅ Usuário criado"
        } else {
            Write-Log "✅ Usuário já existe"
        }

        # Se o banco acabou de ser criado/resetado e o usuário não forçou a opção de seeds,
        # carregar seeds automaticamente para instalar com dados de exemplo.
        if ($dbWasCreatedOrReset -and -not $SEEDS_OPTION_FORCED) {
            $script:LOAD_SEEDS = $true
            Write-Log "Banco recém-criado/resetado. Seeds serão carregadas automaticamente (use --skip-seeds para desabilitar)."
        }

        # Aplicar schema + seeds quando necessário
        $databaseUrl = "postgresql://$dbUser:$dbPassword@localhost:5432/$dbName"
        # Schema antigo foi descontinuado/removido.
        # Usar schema refatorado master, que inclui os módulos do Dispatcher (dispatcher_log, device_tokens, playlist mix, etc.).
        $schemaFile = Join-Path $INSTALL_DIR "database\smartchannel-db-v2-refactored-apply-all.sql"
        # Usar carga-inicial-v6.sql (validada e consistente) como padrão.
        $seedsFile = Join-Path $INSTALL_DIR "database\carga-inicial-v6.sql"

        if ($dbWasCreatedOrReset) {
            if (Test-Path $schemaFile) {
                Write-Log "Aplicando schema: database/smartchannel-db-v2-refactored-apply-all.sql"

                # IMPORTANT: o apply-all usa comandos \i, então o psql deve rodar dentro do diretório database/
                $databaseDir = Join-Path $INSTALL_DIR "database"
                Push-Location $databaseDir
                try {
                    psql $databaseUrl -f "smartchannel-db-v2-refactored-apply-all.sql" 2>&1 | Out-Null
                    Write-Log "✅ Schema aplicado"
                } finally {
                    Pop-Location
                }
            } else {
                Write-Warn "⚠️  Schema não encontrado: $schemaFile"
            }
        }

        if ($LOAD_SEEDS) {
            if (Test-Path $seedsFile) {
                Write-Log "Aplicando seeds: $(Split-Path -Leaf $seedsFile)"
                psql $databaseUrl -f $seedsFile 2>&1 | Out-Null
                Write-Log "✅ Seeds aplicadas"
            } else {
                Write-Warn "⚠️  Seeds não encontradas: $seedsFile"
            }
        } else {
            Write-Log "Seeds ignoradas (use --load-seeds para forçar)."
        }
    } catch {
        Write-Warn "⚠️  Não foi possível configurar banco de dados automaticamente: $_"
        Write-Warn "⚠️  Configure manualmente:"
        Write-Warn "   CREATE DATABASE $dbName;"
        Write-Warn "   CREATE USER $dbUser WITH PASSWORD '$dbPassword';"
        Write-Warn "   GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;"
    }
    
    Write-Log "✅ Banco de dados configurado!"
}

# =============================================================================
# CONFIGURAÇÃO DE AMBIENTE
# =============================================================================
function Setup-Environment {
    Write-Log "Configurando variáveis de ambiente..."
    
    $envFile = Join-Path $INSTALL_DIR ".env"
    
    if (-not (Test-Path $envFile)) {
        Write-Log "Criando arquivo .env..."
        
        $envContent = @"
# Smart Signage Pro - Configuração de Ambiente
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage

# JWT
JWT_SECRET=smartsignage-windows-secret-key-2025-change-in-production

# Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=500000000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# MQTT
MQTT_ENABLED=true
MQTT_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=
"@
        
        $envContent | Out-File -FilePath $envFile -Encoding UTF8
        Write-Log "✅ Arquivo .env criado"
    } else {
        Write-Log "✅ Arquivo .env já existe"
    }
}

# =============================================================================
# DOCKER COMPOSE
# =============================================================================
function Setup-DockerCompose {
    if ($INSTALL_MODE -ne "docker") {
        return
    }
    
    Write-Log "Configurando Docker Compose..."
    
    Push-Location $INSTALL_DIR
    try {
        # Verificar se docker-compose.yml existe
        if (-not (Test-Path "docker-compose.yml")) {
            Write-LogError "docker-compose.yml não encontrado"
            exit 1
        }
        
        # Build e start
        if ($REBUILD_CACHE) {
            Write-Log "Fazendo build sem cache..."
            docker-compose build --no-cache
        } else {
            Write-Log "Fazendo build..."
            docker-compose build
        }
        
        Write-Log "Iniciando containers..."
        docker-compose up -d
        
        Write-Log "✅ Docker Compose configurado e containers iniciados!"
    } catch {
        Write-LogError "Falha ao configurar Docker Compose: $_"
        exit 1
    } finally {
        Pop-Location
    }
}

# =============================================================================
# SERVIÇOS WINDOWS
# =============================================================================
function Create-WindowsService {
    if ($INSTALL_MODE -ne "single-server") {
        return
    }
    
    Write-Log "Criando serviço Windows..."
    
    # Verificar se pm2 está instalado
    if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
        Write-Log "Instalando PM2 globalmente..."
        npm install -g pm2
        npm install -g pm2-windows-startup
    }
    
    # Configurar PM2 para iniciar no boot
    pm2 startup | Out-Null
    
    Write-Log "✅ Serviço Windows configurado!"
}

# =============================================================================
# INFORMAÇÕES FINAIS
# =============================================================================
function Show-FinalInfo {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
    Write-Host "║                    🎉 INSTALAÇÃO CONCLUÍDA! 🎉                ║" -ForegroundColor Magenta
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
    Write-Host ""
    
    $localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1).IPAddress
    
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                    🌐 LINKS DE ACESSO                        ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 PAINEL ADMINISTRATIVO (Login):" -ForegroundColor Cyan
    Write-Host "   👉 http://$localIP:8080" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📺 PLAYER DE MÍDIA (Totem):" -ForegroundColor Cyan
    Write-Host "   👉 http://$localIP:80/player?uin=TOTEM_UIN" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🔧 API BACKEND:" -ForegroundColor Cyan
    Write-Host "   👉 http://$localIP:3000" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                    🔐 CREDENCIAIS DE ACESSO                  ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "👤 USUÁRIO: admin" -ForegroundColor Red
    Write-Host "🔑 SENHA:  admin123" -ForegroundColor Red
    Write-Host ""
    Write-Host "⚠️  ATENÇÃO: ALTERE A SENHA APÓS O PRIMEIRO LOGIN!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📁 Diretório de Instalação: $INSTALL_DIR" -ForegroundColor Blue
    Write-Host ""
}

# =============================================================================
# FUNÇÃO PRINCIPAL
# =============================================================================
function Main {
    param([string[]]$Arguments)
    
    Parse-Arguments $Arguments
    Show-Banner
    
    if (-not (Test-Administrator)) {
        Write-LogError "Este script requer privilégios de administrador"
        Write-LogError "Execute: Start-Process PowerShell -Verb RunAs"
        exit 1
    }
    
    Test-OS
    Test-ProjectDirectory
    
    Show-Menu
    Setup-Project
    Show-PlayersMenu
    
    Write-Log "Iniciando instalação do Smart Signage Pro v2.0..."
    
    Install-Dependencies
    Configure-Firewall
    Install-ProjectDependencies
    Build-Backend
    Build-Frontend
    Setup-Database
    Setup-Environment
    
    if ($INSTALL_MODE -eq "docker") {
        Setup-DockerCompose
    } else {
        Create-WindowsService
    }
    
    Show-FinalInfo
}

# Executar script
Main $args

