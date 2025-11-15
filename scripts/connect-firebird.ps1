# Script PowerShell para conectar ao Firebird usando isql
# Uso: .\connect-firebird.ps1 [-Server <host>] [-Database <database>] [-User <user>] [-Password <password>]

param(
    [string]$Server = "localhost",
    [string]$Database = "C:\path\to\database.fdb",
    [string]$User = "SYSDBA",
    [string]$Password = "masterkey",
    [int]$Port = 3050
)

# Verificar se o isql está disponível
$isqlPath = Get-Command isql -ErrorAction SilentlyContinue
if (-not $isqlPath) {
    Write-Host "❌ Erro: isql não encontrado no PATH" -ForegroundColor Red
    Write-Host "💡 Instale o Firebird Client Tools ou adicione ao PATH" -ForegroundColor Yellow
    exit 1
}

# Construir string de conexão
if ($Database -match "^[A-Z]:") {
    # Caminho local (Windows)
    $connectionString = "$Database"
} else {
    # Conexão remota
    $connectionString = "$Server/$Port`:$Database"
}

Write-Host "🔌 Conectando ao Firebird..." -ForegroundColor Cyan
Write-Host "   Servidor: $Server" -ForegroundColor Gray
Write-Host "   Porta: $Port" -ForegroundColor Gray
Write-Host "   Database: $Database" -ForegroundColor Gray
Write-Host "   Usuário: $User" -ForegroundColor Gray
Write-Host ""

# Comando isql
$isqlCommand = "isql -user $User -password $Password `"$connectionString`""

Write-Host "📝 Executando: $isqlCommand" -ForegroundColor Yellow
Write-Host ""

# Executar isql interativamente
Invoke-Expression $isqlCommand

