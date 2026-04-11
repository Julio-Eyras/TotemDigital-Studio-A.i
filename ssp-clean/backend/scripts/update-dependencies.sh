#!/bin/bash
# Script para atualizar dependências de forma segura
# Smart Signage Pro v3.1

echo "🔍 Verificando dependências desatualizadas..."
npm outdated

echo ""
echo "📦 Atualizando dependências menores (patch e minor)..."
npm update

echo ""
echo "🔒 Executando npm audit fix..."
npm audit fix

echo ""
echo "✅ Dependências atualizadas!"
echo ""
echo "⚠️  ATENÇÃO: Verifique se não há breaking changes nas dependências atualizadas"
echo "⚠️  Execute os testes após a atualização: npm test"

