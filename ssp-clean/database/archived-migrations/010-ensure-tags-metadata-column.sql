-- Migração: Garantir coluna metadata JSONB na tabela tags
-- Data: 2026-01-21
-- Descrição: Adiciona coluna metadata se não existir (para compatibilidade com bancos antigos)

-- Verificar e adicionar coluna metadata se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tags' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE tags ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
        COMMENT ON COLUMN tags.metadata IS 'Metadados adicionais em formato JSONB para categorização e filtros';
    END IF;
END $$;

-- Criar índice GIN para queries eficientes em metadata (se não existir)
CREATE INDEX IF NOT EXISTS idx_tags_metadata ON tags USING GIN (metadata);

-- Comentário na tabela
COMMENT ON TABLE tags IS 'Tabela de tags (RFID, NFC, QR Code, Barcode) com suporte a metadata JSONB para categorização';
