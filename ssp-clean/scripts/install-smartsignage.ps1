# =============================================================================
# Smart Signage Pro - Auto-instalação Windows (paridade com install-smartsignage.sh)
# =============================================================================
# Versão do Sistema: 2.1.0
# Versão do Script: 2.1.8
# =============================================================================
# Uso: .\scripts\install-smartsignage.ps1 [OPÇÕES]
# Requer: PowerShell 5.1+, executar como Administrador
# =============================================================================

#Requires -Version 5.1

# Consola UTF-8 (evita caracteres corrompidos em PT) + npm usa stderr para avisos
try {
    chcp 65001 | Out-Null
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch { }

$ErrorActionPreference = "Stop"

# --- Raiz de scripts (usada pela biblioteca quando dot-sourced) ---
$script:SmSiScriptRoot = $PSScriptRoot
if (-not $script:SmSiScriptRoot) {
    $script:SmSiScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$lib = Join-Path $script:SmSiScriptRoot "install-smartsignage.windows.lib.ps1"
if (-not (Test-Path $lib)) {
    Write-Host ('[ERRO] Biblioteca nao encontrada: ' + $lib) -ForegroundColor Red
    exit 1
}
. $lib

# =============================================================================
# Versões e estado global (alinhado ao bash)
# =============================================================================
$script:SYSTEM_VERSION = "2.1.0"
$script:SCRIPT_VERSION = "2.1.8"

$script:FRESH_MODE = $false
$script:REBUILD_MODE = $false
$script:REBUILD_CACHE = $false
$script:REBUILD_ONLY = $false
$script:FORCE_REBUILD = $false
$script:CHECK_ONLY = $false
$script:SKIP_MENU = $false
$script:INSTALL_MODE = ""
$script:ENABLE_HTTPS_SELF_SIGNED = $false
$script:ENABLE_HTTPS_LETSENCRYPT = $false
$script:DOMAIN_NAME = ""
$script:SSL_EMAIL = ""
$script:ENABLE_KIOSK_MODE = $false
$script:RESET_DATABASE = $false
$script:PRESERVE_DB = $false
$script:LOAD_SEEDS = $false
$script:SEEDS_OPTION_FORCED = $false
$script:START_TOTEM = $false
$script:CONFIGURE_DNS_LOCAL = $false
$script:DB_ONLY_MODE = $false
$script:BACKEND_BUILD_ONLY = $false
$script:FRONTEND_BUILD_ONLY = $false
$script:BACKFRONT_BUILD_ONLY = $false
$script:SM_DB_URL = ""

$script:INSTALL_PLAYER_WEBOS = $false
$script:INSTALL_PLAYER_ANDROID = $false
$script:INSTALL_PLAYER_LINUX_ELECTRON = $false
$script:INSTALL_PLAYER_LINUX_CPP = $false
$script:INSTALL_PLAYER_WINDOWS_ELECTRON = $false
$script:INSTALL_PLAYER_TIZEN = $false
$script:INSTALL_PLAYER_SMARTDISPLAYFX = $false
$script:INSTALL_PLAYER_FX_INTERFACE = $false
$script:INSTALL_PLAYER_WEB_CACHE = $false
$script:INSTALL_ALL_PLAYERS = $false

$script:INSTALL_DIR = ""
$script:SOURCE_DIR = ""

# =============================================================================
# Logging
# =============================================================================
function Write-Log {
    param([string]$Message)
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host ('[' + $ts + '] ' + $Message) -ForegroundColor Green
}
function Write-LogDetailed {
    param([string]$Message)
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host ('[DETALHADO ' + $ts + '] ' + $Message) -ForegroundColor Blue
}
function Write-LogError {
    param([string]$Message)
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host ('[ERRO ' + $ts + '] ' + $Message) -ForegroundColor Red
}
function Write-LogProgress {
    param([string]$Message)
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host ('[PROGRESSO ' + $ts + '] ' + $Message) -ForegroundColor Cyan
}
function Write-LogStatus {
    param([string]$Message)
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host ('[STATUS ' + $ts + '] ' + $Message) -ForegroundColor Magenta
}
function Write-Warn {
    param([string]$Message)
    Write-Host ('[AVISO] ' + $Message) -ForegroundColor Yellow
}
function Write-Info {
    param([string]$Message)
    Write-Host ('[INFO] ' + $Message) -ForegroundColor Blue
}

function Show-Banner {
    Clear-Host
    Write-Host '==============================================================' -ForegroundColor Magenta
    Write-Host '                 Smart Signage Pro' -ForegroundColor Magenta
    Write-Host '                 Auto-instalacao Windows' -ForegroundColor Magenta
    Write-Host "  Sistema: $($script:SYSTEM_VERSION)   Script: $($script:SCRIPT_VERSION)" -ForegroundColor Magenta
    Write-Host '==============================================================' -ForegroundColor Magenta
    Write-Host ''
}

function Test-Administrator {
    $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-OS {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    if (-not $os) { return }
    Write-Log "SO: $($os.Caption) versao $($os.Version)"
    $maj = [int]($os.Version.Split('.')[0])
    if ($maj -lt 10) {
        Write-LogError "Windows 10 ou superior e necessario."
        exit 1
    }
}

function Test-ProjectDirectory {
    $root = Get-SmSiRepoRoot
    $be = Join-Path $root "backend"
    if (-not (Test-Path $be -PathType Container)) {
        Write-LogError "Pasta backend nao encontrada em: $root"
        exit 1
    }
    $script:SOURCE_DIR = $root
    $script:INSTALL_DIR = $root
    Write-Log ('[OK] Projeto: ' + $root)
}

function Show-Help {
    Write-Host ('Smart Signage Pro v' + $script:SYSTEM_VERSION + ' - Instalacao Windows - paridade install-smartsignage.sh')
    Write-Host ''
    Write-Host 'Uso: .\install-smartsignage.ps1 [OPCOES]'
    Write-Host ''
    Write-Host 'Opcoes principais: fresh, rebuild, rebuild-cache, rebuild-only, force, check-only, skip-menu'
    Write-Host 'mode [modo]: single-server | docker | development | rebuild-restart'
    Write-Host 'https-self-signed, reset-db, preserve-db, db-only, backend-only, frontend-only, backfront-build'
    Write-Host 'load-seeds, with-seeds, skip-seeds, no-seeds, starttotem, help / h'
    Write-Host ''
    Write-Host 'Notas: no Windows, systemd equivale a PM2 + Nginx Chocolatey. Docker requer Docker Desktop.'
}

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
            "--rebuild" { $script:REBUILD_MODE = $true }
            "--rebuild-cache" {
                $script:REBUILD_MODE = $true
                $script:REBUILD_CACHE = $true
            }
            "--rebuild-only" {
                $script:REBUILD_MODE = $true
                $script:REBUILD_ONLY = $true
            }
            "--force" { $script:FORCE_REBUILD = $true }
            "--check-only" { $script:CHECK_ONLY = $true }
            "--skip-menu" { $script:SKIP_MENU = $true }
            "--mode" {
                $script:SKIP_MENU = $true
                if ($i + 1 -ge $Arguments.Length) {
                    Write-LogError 'Falta valor para mode: single-server docker development rebuild-restart'
                    exit 1
                }
                $script:INSTALL_MODE = $Arguments[$i + 1]
                $i++
            }
            "--install-mode" {
                $script:SKIP_MENU = $true
                if ($i + 1 -ge $Arguments.Length) {
                    Write-LogError "Falta valor para --install-mode"
                    exit 1
                }
                $script:INSTALL_MODE = $Arguments[$i + 1]
                $i++
            }
            "--https-self-signed" { $script:ENABLE_HTTPS_SELF_SIGNED = $true }
            "--reset-db" { $script:RESET_DATABASE = $true }
            "--preserve-db" { $script:PRESERVE_DB = $true }
            "--db-only" {
                $script:DB_ONLY_MODE = $true
                $script:RESET_DATABASE = $true
                $script:SKIP_MENU = $true
            }
            "--backend-only" {
                $script:BACKEND_BUILD_ONLY = $true
                $script:SKIP_MENU = $true
            }
            "--frontend-only" {
                $script:FRONTEND_BUILD_ONLY = $true
                $script:SKIP_MENU = $true
            }
            "--backfront-build" {
                $script:BACKFRONT_BUILD_ONLY = $true
                $script:SKIP_MENU = $true
            }
            "--load-seeds" {
                $script:LOAD_SEEDS = $true
                $script:SEEDS_OPTION_FORCED = $true
            }
            "--with-seeds" {
                $script:LOAD_SEEDS = $true
                $script:SEEDS_OPTION_FORCED = $true
            }
            "--skip-seeds" {
                $script:LOAD_SEEDS = $false
                $script:SEEDS_OPTION_FORCED = $true
            }
            "--no-seeds" {
                $script:LOAD_SEEDS = $false
                $script:SEEDS_OPTION_FORCED = $true
            }
            "--starttotem" { $script:START_TOTEM = $true }
            "--help" { Show-Help; exit 0 }
            "-h" { Show-Help; exit 0 }
            default {
                Write-Warn "Opcao desconhecida: $($Arguments[$i])"
            }
        }
    }
}

