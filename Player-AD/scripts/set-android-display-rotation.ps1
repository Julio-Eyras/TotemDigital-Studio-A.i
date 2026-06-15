#Requires -Version 5.1
<#
.SYNOPSIS
  Ajusta rotação física do display Android via ADB (sem abrir o Player-AD).

.DESCRIPTION
  Grava user_rotation e desativa accelerometer_rotation no SO.
  Tenta settings via shell; se falhar, usa su -c (quando root estiver disponível).

  Valores de -Rotation:
    0 = 0° (landscape nativo)
    1 = 90° — portrait típico em painel landscape (padrão totem)
    2 = 180°
    3 = 270°

.EXAMPLE
  .\set-android-display-rotation.ps1
.EXAMPLE
  .\set-android-display-rotation.ps1 -Rotation 1 -ShowDiagnostics
#>
[CmdletBinding()]
param(
    [ValidateRange(0, 3)]
    [int] $Rotation = 1,
    [switch] $ShowDiagnostics
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
    Write-Error 'adb nao esta no PATH.'
}

$devices = (& adb devices 2>&1 | Where-Object { $_ -match '^\S+\s+device$' })
if (-not $devices) {
    Write-Error 'Nenhum dispositivo ADB conectado (adb devices).'
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir 'android-box-diagnostics.ps1')

Write-Host "== Rotação de display via ADB (user_rotation=$Rotation) ==" -ForegroundColor Cyan

$result = Set-AndroidDisplayRotation -Rotation $Rotation
foreach ($step in $result.Steps.GetEnumerator()) {
    if ($step.Value) {
        Write-Host "  OK $($step.Key)" -ForegroundColor Green
    } else {
        Write-Host "  FALHOU $($step.Key)" -ForegroundColor Red
    }
}

if ($result.PortraitProvisioned) {
    Write-Host "`nPortrait confirmado no SO." -ForegroundColor Green
    exit 0
}

Write-Host "`nAVISO: settings gravados mas portrait nao confirmado (user_rotation=$($result.UserRotation), accelerometer=$($result.AccelerometerRotation))." -ForegroundColor Yellow
Write-Host "Alguns fabricantes exigem menu de fábrica ou prop hwrotation; o Player-AD nao gira a tela." -ForegroundColor DarkYellow

if ($ShowDiagnostics) {
    $diag = Get-AndroidBoxDiagnostics -ExpectedUserRotation $Rotation
    Write-AndroidBoxDiagnosticsSummary -Diagnostics $diag -Title 'Diagnostico de display'
}

exit 1
