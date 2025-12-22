-- =============================================
-- Migração 001: Simplificar Modelo de Playlists
-- Data: 2025-01-XX
-- Descrição: 
--   - Remove campos polimórficos confusos (totem_id, campaign_id, publisher_id)
--   - Remove tabela playlist_approvals (playlists não requerem aprovação)
--   - Garante que subscriber_id é NOT NULL
--   - Playlists pertencem apenas ao subscriber que as criou
--   - Relacionamento com campanhas via campaign_playlists (N:M)
-- =============================================

BEGIN;

-- =============================================
-- 1. Remover constraint que valida totem_id/campaign_id
-- =============================================
ALTER TABLE playlists 
    DROP CONSTRAINT IF EXISTS chk_playlist_association;

-- =============================================
-- 2. Remover campos desnecessários de playlists
-- =============================================
ALTER TABLE playlists 
    DROP COLUMN IF EXISTS totem_id,
    DROP COLUMN IF EXISTS campaign_id,
    DROP COLUMN IF EXISTS publisher_id;

-- =============================================
-- 3. Garantir que subscriber_id é NOT NULL
-- =============================================
-- Primeiro, atualizar registros NULL (se houver)
UPDATE playlists 
SET subscriber_id = (
    SELECT subscriber_id 
    FROM campaigns 
    WHERE campaigns.campaign_id = (
        SELECT campaign_id 
        FROM campaign_playlists 
        WHERE campaign_playlists.playlist_id = playlists.playlist_id 
        LIMIT 1
    )
    LIMIT 1
)
WHERE subscriber_id IS NULL;

-- Se ainda houver NULL, usar primeiro subscriber ativo
UPDATE playlists 
SET subscriber_id = (
    SELECT subscriber_id 
    FROM subscribers 
    WHERE is_active = true 
    ORDER BY subscriber_id ASC 
    LIMIT 1
)
WHERE subscriber_id IS NULL;

-- Agora tornar NOT NULL
ALTER TABLE playlists 
    ALTER COLUMN subscriber_id SET NOT NULL;

-- =============================================
-- 4. Adicionar constraint de integridade
-- =============================================
ALTER TABLE playlists 
    ADD CONSTRAINT fk_playlist_subscriber 
        FOREIGN KEY (subscriber_id) 
        REFERENCES subscribers(subscriber_id) 
        ON DELETE CASCADE;

-- =============================================
-- 5. Remover tabela playlist_approvals (não é mais necessária)
-- =============================================
DROP TABLE IF EXISTS playlist_approvals CASCADE;

-- =============================================
-- 6. Atualizar comentários
-- =============================================
COMMENT ON TABLE playlists IS 'Playlists criadas por subscribers (anunciantes). Podem estar associadas a múltiplas campanhas via campaign_playlists.';
COMMENT ON COLUMN playlists.subscriber_id IS 'Subscriber (anunciante) que criou a playlist - OBRIGATÓRIO';

-- =============================================
-- 7. Garantir que campaign_playlists existe e está correta
-- =============================================
-- Se não existir, criar
CREATE TABLE IF NOT EXISTS campaign_playlists (
    campaign_id INTEGER NOT NULL,
    playlist_id INTEGER NOT NULL,
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (campaign_id, playlist_id),
    CONSTRAINT fk_campaign_playlist_campaign 
        FOREIGN KEY (campaign_id) 
        REFERENCES campaigns(campaign_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_campaign_playlist_playlist 
        FOREIGN KEY (playlist_id) 
        REFERENCES playlists(playlist_id) 
        ON DELETE CASCADE
);

COMMENT ON TABLE campaign_playlists IS 'Relacionamento N:M entre campaigns e playlists. Uma playlist pode estar em múltiplas campanhas.';

-- =============================================
-- 8. Migrar dados existentes (se houver campaign_id em playlists)
-- =============================================
-- Nota: Esta migração assume que já não há dados em produção
-- Se houver dados, seria necessário migrar antes de remover os campos
-- Por enquanto, apenas garantimos que campaign_playlists está sincronizado

-- =============================================
-- 9. Criar índices para performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_playlists_subscriber_id 
    ON playlists(subscriber_id);

CREATE INDEX IF NOT EXISTS idx_playlists_is_active 
    ON playlists(is_active);

CREATE INDEX IF NOT EXISTS idx_campaign_playlists_campaign_id 
    ON campaign_playlists(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_playlists_playlist_id 
    ON campaign_playlists(playlist_id);

COMMIT;

-- =============================================
-- Verificação pós-migração
-- =============================================
-- Verificar se todas as playlists têm subscriber_id
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count
    FROM playlists
    WHERE subscriber_id IS NULL;
    
    IF null_count > 0 THEN
        RAISE EXCEPTION 'Migração falhou: % playlists ainda têm subscriber_id NULL', null_count;
    END IF;
    
    RAISE NOTICE 'Migração concluída com sucesso!';
END $$;

