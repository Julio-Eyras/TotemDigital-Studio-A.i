#!/bin/bash
# Script para iniciar o sistema localmente em modo desenvolvimento
# Uso: ./scripts/start-local-dev.sh

echo "==============================================="
echo "  Smart Signage Pro - Modo Desenvolvimento"
echo "==============================================="
echo ""

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale Node.js 18+ primeiro."
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js encontrado: $NODE_VERSION"
echo ""

# Verificar configuração
echo "📋 Verificando configuração..."

# Verificar arquivo .env no backend
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Arquivo backend/.env não encontrado!"
    echo "   Copiando .env.example para .env..."
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
        echo "   ✅ Arquivo .env criado. Configure as variáveis necessárias."
    else
        echo "   ❌ Arquivo .env.example não encontrado!"
    fi
fi

# Verificar se as dependências estão instaladas
echo ""
echo "📦 Verificando dependências..."

if [ ! -d "backend/node_modules" ]; then
    echo "   📥 Instalando dependências do backend..."
    cd backend
    npm install
    cd ..
    echo "   ✅ Dependências do backend instaladas"
else
    echo "   ✅ Dependências do backend OK"
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "   📥 Instalando dependências do frontend..."
    cd frontend
    npm install
    cd ..
    echo "   ✅ Dependências do frontend instaladas"
else
    echo "   ✅ Dependências do frontend OK"
fi

echo ""
echo "🚀 Iniciando serviços..."
echo ""

# Função para limpar processos ao sair
cleanup() {
    echo ""
    echo "🛑 Parando serviços..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Iniciar backend em background
echo "   📡 Iniciando Backend (porta 3000)..."
cd backend
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Aguardar alguns segundos
sleep 3

# Iniciar frontend em background
echo "   🎨 Iniciando Frontend (porta 3001)..."
cd frontend
npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo ""
echo "==============================================="
echo "  Serviços iniciados!"
echo "==============================================="
echo ""
echo "📍 Acessos:"
echo "   Backend API:  http://localhost:3000"
echo "   Frontend:     http://localhost:3001"
echo "   API Docs:     http://localhost:3000/api-docs"
echo ""
echo "📋 Logs:"
echo "   Backend:  tail -f logs/backend.log"
echo "   Frontend: tail -f logs/frontend.log"
echo ""
echo "💡 Pressione Ctrl+C para parar os serviços"
echo ""

# Criar diretório de logs se não existir
mkdir -p logs

# Aguardar
wait
