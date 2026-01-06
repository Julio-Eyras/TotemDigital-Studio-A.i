-- =============================================
-- Migração 005: Adicionar subscriber_id na tabela locals e description em subscribers
-- =============================================
-- Permite que subscribers também tenham locals, totens e smart TVs
-- Adiciona campo description em subscribers para consistência com publishers
-- =============================================

-- Adicionar description em subscribers (se não existir)
ALTER TABLE subscribers 
ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN subscribers.description IS 'Descrição/observações sobre o assinante';

-- Adicionar coluna subscriber_id (opcional)
ALTER TABLE locals 
ADD COLUMN IF NOT EXISTS subscriber_id INTEGER;

-- Adicionar foreign key
ALTER TABLE locals
ADD CONSTRAINT fk_locals_subscriber 
    FOREIGN KEY (subscriber_id) 
    REFERENCES subscribers(subscriber_id) 
    ON DELETE CASCADE;

-- Ajustar constraint: local deve ter publisher_id OU subscriber_id (não ambos)
ALTER TABLE locals
DROP CONSTRAINT IF EXISTS chk_local_owner;

ALTER TABLE locals
ADD CONSTRAINT chk_local_owner 
    CHECK (
        (publisher_id IS NOT NULL AND subscriber_id IS NULL) OR
        (publisher_id IS NULL AND subscriber_id IS NOT NULL)
    );

-- Tornar publisher_id opcional (pode ser NULL se for subscriber)
ALTER TABLE locals
ALTER COLUMN publisher_id DROP NOT NULL;

-- Comentários
COMMENT ON COLUMN locals.subscriber_id IS 'Subscriber (assinante) dono deste local (alternativa a publisher_id)';
COMMENT ON COLUMN locals.publisher_id IS 'Publisher (publicador) dono deste local (alternativa a subscriber_id)';

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_locals_subscriber ON locals(subscriber_id) WHERE subscriber_id IS NOT NULL;
