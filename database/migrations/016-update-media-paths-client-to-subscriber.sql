-- =============================================
-- Migration 016: Atualizar caminhos de mídia
-- Migra caminhos de client-X para subscriber-X
-- =============================================
-- Data: 2026-02-16
-- Descrição: Atualiza file_path, thumbnail_url e preview_url na tabela medias
--            para usar subscriber-X em vez de client-X
-- =============================================

BEGIN;

-- Verificar quantos registros serão afetados
DO $$
DECLARE
    v_count_file_path INTEGER;
    v_count_thumbnail INTEGER;
    v_count_preview INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count_file_path
    FROM medias 
    WHERE file_path LIKE '%/client-%';
    
    SELECT COUNT(*) INTO v_count_thumbnail
    FROM medias 
    WHERE thumbnail_url LIKE '%/client-%';
    
    SELECT COUNT(*) INTO v_count_preview
    FROM medias 
    WHERE preview_url LIKE '%/client-%';
    
    RAISE NOTICE 'Registros a atualizar:';
    RAISE NOTICE '  file_path: %', v_count_file_path;
    RAISE NOTICE '  thumbnail_url: %', v_count_thumbnail;
    RAISE NOTICE '  preview_url: %', v_count_preview;
END $$;

-- Atualizar file_path
UPDATE medias 
SET file_path = REPLACE(file_path, '/client-', '/subscriber-') 
WHERE file_path LIKE '%/client-%';

-- Atualizar thumbnail_url
UPDATE medias 
SET thumbnail_url = REPLACE(thumbnail_url, '/client-', '/subscriber-') 
WHERE thumbnail_url LIKE '%/client-%';

-- Atualizar preview_url
UPDATE medias 
SET preview_url = REPLACE(preview_url, '/client-', '/subscriber-') 
WHERE preview_url LIKE '%/client-%';

-- Verificar resultado
DO $$
DECLARE
    v_remaining_file_path INTEGER;
    v_remaining_thumbnail INTEGER;
    v_remaining_preview INTEGER;
    v_total_subscriber INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_remaining_file_path
    FROM medias 
    WHERE file_path LIKE '%/client-%';
    
    SELECT COUNT(*) INTO v_remaining_thumbnail
    FROM medias 
    WHERE thumbnail_url LIKE '%/client-%';
    
    SELECT COUNT(*) INTO v_remaining_preview
    FROM medias 
    WHERE preview_url LIKE '%/client-%';
    
    SELECT COUNT(*) INTO v_total_subscriber
    FROM medias 
    WHERE file_path LIKE '%/subscriber-%';
    
    RAISE NOTICE 'Resultado da migração:';
    RAISE NOTICE '  Caminhos ainda com client-: %', v_remaining_file_path;
    RAISE NOTICE '  Thumbnails ainda com client-: %', v_remaining_thumbnail;
    RAISE NOTICE '  Previews ainda com client-: %', v_remaining_preview;
    RAISE NOTICE '  Total com subscriber-: %', v_total_subscriber;
    
    IF v_remaining_file_path > 0 OR v_remaining_thumbnail > 0 OR v_remaining_preview > 0 THEN
        RAISE WARNING 'Alguns caminhos ainda contêm "client-". Verifique manualmente.';
    END IF;
END $$;

COMMIT;

-- =============================================
-- Verificação pós-migração (opcional)
-- =============================================
-- Execute estas queries para verificar o resultado:
--
-- SELECT 
--     COUNT(*) FILTER (WHERE file_path LIKE '%/client-%') as paths_ainda_client,
--     COUNT(*) FILTER (WHERE file_path LIKE '%/subscriber-%') as paths_subscriber,
--     COUNT(*) as total
-- FROM medias;
--
-- SELECT media_id, name, file_path 
-- FROM medias 
-- WHERE file_path LIKE '%/client-%'
-- LIMIT 10;
