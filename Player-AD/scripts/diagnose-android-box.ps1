#Requires -Version 5.1
<#
.SYNOPSIS
  Diagnóstico read-only de TV box Android: root, bootanimation, rotação e fastboot.

.DESCRIPTION
  Não altera firmware. Opcionalmente tenta adb root/remount para indicar se /system é gravável.
  Use antes de tentar trocar bootanimation ou firmware customizado.

.EXAMPLE
  .\diagnose-android-box.ps1
.EXAMPLE
  .\diagnose-android-box.ps1 -TryRootRemount
#>
[CmdletBinding()]
param(
    [switch] $TryRootRemount
)

$ErrorActionPreference = 'Continue'

function Test-CommandExists([string] $Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

. (Join-Path $PSScriptRoot 'android-box-diagnostics.ps1')

if (-not (Test-CommandExists 'adb')) {
    Write-Error "adb não está no PATH."
}

$devices = (& adb devices 2>&1 | Where-Object { $_ -match '\tdevice$' })
if (-not $devices) {
    Write-Error "Nenhum dispositivo em modo device. Ative depuração USB e autorize o PC."
}

Write-Host "Dispositivo(s) conectado(s):" -ForegroundColor Green
adb devices -l

$diag = Get-AndroidBoxDiagnostics -TryRootRemount:$TryRootRemount
Write-AndroidBoxDiagnosticsSummary -Diagnostics $diag -Title 'Identificação e diagnóstico'

Write-Host "`n== Resumo ==" -ForegroundColor Cyan
Write-Host @"
  Portrait no app: install-player-adb.ps1 + screenOrientation portrait (sem root).
  Portrait na animação de boot: menu de fábrica da box ou prop hwrotation (fabricante).
  Logo Android customizado: root + /system gravável OU firmware OEM.
  Fastboot: adb reboot bootloader && fastboot devices (nem toda box suporta).
"@ -ForegroundColor Gray

$pkg = 'br.com.smartchannel.playerad'
Write-Host "`n== Player-AD ==" -ForegroundColor Cyan
adb shell dumpsys package $pkg 2>&1 | Select-String -Pattern 'versionCode|versionName' | ForEach-Object { Write-Host "  $($_.Line)" }
$config = Get-AdbShellOutput 'cat /sdcard/smartsignage/player-config.json 2>/dev/null || echo (arquivo ausente)'
Write-Host "  player-config SD:" -ForegroundColor Gray
$config -split "`n" | ForEach-Object { Write-Host "    $_" }

Write-Host "`nConcluído." -ForegroundColor Green
