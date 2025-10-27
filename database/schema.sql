-- Smart Signage v2.0 - Schema SQL Unificado
-- Compatível com SQLite e PostgreSQL
-- Baseado no schema Prisma da v7.0.0

-- Enable foreign keys (SQLite)
PRAGMA foreign_keys = ON;

-- =============================================
-- ENUMS (PostgreSQL) / CHECK CONSTRAINTS (SQLite)
-- =============================================

-- MediaStatus
-- SQLite: CHECK constraint
-- PostgreSQL: ENUM

-- WorkflowStatus  
-- SQLite: CHECK constraint
-- PostgreSQL: ENUM

-- =============================================
-- TABLES
-- =============================================

-- Clients
CREATE TABLE IF NOT EXISTS clients (
    client_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    wths TEXT,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL, -- admin, manager, operator, viewer, client
    is_active BOOLEAN DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE SET NULL
);

-- Hosts
CREATE TABLE IF NOT EXISTS hosts (
    host_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    wths TEXT,
    description TEXT,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Locals
CREATE TABLE IF NOT EXISTS locals (
    local_id TEXT PRIMARY KEY,
    host_id INTEGER NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES hosts(host_id) ON DELETE CASCADE
);

-- Totems
CREATE TABLE IF NOT EXISTS totems (
    totem_id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT UNIQUE NOT NULL,
    device_id TEXT UNIQUE,
    local_id TEXT,
    description TEXT,
    config TEXT, -- JSON
    status TEXT DEFAULT 'offline', -- online, offline, error, maintenance
    version TEXT,
    firmware_version TEXT,
    ip_address TEXT,
    last_seen DATETIME,
    last_heartbeat DATETIME,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    campaign_id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    campaign_type TEXT DEFAULT 'general', -- general, scheduled
    priority INTEGER DEFAULT 1,
    start_date DATETIME,
    end_date DATETIME,
    start_time TEXT,
    end_time TEXT,
    days_of_week TEXT, -- JSON array
    status TEXT DEFAULT 'draft', -- draft, active, paused, finished, deleted
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
);

-- Media
CREATE TABLE IF NOT EXISTS medias (
    media_id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Playlists
CREATE TABLE IF NOT EXISTS playlists (
    playlist_id INTEGER PRIMARY KEY AUTOINCREMENT,
    totem_id INTEGER NOT NULL,
    campaign_id INTEGER NOT NULL,
    name TEXT,
    description TEXT,
    is_default BOOLEAN DEFAULT 0,
    medias TEXT, -- JSON array (legacy)
    loop BOOLEAN DEFAULT 1,
    config TEXT, -- JSON
    is_active BOOLEAN DEFAULT 1,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE
);

-- Playlist Items
CREATE TABLE IF NOT EXISTS playlist_items (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    media_id INTEGER NOT NULL,
    order_index INTEGER DEFAULT 0,
    display_seconds INTEGER,
    transition TEXT,
    start_time_offset_seconds INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES medias(media_id) ON DELETE CASCADE,
    UNIQUE(playlist_id, order_index)
);

-- Campaign Playlists
CREATE TABLE IF NOT EXISTS campaign_playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    playlist_id INTEGER NOT NULL,
    priority INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    UNIQUE(campaign_id, playlist_id)
);

-- Campaign Totems
CREATE TABLE IF NOT EXISTS campaign_totems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    totem_id INTEGER NOT NULL,
    campaign_id INTEGER NOT NULL,
    scheduled_start DATETIME,
    scheduled_end DATETIME,
    status TEXT DEFAULT 'pending', -- pending, active, completed, cancelled
    config TEXT, -- JSON
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    UNIQUE(campaign_id, totem_id)
);

-- QR Codes
CREATE TABLE IF NOT EXISTS qr_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    qr_type TEXT DEFAULT 'promotion', -- promotion, info, link
    template TEXT,
    refresh_interval_ms INTEGER,
    deeplink_url TEXT,
    utm_params TEXT, -- JSON
    expires_at DATETIME,
    max_scans INTEGER,
    scan_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE
);

-- Short Links
CREATE TABLE IF NOT EXISTS short_links (
    short_id TEXT PRIMARY KEY,
    campaign_id INTEGER NOT NULL,
    totem_id INTEGER,
    target_url TEXT NOT NULL,
    expires_at DATETIME,
    max_scans INTEGER,
    scan_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE SET NULL
);

-- Remote Commands
CREATE TABLE IF NOT EXISTS remote_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    totem_id INTEGER NOT NULL,
    request_id TEXT UNIQUE,
    command_type TEXT NOT NULL,
    command_data TEXT, -- JSON
    priority INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending', -- pending, executing, completed, failed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    executed_at DATETIME,
    result TEXT,
    created_by INTEGER,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Analytics Sessions
