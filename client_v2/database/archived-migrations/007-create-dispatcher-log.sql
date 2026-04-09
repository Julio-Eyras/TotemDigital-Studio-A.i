-- Migration: Criar tabela dispatcher_log para auditoria de decisões do Dispatcher-Totem
-- Data: 2026-01-12
-- NOTA: Esta migration foi INTEGRADA no script principal:
--       - Tabela: smartchannel-db-v2-refactored-part6-tables-other.sql
--       - Foreign Keys: smartchannel-db-v2-refactored-part7-foreign-keys.sql
--       - Índices: smartchannel-db-v2-refactored-part8-indexes.sql
-- Este arquivo é mantido apenas para referência histórica.

CREATE TABLE IF NOT EXISTS dispatcher_log (
    log_id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    
    -- Dados da decisão
    selected_campaign_id INTEGER,
    selected_playlist_id INTEGER,
    selected_source VARCHAR(50), -- 'direct', 'group', 'campaign'
    selected_source_id INTEGER,
    priority INTEGER,
    
    -- Candidatos considerados
    candidates_count INTEGER DEFAULT 0,
    candidates JSONB, -- Array de candidatos com suas prioridades
    
    -- Validações realizadas
    temporal_validation BOOLEAN,
    technical_validation BOOLEAN,
    integrity_validation BOOLEAN,
    validation_details JSONB,
    
    -- Cache
    from_cache BOOLEAN DEFAULT false,
    cache_key TEXT,
    
    -- Metadados
    dispatch_plan JSONB, -- Plano completo gerado
    execution_time_ms INTEGER, -- Tempo de execução em milissegundos
    
    -- Auditoria
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_dispatcher_log_totem 
        FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    CONSTRAINT fk_dispatcher_log_campaign 
        FOREIGN KEY (selected_campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL,
    CONSTRAINT fk_dispatcher_log_playlist 
        FOREIGN KEY (selected_playlist_id) REFERENCES playlists(playlist_id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dispatcher_log_totem_timestamp 
    ON dispatcher_log(totem_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_dispatcher_log_timestamp 
    ON dispatcher_log(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_dispatcher_log_campaign 
    ON dispatcher_log(selected_campaign_id) 
    WHERE selected_campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dispatcher_log_playlist 
    ON dispatcher_log(selected_playlist_id) 
    WHERE selected_playlist_id IS NOT NULL;

-- Índice para queries de análise
CREATE INDEX IF NOT EXISTS idx_dispatcher_log_created_at 
    ON dispatcher_log(created_at DESC);

COMMENT ON TABLE dispatcher_log IS 'Log de auditoria de todas as decisões do Dispatcher-Totem';
COMMENT ON COLUMN dispatcher_log.totem_id IS 'Totem para o qual a decisão foi tomada';
COMMENT ON COLUMN dispatcher_log.timestamp IS 'Timestamp para o qual o plano foi gerado';
COMMENT ON COLUMN dispatcher_log.selected_campaign_id IS 'Campanha selecionada (se aplicável)';
COMMENT ON COLUMN dispatcher_log.selected_playlist_id IS 'Playlist selecionada';
COMMENT ON COLUMN dispatcher_log.selected_source IS 'Origem da seleção: direct (totem), group (grupo), campaign (campanha)';
COMMENT ON COLUMN dispatcher_log.candidates IS 'Array JSON com todos os candidatos considerados e suas métricas';
COMMENT ON COLUMN dispatcher_log.dispatch_plan IS 'Plano completo gerado (JSON)';
COMMENT ON COLUMN dispatcher_log.from_cache IS 'Indica se o resultado veio do cache';
COMMENT ON COLUMN dispatcher_log.execution_time_ms IS 'Tempo de execução em milissegundos';
