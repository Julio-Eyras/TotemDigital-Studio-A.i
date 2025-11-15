#!/bin/bash
# Script para corrigir dependências do frontend após atualização do package.json
# Uso: ./scripts/fix-frontend-dependencies.sh

set -e

echo "🔧 Corrigindo dependências do frontend..."

cd "$(dirname "$0")/../frontend" || exit 1

echo "📦 Limpando node_modules e package-lock.json..."
rm -rf node_modules package-lock.json

echo "🧹 Limpando cache do npm..."
npm cache clean --force

echo "📥 Reinstalando dependências com versões corretas..."
npm install --legacy-peer-deps

echo "✅ Dependências corrigidas com sucesso!"
echo ""
echo "📋 Versões instaladas:"
npm list ajv ajv-keywords 2>/dev/null | grep -E "(ajv|ajv-keywords)" || echo "Verificando..."

