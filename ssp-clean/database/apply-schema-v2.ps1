# =============================================
# SmartSignage Pro - Schema Refatorado v2.0
# Script PowerShell para aplicar todos os scripts SQL
# =============================================

param(
    [Parameter(Mandatory=$false)]
    [string]$DatabaseName = "smartchannel_db",
    
    [Parameter(Mandatory=$false)]
    [string]$Username = "postgres",
    
    [Parameter(Mandatory=$false)]
    [string]$Host = "localhost",
    
    [Parameter(Mandatory=$false)]
    [int]$Port = 5432,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipConfirm
)

$ErrorActionPreference = "Stop"

# Cores para output
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# Verificar se psql está disponível
function Test-PSQL {
    try {
        $null = Get-Command psql -ErrorAction Stop
        return $true
    } catch {
        Write-ColorOutput "❌ ERRO: psql não encontrado no PATH" "Red"
        Write-ColorOutput "   Instale o PostgreSQL Client ou adicione ao PATH" "Yellow"
        return $false
    }
}

# Executar script SQL
function Invoke-SQLScript {
    param(
        [string]$ScriptPath,
        [string]$Description
    )
    
    if (-not (Test-Path $ScriptPath)) {
        Write-ColorOutput "❌ Arquivo não encontrado: $ScriptPath" "Red"
        return $false
    }
    
    Write-ColorOutput "   Executando: $Description..." "Cyan"
    
    $env:PGPASSWORD = if ($env:PGPASSWORD) { $env:PGPASSWORD } else { 
        $securePassword = Read-Host "Digite a senha do PostgreSQL" -AsSecureString
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    }
    
    $psqlArgs = @(
        "-h", $Host,
        "-p", $Port.ToString(),
        "-U", $Username,
        "-d", $DatabaseName,
        "-f", $ScriptPath,
        "-v", "ON_ERROR_STOP=1"
    )
    
    try {
        $output = & psql $psqlArgs 2>&1
        $exitCode = $LASTEXITCODE
        
        if ($exitCode -eq 0) {
            Write-ColorOutput "   ✅ Sucesso!" "Green"
            return $true
        } else {
            Write-ColorOutput "   ❌ Erro ao executar script (código: $exitCode)" "Red"
            Write-ColorOutput $output "Yellow"
            return $false
        }
    } catch {
        Write-ColorOutput "   ❌ Exceção: $_" "Red"
        return $false
    }
}

