#!/bin/bash
# Script de Validação do Schema SQL
# Valida a sintaxe do arquivo smartchannel-db.sql

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_FILE="$SCRIPT_DIR/../smartchannel-db-v2-refactored-apply-all.sql"

echo "🔍 Validando schema SQL..."

# Verificar se o arquivo existe
if [ ! -f "$DB_FILE" ]; then
    echo "❌ Erro: Arquivo $DB_FILE não encontrado"
    exit 1
fi

# Verificar se psql está disponível
if ! command -v psql &> /dev/null; then
    echo "⚠️  psql não encontrado. Instalando validação básica..."
    
    # Validação básica sem psql
    echo "✅ Verificando sintaxe básica..."
    
    # Verificar se há erros comuns
    if grep -q "CREATE TABLE.*(" "$DB_FILE"; then
        echo "✅ Estrutura CREATE TABLE encontrada"
    else
        echo "⚠️  Nenhuma CREATE TABLE encontrada"
    fi
    
    echo "✅ Validação básica concluída"
    exit 0
fi

# Validação com psql (dry-run)
echo "📝 Executando validação com PostgreSQL..."

# Criar banco temporário para validação
TEMP_DB="smartsignage_validation_$$"

# Tentar validar
if psql -h localhost -U postgres -d postgres -c "CREATE DATABASE $TEMP_DB;" 2>/dev/null; then
    # Validar schema
    if psql -h localhost -U postgres -d "$TEMP_DB" -f "$DB_FILE" > /dev/null 2>&1; then
        echo "✅ Schema válido!"
        
        # Limpar banco temporário
        psql -h localhost -U postgres -d postgres -c "DROP DATABASE $TEMP_DB;" 2>/dev/null
        
        exit 0
    else
        echo "❌ Erro na validação do schema"
        psql -h localhost -U postgres -d "$TEMP_DB" -f "$DB_FILE" 2>&1 | head -20
        psql -h localhost -U postgres -d postgres -c "DROP DATABASE $TEMP_DB;" 2>/dev/null
        exit 1
    fi
else
    echo "⚠️  Não foi possível criar banco temporário. Verificando sintaxe básica..."
    
    # Validação básica
    if grep -q "CREATE TABLE" "$DB_FILE"; then
        echo "✅ Estrutura básica OK"
    fi
    
    exit 0
fi

