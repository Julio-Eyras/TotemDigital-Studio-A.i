<#
.SYNOPSIS
    Script de Exportação de Banco de Dados para Excel
.DESCRIPTION
    Exporta dados de banco de dados para planilhas Excel com formatação profissional.
    Suporta PostgreSQL, SQL Server, MySQL e SQLite.
.PARAMETER ConfigFile
    Caminho para arquivo de configuração JSON (padrão: config.json)
.PARAMETER QueryName
    Executar apenas query específica (opcional)
.PARAMETER OutputDir
    Sobrescrever diretório de saída (opcional)
.PARAMETER LogLevel
    Nível de log: Debug, Info, Warning, Error (opcional)
.PARAMETER NoFormatting
    Desabilitar formatação automática do Excel
.PARAMETER DryRun
    Executar sem salvar arquivos (apenas validar)
.PARAMETER Verbose
    Modo verbose (equivalente a LogLevel Debug)
.EXAMPLE
    .\Export-DbToExcel.ps1
    Executa todas as queries configuradas em config.json
.EXAMPLE
    .\Export-DbToExcel.ps1 -QueryName "totems_ativos"
    Executa apenas a query "totems_ativos"
.EXAMPLE
    .\Export-DbToExcel.ps1 -Verbose -OutputDir "C:\Exports"
    Executa com logs detalhados e diretório customizado
.NOTES
    Versão: 1.0
    Autor: Smart Signage Solutions
    Data: 2025-11-03
#>

[CmdletBinding()]
param(
    [string]$ConfigFile = "config.json",
    [string]$QueryName = "",
    [string]$OutputDir = "",
    [ValidateSet("Debug", "Info", "Warning", "Error")]
    [string]$LogLevel = "",
    [switch]$NoFormatting,
    [switch]$DryRun,
    [switch]$Verbose
)

# Importar módulos
$modulePath = Join-Path $PSScriptRoot "modules"
Import-Module (Join-Path $modulePath "Logger.psm1") -Force
Import-Module (Join-Path $modulePath "DatabaseConnection.psm1") -Force
Import-Module (Join-Path $modulePath "ExcelExport.psm1") -Force

# Variáveis globais
$script:Config = $null
$script:Statistics = @{
    Queries = @()
    Files = @()
    Summary = @{
        TotalQueries = 0
        SuccessQueries = 0
        FailedQueries = 0
        TotalRecords = 0
    }
}

<#
.SYNOPSIS
    Carrega e valida arquivo de configuração
#>
function Load-Configuration {
    param([string]$ConfigPath)

    Write-Log "Carregando configuração: $ConfigPath" "Info"

    if (-not (Test-Path $ConfigPath)) {
        throw "Arquivo de configuração não encontrado: $ConfigPath"
    }

    try {
        $content = Get-Content $ConfigPath -Raw -Encoding UTF8
        $config = $content | ConvertFrom-Json -AsHashtable

        # Validar estrutura
        Validate-Configuration -Config $config

        # Aplicar parâmetros de linha de comando
        if ($OutputDir) {
            $config.export.outputDirectory = $OutputDir
        }

        if ($LogLevel) {
            $config.logging.level = $LogLevel
        }
        elseif ($Verbose) {
            $config.logging.level = "Debug"
        }

        if (-not $config.logging) {
            $config.logging = @{
                level = "Info"
                logToFile = $true
                logDirectory = "./logs"
                maxLogFiles = 10
            }
        }

        $script:Config = $config
        Write-Success "Configuração carregada com sucesso"
    }
    catch {
        Write-Error "Erro ao carregar configuração: $($_.Exception.Message)"
        throw
    }
}

<#
.SYNOPSIS
    Valida estrutura da configuração
#>
function Validate-Configuration {
    param([hashtable]$Config)

    # Validar seção database
    if (-not $Config.database) {
        throw "Seção 'database' não encontrada na configuração"
    }

    $required = @("provider", "host", "port", "database", "username", "password")
    foreach ($field in $required) {
        if (-not $Config.database[$field]) {
            throw "Campo obrigatório 'database.$field' não encontrado"
        }
    }

    # Validar provider
    $validProviders = @("PostgreSQL", "SQLServer", "MySQL", "SQLite")
    if ($Config.database.provider -notin $validProviders) {
        throw "Provider inválido: $($Config.database.provider). Deve ser um dos: $($validProviders -join ', ')"
    }

    # Validar seção export
    if (-not $Config.export) {
        throw "Seção 'export' não encontrada na configuração"
    }

    if (-not $Config.export.outputDirectory) {
        throw "Campo obrigatório 'export.outputDirectory' não encontrado"
    }

    # Validar seção queries
    if (-not $Config.queries -or $Config.queries.Count -eq 0) {
        throw "Nenhuma query configurada. Adicione pelo menos uma query em 'queries'"
    }

    # Validar cada query
    $queryNames = @()
    foreach ($query in $Config.queries) {
        if (-not $query.name) {
            throw "Query sem nome (campo 'name' obrigatório)"
        }

        if ($query.name -in $queryNames) {
            throw "Query duplicada: $($query.name)"
        }
        $queryNames += $query.name

        if (-not $query.sql) {
            throw "Query '$($query.name)' sem SQL (campo 'sql' obrigatório)"
        }

        if (-not $query.sheetName) {
            throw "Query '$($query.name)' sem nome de planilha (campo 'sheetName' obrigatório)"
        }

        if (-not $query.fileName) {
            throw "Query '$($query.name)' sem nome de arquivo (campo 'fileName' obrigatório)"
        }
    }

    Write-Log "Validação de configuração concluída" "Debug"
}

