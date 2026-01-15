#!/bin/bash

# Script de teste para verificar build do Docker
# ==============================================

echo "=== TESTE BUILD DOCKER ==="
echo "Data: $(date)"
echo "Usuário: $(whoami)"
echo "Diretório atual: $(pwd)"
echo ""

# Verificar se estamos no diretório correto
if [[ ! -f "Dockerfile" ]]; then
    echo "❌ Dockerfile não encontrado no diretório atual"
    echo "Navegando para o diretório raiz..."
    cd ..
    if [[ ! -f "Dockerfile" ]]; then
        echo "❌ Dockerfile não encontrado"
        exit 1
    fi
fi

echo "✅ Dockerfile encontrado em: $(pwd)"
echo ""

# Verificar arquivos necessários
echo "=== VERIFICANDO ARQUIVOS NECESSÁRIOS ==="
REQUIRED_FILES=(
    "Dockerfile"
    "docker/entrypoint.sh"
    "backend/package.json"
    "frontend/package.json"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file: EXISTE"
    else
        echo "❌ $file: NÃO EXISTE"
    fi
done
echo ""

# Verificar se o entrypoint.sh tem conteúdo
if [[ -f "docker/entrypoint.sh" ]]; then
    echo "=== VERIFICANDO ENTRYPOINT.SH ==="
    echo "Tamanho: $(stat -c%s "docker/entrypoint.sh" 2>/dev/null || stat -f%z "docker/entrypoint.sh" 2>/dev/null || echo "N/A") bytes"
    echo "Primeiras 3 linhas:"
    head -3 docker/entrypoint.sh
    echo ""
fi

# Verificar Docker
echo "=== VERIFICANDO DOCKER ==="
if command -v docker &> /dev/null; then
    echo "✅ Docker instalado: $(docker --version)"
    
    if systemctl is-active docker &> /dev/null; then
        echo "✅ Docker rodando"
    else
        echo "❌ Docker não está rodando"
        echo "Tentando iniciar Docker..."
        sudo systemctl start docker
        sleep 3
        if systemctl is-active docker &> /dev/null; then
            echo "✅ Docker iniciado com sucesso"
        else
            echo "❌ Falha ao iniciar Docker"
            exit 1
        fi
    fi
else
    echo "❌ Docker não instalado"
    exit 1
fi
echo ""

# Testar build (apenas verificar se não há erros de sintaxe)
echo "=== TESTANDO BUILD DOCKER ==="
echo "Executando: docker build --no-cache --target builder ."
echo ""

# Executar build apenas do estágio builder para testar
if docker build --no-cache --target builder . 2>&1 | tee build.log; then
    echo ""
    echo "✅ Build do estágio builder concluído com sucesso!"
    
    # Verificar se o arquivo foi copiado corretamente
    echo ""
    echo "=== VERIFICANDO SE ARQUIVOS FORAM COPIADOS ==="
    if docker run --rm $(docker images -q | head -1) ls -la /app/docker/ 2>/dev/null; then
        echo "✅ Diretório docker copiado corretamente"
    else
        echo "❌ Problema ao copiar diretório docker"
    fi
else
    echo ""
    echo "❌ Erro no build do Docker"
    echo "Últimas linhas do log:"
    tail -10 build.log
    exit 1
fi

echo ""
echo "=== TESTE CONCLUÍDO ==="
