#!/bin/bash
# Script para forçar atualização do package.json do Git e corrigir versões
# Uso: ./scripts/force-update-package-json.sh

set -e

FRONTEND_DIR="frontend"
PACKAGE_JSON="$FRONTEND_DIR/package.json"

echo "🔄 Forçando atualização do package.json do Git..."

# Verificar se estamos no diretório raiz do projeto
if [ ! -f "install-smartsignage.sh" ]; then
    echo "❌ Execute este script do diretório raiz do projeto"
    exit 1
fi

# 1. Descartar mudanças locais no package.json (se houver)
echo "📦 Descartando mudanças locais no package.json..."
cd "$FRONTEND_DIR"
git checkout -- package.json 2>/dev/null || true

# 2. Puxar última versão do Git
echo "📥 Puxando última versão do Git..."
cd ..
git pull origin main || {
    echo "⚠️  Não foi possível puxar do Git. Continuando com versão local..."
}

# 3. Verificar se package.json existe
if [ ! -f "$PACKAGE_JSON" ]; then
    echo "❌ package.json não encontrado em $FRONTEND_DIR"
    exit 1
fi

# 4. Verificar e corrigir versões
echo "🔍 Verificando versões no package.json..."

HAS_OLD_VERSION=false

# Verificar versão 8.17.1
if grep -q "8\.17\.1" "$PACKAGE_JSON"; then
    echo "⚠️  Versão antiga (8.17.1) encontrada - corrigindo..."
    sed -i 's/8\.17\.1/8.12.0/g' "$PACKAGE_JSON"
    HAS_OLD_VERSION=true
fi

# Verificar versão 5.1.0 do ajv-keywords
if grep -q "5\.1\.0" "$PACKAGE_JSON"; then
    echo "⚠️  Versão antiga do ajv-keywords (5.1.0) encontrada - corrigindo..."
    sed -i 's/5\.1\.0/3.5.2/g' "$PACKAGE_JSON"
    HAS_OLD_VERSION=true
fi

# Verificar padrões ^5.x
if grep -q '"ajv-keywords":\s*"\^5\.' "$PACKAGE_JSON"; then
    echo "⚠️  Padrão ^5.x encontrado - corrigindo..."
    sed -i 's/"ajv-keywords":\s*"\^5\./"ajv-keywords": "^3.5./g' "$PACKAGE_JSON"
    HAS_OLD_VERSION=true
fi

# 5. Verificar versões corretas
echo ""
echo "📋 Versões configuradas:"
echo "   Overrides:"
grep -A 3 '"overrides"' "$PACKAGE_JSON" | grep -E "(ajv|ajv-keywords)" || echo "     (não encontrado)"
echo "   DevDependencies:"
grep -A 1 '"ajv"' "$PACKAGE_JSON" | grep -E "(ajv|ajv-keywords)" || echo "     (não encontrado)"

# 6. Verificar se ainda há problemas
if grep -q "8\.17\.1" "$PACKAGE_JSON"; then
    echo ""
    echo "❌ ERRO: Versão 8.17.1 ainda presente após correção!"
    echo "Conteúdo do package.json (overrides):"
    grep -A 5 '"overrides"' "$PACKAGE_JSON" || true
    exit 1
fi

if [ "$HAS_OLD_VERSION" = true ]; then
    echo ""
    echo "✅ package.json corrigido!"
    echo "💡 Considere commitar as alterações:"
    echo "   git add $PACKAGE_JSON"
    echo "   git commit -m 'fix: Corrigir versões do ajv e ajv-keywords'"
else
    echo ""
    echo "✅ package.json já está correto!"
fi

echo ""
echo "✅ Validação concluída!"

