# Build release Player-AD + instala via ADB (Windows)
# Uso: .\scripts\install-player-ad-windows.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PlayerDir = Join-Path $Root 'Player-AD'
$Apk = Join-Path $PlayerDir 'build\outputs\apk\release\Player-AD-release.apk'

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

if (-not (Test-Path $Apk)) {
    Write-Error "APK nao encontrado: $Apk"
}

Write-Host "== Instalar: $Apk ==" -ForegroundColor Cyan
adb devices
adb install -r -d -g $Apk
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

adb shell am start -n br.com.smartchannel.playerad/.ui.MainActivity
$ver = adb shell dumpsys package br.com.smartchannel.playerad | Select-String 'versionName|versionCode'
Write-Host "Instalado: $ver" -ForegroundColor Green
