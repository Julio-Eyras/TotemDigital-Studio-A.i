#!/bin/bash

# Script para corrigir tabelas do banco de dados
# Execute este script se as tabelas não foram criadas corretamente

INSTALL_DIR="/home/smartchannel/smartsignage-pro-main"
DATABASE_URL="postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage"

echo "🔧 Corrigindo schema do banco de dados..."

cd "$INSTALL_DIR" || exit 1

# Verificar se o arquivo smartchannel-db.sql existe
SCHEMA_SQL_FILE="$INSTALL_DIR/database/smartchannel-db.sql"
if [[ ! -f "$SCHEMA_SQL_FILE" ]]; then
    echo "❌ Arquivo smartchannel-db.sql não encontrado!"
    exit 1
fi

echo "✅ Executando smartchannel-db.sql..."

# Executar schema SQL ignorando erros de "already exists"
psql "$DATABASE_URL" -f "$SCHEMA_SQL_FILE" 2>&1 | grep -v "already exists" | grep -v "NOTICE" || true

# Verificar quantas tabelas foram criadas
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" 2>/dev/null | tr -d ' ')

echo "✅ Tabelas encontradas no banco: $TABLE_COUNT"

if [[ -n "$TABLE_COUNT" ]] && [[ "$TABLE_COUNT" -gt 30 ]]; then
    echo "✅ Schema criado com sucesso! ($TABLE_COUNT tabelas)"
    
    # Listar tabelas criadas
    echo ""
    echo "📋 Tabelas criadas:"
    psql "$DATABASE_URL" -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;" 2>/dev/null
    
    # Executar seed data
    echo ""
    echo "🌱 Executando seed data..."
    INITIAL_LOAD_FILE="$INSTALL_DIR/database/carga-inicial-db-smarsignage-v4.sql"
    if [[ -f "$INITIAL_LOAD_FILE" ]]; then
        psql "$DATABASE_URL" -f "$INITIAL_LOAD_FILE" 2>&1 | grep -v "already exists" | grep -v "NOTICE" || true
        echo "✅ Seed data executado"
    else
        echo "⚠️ Arquivo carga-inicial-db-smarsignage-v4.sql não encontrado"
    fi
else
    echo "⚠️ Poucas tabelas criadas ($TABLE_COUNT). Verifique o schema SQL."
fi

echo ""
echo "✅ Correção concluída!"

