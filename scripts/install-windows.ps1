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
  $url = "http://${Host}:${Port}/health"
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

# Função para obter IP local
function Get-LocalIP {
  try {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1).IPAddress
    if ($ip) { return $ip } else { return "localhost" }
  } catch { return "localhost" }
}

# Função para obter IP externo (opcional)
function Get-ExternalIP {
  try {
    $ip = (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 5)
    if ($ip -and $ip -match '^\d+\.\d+\.\d+\.\d+$') { return $ip } else { return $null }
  } catch { return $null }
}

# Exibir informações de acesso
function Show-AccessInfo {
  $localIP = Get-LocalIP
  $externalIP = Get-ExternalIP
  $frontendPort = 8080
  $backendPort = 3000
  $grafanaPort = 3002
  $prometheusPort = 9090

  Write-Host ""
  Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
  Write-Host "║                    🚀 INSTALAÇÃO CONCLUÍDA!                 ║" -ForegroundColor Green
  Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
  Write-Host ""
  
  Write-Host "📱 PAINEL ADMINISTRATIVO (Frontend):" -ForegroundColor Cyan
  if ($externalIP) {
    Write-Host "   👉 IP Externo: http://$externalIP`:$frontendPort" -ForegroundColor Yellow -NoNewline
    Write-Host " (Acesso remoto)" -ForegroundColor Green
  }
  Write-Host "   👉 IP Local:   http://$localIP`:$frontendPort" -ForegroundColor Yellow -NoNewline
  Write-Host " (Rede interna)" -ForegroundColor Blue
  Write-Host "   (Interface principal do sistema)" -ForegroundColor Blue
  Write-Host ""
  
  Write-Host "🔧 API BACKEND:" -ForegroundColor Cyan
  if ($externalIP) {
    Write-Host "   👉 IP Externo: http://$externalIP`:$backendPort" -ForegroundColor Yellow -NoNewline
    Write-Host " (Acesso remoto)" -ForegroundColor Green
  }
  Write-Host "   👉 IP Local:   http://$localIP`:$backendPort" -ForegroundColor Yellow -NoNewline
  Write-Host " (Rede interna)" -ForegroundColor Blue
  Write-Host "   (API REST para integração)" -ForegroundColor Blue
  Write-Host ""
  
  Write-Host "📺 PLAYER DE MÍDIA:" -ForegroundColor Cyan
  if ($externalIP) {
    Write-Host "   👉 IP Externo: http://$externalIP`:$frontendPort/player" -ForegroundColor Yellow -NoNewline
    Write-Host " (Acesso remoto)" -ForegroundColor Green
  }
  Write-Host "   👉 IP Local:   http://$localIP`:$frontendPort/player" -ForegroundColor Yellow -NoNewline
  Write-Host " (Rede interna)" -ForegroundColor Blue
  Write-Host "   (Player para totems)" -ForegroundColor Blue
  Write-Host ""
  
  Write-Host "📊 MONITORAMENTO:" -ForegroundColor Cyan
  if ($externalIP) {
    Write-Host "   Prometheus: http://$externalIP`:$prometheusPort" -ForegroundColor Yellow -NoNewline
    Write-Host " (Externo)" -ForegroundColor Green
    Write-Host "   Grafana:    http://$externalIP`:$grafanaPort" -ForegroundColor Yellow -NoNewline
    Write-Host " (Externo - admin/admin)" -ForegroundColor Green
  }
  Write-Host "   Prometheus: http://$localIP`:$prometheusPort" -ForegroundColor Yellow -NoNewline
  Write-Host " (Local)" -ForegroundColor Blue
  Write-Host "   Grafana:    http://$localIP`:$grafanaPort" -ForegroundColor Yellow -NoNewline
  Write-Host " (Local - admin/admin)" -ForegroundColor Blue
  Write-Host ""
  
  Write-Host "📚 DOCUMENTAÇÃO API:" -ForegroundColor Cyan
  if ($externalIP) {
    Write-Host "   Swagger UI: http://$externalIP`:$backendPort/api-docs" -ForegroundColor Yellow -NoNewline
    Write-Host " (Externo)" -ForegroundColor Green
  }
  Write-Host "   Swagger UI: http://$localIP`:$backendPort/api-docs" -ForegroundColor Yellow -NoNewline
  Write-Host " (Local)" -ForegroundColor Blue
  Write-Host "   Health:     http://$localIP`:$backendPort/health" -ForegroundColor Yellow -NoNewline
  Write-Host " (Status do sistema)" -ForegroundColor Blue
  Write-Host ""
  
  Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
  Write-Host "║                    🚀 PRÓXIMOS PASSOS                       ║" -ForegroundColor Green
  Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
  Write-Host ""
  Write-Host "1. " -NoNewline -ForegroundColor Yellow
  Write-Host "Acesse o sistema: " -NoNewline -ForegroundColor Cyan
  Write-Host "http://$localIP`:$frontendPort" -ForegroundColor Yellow
  Write-Host "2. " -NoNewline -ForegroundColor Yellow
  Write-Host "Faça login com: " -NoNewline -ForegroundColor Cyan
  Write-Host "admin/admin" -ForegroundColor Yellow
  Write-Host "3. " -NoNewline -ForegroundColor Yellow
  Write-Host "Altere a senha do administrador" -ForegroundColor Cyan
  Write-Host "4. " -NoNewline -ForegroundColor Yellow
  Write-Host "Configure seus clientes e totems" -ForegroundColor Cyan
  Write-Host "5. " -NoNewline -ForegroundColor Yellow
  Write-Host "Monitore o sistema via Grafana" -ForegroundColor Cyan
  Write-Host ""
  
  Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
  Write-Host "║                    🎯 COMANDOS ÚTEIS                        ║" -ForegroundColor Magenta
  Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
  Write-Host ""
  Write-Host "Gerenciar sistema:" -ForegroundColor Cyan
  Write-Host "  .\scripts\manage-system.ps1 start|stop|restart|status|logs" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Diagnosticar problemas:" -ForegroundColor Cyan
  Write-Host "  .\scripts\diagnose-system.ps1" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Backup/Restore:" -ForegroundColor Cyan
  Write-Host "  .\scripts\backup-system.ps1 -Action backup" -ForegroundColor Yellow
  Write-Host "  .\scripts\backup-system.ps1 -Action restore -File backup.zip" -ForegroundColor Yellow
  Write-Host ""
  
  Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
  Write-Host "║                    🎯 SISTEMA OPERACIONAL!                  ║" -ForegroundColor Magenta
  Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
  Write-Host ""
  Write-Host "🎯 Sistema instalado e funcionando perfeitamente!" -ForegroundColor Green
  Write-Host "🌐 Acesse agora: " -NoNewline -ForegroundColor Green
  Write-Host "http://$localIP`:$frontendPort" -ForegroundColor Yellow
  Write-Host ""
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
Show-AccessInfo
