# Build release Player-AD-MON
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..
if (-not (Test-Path ".\local.properties")) {
    $src = Join-Path (Split-Path (Get-Location) -Parent) "Player-AD\local.properties"
    if (Test-Path $src) {
        Copy-Item $src ".\local.properties"
        Write-Host "Copiado local.properties a partir de Player-AD"
    } else {
        Write-Host "AVISO: crie local.properties com sdk.dir=..."
    }
}
.\gradlew.bat assembleRelease --no-daemon
$apk = Get-ChildItem -Path ".\build\outputs\apk\release\Player-AD-MON-Vs*-build-*.apk" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($apk) {
    Write-Host "APK: $($apk.FullName)"
} else {
    Write-Host "Build terminou; verifique build\outputs\apk\release\"
}
