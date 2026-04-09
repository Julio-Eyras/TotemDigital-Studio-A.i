#Requires -Version 5.1
# UTF-8: use PowerShell que leia UTF-8 ou execute via instalar-dispositivo.cmd
<#
.SYNOPSIS
  Compila o Player-AD (release), copia o APK para install-pendrive (se existir) e instala na TV/box via ADB.

.DESCRIPTION
  - Resolve JAVA_HOME (variavel atual ou Temurin 17 / JDK em Program Files).
  - Executa gradlew assembleRelease (opcionalmente apos clean).
  - adb install -r -d -g; em conflito de assinatura, desinstala o pacote e tenta de novo.
  - Envia player-config.json opcional para /sdcard/smartsignage/

.EXAMPLE
  .\install-player-adb.ps1
.EXAMPLE
  .\install-player-adb.ps1 -Clean
.EXAMPLE
  .\install-player-adb.ps1 -SkipBuild -ConfigJson "C:\cfg\player.json"
#>
[CmdletBinding()]
param(
    [switch] $Clean,
    [switch] $SkipBuild,
    [switch] $NoCopyToPendrive,
    [switch] $NoConfigPush,
    [string] $ConfigJson = "",
    [switch] $NoLaunch
)

$ErrorActionPreference = 'Stop'
$PackageId = 'br.com.smartchannel.playerad'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PlayerRoot = Split-Path -Parent $ScriptDir
$RepoRoot = Split-Path -Parent $PlayerRoot
$ApkReleaseDir = Join-Path $PlayerRoot 'build\outputs\apk\release'
$DefaultApkName = 'Player-AD-release.apk'
$ApkPath = Join-Path $ApkReleaseDir $DefaultApkName
$PendriveApkDir = Join-Path $RepoRoot 'install-pendrive\apk'
$DefaultConfigCandidates = @(
    (Join-Path $RepoRoot 'install-pendrive\config\exemplo-player-config.json')
)

function Test-CommandExists([string] $Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Resolve-JavaHome {
    if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
        return $env:JAVA_HOME
    }
    $roots = @(
        'C:\Program Files\Eclipse Adoptium',
        'C:\Program Files\Java',
        'C:\Program Files\Microsoft'
    )
    foreach ($r in $roots) {
        if (-not (Test-Path $r)) { continue }
        $jdk = Get-ChildItem -Path $r -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match 'jdk-17|jdk-21|jdk-11' } |
            Sort-Object Name -Descending |
            Select-Object -First 1
        if ($jdk -and (Test-Path (Join-Path $jdk.FullName 'bin\java.exe'))) {
            return $jdk.FullName
        }
    }
    $jbr = 'C:\Program Files\Android\Android Studio\jbr'
    if ((Test-Path (Join-Path $jbr 'bin\java.exe')) -and (Test-Path (Join-Path $jbr 'lib\jvm.cfg'))) {
        return $jbr
    }
    return $null
}

function Invoke-AdbInstall {
    param([string] $Apk)
    $output = (& adb install -r -d -g $Apk 2>&1 | ForEach-Object { "$_" }) -join "`n"
    Write-Host $output.TrimEnd()
    $code = $LASTEXITCODE
    if ($code -eq 0) { return $true }
    if ($output -match 'INSTALL_FAILED_UPDATE_INCOMPATIBLE') { return $false }
    exit $code
}

Write-Host "== Player-AD: build + instalacao ADB ==" -ForegroundColor Cyan

if (-not (Test-CommandExists 'adb')) {
    Write-Error "adb nao esta no PATH. Instale Android Platform Tools e adicione a variavel Path."
}

$devices = (& adb devices 2>&1 | Where-Object { $_ -match '\tdevice$' })
if (-not $devices) {
    Write-Error "Nenhum dispositivo em modo device (USB depuracao). Ligue a box/TV e autorize o PC."
}

Write-Host "Dispositivo(s):" -ForegroundColor Gray
adb devices -l

if (-not $SkipBuild) {
    $javaHome = Resolve-JavaHome
    if (-not $javaHome) {
        Write-Error "JAVA_HOME invalido ou JDK nao encontrado. Instale Temurin 17 e defina JAVA_HOME, ou use Android Studio JDK."
    }
    $env:JAVA_HOME = $javaHome
    Write-Host "JAVA_HOME: $javaHome" -ForegroundColor Gray
    $javaVer = & (Join-Path $javaHome 'bin\java.exe') -version 2>&1 | Out-String
    Write-Host $javaVer.TrimEnd() -ForegroundColor Gray

    Push-Location $PlayerRoot
    try {
        if ($Clean) {
            Write-Host "`n>> gradlew clean" -ForegroundColor Yellow
            & .\gradlew.bat clean --no-daemon
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
        Write-Host "`n>> gradlew assembleRelease" -ForegroundColor Yellow
        & .\gradlew.bat assembleRelease --no-daemon
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    finally {
        Pop-Location
    }
}

if (-not (Test-Path $ApkPath)) {
    $found = Get-ChildItem -Path $ApkReleaseDir -Filter '*.apk' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $ApkPath = $found.FullName }
}
if (-not (Test-Path $ApkPath)) {
    Write-Error "APK nao encontrado em $ApkReleaseDir. Execute sem -SkipBuild ou faca o build no Android Studio."
}

Write-Host "`nAPK: $ApkPath" -ForegroundColor Green

if (-not $NoCopyToPendrive -and (Test-Path (Join-Path $RepoRoot 'install-pendrive'))) {
    New-Item -ItemType Directory -Force -Path $PendriveApkDir | Out-Null
    $pendApk = Join-Path $PendriveApkDir $DefaultApkName
    Copy-Item -Force -Path $ApkPath -Destination $pendApk
    Write-Host "Copia: $pendApk" -ForegroundColor Gray
}

Write-Host "`n>> adb install" -ForegroundColor Yellow
$ok = Invoke-AdbInstall -Apk $ApkPath
if (-not $ok) {
    Write-Host "Conflito de assinatura - desinstalando pacote e repetindo..." -ForegroundColor Yellow
    adb uninstall $PackageId 2>&1 | Out-Host
    $ok2 = Invoke-AdbInstall -Apk $ApkPath
    if (-not $ok2) { Write-Error "Instalacao falhou apos desinstalar." }
}

$configToPush = $ConfigJson
if (-not $configToPush -and -not $NoConfigPush) {
    foreach ($c in $DefaultConfigCandidates) {
        if (Test-Path $c) { $configToPush = $c; break }
    }
}
if ($configToPush -and (Test-Path $configToPush) -and -not $NoConfigPush) {
    Write-Host "`n>> adb push config -> /sdcard/smartsignage/player-config.json" -ForegroundColor Yellow
    adb shell mkdir -p /sdcard/smartsignage 2>$null
    adb push $configToPush /sdcard/smartsignage/player-config.json
}

Write-Host "`nVersao instalada:" -ForegroundColor Cyan
adb shell dumpsys package $PackageId 2>&1 | Select-String -Pattern 'versionCode|versionName'

if (-not $NoLaunch) {
    Write-Host "`n>> A iniciar MainActivity..." -ForegroundColor Yellow
    adb shell am start -n "$PackageId/.ui.MainActivity" 2>&1 | Out-Host
}

Write-Host "`nConcluido." -ForegroundColor Green
