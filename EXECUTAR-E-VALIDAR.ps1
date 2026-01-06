# ============================================
# Smart Signage Pro - Executar e Validar Sistema Completo
# Windows PowerShell
# ============================================
# Este script:
# 1. Executa o sistema completo (backend + frontend + banco)
# 2. Valida automaticamente todos os componentes
# 3. Gera relatório de validação
# ============================================

$ErrorActionPreference = "Continue"
$ProgressPreference = "Continue"

# Cores para output
function Write-ColorOutput($ForegroundColor, $Message) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    Write-Output $Message
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Header($text) {
    Write-ColorOutput Cyan "========================================"
    Write-ColorOutput Cyan $text
    Write-ColorOutput Cyan "========================================"
    Write-Host ""
}

function Write-Success($text) {
    Write-ColorOutput Green "[OK] $text"
}

function Write-Error-Custom($text) {
    Write-ColorOutput Red "[ERRO] $text"
}

function Write-Info($text) {
    Write-ColorOutput Gray "  $text"
}

Write-Header "Smart Signage Pro - Executar e Validar Sistema"

# Verificar se o script de validação existe
$validationScript = Join-Path $PSScriptRoot "VALIDAR-SISTEMA.ps1"
if (-not (Test-Path $validationScript)) {
    Write-Error-Custom "Script de validacao nao encontrado: $validationScript"
    exit 1
}

# Executar script de validação
Write-Info "Executando validacao completa do sistema..."
Write-Host ""

& $validationScript

# Verificar resultado
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Success "Processo concluido!"
} else {
    Write-Host ""
    Write-Error-Custom "Processo concluido com erros (codigo: $LASTEXITCODE)"
    exit $LASTEXITCODE
}

