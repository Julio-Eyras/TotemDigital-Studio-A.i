#!/bin/bash
# Script para criar pacote distribuível

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

APP_ID=$(grep '"id"' appinfo.json | cut -d'"' -f4)
VERSION=$(grep '"version"' appinfo.json | cut -d'"' -f4)
PACKAGE_NAME="${APP_ID}_${VERSION}"

echo "📦 Criando pacote: $PACKAGE_NAME"

# Criar diretório temporário
TEMP_DIR=$(mktemp -d)
PACKAGE_DIR="$TEMP_DIR/$PACKAGE_NAME"

mkdir -p "$PACKAGE_DIR"

# Copiar arquivos necessários
echo "📋 Copiando arquivos..."
cp -r js "$PACKAGE_DIR/"
cp -r config "$PACKAGE_DIR/" 2>/dev/null || true
cp appinfo.json "$PACKAGE_DIR/"
cp index.html "$PACKAGE_DIR/"
cp styles.css "$PACKAGE_DIR/"
cp README.md "$PACKAGE_DIR/" 2>/dev/null || true
cp .gitignore "$PACKAGE_DIR/" 2>/dev/null || true

# Nota sobre ícone
if [ ! -f "icon.png" ]; then
    echo "⚠️  Aviso: icon.png não encontrado"
    echo "   Crie um ícone 128x128 PNG para o app"
fi

# Criar arquivo ZIP
cd "$TEMP_DIR"
zip -r "${PACKAGE_NAME}.zip" "$PACKAGE_NAME" > /dev/null

# Mover para diretório do projeto
mv "${PACKAGE_NAME}.zip" "$PROJECT_DIR/"

# Limpar
rm -rf "$TEMP_DIR"

echo "✅ Pacote criado: ${PACKAGE_NAME}.zip"

