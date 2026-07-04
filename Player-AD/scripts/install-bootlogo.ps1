#Requires -Version 5.1
<#
.SYNOPSIS
  Substitui bootlogo.bmp na particao bootloader (Allwinner) — remove logo Android no 1o boot.

.DESCRIPTION
  Particao: /dev/block/mmcblk0p2 (vfat) -> bootlogo.bmp 1280x720 BMP 24-bit
  Modelos: TV_BOX_3 / dolphin-fvd-p1 (Allwinner sun8iw7p1)

.EXAMPLE
  .\install-bootlogo.ps1 -InputLogo "C:\path\logo.png"
.EXAMPLE
  .\install-bootlogo.ps1 -SkipBuild
#>
[CmdletBinding()]
param(
    [string] $InputLogo = "",
    [string] $BmpPath = "",
    [switch] $SkipBuild,
    [switch] $NoReboot
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$BootDir = Join-Path $RepoRoot 'install-pendrive\bootanimation'
$DefaultBmp = Join-Path $BootDir 'bootlogo.bmp'
$DefaultLogoPng = Join-Path $BootDir 'logo-totemdigital-boot.png'
$BootloaderPart = '/dev/block/mmcblk0p2'
$MountPoint = '/mnt/bootlogo'

. (Join-Path $ScriptDir 'android-box-diagnostics.ps1')

if (-not $InputLogo -and (Test-Path $DefaultLogoPng)) {
    $InputLogo = $DefaultLogoPng
}

if (-not $BmpPath) { $BmpPath = $DefaultBmp }

if (-not $SkipBuild) {
    if (-not $InputLogo -or -not (Test-Path $InputLogo)) {
        Write-Error "Informe -InputLogo ou coloque logo em $DefaultLogoPng"
    }
    $py = Get-Command python -ErrorAction SilentlyContinue
    if (-not $py) { $py = Get-Command python3 -ErrorAction SilentlyContinue }
    if (-not $py) { Write-Error "Python com Pillow necessario para build-bootlogo.py" }
    Write-Host ">> Gerar bootlogo.bmp (1280x720)" -ForegroundColor Yellow
    & $py.Source (Join-Path $ScriptDir 'build-bootlogo.py') --input $InputLogo --output $BmpPath
}

if (-not (Test-Path $BmpPath)) {
    Write-Error "bootlogo.bmp nao encontrado: $BmpPath"
}

$devices = (& adb devices 2>&1 | Where-Object { $_ -match '\tdevice$' })
if (-not $devices) {
    Write-Error "Nenhum dispositivo ADB conectado."
}

$diag = Get-AndroidBoxDiagnostics
Write-AndroidBoxDiagnosticsSummary -Diagnostics $diag -Title 'Instalar bootlogo (bootloader)'

if (-not $diag.RootSu) {
    Write-Error "Root (su) necessario para montar particao bootloader."
}

Write-Host "`n>> Enviar bootlogo.bmp para /sdcard/smartsignage/" -ForegroundColor Yellow
adb shell mkdir -p /sdcard/smartsignage/backup 2>$null
adb push $BmpPath /sdcard/smartsignage/bootlogo.bmp

$backupName = "bootlogo-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').bmp"
Write-Host ">> Backup bootlogo original -> /sdcard/smartsignage/backup/$backupName" -ForegroundColor Yellow

$installScript = @"
mkdir -p $MountPoint
mount -t vfat $BootloaderPart $MountPoint 2>/dev/null || exit 1
if [ -f $MountPoint/bootlogo.bmp ]; then cp $MountPoint/bootlogo.bmp /sdcard/smartsignage/backup/$backupName; fi
cp /sdcard/smartsignage/bootlogo.bmp $MountPoint/bootlogo.bmp
sync
ls -la $MountPoint/bootlogo.bmp
umount $MountPoint 2>/dev/null || true
echo BOOTLOGO_INSTALLED
"@

$out = adb shell "su -c `"$installScript`"" 2>&1 | Out-String
Write-Host $out.TrimEnd() -ForegroundColor Gray

if ($out -notmatch 'BOOTLOGO_INSTALLED') {
    Write-Error "Falha ao gravar bootlogo.bmp na particao bootloader."
}

Write-Host "`nOK bootlogo Totem Digital instalado na particao bootloader." -ForegroundColor Green
Write-Host "  O logo Android (1a fase do boot) foi substituido." -ForegroundColor Gray
Write-Host "  bootanimation.zip (2a fase) permanece em /system/media/." -ForegroundColor Gray

if (-not $NoReboot) {
    Write-Host "`n>> Reiniciando..." -ForegroundColor Cyan
    adb reboot
} else {
    Write-Host "`nReinicie manualmente: adb reboot" -ForegroundColor Cyan
}
