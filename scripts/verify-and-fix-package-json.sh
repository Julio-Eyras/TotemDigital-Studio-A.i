#!/bin/bash
# Script para verificar e corrigir package.json do frontend
# Uso: ./scripts/verify-and-fix-package-json.sh

set -e

FRONTEND_DIR="frontend"
PACKAGE_JSON="$FRONTEND_DIR/package.json"

echo "🔍 Verificando package.json do frontend..."

if [ ! -f "$PACKAGE_JSON" ]; then
    echo "❌ Erro: package.json não encontrado em $FRONTEND_DIR"
    exit 1
fi

# Verificar se há referências à versão antiga
if grep -q "8.17.1" "$PACKAGE_JSON"; then
    echo "⚠️  Versão antiga (8.17.1) encontrada no package.json!"
    echo "📝 Corrigindo para versão correta (8.12.0)..."
    
    # Substituir todas as ocorrências de 8.17.1 por 8.12.0
    sed -i 's/8\.17\.1/8.12.0/g' "$PACKAGE_JSON"
    
    echo "✅ package.json corrigido!"
else
    echo "✅ Nenhuma referência à versão antiga encontrada"
fi

# Verificar versões corretas
echo ""
echo "📋 Versões configuradas no package.json:"
echo "   Overrides:"
grep -A 3 '"overrides"' "$PACKAGE_JSON" | grep "ajv" || echo "     (não encontrado)"
echo "   DevDependencies:"
grep -A 1 '"ajv"' "$PACKAGE_JSON" | grep "ajv" || echo "     (não encontrado)"

echo ""
echo "🧹 Limpando node_modules e package-lock.json..."
cd "$FRONTEND_DIR"
rm -rf node_modules package-lock.json .npm

echo "🧹 Limpando cache do npm..."
npm cache clean --force

echo ""
echo "✅ Limpeza concluída!"
echo "📥 Execute agora: npm install --legacy-peer-deps"

