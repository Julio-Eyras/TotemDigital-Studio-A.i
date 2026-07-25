# Monta install-pendrive com APK release (sem build debug).
# Uso (na pasta Player-AD):
#   .\scripts\prepare-install-pendrive.ps1
# Ou com rebuild:
#   .\scripts\prepare-install-pendrive.ps1 -Rebuild

param(
  [switch]$Rebuild
)

$ErrorActionPreference = 'Stop'
$PlayerDir = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $PlayerDir
$Dest = Join-Path $RepoRoot 'install-pendrive'
$ApkDestDir = Join-Path $Dest 'apk'

Write-Host "== Preparar pasta install-pendrive =="
Write-Host "Destino: $Dest"

if ($Rebuild) {
  Write-Host "Compilando assembleRelease (sem debug)..."
  Push-Location $PlayerDir
  try {
    & .\gradlew.bat clean assembleRelease
    if ($LASTEXITCODE -ne 0) { throw "gradlew assembleRelease falhou ($LASTEXITCODE)" }
  } finally {
    Pop-Location
  }
}

$ReleaseDir = Join-Path $PlayerDir 'build\outputs\apk\release'
if (-not (Test-Path $ReleaseDir)) {
  throw "Pasta release inexistente: $ReleaseDir — compile com: .\gradlew.bat assembleRelease"
}

$Apk = Get-ChildItem -Path $ReleaseDir -Filter '*.apk' |
  Where-Object { $_.Name -notmatch '-unsigned\.apk$' -and $_.Name -notmatch 'debug' } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $Apk) {
  throw "APK release nao encontrado em $ReleaseDir"
}

New-Item -ItemType Directory -Force -Path $ApkDestDir | Out-Null

# Remover APKs antigos/debug da pasta do kit
Get-ChildItem -Path $ApkDestDir -Filter '*.apk' -ErrorAction SilentlyContinue | Remove-Item -Force

Copy-Item -Force $Apk.FullName (Join-Path $ApkDestDir 'Player-AD-release.apk')
Write-Host "OK APK: $($Apk.Name) -> install-pendrive\apk\Player-AD-release.apk ($([math]::Round($Apk.Length/1MB, 2)) MB)"

$CfgSrc = Join-Path $PlayerDir 'scripts\generate-default-player-config.json'
if (Test-Path $CfgSrc) {
  Copy-Item -Force $CfgSrc (Join-Path $Dest 'config\exemplo-player-config.json')
  Write-Host "OK config: exemplo-player-config.json atualizado"
}

# Atualizar versao no LEIA-ME se existir versionName no build.gradle
$Gradle = Get-Content (Join-Path $PlayerDir 'build.gradle') -Raw
if ($Gradle -match "versionName\s+'([^']+)'") {
  $ver = $Matches[1]
  $code = if ($Gradle -match 'versionCode\s+(\d+)') { $Matches[1] } else { '?' }
  $leia = Join-Path $Dest 'LEIA-ME.txt'
  if (Test-Path $leia) {
    $txt = Get-Content $leia -Raw
    $txt = [regex]::Replace($txt, 'Player-AD\s+[\d.]+ \(versionCode \d+\)', "Player-AD $ver (versionCode $code)")
    Set-Content -Path $leia -Value $txt -NoNewline -Encoding UTF8
    Write-Host "OK LEIA-ME: Player-AD $ver (versionCode $code)"
  }
}

Write-Host ""
Write-Host "Kit pronto em: $Dest"
Write-Host "Copie para o USB com: .\scripts\copy-install-pendrive-to-usb.ps1 E:"
Get-Item (Join-Path $ApkDestDir 'Player-AD-release.apk') | Format-List FullName, Length, LastWriteTime
