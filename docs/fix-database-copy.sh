#!/bin/bash

# Script para corrigir o problema de cópia do diretório database
# Execute este script no servidor Ubuntu

echo "🔧 Corrigindo problema de cópia do diretório database..."

INSTALL_DIR="/opt/smart-signage"

# Verificar se o diretório de instalação existe
if [[ ! -d "$INSTALL_DIR" ]]; then
    echo "❌ Diretório de instalação não encontrado: $INSTALL_DIR"
    exit 1
fi

# Remover diretório database existente se houver conflito
if [[ -d "$INSTALL_DIR/database" ]]; then
    echo "🗑️ Removendo diretório database existente..."
    rm -rf "$INSTALL_DIR/database"
fi

# Copiar diretório database novamente
if [[ -d "/home/smartchannel/SmartSignage-Pro/database" ]]; then
    echo "📁 Copiando diretório database..."
    cp -r "/home/smartchannel/SmartSignage-Pro/database" "$INSTALL_DIR/"
    echo "✅ Diretório database copiado com sucesso!"
else
    echo "❌ Diretório database não encontrado em /home/smartchannel/SmartSignage-Pro/"
    exit 1
fi

# Verificar se os arquivos foram copiados corretamente
if [[ -f "$INSTALL_DIR/database/smartchannel-db.sql" ]] && [[ -f "$INSTALL_DIR/database/init-data.sql" ]]; then
    echo "✅ Arquivos database verificados:"
    echo "   - smartchannel-db.sql: $(ls -lh "$INSTALL_DIR/database/smartchannel-db.sql" | awk '{print $5}')"
    echo "   - init-data.sql: $(ls -lh "$INSTALL_DIR/database/init-data.sql" | awk '{print $5}')"
    echo ""
    echo "🎉 Correção concluída! Você pode continuar executando o script de instalação."
else
    echo "❌ Erro: Arquivos database não foram copiados corretamente"
    exit 1
fi