CREATE TABLE IF NOT EXISTS analytics_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    totem_id INTEGER NOT NULL,
    session_start DATETIME NOT NULL,
    session_end DATETIME,
    total_interactions INTEGER DEFAULT 0,
    avg_emotion_score REAL,
    dominant_emotion TEXT,
    age_range TEXT,
    gender TEXT,
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

-- Analytics Emotions
CREATE TABLE IF NOT EXISTS analytics_emotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    emotion TEXT NOT NULL,
    confidence REAL NOT NULL,
    timestamp DATETIME NOT NULL,
    face_detected BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES analytics_sessions(id) ON DELETE CASCADE
);

-- Analytics Gestures
CREATE TABLE IF NOT EXISTS analytics_gestures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    gesture_type TEXT NOT NULL,
    coordinates TEXT, -- JSON
    confidence REAL NOT NULL,
    timestamp DATETIME NOT NULL,
    action_triggered TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES analytics_sessions(id) ON DELETE CASCADE
);

-- Analytics QR Scans
CREATE TABLE IF NOT EXISTS analytics_qr_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qr_code_id INTEGER NOT NULL,
    totem_id INTEGER NOT NULL,
    scan_timestamp DATETIME NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (qr_code_id) REFERENCES qr_codes(id) ON DELETE CASCADE,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

-- AI Models
CREATE TABLE IF NOT EXISTS ai_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name TEXT NOT NULL,
    model_type TEXT NOT NULL,
    version TEXT NOT NULL,
    file_url TEXT,
    file_size INTEGER,
    accuracy_score REAL,
    performance_score REAL,
    training_data_size INTEGER,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Execution Logs
CREATE TABLE IF NOT EXISTS execution_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    totem_id INTEGER,
    client_id INTEGER,
    campaign_id INTEGER,
    media_id INTEGER,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    start_time DATETIME,
    end_time DATETIME,
    duration_seconds INTEGER,
    status TEXT DEFAULT 'executed',
    play_success BOOLEAN DEFAULT 1,
    error_code TEXT,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE SET NULL,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE SET NULL,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL
);

-- System Logs
CREATE TABLE IF NOT EXISTS system_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Webhook Configs
CREATE TABLE IF NOT EXISTS webhook_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    events TEXT, -- JSON array
    secret TEXT NOT NULL,
    timeout_ms INTEGER DEFAULT 5000,
    retry_count INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Webhook Deliveries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    status_code INTEGER,
    error_message TEXT,
    delivered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (webhook_id) REFERENCES webhook_configs(id) ON DELETE CASCADE
);

-- Alert Rules
CREATE TABLE IF NOT EXISTS alert_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    metric TEXT NOT NULL,
    condition TEXT NOT NULL, -- gt, lt, eq, gte, lte
    threshold REAL NOT NULL,
    duration INTEGER DEFAULT 300, -- seconds
    is_active BOOLEAN DEFAULT 1,
    notification_channels TEXT, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Alert Logs
CREATE TABLE IF NOT EXISTS alert_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL,
    metric TEXT NOT NULL,
    value REAL NOT NULL,
    threshold REAL NOT NULL,
    condition TEXT NOT NULL,
    labels TEXT, -- JSON
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
);

-- ML Tables
CREATE TABLE IF NOT EXISTS emotion_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    totem_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    emotion TEXT NOT NULL, -- happy, sad, angry, surprised, fearful, disgusted, neutral
    confidence REAL NOT NULL, -- 0-100
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_demographics TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gesture_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    totem_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    gesture TEXT NOT NULL, -- wave, point, thumbs_up, thumbs_down, stop, ok, peace, other
    confidence REAL NOT NULL, -- 0-100
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    action_taken TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS behavior_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    totem_id INTEGER NOT NULL,
    duration INTEGER NOT NULL, -- seconds
    interactions INTEGER DEFAULT 0,
    emotion_changes INTEGER DEFAULT 0,
    gesture_count INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ml_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- emotion, gesture, face, behavior
    version TEXT NOT NULL,
    file_path TEXT NOT NULL,
    accuracy REAL,
    status TEXT DEFAULT 'active', -- active, inactive, training, testing
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS totem_ml_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    totem_id INTEGER UNIQUE NOT NULL,
    emotion_detection_enabled BOOLEAN DEFAULT 1,
    gesture_recognition_enabled BOOLEAN DEFAULT 1,
    face_detection_enabled BOOLEAN DEFAULT 1,
    confidence_threshold REAL DEFAULT 70.00,
    processing_interval INTEGER DEFAULT 1000,
    max_sessions_per_day INTEGER DEFAULT 1000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ml_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    totem_id INTEGER NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    total_emotions INTEGER DEFAULT 0,
    total_gestures INTEGER DEFAULT 0,
    avg_emotion_confidence REAL,
    avg_gesture_confidence REAL,
    status TEXT DEFAULT 'active', -- active, completed, abandoned
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

