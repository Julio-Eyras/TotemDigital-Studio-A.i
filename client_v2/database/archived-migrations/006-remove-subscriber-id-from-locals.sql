-- =============================================
-- Migração 006: Remover subscriber_id da tabela locals
-- =============================================
-- Reverte a migração 005: subscribers não devem ter locais próprios
-- Locais pertencem apenas a publishers
-- Subscribers acessam locais através de planos e contratos
-- =============================================

-- Primeiro, verificar se existem locais com subscriber_id e migrar/remover
-- ATENÇÃO: Esta migração remove dados! Locais de subscribers serão deletados ou migrados
DO $$
DECLARE
    local_count INTEGER;
BEGIN
    -- Contar locais com subscriber_id
    SELECT COUNT(*) INTO local_count
    FROM locals
    WHERE subscriber_id IS NOT NULL;
    
    IF local_count > 0 THEN
        RAISE WARNING 'Encontrados % locais com subscriber_id. Estes serão removidos!', local_count;
        
        -- Opção 1: Deletar locais de subscribers (recomendado)
        -- Se houver totens ou smart TVs associados, eles também serão deletados (CASCADE)
        DELETE FROM locals WHERE subscriber_id IS NOT NULL;
        
        RAISE NOTICE 'Locais de subscribers removidos com sucesso';
    END IF;
END $$;

-- Remover índice
DROP INDEX IF EXISTS idx_locals_subscriber;

-- Remover foreign key
ALTER TABLE locals
DROP CONSTRAINT IF EXISTS fk_locals_subscriber;

-- Remover constraint chk_local_owner (será recriada)
ALTER TABLE locals
DROP CONSTRAINT IF EXISTS chk_local_owner;

-- Remover coluna subscriber_id
ALTER TABLE locals
DROP COLUMN IF EXISTS subscriber_id;

-- Recriar constraint: local deve ter publisher_id (obrigatório)
ALTER TABLE locals
ADD CONSTRAINT chk_local_owner 
    CHECK (publisher_id IS NOT NULL);

-- Tornar publisher_id obrigatório novamente
ALTER TABLE locals
ALTER COLUMN publisher_id SET NOT NULL;

-- Atualizar comentários
COMMENT ON COLUMN locals.publisher_id IS 'Publisher (publicador) dono deste local - obrigatório';
COMMENT ON TABLE locals IS 'Locais físicos dos publishers. Subscribers acessam locais através de planos e contratos.';

-- Log da migração
DO $$
BEGIN
    RAISE NOTICE 'Migração 006 concluída: subscriber_id removido de locals';
    RAISE NOTICE 'Locais agora pertencem apenas a publishers';
    RAISE NOTICE 'Subscribers devem acessar locais através de subscriber_publisher_access';
END $$;
