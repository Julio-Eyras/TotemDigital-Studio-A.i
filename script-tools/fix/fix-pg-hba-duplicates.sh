#!/bin/bash
# Script para remover duplicatas do pg_hba.conf

PG_HBA="/etc/postgresql/16/main/pg_hba.conf"

if [[ ! -f "$PG_HBA" ]]; then
    echo "❌ Arquivo $PG_HBA não encontrado"
    exit 1
fi

echo "🔧 Limpando duplicatas do pg_hba.conf..."

# Fazer backup
sudo cp "$PG_HBA" "${PG_HBA}.backup-$(date +%Y%m%d-%H%M%S)"

# Remover linha incorreta (listen_addresses não pertence ao pg_hba.conf)
sudo sed -i '/^listen_addresses/d' "$PG_HBA"

# Remover todas as linhas duplicadas de smartsignage
# Manter apenas a primeira ocorrência de cada rede
sudo awk '
    /^host[[:space:]]+smartsignage[[:space:]]+smartsignage[[:space:]]+192\.168\.0\.0\/16[[:space:]]+md5/ {
        if (!seen_192) {
            print
            seen_192 = 1
        }
        next
    }
    /^host[[:space:]]+smartsignage[[:space:]]+smartsignage[[:space:]]+10\.0\.0\.0\/8[[:space:]]+md5/ {
        if (!seen_10) {
            print
            seen_10 = 1
        }
        next
    }
    /^host[[:space:]]+smartsignage[[:space:]]+smartsignage[[:space:]]+172\.16\.0\.0\/12[[:space:]]+md5/ {
        if (!seen_172) {
            print
            seen_172 = 1
        }
        next
    }
    { print }
' "$PG_HBA" > "${PG_HBA}.tmp" && sudo mv "${PG_HBA}.tmp" "$PG_HBA"

echo "✅ Duplicatas removidas do pg_hba.conf"
echo "📋 Backup criado: ${PG_HBA}.backup-*"
echo ""
echo "⚠️  Reinicie o PostgreSQL para aplicar as mudanças:"
echo "   sudo systemctl restart postgresql"