# Script principal
function Main {
    Write-ColorOutput "`n========================================" "Cyan"
    Write-ColorOutput " SmartSignage Pro - Schema v2.0" "Cyan"
    Write-ColorOutput " Aplicação de Scripts SQL" "Cyan"
    Write-ColorOutput "========================================`n" "Cyan"
    
    # Verificar psql
    if (-not (Test-PSQL)) {
        exit 1
    }
    
    # Obter diretório do script
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $databaseDir = $scriptDir
    
    # Lista de scripts na ordem correta (alinhada ao apply-schema-v2.sh)
    $scripts = @(
        @{ File = "smartchannel-db-v2-refactored-part1-schema-setup.sql"; Description = "Parte 1: Setup do Schema" },
        @{ File = "smartchannel-db-v2-refactored-part2-tables-base.sql"; Description = "Parte 2: Tabelas Base" },
        @{ File = "smartchannel-db-v2-refactored-part3-tables-dependent.sql"; Description = "Parte 3: Tabelas Dependentes" },
        @{ File = "smartchannel-db-v2-refactored-part4-billing-contracts.sql"; Description = "Parte 4: Billing e Contratos" },
        @{ File = "smartchannel-db-v2-refactored-part5-tables-relationships.sql"; Description = "Parte 5: Relacionamentos N:N" },
        @{ File = "smartchannel-db-v2-refactored-part6-tables-other.sql"; Description = "Parte 6: Outras Tabelas" },
        @{ File = "seeds-default-settings.sql"; Description = "Seeds: Configurações Padrão do Sistema" },
        @{ File = "smartchannel-db-v2-refactored-part7-foreign-keys.sql"; Description = "Parte 7: Foreign Keys" },
        @{ File = "smartchannel-db-v2-refactored-part8-indexes.sql"; Description = "Parte 8: Índices" },
        @{ File = "smartchannel-db-v2-refactored-part9-triggers-functions.sql"; Description = "Parte 9: Triggers e Funções" },
        @{ File = "smartchannel-db-v2-refactored-part10-views.sql"; Description = "Parte 10: Views" },
        @{ File = "smartchannel-db-v2-refactored-part11-playlist-mix.sql"; Description = "Parte 11: Playlist Mix (Tabelas)" },
        @{ File = "smartchannel-db-v2-refactored-part12-playlist-mix-functions.sql"; Description = "Parte 12: Playlist Mix (Funções e Triggers)" },
        @{ File = "smartchannel-db-v2-refactored-part13-dispatcher-views.sql"; Description = "Parte 13: Dispatcher Views" },
        @{ File = "seeds-playlist-mix.sql"; Description = "Seeds: Dados Iniciais Playlist Mix" }
    )
    
    # Mostrar configuração
    Write-ColorOutput "Configuração:" "Yellow"
    Write-ColorOutput "  Host: $Host" "White"
    Write-ColorOutput "  Port: $Port" "White"
    Write-ColorOutput "  Database: $DatabaseName" "White"
    Write-ColorOutput "  Username: $Username" "White"
    Write-ColorOutput ""
    
    # Confirmação
    if (-not $SkipConfirm) {
        Write-ColorOutput "⚠️  ATENÇÃO: Este script irá recriar o banco de dados do zero!" "Yellow"
        Write-ColorOutput "   Todos os dados existentes serão perdidos!" "Red"
        Write-ColorOutput ""
        $confirm = Read-Host "Deseja continuar? (S/N)"
        if ($confirm -ne "S" -and $confirm -ne "s") {
            Write-ColorOutput "Operação cancelada." "Yellow"
            exit 0
        }
    }
    
    Write-ColorOutput "`nIniciando aplicação dos scripts...`n" "Cyan"
    
    $successCount = 0
    $failCount = 0
    $startTime = Get-Date
    
    # Executar cada script
    for ($i = 0; $i -lt $scripts.Count; $i++) {
        $script = $scripts[$i]
        $scriptPath = Join-Path $databaseDir $script.File
        $step = $i + 1
        $total = $scripts.Count
        
        Write-ColorOutput "[$step/$total] $($script.Description)" "Cyan"
        
        if (Invoke-SQLScript -ScriptPath $scriptPath -Description $script.Description) {
            $successCount++
        } else {
            $failCount++
            Write-ColorOutput "`n❌ ERRO: Falha ao executar $($script.File)" "Red"
            Write-ColorOutput "   Parando execução..." "Yellow"
            break
        }
        
        Write-ColorOutput ""
    }
    
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    # Resumo
    Write-ColorOutput "`n========================================" "Cyan"
    Write-ColorOutput " Resumo da Execução" "Cyan"
    Write-ColorOutput "========================================" "Cyan"
    Write-ColorOutput "  Scripts executados com sucesso: $successCount" "Green"
    Write-ColorOutput "  Scripts com erro: $failCount" $(if ($failCount -eq 0) { "Green" } else { "Red" })
    Write-ColorOutput "  Tempo total: $($duration.TotalSeconds.ToString('F2')) segundos" "White"
    Write-ColorOutput ""
    
    if ($failCount -eq 0) {
        Write-ColorOutput "✅ Schema v2.0 aplicado com sucesso!" "Green"
        Write-ColorOutput ""
        Write-ColorOutput "NOTA: Lembre-se de atualizar as Materialized Views periodicamente:" "Yellow"
        Write-ColorOutput "  REFRESH MATERIALIZED VIEW mv_publisher_revenue_share_consolidated;" "White"
        Write-ColorOutput "  REFRESH MATERIALIZED VIEW mv_totem_executions_last_24h;" "White"
        Write-ColorOutput ""
        exit 0
    } else {
        Write-ColorOutput "❌ Falha na aplicação do schema. Verifique os erros acima." "Red"
        exit 1
    }
}

# Executar
Main

