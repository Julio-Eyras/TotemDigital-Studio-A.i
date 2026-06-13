#Requires -Version 5.1
# Funções compartilhadas: diagnose-android-box.ps1 e install-player-adb.ps1

function Get-AdbShellOutput {
    param([string] $Cmd)
    $out = adb shell $Cmd 2>&1 | ForEach-Object { "$_" }
    return ($out -join "`n").TrimEnd()
}

function Test-AndroidRootSu {
    $suOut = Get-AdbShellOutput 'su -c id'
    return ($suOut -match 'uid=0')
}

function Test-AndroidRootAdb {
    $rootOut = (& adb root 2>&1 | ForEach-Object { "$_" }) -join "`n"
    return ($rootOut -match 'running as root|restarting adbd as root')
}

function Test-AndroidSystemWritable {
    $touchOut = Get-AdbShellOutput 'touch /system/media/.smartsignage_write_test 2>&1; echo exit:$?'
    $ok = $touchOut -match 'exit:0'
    Get-AdbShellOutput 'rm -f /system/media/.smartsignage_write_test 2>/dev/null' | Out-Null
    return $ok
}

function Get-AndroidPortraitState {
    param([int] $ExpectedUserRotation = 1)

    $userRotRaw = Get-AdbShellOutput 'settings get system user_rotation'
    $accelRaw = Get-AdbShellOutput 'settings get system accelerometer_rotation'
    $userRot = $null
    $accel = $null
    if ($userRotRaw -match '^-?\d+$') { [void][int]::TryParse($userRotRaw, [ref]$userRot) }
    if ($accelRaw -match '^-?\d+$') { [void][int]::TryParse($accelRaw, [ref]$accel) }

    $portraitOk = ($userRot -eq $ExpectedUserRotation) -and ($accel -eq 0)
    [PSCustomObject]@{
        UserRotation            = $userRot
        AccelerometerRotation   = $accel
        ExpectedUserRotation    = $ExpectedUserRotation
        PortraitProvisioned     = $portraitOk
    }
}

function Get-AndroidBoxDiagnostics {
    param(
        [int] $ExpectedUserRotation = 1,
        [switch] $TryRootRemount
    )

    $portrait = Get-AndroidPortraitState -ExpectedUserRotation $ExpectedUserRotation
    $rootSu = Test-AndroidRootSu
    $rootAdb = $false
    $systemWritable = $false

    if ($TryRootRemount) {
        $rootAdb = Test-AndroidRootAdb
        if ($rootAdb) {
            & adb remount 2>&1 | Out-Null
            $systemWritable = Test-AndroidSystemWritable
        }
    }

    $bootSystem = Get-AdbShellOutput 'ls /system/media/bootanimation.zip 2>/dev/null'
    $bootVendor = Get-AdbShellOutput 'ls /vendor/media/bootanimation.zip 2>/dev/null'
    $bootPath = $null
    if ($bootSystem -and $bootSystem -notmatch 'No such file') { $bootPath = '/system/media/bootanimation.zip' }
    elseif ($bootVendor -and $bootVendor -notmatch 'No such file') { $bootPath = '/vendor/media/bootanimation.zip' }

    [PSCustomObject]@{
        Model                 = Get-AdbShellOutput 'getprop ro.product.model'
        Device                = Get-AdbShellOutput 'getprop ro.product.device'
        AndroidVersion        = Get-AdbShellOutput 'getprop ro.build.version.release'
        RootSu                = $rootSu
        RootAdb               = $rootAdb
        SystemWritable        = $systemWritable
        UserRotation          = $portrait.UserRotation
        AccelerometerRotation = $portrait.AccelerometerRotation
        ExpectedUserRotation  = $ExpectedUserRotation
        PortraitProvisioned   = $portrait.PortraitProvisioned
        HwRotation            = Get-AdbShellOutput 'getprop ro.sf.hwrotation'
        PersistHwRotation     = Get-AdbShellOutput 'getprop persist.sys.hwrotation'
        BootAnimationPath     = $bootPath
    }
}

function Write-AndroidBoxDiagnosticsSummary {
    param(
        [Parameter(Mandatory = $true)]
        $Diagnostics,
        [string] $Title = 'Diagnostico Android (TV box)'
    )

    Write-Host "`n== $Title ==" -ForegroundColor Cyan
    Write-Host "  Modelo: $($Diagnostics.Model) | device: $($Diagnostics.Device) | Android $($Diagnostics.AndroidVersion)" -ForegroundColor Gray

    $rootLabel = if ($Diagnostics.RootSu) { 'SIM (su)' }
                 elseif ($Diagnostics.RootAdb) { 'SIM (adb root)' }
                 else { 'NAO' }
    Write-Host "  Root: $rootLabel" -ForegroundColor $(if ($Diagnostics.RootSu -or $Diagnostics.RootAdb) { 'Green' } else { 'DarkYellow' })

    if ($Diagnostics.PSObject.Properties.Name -contains 'SystemWritable') {
        $sysLabel = if ($Diagnostics.SystemWritable) { 'gravavel (/system)' } else { 'somente leitura' }
        Write-Host "  /system: $sysLabel" -ForegroundColor Gray
    }

    $rotLabel = if ($null -eq $Diagnostics.UserRotation) { '(desconhecido)' } else { $Diagnostics.UserRotation }
    $accelLabel = if ($null -eq $Diagnostics.AccelerometerRotation) { '(desconhecido)' } else { $Diagnostics.AccelerometerRotation }
    $portraitLabel = if ($Diagnostics.PortraitProvisioned) { 'OK' } else { 'PENDENTE' }
    $portraitColor = if ($Diagnostics.PortraitProvisioned) { 'Green' } else { 'Yellow' }

    Write-Host "  user_rotation: $rotLabel (esperado $($Diagnostics.ExpectedUserRotation)) | accelerometer_rotation: $accelLabel" -ForegroundColor Gray
    Write-Host "  Portrait no SO: $portraitLabel" -ForegroundColor $portraitColor

    if ($Diagnostics.BootAnimationPath) {
        Write-Host "  bootanimation: $($Diagnostics.BootAnimationPath)" -ForegroundColor Gray
        if (-not ($Diagnostics.RootSu -or $Diagnostics.SystemWritable)) {
            Write-Host "  Logo boot: troca exige root ou firmware OEM" -ForegroundColor DarkYellow
        }
    }

    if (-not $Diagnostics.PortraitProvisioned) {
        Write-Host "  -> Provisionar portrait: install-player-adb.ps1 (ou configure-android-kiosk.sh)" -ForegroundColor DarkYellow
    }
}

function Assert-AndroidPortraitAfterKiosk {
    param([int] $ExpectedUserRotation = 1)

    $portrait = Get-AndroidPortraitState -ExpectedUserRotation $ExpectedUserRotation
    if ($portrait.PortraitProvisioned) {
        Write-Host "  OK portrait verificado (user_rotation=$($portrait.UserRotation), accelerometer_rotation=0)" -ForegroundColor Green
        return $true
    }

    Write-Host "  AVISO portrait nao confirmado (user_rotation=$($portrait.UserRotation), accelerometer_rotation=$($portrait.AccelerometerRotation))" -ForegroundColor Yellow
    Write-Host "  Alguns fabricantes bloqueiam settings via shell; o app ainda forca portrait na Activity." -ForegroundColor DarkYellow
    return $false
}
