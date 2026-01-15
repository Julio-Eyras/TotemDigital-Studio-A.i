#!/bin/bash

# Script de teste seguro para build do Docker
# ===========================================

echo "=== TESTE SEGURO DOCKER BUILD ==="
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
    "docker-compose.yml"
    "docker/entrypoint.sh"
    "backend/package.json"
    "frontend/package.json"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file: EXISTE"
    else
        echo "❌ $file: NÃO EXISTE"
        if [[ "$file" == "docker/entrypoint.sh" ]]; then
            echo "Tentando criar docker/entrypoint.sh..."
            mkdir -p docker
            cat > docker/entrypoint.sh << 'EOF'
#!/bin/bash
echo "Smart Signage Pro v2.0 - Entrypoint"
echo "Iniciando aplicação..."
exec "$@"
EOF
            chmod +x docker/entrypoint.sh
            if [[ -f "docker/entrypoint.sh" ]]; then
                echo "✅ docker/entrypoint.sh criado com sucesso"
            else
                echo "❌ Falha ao criar docker/entrypoint.sh"
                exit 1
            fi
        fi
    fi
done
echo ""

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

# Testar build do estágio builder primeiro
echo "=== TESTANDO BUILD ESTÁGIO BUILDER ==="
echo "Executando: docker build --no-cache --target builder ."
echo ""

if docker build --no-cache --target builder . 2>&1 | tee /tmp/docker-build-builder.log; then
    echo ""
    echo "✅ Build do estágio builder concluído com sucesso!"
    
    # Verificar se o arquivo foi copiado corretamente
    echo ""
    echo "=== VERIFICANDO ARQUIVOS NO ESTÁGIO BUILDER ==="
    BUILDER_IMAGE=$(docker images -q | head -1)
    if [[ -n "$BUILDER_IMAGE" ]]; then
        echo "Imagem builder: $BUILDER_IMAGE"
        echo "Verificando se docker/entrypoint.sh foi copiado:"
        if docker run --rm $BUILDER_IMAGE ls -la /app/docker/ 2>/dev/null; then
            echo "✅ Diretório docker encontrado no estágio builder"
        else
            echo "❌ Diretório docker não encontrado no estágio builder"
        fi
    fi
else
    echo ""
    echo "❌ Erro no build do estágio builder"
    echo "Últimas linhas do log:"
    tail -10 /tmp/docker-build-builder.log
    exit 1
fi
echo ""

# Testar build completo
echo "=== TESTANDO BUILD COMPLETO ==="
echo "Executando: docker build --no-cache ."
echo ""

if docker build --no-cache . 2>&1 | tee /tmp/docker-build-complete.log; then
    echo ""
    echo "✅ Build completo concluído com sucesso!"
    
    # Verificar se o entrypoint foi copiado corretamente
    echo ""
    echo "=== VERIFICANDO ENTRYPOINT NO ESTÁGIO PRODUCTION ==="
    PRODUCTION_IMAGE=$(docker images -q | head -1)
    if [[ -n "$PRODUCTION_IMAGE" ]]; then
        echo "Imagem production: $PRODUCTION_IMAGE"
        echo "Verificando se /entrypoint.sh foi copiado:"
        if docker run --rm $PRODUCTION_IMAGE ls -la /entrypoint.sh 2>/dev/null; then
            echo "✅ /entrypoint.sh encontrado no estágio production"
        else
            echo "❌ /entrypoint.sh não encontrado no estágio production"
        fi
    fi
else
    echo ""
    echo "❌ Erro no build completo"
    echo "Últimas linhas do log:"
    tail -10 /tmp/docker-build-complete.log
    exit 1
fi
echo ""

echo "=== TESTE CONCLUÍDO COM SUCESSO ==="
echo "Logs salvos em:"
echo "  - /tmp/docker-build-builder.log"
echo "  - /tmp/docker-build-complete.log"
