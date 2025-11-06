<#
.SYNOPSIS
    Script Simples de Exportação DB → Excel (Multi-Banco)
.DESCRIPTION
    Versão simplificada para exportar query específica de múltiplos bancos de dados para Excel.
    Suporta: PostgreSQL, SQL Server, MySQL, SQLite
    Com tratamento robusto de erros.
.PARAMETER Provider
    Tipo de banco: PostgreSQL, SQLServer, MySQL, SQLite
.PARAMETER Query
    Query SQL a ser executada (opcional, usa padrão se não fornecido)
.PARAMETER OutputFile
    Nome do arquivo Excel de saída (opcional, usa padrão se não fornecido)
.EXAMPLE
    .\Export-MultiDB.ps1 -Provider PostgreSQL
    Exporta usando query e configurações padrão para PostgreSQL
.EXAMPLE
    .\Export-MultiDB.ps1 -Provider PostgreSQL -Query "SELECT * FROM totems WHERE active = true"
    Exporta com query customizada
.NOTES
    Versão: 1.0 - Multi-Banco Simplificada
    Autor: Smart Signage Solutions
    Data: 2025-11-03
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("PostgreSQL", "SQLServer", "MySQL", "SQLite")]
    [string]$Provider,
    
    [string]$Query = "",
    [string]$OutputFile = ""
)

# ============================================
# CONFIGURAÇÃO - EDITAR AQUI
# ============================================

# Configuração do Banco de Dados por Provider
$DatabaseConfigs = @{
    PostgreSQL = @{
        Host     = "localhost"
        Port     = 5432
        Database = "smartsignage"
        Username = "smartsignage"
        Password = "smartsignage123"
        SSLMode  = "Prefer"
    }
    SQLServer = @{
        Host     = "localhost"
        Port     = 1433
        Database = "smartsignage"
        Username = "sa"
        Password = "YourPassword123!"
        TrustedConnection = $false
    }
    MySQL = @{
        Host     = "localhost"
        Port     = 3306
        Database = "smartsignage"
        Username = "root"
        Password = "root123"
    }
    SQLite = @{
        Database = ".\database\smartsignage.db"
    }
}

# Query SQL Padrão por Provider
$DefaultQueries = @{
    PostgreSQL = @"
SELECT * FROM totems 
WHERE active = true 
ORDER BY created_at DESC
LIMIT 1000
"@
    SQLServer = @"
SELECT TOP 1000 * FROM totems 
WHERE active = 1 
ORDER BY created_at DESC
"@
    MySQL = @"
SELECT * FROM totems 
WHERE active = 1 
ORDER BY created_at DESC
LIMIT 1000
"@
    SQLite = @"
SELECT * FROM totems 
WHERE active = 1 
ORDER BY created_at DESC
LIMIT 1000
"@
}

# Configuração de Exportação
$ExportConfig = @{
    OutputDirectory = ".\exports"
    FileName        = "export"
    SheetName       = "Data"
    ApplyFormatting = $true
}

# ============================================
# FUNÇÕES AUXILIARES
# ============================================

function Write-ColorLog {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-ColorLog "✓ $Message" "Green"
}

function Write-Error {
    param([string]$Message)
    Write-ColorLog "✗ $Message" "Red"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorLog "⚠ $Message" "Yellow"
}

function Write-Info {
    param([string]$Message)
    Write-ColorLog "ℹ $Message" "Cyan"
}

function Install-RequiredModule {
    try {
        if (-not (Get-Module -ListAvailable -Name ImportExcel)) {
            Write-Info "Instalando módulo ImportExcel..."
            Install-Module -Name ImportExcel -Scope CurrentUser -Force -SkipPublisherCheck -ErrorAction Stop
            Write-Success "Módulo ImportExcel instalado!"
        }
        Import-Module ImportExcel -Force -ErrorAction Stop
        return $true
    }
    catch {
        Write-Error "Erro ao instalar/carregar ImportExcel: $($_.Exception.Message)"
        Write-Info "Tente instalar manualmente: Install-Module -Name ImportExcel -Scope CurrentUser -Force"
        return $false
    }
}

# ============================================
# CONEXÃO COM BANCO DE DADOS
# ============================================

function Connect-Database {
    param(
        [string]$Provider,
        [hashtable]$Config
    )
    
    Write-Info "Conectando ao banco de dados: $Provider..."
    
    try {
        switch ($Provider) {
            "PostgreSQL" {
                return Connect-PostgreSQL -Config $Config
            }
            "SQLServer" {
                return Connect-SQLServer -Config $Config
            }
            "MySQL" {
                return Connect-MySQL -Config $Config
            }
            "SQLite" {
                return Connect-SQLite -Config $Config
            }
            default {
                throw "Provider não suportado: $Provider"
            }
        }
    }
    catch {
        Write-Error "Falha ao conectar ao banco de dados: $($_.Exception.Message)"
        throw
    }
}

