#!/bin/bash

# Script de Diagnóstico Docker
# ============================

echo "=== DIAGNÓSTICO DOCKER COMPOSE ==="
echo "Data: $(date)"
echo "Usuário: $(whoami)"
echo ""

# Verificar diretórios
echo "=== DIRETÓRIOS ==="
echo "Diretório atual: $(pwd)"
echo "HOME: $HOME"
echo "INSTALL_DIR: /opt/smart-signage"
echo ""

# Verificar se o diretório de instalação existe
if [[ -d "/opt/smart-signage" ]]; then
    echo "✅ Diretório /opt/smart-signage existe"
    echo "Conteúdo:"
    ls -la /opt/smart-signage/
else
    echo "❌ Diretório /opt/smart-signage NÃO existe"
fi
echo ""

# Verificar arquivos no diretório atual
echo "=== ARQUIVOS NO DIRETÓRIO ATUAL ==="
ls -la
echo ""

# Verificar se docker-compose.yml existe em locais possíveis
echo "=== VERIFICANDO DOCKER-COMPOSE.YML ==="
LOCATIONS=(
    "./docker-compose.yml"
    "$HOME/SmartChannel-TV/docker-compose.yml"
    "/opt/smart-signage/docker-compose.yml"
)

for location in "${LOCATIONS[@]}"; do
    if [[ -f "$location" ]]; then
        echo "✅ $location: EXISTE"
        echo "   Tamanho: $(stat -c%s "$location" 2>/dev/null || stat -f%z "$location" 2>/dev/null || echo "N/A") bytes"
    else
        echo "❌ $location: NÃO EXISTE"
    fi
done
echo ""

# Verificar Docker
echo "=== VERIFICANDO DOCKER ==="
echo "Docker instalado: $(command -v docker > /dev/null && echo "✅ SIM" || echo "❌ NÃO")"
echo "Docker rodando: $(systemctl is-active docker 2>/dev/null && echo "✅ SIM" || echo "❌ NÃO")"
echo "Usuário no grupo docker: $(groups $USER | grep -q docker && echo "✅ SIM" || echo "❌ NÃO")"
echo ""

# Verificar Docker Compose
echo "=== VERIFICANDO DOCKER COMPOSE ==="
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    echo "✅ Docker Compose v2 disponível"
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose v1 disponível"
    COMPOSE_CMD="docker-compose"
else
    echo "❌ Docker Compose não encontrado"
    exit 1
fi

echo "Comando a ser usado: $COMPOSE_CMD"
echo ""

# Testar comando docker-compose
echo "=== TESTANDO COMANDO DOCKER COMPOSE ==="
echo "Executando: $COMPOSE_CMD --version"
$COMPOSE_CMD --version
echo ""

# Se estivermos no diretório correto, testar ps
if [[ -f "docker-compose.yml" ]]; then
    echo "Executando: $COMPOSE_CMD ps"
    $COMPOSE_CMD ps
else
    echo "❌ docker-compose.yml não encontrado no diretório atual"
fi
echo ""

echo "=== DIAGNÓSTICO CONCLUÍDO ==="
