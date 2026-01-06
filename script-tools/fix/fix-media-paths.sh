#!/bin/bash
# Script para corrigir caminhos de mídia no banco de dados e mover arquivos

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

INSTALL_DIR="${INSTALL_DIR:-/opt/smart-signage}"
DB_NAME="${DB_NAME:-smartsignage}"
DB_USER="${DB_USER:-smartsignage}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo -e "${GREEN}🔧 Corrigindo caminhos de mídia...${NC}"

# 1. Executar SQL para corrigir configuração e caminhos no banco
echo -e "${YELLOW}📝 Atualizando configuração no banco de dados...${NC}"
PGPASSWORD="${DB_PASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
-- Atualizar configuração de storage path
UPDATE system_settings 
SET setting_value = '$INSTALL_DIR/public/assets/uploads'
WHERE setting_key = 'media.storage.path';

-- Se não existir, criar
INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES ('media.storage.path', '$INSTALL_DIR/public/assets/uploads', 'string', 'Caminho base para armazenamento de arquivos de mídia')
ON CONFLICT (setting_key) DO UPDATE 
SET setting_value = '$INSTALL_DIR/public/assets/uploads';

-- Corrigir filePath nos registros de mídia existentes
UPDATE medias
SET file_path = REPLACE(
    REPLACE(
        REPLACE(
            file_path,
            '/home/smartchannel/smartsignage-pro-main/public/assets/uploads',
            '$INSTALL_DIR/public/assets/uploads'
        ),
        '/home/smartchannel/smartsignage-pro/public/assets/uploads',
        '$INSTALL_DIR/public/assets/uploads'
    ),
    './public/assets/uploads',
    '$INSTALL_DIR/public/assets/uploads'
)
WHERE file_path LIKE '%/home/smartchannel/%'
   OR file_path LIKE './public/assets/uploads%'
   OR file_path NOT LIKE '$INSTALL_DIR/%';

-- Mostrar resultado
SELECT 
    media_id,
    name,
    file_path,
    CASE 
        WHEN file_path LIKE '$INSTALL_DIR/%' THEN '✅ Correto'
        ELSE '❌ Precisa correção'
    END as status
FROM medias
ORDER BY media_id;
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Configuração do banco atualizada${NC}"
else
    echo -e "${RED}❌ Erro ao atualizar banco de dados${NC}"
    exit 1
fi

# 2. Mover arquivos físicos se necessário
echo -e "${YELLOW}📦 Verificando arquivos físicos...${NC}"

# Diretórios possíveis onde os arquivos podem estar
OLD_PATHS=(
    "/home/smartchannel/smartsignage-pro-main/public/assets/uploads"
    "/home/smartchannel/smartsignage-pro/public/assets/uploads"
    "./public/assets/uploads"
)

NEW_PATH="$INSTALL_DIR/public/assets/uploads"

for OLD_PATH in "${OLD_PATHS[@]}"; do
    if [ -d "$OLD_PATH" ] && [ -n "$(ls -A "$OLD_PATH" 2>/dev/null)" ]; then
        echo -e "${YELLOW}📁 Encontrados arquivos em: $OLD_PATH${NC}"
        echo -e "${YELLOW}   Movendo para: $NEW_PATH${NC}"
        
        # Criar diretório de destino se não existir
        mkdir -p "$NEW_PATH"
        
        # Mover arquivos preservando estrutura
        if [ -d "$OLD_PATH/uploads" ]; then
            # Se houver subdiretório uploads, mover conteúdo
            cp -r "$OLD_PATH/uploads/"* "$NEW_PATH/" 2>/dev/null || true
        else
            cp -r "$OLD_PATH/"* "$NEW_PATH/" 2>/dev/null || true
        fi
        
        # Ajustar permissões
        chmod -R 755 "$NEW_PATH" 2>/dev/null || true
        find "$NEW_PATH" -type f -exec chmod 644 {} \; 2>/dev/null || true
        
        echo -e "${GREEN}✅ Arquivos movidos${NC}"
    fi
done

# 3. Garantir permissões corretas
echo -e "${YELLOW}🔐 Ajustando permissões...${NC}"
chmod -R 755 "$NEW_PATH" 2>/dev/null || true
find "$NEW_PATH" -type d -exec chmod 755 {} \; 2>/dev/null || true
find "$NEW_PATH" -type f -exec chmod 644 {} \; 2>/dev/null || true

echo -e "${GREEN}✅ Permissões ajustadas${NC}"

# 4. Verificar configuração final
echo -e "${YELLOW}🔍 Verificando configuração final...${NC}"
PGPASSWORD="${DB_PASSWORD:-smartsignage123}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
SELECT 
    setting_key,
    setting_value,
    CASE 
        WHEN setting_value = '$INSTALL_DIR/public/assets/uploads' THEN '✅ Correto'
        ELSE '❌ Precisa correção'
    END as status
FROM system_settings
WHERE setting_key = 'media.storage.path';
"

echo -e "${GREEN}✅ Correção concluída!${NC}"
echo -e "${YELLOW}⚠️  Reinicie o serviço backend para aplicar as mudanças:${NC}"
echo -e "   sudo systemctl restart smart-signage"
echo -e "   ou"
echo -e "   pm2 restart smart-signage"

