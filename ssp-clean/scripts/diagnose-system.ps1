[CmdletBinding()]
param(
  [string]$HostName = 'localhost'
)

Write-Host "===> Containers"
try { docker compose ps | Out-Host } catch {}

Write-Host "===> Portas (3000,3002,9090,80,443)"
try { netstat -ano | findstr ":3000 :3002 :9090 :80 :443" | Out-Host } catch {}

Write-Host "===> Health endpoints"
$urls = @(
  "http://$HostName:3000/health",
  "http://$HostName:9090/-/healthy",
  "http://$HostName:3002/login"
)
foreach ($u in $urls) {
  try { $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 5; Write-Host "OK $u ($($r.StatusCode))" }
  catch { Write-Warning "FAIL $u $_" }
}

Write-Host "===> Logs recentes"
foreach ($svc in 'backend','frontend','nginx','prometheus','grafana') {
  try { Write-Host "--- $svc ---"; docker compose logs --tail 50 $svc | Out-Host } catch {}
}

Write-Host "===> Ping interno (nginx -> backend/frontend)"
try { docker exec smartsignage-nginx ping -c 2 backend | Out-Host } catch {}
try { docker exec smartsignage-nginx ping -c 2 frontend | Out-Host } catch {}

Write-Host "Diagnóstico concluído"
