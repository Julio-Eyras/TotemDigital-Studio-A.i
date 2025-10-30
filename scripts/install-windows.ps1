<#
Smart Signage Pro v2.0 - Instalador Windows (PowerShell)
Alvo: Windows 10/11 ou Windows Server com suporte a Docker Desktop (Linux containers)
Requisitos: Executar como Administrator
#>

[CmdletBinding()]
param(
  [string]$InstallDir = "C:\SmartSignage-Pro",
  [string]$RepoUrl = "https://github.com/Julio-Eyras/smartsignage-pro.git",
  [switch]$ForceRebuild,
  [switch]$NoCache,
  [switch]$SkipClone
)

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Execute este script no PowerShell como Administrador."
    exit 1
  }
}

function Ensure-Winget {
  if (Get-Command winget -ErrorAction SilentlyContinue) { return }
  Write-Warning "winget não encontrado. Instale manualmente via Microsoft Store (App Installer) ou use Chocolatey."
}

function Install-PackageIfMissing($id, $name) {
  if (Get-Command $name -ErrorAction SilentlyContinue) { return }
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host "Instalando $name via winget..."
    winget install --id $id --accept-package-agreements --accept-source-agreements -h --silent | Out-Null
  } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
    Write-Host "Instalando $name via chocolatey..."
    choco install $name -y | Out-Null
  } else {
    Write-Warning "Nem winget nem choco disponíveis. Instale $name manualmente."
  }
}

function Enable-WSL2 {
  try {
    Write-Host "Habilitando WSL e VirtualMachinePlatform (requer reboot)..."
    Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart -ErrorAction SilentlyContinue | Out-Null
    Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart -ErrorAction SilentlyContinue | Out-Null
  } catch { Write-Warning "Falha ao habilitar WSL/VirtualMachinePlatform: $_" }
}

function Ensure-DockerDesktop {
  if (Get-Command docker -ErrorAction SilentlyContinue) { return }
  Install-PackageIfMissing -id "Docker.DockerDesktop" -name "docker"
  Write-Host "Se solicitado, faça logoff/login e confirme Docker Desktop rodando com Linux containers."
}

function Ensure-Git {
  if (Get-Command git -ErrorAction SilentlyContinue) { return }
  Install-PackageIfMissing -id "Git.Git" -name "git"
}

function Ensure-Repo {
  if (-not (Test-Path $InstallDir)) { New-Item -Type Directory -Path $InstallDir | Out-Null }
  if (-not $SkipClone) {
    if (Test-Path (Join-Path $InstallDir ".git")) {
      Write-Host "Atualizando repositório existente..."
      Push-Location $InstallDir
      git fetch --all
      git reset --hard origin/main
      Pop-Location
    } else {
      Write-Host "Clonando repositório em $InstallDir..."
      git clone $RepoUrl $InstallDir
    }
  }
}

function Docker-Up {
  Push-Location $InstallDir
  $compose = (Get-Command docker-compose -ErrorAction SilentlyContinue) ? "docker-compose" : "docker compose"
  if ($ForceRebuild) {
    & $compose down --remove-orphans 2>$null | Out-Null
  }
  if ($NoCache) {
    & $compose build --no-cache | Write-Host
  } else {
    & $compose build | Write-Host
  }
  & $compose up -d | Write-Host
  Pop-Location
}

function Wait-Health {
  param([string]$Host = "localhost", [int]$Port=3000, [int]$TimeoutSec=120)
  $url = "http://$Host:$Port/health"
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -eq 200) { Write-Host "Backend saudável"; return }
    } catch {}
    Start-Sleep -Seconds 3
  }
  Write-Warning "Timeout aguardando saúde do backend em $url"
}

function Post-Install-Check {
  $env:HOST_OVERRIDE = "localhost"
  $ps1 = Join-Path $InstallDir "scripts/post-install-check.ps1"
  $sh = Join-Path $InstallDir "scripts/post-install-check.sh"
  if (Get-Command bash -ErrorAction SilentlyContinue) {
    if (Test-Path $sh) { Write-Host "Executando checklist (.sh via bash)..."; bash $sh }
    elseif (Test-Path $ps1) { Write-Host "Executando checklist (.ps1)..."; & powershell -ExecutionPolicy Bypass -File $ps1 }
  } else {
    if (Test-Path $ps1) { Write-Host "Executando checklist (.ps1)..."; & powershell -ExecutionPolicy Bypass -File $ps1 }
    else { Write-Warning "Checklist não encontrado" }
  }
}

# Execução
Assert-Admin
Ensure-Winget
Ensure-Git
Enable-WSL2
Ensure-DockerDesktop
Ensure-Repo
Docker-Up
Wait-Health -Host "localhost" -Port 3000 -TimeoutSec 180
Post-Install-Check

Write-Host "\nInstalação concluída. Acesse:"
Write-Host "- API:          http://localhost:3000/api"
Write-Host "- Swagger JSON: http://localhost:3000/api/docs.json"
Write-Host "- Grafana:      http://localhost:3002 (admin/admin)"
Write-Host "- Prometheus:   http://localhost:9090"
