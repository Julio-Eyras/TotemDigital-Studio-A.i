<#
.SYNOPSIS
    Script Simples de Exportação DB → Excel
.DESCRIPTION
    Versão simplificada para exportar uma query específica do PostgreSQL para Excel.
    Tudo em um único arquivo, fácil de configurar e usar.
.PARAMETER Query
    Query SQL a ser executada (opcional, usa padrão se não fornecido)
.PARAMETER OutputFile
    Nome do arquivo Excel de saída (opcional, usa padrão se não fornecido)
.EXAMPLE
    .\Export-Simple.ps1
    Exporta usando query e configurações padrão
.EXAMPLE
    .\Export-Simple.ps1 -Query "SELECT * FROM totems WHERE active = true"
    Exporta com query customizada
.NOTES
    Versão: 1.0 - Simplificada
    Autor: Smart Signage Solutions
    Data: 2025-11-03
#>

[CmdletBinding()]
param(
    [string]$Query = "",
    [string]$OutputFile = ""
)

# ============================================
# CONFIGURAÇÃO - EDITAR AQUI
# ============================================

# Configuração do Banco de Dados
$DatabaseConfig = @{
    Host     = "localhost"
    Port     = 5432
    Database = "smartsignage"
    Username = "smartsignage"
    Password = "smartsignage123"
}

# Query SQL Padrão
$DefaultQuery = @"
SELECT * FROM totems 
WHERE active = true 
ORDER BY created_at DESC
"@

# Configuração de Exportação
$ExportConfig = @{
    OutputDirectory = ".\exports"
    FileName        = "totems_export"
    SheetName       = "Totens"
    ApplyFormatting = $true
}

# ============================================
# FUNÇÕES
# ============================================

function Write-ColorLog {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Install-RequiredModule {
    if (-not (Get-Module -ListAvailable -Name ImportExcel)) {
        Write-ColorLog "Instalando módulo ImportExcel..." "Yellow"
        Install-Module -Name ImportExcel -Scope CurrentUser -Force -SkipPublisherCheck
        Write-ColorLog "Módulo ImportExcel instalado!" "Green"
    }
    Import-Module ImportExcel -Force -ErrorAction SilentlyContinue
}

function Connect-PostgreSQL {
    param([hashtable]$Config)
    
    Write-ColorLog "Conectando ao PostgreSQL..." "Cyan"
    
    # Verificar se psql está disponível
    $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psqlPath) {
        throw "psql não encontrado. Instale PostgreSQL Client Tools ou configure PGPATH."
    }
    
    # Configurar variável de ambiente para senha
    $env:PGPASSWORD = $Config.Password
    
    Write-ColorLog "✓ Conectado ao banco: $($Config.Database)@$($Config.Host):$($Config.Port)" "Green"
    
    return @{
        Config = $Config
        Connected = $true
    }
}

function Invoke-Query {
    param(
        [hashtable]$Connection,
        [string]$Query
    )
    
    Write-ColorLog "Executando query..." "Cyan"
    
    $startTime = Get-Date
    $config = $Connection.Config
    
    # Executar query via psql
    $env:PGPASSWORD = $config.Password
    
    $psqlArgs = @(
        "-h", $config.Host,
        "-p", $config.Port,
        "-d", $config.Database,
        "-U", $config.Username,
        "-t", "-A", "-F", "|",
        "-c", $Query
    )
    
    $result = & psql $psqlArgs 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "Erro ao executar query: $result"
    }
    
    # Parsear resultado
    $lines = $result | Where-Object { $_ -match "\|" -and $_ -notmatch "^--" }
    if ($lines.Count -eq 0) {
        Write-ColorLog "⚠ Nenhum resultado encontrado" "Yellow"
        return @()
    }
    
    # Primeira linha são os cabeçalhos
    $headers = ($lines[0] -split "\|") | ForEach-Object { $_.Trim() }
    
    # Resto são os dados
    $data = @()
    for ($i = 1; $i -lt $lines.Count; $i++) {
        $values = ($lines[$i] -split "\|") | ForEach-Object { $_.Trim() }
        if ($values.Count -eq $headers.Count) {
            $row = @{}
            for ($j = 0; $j -lt $headers.Count; $j++) {
                $row[$headers[$j]] = $values[$j]
            }
            $data += [PSCustomObject]$row
        }
    }
    
    $duration = (Get-Date) - $startTime
    Write-ColorLog "✓ Query executada: $($data.Count) registros em $([math]::Round($duration.TotalSeconds, 2))s" "Green"
    
    return $data
}

