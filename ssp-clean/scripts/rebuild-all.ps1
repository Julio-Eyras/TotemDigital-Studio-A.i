# Smart Signage Pro - Script para Rebuild Completo (Backend + Frontend) - Windows
# Limpa cache, recompila tudo e reinicia serviços

$ErrorActionPreference = "Stop"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🔄 REBUILD COMPLETO - BACKEND + FRONTEND" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

Set-Location "$PSScriptRoot\.."

# Executar rebuild do backend
Write-Host "▶️  Executando rebuild do backend..." -ForegroundColor Magenta
Write-Host ""
& "$PSScriptRoot\rebuild-backend.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Erro ao fazer rebuild do backend!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Executar rebuild do frontend
Write-Host "▶️  Executando rebuild do frontend..." -ForegroundColor Magenta
Write-Host ""
& "$PSScriptRoot\rebuild-frontend.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Erro ao fazer rebuild do frontend!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ REBUILD COMPLETO CONCLUÍDO!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 RESUMO:" -ForegroundColor Blue
Write-Host "   • Backend: ✅ Recompilado e reiniciado" -ForegroundColor White
Write-Host "   • Frontend: ✅ Recompilado" -ForegroundColor White
Write-Host ""
Write-Host "🌐 URLs:" -ForegroundColor Blue
Write-Host "   • Backend API: http://localhost:3000" -ForegroundColor White
Write-Host "   • Frontend Build: frontend\build\" -ForegroundColor White
Write-Host ""
