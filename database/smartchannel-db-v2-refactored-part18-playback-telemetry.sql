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

CREATE TABLE IF NOT EXISTS playback_event_rollups_daily (
    rollup_date DATE NOT NULL,
    totem_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    media_key TEXT NOT NULL,
    media_id TEXT,
    media_name TEXT,
    media_type TEXT,
    event_count BIGINT NOT NULL DEFAULT 0,
    unique_sessions BIGINT NOT NULL DEFAULT 0,
    media_duration_ms_sum NUMERIC(20, 0) NOT NULL DEFAULT 0,
    first_occurred_at TIMESTAMPTZ NOT NULL,
    last_occurred_at TIMESTAMPTZ NOT NULL,
    consolidated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_playback_event_rollups_daily
        PRIMARY KEY (rollup_date, totem_id, event_type, media_key),
    CONSTRAINT fk_playback_event_rollups_daily_totem
        FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    CONSTRAINT chk_playback_event_rollups_daily_count CHECK (event_count >= 0),
    CONSTRAINT chk_playback_event_rollups_daily_sessions CHECK (unique_sessions >= 0)
);

COMMENT ON TABLE playback_event_rollups_daily IS
    'Agregado diário de playback; preenchido explicitamente por consolidate_playback_events(), sem cron automático';

CREATE OR REPLACE FUNCTION consolidate_playback_events(retention_days INTEGER DEFAULT 90)
RETURNS TABLE (
    rolled_up_rows BIGINT,
    deleted_events BIGINT,
    cutoff_date DATE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_cutoff DATE;
    v_rolled BIGINT := 0;
    v_deleted BIGINT := 0;
BEGIN
    IF retention_days IS NULL OR retention_days < 7 THEN
        RAISE EXCEPTION 'retention_days deve ser igual ou superior a 7';
    END IF;

    v_cutoff := CURRENT_DATE - retention_days;
    PERFORM pg_advisory_xact_lock(hashtext('consolidate_playback_events'));

    INSERT INTO playback_event_rollups_daily (
        rollup_date, totem_id, event_type, media_key, media_id, media_name, media_type,
        event_count, unique_sessions, media_duration_ms_sum,
        first_occurred_at, last_occurred_at, consolidated_at
    )
    SELECT
        occurred_at::date,
        totem_id,
        event_type,
        COALESCE(media_id, ''),
        media_id,
        MAX(media_name),
        MAX(media_type),
        COUNT(*),
        COUNT(DISTINCT playback_session_id),
        COALESCE(SUM(media_duration_ms), 0),
        MIN(occurred_at),
        MAX(occurred_at),
        CURRENT_TIMESTAMP
    FROM playback_events
    WHERE occurred_at < v_cutoff
    GROUP BY occurred_at::date, totem_id, event_type, COALESCE(media_id, ''), media_id
    ON CONFLICT (rollup_date, totem_id, event_type, media_key) DO UPDATE SET
        media_id = COALESCE(EXCLUDED.media_id, playback_event_rollups_daily.media_id),
        media_name = COALESCE(EXCLUDED.media_name, playback_event_rollups_daily.media_name),
        media_type = COALESCE(EXCLUDED.media_type, playback_event_rollups_daily.media_type),
        event_count = playback_event_rollups_daily.event_count + EXCLUDED.event_count,
        unique_sessions = playback_event_rollups_daily.unique_sessions + EXCLUDED.unique_sessions,
        media_duration_ms_sum =
            playback_event_rollups_daily.media_duration_ms_sum + EXCLUDED.media_duration_ms_sum,
        first_occurred_at =
            LEAST(playback_event_rollups_daily.first_occurred_at, EXCLUDED.first_occurred_at),
        last_occurred_at =
            GREATEST(playback_event_rollups_daily.last_occurred_at, EXCLUDED.last_occurred_at),
        consolidated_at = CURRENT_TIMESTAMP;
    GET DIAGNOSTICS v_rolled = ROW_COUNT;

    DELETE FROM playback_events WHERE occurred_at < v_cutoff;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    RETURN QUERY SELECT v_rolled, v_deleted, v_cutoff;
END;
$$;

COMMENT ON FUNCTION consolidate_playback_events(INTEGER) IS
    'Consolida eventos anteriores à retenção em rollup diário e só então remove os eventos brutos; execução é manual e transacional';

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
CREATE INDEX IF NOT EXISTS idx_playback_event_rollups_totem_date
    ON playback_event_rollups_daily(totem_id, rollup_date DESC);
