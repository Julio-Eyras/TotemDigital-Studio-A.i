# Build release Player-AD + instala via ADB (Windows)
# Uso: .\scripts\install-player-ad-windows.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PlayerDir = Join-Path $Root 'Player-AD'
$ReleaseDir = Join-Path $PlayerDir 'build\outputs\apk\release'

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
    Write-Error 'adb nao encontrado no PATH'
}

Write-Host '== Build Player-AD release ==' -ForegroundColor Cyan
Push-Location $PlayerDir
try {
    & .\gradlew.bat assembleRelease --no-daemon
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location
}

$ApkItem = Get-ChildItem $ReleaseDir -Filter 'Player-AD-Vs*-build-*.apk' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $ApkItem -and (Test-Path (Join-Path $ReleaseDir 'Player-AD-release.apk'))) {
    $ApkItem = Get-Item (Join-Path $ReleaseDir 'Player-AD-release.apk')
}
if (-not $ApkItem) {
    Write-Error "APK nao encontrado em $ReleaseDir (esperado Player-AD-Vs*-build-*.apk)"
}
$Apk = $ApkItem.FullName

Write-Host "== Instalar: $Apk ==" -ForegroundColor Cyan
adb devices
adb install -r -d -g $Apk
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

adb shell am start -n br.com.smartchannel.playerad/.ui.MainActivity
$ver = adb shell dumpsys package br.com.smartchannel.playerad | Select-String 'versionName|versionCode'
Write-Host "Instalado: $ver" -ForegroundColor Green
