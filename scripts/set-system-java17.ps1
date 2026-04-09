#Requires -RunAsAdministrator
# Define Temurin 17 como JAVA_HOME e prioridade no PATH do sistema.
# Remove entradas antigas (JDK 24, Oracle javapath) para evitar `java` errado.

$ErrorActionPreference = 'Stop'
$jdk17 = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot'
$jdkBin = Join-Path $jdk17 'bin'

if (-not (Test-Path (Join-Path $jdkBin 'java.exe'))) {
  Write-Error "JDK 17 nao encontrado: $jdk17. Ajuste `$jdk17 neste script."
  exit 1
}

[Environment]::SetEnvironmentVariable('JAVA_HOME', $jdk17, 'Machine')

# Evita duplicar com variavel de utilizador
[Environment]::SetEnvironmentVariable('JAVA_HOME', $null, 'User')

$removeExact = @(
  'C:\Program Files\Java\jdk-24\bin',
  'C:\Program Files (x86)\Common Files\Oracle\Java\javapath',
  'C:\Program Files\Common Files\Oracle\Java\javapath',
  $jdkBin
)

$machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$parts = $machinePath -split ';' |
  ForEach-Object { $_.Trim().TrimEnd('\') } |
  Where-Object { $_ -ne '' }

$filtered = New-Object System.Collections.Generic.List[string]
$seen = @{}

foreach ($p in $parts) {
  $key = $p.ToLowerInvariant()
  if ($removeExact -contains $p) { continue }
  if ($seen.ContainsKey($key)) { continue }
  $seen[$key] = $true
  [void]$filtered.Add($p)
}

$newMachinePath = $jdkBin + ';' + ($filtered -join ';')
[Environment]::SetEnvironmentVariable('Path', $newMachinePath, 'Machine')

Write-Host "OK: JAVA_HOME (sistema) = $jdk17"
Write-Host "OK: PATH sistema com $jdkBin em primeiro (JDK 24 / Oracle javapath removidos)."
Write-Host "Reinicie terminais, IDE e Cursor para carregar o ambiente novo."
