#!/bin/sh
# Smart Signage Pro v2.0 - Entrypoint para Nginx no Frontend
# Garante que a configuração correta seja usada e não a página padrão

set -e

echo "🔧 [Nginx Entrypoint] Inicializando..."

# 1. Garantir que default.conf NÃO existe (força remoção)
echo "🗑️  [Nginx Entrypoint] Removendo configurações padrão..."
rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
rm -f /etc/nginx/conf.d/*.conf 2>/dev/null || true

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

if grep -q "Welcome to nginx" /usr/share/nginx/html/index.html 2>/dev/null; then
    echo "❌ [Nginx Entrypoint] ERRO: index.html ainda é a página padrão do Nginx!"
    echo "❌ [Nginx Entrypoint] O build do frontend não foi copiado corretamente!"
    exit 1
fi

echo "✅ [Nginx Entrypoint] index.html correto verificado"

# 4. Testar configuração do Nginx
echo "🧪 [Nginx Entrypoint] Testando configuração do Nginx..."
nginx -t || {
    echo "❌ [Nginx Entrypoint] ERRO: Configuração do Nginx inválida!"
    nginx -t
    exit 1
}

echo "✅ [Nginx Entrypoint] Configuração do Nginx válida"

# 5. Mostrar configuração ativa
echo "📋 [Nginx Entrypoint] Configurações ativas:"
echo "   - Main config: /etc/nginx/nginx.conf"
echo "   - Conf.d: $(ls -la /etc/nginx/conf.d/ 2>/dev/null | wc -l) arquivos"
echo "   - Root: /usr/share/nginx/html"
echo "   - Index: $(ls -la /usr/share/nginx/html/index.html 2>/dev/null | awk '{print $5, $9}')"

# 6. Iniciar Nginx
echo "🚀 [Nginx Entrypoint] Iniciando Nginx..."
exec nginx -g "daemon off;"