<#
.SYNOPSIS
    Processa todas as queries configuradas
#>
function Process-Queries {
    Write-Log "Iniciando processamento de queries..." "Info"

    $queriesToProcess = $script:Config.queries

    # Filtrar por query específica se fornecido
    if ($QueryName) {
        $queriesToProcess = $script:Config.queries | Where-Object { $_.name -eq $QueryName }
        if ($queriesToProcess.Count -eq 0) {
            throw "Query não encontrada: $QueryName"
        }
        Write-Log "Executando apenas query: $QueryName" "Info"
    }

    # Filtrar apenas queries habilitadas
    $queriesToProcess = $queriesToProcess | Where-Object { 
        if ($_.enabled -ne $null) { $_.enabled } else { $true }
    }

    $script:Statistics.Summary.TotalQueries = $queriesToProcess.Count

    foreach ($query in $queriesToProcess) {
        Process-Query -Query $query
    }

    Write-Log "Processamento de queries concluído" "Info"
}

<#
.SYNOPSIS
    Processa uma query individual
#>
function Process-Query {
    param($Query)

    $startTime = Get-Date
    Write-Log "Processando query: $($Query.name)" "Info"
    
    if ($Query.description) {
        Write-Log "Descrição: $($Query.description)" "Debug"
    }

    try {
        # Executar query
        $timeout = if ($Query.timeout) { $Query.timeout } else { 60 }
        $data = Invoke-Query -Query $Query.sql -Parameters $Query.parameters -Timeout $timeout

        $duration = (Get-Date) - $startTime
        $recordCount = $data.Count

        Write-Success "Query executada: $recordCount registros em $([math]::Round($duration.TotalSeconds, 2))s"

        # Exportar para Excel (se não for dry-run)
        if (-not $DryRun) {
            $filePath = Get-ExportFileName `
                -BaseName $Query.fileName `
                -OutputDirectory $script:Config.export.outputDirectory `
                -DateFormat $script:Config.export.dateFormat `
                -CreateSubfolders $script:Config.export.createSubfolders

            $fileInfo = Export-ToExcel `
                -Data $data `
                -FilePath $filePath `
                -SheetName $Query.sheetName `
                -ApplyFormatting (-not $NoFormatting)

            $script:Statistics.Files += @{
                Name = $Query.fileName
                Path = $filePath
                Size = $fileInfo.Size
            }
        }
        else {
            Write-Log "Dry-run: arquivo não foi criado" "Debug"
        }

        # Registrar estatísticas
        $script:Statistics.Queries += @{
            Name = $Query.name
            Records = $recordCount
            Time = $duration.TotalSeconds
            Success = $true
        }

        $script:Statistics.Summary.SuccessQueries++
        $script:Statistics.Summary.TotalRecords += $recordCount
    }
    catch {
        $duration = (Get-Date) - $startTime
        Write-Error "Erro ao processar query '$($Query.name)': $($_.Exception.Message)"

        # Registrar falha
        $script:Statistics.Queries += @{
            Name = $Query.name
            Records = 0
            Time = $duration.TotalSeconds
            Success = $false
            Error = $_.Exception.Message
        }

        $script:Statistics.Summary.FailedQueries++
    }
}

<#
.SYNOPSIS
    Função principal
#>
function Main {
    try {
        # Carregar configuração
        Load-Configuration -ConfigPath $ConfigFile

        # Inicializar logger
        Initialize-Logger `
            -Level $script:Config.logging.level `
            -LogToFile $script:Config.logging.logToFile `
            -LogDirectory $script:Config.logging.logDirectory

        # Conectar ao banco de dados
        Connect-Database -Config $script:Config.database

        # Processar queries
        Process-Queries

        # Gerar relatório
        Write-Statistics -Statistics $script:Statistics

        # Fechar conexão
        Disconnect-Database

        # Fechar logger
        Close-Logger

        Write-Success "Exportação concluída com sucesso!"
        exit 0
    }
    catch {
        Write-Error "Erro fatal: $($_.Exception.Message)"
        Write-Error "Stack trace: $($_.ScriptStackTrace)"
        
        # Tentar fechar conexão mesmo em erro
        Disconnect-Database
        Close-Logger

        exit 1
    }
}

# Executar função principal
Main

