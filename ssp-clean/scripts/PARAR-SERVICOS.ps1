# ============================================
# Smart Signage Pro - Parar Servicos
# Windows PowerShell
# ============================================

Write-Host "Parando servicos do Smart Signage Pro..." -ForegroundColor Yellow
Write-Host ""

# Parar Jobs do PowerShell primeiro
$pidsFile = Join-Path $PSScriptRoot ".pids"
if (Test-Path $pidsFile) {
    try {
        $pids = Get-Content $pidsFile | ConvertFrom-Json
        if ($pids.BackendJobId) {
            Stop-Job -Id $pids.BackendJobId -ErrorAction SilentlyContinue
            Remove-Job -Id $pids.BackendJobId -ErrorAction SilentlyContinue
            Write-Host "[OK] Backend Job parado (ID: $($pids.BackendJobId))" -ForegroundColor Green
        }
        if ($pids.FrontendJobId) {
            Stop-Job -Id $pids.FrontendJobId -ErrorAction SilentlyContinue
            Remove-Job -Id $pids.FrontendJobId -ErrorAction SilentlyContinue
            Write-Host "[OK] Frontend Job parado (ID: $($pids.FrontendJobId))" -ForegroundColor Green
        }
    } catch {
        Write-Host "[AVISO] Erro ao parar Jobs: $_" -ForegroundColor Yellow
    }
}

# Parar todos os Jobs relacionados
Get-Job | Where-Object { $_.Command -like "*npm*" } | ForEach-Object {
    Stop-Job -Id $_.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $_.Id -ErrorAction SilentlyContinue
    Write-Host "[OK] Job parado (ID: $($_.Id))" -ForegroundColor Green
}

# Funcao para parar servico em uma porta
function Stop-ServiceOnPort {
    param([int]$Port, [string]$ServiceName)
    
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($conn) {
            $pid = $conn.OwningProcess
            $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($process) {
                Stop-Process -Id $pid -Force
                Write-Host "[OK] $ServiceName (porta $Port) parado. PID: $pid" -ForegroundColor Green
                return $true
            }
        }
        Write-Host "[INFO] $ServiceName (porta $Port) nao esta rodando" -ForegroundColor Gray
        return $false
    } catch {
        Write-Host "[ERRO] Erro ao parar $ServiceName : $_" -ForegroundColor Red
        return $false
    }
}

# Parar Backend
$backendStopped = Stop-ServiceOnPort -Port 3000 -ServiceName "Backend"

# Parar Frontend
$frontendStopped = Stop-ServiceOnPort -Port 3001 -ServiceName "Frontend"

Write-Host ""
$anyStopped = $backendStopped -or $frontendStopped
if ($anyStopped) {
    Write-Host "Servicos parados com sucesso!" -ForegroundColor Green
} else {
    Write-Host "Nenhum servico estava rodando nas portas 3000/3001." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Para iniciar novamente:" -ForegroundColor Cyan
Write-Host "  Backend:  cd backend && npm run dev" -ForegroundColor White
Write-Host "  Frontend: cd frontend && npm start" -ForegroundColor White
Write-Host ""

