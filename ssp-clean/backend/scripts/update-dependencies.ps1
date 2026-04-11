# Script PowerShell para atualizar dependências de forma segura
# Smart Signage Pro v3.1

Write-Host "🔍 Verificando dependências desatualizadas..." -ForegroundColor Cyan
npm outdated

Write-Host ""
Write-Host "📦 Atualizando dependências menores (patch e minor)..." -ForegroundColor Cyan
npm update

Write-Host ""
Write-Host "🔒 Executando npm audit fix..." -ForegroundColor Cyan
npm audit fix

Write-Host ""
Write-Host "✅ Dependências atualizadas!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  ATENÇÃO: Verifique se não há breaking changes nas dependências atualizadas" -ForegroundColor Yellow
Write-Host "⚠️  Execute os testes após a atualização: npm test" -ForegroundColor Yellow

