#Requires -Version 5.1
<#
.SYNOPSIS
  Coleta specs TV_BOX_3 via ADB e atualiza docs/hardware/TV_BOX_3-SPEC.md
#>
$ErrorActionPreference = 'Stop'
$Repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Spec = Join-Path $Repo 'docs\hardware\TV_BOX_3-SPEC.md'

$dev = adb devices 2>&1 | Where-Object { $_ -match '\tdevice$' }
if (-not $dev) { Write-Error "Nenhum dispositivo ADB. Conecte a TV_BOX_3." }

$model = (adb shell getprop ro.product.model 2>&1).Trim()
$device = (adb shell getprop ro.product.device 2>&1).Trim()
$platform = (adb shell getprop ro.board.platform 2>&1).Trim()
$android = (adb shell getprop ro.build.version.release 2>&1).Trim()
$serial = (adb shell getprop ro.serialno 2>&1).Trim()
$mem = (adb shell "grep MemTotal /proc/meminfo" 2>&1).Trim()
$df = (adb shell "df -h /data" 2>&1 | Select-Object -Last 1).Trim()
$wm = (adb shell "wm size" 2>&1).Trim()
$eth = (adb shell "ip link show eth0 2>&1" 2>&1 | Select-Object -First 1).Trim()
if ($eth -match 'does not exist|error') { $eth = 'sem eth0 detectado' }

$ramMb = if ($mem -match '(\d+)') { [math]::Round([int]$Matches[1]/1024) } else { '?' }

Write-Host "Modelo: $model | RAM ~${ramMb}GB | $df"

$content = Get-Content $Spec -Raw -Encoding UTF8
$content = $content -replace '\| Serial \| \*\*\(confirmar via ADB\)\*\*.*?\|', "| Serial | $serial |"
$content = $content -replace '\| RAM \| \*\*\(confirmar\)\*\* \| Pendente \|', "| RAM | ~${ramMb} GB ($mem) | Sim ADB |"
$content = $content -replace '\| ROM /data \| \*\*\(confirmar\)\*\* \| Pendente \|', "| ROM /data | $df | Sim ADB |"
$content = $content -replace '\| Resolução lógica \| ~1280×672.*?\| Sim \|', "| Resolução lógica | $wm; portrait via user_rotation=1 | Sim ADB |"
$content = $content -replace '\| Ethernet \| \*\*\(confirmar eth0\)\*\* \| Pendente \|', "| Ethernet | $eth | Sim ADB |"
$content = $content -replace '\*\*Última validação Player-AD:\*\* v1\.33 \(jul/2026\)', "**Última validação Player-AD:** v1.33 ($(Get-Date -Format 'yyyy-MM-dd') ADB)"

Set-Content -Path $Spec -Value $content -Encoding UTF8 -NoNewline
Write-Host "OK atualizado: $Spec"
