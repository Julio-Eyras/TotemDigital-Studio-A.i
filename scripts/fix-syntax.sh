#!/bin/bash

# Script para corrigir sintaxe dos arquivos de rotas

echo "Corrigindo sintaxe dos arquivos de rotas..."

# Lista de arquivos para corrigir
FILES=(
    "backend/src/routes/ai.ts"
    "backend/src/routes/billing.ts"
    "backend/src/routes/campaigns.ts"
    "backend/src/routes/clients.ts"
    "backend/src/routes/media.ts"
    "backend/src/routes/playlists.ts"
    "backend/src/routes/qrcodes.ts"
    "backend/src/routes/reports.ts"
    "backend/src/routes/settings.ts"
    "backend/src/routes/smart-playlist.ts"
    "backend/src/routes/totems.ts"
)

for file in "${FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "Processando $file..."
        
        # Extrair nome do serviço do arquivo
        SERVICE_NAME=$(basename "$file" .ts | sed 's/-playlist//')
        SERVICE_CLASS=$(echo "$SERVICE_NAME" | sed 's/^./\U&/' | sed 's/\([A-Z]\)/Service/')
        SERVICE_VAR=$(echo "$SERVICE_NAME" | sed 's/^./\L&/')Service
        
        echo "  Serviço: $SERVICE_CLASS"
        echo "  Variável: ${SERVICE_VAR}Instance"
        
        # Aplicar correções
        sed -i "s/get${SERVICE_CLASS}()Instance/${SERVICE_VAR}Instance/g" "$file"
        sed -i "s/from '\.\.\/services\/get${SERVICE_CLASS}()'/from '\.\.\/services\/${SERVICE_VAR,,}'/g" "$file"
        
        echo "  ✅ Corrigido"
    else
        echo "Arquivo $file não encontrado"
    fi
done

echo "Concluído!"
