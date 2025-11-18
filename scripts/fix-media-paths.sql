-- Script para corrigir caminhos de mídia no banco de dados
-- Execute este script após atualizar o código para corrigir caminhos existentes

-- 1. Atualizar configuração de storage path no banco
UPDATE system_settings 
SET setting_value = '/opt/smart-signage/public/assets/uploads'
WHERE setting_key = 'media.storage.path';

-- Se não existir, criar
INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES ('media.storage.path', '/opt/smart-signage/public/assets/uploads', 'string', 'Caminho base para armazenamento de arquivos de mídia')
ON CONFLICT (setting_key) DO UPDATE 
SET setting_value = '/opt/smart-signage/public/assets/uploads';

-- 2. Corrigir filePath nos registros de mídia existentes
-- Substituir caminhos do diretório do projeto pelo diretório de instalação
UPDATE medias
SET file_path = REPLACE(
    REPLACE(
        REPLACE(
            file_path,
            '/home/smartchannel/smartsignage-pro-main/public/assets/uploads',
            '/opt/smart-signage/public/assets/uploads'
        ),
        '/home/smartchannel/smartsignage-pro/public/assets/uploads',
        '/opt/smart-signage/public/assets/uploads'
    ),
    './public/assets/uploads',
    '/opt/smart-signage/public/assets/uploads'
)
WHERE file_path LIKE '%/home/smartchannel/%'
   OR file_path LIKE './public/assets/uploads%'
   OR file_path NOT LIKE '/opt/smart-signage/%';

-- 3. Verificar resultado
SELECT 
    media_id,
    name,
    file_path,
    CASE 
        WHEN file_path LIKE '/opt/smart-signage/%' THEN '✅ Correto'
        ELSE '❌ Precisa correção'
    END as status
FROM medias
ORDER BY media_id;

-- 4. Verificar configuração
SELECT 
    setting_key,
    setting_value,
    CASE 
        WHEN setting_value = '/opt/smart-signage/public/assets/uploads' THEN '✅ Correto'
        ELSE '❌ Precisa correção'
    END as status
FROM system_settings
WHERE setting_key = 'media.storage.path';

