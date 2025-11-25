-- Migration: Add event_logs table for important events tracking
-- Date: 2025-01-XX
-- Description: Tabela para registrar eventos importantes no banco de dados
--              (playback de vídeo, exibição de anúncios, BI, campanhas)

CREATE TABLE IF NOT EXISTS event_logs (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    totem_id INTEGER,
    campaign_id INTEGER,
    playlist_id INTEGER,
    media_id INTEGER,
    metadata JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE SET NULL,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL,
    FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) ON DELETE SET NULL,
    FOREIGN KEY (media_id) REFERENCES medias(media_id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_event_logs_event_type ON event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_event_logs_totem_id ON event_logs(totem_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_campaign_id ON event_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_playlist_id ON event_logs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_media_id ON event_logs(media_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_timestamp ON event_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_event_logs_entity ON event_logs(entity_type, entity_id);

-- Índice composto para queries comuns de BI
CREATE INDEX IF NOT EXISTS idx_event_logs_bi ON event_logs(totem_id, campaign_id, timestamp);

COMMENT ON TABLE event_logs IS 'Registra eventos importantes do sistema para BI, relatórios e auditoria';
COMMENT ON COLUMN event_logs.event_type IS 'Tipo do evento (video_playback_start, ad_display_start, etc)';
COMMENT ON COLUMN event_logs.entity_type IS 'Tipo da entidade relacionada (media, campaign, totem, etc)';
COMMENT ON COLUMN event_logs.metadata IS 'Dados adicionais do evento em formato JSON';

