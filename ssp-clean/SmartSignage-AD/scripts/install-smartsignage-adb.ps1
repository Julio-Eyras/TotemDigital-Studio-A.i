[CmdletBinding()]
param(
    [switch] $Clean,
    [switch] $SkipBuild,
    [switch] $NoConfigPush
)

$ErrorActionPreference = "Stop"
$PackageId = "br.com.smartchannel.smartsignagead"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$Apk = Join-Path $Root "app\build\outputs\apk\release\app-release.apk"
$Config = Join-Path $Root "config\app-config.example.json"

function Has([string]$name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }
if (-not (Has "adb")) { throw "adb nao encontrado no PATH." }

if (-not $SkipBuild) {
    Push-Location $Root
    try {
        if (Test-Path ".\gradlew.bat") {
            if ($Clean) { & .\gradlew.bat clean --no-daemon }
            & .\gradlew.bat assembleRelease --no-daemon
        } elseif (Has "gradle") {
            if ($Clean) { gradle clean }
            gradle assembleRelease
        } else {
            throw "gradlew/gradle nao encontrado. Gere APK via Android Studio."
        }
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path $Apk)) {
    throw "APK nao encontrado: $Apk"
}

adb install -r -d -g $Apk 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
    adb uninstall $PackageId 2>&1 | Out-Host
    adb install -r -d -g $Apk 2>&1 | Out-Host
}

if (-not $NoConfigPush -and (Test-Path $Config)) {
    adb shell mkdir -p /sdcard/smartsignage-ad 2>$null
    adb push $Config /sdcard/smartsignage-ad/app-config.json
}

adb shell dumpsys package $PackageId 2>&1 | Select-String "versionCode|versionName"
Write-Host "Instalacao concluida."
