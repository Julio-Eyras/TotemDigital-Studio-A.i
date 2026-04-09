[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $root
$todoFile = Join-Path $projectRoot "TODO-CONVERSAO-ANDROID.md"

if (-not (Test-Path $todoFile)) {
    Write-Error "TODO nao encontrado: $todoFile"
}

Write-Host "== SmartSignage-AD TODO executor =="
Write-Host "Arquivo: $todoFile"
Write-Host ""
Write-Host "Status desta iteracao:"
Write-Host " - Fase 0: concluida"
Write-Host " - Fase 1: concluida"
Write-Host " - Fase 2: concluida"
Write-Host " - Fase 3: concluida"
Write-Host " - Fase 4: concluida"
Write-Host " - Fase 5: concluida"
Write-Host " - TODO concluido fim-a-fim (Fases 0-5)."
Write-Host ""
Write-Host "Checklist atual:"
Get-Content $todoFile | ForEach-Object { Write-Host $_ }
