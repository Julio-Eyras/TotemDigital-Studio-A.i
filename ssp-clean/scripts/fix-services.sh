#!/bin/bash

# Script para aplicar lazy initialization em todos os arquivos de rotas

echo "Aplicando lazy initialization em todos os arquivos de rotas..."

# Lista de arquivos para corrigir
FILES=(
    "backend/src/routes/totems.ts"
    "backend/src/routes/smart-playlist.ts"
    "backend/src/routes/settings.ts"
    "backend/src/routes/reports.ts"
    "backend/src/routes/qrcodes.ts"
    "backend/src/routes/playlists.ts"
    "backend/src/routes/media.ts"
    "backend/src/routes/clients.ts"
    "backend/src/routes/campaigns.ts"
    "backend/src/routes/billing.ts"
    "backend/src/routes/ai.ts"
    "backend/src/routes/analytics.ts"
)

for file in "${FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "Processando $file..."
        
        # Extrair nome do serviço do arquivo
        SERVICE_NAME=$(grep "new.*Service()" "$file" | head -1 | sed 's/.*new \([A-Za-z]*Service\)().*/\1/')
        SERVICE_VAR=$(echo "$SERVICE_NAME" | sed 's/\([A-Z]\)/\L\1/g' | sed 's/^./\L&/')
        
        echo "  Serviço: $SERVICE_NAME"
        echo "  Variável: ${SERVICE_VAR}Service"
        
        # Aplicar correção (isso seria feito manualmente para cada arquivo)
        echo "  Arquivo $file precisa ser corrigido manualmente"
    else
        echo "Arquivo $file não encontrado"
    fi
done

echo "Concluído!"
