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

function Invoke-AdbShell([string] $Cmd) {
    $out = adb shell $Cmd 2>&1 | ForEach-Object { "$_" }
    return ($out -join "`n").TrimEnd()
}

function Write-Section([string] $Title) {
    Write-Host "`n== $Title ==" -ForegroundColor Cyan
}

function Write-Check([string] $Label, [string] $Result, [string] $Hint = '') {
    Write-Host "  $Label" -ForegroundColor Gray
    if ($Result) {
        foreach ($line in ($Result -split "`n")) {
            Write-Host "    $line"
        }
    } else {
        Write-Host "    (sem saída)" -ForegroundColor DarkGray
    }
    if ($Hint) {
        Write-Host "    -> $Hint" -ForegroundColor DarkYellow
    }
}

if (-not (Test-CommandExists 'adb')) {
    Write-Error "adb não está no PATH."
}

$devices = (& adb devices 2>&1 | Where-Object { $_ -match '\tdevice$' })
if (-not $devices) {
    Write-Error "Nenhum dispositivo em modo device. Ative depuração USB e autorize o PC."
}

Write-Host "Dispositivo(s) conectado(s):" -ForegroundColor Green
adb devices -l

Write-Section 'Identificação'
Write-Check 'Modelo' (Invoke-AdbShell 'getprop ro.product.model')
Write-Check 'Device' (Invoke-AdbShell 'getprop ro.product.device')
Write-Check 'Fingerprint' (Invoke-AdbShell 'getprop ro.build.fingerprint')
Write-Check 'Android' (Invoke-AdbShell 'getprop ro.build.version.release')

Write-Section 'Root (somente leitura)'
Write-Check 'id (shell)' (Invoke-AdbShell 'id')
$suOut = Invoke-AdbShell 'su -c id'
Write-Check 'su -c id' $suOut $(if ($suOut -match 'uid=0') { 'Root via su disponível' } else { 'Sem su ou negado' })

if ($TryRootRemount) {
    Write-Section 'Root ADB + remount (teste)'
    $rootOut = (& adb root 2>&1 | ForEach-Object { "$_" }) -join "`n"
    Write-Check 'adb root' $rootOut
    $remountOut = (& adb remount 2>&1 | ForEach-Object { "$_" }) -join "`n"
    Write-Check 'adb remount' $remountOut
    $touchOut = Invoke-AdbShell 'touch /system/media/.smartsignage_write_test 2>&1; echo exit:$?'
    Write-Check 'Gravação em /system/media' $touchOut $(if ($touchOut -match 'exit:0') { '/system gravável — bootanimation pode ser substituído' } else { '/system somente leitura' })
    Invoke-AdbShell 'rm -f /system/media/.smartsignage_write_test 2>/dev/null' | Out-Null
}

Write-Section 'Bootanimation / logo'
Write-Check '/system/media/bootanimation.zip' (Invoke-AdbShell 'ls -la /system/media/bootanimation.zip 2>&1')
Write-Check '/vendor/media/bootanimation.zip' (Invoke-AdbShell 'ls -la /vendor/media/bootanimation.zip 2>&1')
Write-Check 'Busca bootanimation.zip' (Invoke-AdbShell 'find /system /vendor /oem /product -name bootanimation.zip 2>/dev/null')
Write-Check 'ro.bootanimation' (Invoke-AdbShell 'getprop ro.bootanimation')

Write-Section 'Orientação (portrait 9:16)'
Write-Check 'user_rotation' (Invoke-AdbShell 'settings get system user_rotation') '0=0°, 1=90° portrait típico, 2=180°, 3=270°'
Write-Check 'accelerometer_rotation' (Invoke-AdbShell 'settings get system accelerometer_rotation') '0=fixo'
Write-Check 'ro.sf.hwrotation' (Invoke-AdbShell 'getprop ro.sf.hwrotation')
Write-Check 'persist.sys.hwrotation' (Invoke-AdbShell 'getprop persist.sys.hwrotation')

Write-Section 'Player-AD'
$pkg = 'br.com.smartchannel.playerad'
Write-Check 'Versão instalada' (adb shell dumpsys package $pkg 2>&1 | Select-String -Pattern 'versionCode|versionName' | ForEach-Object { $_.Line })
Write-Check 'player-config SD' (Invoke-AdbShell 'cat /sdcard/smartsignage/player-config.json 2>/dev/null || echo (arquivo ausente)')

Write-Section 'Resumo'
Write-Host @"
  Portrait no app: install-player-adb.ps1 + screenOrientation portrait (sem root).
  Portrait na animação de boot: menu de fábrica da box ou prop hwrotation (fabricante).
  Logo Android customizado: root + /system gravável OU firmware OEM.
  Fastboot: adb reboot bootloader && fastboot devices (nem toda box suporta).
"@ -ForegroundColor Gray

Write-Host "`nConcluído." -ForegroundColor Green
