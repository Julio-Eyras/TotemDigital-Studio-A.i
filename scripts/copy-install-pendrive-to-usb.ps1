# Copia o kit install-pendrive para a raiz de um pendrive (letra da unidade).
# Uso: .\scripts\copy-install-pendrive-to-usb.ps1 E:
# Ou sem args: deteta unidades removiveis automaticamente.

param(
  [Parameter(Position = 0)]
  [string]$DriveLetter
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Src = Join-Path $RepoRoot 'install-pendrive'
$ApkDir = Join-Path $Src 'apk'
$Apk = Get-ChildItem -Path $ApkDir -Filter 'Player-AD-Vs*-build-*.apk' -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $Apk -and (Test-Path (Join-Path $ApkDir 'Player-AD-release.apk'))) {
  $Apk = Get-Item (Join-Path $ApkDir 'Player-AD-release.apk')
}

if (-not $Apk) {
  Write-Error "APK em falta em $ApkDir (esperado Player-AD-Vs*-build-*.apk) — compile com: cd Player-AD; .\gradlew.bat assembleRelease; .\scripts\prepare-install-pendrive.ps1"
}

function Resolve-UsbRoot([string]$letter) {
  if (-not $letter) { return $null }
  $letter = $letter.TrimEnd(':','\')
  $root = "${letter}:\"
  if (-not (Test-Path $root)) { throw "Unidade nao encontrada: $root" }
  return $root
}

if (-not $DriveLetter) {
  $removable = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 }
  if (-not $removable) {
    Write-Host "Nenhum pendrive (DriveType=Removable) detectado." -ForegroundColor Yellow
    Write-Host "Ligue o USB e execute de novo, ou passe a letra: .\copy-install-pendrive-to-usb.ps1 E:"
    exit 2
  }
  if (@($removable).Count -gt 1) {
    $removable | Format-Table DeviceID, VolumeName, @{N='FreeGB';E={[math]::Round($_.FreeSpace/1GB,1)}}
    throw "Varias unidades removiveis — indique a letra, ex.: E:"
  }
  $DriveLetter = $removable.DeviceID
}

$DestRoot = Resolve-UsbRoot $DriveLetter
$Dest = Join-Path $DestRoot 'install-pendrive'

Write-Host "Origem:  $Src"
Write-Host "Destino: $Dest"
New-Item -ItemType Directory -Force -Path $Dest | Out-Null

robocopy $Src $Dest /MIR /NFL /NDL /NJH /NJS /XD ".bootanimation-build" | Out-Null
$rc = $LASTEXITCODE
if ($rc -ge 8) { throw "robocopy falhou com codigo $rc" }

Write-Host ""
Write-Host "OK — kit copiado para $Dest" -ForegroundColor Green
Write-Host "Na TV Box: abra o pendrive → install-pendrive\apk\$($Apk.Name)"
Get-Item (Join-Path (Join-Path $Dest 'apk') $Apk.Name) | Format-List FullName, Length, LastWriteTime
