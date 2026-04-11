#!/bin/bash
# Script de build para empacotar o app webOS

echo "📦 Building SmartSignage LG Player HLS..."

# Verificar se ares está instalado
if ! command -v ares-package &> /dev/null; then
    echo "❌ Erro: webOS CLI tools não encontradas"
    echo "   Instale o webOS SDK: https://webostv.developer.lge.com/"
    exit 1
fi

# Diretório do projeto
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# Verificar se appinfo.json existe
if [ ! -f "appinfo.json" ]; then
    echo "❌ Erro: appinfo.json não encontrado"
    exit 1
fi

# Criar .ipk
echo "📦 Criando pacote .ipk..."
ares-package .

if [ $? -eq 0 ]; then
    echo "✅ Build concluído com sucesso!"
    echo "📦 Arquivo .ipk criado no diretório atual"
else
    echo "❌ Erro ao criar pacote"
    exit 1
fi

