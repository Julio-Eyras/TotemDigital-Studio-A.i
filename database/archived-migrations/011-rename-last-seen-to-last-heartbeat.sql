-- Padronização: last_seen / last_seen_at → last_heartbeat em todas as tabelas
-- Execução idempotente: só renomeia se a coluna antiga existir e a nova não existir

-- smart_tvs: last_seen → last_heartbeat
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'smart_tvs' AND column_name = 'last_seen'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'smart_tvs' AND column_name = 'last_heartbeat'
    ) THEN
        ALTER TABLE smart_tvs RENAME COLUMN last_seen TO last_heartbeat;
        RAISE NOTICE 'smart_tvs: last_seen renomeado para last_heartbeat';
    END IF;
END $$;

-- device_tokens: last_seen_at → last_heartbeat
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'device_tokens' AND column_name = 'last_seen_at'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'device_tokens' AND column_name = 'last_heartbeat'
    ) THEN
        ALTER TABLE device_tokens RENAME COLUMN last_seen_at TO last_heartbeat;
        RAISE NOTICE 'device_tokens: last_seen_at renomeado para last_heartbeat';
    END IF;
END $$;

COMMENT ON COLUMN smart_tvs.last_heartbeat IS 'Último heartbeat/contato do dispositivo';
COMMENT ON COLUMN device_tokens.last_heartbeat IS 'Último heartbeat/contato do dispositivo usando este token';
