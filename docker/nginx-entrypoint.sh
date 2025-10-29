#!/bin/sh
# Smart Signage Pro v2.0 - Entrypoint para Nginx no Frontend
# Garante que a configuração correta seja usada e não a página padrão

set -e

echo "🔧 [Nginx Entrypoint] Inicializando..."

# 1. Garantir que default.conf NÃO existe (força remoção)
echo "🗑️  [Nginx Entrypoint] Removendo configurações padrão..."
rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
rm -rf /etc/nginx/conf.d/*.conf 2>/dev/null || true

# Remover QUALQUER arquivo HTML padrão do Nginx que possa estar presente
find /usr/share/nginx/html -name "*.html" -exec grep -l "Welcome to nginx" {} \; 2>/dev/null | while read file; do
    if [ "$file" != "/usr/share/nginx/html/index.html" ]; then
        echo "🗑️  [Nginx Entrypoint] Removendo arquivo padrão: $file"
        rm -f "$file"
    fi
done

# 2. Verificar que nossa configuração existe
if [ ! -f /etc/nginx/nginx.conf ]; then
    echo "❌ [Nginx Entrypoint] ERRO: /etc/nginx/nginx.conf não encontrado!"
    exit 1
fi

echo "✅ [Nginx Entrypoint] Configuração encontrada: /etc/nginx/nginx.conf"

# 3. Verificar que index.html existe e NÃO é a página padrão do Nginx
if [ ! -f /usr/share/nginx/html/index.html ]; then
    echo "❌ [Nginx Entrypoint] ERRO: index.html não encontrado em /usr/share/nginx/html/"
    exit 1
fi

# Verificar MÚLTIPLAS variações da página padrão do Nginx
if grep -qiE "(Welcome to nginx|nginx web server|nginx.org|nginx.com)" /usr/share/nginx/html/index.html 2>/dev/null; then
    echo "❌ [Nginx Entrypoint] ERRO: index.html ainda é a página padrão do Nginx!"
    echo "❌ [Nginx Entrypoint] Primeiras linhas do arquivo:"
    head -5 /usr/share/nginx/html/index.html 2>/dev/null || true
    echo "❌ [Nginx Entrypoint] O build do frontend não foi copiado corretamente!"
    echo "❌ [Nginx Entrypoint] Container NÃO será iniciado para evitar servir página errada!"
    exit 1
fi

# Verificar que index.html tem conteúdo do React (pelo menos deve ter <!doctype ou <html)
if ! grep -qiE "(<!doctype|<html|<div.*root|react)" /usr/share/nginx/html/index.html 2>/dev/null | head -1; then
    echo "⚠️  [Nginx Entrypoint] AVISO: index.html não parece ser um arquivo React válido"
    echo "   Primeiras linhas:"
    head -3 /usr/share/nginx/html/index.html 2>/dev/null || true
    echo "   Continuando, mas pode haver problemas..."
fi

echo "✅ [Nginx Entrypoint] index.html correto verificado"

# 4. Gerar configuração com portas parametrizadas
NGINX_PORT=${NGINX_PORT:-8080}
BACKEND_INTERNAL_PORT=${BACKEND_INTERNAL_PORT:-3000}
echo "⚙️  [Nginx Entrypoint] Aplicando NGINX_PORT=${NGINX_PORT} e BACKEND_INTERNAL_PORT=${BACKEND_INTERNAL_PORT}"
envsubst '${NGINX_PORT} ${BACKEND_INTERNAL_PORT}' < /etc/nginx/nginx.conf > /etc/nginx/nginx.conf.runtime

# 5. Testar configuração do Nginx
echo "🧪 [Nginx Entrypoint] Testando configuração do Nginx..."
nginx -t -c /etc/nginx/nginx.conf.runtime || {
    echo "❌ [Nginx Entrypoint] ERRO: Configuração do Nginx inválida!"
    nginx -t -c /etc/nginx/nginx.conf.runtime || true
    exit 1
}

echo "✅ [Nginx Entrypoint] Configuração do Nginx válida"

# 5. Verificar que NÃO há arquivos padrão do Nginx
echo "🔍 [Nginx Entrypoint] Verificando arquivos padrão do Nginx..."
if [ -f /etc/nginx/conf.d/default.conf ]; then
    echo "⚠️  [Nginx Entrypoint] AVISO: default.conf ainda existe! Tentando remover novamente..."
    rm -f /etc/nginx/conf.d/default.conf
fi

# 6. Mostrar configuração ativa
echo "📋 [Nginx Entrypoint] Configurações ativas:"
echo "   - Main config: /etc/nginx/nginx.conf"
echo "   - Conf.d files: $(ls -1 /etc/nginx/conf.d/*.conf 2>/dev/null | wc -l)"
echo "   - Root: /usr/share/nginx/html"
if [ -f /usr/share/nginx/html/index.html ]; then
    INDEX_SIZE=$(stat -c%s /usr/share/nginx/html/index.html 2>/dev/null || echo "N/A")
    INDEX_LINES=$(wc -l < /usr/share/nginx/html/index.html 2>/dev/null || echo "N/A")
    echo "   - Index: ${INDEX_SIZE} bytes, ${INDEX_LINES} linhas"
    echo "   - Index preview: $(head -1 /usr/share/nginx/html/index.html | cut -c1-50)..."
else
    echo "   - Index: ❌ NÃO ENCONTRADO!"
fi

# 7. Iniciar Nginx com config gerada
echo "🚀 [Nginx Entrypoint] Iniciando Nginx (porta ${NGINX_PORT})..."
exec nginx -c /etc/nginx/nginx.conf.runtime -g "daemon off;"

