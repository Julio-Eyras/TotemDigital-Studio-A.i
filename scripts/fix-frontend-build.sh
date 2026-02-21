#!/bin/bash
# Script de correção rápida para o problema do index.html

echo "🔧 Corrigindo problema do index.html..."

# Verificar se estamos no diretório correto
if [ ! -f "frontend/public/index.html" ]; then
    echo "❌ Arquivo index.html não encontrado em frontend/public/"
    echo "📁 Listando conteúdo do diretório frontend/public/:"
    ls -la frontend/public/ 2>/dev/null || echo "Diretório frontend/public/ não existe"
    exit 1
fi

# Verificar se o diretório de instalação existe
INSTALL_DIR="/opt/smart-signage"
if [ ! -d "$INSTALL_DIR" ]; then
    echo "❌ Diretório de instalação não encontrado: $INSTALL_DIR"
    echo "Execute o script de instalação primeiro."
    exit 1
fi

# Copiar arquivos do frontend que podem estar faltando
echo "📁 Copiando arquivos do frontend..."
cp -r frontend/public/* "$INSTALL_DIR/frontend/public/" 2>/dev/null || echo "⚠️  Alguns arquivos podem não ter sido copiados"

# Verificar se o arquivo foi copiado
if [ -f "$INSTALL_DIR/frontend/public/index.html" ]; then
    echo "✅ Arquivo index.html copiado com sucesso!"
else
    echo "❌ Falha ao copiar index.html"
    echo "📁 Conteúdo do diretório de destino:"
    ls -la "$INSTALL_DIR/frontend/public/" 2>/dev/null || echo "Diretório não existe"
    exit 1
fi

# Tentar compilar o frontend novamente
echo "🔨 Tentando compilar o frontend novamente..."
cd "$INSTALL_DIR/frontend"
if npm run build; then
    echo "✅ Frontend compilado com sucesso!"
else
    echo "❌ Falha na compilação do frontend"
    exit 1
fi

echo "🎉 Correção concluída com sucesso!"