function Export-ToExcel {
    param(
        [array]$Data,
        [hashtable]$Config
    )
    
    if ($Data.Count -eq 0) {
        Write-ColorLog "⚠ Nenhum dado para exportar" "Yellow"
        return
    }
    
    Write-ColorLog "Exportando para Excel..." "Cyan"
    
    # Criar diretório se não existir
    if (-not (Test-Path $Config.OutputDirectory)) {
        New-Item -ItemType Directory -Path $Config.OutputDirectory -Force | Out-Null
    }
    
    # Gerar nome do arquivo com timestamp
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $fileName = "$($Config.FileName)_$timestamp.xlsx"
    $filePath = Join-Path $Config.OutputDirectory $fileName
    
    # Exportar dados
    try {
        $Data | Export-Excel `
            -Path $filePath `
            -WorksheetName $Config.SheetName `
            -AutoSize `
            -AutoFilter `
            -FreezeTopRow `
            -BoldTopRow `
            -ErrorAction Stop
        
        if ($Config.ApplyFormatting) {
            # Aplicar formatação adicional
            $excel = Open-ExcelPackage -Path $filePath
            $worksheet = $excel.Workbook.Worksheets[$Config.SheetName]
            
            if ($worksheet) {
                # Formatar cabeçalho
                $headerRange = $worksheet.Dimension.Address -replace '\d+$', '1'
                $worksheet.Cells[$headerRange].Style.Font.Bold = $true
                $worksheet.Cells[$headerRange].Style.Fill.PatternType = [OfficeOpenXml.Style.ExcelFillStyle]::Solid
                $worksheet.Cells[$headerRange].Style.Fill.BackgroundColor.SetColor([System.Drawing.Color]::LightGray)
                
                # Ajustar colunas
                for ($col = 1; $col -le $worksheet.Dimension.Columns; $col++) {
                    $column = $worksheet.Column($col)
                    $column.AutoFit()
                    if ($column.Width -lt 10) { $column.Width = 10 }
                    if ($column.Width -gt 50) { $column.Width = 50 }
                }
            }
            
            Close-ExcelPackage $excel
        }
        
        $fileInfo = Get-Item $filePath
        Write-ColorLog "✓ Arquivo criado: $filePath ($([math]::Round($fileInfo.Length / 1KB, 2)) KB)" "Green"
        
        return $filePath
    }
    catch {
        Write-ColorLog "✗ Erro ao exportar: $($_.Exception.Message)" "Red"
        throw
    }
}

# ============================================
# EXECUÇÃO PRINCIPAL
# ============================================

try {
    Write-ColorLog "========================================" "Cyan"
    Write-ColorLog "  Exportação Simples DB → Excel" "Cyan"
    Write-ColorLog "========================================" "Cyan"
    Write-ColorLog ""
    
    # Instalar módulo necessário
    Install-RequiredModule
    
    # Determinar query e arquivo
    $query = if ($Query) { $Query } else { $DefaultQuery }
    $fileName = if ($OutputFile) { $OutputFile } else { $ExportConfig.FileName }
    $ExportConfig.FileName = $fileName
    
    # Conectar ao banco
    $connection = Connect-PostgreSQL -Config $DatabaseConfig
    
    # Executar query
    $data = Invoke-Query -Connection $connection -Query $query
    
    # Exportar para Excel
    if ($data.Count -gt 0) {
        $filePath = Export-ToExcel -Data $data -Config $ExportConfig
        Write-ColorLog ""
        Write-ColorLog "========================================" "Green"
        Write-ColorLog "  Exportação concluída com sucesso!" "Green"
        Write-ColorLog "========================================" "Green"
        Write-ColorLog "Arquivo: $filePath" "White"
        Write-ColorLog "Registros: $($data.Count)" "White"
    }
    else {
        Write-ColorLog ""
        Write-ColorLog "Nenhum dado foi exportado." "Yellow"
    }
    
    exit 0
}
catch {
    Write-ColorLog ""
    Write-ColorLog "========================================" "Red"
    Write-ColorLog "  ERRO: $($_.Exception.Message)" "Red"
    Write-ColorLog "========================================" "Red"
    exit 1
}
finally {
    # Limpar variável de ambiente
    if ($env:PGPASSWORD) {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
}

