-- =============================================
-- Parte 18: Telemetria de playback e observação
-- =============================================

CREATE TABLE IF NOT EXISTS playback_events (
    playback_event_id BIGSERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    event_uid TEXT NOT NULL,
    boot_id TEXT NOT NULL,
    sequence BIGINT NOT NULL,
    playback_session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    media_id TEXT,
    media_name TEXT,
    media_type TEXT,
    media_duration_ms BIGINT,
    playback JSONB NOT NULL DEFAULT '{}'::jsonb,
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_playback_events_totem
        FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    CONSTRAINT uq_playback_events_uid UNIQUE (totem_id, event_uid),
    CONSTRAINT uq_playback_events_boot_sequence UNIQUE (totem_id, boot_id, sequence),
    CONSTRAINT chk_playback_events_sequence CHECK (sequence >= 0),
    CONSTRAINT chk_playback_events_type CHECK (
        event_type IN (
            'media.play.started',
            'media.play.ended',
            'media.play.error',
            'player.observation.sample'
        )
    ),
    CONSTRAINT chk_playback_events_playback_object CHECK (jsonb_typeof(playback) = 'object'),
    CONSTRAINT chk_playback_events_context_object CHECK (jsonb_typeof(context) = 'object'),
    CONSTRAINT chk_playback_events_metrics_object CHECK (jsonb_typeof(metrics) = 'object')
);

COMMENT ON TABLE playback_events IS 'Eventos de playback idempotentes enviados em lote pelos players';
COMMENT ON COLUMN playback_events.event_uid IS 'eventId definido pelo player, único por totem';
COMMENT ON COLUMN playback_events.sequence IS 'Sequência monotônica dentro de boot_id';

-- Compatibilidade para reaplicações após versões iniciais da telemetria v2.
ALTER TABLE playback_events
    ADD COLUMN IF NOT EXISTS metrics JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
    ALTER TABLE playback_events
        DROP CONSTRAINT IF EXISTS chk_playback_events_type;
    ALTER TABLE playback_events
        ADD CONSTRAINT chk_playback_events_type CHECK (
            event_type IN (
                'media.play.started',
                'media.play.ended',
                'media.play.error',
                'player.observation.sample'
            )
        );
    ALTER TABLE playback_events
        DROP CONSTRAINT IF EXISTS chk_playback_events_metrics_object;
    ALTER TABLE playback_events
        ADD CONSTRAINT chk_playback_events_metrics_object
        CHECK (jsonb_typeof(metrics) = 'object');
END $$;

CREATE TABLE IF NOT EXISTS totem_playback_state (
    totem_id INTEGER PRIMARY KEY,
    boot_id TEXT NOT NULL,
    highest_sequence BIGINT NOT NULL,
    playback_session_id TEXT NOT NULL,
    event_uid TEXT NOT NULL,
    event_type TEXT NOT NULL,
    playback_status TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    media_id TEXT,
    media_name TEXT,
    media_type TEXT,
    media_duration_ms BIGINT,
    playback JSONB NOT NULL DEFAULT '{}'::jsonb,
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_totem_playback_state_totem
        FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    CONSTRAINT chk_totem_playback_state_status
        CHECK (playback_status IN ('playing', 'ended', 'error'))
);

COMMENT ON TABLE totem_playback_state IS 'Linha quente com o estado de playback mais recente de cada totem';

CREATE TABLE IF NOT EXISTS telemetry_observation_leases (
    totem_id INTEGER PRIMARY KEY,
    observer_user_id INTEGER NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    interval_seconds INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    renewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_telemetry_observation_lease_totem
        FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    CONSTRAINT fk_telemetry_observation_lease_user
        FOREIGN KEY (observer_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_telemetry_observation_interval
        CHECK (interval_seconds BETWEEN 1 AND 30)
);

COMMENT ON TABLE telemetry_observation_leases IS 'Lease explícito e independente para aumentar temporariamente a telemetria do player';

CREATE INDEX IF NOT EXISTS idx_playback_events_totem_occurred
    ON playback_events(totem_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_playback_events_session
    ON playback_events(totem_id, playback_session_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_playback_events_type_occurred
    ON playback_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_playback_events_received
    ON playback_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_totem_playback_state_updated
    ON totem_playback_state(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_observation_expires
    ON telemetry_observation_leases(expires_at);
