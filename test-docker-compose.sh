#!/bin/bash

# Script de teste para verificar Docker Compose
# =============================================

echo "=== TESTE DOCKER COMPOSE ==="
echo "Data: $(date)"
echo "Usuário: $(whoami)"
echo "Diretório atual: $(pwd)"
echo ""

# Verificar se estamos no diretório correto
INSTALL_DIR="/opt/smart-signage"
echo "Diretório de instalação: $INSTALL_DIR"

# Navegar para o diretório
echo "Navegando para $INSTALL_DIR..."
cd $INSTALL_DIR

echo "Diretório atual após navegação: $(pwd)"
echo ""

# Verificar arquivos
echo "=== VERIFICANDO ARQUIVOS ==="
echo "docker-compose.yml: $([[ -f "docker-compose.yml" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
echo "Dockerfile: $([[ -f "Dockerfile" ]] && echo "EXISTE" || echo "NÃO EXISTE")"
echo ""

# Listar arquivos no diretório
echo "=== ARQUIVOS NO DIRETÓRIO ==="
ls -la
echo ""

# Verificar Docker
echo "=== VERIFICANDO DOCKER ==="
echo "Docker instalado: $(command -v docker > /dev/null && echo "SIM" || echo "NÃO")"
echo "Docker rodando: $(systemctl is-active docker 2>/dev/null || echo "NÃO")"
echo ""

# Verificar Docker Compose
echo "=== VERIFICANDO DOCKER COMPOSE ==="
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
    echo "Usando Docker Compose v2 (docker compose)"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    echo "Usando Docker Compose v1 (docker-compose)"
else
    echo "Docker Compose não encontrado!"
    exit 1
fi

echo "Comando: $COMPOSE_CMD"
echo ""

# Testar comando
echo "=== TESTANDO COMANDO ==="
echo "Executando: $COMPOSE_CMD ps"
$COMPOSE_CMD ps
echo ""

echo "=== TESTE CONCLUÍDO ==="
