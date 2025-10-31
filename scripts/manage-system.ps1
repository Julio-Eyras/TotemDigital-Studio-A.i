[CmdletBinding()]
param(
  [Parameter(Position=0)][ValidateSet('start','stop','restart','status','logs','update','backup','clean')][string]$Command = 'status',
  [string]$Service,
  [switch]$Follow
)

function Compose() {
  if (Get-Command docker-compose -ErrorAction SilentlyContinue) { return 'docker-compose' } else { return 'docker compose' }
}

function Do-Status {
  & (Compose) ps
}
function Do-Start {
  & (Compose) up -d
}
function Do-Stop {
  & (Compose) down
}
function Do-Restart {
  if ($Service) { & (Compose) restart $Service } else { & (Compose) restart }
}
function Do-Logs {
  if ($Service) { & (Compose) logs ($Follow ? '-f' : '') $Service } else { & (Compose) logs ($Follow ? '-f' : '') }
}
function Do-Update {
  & (Compose) pull
  & (Compose) build
  & (Compose) up -d
}
function Do-Backup {
  $ts = Get-Date -Format 'yyyyMMdd_HHmmss'
  $dest = Join-Path (Resolve-Path '.').Path ("backups\backup_$ts.zip")
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  Compress-Archive -Path '.\monitoring','./nginx','./database','./docker-compose.yml' -DestinationPath $dest -Force
  Write-Host "Backup salvo em $dest"
}
function Do-Clean {
  & (Compose) down --remove-orphans
  docker system prune -af --volumes
}

switch ($Command) {
  'status'  { Do-Status }
  'start'   { Do-Start }
  'stop'    { Do-Stop }
  'restart' { Do-Restart }
  'logs'    { Do-Logs }
  'update'  { Do-Update }
  'backup'  { Do-Backup }
  'clean'   { Do-Clean }
}