-- RBAC Tables
CREATE TABLE IF NOT EXISTS roles (
    role_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    permission_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    resource TEXT NOT NULL, -- media, campaign, totem, analytics, etc.
    action TEXT NOT NULL, -- create, read, update, delete, approve
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    granted_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(user_id) ON DELETE SET NULL,
    UNIQUE(user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
);

-- Approval Workflow
CREATE TABLE IF NOT EXISTS approval_workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id INTEGER UNIQUE NOT NULL,
    status TEXT DEFAULT 'draft', -- draft, review, approved, rejected, published
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (media_id) REFERENCES medias(media_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL, -- create, update, delete, approve, etc.
    entity TEXT NOT NULL, -- media, campaign, totem, etc.
    entity_id INTEGER,
    metadata TEXT, -- JSON
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Aggregated Metrics
CREATE TABLE IF NOT EXISTS aggregated_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATETIME NOT NULL,
    granularity TEXT NOT NULL, -- day, hour
    totem_id INTEGER,
    campaign_id INTEGER,
    media_id INTEGER,
    impressions INTEGER DEFAULT 0,
    play_time_seconds INTEGER DEFAULT 0,
    unique_sessions INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE SET NULL,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL,
    FOREIGN KEY (media_id) REFERENCES medias(media_id) ON DELETE SET NULL,
    UNIQUE(date, granularity, totem_id, campaign_id, media_id)
);

-- Device Certificates
CREATE TABLE IF NOT EXISTS device_certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    totem_id INTEGER UNIQUE NOT NULL,
    certificate_pem TEXT NOT NULL,
    private_key_pem TEXT,
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    status TEXT DEFAULT 'active', -- active, revoked, expired
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
-- TRIGGERS (SQLite)
-- =============================================

-- Update timestamps
CREATE TRIGGER IF NOT EXISTS update_clients_timestamp 
    AFTER UPDATE ON clients
    BEGIN
        UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE client_id = NEW.client_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_hosts_timestamp 
    AFTER UPDATE ON hosts
    BEGIN
        UPDATE hosts SET updated_at = CURRENT_TIMESTAMP WHERE host_id = NEW.host_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_locals_timestamp 
    AFTER UPDATE ON locals
    BEGIN
        UPDATE locals SET updated_at = CURRENT_TIMESTAMP WHERE local_id = NEW.local_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_totems_timestamp 
    AFTER UPDATE ON totems
    BEGIN
        UPDATE totems SET updated_at = CURRENT_TIMESTAMP WHERE totem_id = NEW.totem_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_smart_tvs_timestamp 
    AFTER UPDATE ON smart_tvs
    BEGIN
        UPDATE smart_tvs SET updated_at = CURRENT_TIMESTAMP WHERE smartv_id = NEW.smartv_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_campaigns_timestamp 
    AFTER UPDATE ON campaigns
    BEGIN
        UPDATE campaigns SET updated_at = CURRENT_TIMESTAMP WHERE campaign_id = NEW.campaign_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_medias_timestamp 
    AFTER UPDATE ON medias
    BEGIN
        UPDATE medias SET updated_at = CURRENT_TIMESTAMP WHERE media_id = NEW.media_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_playlists_timestamp 
    AFTER UPDATE ON playlists
    BEGIN
        UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE playlist_id = NEW.playlist_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_playlist_items_timestamp 
    AFTER UPDATE ON playlist_items
    BEGIN
        UPDATE playlist_items SET updated_at = CURRENT_TIMESTAMP WHERE item_id = NEW.item_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_campaign_playlists_timestamp 
    AFTER UPDATE ON campaign_playlists
    BEGIN
        UPDATE campaign_playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_campaign_totems_timestamp 
    AFTER UPDATE ON campaign_totems
    BEGIN
        UPDATE campaign_totems SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_webhook_configs_timestamp 
    AFTER UPDATE ON webhook_configs
    BEGIN
        UPDATE webhook_configs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_alert_rules_timestamp 
    AFTER UPDATE ON alert_rules
    BEGIN
        UPDATE alert_rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_roles_timestamp 
    AFTER UPDATE ON roles
    BEGIN
        UPDATE roles SET updated_at = CURRENT_TIMESTAMP WHERE role_id = NEW.role_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_approval_workflows_timestamp 
    AFTER UPDATE ON approval_workflows
    BEGIN
        UPDATE approval_workflows SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_ai_models_timestamp 
    AFTER UPDATE ON ai_models
    BEGIN
        UPDATE ai_models SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_ml_models_timestamp 
    AFTER UPDATE ON ml_models
    BEGIN
        UPDATE ml_models SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_totem_ml_config_timestamp 
    AFTER UPDATE ON totem_ml_config
    BEGIN
        UPDATE totem_ml_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- =============================================
-- INITIAL DATA
-- =============================================

-- Insert default roles
INSERT OR IGNORE INTO roles (role_id, name, description) VALUES 
(1, 'admin', 'Administrador do sistema'),
(2, 'manager', 'Gerente de campanhas'),
(3, 'operator', 'Operador de totems'),
(4, 'viewer', 'Visualizador de relatórios'),
(5, 'client', 'Cliente final');

-- Insert default permissions
INSERT OR IGNORE INTO permissions (permission_id, name, resource, action, description) VALUES 
(1, 'media.create', 'media', 'create', 'Criar mídia'),
(2, 'media.read', 'media', 'read', 'Visualizar mídia'),
(3, 'media.update', 'media', 'update', 'Editar mídia'),
(4, 'media.delete', 'media', 'delete', 'Excluir mídia'),
(5, 'campaign.create', 'campaign', 'create', 'Criar campanha'),
(6, 'campaign.read', 'campaign', 'read', 'Visualizar campanha'),
(7, 'campaign.update', 'campaign', 'update', 'Editar campanha'),
(8, 'campaign.delete', 'campaign', 'delete', 'Excluir campanha'),
(9, 'totem.create', 'totem', 'create', 'Criar totem'),
(10, 'totem.read', 'totem', 'read', 'Visualizar totem'),
(11, 'totem.update', 'totem', 'update', 'Editar totem'),
(12, 'totem.delete', 'totem', 'delete', 'Excluir totem'),
(13, 'analytics.read', 'analytics', 'read', 'Visualizar analytics'),
(14, 'user.create', 'user', 'create', 'Criar usuário'),
(15, 'user.read', 'user', 'read', 'Visualizar usuário'),
(16, 'user.update', 'user', 'update', 'Editar usuário'),
(17, 'user.delete', 'user', 'delete', 'Excluir usuário');

-- Insert default role permissions (admin gets all)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) 
SELECT 1, permission_id FROM permissions;

