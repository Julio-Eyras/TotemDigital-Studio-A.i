#!/bin/bash
# Script para testar se PostgreSQL consegue iniciar

PG_VERSION="${1:-16}"

echo "🔍 Testando inicialização do PostgreSQL ${PG_VERSION}..."

# Verificar se cluster existe
echo "1. Verificando cluster..."
sudo pg_lsclusters | grep "${PG_VERSION}.*main"

# Tentar iniciar
echo ""
echo "2. Tentando iniciar cluster..."
if sudo pg_ctlcluster ${PG_VERSION} main start 2>&1; then
    sleep 3
    echo ""
    echo "3. Verificando status..."
    sudo pg_lsclusters | grep "${PG_VERSION}.*main"
    
    # Verificar se está online
    status=$(sudo pg_lsclusters | grep "${PG_VERSION}.*main" | awk '{print $4}')
    if [[ "$status" == "online" ]]; then
        echo ""
        echo "✅ PostgreSQL iniciado com sucesso!"
        echo ""
        echo "4. Testando conexão..."
        if sudo -u postgres psql -c "SELECT version();" 2>&1 | head -3; then
            echo "✅ Conexão funcionando!"
        else
            echo "❌ Conexão falhou"
        fi
    else
        echo "❌ PostgreSQL não está online (status: $status)"
        echo ""
        echo "Verificando logs..."
        sudo journalctl -u postgresql@${PG_VERSION}-main --no-pager -n 30 | tail -20
    fi
else
    echo "❌ Falha ao iniciar"
    echo ""
    echo "Verificando logs detalhados..."
    sudo journalctl -u postgresql@${PG_VERSION}-main --no-pager -n 50 | grep -E "FATAL|ERROR|invalid" | tail -10
fi

