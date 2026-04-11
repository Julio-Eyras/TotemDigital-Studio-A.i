#!/bin/bash

echo "========================================="
echo "DEBUG: Verificando arquivos necessários"
echo "========================================="

INSTALL_DIR="/opt/smart-signage"

cd $INSTALL_DIR

echo ""
echo "1. Verificando frontend/package.json:"
if [[ -f "frontend/package.json" ]]; then
    echo "✅ Existe"
    echo "Script de build:"
    grep '"build"' frontend/package.json
else
    echo "❌ NÃO EXISTE"
fi

echo ""
echo "2. Verificando backend/package.json:"
if [[ -f "backend/package.json" ]]; then
    echo "✅ Existe"
    echo "Script de build:"
    grep '"build"' backend/package.json
else
    echo "❌ NÃO EXISTE"
fi

echo ""
echo "3. Verificando Dockerfile.frontend:"
if [[ -f "Dockerfile.frontend" ]]; then
    echo "✅ Existe"
else
    echo "❌ NÃO EXISTE"
fi

echo ""
echo "4. Verificando Dockerfile.backend:"
if [[ -f "Dockerfile.backend" ]]; then
    echo "✅ Existe"
else
    echo "❌ NÃO EXISTE"
fi

echo ""
echo "5. Listando conteúdo do diretório frontend/:"
ls -la frontend/ 2>/dev/null || echo "Diretório não existe"

echo ""
echo "6. Listando conteúdo do diretório backend/:"
ls -la backend/ | head -20 2>/dev/null || echo "Diretório não existe"

echo ""
echo "========================================="
echo "Fim do debug"
echo "========================================="
