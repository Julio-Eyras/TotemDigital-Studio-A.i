# Smart Signage Pro - Script para Limpar Cache (Backend + Frontend) - Windows
# Limpa todos os caches sem recompilar

$ErrorActionPreference = "Continue"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🧹 LIMPEZA DE CACHE" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

Set-Location "$PSScriptRoot\.."

$cleaned = $false

# Backend
Write-Host "📦 Backend:" -ForegroundColor Yellow

if (Test-Path "backend\node_modules\.cache") {
    Remove-Item "backend\node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Cache do node_modules removido" -ForegroundColor Green
    $cleaned = $true
}

Get-ChildItem "backend\*.tsbuildinfo" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Cache TypeScript removido: $($_.Name)" -ForegroundColor Green
    $cleaned = $true
}

# Frontend
Write-Host ""
Write-Host "📦 Frontend:" -ForegroundColor Yellow

if (Test-Path "frontend\node_modules\.cache") {
    Remove-Item "frontend\node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Cache do webpack/react removido" -ForegroundColor Green
    $cleaned = $true
}

if (Test-Path "frontend\.cache") {
    Remove-Item "frontend\.cache" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Cache do React removido" -ForegroundColor Green
    $cleaned = $true
}

if (Test-Path "frontend\.eslintcache") {
    Remove-Item "frontend\.eslintcache" -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Cache do ESLint removido" -ForegroundColor Green
    $cleaned = $true
}

# Cache do webpack em node_modules (múltiplos locais)
Get-ChildItem "frontend\node_modules" -Recurse -Directory -Filter ".cache" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Cache do webpack removido: $($_.FullName)" -ForegroundColor Green
    $cleaned = $true
}

# Cache do npm
Write-Host ""
Write-Host "📦 NPM Cache:" -ForegroundColor Yellow
npm cache clean --force 2>$null | Out-Null
Write-Host "   ✅ Cache do npm limpo" -ForegroundColor Green
$cleaned = $true

Write-Host ""
if ($cleaned) {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "✅ CACHE LIMPO COM SUCESSO!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
} else {
    Write-Host "ℹ️  Nenhum cache encontrado para limpar" -ForegroundColor Gray
}
Write-Host ""
