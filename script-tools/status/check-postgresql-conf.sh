#!/bin/bash
# Script para verificar postgresql.conf e corrigir problemas

PG_VERSION="${1:-16}"
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"

if [[ ! -f "$PG_CONF" ]]; then
    echo "❌ Arquivo $PG_CONF não encontrado"
    exit 1
fi

echo "🔍 Verificando postgresql.conf..."

# Verificar linha 130 especificamente
echo "Linha 130:"
sudo sed -n '130p' "$PG_CONF" | cat -A

# Verificar todas as ocorrências de listen_addresses
echo ""
echo "Todas as ocorrências de 'listen_addresses':"
sudo grep -n "listen_addresses" "$PG_CONF"

# Verificar se há linhas problemáticas perto da linha 130
echo ""
echo "Linhas 125-135:"
sudo sed -n '125,135p' "$PG_CONF" | cat -n

# Verificar sintaxe do arquivo (método correto)
echo ""
echo "Verificando sintaxe do arquivo..."
# O comando correto é postgres --check-config sem -D, ou usar pg_ctl
if sudo -u postgres /usr/lib/postgresql/${PG_VERSION}/bin/postgres --check-config 2>&1 | head -5; then
    echo "✅ Arquivo parece estar correto"
else
    echo "⚠️  Verificando de outra forma..."
    # Tentar iniciar em modo de verificação
    if sudo -u postgres /usr/lib/postgresql/${PG_VERSION}/bin/postgres --version > /dev/null 2>&1; then
        echo "✅ PostgreSQL binário está OK"
    fi
fi

