#Requires -Version 5.1
<#
.SYNOPSIS
  Compila Instala-Player-TotemDigital.apk (embute o Player-AD release).

.EXAMPLE
  .\build-installer.ps1
.EXAMPLE
  .\build-installer.ps1 -SkipPlayerBuild
#>
param(
    [switch] $SkipPlayerBuild,
    [switch] $NoCopyToPendrive
)

$ErrorActionPreference = 'Stop'
$InstallerDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RepoRoot = Split-Path -Parent $InstallerDir
$PlayerDir = Join-Path $RepoRoot 'Player-AD'
$Gradle = Join-Path $PlayerDir 'gradlew.bat'

if (-not (Test-Path $Gradle)) {
    throw "gradlew nao encontrado: $Gradle"
}

$localSrc = Join-Path $PlayerDir 'local.properties'
$localDst = Join-Path $InstallerDir 'local.properties'
if ((Test-Path $localSrc) -and -not (Test-Path $localDst)) {
    Copy-Item $localSrc $localDst
    Write-Host "OK local.properties copiado do Player-AD" -ForegroundColor Gray
}

if (-not $SkipPlayerBuild) {
    Write-Host ">> Compilar Player-AD release" -ForegroundColor Yellow
    Push-Location $PlayerDir
    try {
        & .\gradlew.bat assembleRelease
        if ($LASTEXITCODE -ne 0) { throw "assembleRelease do Player-AD falhou ($LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
}

$playerApk = Join-Path $PlayerDir 'build\outputs\apk\release\Player-AD-release.apk'
if (-not (Test-Path $playerApk)) {
    throw "Player-AD-release.apk em falta: $playerApk"
}

Write-Host ">> Compilar Instala-Player-TotemDigital" -ForegroundColor Yellow
Push-Location $PlayerDir
try {
    & .\gradlew.bat -p $InstallerDir assembleRelease
    if ($LASTEXITCODE -ne 0) { throw "assembleRelease do instalador falhou ($LASTEXITCODE)" }
} finally {
    Pop-Location
}

$outDir = Join-Path $InstallerDir 'build\outputs\apk\release'
$apk = Get-ChildItem $outDir -Filter 'Instala-Player-TotemDigital.apk' -ErrorAction SilentlyContinue |
    Select-Object -First 1
if (-not $apk) {
    $apk = Get-ChildItem $outDir -Filter '*.apk' |
        Where-Object { $_.Name -notmatch 'unsigned' } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
}
if (-not $apk) { throw "APK do instalador nao encontrado em $outDir" }

Write-Host "OK $($apk.FullName) ($([math]::Round($apk.Length/1MB, 2)) MB)" -ForegroundColor Green

if (-not $NoCopyToPendrive) {
    $destDir = Join-Path $RepoRoot 'install-pendrive\apk'
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    $dest = Join-Path $destDir 'Instala-Player-TotemDigital.apk'
    Copy-Item -Force $apk.FullName $dest
    Write-Host "OK copiado para $dest" -ForegroundColor Green
}
