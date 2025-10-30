[CmdletBinding()]
param(
  [string]$HostOverride = "localhost"
)

$HOSTNAME = $HostOverride
$API = "http://$HOSTNAME:3000"
$GRAFANA = "http://$HOSTNAME:3002"
$PROM = "http://$HOSTNAME:9090"

function Invoke-Json($url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
    if ($r.StatusCode -eq 200) { Write-Host "OK: $url"; return $true }
  } catch { Write-Warning "Falhou: $url - $_" }
  return $false
}

Write-Host "===> 1) Containers e portas"
try { docker compose ps | Out-Host } catch {}
try { netstat -ano | findstr ":3000 :3002 :9090 :80 :443" | Out-Host } catch {}

Write-Host "===> 2) Health e OpenAPI"
Invoke-Json "$API/health" | Out-Null
try {
  $docs = Invoke-WebRequest -Uri "$API/api/docs.json" -UseBasicParsing -TimeoutSec 10
  if ($docs.StatusCode -eq 200) { Write-Host "Docs JSON OK" }
} catch { Write-Warning "Docs JSON falhou: $_" }

Write-Host "===> 3) Login admin e token"
$token = ""
try {
  $body = @{ username = 'admin'; password = 'admin' } | ConvertTo-Json
  $resp = Invoke-WebRequest -Method POST -Uri "$API/api/auth/login" -ContentType 'application/json' -Body $body -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  $token = $json.accessToken
  if ($token) { Write-Host "TOKEN OK" }
} catch { Write-Warning "Login falhou: $_" }

Write-Host "===> 4) CRUD rápido - criar cliente e checar lista"
try {
  $body = @{ name = 'Cliente Teste'; email = 'cliente@teste.com' } | ConvertTo-Json
  Invoke-WebRequest -Method POST -Uri "$API/api/clients" -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json' -Body $body -UseBasicParsing | Out-Null
  $list = Invoke-WebRequest -Uri "$API/api/clients?page=1&limit=5" -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing
  if ($list.StatusCode -eq 200) { Write-Host "Clients OK" }
} catch { Write-Warning "Clients falhou: $_" }

Write-Host "===> 5) Campanha simples"
try {
  $body = @{ clientId = 1; title = 'Campanha Teste'; description = 'Demo'; campaignType = 'general'; isActive = $true } | ConvertTo-Json
  Invoke-WebRequest -Method POST -Uri "$API/api/campaigns" -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json' -Body $body -UseBasicParsing | Out-Null
  Write-Host "Campanha OK"
} catch { Write-Warning "Campanha falhou: $_" }

Write-Host "===> 6) Players e heartbeat"
try {
  $body = @{ name = 'Totem 1'; location = 'Loja Central'; clientId = 1 } | ConvertTo-Json
  $resp = Invoke-WebRequest -Method POST -Uri "$API/api/players" -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json' -Body $body -UseBasicParsing
  $pid = ($resp.Content | ConvertFrom-Json).id
  if ($pid) {
    $hb = @{ status = 'online'; uptime = 120; memoryUsage = 30.5 } | ConvertTo-Json
    Invoke-WebRequest -Method POST -Uri "$API/api/totems/$pid/heartbeat" -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json' -Body $hb -UseBasicParsing | Out-Null
    Write-Host "Heartbeat OK"
  }
} catch { Write-Warning "Players/Heartbeat falhou: $_" }

Write-Host "===> 7) Grafana e Prometheus"
Invoke-Json "$PROM/-/healthy" | Out-Null
try { Invoke-WebRequest -Uri "$GRAFANA/login" -UseBasicParsing -TimeoutSec 5 | Out-Null; Write-Host "Grafana UP" } catch { Write-Warning "Grafana não respondeu" }

Write-Host "===> 8) HTTPS (se habilitado)"
try { Invoke-WebRequest -Uri "https://$HOSTNAME/health" -UseBasicParsing -TimeoutSec 5 -SkipCertificateCheck | Out-Null; Write-Host "HTTPS OK" } catch { Write-Host "HTTPS não ativo (ok se escolheu HTTP)" }

Write-Host "===> 9) Logs rápidos"
try { docker compose logs --tail 20 backend | Out-Host } catch {}
try { docker compose logs --tail 20 nginx | Out-Host } catch {}
try { docker compose logs --tail 20 prometheus | Out-Host } catch {}
try { docker compose logs --tail 20 grafana | Out-Host } catch {}

Write-Host "✓ Checklist concluído"
