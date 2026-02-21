#!/bin/bash

# Script de diagnóstico para o problema do entrypoint.sh
# =====================================================

echo "=== DIAGNÓSTICO ENTRYPOINT.SH ==="
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

# Verificar diretório docker
echo "=== VERIFICANDO DIRETÓRIO DOCKER ==="
if [[ -d "docker" ]]; then
    echo "✅ Diretório docker existe"
    echo "Conteúdo:"
    ls -la docker/
    echo ""
    
    # Verificar entrypoint.sh
    if [[ -f "docker/entrypoint.sh" ]]; then
        echo "✅ docker/entrypoint.sh existe"
        echo "Permissões: $(ls -la docker/entrypoint.sh)"
        echo "Tamanho: $(stat -c%s "docker/entrypoint.sh" 2>/dev/null || stat -f%z "docker/entrypoint.sh" 2>/dev/null || echo "N/A") bytes"
        echo "Executável: $([[ -x "docker/entrypoint.sh" ]] && echo "SIM" || echo "NÃO")"
        echo ""
        
        # Verificar primeiras linhas
        echo "Primeiras 5 linhas:"
        head -5 docker/entrypoint.sh
        echo ""
        
        # Verificar se tem shebang
        if head -1 docker/entrypoint.sh | grep -q "#!/bin/bash"; then
            echo "✅ Shebang correto encontrado"
        else
            echo "❌ Shebang incorreto ou ausente"
            echo "Primeira linha: $(head -1 docker/entrypoint.sh)"
        fi
    else
        echo "❌ docker/entrypoint.sh não existe"
    fi
else
    echo "❌ Diretório docker não existe"
fi
echo ""

# Verificar se o comando chmod está sendo executado no contexto correto
echo "=== TESTANDO COMANDO CHMOD ==="
if [[ -f "docker/entrypoint.sh" ]]; then
    echo "Testando chmod no arquivo local..."
    chmod +x docker/entrypoint.sh
    if [[ $? -eq 0 ]]; then
        echo "✅ chmod executado com sucesso no arquivo local"
    else
        echo "❌ Erro ao executar chmod no arquivo local"
    fi
else
    echo "❌ Não é possível testar chmod - arquivo não existe"
fi
echo ""

# Verificar se há problemas com o Dockerfile
echo "=== VERIFICANDO DOCKERFILE ==="
if [[ -f "Dockerfile" ]]; then
    echo "Verificando linhas relacionadas ao entrypoint..."
    grep -n "entrypoint" Dockerfile || echo "Nenhuma referência ao entrypoint encontrada"
    echo ""
    
    echo "Verificando linhas relacionadas ao chmod..."
    grep -n "chmod" Dockerfile || echo "Nenhuma referência ao chmod encontrada"
    echo ""
fi

# Verificar se há containers Docker rodando
echo "=== VERIFICANDO CONTAINERS DOCKER ==="
if command -v docker &> /dev/null; then
    echo "Containers rodando:"
    docker ps
    echo ""
    
    echo "Imagens disponíveis:"
    docker images | head -5
    echo ""
else
    echo "❌ Docker não disponível"
fi

echo "=== DIAGNÓSTICO CONCLUÍDO ==="
