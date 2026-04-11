#!/bin/bash

# Script para corrigir métodos Prisma no código
# Execute no servidor Ubuntu

echo "🔧 Corrigindo métodos Prisma no código..."

INSTALL_DIR="/opt/smart-signage"

# Verificar se estamos no diretório correto
if [[ ! -d "$INSTALL_DIR" ]]; then
    echo "❌ Diretório de instalação não encontrado: $INSTALL_DIR"
    exit 1
fi

cd "$INSTALL_DIR"

# Fazer backup do código
echo "💾 Fazendo backup do código backend..."
cp -r backend backend.backup

# Corrigir métodos Prisma em todos os arquivos TypeScript
echo "🔄 Corrigindo métodos Prisma..."

# Substituir queryOne por findFirst
find backend/src -name "*.ts" -exec sed -i 's/\.queryOne(/\.findFirst(/g' {} \;

# Substituir query por findMany
find backend/src -name "*.ts" -exec sed -i 's/\.query(/\.findMany(/g' {} \;

# Substituir execute por executeRaw
find backend/src -name "*.ts" -exec sed -i 's/\.execute(/\.executeRaw(/g' {} \;

echo "✅ Métodos Prisma corrigidos!"

# Parar containers
echo "🛑 Parando containers..."
docker compose down

# Reconstruir backend com correções
echo "🔄 Reconstruindo backend com correções..."
docker compose build --no-cache backend

# Verificar se a imagem foi construída
if docker images | grep -q "smart-signage-backend"; then
    echo "✅ Imagem backend reconstruída com sucesso"
else
    echo "❌ Erro ao reconstruir imagem backend"
    exit 1
fi

# Iniciar serviços
echo "🚀 Iniciando serviços..."
docker compose up -d postgres redis ollama
sleep 15

echo "🚀 Iniciando backend..."
docker compose up -d backend
sleep 20

# Verificar se o backend está funcionando
echo "🔍 Verificando backend..."
for i in {1..6}; do
    if curl -s -f http://localhost:3000/health > /dev/null; then
        echo "✅ Backend funcionando!"
        
        # Iniciar frontend e nginx
        echo "🚀 Iniciando frontend e nginx..."
        docker compose up -d frontend nginx
        
        echo "🎉 Sistema corrigido e funcionando!"
        echo ""
        echo "📋 Status dos containers:"
        docker compose ps
        echo ""
        echo "🌐 URLs de acesso:"
        echo "   - Frontend: http://$(hostname -I | awk '{print $1}')"
        echo "   - Backend API: http://$(hostname -I | awk '{print $1}'):3000"
        echo "   - Player: http://$(hostname -I | awk '{print $1}'):3000/player"
        exit 0
    else
        echo "⏳ Aguardando backend... ($i/6)"
        sleep 10
    fi
done

echo "❌ Backend ainda não está funcionando após 1 minuto"
echo "📋 Logs do backend:"
docker compose logs --tail 30 backend
