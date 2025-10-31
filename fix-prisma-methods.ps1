# Script PowerShell para corrigir métodos Prisma
# Execute no Windows PowerShell

Write-Host "🔧 Corrigindo métodos Prisma no código..." -ForegroundColor Green

# Encontrar todos os arquivos TypeScript
$files = Get-ChildItem -Path "backend\src" -Filter "*.ts" -Recurse

Write-Host "📁 Encontrados $($files.Count) arquivos TypeScript" -ForegroundColor Blue

$totalReplacements = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Substituir queryOne por findFirst
    $content = $content -replace '\.queryOne\(', '.findFirst('
    
    # Substituir query por findMany
    $content = $content -replace '\.query\(', '.findMany('
    
    # Substituir execute por executeRaw
    $content = $content -replace '\.execute\(', '.executeRaw('
    
    # Contar substituições
    $replacements = 0
    if ($content -ne $originalContent) {
        $replacements = ([regex]::Matches($originalContent, '\.queryOne\(')).Count + 
                       ([regex]::Matches($originalContent, '\.query\(')).Count + 
                       ([regex]::Matches($originalContent, '\.execute\(')).Count
        $totalReplacements += $replacements
        
        # Salvar arquivo modificado
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "✅ $($file.Name): $replacements substituições" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎉 Correção concluída!" -ForegroundColor Green
Write-Host "📊 Total de substituições: $totalReplacements" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Métodos corrigidos:" -ForegroundColor Blue
Write-Host "   - queryOne() → findFirst()" -ForegroundColor White
Write-Host "   - query() → findMany()" -ForegroundColor White  
Write-Host "   - execute() → executeRaw()" -ForegroundColor White
Write-Host ""
Write-Host "✅ Futuras instalações funcionarão automaticamente!" -ForegroundColor Green