function Connect-PostgreSQL {
    param([hashtable]$Config)
    
    try {
        # Verificar se psql está disponível
        $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
        if (-not $psqlPath) {
            throw "psql não encontrado. Instale PostgreSQL Client Tools ou adicione ao PATH."
        }
        
        # Testar conexão
        $env:PGPASSWORD = $Config.Password
        $testArgs = @(
            "-h", $Config.Host,
            "-p", $Config.Port,
            "-d", $Config.Database,
            "-U", $Config.Username,
            "-c", "SELECT 1"
        )
        
        $testResult = & psql $testArgs 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao testar conexão: $testResult"
        }
        
        Write-Success "Conectado ao PostgreSQL: $($Config.Database)@$($Config.Host):$($Config.Port)"
        
        return @{
            Provider = "PostgreSQL"
            Config = $Config
            Connected = $true
        }
    }
    catch {
        Write-Error "Erro ao conectar PostgreSQL: $($_.Exception.Message)"
        throw
    }
}

function Connect-SQLServer {
    param([hashtable]$Config)
    
    try {
        # Verificar se módulo SqlServer está disponível
        if (-not (Get-Module -ListAvailable -Name SqlServer)) {
            Write-Warning "Módulo SqlServer não encontrado. Tentando instalar..."
            Install-Module -Name SqlServer -Scope CurrentUser -Force -SkipPublisherCheck -ErrorAction Stop
        }
        
        Import-Module SqlServer -Force -ErrorAction Stop
        
        # Construir string de conexão
        $connectionString = "Server=$($Config.Host),$($Config.Port);Database=$($Config.Database);User Id=$($Config.Username);Password=$($Config.Password)"
        
        # Testar conexão
        $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
        $connection.Open()
        $connection.Close()
        
        Write-Success "Conectado ao SQL Server: $($Config.Database)@$($Config.Host):$($Config.Port)"
        
        return @{
            Provider = "SQLServer"
            Config = $Config
            ConnectionString = $connectionString
            Connected = $true
        }
    }
    catch {
        Write-Error "Erro ao conectar SQL Server: $($_.Exception.Message)"
        Write-Info "Tente instalar: Install-Module -Name SqlServer -Scope CurrentUser -Force"
        throw
    }
}

function Connect-MySQL {
    param([hashtable]$Config)
    
    try {
        # Verificar se driver MySQL está disponível
        $assemblyPath = "$PSScriptRoot\libs\MySql.Data.dll"
        if (-not (Test-Path $assemblyPath)) {
            throw "Driver MySql.Data.dll não encontrado em: $assemblyPath`nBaixe em: https://dev.mysql.com/downloads/connector/net/"
        }
        
        Add-Type -Path $assemblyPath -ErrorAction Stop
        
        # Construir string de conexão
        $connectionString = "Server=$($Config.Host);Port=$($Config.Port);Database=$($Config.Database);Uid=$($Config.Username);Pwd=$($Config.Password);"
        
        # Testar conexão
        $connection = New-Object MySql.Data.MySqlClient.MySqlConnection($connectionString)
        $connection.Open()
        $connection.Close()
        
        Write-Success "Conectado ao MySQL: $($Config.Database)@$($Config.Host):$($Config.Port)"
        
        return @{
            Provider = "MySQL"
            Config = $Config
            ConnectionString = $connectionString
            Connected = $true
        }
    }
    catch {
        Write-Error "Erro ao conectar MySQL: $($_.Exception.Message)"
        Write-Info "Baixe o driver em: https://dev.mysql.com/downloads/connector/net/"
        throw
    }
}

function Connect-SQLite {
    param([hashtable]$Config)
    
    try {
        # Verificar se arquivo existe
        if (-not (Test-Path $Config.Database)) {
            throw "Arquivo SQLite não encontrado: $($Config.Database)"
        }
        
        # Verificar se driver SQLite está disponível
        $assemblyPath = "$PSScriptRoot\libs\System.Data.SQLite.dll"
        if (-not (Test-Path $assemblyPath)) {
            throw "Driver System.Data.SQLite.dll não encontrado em: $assemblyPath`nBaixe em: https://system.data.sqlite.org/index.html/doc/trunk/www/downloads.wiki"
        }
        
        Add-Type -Path $assemblyPath -ErrorAction Stop
        
        # Construir string de conexão
        $connectionString = "Data Source=$($Config.Database);Version=3;"
        
        # Testar conexão
        $connection = New-Object System.Data.SQLite.SQLiteConnection($connectionString)
        $connection.Open()
        $connection.Close()
        
        Write-Success "Conectado ao SQLite: $($Config.Database)"
        
        return @{
            Provider = "SQLite"
            Config = $Config
            ConnectionString = $connectionString
            Connected = $true
        }
    }
    catch {
        Write-Error "Erro ao conectar SQLite: $($_.Exception.Message)"
        Write-Info "Baixe o driver em: https://system.data.sqlite.org/index.html/doc/trunk/www/downloads.wiki"
        throw
    }
}

