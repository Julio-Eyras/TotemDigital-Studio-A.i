#!/bin/bash

# Script para corrigir o Dockerfile.backend com Prisma
# Execute no servidor Ubuntu

echo "🔧 Corrigindo Dockerfile.backend para incluir Prisma..."

INSTALL_DIR="/opt/smart-signage"

# Verificar se estamos no diretório correto
if [[ ! -d "$INSTALL_DIR" ]]; then
    echo "❌ Diretório de instalação não encontrado: $INSTALL_DIR"
    exit 1
fi

cd "$INSTALL_DIR"

# Fazer backup do Dockerfile atual
echo "💾 Fazendo backup do Dockerfile.backend..."
cp Dockerfile.backend Dockerfile.backend.backup

# Parar containers
echo "🛑 Parando containers..."
docker compose down

# Reconstruir apenas o backend com a correção
echo "🔄 Reconstruindo backend com Prisma..."
docker compose build --no-cache backend

# Iniciar serviços na ordem correta
echo "🚀 Iniciando serviços..."
docker compose up -d postgres redis ollama
sleep 10

echo "🚀 Iniciando backend..."
docker compose up -d backend
sleep 15

# Verificar se o backend está funcionando
echo "🔍 Verificando backend..."
if curl -s -f http://localhost:3000/health > /dev/null; then
    echo "✅ Backend funcionando!"
    
    # Iniciar frontend e nginx
    echo "🚀 Iniciando frontend e nginx..."
    docker compose up -d frontend nginx
    
    echo "🎉 Sistema corrigido e funcionando!"
    echo ""
    echo "📋 Status dos containers:"
    docker compose ps
else
    echo "❌ Backend ainda não está funcionando"
    echo "📋 Logs do backend:"
    docker compose logs --tail 20 backend
fi
