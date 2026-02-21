#!/bin/bash
# Script para corrigir pg_hba.conf - remover listen_addresses que não pertence aqui

PG_VERSION="${1:-16}"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

if [[ ! -f "$PG_HBA" ]]; then
    echo "❌ Arquivo $PG_HBA não encontrado"
    exit 1
fi

echo "🔧 Corrigindo pg_hba.conf..."

# Fazer backup
sudo cp "$PG_HBA" "${PG_HBA}.backup-$(date +%Y%m%d-%H%M%S)"
echo "📋 Backup criado: ${PG_HBA}.backup-*"

# Remover TODAS as linhas que contêm "listen_addresses" (não pertence ao pg_hba.conf)
echo "Removendo linhas inválidas de listen_addresses..."
sudo sed -i '/listen_addresses/d' "$PG_HBA" 2>/dev/null || true

# Verificar se foi removido
if grep -q "listen_addresses" "$PG_HBA" 2>/dev/null; then
    echo "⚠️  Ainda há ocorrências de listen_addresses:"
    sudo grep -n "listen_addresses" "$PG_HBA"
    echo "Removendo novamente..."
    sudo sed -i '/listen_addresses/d' "$PG_HBA" 2>/dev/null || true
else
    echo "✅ Todas as linhas de listen_addresses foram removidas"
fi

# Verificar sintaxe básica do arquivo
echo ""
echo "Verificando estrutura do pg_hba.conf..."
invalid_lines=$(sudo grep -vE "^[[:space:]]*#|^[[:space:]]*$|^[[:space:]]*(local|host|hostssl|hostnossl|hostgssenc|hostnogssenc)[[:space:]]+" "$PG_HBA" 2>/dev/null | grep -v "^include" | grep -v "^include_if_exists" | grep -v "^include_dir" || echo "")

if [[ -n "$invalid_lines" ]]; then
    echo "⚠️  Linhas que podem ser inválidas:"
    echo "$invalid_lines"
else
    echo "✅ Estrutura do arquivo parece correta"
fi

# Adicionar regras para rede local se não existirem
echo ""
echo "Verificando regras de rede local..."

if ! grep -qE "^host[[:space:]]+all[[:space:]]+all[[:space:]]+192\.168\.0\.0/16[[:space:]]+md5" "$PG_HBA" 2>/dev/null; then
    echo "Adicionando regra para rede 192.168.0.0/16..."
    echo "host    all    all    192.168.0.0/16    md5" | sudo tee -a "$PG_HBA" > /dev/null
fi

if ! grep -qE "^host[[:space:]]+all[[:space:]]+all[[:space:]]+10\.0\.0\.0/8[[:space:]]+md5" "$PG_HBA" 2>/dev/null; then
    echo "Adicionando regra para rede 10.0.0.0/8..."
    echo "host    all    all    10.0.0.0/8         md5" | sudo tee -a "$PG_HBA" > /dev/null
fi

if ! grep -qE "^host[[:space:]]+all[[:space:]]+all[[:space:]]+172\.16\.0\.0/12[[:space:]]+md5" "$PG_HBA" 2>/dev/null; then
    echo "Adicionando regra para rede 172.16.0.0/12..."
    echo "host    all    all    172.16.0.0/12      md5" | sudo tee -a "$PG_HBA" > /dev/null
fi

echo ""
echo "✅ pg_hba.conf corrigido e configurado para aceitar conexões da rede local"
echo ""
echo "⚠️  Tente iniciar o PostgreSQL:"
echo "   sudo pg_ctlcluster ${PG_VERSION} main start"
echo ""
echo "Se ainda não funcionar, verifique os logs:"
echo "   sudo journalctl -u postgresql@${PG_VERSION}-main -n 50"