-- Insert default AI models
INSERT OR IGNORE INTO ai_models (id, model_name, model_type, version, is_active) VALUES 
(1, 'llama3.2:3b', 'llm', '3.2', 1),
(2, 'llama3.2:1b', 'llm', '3.2', 1),
(3, 'emotion-detection', 'emotion', '1.0', 1),
(4, 'gesture-recognition', 'gesture', '1.0', 1);

-- Insert default ML models
INSERT OR IGNORE INTO ml_models (id, name, type, version, file_path, status) VALUES 
(1, 'emotion-detection-v1', 'emotion', '1.0', '/opt/smart-signage/ml-models/emotion-detection/model.tflite', 'active'),
(2, 'gesture-recognition-v1', 'gesture', '1.0', '/opt/smart-signage/ml-models/gesture-recognition/model.tflite', 'active'),
(3, 'face-detection-v1', 'face', '1.0', '/opt/smart-signage/ml-models/face-detection/model.tflite', 'active');

-- =============================================
-- VIEWS (opcional, para relatórios)
-- =============================================

-- View para dashboard principal
CREATE VIEW IF NOT EXISTS dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM totems WHERE active = 1) as total_totems,
    (SELECT COUNT(*) FROM totems WHERE status = 'online' AND active = 1) as online_totems,
    (SELECT COUNT(*) FROM campaigns WHERE is_active = 1) as active_campaigns,
    (SELECT COUNT(*) FROM medias WHERE status = 'published') as published_medias,
    (SELECT COUNT(*) FROM analytics_sessions WHERE DATE(session_start) = DATE('now')) as today_sessions;

-- View para relatório de campanhas
CREATE VIEW IF NOT EXISTS campaign_report AS
SELECT 
    c.campaign_id,
    c.title,
    c.status,
    c.start_date,
    c.end_date,
    cl.name as client_name,
    COUNT(DISTINCT ct.totem_id) as total_totems,
    COUNT(DISTINCT p.playlist_id) as total_playlists,
    COUNT(DISTINCT m.media_id) as total_medias
FROM campaigns c
LEFT JOIN clients cl ON c.client_id = cl.client_id
LEFT JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
LEFT JOIN playlists p ON c.campaign_id = p.campaign_id
LEFT JOIN playlist_items pi ON p.playlist_id = pi.playlist_id
LEFT JOIN medias m ON pi.media_id = m.media_id
GROUP BY c.campaign_id, c.title, c.status, c.start_date, c.end_date, cl.name;

-- =============================================
-- END OF SCHEMA
-- =============================================
