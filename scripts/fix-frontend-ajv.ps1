# Script para corrigir problema do ajv no frontend
Write-Host "Corrigindo problema do ajv no frontend..." -ForegroundColor Yellow

cd frontend

# Criar diretório refs se não existir
$refsPath = "node_modules\ajv\lib\refs"
if (-not (Test-Path $refsPath)) {
    New-Item -ItemType Directory -Path $refsPath -Force | Out-Null
    Write-Host "Diretório refs criado" -ForegroundColor Green
}

# Criar arquivo json-schema-draft-04.json
$targetFile = Join-Path $refsPath "json-schema-draft-04.json"
if (-not (Test-Path $targetFile)) {
    $content = '{"$schema":"http://json-schema.org/draft-04/schema#","id":"http://json-schema.org/draft-04/schema#"}'
    $content | Out-File -FilePath $targetFile -Encoding UTF8 -NoNewline
    Write-Host "Arquivo json-schema-draft-04.json criado" -ForegroundColor Green
} else {
    Write-Host "Arquivo já existe" -ForegroundColor Gray
}

# Limpar cache
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
Write-Host "Cache limpo" -ForegroundColor Green

cd ..
Write-Host "✅ Correção aplicada!" -ForegroundColor Green

