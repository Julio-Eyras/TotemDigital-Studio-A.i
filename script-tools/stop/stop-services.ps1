# =============================================================================
# Script para Parar Serviços - Smart Signage Pro (Windows PowerShell)
# =============================================================================
# Uso: .\stop-services.ps1 [backend|frontend|all]
# =============================================================================

[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [ValidateSet("backend", "frontend", "all")]
    [string]$Service = "all"
)

$ErrorActionPreference = "Continue"

# Verificar se está no diretório correto
if (-not (Test-Path "docker-compose.yml") -and -not (Test-Path "package.json")) {
    Write-Warning "⚠️  Execute este script a partir do diretório raiz do projeto (onde está docker-compose.yml ou package.json)"
    exit 1
}

function Write-Log {
    param([string]$Message, [string]$Color = "Green")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor $Color
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[AVISO] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERRO] $Message" -ForegroundColor Red
}

# Verificar se Docker está disponível
function Test-Docker {
    try {
        docker ps | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Parar via Docker Compose
function Stop-Docker {
    param([string]$Service)
    
    if ($Service -eq "all") {
        Write-Log "Parando todos os serviços via Docker Compose..."
        docker compose down
        Write-Log "✅ Todos os serviços parados"
    } elseif ($Service -eq "backend") {
        Write-Log "Parando backend via Docker Compose..."
        docker compose stop backend
        Write-Log "✅ Backend parado"
    } elseif ($Service -eq "frontend") {
        Write-Log "Parando frontend via Docker Compose..."
        docker compose stop frontend
        Write-Log "✅ Frontend parado"
    }
}

# Parar processo por porta
function Stop-ByPort {
    param([int]$Port, [string]$ServiceName)
    
    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($connection) {
            $processId = $connection.OwningProcess
            if ($processId) {
                Write-Log "Parando processo na porta $Port ($ServiceName)..."
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                Write-Log "✅ Processo na porta $Port parado"
            }
        } else {
            Write-Warn "Nenhum processo encontrado na porta $Port"
        }
    } catch {
        Write-Warn "Erro ao parar processo na porta $Port : $($_.Exception.Message)"
    }
}

# Parar processos Node.js por nome
function Stop-ByProcessName {
    param([string]$Pattern, [string]$ServiceName)
    
    try {
        $processes = Get-Process node -ErrorAction SilentlyContinue
        
        if ($processes) {
            Write-Log "Parando processos Node.js: $ServiceName..."
            $processes | Stop-Process -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
            Write-Log "✅ Processos $ServiceName parados"
        } else {
            Write-Warn "Nenhum processo Node.js encontrado: $ServiceName"
        }
    } catch {
        Write-Warn "Erro ao parar processos: $($_.Exception.Message)"
    }
}

# Função principal
function Main {
    Write-Log "🛑 Parando serviços Smart Signage Pro..."
    Write-Log "Serviço: $Service"
    Write-Host ""
    
    # Tentar Docker primeiro
    if (Test-Docker -and (Test-Path "docker-compose.yml")) {
        Write-Log "Docker Compose detectado"
        Stop-Docker -Service $Service
        return
    }
    
    # Parar por porta
    if ($Service -eq "all" -or $Service -eq "backend") {
        Stop-ByPort -Port 3000 -ServiceName "Backend"
    }
    
    if ($Service -eq "all" -or $Service -eq "frontend") {
        Stop-ByPort -Port 3001 -ServiceName "Frontend"
        Stop-ByPort -Port 8080 -ServiceName "Frontend (alternativa)"
    }
    
    # Parar processos Node.js
    if ($Service -eq "all" -or $Service -eq "backend") {
        $nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
        if ($nodeProcesses) {
            Write-Log "Parando processos Node.js (Backend)..."
            $nodeProcesses | Where-Object { $_.Path -like "*backend*" } | Stop-Process -Force -ErrorAction SilentlyContinue
        }
    }
    
    if ($Service -eq "all" -or $Service -eq "frontend") {
        $nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
        if ($nodeProcesses) {
            Write-Log "Parando processos Node.js (Frontend)..."
            $nodeProcesses | Where-Object { $_.Path -like "*frontend*" } | Stop-Process -Force -ErrorAction SilentlyContinue
        }
    }
    
    Write-Log "✅ Processo de parada concluído"
    
    # Verificar processos restantes
    Write-Host ""
    Write-Log "Verificando processos restantes..."
    $remaining = Get-Process node -ErrorAction SilentlyContinue
    if ($remaining) {
        Write-Warn "⚠️  Ainda há processos Node.js rodando:"
        $remaining | Format-Table Id, ProcessName, Path -AutoSize
    } else {
        Write-Log "✅ Nenhum processo restante encontrado"
    }
}

# Executar
Main
