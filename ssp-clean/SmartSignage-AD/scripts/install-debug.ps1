# Build debug APK e instala com o adb da PATH (evita "No connected devices" do :app:installDebug
# quando o Gradle usa outra instancia do adb no Windows).
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host ">> assembleDebug..." -ForegroundColor Cyan
& .\gradlew.bat :app:assembleDebug
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$apk = Join-Path $ProjectRoot "app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apk)) {
    Write-Error "APK nao encontrado: $apk"
    exit 1
}

Write-Host ">> adb devices" -ForegroundColor Cyan
& adb devices

Write-Host ">> adb install -r" -ForegroundColor Cyan
& adb install -r $apk
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Se aparecer 'no devices': confirma USB/rede e 'adb devices'." -ForegroundColor Yellow
    Write-Host "Se ha varios aparelhos: `$env:ANDROID_SERIAL='SERIAL' e volta a correr este script." -ForegroundColor Yellow
    exit $LASTEXITCODE
}

Write-Host "OK. Arrancar app:" -ForegroundColor Green
Write-Host "  adb shell am start -n br.com.smartchannel.smartsignagead/.ui.MainActivity"
