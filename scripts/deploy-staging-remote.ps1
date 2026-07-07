# Deploy staging TotemDigital via SSH (Windows)
# Uso:
#   .\scripts\deploy-staging-remote.ps1 -User seu_usuario
#   .\scripts\deploy-staging-remote.ps1 -User seu_usuario -Host 217.216.91.135 -InstallDir /opt/smart-signage

param(
    [Parameter(Mandatory = $true)]
    [string]$User,
    [string]$StagingHost = '217.216.91.135',
    [string]$InstallDir = '/opt/smart-signage',
    [string]$Branch = 'Smart-Signage-Studio-Vx5'
)

$ErrorActionPreference = 'Stop'

Write-Host "== Deploy staging: ${User}@${StagingHost} ==" -ForegroundColor Cyan
Write-Host "INSTALL_DIR=$InstallDir  BRANCH=$Branch"

$remoteCmd = @"
set -euo pipefail
cd '$InstallDir'
if [[ ! -d backend ]]; then
  echo 'ERRO: backend/ nao encontrado em $InstallDir'
  exit 1
fi
BRANCH='$Branch' bash scripts/deploy-staging-vx5.sh
"@

ssh "${User}@${StagingHost}" $remoteCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "Deploy falhou (exit $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Deploy concluido. Smoke:" -ForegroundColor Green
curl -s --max-time 10 "http://${StagingHost}:8080/api/health" | Write-Host
Write-Host ""
Write-Host "Homologacao: http://${StagingHost}:8080/ -> Totens -> Controle Remoto -> Sincronizacao TV Smart"
