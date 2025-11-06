-- Smart Signage v2.0 - Schema SQL PostgreSQL
-- Adaptado para PostgreSQL 15+
-- Baseado no schema Prisma da v7.0.0
-- 
-- NOTA: Execute também database/reports-schema.sql para criar as tabelas de relatórios

-- =============================================
-- TABLES
-- =============================================

-- Clients
CREATE TABLE IF NOT EXISTS clients (
    client_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    wths TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    client_id INTEGER,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL, -- admin, manager, operator, viewer, client
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE SET NULL
);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para password_reset_tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Hosts
CREATE TABLE IF NOT EXISTS hosts (
    host_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    wths TEXT,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Locals
CREATE TABLE IF NOT EXISTS locals (
    local_id TEXT PRIMARY KEY,
    host_id INTEGER NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES hosts(host_id) ON DELETE CASCADE
);

-- Totems
CREATE TABLE IF NOT EXISTS totems (
    totem_id SERIAL PRIMARY KEY,
    identifier TEXT UNIQUE NOT NULL,
    uin TEXT UNIQUE, -- Unique Identifier Number (UIN) para validação do player
    device_id TEXT UNIQUE,
    local_id TEXT,
    description TEXT,
    config TEXT, -- JSON
    status TEXT DEFAULT 'offline', -- online, offline, error, maintenance
    version TEXT,
    firmware_version TEXT,
    ip_address TEXT,
    last_seen TIMESTAMP,
    last_heartbeat TIMESTAMP,
    active BOOLEAN DEFAULT true,
    blocked BOOLEAN DEFAULT false, -- Bloqueio manual do totem
    blocked_until TIMESTAMP, -- Bloqueio temporário até data/hora
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (local_id) REFERENCES locals(local_id) ON DELETE SET NULL
);

-- Smart TVs
CREATE TABLE IF NOT EXISTS smart_tvs (
    smartv_id TEXT PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    brand TEXT,
    model TEXT,
    ip_address TEXT,
    config TEXT, -- JSON
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    campaign_id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    campaign_type TEXT DEFAULT 'general', -- general, scheduled
    priority INTEGER DEFAULT 1,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    start_time TEXT,
    end_time TEXT,
    days_of_week TEXT, -- JSON array
    status TEXT DEFAULT 'draft', -- draft, active, paused, finished, deleted
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
);

-- Media
CREATE TABLE IF NOT EXISTS medias (
    media_id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    title TEXT,
    description TEXT,
    tags TEXT, -- JSON array
    version INTEGER,
    checksum TEXT,
    preview_url TEXT,
    status TEXT DEFAULT 'draft', -- draft, review, published, archived
    created_by INTEGER,
    file_path TEXT NOT NULL,
    media_type TEXT NOT NULL, -- image, video, audio
    duration_seconds INTEGER,
    size_bytes INTEGER,
    mime_type TEXT,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Playlists
CREATE TABLE IF NOT EXISTS playlists (
    playlist_id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    campaign_id INTEGER NOT NULL,
    name TEXT,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    medias TEXT, -- JSON array (legacy)
    loop BOOLEAN DEFAULT true,
    config TEXT, -- JSON
    is_active BOOLEAN DEFAULT true,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE
);

-- Playlist Items
CREATE TABLE IF NOT EXISTS playlist_items (
    item_id SERIAL PRIMARY KEY,
    playlist_id INTEGER NOT NULL,
    media_id INTEGER NOT NULL,
    order_index INTEGER DEFAULT 0,
    display_seconds INTEGER,
    transition TEXT,
    start_time_offset_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES medias(media_id) ON DELETE CASCADE,
    UNIQUE(playlist_id, order_index)
);

-- Campaign Playlists
CREATE TABLE IF NOT EXISTS campaign_playlists (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL,
    playlist_id INTEGER NOT NULL,
    priority INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    UNIQUE(campaign_id, playlist_id)
);

-- Campaign Totems
CREATE TABLE IF NOT EXISTS campaign_totems (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    campaign_id INTEGER NOT NULL,
    scheduled_start TIMESTAMP,
    scheduled_end TIMESTAMP,
    status TEXT DEFAULT 'pending', -- pending, active, completed, cancelled
    config TEXT, -- JSON
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    UNIQUE(campaign_id, totem_id)
);

-- QR Codes
CREATE TABLE IF NOT EXISTS qr_codes (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    qr_type TEXT DEFAULT 'promotion', -- promotion, info, link
    template TEXT,
    refresh_interval_ms INTEGER,
    deeplink_url TEXT,
    utm_params TEXT, -- JSON
    expires_at TIMESTAMP,
    max_scans INTEGER,
    scan_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE
);

-- Short Links
CREATE TABLE IF NOT EXISTS short_links (
    short_id TEXT PRIMARY KEY,
    campaign_id INTEGER NOT NULL,
    totem_id INTEGER,
    target_url TEXT NOT NULL,
    expires_at TIMESTAMP,
    max_scans INTEGER,
    scan_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE SET NULL
);

-- Remote Commands
CREATE TABLE IF NOT EXISTS remote_commands (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    request_id TEXT UNIQUE,
    command_type TEXT NOT NULL,
    command_data TEXT, -- JSON
    priority INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending', -- pending, executing, completed, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP,
    result TEXT,
    created_by INTEGER,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Analytics Sessions
CREATE TABLE IF NOT EXISTS analytics_sessions (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    session_start TIMESTAMP NOT NULL,
    session_end TIMESTAMP,
    total_interactions INTEGER DEFAULT 0,
    avg_emotion_score REAL,
    dominant_emotion TEXT,
    age_range TEXT,
    gender TEXT,
    location TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

-- Analytics Emotions
CREATE TABLE IF NOT EXISTS analytics_emotions (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    emotion TEXT NOT NULL,
    confidence REAL NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    face_detected BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES analytics_sessions(id) ON DELETE CASCADE
);

-- Analytics Gestures
CREATE TABLE IF NOT EXISTS analytics_gestures (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    gesture_type TEXT NOT NULL,
    coordinates TEXT, -- JSON
    confidence REAL NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    action_triggered TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES analytics_sessions(id) ON DELETE CASCADE
);

-- Analytics QR Scans
CREATE TABLE IF NOT EXISTS analytics_qr_scans (
    id SERIAL PRIMARY KEY,
    qr_code_id INTEGER NOT NULL,
    totem_id INTEGER NOT NULL,
    scan_timestamp TIMESTAMP NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    location TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (qr_code_id) REFERENCES qr_codes(id) ON DELETE CASCADE,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

-- AI Models
CREATE TABLE IF NOT EXISTS ai_models (
    id SERIAL PRIMARY KEY,
    model_name TEXT NOT NULL,
    model_type TEXT NOT NULL,
    version TEXT NOT NULL,
    file_url TEXT,
    file_size INTEGER,
    accuracy_score REAL,
    performance_score REAL,
    training_data_size INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Execution Logs
CREATE TABLE IF NOT EXISTS execution_logs (
    log_id SERIAL PRIMARY KEY,
    totem_id INTEGER,
    client_id INTEGER,
    campaign_id INTEGER,
    media_id INTEGER,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    status TEXT DEFAULT 'executed',
    play_success BOOLEAN DEFAULT true,
    error_code TEXT,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE SET NULL,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE SET NULL,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL
);

-- System Logs
CREATE TABLE IF NOT EXISTS system_logs (
    log_id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhook Configs
CREATE TABLE IF NOT EXISTS webhook_configs (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    events TEXT, -- JSON array
    secret TEXT NOT NULL,
    timeout_ms INTEGER DEFAULT 5000,
    retry_count INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhook Deliveries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    status_code INTEGER,
    error_message TEXT,
    delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (webhook_id) REFERENCES webhook_configs(id) ON DELETE CASCADE
);

-- Alert Rules
CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    metric TEXT NOT NULL,
    condition TEXT NOT NULL, -- gt, lt, eq, gte, lte
    threshold REAL NOT NULL,
    duration INTEGER DEFAULT 300, -- seconds
    is_active BOOLEAN DEFAULT true,
    notification_channels TEXT, -- JSON array
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alert Logs
CREATE TABLE IF NOT EXISTS alert_logs (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER NOT NULL,
    metric TEXT NOT NULL,
    value REAL NOT NULL,
    threshold REAL NOT NULL,
    condition TEXT NOT NULL,
    labels TEXT, -- JSON
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
);

-- ML Tables
CREATE TABLE IF NOT EXISTS emotion_data (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    emotion TEXT NOT NULL, -- happy, sad, angry, surprised, fearful, disgusted, neutral
    confidence REAL NOT NULL, -- 0-100
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_demographics TEXT, -- JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gesture_data (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    gesture TEXT NOT NULL, -- wave, point, thumbs_up, thumbs_down, stop, ok, peace, other
    confidence REAL NOT NULL, -- 0-100
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action_taken TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS behavior_data (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    totem_id INTEGER NOT NULL,
    duration INTEGER NOT NULL, -- seconds
    interactions INTEGER DEFAULT 0,
    emotion_changes INTEGER DEFAULT 0,
    gesture_count INTEGER DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ml_models (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- emotion, gesture, face, behavior
    version TEXT NOT NULL,
    file_path TEXT NOT NULL,
    accuracy REAL,
    status TEXT DEFAULT 'active', -- active, inactive, training, testing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS totem_ml_config (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER UNIQUE NOT NULL,
    emotion_detection_enabled BOOLEAN DEFAULT true,
    gesture_recognition_enabled BOOLEAN DEFAULT true,
    face_detection_enabled BOOLEAN DEFAULT true,
    confidence_threshold REAL DEFAULT 70.0,
    processing_interval INTEGER DEFAULT 1000,
    max_sessions_per_day INTEGER DEFAULT 1000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ml_sessions (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    totem_id INTEGER NOT NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    total_emotions INTEGER DEFAULT 0,
    total_gestures INTEGER DEFAULT 0,
    avg_emotion_confidence REAL,
    avg_gesture_confidence REAL,
    status TEXT DEFAULT 'active', -- active, completed, abandoned
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

-- RBAC Tables
CREATE TABLE IF NOT EXISTS roles (
    role_id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    permission_id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    resource TEXT NOT NULL, -- media, campaign, totem, analytics, etc.
    action TEXT NOT NULL, -- create, read, update, delete, approve
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    granted_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
);

-- Approval Workflow
CREATE TABLE IF NOT EXISTS approval_workflows (
    id SERIAL PRIMARY KEY,
    media_id INTEGER UNIQUE NOT NULL,
    status TEXT DEFAULT 'draft', -- draft, review, approved, rejected, published
    reviewed_by INTEGER,
    reviewed_at TIMESTAMP,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (media_id) REFERENCES medias(media_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action TEXT NOT NULL, -- create, update, delete, approve, etc.
    entity TEXT NOT NULL, -- media, campaign, totem, etc.
    entity_id INTEGER,
    metadata TEXT, -- JSON
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Aggregated Metrics
CREATE TABLE IF NOT EXISTS aggregated_metrics (
    id SERIAL PRIMARY KEY,
    date TIMESTAMP NOT NULL,
    granularity TEXT NOT NULL, -- day, hour
    totem_id INTEGER,
    campaign_id INTEGER,
    media_id INTEGER,
    impressions INTEGER DEFAULT 0,
    play_time_seconds INTEGER DEFAULT 0,
    unique_sessions INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE SET NULL,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL,
    FOREIGN KEY (media_id) REFERENCES medias(media_id) ON DELETE SET NULL,
    UNIQUE(date, granularity, totem_id, campaign_id, media_id)
);

-- Device Certificates
CREATE TABLE IF NOT EXISTS device_certificates (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER UNIQUE NOT NULL,
    certificate_pem TEXT NOT NULL,
    private_key_pem TEXT,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    status TEXT DEFAULT 'active', -- active, revoked, expired
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

-- =============================================
-- INDEXES
-- =============================================

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id);
CREATE INDEX IF NOT EXISTS idx_totems_identifier ON totems(identifier);
CREATE INDEX IF NOT EXISTS idx_totems_status ON totems(status);
CREATE INDEX IF NOT EXISTS idx_totems_last_heartbeat ON totems(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_medias_client_id ON medias(client_id);
CREATE INDEX IF NOT EXISTS idx_medias_status ON medias(status);
CREATE INDEX IF NOT EXISTS idx_playlists_totem_id ON playlists(totem_id);
CREATE INDEX IF NOT EXISTS idx_playlists_campaign_id ON playlists(campaign_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id ON playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_order ON playlist_items(playlist_id, order_index);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_totem_id ON analytics_sessions(totem_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_start ON analytics_sessions(session_start);
CREATE INDEX IF NOT EXISTS idx_execution_logs_totem_id ON execution_logs(totem_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_executed_at ON execution_logs(executed_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_aggregated_metrics_date ON aggregated_metrics(date);
CREATE INDEX IF NOT EXISTS idx_aggregated_metrics_totem_id ON aggregated_metrics(totem_id);

-- =============================================
-- TRIGGERS (PostgreSQL)
-- =============================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_timestamp BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hosts_timestamp BEFORE UPDATE ON hosts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locals_timestamp BEFORE UPDATE ON locals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_totems_timestamp BEFORE UPDATE ON totems
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_smart_tvs_timestamp BEFORE UPDATE ON smart_tvs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_timestamp BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medias_timestamp BEFORE UPDATE ON medias
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playlists_timestamp BEFORE UPDATE ON playlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playlist_items_timestamp BEFORE UPDATE ON playlist_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_playlists_timestamp BEFORE UPDATE ON campaign_playlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_totems_timestamp BEFORE UPDATE ON campaign_totems
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_configs_timestamp BEFORE UPDATE ON webhook_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_rules_timestamp BEFORE UPDATE ON alert_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_timestamp BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approval_workflows_timestamp BEFORE UPDATE ON approval_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_models_timestamp BEFORE UPDATE ON ai_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ml_models_timestamp BEFORE UPDATE ON ml_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_totem_ml_config_timestamp BEFORE UPDATE ON totem_ml_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

