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

# Remover APKs antigos/debug da pasta do kit (mantém o instalador se não houver fonte nova)
Get-ChildItem -Path $ApkDestDir -Filter '*.apk' -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -ne 'Instala-Player-TotemDigital.apk' } |
  Remove-Item -Force

Copy-Item -Force $Apk.FullName (Join-Path $ApkDestDir 'Player-AD-release.apk')
Write-Host "OK APK: $($Apk.Name) -> install-pendrive\apk\Player-AD-release.apk ($([math]::Round($Apk.Length/1MB, 2)) MB) — nao altera boot"

$InstallerSrc = Join-Path $RepoRoot 'Player-AD-Installer\build\outputs\apk\release\Instala-Player-TotemDigital.apk'
$InstallerDest = Join-Path $ApkDestDir 'Instala-Player-TotemDigital.apk'
if (Test-Path $InstallerSrc) {
  Copy-Item -Force $InstallerSrc $InstallerDest
  Write-Host "OK instalador: Instala-Player-TotemDigital.apk (logo boot + Player-AD) ($([math]::Round((Get-Item $InstallerDest).Length/1MB, 2)) MB)"
} elseif (Test-Path $InstallerDest) {
  Write-Host "OK instalador: a manter Instala-Player-TotemDigital.apk ja no kit"
} else {
  Write-Host "AVISO: Instala-Player-TotemDigital.apk ausente — compile Player-AD-Installer"
}

$CfgSrc = Join-Path $PlayerDir 'scripts\generate-default-player-config.json'
if (Test-Path $CfgSrc) {
  Copy-Item -Force $CfgSrc (Join-Path $Dest 'config\exemplo-player-config.json')
  Write-Host "OK config: exemplo-player-config.json atualizado"
}

# Atualizar versao no LEIA-ME e KIT-VERSION.txt a partir do build.gradle
$Gradle = Get-Content (Join-Path $PlayerDir 'build.gradle') -Raw
$ver = if ($Gradle -match "versionName\s+'([^']+)'") { $Matches[1] } else { '?' }
$code = if ($Gradle -match 'versionCode\s+(\d+)') { $Matches[1] } else { '?' }
$feVer = '?'
$beVer = '?'
$fePkg = Join-Path $RepoRoot 'frontend\package.json'
$bePkg = Join-Path $RepoRoot 'backend\package.json'
if (Test-Path $fePkg) {
  $feJson = Get-Content $fePkg -Raw | ConvertFrom-Json
  if ($feJson.version) { $feVer = $feJson.version }
}
if (Test-Path $bePkg) {
  $beJson = Get-Content $bePkg -Raw | ConvertFrom-Json
  if ($beJson.version) { $beVer = $beJson.version }
}
$leia = Join-Path $Dest 'LEIA-ME.txt'
if (Test-Path $leia) {
  $txt = Get-Content $leia -Raw
  $txt = [regex]::Replace($txt, 'Player-AD\s+[\d.]+ \(versionCode \d+\)', "Player-AD $ver (versionCode $code)")
  $txt = [regex]::Replace($txt, 'Front [\d.]+ / Back [\d.]+', "Front $feVer / Back $beVer")
  Set-Content -Path $leia -Value $txt -NoNewline -Encoding UTF8
  Write-Host "OK LEIA-ME: Player-AD $ver (versionCode $code)"
}
$kitVer = Join-Path $Dest 'KIT-VERSION.txt'
$today = Get-Date -Format 'yyyy-MM-dd'
@"
TotemDigital — Kit de campo (pendrive)
Player-AD:     $ver (versionCode $code)
Painel:        Front $feVer / Back $beVer
Branch:        main
Data kit:      $today
APK git:       install-pendrive/apk/Player-AD-release.apk (sem debug; nao altera boot)
Instalador:    install-pendrive/apk/Instala-Player-TotemDigital.apk (logo boot + Player-AD)
Homologação:   docs/hardware/HOMOLOGACAO-TV-BOX-PLAYER-AD-2.12.md (base 2.12)
Campo:         TV_BOX_3 — $ver / $code (kit $today); base PASS 2.12 / 112 (2026-08-13)

Regenerar (com APK release compilado):
  cd Player-AD
  .\scripts\prepare-install-pendrive.ps1 -Rebuild
"@ | Set-Content -Path $kitVer -Encoding UTF8
Write-Host "OK KIT-VERSION.txt: Player-AD $ver ($code) · FE $feVer · BE $beVer"

Write-Host ""
Write-Host "Kit pronto em: $Dest"
Write-Host "Copie para o USB com: .\scripts\copy-install-pendrive-to-usb.ps1 E:"
Get-Item (Join-Path $ApkDestDir 'Player-AD-release.apk') | Format-List FullName, Length, LastWriteTime
