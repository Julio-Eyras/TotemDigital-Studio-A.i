[CmdletBinding()]
param(
  [ValidateSet('backup','restore')][string]$Action = 'backup',
  [string]$File
)

$backupDir = Join-Path (Resolve-Path '.').Path 'backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$ts = Get-Date -Format 'yyyyMMdd_HHmmss'

if ($Action -eq 'backup') {
  $dest = if ($File) { $File } else { Join-Path $backupDir "backup_$ts.zip" }
  Write-Host "Gerando backup em $dest"
  # Exportar configs e compose
  $temp = Join-Path $env:TEMP "sspro_$ts"
  New-Item -ItemType Directory -Force -Path $temp | Out-Null
  Copy-Item -Recurse -Force ./monitoring $temp/monitoring
  Copy-Item -Recurse -Force ./nginx $temp/nginx
  Copy-Item -Recurse -Force ./database $temp/database
  Copy-Item -Force ./docker-compose.yml $temp/
  # Dump do Postgres via container (se rodando)
  try {
    $pgc = docker ps --filter "name=smartsignage-postgres" --format "{{.ID}}"
    if ($pgc) {
      Write-Host "Executando dump do PostgreSQL..."
      docker exec $pgc pg_dump -U smartsignage smartsignage > "$temp/postgres_dump.sql"
    }
  } catch { Write-Warning "Dump do PostgreSQL falhou: $_" }
  Compress-Archive -Path "$temp/*" -DestinationPath $dest -Force
  Remove-Item -Recurse -Force $temp
  Write-Host "Backup concluído: $dest"
} elseif ($Action -eq 'restore') {
  if (-not $File -or -not (Test-Path $File)) { Write-Error "Informe -File com o backup"; exit 1 }
  Write-Host "Restaurando de $File"
  $temp = Join-Path $env:TEMP "sspro_restore_$ts"
  Expand-Archive -Path $File -DestinationPath $temp -Force
  Copy-Item -Recurse -Force "$temp/monitoring" ./
  Copy-Item -Recurse -Force "$temp/nginx" ./
  Copy-Item -Recurse -Force "$temp/database" ./
  if (Test-Path "$temp/postgres_dump.sql") {
    try {
      $pgc = docker ps --filter "name=smartsignage-postgres" --format "{{.ID}}"
      if ($pgc) {
        Write-Host "Restaurando PostgreSQL..."
        docker exec -i $pgc psql -U smartsignage smartsignage < "$temp/postgres_dump.sql"
      }
    } catch { Write-Warning "Restore do PostgreSQL falhou: $_" }
  }
  Remove-Item -Recurse -Force $temp
  Write-Host "Restore concluído"
}
