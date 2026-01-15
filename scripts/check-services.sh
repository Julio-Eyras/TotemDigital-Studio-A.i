#!/bin/bash

# Script para aplicar lazy initialization em todos os serviços

echo "Aplicando lazy initialization em todos os serviços..."

# Lista de arquivos de serviços para corrigir
SERVICE_FILES=(
    "backend/src/services/userService.ts"
    "backend/src/services/totemService.ts"
    "backend/src/services/smartPlaylistService.ts"
    "backend/src/services/settingsService.ts"
    "backend/src/services/reportsService.ts"
    "backend/src/services/qrcodeService.ts"
    "backend/src/services/playlistService.ts"
    "backend/src/services/notificationService.ts"
    "backend/src/services/mediaService.ts"
    "backend/src/services/clientService.ts"
    "backend/src/services/campaignService.ts"
    "backend/src/services/billingService.ts"
    "backend/src/services/analyticsService.ts"
    "backend/src/services/aiService.ts"
)

for file in "${SERVICE_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "Processando $file..."
        
        # Verificar se tem instanciação de AuditService
        if grep -q "private auditService = new AuditService()" "$file"; then
            echo "  ✅ Tem AuditService - precisa correção"
        else
            echo "  ⚠️ Não tem AuditService ou já corrigido"
        fi
        
        # Verificar se tem outros serviços instanciados
        if grep -q "new.*Service()" "$file"; then
            echo "  ⚠️ Tem outros serviços instanciados"
        fi
    else
        echo "Arquivo $file não encontrado"
    fi
done

echo "Concluído!"