# ============================================
# EXECUÇÃO DE QUERIES
# ============================================

function Invoke-Query {
    param(
        [hashtable]$Connection,
        [string]$Query
    )
    
    Write-Info "Executando query..."
    
    $startTime = Get-Date
    
    try {
        switch ($Connection.Provider) {
            "PostgreSQL" {
                return Invoke-PostgreSQLQuery -Connection $Connection -Query $Query
            }
            "SQLServer" {
                return Invoke-SQLServerQuery -Connection $Connection -Query $Query
            }
            "MySQL" {
                return Invoke-MySQLQuery -Connection $Connection -Query $Query
            }
            "SQLite" {
                return Invoke-SQLiteQuery -Connection $Connection -Query $Query
            }
            default {
                throw "Provider não suportado: $($Connection.Provider)"
            }
        }
    }
    catch {
        $duration = (Get-Date) - $startTime
        Write-Error "Erro ao executar query após $([math]::Round($duration.TotalSeconds, 2))s: $($_.Exception.Message)"
        throw
    }
    finally {
        $duration = (Get-Date) - $startTime
        Write-Info "Query executada em $([math]::Round($duration.TotalSeconds, 2))s"
    }
}

function Invoke-PostgreSQLQuery {
    param(
        [hashtable]$Connection,
        [string]$Query
    )
    
    try {
        $config = $Connection.Config
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
            Write-Warning "Nenhum resultado encontrado"
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
        
        Write-Success "Query executada: $($data.Count) registros"
        return $data
    }
    catch {
        Write-Error "Erro ao executar query PostgreSQL: $($_.Exception.Message)"
        throw
    }
}

function Invoke-SQLServerQuery {
    param(
        [hashtable]$Connection,
        [string]$Query
    )
    
    try {
        $connection = New-Object System.Data.SqlClient.SqlConnection($Connection.ConnectionString)
        $connection.Open()
        
        try {
            $command = $connection.CreateCommand()
            $command.CommandText = $Query
            $command.CommandTimeout = 60
            
            $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($command)
            $dataset = New-Object System.Data.DataSet
            $adapter.Fill($dataset) | Out-Null
            
            $table = $dataset.Tables[0]
            $data = @()
            
            foreach ($row in $table.Rows) {
                $obj = @{}
                foreach ($col in $table.Columns) {
                    $obj[$col.ColumnName] = $row[$col]
                }
                $data += [PSCustomObject]$obj
            }
            
            Write-Success "Query executada: $($data.Count) registros"
            return $data
        }
        finally {
            $connection.Close()
        }
    }
    catch {
        Write-Error "Erro ao executar query SQL Server: $($_.Exception.Message)"
        throw
    }
}

function Invoke-MySQLQuery {
    param(
        [hashtable]$Connection,
        [string]$Query
    )
    
    try {
        $connection = New-Object MySql.Data.MySqlClient.MySqlConnection($Connection.ConnectionString)
        $connection.Open()
        
        try {
            $command = $connection.CreateCommand()
            $command.CommandText = $Query
            $command.CommandTimeout = 60
            
            $adapter = New-Object MySql.Data.MySqlClient.MySqlDataAdapter($command)
            $dataset = New-Object System.Data.DataSet
            $adapter.Fill($dataset) | Out-Null
            
            $table = $dataset.Tables[0]
            $data = @()
            
            foreach ($row in $table.Rows) {
                $obj = @{}
                foreach ($col in $table.Columns) {
                    $obj[$col.ColumnName] = $row[$col]
                }
                $data += [PSCustomObject]$obj
            }
            
            Write-Success "Query executada: $($data.Count) registros"
            return $data
        }
        finally {
            $connection.Close()
        }
    }
    catch {
        Write-Error "Erro ao executar query MySQL: $($_.Exception.Message)"
        throw
    }
}

