#!/bin/bash

# Script para corrigir Clients.tsx no servidor
# Substitui clientId por subscriberId nas chamadas de API

echo "🔧 Corrigindo Clients.tsx..."

FILE="frontend/src/pages/Clients/Clients.tsx"

if [ ! -f "$FILE" ]; then
    echo "❌ Arquivo não encontrado: $FILE"
    exit 1
fi

# Fazer backup
cp "$FILE" "$FILE.backup"

# Corrigir as linhas problemáticas
sed -i 's/userApi\.getAll({ clientId })/userApi.getAll({ subscriberId: clientId })/g' "$FILE"
sed -i 's/playerApi\.getAll({ clientId })/playerApi.getAll({ subscriberId: clientId })/g' "$FILE"
sed -i 's/playlistApi\.getAll({ clientId })/playlistApi.getAll({ subscriberId: clientId })/g' "$FILE"
sed -i 's/mediaApi\.getAll({ clientId })/mediaApi.getAll({ subscriberId: clientId })/g' "$FILE"

# Verificar se a correção foi aplicada
if grep -q "userApi.getAll({ subscriberId" "$FILE"; then
    echo "✅ Correção aplicada com sucesso!"
    echo "📝 Backup salvo em: $FILE.backup"
else
    echo "⚠️  Verifique se o arquivo já estava correto ou se há outro problema"
fi