function Main {
    param([string[]]$Arguments)

    Parse-Arguments $Arguments
    Show-Banner

    if (-not (Test-Administrator)) {
        Write-LogError "Execute como Administrador: Start-Process PowerShell -Verb RunAs"
        exit 1
    }

    Test-OS
    Test-ProjectDirectory

    if ($script:CHECK_ONLY) {
        $needed = Test-SmSiRebuildNeeded
        if ($needed) {
            Write-Host 'Rebuild necessario'
            exit 0
        }
        Write-Host 'Rebuild nao necessario'
        exit 1
    }

    if ($script:FRESH_MODE) {
        Write-Host "AVISO: MODO FRESH - instalacao Docker sem menu" -ForegroundColor Red
    } elseif ($script:REBUILD_MODE) {
        Write-Host "MODO REBUILD ativo" -ForegroundColor Yellow
    }

    if ($script:DB_ONLY_MODE) {
        Invoke-SmSiDbOnly
        return
    }

    if ($script:BACKEND_BUILD_ONLY -or $script:FRONTEND_BUILD_ONLY -or $script:BACKFRONT_BUILD_ONLY) {
        if ([string]::IsNullOrWhiteSpace($script:INSTALL_MODE)) {
            $script:INSTALL_MODE = "single-server"
        }
        Invoke-SmSiSelectiveBuild
        return
    }

    # Modo desenvolvimento = mesmo pipeline que single-server (como no bash)
    if ($script:INSTALL_MODE -eq 'development') {
        Write-Log 'Modo development = single-server PostgreSQL local'
    }

    Invoke-SmSiFullInstall
}

Main $args
