#!/bin/bash

# Script para corrigir definitivamente o Prisma no backend
# Execute no servidor Ubuntu

echo "🔧 Correção definitiva do Prisma no backend..."

INSTALL_DIR="/opt/smart-signage"

# Verificar se estamos no diretório correto
if [[ ! -d "$INSTALL_DIR" ]]; then
    echo "❌ Diretório de instalação não encontrado: $INSTALL_DIR"
    exit 1
fi

cd "$INSTALL_DIR"

# Verificar se o Dockerfile.backend foi atualizado
if grep -q "npx prisma generate" Dockerfile.backend; then
    echo "✅ Dockerfile.backend já contém a correção do Prisma"
else
    echo "❌ Dockerfile.backend não contém a correção. Copiando versão atualizada..."
    
    # Copiar Dockerfile.backend atualizado do projeto
    if [[ -f "/home/smartchannel/SmartSignage-Pro/Dockerfile.backend" ]]; then
        cp "/home/smartchannel/SmartSignage-Pro/Dockerfile.backend" .
        echo "✅ Dockerfile.backend atualizado copiado"
    else
        echo "❌ Não foi possível encontrar Dockerfile.backend atualizado"
        exit 1
    fi
fi

# Parar containers
echo "🛑 Parando containers..."
docker compose down

# Remover imagem antiga
echo "🗑️ Removendo imagem backend antiga..."
docker rmi smart-signage-backend 2>/dev/null || true

# Reconstruir backend com correção definitiva
echo "🔄 Reconstruindo backend com correção definitiva do Prisma..."
docker compose build --no-cache backend

# Verificar se a imagem foi construída corretamente
if docker images | grep -q "smart-signage-backend"; then
    echo "✅ Imagem backend reconstruída com sucesso"
else
    echo "❌ Erro ao reconstruir imagem backend"
    exit 1
fi

# Iniciar serviços na ordem correta
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
echo ""
echo "💡 Execute 'docker compose logs -f backend' para ver logs em tempo real"
