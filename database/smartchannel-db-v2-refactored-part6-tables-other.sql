-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 6: Outras Tabelas (Analytics, Logs, OTA, etc.)
-- =============================================

-- =============================================
-- ANALYTICS E MONITORAMENTO
-- =============================================

CREATE TABLE IF NOT EXISTS analytics_sessions (
    session_id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL, -- FK para totems
    
    start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    
    metadata JSONB, -- Dados adicionais da sessão
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_emotions (
    emotion_id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL, -- FK para analytics_sessions
    totem_id INTEGER NOT NULL, -- FK para totems (denormalizado para performance)
    
    emotion_type TEXT NOT NULL, -- happy, sad, neutral, angry, surprised
    confidence REAL NOT NULL, -- 0.0 a 1.0
    detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    metadata JSONB,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS analytics_gestures (
    gesture_id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL, -- FK para analytics_sessions
    totem_id INTEGER NOT NULL, -- FK para totems
    
    gesture_type TEXT NOT NULL, -- wave, point, touch, etc.
    confidence REAL NOT NULL,
    detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    metadata JSONB,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS execution_logs (
    log_id BIGSERIAL PRIMARY KEY, -- BIGSERIAL para escalar
    totem_id INTEGER NOT NULL, -- FK para totems
    campaign_id INTEGER, -- FK para campaigns
    playlist_id INTEGER, -- FK para playlists
    media_id INTEGER, -- FK para medias
    
    -- Derivação para performance
    publisher_id INTEGER, -- FK para publishers (derivado de totem_id → local_id → publisher_id)
    subscriber_id INTEGER, -- FK para subscribers (derivado de campaign_id)
    
    event_type TEXT NOT NULL, 
        -- play_start, play_end, play_error, 
        -- schedule_start, schedule_end,
        -- interaction_start, interaction_end
    
    event_data JSONB, -- Dados do evento
    
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    metadata JSONB,
    is_active BOOLEAN DEFAULT true
);

COMMENT ON TABLE execution_logs IS 'Logs de execução de campanhas/mídias nos totens';
COMMENT ON COLUMN execution_logs.publisher_id IS 'Publisher do totem (denormalizado para performance)';
COMMENT ON COLUMN execution_logs.subscriber_id IS 'Subscriber da campanha (denormalizado para performance)';

-- Índice parcial para logs recentes será criado na parte de índices

CREATE TABLE IF NOT EXISTS event_logs (
    log_id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- campaign, media, totem, playlist, etc.
    entity_id INTEGER,
    
    totem_id INTEGER,
    campaign_id INTEGER,
    playlist_id INTEGER,
    media_id INTEGER,
    publisher_id INTEGER,
    subscriber_id INTEGER,
    
    user_id INTEGER, -- FK para users (quem gerou o evento)
    
    metadata JSONB,
    severity TEXT DEFAULT 'info', -- debug, info, warning, error, critical
    is_active BOOLEAN DEFAULT true,
    
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- DISPATCHER-TOTEM LOGS
-- =============================================

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
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_dispatcher_log_totem 
        FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    CONSTRAINT fk_dispatcher_log_campaign 
        FOREIGN KEY (selected_campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL,
    CONSTRAINT fk_dispatcher_log_playlist 
        FOREIGN KEY (selected_playlist_id) REFERENCES playlists(playlist_id) ON DELETE SET NULL
);

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

-- =============================================
-- DISPATCHER TIMELINE (Tabular/indexável para UI)
-- =============================================
-- Objetivo:
--  - Evitar filtros pesados em JSONB no dispatcher_log
--  - Permitir group-by por Local (categoria) e Campanha (categoria dominante)
--  - Manter payloads completos (plan/events/candidates) para replay/auditoria

CREATE TABLE IF NOT EXISTS dispatcher_decisions (
    decision_id BIGSERIAL PRIMARY KEY,

    -- Link opcional com dispatcher_log (quando gravado pelo gateway)
    log_id INTEGER,

    -- Contexto
    totem_id INTEGER NOT NULL,
    smart_tv_id INTEGER, -- futuro (decisão por TV)

    local_id INTEGER,
    publisher_id INTEGER NOT NULL,

    -- Dominantes (group-by rápido)
    dominant_campaign_id INTEGER,
    dominant_subscriber_id INTEGER,

    -- Categorias/segmentos (denormalizado para performance)
    local_category_segment TEXT,
    dominant_campaign_category_segment TEXT,

    -- Janela / replay
    decision_mode TEXT NOT NULL DEFAULT 'MIXED', -- MIXED | SINGLE_WINNER
    window_seconds INTEGER NOT NULL DEFAULT 600,
    bucket_start TIMESTAMPTZ NOT NULL,
    bucket_end TIMESTAMPTZ NOT NULL,
    ref_timestamp TIMESTAMPTZ NOT NULL,
    seed_hash TEXT,
    context_snapshot_hash TEXT,

    -- Status para UI
    status TEXT NOT NULL DEFAULT 'despachado', -- solicitado|despachado|ativo|expirado|erro
    severity TEXT DEFAULT 'info', -- debug|info|warning|error|critical
    has_error BOOLEAN DEFAULT false,

    -- Performance
    execution_time_ms INTEGER,
    from_cache BOOLEAN DEFAULT false,
    cache_key TEXT,

    -- Payloads completos (replay)
    dispatch_plan JSONB,
    events JSONB,
    candidates JSONB,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dispatcher_decision_campaigns (
    id BIGSERIAL PRIMARY KEY,
    decision_id BIGINT NOT NULL,

    campaign_id INTEGER NOT NULL,
    subscriber_id INTEGER,
    commercial_tier TEXT,
    scope TEXT, -- direct|group

    share_percent NUMERIC(5, 2),
    target_seconds INTEGER,
    used_seconds INTEGER,

    skips_max_impressions INTEGER DEFAULT 0,
    skips_max_consecutive INTEGER DEFAULT 0,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dispatcher_decision_items (
    id BIGSERIAL PRIMARY KEY,
    decision_id BIGINT NOT NULL,

    order_index INTEGER NOT NULL,
    campaign_id INTEGER,
    playlist_id INTEGER,
    media_id INTEGER,

    display_seconds INTEGER,
    source TEXT, -- campaign_playlist, campaign_medias, etc.

    -- offsets determinísticos (replay)
    playlist_rr_index INTEGER,
    item_rr_index INTEGER,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Opcional: eventos tabulares (timeline super rápida). Mantemos junto do schema para uso futuro.
CREATE TABLE IF NOT EXISTS dispatcher_events (
    event_id BIGSERIAL PRIMARY KEY,
    decision_id BIGINT NOT NULL,

    event_type TEXT NOT NULL,
    reason_code TEXT,
    severity TEXT DEFAULT 'info',
    ts TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    totem_id INTEGER,
    publisher_id INTEGER,
    subscriber_id INTEGER,
    campaign_id INTEGER,
    playlist_id INTEGER,
    media_id INTEGER,

    data JSONB,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interaction_logs (
    interaction_id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL, -- FK para totems
    tag_id INTEGER, -- FK para tags (RFID, NFC, QR, etc.)
    person_id INTEGER, -- FK para recognized_persons
    
    interaction_type TEXT NOT NULL, -- tag_scanned, face_recognized, gesture_detected
    interaction_data JSONB,
    is_active BOOLEAN DEFAULT true,
    
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- ML/AI
-- =============================================

CREATE TABLE IF NOT EXISTS totem_ml_config (
    config_id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL UNIQUE, -- FK para totems (1:1)
    
    emotion_detection_enabled BOOLEAN DEFAULT false,
    gesture_detection_enabled BOOLEAN DEFAULT false,
    face_recognition_enabled BOOLEAN DEFAULT false,
    behavior_analysis_enabled BOOLEAN DEFAULT false,
    
    config JSONB DEFAULT '{}'::jsonb, -- Configurações específicas de ML
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emotion_data (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL, -- FK para analytics_sessions (sem FK explícita por enquanto)
    totem_id INTEGER NOT NULL, -- FK para totems
    
    emotion TEXT NOT NULL,
    confidence REAL NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    metadata JSONB,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS gesture_data (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL, -- FK para analytics_sessions
    totem_id INTEGER NOT NULL, -- FK para totems
    
    gesture TEXT NOT NULL,
    confidence REAL NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    metadata JSONB,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS behavior_data (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL, -- FK para analytics_sessions
    totem_id INTEGER NOT NULL, -- FK para totems
    
    behavior_type TEXT NOT NULL,
    duration_seconds INTEGER,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    metadata JSONB,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS tags (
    tag_id SERIAL PRIMARY KEY,
    tag_type TEXT NOT NULL, -- RFID, NFC, QR, barcode
    tag_value TEXT NOT NULL UNIQUE,
    tag_name TEXT,
    
    subscriber_id INTEGER, -- FK para subscribers (se tag pertence a subscriber)
    publisher_id INTEGER, -- FK para publishers (se tag pertence a publisher)
    
    metadata JSONB,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_tag_type 
        CHECK (tag_type IN ('RFID', 'NFC', 'QR', 'barcode', 'unknown'))
);

CREATE TABLE IF NOT EXISTS recognized_persons (
    person_id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL, -- FK para totems
    
    name TEXT,
    features JSONB NOT NULL, -- Features faciais (vetor)
    confidence REAL,
    
    metadata JSONB,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- CONTROLE REMOTO
-- =============================================

CREATE TABLE IF NOT EXISTS remote_commands (
    command_id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL, -- FK para totems
    user_id INTEGER NOT NULL, -- FK para users (quem criou o comando)
    
    command_type TEXT NOT NULL, 
        -- restart, reboot, update, play, pause, 
        -- load_playlist, clear_cache, ping
    
    status TEXT DEFAULT 'pending', 
        -- pending, sent, executing, completed, failed, timeout
    
    parameters JSONB, -- Parâmetros do comando
    response JSONB, -- Resposta do totem
    
    sent_at TIMESTAMP,
    executed_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_remote_command_type 
        CHECK (command_type IN ('restart', 'reboot', 'update', 'play', 'pause', 
                                'load_playlist', 'request_playlist', 'clear_cache', 'ping', 'custom')),
    CONSTRAINT chk_remote_command_status 
        CHECK (status IN ('pending', 'sent', 'executing', 'completed', 'failed', 'timeout'))
);

-- =============================================
-- OTA UPDATES
-- =============================================

CREATE TABLE IF NOT EXISTS ota_updates (
    id SERIAL PRIMARY KEY,
    version TEXT NOT NULL,
    platform TEXT NOT NULL, -- webos, tizen, android, linux, windows, all
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    checksum TEXT NOT NULL,
    description TEXT,
    changelog TEXT,
    is_mandatory BOOLEAN DEFAULT false,
    min_version TEXT,
    max_version TEXT,
    rollout_percentage INTEGER DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'draft', 
        -- draft, testing, active, paused, completed, cancelled
    is_active BOOLEAN DEFAULT true,
    
    created_by INTEGER, -- FK para users
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_ota_platform 
        CHECK (platform IN ('webos', 'tizen', 'android', 'linux', 'windows', 'all')),
    CONSTRAINT chk_ota_status 
        CHECK (status IN ('draft', 'testing', 'active', 'paused', 'completed', 'cancelled')),
    CONSTRAINT chk_ota_rollout 
        CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100)
);

-- Estado agregado por totem (alinhado a otaUpdateService.updateTotemStatus)
CREATE TABLE IF NOT EXISTS totem_update_status (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL UNIQUE, -- FK para totems
    current_version TEXT NOT NULL DEFAULT '1.0.0',
    available_version TEXT,
    update_status TEXT NOT NULL DEFAULT 'up_to_date',
        -- up_to_date, update_available, downloading, installing, failed, rollback
    last_check TIMESTAMP,
    last_update TIMESTAMP,
    error_message TEXT,
    ota_update_id INTEGER, -- pacote OTA em curso (opcional)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_totem_update_status_state
        CHECK (update_status IN ('up_to_date', 'update_available', 'downloading', 'installing', 'failed', 'rollback'))
);

-- Templates de publicação rápida (Studio — dashboard dinâmico)
CREATE TABLE IF NOT EXISTS publish_templates (
    template_id SERIAL PRIMARY KEY,
    preset TEXT NOT NULL,
    segment TEXT,
    title TEXT NOT NULL,
    description TEXT,
    headline TEXT,
    featured BOOLEAN DEFAULT false,
    featured_sort INTEGER DEFAULT 0,
    recommended_duration_ms INTEGER DEFAULT 10000,
    accent_color TEXT,
    background_css TEXT,
    preferred_orientation TEXT DEFAULT 'landscape',
    icon_key TEXT DEFAULT 'campaign',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_publish_templates_preset
        CHECK (preset IN ('menu', 'promotion', 'ad', 'announcement', 'institutional')),
    CONSTRAINT chk_publish_templates_orientation
        CHECK (preferred_orientation IN ('portrait', 'landscape'))
);

-- Cardápio digital por anunciante (tenant)
CREATE TABLE IF NOT EXISTS menu_categories (
    category_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_products (
    product_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER NOT NULL,
    category_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12, 2),
    currency TEXT DEFAULT 'BRL',
    media_id INTEGER,
    sort_order INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- SMARTDISPLAYFX
-- =============================================

CREATE TABLE IF NOT EXISTS fx_sites (
    site_id TEXT PRIMARY KEY, -- ID único do site (ex: "shopping-center-1")
    name TEXT NOT NULL,
    description TEXT,
    location JSONB, -- Coordenadas, endereço, etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fx_totem_sites (
    totem_id INTEGER NOT NULL, -- FK para totems
    site_id TEXT NOT NULL, -- FK para fx_sites
    position JSONB, -- Posição do totem no site
    is_active BOOLEAN DEFAULT true,
    
    PRIMARY KEY (totem_id, site_id)
);

-- Telemetria de execução de efeitos SmartDisplayFX
CREATE TABLE IF NOT EXISTS fx_telemetry (
    id BIGSERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL REFERENCES totems(totem_id) ON DELETE CASCADE,
    effect_id TEXT NOT NULL,
    event_id TEXT,
    content_id INTEGER,
    planned_start_ts TIMESTAMP,
    actual_start_ts TIMESTAMP,
    ended_at TIMESTAMP,
    duration_ms INTEGER,
    avg_fps NUMERIC(10,2),
    status TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE fx_telemetry IS 'Telemetria de execução de efeitos FX nos totens';

CREATE INDEX IF NOT EXISTS idx_fx_telemetry_totem ON fx_telemetry(totem_id);
CREATE INDEX IF NOT EXISTS idx_fx_telemetry_effect ON fx_telemetry(effect_id);
CREATE INDEX IF NOT EXISTS idx_fx_telemetry_created ON fx_telemetry(created_at DESC);

-- =============================================
-- AUDITORIA E SEGURANÇA
-- =============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER, -- FK para users (NULL se ação automática)
    action TEXT NOT NULL, -- create, update, delete, approve, reject, login, logout
    entity TEXT NOT NULL, -- media, campaign, totem, playlist, etc.
    entity_id INTEGER,
    
    publisher_id INTEGER, -- FK para publishers (contexto da ação)
    subscriber_id INTEGER, -- FK para subscribers (contexto da ação)
    
    metadata JSONB, -- Dados adicionais
    ip_address TEXT,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tokens de dispositivos (players, totens, Smart TVs)
CREATE TABLE IF NOT EXISTS device_tokens (
    device_token_id SERIAL PRIMARY KEY,
    
    -- Identificação do dispositivo
    totem_id INTEGER,      -- FK para totems (se aplicável)
    smart_tv_id INTEGER,   -- FK para smart_tvs (se aplicável)
    
    uin TEXT,              -- UIN do totem (quando disponível)
    device_id TEXT,        -- ID do dispositivo (TV, SBC, etc.)
    platform TEXT,         -- webos, tizen, android, linux, windows, browser, etc.
    app_version TEXT,      -- Versão do app/player
    
    -- Token de autenticação
    token TEXT NOT NULL UNIQUE,          -- Token de acesso curto (para validação rápida)
    refresh_token TEXT,                  -- Opcional: token de renovação mais longo
    status TEXT NOT NULL DEFAULT 'active', 
        -- active, revoked, expired
    
    -- Telemetria básica
    ip_address TEXT,
    user_agent TEXT,
    last_heartbeat TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_device_token_status 
        CHECK (status IN ('active', 'revoked', 'expired'))
);

COMMENT ON TABLE device_tokens IS 'Tokens de autenticação e telemetria para dispositivos (totens, Smart TVs, players)';
COMMENT ON COLUMN device_tokens.totem_id IS 'FK opcional para totems (quando o dispositivo está vinculado a um totem)';
COMMENT ON COLUMN device_tokens.smart_tv_id IS 'FK opcional para smart_tvs (quando o dispositivo está vinculado a uma Smart TV específica)';
COMMENT ON COLUMN device_tokens.uin IS 'UIN do totem (Unique Identifier Number) usado para autenticação do player';
COMMENT ON COLUMN device_tokens.device_id IS 'Identificador do dispositivo (ex: device_id da Smart TV, SBC, etc.)';
COMMENT ON COLUMN device_tokens.platform IS 'Plataforma do player: webos, tizen, android, linux, windows, browser, etc.';
COMMENT ON COLUMN device_tokens.app_version IS 'Versão do aplicativo/player instalado no dispositivo';
COMMENT ON COLUMN device_tokens.token IS 'Token de acesso emitido para o dispositivo (curto prazo)';
COMMENT ON COLUMN device_tokens.refresh_token IS 'Token de renovação (longo prazo), opcional';
COMMENT ON COLUMN device_tokens.status IS 'Status do token: active, revoked ou expired';
COMMENT ON COLUMN device_tokens.last_heartbeat IS 'Último heartbeat/contato do dispositivo usando este token';
COMMENT ON COLUMN device_tokens.expires_at IS 'Data/hora de expiração deste token de dispositivo';

CREATE TABLE IF NOT EXISTS user_two_factor (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE, -- FK para users
    secret TEXT NOT NULL, -- Secret TOTP (criptografado)
    enabled BOOLEAN DEFAULT false,
    backup_codes TEXT[], -- Array de backup codes (criptografados)
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS two_factor_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL, -- FK para users
    code TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    success BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL, -- FK para users
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- RELATÓRIOS E EXPORTAÇÕES
-- =============================================

-- Queries SQL para exportação agendada (Excel, PDF, CSV)
CREATE TABLE IF NOT EXISTS export_queries (
    query_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    provider TEXT NOT NULL DEFAULT 'PostgreSQL',
    sql_query TEXT NOT NULL,
    database_config JSONB DEFAULT '{}',
    export_config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE export_queries IS 'Queries SQL para exportação (Excel, PDF, CSV)';

-- Agendamentos cron para execução de export_queries
CREATE TABLE IF NOT EXISTS export_schedules (
    schedule_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    query_id INTEGER NOT NULL REFERENCES export_queries(query_id) ON DELETE CASCADE,
    cron_expression TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    last_execution TIMESTAMP,
    next_execution TIMESTAMP,
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE export_schedules IS 'Agendamentos cron para execução de export_queries';

-- Histórico de execuções de exportação
CREATE TABLE IF NOT EXISTS export_executions (
    execution_id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES export_schedules(schedule_id) ON DELETE SET NULL,
    query_id INTEGER NOT NULL REFERENCES export_queries(query_id) ON DELETE CASCADE,
    job_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    records_exported INTEGER DEFAULT 0,
    file_path TEXT,
    file_size BIGINT,
    error_message TEXT,
    execution_log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE export_executions IS 'Histórico de execuções de exportação';

CREATE INDEX IF NOT EXISTS idx_export_executions_schedule ON export_executions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_export_executions_query ON export_executions(query_id);
CREATE INDEX IF NOT EXISTS idx_export_executions_status ON export_executions(status);
CREATE INDEX IF NOT EXISTS idx_export_executions_created ON export_executions(created_at DESC);

CREATE TABLE IF NOT EXISTS reports (
    report_id SERIAL PRIMARY KEY,
    type TEXT NOT NULL, 
        -- campaign, totem, publisher, subscriber, media, billing, analytics, custom
    
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending', 
        -- pending, generating, completed, failed
    
    format TEXT DEFAULT 'pdf', -- pdf, excel, csv, json
    file_path TEXT,
    file_size BIGINT,
    download_url TEXT,
    download_count INTEGER DEFAULT 0,
    
    filters JSONB, -- Filtros aplicados
    template TEXT,
    custom_fields JSONB,
    ai_analysis BOOLEAN DEFAULT false,
    metadata JSONB,
    is_active BOOLEAN DEFAULT true,
    
    generated_at TIMESTAMP,
    expires_at TIMESTAMP,
    
    created_by INTEGER, -- FK para users
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_report_type 
        CHECK (type IN ('campaign', 'totem', 'publisher', 'subscriber', 
                       'media', 'billing', 'analytics', 'custom')),
    CONSTRAINT chk_report_status 
        CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    CONSTRAINT chk_report_format 
        CHECK (format IN ('pdf', 'excel', 'csv', 'json'))
);

CREATE TABLE IF NOT EXISTS report_templates (
    template_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- campaign, totem, publisher, subscriber, etc.
    template_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_default BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    created_by INTEGER, -- FK para users
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- AGENDAMENTOS AVANÇADOS
-- =============================================

CREATE TABLE IF NOT EXISTS advanced_schedules (
    schedule_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    schedule_type TEXT NOT NULL, 
        -- campaign, playlist, campaign_activation, playlist_generation
    
    target_id INTEGER NOT NULL, -- campaign_id ou playlist_id
    cron_expression TEXT NOT NULL,
    schedule_config JSONB,
    
    enabled BOOLEAN DEFAULT true,
    last_execution TIMESTAMP,
    next_execution TIMESTAMP,
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_by INTEGER, -- FK para users
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_schedule_type 
        CHECK (schedule_type IN ('campaign', 'playlist', 
                                'campaign_activation', 'playlist_generation'))
);

-- =============================================
-- QR CODES E SHORT LINKS
-- =============================================

CREATE TABLE IF NOT EXISTS qr_codes (
    qr_id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL, -- FK para campaigns (QR code pertence a uma campanha)
    
    -- Identificação
    code TEXT UNIQUE NOT NULL, -- Código único do QR code
    title TEXT NOT NULL, -- Título/descrição do QR code
    description TEXT,
    
    -- Tipo e conteúdo
    qr_type TEXT DEFAULT 'url', -- 'url', 'text', 'wifi', 'contact', 'sms', 'email', 'phone'
    content TEXT NOT NULL, -- Conteúdo codificado no QR (URL, texto, etc.)
    url TEXT, -- URL para redirect (se qr_type = 'url')
    redirect_url TEXT, -- URL de redirecionamento após scan
    
    -- Aparência
    size INTEGER DEFAULT 200,
    color TEXT DEFAULT '#000000',
    background_color TEXT DEFAULT '#FFFFFF',
    error_correction_level TEXT DEFAULT 'M', -- 'L', 'M', 'Q', 'H'
    margin INTEGER DEFAULT 4,
    
    -- Imagem gerada
    image_url TEXT, -- URL/caminho da imagem do QR code gerada
    
    -- Tracking e limites
    scan_count INTEGER DEFAULT 0,
    last_scan_at TIMESTAMP,
    max_scans INTEGER, -- Limite máximo de scans (NULL = ilimitado)
    tracking_enabled BOOLEAN DEFAULT true,
    
    -- Validade
    expires_at TIMESTAMP, -- Data de expiração (NULL = não expira)
    
    -- Metadados extras
    metadata JSONB DEFAULT '{}'::jsonb, -- Campos adicionais (utm_params, deeplink_url, etc.)
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_qr_type CHECK (qr_type IN ('url', 'text', 'wifi', 'contact', 'sms', 'email', 'phone')),
    CONSTRAINT chk_error_correction_level CHECK (error_correction_level IN ('L', 'M', 'Q', 'H'))
);

COMMENT ON TABLE qr_codes IS 'QR Codes associados a campanhas';
COMMENT ON COLUMN qr_codes.campaign_id IS 'Campanha à qual o QR code pertence (obrigatório)';
COMMENT ON COLUMN qr_codes.code IS 'Código único identificador do QR code';
COMMENT ON COLUMN qr_codes.qr_type IS 'Tipo de conteúdo do QR code';
COMMENT ON COLUMN qr_codes.content IS 'Conteúdo codificado no QR (URL, texto, dados WiFi, etc.)';
COMMENT ON COLUMN qr_codes.metadata IS 'Metadados extras (utm_params, deeplink_url, etc.)';

CREATE TABLE IF NOT EXISTS short_links (
    link_id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL, -- FK para campaigns
    
    short_code TEXT UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    
    click_count INTEGER DEFAULT 0,
    last_click_at TIMESTAMP,
    
    metadata JSONB,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- DASHBOARD E UI
-- =============================================

CREATE TABLE IF NOT EXISTS dashboard_layouts (
    layout_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL, -- FK para users
    name TEXT NOT NULL,
    layout_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_default BOOLEAN DEFAULT false,
    is_shared BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- BACKUPS
-- =============================================

CREATE TABLE IF NOT EXISTS backups (
    id SERIAL PRIMARY KEY,
    backup_id TEXT UNIQUE NOT NULL,
    backup_type TEXT NOT NULL, -- full, database, uploads, config
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress', 
        -- in_progress, completed, failed
    is_active BOOLEAN DEFAULT true,
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by INTEGER, -- FK para users
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_backup_type 
        CHECK (backup_type IN ('full', 'database', 'uploads', 'config')),
    CONSTRAINT chk_backup_status 
        CHECK (status IN ('in_progress', 'completed', 'failed'))
);

-- =============================================
-- STRIPE INTEGRATION
-- =============================================

CREATE TABLE IF NOT EXISTS stripe_customers (
    id SERIAL PRIMARY KEY,
    subscriber_id INTEGER, -- FK para subscribers (opcional)
    publisher_id INTEGER, -- FK para publishers (opcional)
    
    stripe_customer_id TEXT UNIQUE NOT NULL,
    email TEXT,
    name TEXT,
    
    metadata JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_stripe_customer_reference 
        CHECK (subscriber_id IS NOT NULL OR publisher_id IS NOT NULL)
);

-- =============================================
-- SMART PLAYLISTS (playlist inteligente com IA)
-- =============================================
CREATE TABLE IF NOT EXISTS smart_playlists (
    smart_playlist_id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL, -- FK subscribers (anunciante)
    campaign_id INTEGER, -- FK campaigns (opcional)
    totem_id INTEGER, -- FK totems (opcional)
    name TEXT NOT NULL,
    description TEXT,
    target_audience TEXT,
    time_of_day TEXT,
    day_of_week TEXT,
    season TEXT,
    weather TEXT,
    location TEXT,
    content_type TEXT,
    duration INTEGER,
    max_items INTEGER,
    ai_enabled BOOLEAN DEFAULT false,
    rules JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'inactive',
        -- inactive, active, generating, error
    last_generated TIMESTAMP,
    next_generation TIMESTAMP,
    generated_items INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0,
    effectiveness REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_smart_playlist_status
        CHECK (status IN ('inactive', 'active', 'generating', 'error'))
);

COMMENT ON TABLE smart_playlists IS 'Playlists inteligentes (IA) por subscriber/campanha/totem';
COMMENT ON COLUMN smart_playlists.client_id IS 'Subscriber (anunciante) dono da smart playlist';

