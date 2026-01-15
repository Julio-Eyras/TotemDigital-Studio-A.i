#!/bin/bash

# Script de teste para verificar Dockerfile
# ========================================

echo "=== TESTE DOCKERFILE ==="
echo "Data: $(date)"
echo "Usuário: $(whoami)"
echo "Diretório atual: $(pwd)"
echo ""

# Verificar se os arquivos necessários existem
echo "=== VERIFICANDO ARQUIVOS NECESSÁRIOS ==="
REQUIRED_FILES=(
    "Dockerfile"
    "docker-compose.yml"
    "docker/entrypoint.sh"
    "backend/package.json"
    "frontend/package.json"
    "database/smartchannel-db-v2-refactored-apply-all.sql"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file: EXISTE"
    else
        echo "❌ $file: NÃO EXISTE"
    fi
done
echo ""

# Verificar se o diretório docker existe
echo "=== VERIFICANDO DIRETÓRIO DOCKER ==="
if [[ -d "docker" ]]; then
    echo "✅ Diretório docker existe"
    echo "Conteúdo:"
    ls -la docker/
else
    echo "❌ Diretório docker NÃO existe"
fi
echo ""

# Verificar se o entrypoint.sh tem permissão de execução
if [[ -f "docker/entrypoint.sh" ]]; then
    echo "=== VERIFICANDO ENTRYPOINT.SH ==="
    echo "Permissões: $(ls -la docker/entrypoint.sh)"
    echo "Primeiras 5 linhas:"
    head -5 docker/entrypoint.sh
    echo ""
fi

# Verificar se Docker está funcionando
echo "=== VERIFICANDO DOCKER ==="
if command -v docker &> /dev/null; then
    echo "✅ Docker instalado"
    echo "Versão: $(docker --version)"
    
    if systemctl is-active docker &> /dev/null; then
        echo "✅ Docker rodando"
    else
        echo "❌ Docker não está rodando"
    fi
else
    echo "❌ Docker não instalado"
fi
echo ""

# Testar build do Dockerfile (apenas verificar sintaxe)
echo "=== TESTANDO SINTAXE DO DOCKERFILE ==="
if command -v docker &> /dev/null; then
    echo "Verificando sintaxe do Dockerfile..."
    if docker build --dry-run . &> /dev/null; then
        echo "✅ Dockerfile tem sintaxe válida"
    else
        echo "❌ Dockerfile tem problemas de sintaxe"
        echo "Erro:"
        docker build --dry-run . 2>&1 | head -10
    fi
else
    echo "⚠️ Docker não disponível para teste de sintaxe"
fi
echo ""

echo "=== TESTE CONCLUÍDO ==="
