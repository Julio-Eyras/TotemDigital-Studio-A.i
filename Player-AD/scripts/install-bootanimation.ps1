#Requires -Version 5.1
<#
.SYNOPSIS
  Instala bootanimation customizado (TotemDigital) na TV box via root.

.DESCRIPTION
  - Gera bootanimation.zip se necessario (build-bootanimation.py).
  - Faz backup do original em /sdcard/smartsignage/backup/
  - Substitui /system/media/bootanimation.zip quando /system for gravavel.

  Na TV_BOX_3 /system costuma ser somente leitura: o script informa e sai sem erro fatal.

.EXAMPLE
  .\install-bootanimation.ps1
.EXAMPLE
  .\install-bootanimation.ps1 -Portrait
#>
[CmdletBinding()]
param(
    [switch] $Portrait,
    [string] $ZipPath = "",
    [switch] $SkipBuild
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$BootDir = Join-Path $RepoRoot 'install-pendrive\bootanimation'
$DefaultLandscape = Join-Path $BootDir 'bootanimation.zip'
$DefaultPortrait = Join-Path $BootDir 'bootanimation-portrait.zip'

. (Join-Path $ScriptDir 'android-box-diagnostics.ps1')

if (-not $ZipPath) {
    $ZipPath = if ($Portrait) { $DefaultPortrait } else { $DefaultLandscape }
}

if (-not $SkipBuild) {
    $py = Get-Command python -ErrorAction SilentlyContinue
    if (-not $py) { $py = Get-Command python3 -ErrorAction SilentlyContinue }
    if ($py) {
        Write-Host ">> Gerar bootanimation.zip" -ForegroundColor Yellow
        & $py.Source (Join-Path $ScriptDir 'build-bootanimation.py')
        if ($Portrait) {
            & $py.Source (Join-Path $ScriptDir 'build-bootanimation.py') --width 1080 --height 1920 --output $DefaultPortrait
        }
    } else {
        Write-Host "AVISO: Python nao encontrado; use ZIP existente em install-pendrive/bootanimation/" -ForegroundColor Yellow
    }
}

if (-not (Test-Path $ZipPath)) {
    Write-Error "bootanimation nao encontrado: $ZipPath"
}

$devices = (& adb devices 2>&1 | Where-Object { $_ -match '\tdevice$' })
if (-not $devices) {
    Write-Error "Nenhum dispositivo ADB conectado."
}

$diag = Get-AndroidBoxDiagnostics -TryRootRemount
Write-AndroidBoxDiagnosticsSummary -Diagnostics $diag -Title 'Pre-requisitos bootanimation'

if (-not $diag.RootSu) {
    Write-Error "Root (su) necessario para substituir bootanimation em /system."
}

$target = $diag.BootAnimationPath
if (-not $target) {
    $target = '/system/media/bootanimation.zip'
    Write-Host "AVISO: caminho bootanimation nao detectado; tentando $target" -ForegroundColor Yellow
}

Write-Host "`n>> Enviar ZIP para /sdcard/smartsignage/bootanimation.zip" -ForegroundColor Yellow
adb shell mkdir -p /sdcard/smartsignage/backup 2>$null
adb push $ZipPath /sdcard/smartsignage/bootanimation.zip

$backupName = "bootanimation-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
Write-Host ">> Backup do original -> /sdcard/smartsignage/backup/$backupName" -ForegroundColor Yellow
adb shell "su -c 'cp $target /sdcard/smartsignage/backup/$backupName 2>/dev/null || true'"

if (-not $diag.SystemWritable) {
    Write-Host "`nAVISO: /system somente leitura nesta box." -ForegroundColor Yellow
    Write-Host "  O ZIP foi salvo em /sdcard/smartsignage/bootanimation.zip" -ForegroundColor Gray
    Write-Host "  Opcoes:" -ForegroundColor Gray
    Write-Host "    1) Menu de fabrica da TV (logo/orientacao de boot)" -ForegroundColor Gray
    Write-Host "    2) Firmware OEM com /system gravavel" -ForegroundColor Gray
    Write-Host "    3) adb root + adb remount (se bootloader permitir)" -ForegroundColor Gray
    Write-Host "`nPara tentar remount manual: adb root; adb remount; repetir este script" -ForegroundColor DarkYellow
    exit 0
}

Write-Host ">> Instalar em $target" -ForegroundColor Yellow
$installCmd = @"
su -c 'mount -o rw,remount /system 2>/dev/null || mount -o rw,remount / 2>/dev/null; cp /sdcard/smartsignage/bootanimation.zip $target && chmod 644 $target && chown root:root $target && echo INSTALLED'
"@
$out = adb shell $installCmd 2>&1 | Out-String
if ($out -match 'INSTALLED') {
    Write-Host "OK bootanimation instalado. Reinicie a box para ver «TotemDigital» no boot." -ForegroundColor Green
} else {
    Write-Host "Falha ao gravar em $target" -ForegroundColor Red
    Write-Host $out.Trim()
    exit 1
}

Write-Host "`nReinicie: adb reboot" -ForegroundColor Cyan
