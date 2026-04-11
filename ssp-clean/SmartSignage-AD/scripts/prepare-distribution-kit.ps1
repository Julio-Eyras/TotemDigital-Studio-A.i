[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$Repo = Split-Path -Parent $Root
$Kit = Join-Path $Repo "install-pendrive-smartsignage-ad"
$ApkSrc = Join-Path $Root "app\build\outputs\apk\release\app-release.apk"
$ApkDstDir = Join-Path $Kit "apk"
$ConfigSrc = Join-Path $Root "config\app-config.example.json"
$ConfigDst = Join-Path $Kit "config\app-config.example.json"
$DocSrc = Join-Path $Root "docs\MANUAL-OPERACIONAL-SMARTSIGNAGE-AD.pdf"
$DocDstDir = Join-Path $Kit "docs"

New-Item -ItemType Directory -Force -Path $ApkDstDir,$DocDstDir | Out-Null

if (Test-Path $ApkSrc) {
    Copy-Item -Force $ApkSrc (Join-Path $ApkDstDir "app-release.apk")
    Write-Host "APK copiado para kit."
} else {
    Write-Host "APK nao encontrado em build release. Gere com gradle antes."
}

if (Test-Path $ConfigSrc) {
    Copy-Item -Force $ConfigSrc $ConfigDst
    Write-Host "Config copiada para kit."
}

if (Test-Path $DocSrc) {
    Copy-Item -Force $DocSrc (Join-Path $DocDstDir "MANUAL-OPERACIONAL-SMARTSIGNAGE-AD.pdf")
    Write-Host "Manual PDF copiado para kit."
}

Write-Host "Kit pronto em: $Kit"
