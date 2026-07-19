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
    [switch] $NoLaunch,
    [switch] $OpenConfig,
    [switch] $NoKioskSetup,
    [int] $UserRotation = 1
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

. (Join-Path $ScriptDir 'android-box-diagnostics.ps1')

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

function Invoke-AndroidKioskSetup {
    param([int] $Rotation = 1)
    $mainActivity = "$PackageId/.ui.MainActivity"
    Write-Host "`n>> Provisionamento kiosk Android (portrait + home + immersive)" -ForegroundColor Yellow

    $rotResult = Set-AndroidDisplayRotation -Rotation $Rotation
    foreach ($step in $rotResult.Steps.GetEnumerator()) {
        if ($step.Value) {
            Write-Host "  OK $($step.Key)" -ForegroundColor Gray
        } else {
            Write-Host "  AVISO $($step.Key) (settings bloqueado? tente root/su)" -ForegroundColor DarkYellow
        }
    }

    $steps = @(
        @{ Label = 'policy_control immersive.full'; Cmd = 'settings put global policy_control immersive.full=*' },
        @{ Label = 'stay_on_while_plugged_in'; Cmd = 'settings put global stay_on_while_plugged_in 3' }
    )
    foreach ($s in $steps) {
        $out = adb shell $s.Cmd 2>&1 | Out-String
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  OK $($s.Label)" -ForegroundColor Gray
        } else {
            Write-Host "  AVISO $($s.Label): $($out.Trim())" -ForegroundColor DarkYellow
        }
    }

    $homeOut = adb shell "cmd package set-home-activity $mainActivity" 2>&1 | Out-String
    if ($homeOut -match 'Success|success') {
        Write-Host "  OK launcher padrao: $mainActivity" -ForegroundColor Gray
    } else {
        Write-Host "  AVISO launcher: $($homeOut.Trim())" -ForegroundColor DarkYellow
    }

    $lockOut = cmd /c "adb shell dpm set-lock-task-packages $PackageId $PackageId 2>&1"
    if ($LASTEXITCODE -eq 0 -and $lockOut -notmatch 'Error|error|not allowed') {
        Write-Host "  OK lock-task whitelist (device owner)" -ForegroundColor Gray
    } else {
        Write-Host "  AVISO lock-task: normal sem device owner" -ForegroundColor DarkYellow
    }

    Assert-AndroidPortraitAfterKiosk -ExpectedUserRotation $Rotation | Out-Null
    Write-Host "  Portrait persiste apos reboot (settings system user_rotation=$Rotation, accelerometer_rotation=0)" -ForegroundColor Gray
}

function Grant-SuperSuPlayerAd {
    $suPkg = 'eu.chainfire.supersu'
    $suPath = adb shell "pm path $suPkg" 2>&1 | Out-String
    if ($suPath -notmatch 'package:') {
        Write-Host "  AVISO SuperSU nao encontrado; configure root manualmente" -ForegroundColor DarkYellow
        return
    }
  $prefs = adb shell "su -c 'cat /data/data/$suPkg/shared_prefs/eu.chainfire.supersu_preferences.xml 2>/dev/null'" 2>&1 | Out-String
    if ($prefs -match 'config_br.com.smartchannel.playerad_access">grant' -or $prefs -match "config_br.com.smartchannel.playerad_access'>grant") {
        Write-Host "  OK SuperSU: Player-AD com acesso permanente (grant)" -ForegroundColor Green
        return
    }
    # Uma unica chamada su na instalacao (operador pode tocar Permitir sempre neste momento).
    $probe = adb shell "su -c 'id'" 2>&1 | Out-String
    if ($probe -match 'uid=0') {
        Write-Host "  OK SuperSU: root autorizado nesta sessao de instalacao" -ForegroundColor Green
    }
    Write-Host "  IMPORTANTE SuperSU: abra o app SuperSU > Player-AD > Permitir (sempre)" -ForegroundColor Yellow
    Write-Host "    Ou SuperSU > Configuracoes > Acesso padrao para novos apps: Permitir" -ForegroundColor DarkYellow
    Write-Host "    Sem isso o Android pode voltar a pedir root a cada ~15 min." -ForegroundColor DarkYellow
}

function Sync-PlayerConfigToApp {
    param([string] $SdPath = '/sdcard/smartsignage/player-config.json')
    $filesDir = "/data/data/$PackageId/files"
    $internal = "$filesDir/player-config.json"
    # Dono deve ser o UID da app — cp via su como root deixa files/ inacessível e a app crasha ao salvar config.
    $syncCmd = 'su -c "APP_UID=$(stat -c %u /data/data/' + $PackageId + '); mkdir -p ' + $filesDir + '; cp ' + $SdPath + ' ' + $internal + '; chown -R $APP_UID:$APP_UID ' + $filesDir + '; chmod 700 ' + $filesDir + '; chmod 660 ' + $internal + '"'
    adb shell $syncCmd 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK config interna (filesDir) sincronizada com SD (chown app)" -ForegroundColor Gray
        adb shell "su -c 'ls -la $filesDir'" 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        adb shell "su -c 'cat $internal'" 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    } else {
        Write-Host "  AVISO: nao foi possivel copiar config para filesDir (app usa SD como fallback)" -ForegroundColor DarkYellow
    }
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

$preDiag = Get-AndroidBoxDiagnostics
Write-AndroidBoxDiagnosticsSummary -Diagnostics $preDiag -Title 'Diagnostico pre-instalacao'

if (-not $SkipBuild) {
    $javaHome = Resolve-JavaHome
    if (-not $javaHome) {
        Write-Error "JAVA_HOME invalido ou JDK nao encontrado. Instale Temurin 17 e defina JAVA_HOME, ou use Android Studio JDK."
    }
    $env:JAVA_HOME = $javaHome
    Write-Host "JAVA_HOME: $javaHome" -ForegroundColor Gray
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $javaVer = & (Join-Path $javaHome 'bin\java.exe') -version 2>&1 | ForEach-Object { "$_" } | Out-String
    $ErrorActionPreference = $prevEap
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
    $pushedConfig = adb shell cat /sdcard/smartsignage/player-config.json 2>&1 | Out-String
    Write-Host "Config enviada para /sdcard/smartsignage/player-config.json" -ForegroundColor Green
    Write-Host $pushedConfig.TrimEnd() -ForegroundColor Gray
    Sync-PlayerConfigToApp
}

Grant-SuperSuPlayerAd

Write-Host "`nVersao instalada:" -ForegroundColor Cyan
adb shell dumpsys package $PackageId 2>&1 | Select-String -Pattern 'versionCode|versionName'

if (-not $NoKioskSetup) {
    Invoke-AndroidKioskSetup -Rotation $UserRotation
    $postDiag = Get-AndroidBoxDiagnostics -ExpectedUserRotation $UserRotation
    Write-AndroidBoxDiagnosticsSummary -Diagnostics $postDiag -Title 'Diagnostico pos-provisionamento'
}

if ($OpenConfig) {
    Write-Host "`n>> A abrir tela de configuracao (DebugConfigActivity)..." -ForegroundColor Yellow
    adb shell am start -n "$PackageId/.ui.DebugConfigActivity" 2>&1 | Out-Host
} elseif (-not $NoLaunch) {
    Write-Host "`n>> A iniciar MainActivity..." -ForegroundColor Yellow
    adb shell am start -n "$PackageId/.ui.MainActivity" 2>&1 | Out-Host
}

Write-Host "`nConcluido." -ForegroundColor Green