function Invoke-SQLiteQuery {
    param(
        [hashtable]$Connection,
        [string]$Query
    )
    
    try {
        $connection = New-Object System.Data.SQLite.SQLiteConnection($Connection.ConnectionString)
        $connection.Open()
        
        try {
            $command = $connection.CreateCommand()
            $command.CommandText = $Query
            $command.CommandTimeout = 60
            
            $adapter = New-Object System.Data.SQLite.SQLiteDataAdapter($command)
            $dataset = New-Object System.Data.DataSet
            $adapter.Fill($dataset) | Out-Null
            
            $table = $dataset.Tables[0]
            $data = @()
            
            foreach ($row in $table.Rows) {
                $obj = @{}
                foreach ($col in $table.Columns) {
                    $obj[$col.ColumnName] = $row[$col]
                }
                $data += [PSCustomObject]$obj
            }
            
            Write-Success "Query executada: $($data.Count) registros"
            return $data
        }
        finally {
            $connection.Close()
        }
    }
    catch {
        Write-Error "Erro ao executar query SQLite: $($_.Exception.Message)"
        throw
    }
}

# ============================================
# EXPORTAÇÃO PARA EXCEL
# ============================================

function Export-ToExcel {
    param(
        [array]$Data,
        [hashtable]$Config
    )
    
    if ($Data.Count -eq 0) {
        Write-Warning "Nenhum dado para exportar"
        return $null
    }
    
    Write-Info "Exportando para Excel..."
    
    try {
        # Criar diretório se não existir
        if (-not (Test-Path $Config.OutputDirectory)) {
            New-Item -ItemType Directory -Path $Config.OutputDirectory -Force | Out-Null
        }
        
        # Gerar nome do arquivo com timestamp
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $fileName = "$($Config.FileName)_$timestamp.xlsx"
        $filePath = Join-Path $Config.OutputDirectory $fileName
        
        # Exportar dados
        $Data | Export-Excel `
            -Path $filePath `
            -WorksheetName $Config.SheetName `
            -AutoSize `
            -AutoFilter `
            -FreezeTopRow `
            -BoldTopRow `
            -ErrorAction Stop
        
        if ($Config.ApplyFormatting) {
            try {
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
            catch {
                Write-Warning "Erro ao aplicar formatação: $($_.Exception.Message)"
                # Não falhar se formatação der erro
            }
        }
        
        $fileInfo = Get-Item $filePath
        Write-Success "Arquivo criado: $filePath ($([math]::Round($fileInfo.Length / 1KB, 2)) KB)"
        
        return $filePath
    }
    catch {
        Write-Error "Erro ao exportar para Excel: $($_.Exception.Message)"
        throw
    }
}

# ============================================
# EXECUÇÃO PRINCIPAL
# ============================================

try {
    Write-ColorLog "========================================" "Cyan"
    Write-ColorLog "  Exportação Multi-Banco DB → Excel" "Cyan"
    Write-ColorLog "========================================" "Cyan"
    Write-ColorLog ""
    
    # Validar provider
    if (-not $DatabaseConfigs.ContainsKey($Provider)) {
        Write-Error "Provider não encontrado: $Provider"
        Write-Info "Providers disponíveis: $($DatabaseConfigs.Keys -join ', ')"
        exit 1
    }
    
    # Instalar módulo necessário
    if (-not (Install-RequiredModule)) {
        Write-Error "Falha ao instalar módulo ImportExcel"
        exit 1
    }
    
    # Obter configuração
    $dbConfig = $DatabaseConfigs[$Provider]
    $defaultQuery = $DefaultQueries[$Provider]
    
    # Determinar query e arquivo
    $query = if ($Query) { $Query } else { $defaultQuery }
    $fileName = if ($OutputFile) { $OutputFile } else { "$($ExportConfig.FileName)_$($Provider.ToLower())" }
    $ExportConfig.FileName = $fileName
    
    # Conectar ao banco
    $connection = Connect-Database -Provider $Provider -Config $dbConfig
    
    # Executar query
    $data = Invoke-Query -Connection $connection -Query $query
    
    # Exportar para Excel
    if ($data.Count -gt 0) {
        $filePath = Export-ToExcel -Data $data -Config $ExportConfig
        Write-ColorLog ""
        Write-ColorLog "========================================" "Green"
        Write-ColorLog "  Exportação concluída com sucesso!" "Green"
        Write-ColorLog "========================================" "Green"
        Write-Info "Arquivo: $filePath"
        Write-Info "Registros: $($data.Count)"
        Write-Info "Provider: $Provider"
    }
    else {
        Write-Warning "Nenhum dado foi exportado."
    }
    
    exit 0
}
catch {
    Write-ColorLog ""
    Write-ColorLog "========================================" "Red"
    Write-ColorLog "  ERRO: $($_.Exception.Message)" "Red"
    Write-ColorLog "========================================" "Red"
    
    if ($_.Exception.InnerException) {
        Write-Error "Detalhes: $($_.Exception.InnerException.Message)"
    }
    
    Write-Info "Stack trace: $($_.ScriptStackTrace)"
    
    exit 1
}
finally {
    # Limpar variáveis de ambiente
    if ($env:PGPASSWORD) {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
}

