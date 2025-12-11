#!/bin/bash

# Script de diagnóstico para verificar status dos containers
# Execute este script no servidor Ubuntu

echo "🔍 Diagnóstico do Smart Signage Pro v2.0"
echo "========================================"

INSTALL_DIR="/opt/smart-signage"

# Verificar se estamos no diretório correto
if [[ ! -d "$INSTALL_DIR" ]]; then
    echo "❌ Diretório de instalação não encontrado: $INSTALL_DIR"
    exit 1
fi

cd "$INSTALL_DIR"

echo ""
echo "📊 Status dos Containers:"
echo "------------------------"
docker compose ps

echo ""
echo "🔍 Logs do Backend (últimas 10 linhas):"
echo "--------------------------------------"
docker compose logs --tail 10 backend

echo ""
echo "🔍 Logs do Frontend (últimas 10 linhas):"
echo "---------------------------------------"
docker compose logs --tail 10 frontend

echo ""
echo "🔍 Logs do Nginx (últimas 10 linhas):"
echo "------------------------------------"
docker compose logs --tail 10 nginx

echo ""
echo "🌐 Testando Conectividade:"
echo "-------------------------"

# Testar backend diretamente
echo "Backend (porta 3000):"
if curl -s -f http://localhost:3000/health > /dev/null; then
    echo "✅ Backend respondendo"
else
    echo "❌ Backend não responde"
fi

# Testar frontend diretamente
echo "Frontend (porta 3001):"
if curl -s -f http://localhost:3001 > /dev/null; then
    echo "✅ Frontend respondendo"
else
    echo "❌ Frontend não responde"
fi

# Testar nginx
echo "Nginx (porta 80):"
if curl -s -f http://localhost > /dev/null; then
    echo "✅ Nginx respondendo"
else
    echo "❌ Nginx não responde"
fi

echo ""
echo "🔧 Verificando Arquivos de Configuração:"
echo "----------------------------------------"

# Verificar arquivos essenciais
files=(
    "docker-compose.yml"
    "Dockerfile.backend"
    "Dockerfile.frontend"
    "nginx/frontend.conf"
    "backend/package.json"
    "frontend/package.json"
)

for file in "${files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file"
    else
        echo "❌ $file (FALTANDO)"
    fi
done

echo ""
echo "📁 Verificando Estrutura de Diretórios:"
echo "---------------------------------------"

dirs=(
    "backend"
    "frontend"
    "nginx"
    "database"
    "monitoring/prometheus"
    "monitoring/grafana"
)

for dir in "${dirs[@]}"; do
    if [[ -d "$dir" ]]; then
        echo "✅ $dir/"
    else
        echo "❌ $dir/ (FALTANDO)"
    fi
done

echo ""
echo "🎯 Recomendações:"
echo "----------------"

# Verificar se há containers com problemas
if docker compose ps | grep -q "Exit"; then
    echo "⚠️  Alguns containers falharam. Execute: docker compose logs [nome-do-container]"
fi

# Verificar se há containers reiniciando
if docker compose ps | grep -q "Restarting"; then
    echo "⚠️  Alguns containers estão reiniciando. Verifique os logs."
fi

echo ""
echo "💡 Comandos úteis:"
echo "------------------"
echo "• Ver logs detalhados: docker compose logs -f [container]"
echo "• Reiniciar container: docker compose restart [container]"
echo "• Reconstruir container: docker compose build --no-cache [container]"
echo "• Parar tudo: docker compose down"
echo "• Iniciar tudo: docker compose up -d"
