-- SmartChannel DB Schema
-- Consolidated schema including base tables, advanced schedules, exports, reports, views and log settings
-- Generated on 2025-11-08 21:17:19
-- Updated: 2025-01-XX - Integrated all migrations (2FA, Plans, OTA Updates, Interactive Features, Remote Commands, v3.1 Features)


-- =============================================
-- BASE DOMAIN SCHEMA
-- =============================================

-- Smart Signage v2.0 - Schema SQL PostgreSQL
-- Adaptado para PostgreSQL 15+
-- Baseado no schema Prisma da v7.0.0
-- 
-- NOTA: Conteúdo original de reports-schema.sql e outros módulos está consolidado neste arquivo.

-- =============================================
-- TABLES
-- =============================================

-- Clients

-- =============================================
-- TABELAS (em ordem de dependências)
-- =============================================

CREATE TABLE IF NOT EXISTS clients (
    client_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    wths TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS system_logs (
    log_id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS export_queries (
    query_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('PostgreSQL', 'Redis', 'Grafana', 'Prometheus')),
    sql_query TEXT NOT NULL,
    database_config JSONB NOT NULL,
    export_config JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT export_queries_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS export_schedules (
    schedule_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    query_id INTEGER NOT NULL REFERENCES export_queries(query_id) ON DELETE CASCADE,
    cron_expression VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    last_execution TIMESTAMP,
    next_execution TIMESTAMP,
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT export_schedules_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS export_executions (
    execution_id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES export_schedules(schedule_id) ON DELETE SET NULL,
    query_id INTEGER NOT NULL REFERENCES export_queries(query_id) ON DELETE CASCADE,
    job_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    records_exported INTEGER DEFAULT 0,
    file_path TEXT,
    file_size BIGINT,
    error_message TEXT,
    execution_log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
    setting_id SERIAL PRIMARY KEY,
    setting_key VARCHAR(255) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(50) NOT NULL DEFAULT 'string', -- string, number, boolean, json, array
    category VARCHAR(100) DEFAULT 'system',
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    is_editable BOOLEAN DEFAULT true,
    validation TEXT, -- regex ou validação
    options JSONB, -- opções disponíveis (para selects)
    default_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plans (
    plan_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    price_monthly NUMERIC(12, 2) NOT NULL,
    price_yearly NUMERIC(12, 2),
    currency TEXT DEFAULT 'BRL',
    billing_interval TEXT DEFAULT 'month', -- month, year
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    stripe_product_id TEXT,
    features JSONB DEFAULT '{}'::jsonb, -- Limites e features do plano
    limits JSONB DEFAULT '{}'::jsonb, -- Ex: { totems: 10, campaigns: 50, storage_gb: 100 }
    is_active BOOLEAN DEFAULT true,
    is_popular BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fx_effects (
    effect_id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    effect_type TEXT NOT NULL, -- 'neon_warp', 'ripple_sync', 'liquid_flow', 'holographic_swipe', 'matrix_data_flow', 'particle_burst'
    description TEXT,
    default_params JSONB DEFAULT '{}'::jsonb,
    preview_url TEXT, -- URL de preview/animação
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fx_rules (
    rule_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    site_id TEXT, -- Opcional: regra específica de site (FK para fx_sites)
    conditions JSONB NOT NULL, -- Condições (idade, humor, tag, hora, etc.)
    actions JSONB NOT NULL, -- Ações (efeito, conteúdo, totens, prioridade)
    priority INTEGER DEFAULT 0, -- Prioridade da regra (maior = mais importante)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fx_timelines (
    timeline_id SERIAL PRIMARY KEY,
    site_id TEXT NOT NULL, -- FK para fx_sites
    name TEXT,
    version INTEGER DEFAULT 1,
    events JSONB NOT NULL, -- Array de eventos FX
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhooks (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT,
    channels TEXT[] DEFAULT ARRAY[]::TEXT[],
    events TEXT[] DEFAULT ARRAY[]::TEXT[],
    enabled BOOLEAN DEFAULT true,
    retry_count INTEGER DEFAULT 3,
    timeout_ms INTEGER DEFAULT 5000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS stripe_customers (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL UNIQUE,
    stripe_customer_id TEXT UNIQUE NOT NULL,
    email TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fx_sites (
    site_id TEXT PRIMARY KEY, -- ID único do site (ex: 'site-01', 'loja-centro')
    name TEXT NOT NULL,
    description TEXT,
    client_id INTEGER, -- Cliente dono do site
    broker_url TEXT, -- URL do broker MQTT local (ex: 'ws://localhost:9001')
    broker_type TEXT DEFAULT 'mqtt', -- 'mqtt', 'websocket', 'hybrid'
    broker_config JSONB DEFAULT '{}'::jsonb, -- Configurações do broker (auth, topics, etc.)
    sync_interval_ms INTEGER DEFAULT 2000, -- Intervalo de sincronização em ms
    time_sync_enabled BOOLEAN DEFAULT true, -- Habilitar sincronização de tempo
    config JSONB DEFAULT '{}'::jsonb, -- Configurações gerais do site
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS locals (
    local_id TEXT PRIMARY KEY,
    host_id INTEGER NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES hosts(host_id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    status TEXT DEFAULT 'active', -- active, canceled, past_due, unpaid, trialing, incomplete
    billing_interval TEXT DEFAULT 'month', -- month, year
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP,
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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
    is_active BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
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

CREATE TABLE IF NOT EXISTS advanced_schedules (
    schedule_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    schedule_type TEXT NOT NULL, -- 'campaign' | 'playlist' | 'campaign_activation' | 'playlist_generation'
    target_id INTEGER NOT NULL, -- campaign_id ou playlist_id dependendo do tipo
    cron_expression TEXT NOT NULL, -- Expressão cron para agendamento
    schedule_config TEXT, -- JSON com configurações específicas
    enabled BOOLEAN DEFAULT true,
    last_execution TIMESTAMP,
    next_execution TIMESTAMP,
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reports (
    report_id SERIAL PRIMARY KEY,
    type TEXT NOT NULL, -- campaign, totem, client, media, billing, analytics, custom
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending', -- pending, generating, completed, failed
    format TEXT DEFAULT 'pdf', -- pdf, excel, csv, json
    file_path TEXT,
    file_size INTEGER,
    download_url TEXT,
    download_count INTEGER DEFAULT 0,
    filters TEXT, -- JSON
    template TEXT,
    custom_fields TEXT, -- JSON
    ai_analysis BOOLEAN DEFAULT false,
    metadata TEXT, -- JSON
    generated_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS report_templates (
    template_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- campaign, totem, client, media, billing, analytics, custom
    template_config TEXT NOT NULL, -- JSON com configuração do template
    is_default BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_two_factor (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    secret TEXT NOT NULL, -- Secret TOTP (criptografado)
    enabled BOOLEAN DEFAULT false,
    backup_codes TEXT[], -- Array de backup codes (criptografados)
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS two_factor_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    success BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ota_updates (
    id SERIAL PRIMARY KEY,
    version TEXT NOT NULL, -- Versão da atualização (ex: "2.1.0")
    platform TEXT NOT NULL, -- 'webos', 'tizen', 'android', 'linux', 'windows', 'all'
    file_path TEXT NOT NULL, -- Caminho do arquivo de atualização
    file_size BIGINT NOT NULL, -- Tamanho do arquivo em bytes
    checksum TEXT NOT NULL, -- SHA256 do arquivo
    description TEXT, -- Descrição da atualização
    changelog TEXT, -- Changelog detalhado
    is_mandatory BOOLEAN DEFAULT false, -- Se a atualização é obrigatória
    min_version TEXT, -- Versão mínima necessária para atualizar
    max_version TEXT, -- Versão máxima que pode atualizar
    rollout_percentage INTEGER DEFAULT 100, -- Porcentagem de rollout (0-100)
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'testing', 'active', 'paused', 'completed', 'cancelled'
    created_by INTEGER, -- ID do usuário que criou
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP, -- Data de lançamento
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dashboard_layouts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    layout_data JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN DEFAULT false,
    is_shared BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS backups (
    id SERIAL PRIMARY KEY,
    backup_id TEXT UNIQUE NOT NULL,
    backup_type TEXT NOT NULL, -- 'full', 'database', 'uploads', 'config'
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'in_progress', -- 'completed', 'failed', 'in_progress'
    metadata JSONB DEFAULT '{}',
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS totems (
    totem_id SERIAL PRIMARY KEY,
    name TEXT,
    identifier TEXT UNIQUE NOT NULL,
    uin TEXT UNIQUE, -- Unique Identifier Number (UIN) para validação do player
    device_id TEXT UNIQUE,
    local_id TEXT,
    location TEXT,
    description TEXT,
    config TEXT, -- JSON
    status TEXT DEFAULT 'offline', -- online, offline, error, maintenance
    version TEXT,
    firmware_version TEXT,
    ip_address TEXT,
    last_seen TIMESTAMP,
    last_heartbeat TIMESTAMP,
    active BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    client_id INTEGER,
    current_playlist_id INTEGER,
    blocked BOOLEAN DEFAULT false, -- Bloqueio manual do totem
    blocked_until TIMESTAMP, -- Bloqueio temporário até data/hora
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (local_id) REFERENCES locals(local_id) ON DELETE SET NULL,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE SET NULL
);

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

CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    tag_id TEXT UNIQUE NOT NULL, -- ID único da tag (RFID/NFC/QR)
    tag_type TEXT NOT NULL, -- 'rfid', 'nfc', 'qr_code', 'barcode'
    name TEXT,
    description TEXT,
    content_id INTEGER, -- ID do conteúdo associado
    metadata JSONB DEFAULT '{}', -- Metadados flexíveis em formato JSONB
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_id) REFERENCES medias(media_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS recognized_persons (
    id SERIAL PRIMARY KEY,
    person_id TEXT UNIQUE NOT NULL, -- ID único da pessoa
    name TEXT,
    features TEXT, -- Características faciais (JSON)
    content_id INTEGER, -- Conteúdo personalizado
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_id) REFERENCES medias(media_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS schedule_executions (
    execution_id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL,
    job_id TEXT, -- ID do job no Bull
    status TEXT NOT NULL, -- 'running' | 'completed' | 'failed' | 'cancelled'
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    execution_log TEXT,
    error_message TEXT,
    metadata TEXT, -- JSON com dados adicionais
    FOREIGN KEY (schedule_id) REFERENCES advanced_schedules(schedule_id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS playlists (
    playlist_id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    campaign_id INTEGER NOT NULL,
    client_id INTEGER,
    name TEXT,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    medias TEXT, -- JSON array (legacy)
    loop BOOLEAN DEFAULT true,
    config TEXT, -- JSON
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS smart_playlists (
    smart_playlist_id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    campaign_id INTEGER,
    totem_id INTEGER,
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
    ai_enabled BOOLEAN DEFAULT true,
    rules JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'inactive',
    generated_items INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0,
    effectiveness REAL DEFAULT 0,
    last_generated TIMESTAMP,
    next_generation TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE SET NULL
);

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

CREATE TABLE IF NOT EXISTS qr_codes (
    qr_code_id SERIAL PRIMARY KEY,
    client_id INTEGER,
    totem_id INTEGER,
    campaign_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    qr_type TEXT DEFAULT 'promotion', -- promotion, info, link, url, text, wifi, contact, sms, email, phone
    content TEXT NOT NULL,
    size INTEGER DEFAULT 200,
    color TEXT DEFAULT '#000000',
    background_color TEXT DEFAULT '#FFFFFF',
    error_correction_level TEXT DEFAULT 'M', -- L, M, Q, H
    margin INTEGER DEFAULT 4,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP,
    max_scans INTEGER,
    redirect_url TEXT,
    tracking_enabled BOOLEAN DEFAULT true,
    scan_count INTEGER DEFAULT 0,
    last_scanned_at TIMESTAMP,
    template TEXT,
    refresh_interval_ms INTEGER,
    deeplink_url TEXT,
    utm_params TEXT, -- JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE SET NULL,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE SET NULL,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL
);

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

CREATE TABLE IF NOT EXISTS billing (
    billing_id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    campaign_id INTEGER,
    totem_id INTEGER,
    billing_type TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency TEXT DEFAULT 'BRL',
    description TEXT,
    due_date TIMESTAMP,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    payment_reference TEXT,
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE SET NULL
);

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

CREATE TABLE IF NOT EXISTS totem_update_status (
    totem_id INTEGER PRIMARY KEY,
    current_version TEXT NOT NULL, -- Versão atual do totem
    available_version TEXT, -- Versão disponível para atualização
    update_status TEXT NOT NULL DEFAULT 'up_to_date', -- 'up_to_date', 'update_available', 'downloading', 'installing', 'failed', 'rollback'
    last_check TIMESTAMP, -- Última vez que verificou atualizações
    last_update TIMESTAMP, -- Última vez que foi atualizado
    error_message TEXT, -- Mensagem de erro se falhou
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS interaction_logs (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    interaction_type TEXT NOT NULL, -- 'facial_recognition', 'tag_id', 'touch', 'gesture'
    interaction_data JSONB, -- Dados da interação
    content_id INTEGER, -- Conteúdo exibido
    person_id TEXT, -- ID da pessoa (se reconhecida)
    tag_id TEXT, -- ID da tag (se aplicável)
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES medias(media_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS totem_network (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    network_id TEXT NOT NULL, -- ID da rede/grupo
    nearby_totems INTEGER[], -- Array de IDs de totens próximos
    is_active BOOLEAN DEFAULT true,
    last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fx_telemetry (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    effect_id TEXT NOT NULL, -- Nome do efeito executado
    event_id TEXT, -- ID do evento da timeline
    content_id INTEGER, -- ID do conteúdo exibido
    planned_start_ts TIMESTAMP, -- Quando deveria começar
    actual_start_ts TIMESTAMP, -- Quando realmente começou
    ended_at TIMESTAMP, -- Quando terminou
    duration_ms INTEGER, -- Duração real em ms
    avg_fps DECIMAL(5,2), -- FPS médio durante execução
    status TEXT DEFAULT 'success', -- 'success', 'failed', 'timeout', 'cancelled'
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb, -- Dados adicionais
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fx_totem_sites (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    site_id TEXT NOT NULL,
    role TEXT DEFAULT 'participant', -- 'master', 'participant', 'observer'
    position_x INTEGER, -- Posição X na rede (para visualização)
    position_y INTEGER, -- Posição Y na rede (para visualização)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    FOREIGN KEY (site_id) REFERENCES fx_sites(site_id) ON DELETE CASCADE,
    UNIQUE(totem_id, site_id)
);

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

CREATE TABLE IF NOT EXISTS analytics_qr_scans (
    id SERIAL PRIMARY KEY,
    qr_code_id INTEGER NOT NULL,
    totem_id INTEGER NOT NULL,
    scan_timestamp TIMESTAMP NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    location TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (qr_code_id) REFERENCES qr_codes(qr_code_id) ON DELETE CASCADE,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS remote_screenshots (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    command_id INTEGER, -- Referência ao comando que gerou o screenshot
    file_path TEXT NOT NULL,
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    format TEXT DEFAULT 'png',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    FOREIGN KEY (command_id) REFERENCES remote_commands(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id SERIAL PRIMARY KEY,
    billing_id INTEGER NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency TEXT DEFAULT 'BRL',
    payment_method TEXT,
    payment_reference TEXT,
    notes TEXT,
    metadata JSONB,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (billing_id) REFERENCES billing(billing_id) ON DELETE CASCADE
);

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


-- =============================================
-- FOREIGN KEYS (ALTER TABLE)
-- =============================================

ALTER TABLE medias ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE medias ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

ALTER TABLE medias ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE playlists ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;


-- =============================================
-- ÍNDICES (agrupados por tabela)
-- =============================================

-- Índices para export_queries
CREATE INDEX IF NOT EXISTS idx_export_queries_provider ON export_queries(provider);
CREATE INDEX IF NOT EXISTS idx_export_queries_enabled ON export_queries(enabled);

-- Índices para export_schedules
CREATE INDEX IF NOT EXISTS idx_export_schedules_query_id ON export_schedules(query_id);
CREATE INDEX IF NOT EXISTS idx_export_schedules_enabled ON export_schedules(enabled);

-- Índices para export_executions
CREATE INDEX IF NOT EXISTS idx_export_executions_schedule_id ON export_executions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_export_executions_query_id ON export_executions(query_id);
CREATE INDEX IF NOT EXISTS idx_export_executions_status ON export_executions(status);
CREATE INDEX IF NOT EXISTS idx_export_executions_created_at ON export_executions(created_at);

-- Índices para system_settings
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- Índices para plans
CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);

-- Índices para fx_effects
CREATE INDEX IF NOT EXISTS idx_fx_effects_effect_type ON fx_effects(effect_type);
CREATE INDEX IF NOT EXISTS idx_fx_effects_is_active ON fx_effects(is_active);

-- Índices para fx_rules
CREATE INDEX IF NOT EXISTS idx_fx_rules_site_id ON fx_rules(site_id);
CREATE INDEX IF NOT EXISTS idx_fx_rules_is_active ON fx_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_fx_rules_priority ON fx_rules(priority DESC);

-- Índices para fx_timelines
CREATE INDEX IF NOT EXISTS idx_fx_timelines_site_id ON fx_timelines(site_id);
CREATE INDEX IF NOT EXISTS idx_fx_timelines_starts_at ON fx_timelines(starts_at);
CREATE INDEX IF NOT EXISTS idx_fx_timelines_is_active ON fx_timelines(is_active);

-- Índices para webhooks
CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled);
CREATE INDEX IF NOT EXISTS idx_webhooks_channels ON webhooks USING GIN(channels);
CREATE INDEX IF NOT EXISTS idx_webhooks_events ON webhooks USING GIN(events);

-- Índices para users
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, is_active);

-- Índices para campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_start_date ON campaigns(start_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_end_date ON campaigns(end_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_is_active ON campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_campaigns_active_dates ON campaigns(client_id, is_active, start_date, end_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_campaigns_client_status_dates ON campaigns(client_id, status, start_date, end_date);

-- Índices para stripe_customers
CREATE INDEX IF NOT EXISTS idx_stripe_customers_client_id ON stripe_customers(client_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_customer_id ON stripe_customers(stripe_customer_id);

-- Índices para fx_sites
CREATE INDEX IF NOT EXISTS idx_fx_sites_client_id ON fx_sites(client_id);
CREATE INDEX IF NOT EXISTS idx_fx_sites_is_active ON fx_sites(is_active);

-- Índices para subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_client_status ON subscriptions(client_id, status);

-- Índices para password_reset_tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Índices para medias
CREATE INDEX IF NOT EXISTS idx_medias_client_id ON medias(client_id);
CREATE INDEX IF NOT EXISTS idx_medias_status ON medias(status);
CREATE INDEX IF NOT EXISTS idx_media_client_id ON medias(client_id);
CREATE INDEX IF NOT EXISTS idx_media_type ON medias(type);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON medias(created_at);
CREATE INDEX IF NOT EXISTS idx_media_is_active ON medias(is_active);
CREATE INDEX IF NOT EXISTS idx_media_client_type ON medias(client_id, type, is_active);
CREATE INDEX IF NOT EXISTS idx_medias_client_status_type ON medias(client_id, status, media_type);

-- Índices para audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp_desc ON audit_logs(timestamp DESC);

-- Índices para advanced_schedules
CREATE INDEX IF NOT EXISTS idx_advanced_schedules_type ON advanced_schedules(schedule_type);
CREATE INDEX IF NOT EXISTS idx_advanced_schedules_target_id ON advanced_schedules(target_id);
CREATE INDEX IF NOT EXISTS idx_advanced_schedules_enabled ON advanced_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_advanced_schedules_created_by ON advanced_schedules(created_by);

-- Índices para reports
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_generated_at ON reports(generated_at);

-- Índices para report_templates
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(type);
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON report_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_report_templates_is_default ON report_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_report_templates_is_public ON report_templates(is_public);

-- Índices para user_two_factor
CREATE INDEX IF NOT EXISTS idx_user_two_factor_user_id ON user_two_factor(user_id);
CREATE INDEX IF NOT EXISTS idx_user_two_factor_enabled ON user_two_factor(enabled);

-- Índices para two_factor_attempts
CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_user_id ON two_factor_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_created_at ON two_factor_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_success ON two_factor_attempts(success);

-- Índices para ota_updates
CREATE INDEX IF NOT EXISTS idx_ota_updates_platform ON ota_updates(platform);
CREATE INDEX IF NOT EXISTS idx_ota_updates_status ON ota_updates(status);
CREATE INDEX IF NOT EXISTS idx_ota_updates_created_at ON ota_updates(created_at);

-- Índices para dashboard_layouts
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_user_id ON dashboard_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_is_default ON dashboard_layouts(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_is_shared ON dashboard_layouts(is_shared) WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_data ON dashboard_layouts USING GIN (layout_data);

-- Índices para backups
CREATE INDEX IF NOT EXISTS idx_backups_backup_id ON backups(backup_id);
CREATE INDEX IF NOT EXISTS idx_backups_type ON backups(backup_type);
CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);

-- Índices para totems
CREATE INDEX IF NOT EXISTS idx_totems_identifier ON totems(identifier);
CREATE INDEX IF NOT EXISTS idx_totems_status ON totems(status);
CREATE INDEX IF NOT EXISTS idx_totems_last_heartbeat ON totems(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_totems_client_id ON totems(client_id);
CREATE INDEX IF NOT EXISTS idx_totems_is_active ON totems(is_active);
CREATE INDEX IF NOT EXISTS idx_totems_active_status ON totems(client_id, is_active, status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_totems_client_status ON totems(client_id, status);

-- Índices para tags
CREATE INDEX IF NOT EXISTS idx_tags_metadata ON tags USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_tags_tag_id ON tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_tag_type ON tags(tag_type);
CREATE INDEX IF NOT EXISTS idx_tags_content_id ON tags(content_id);

-- Índices para recognized_persons
CREATE INDEX IF NOT EXISTS idx_recognized_persons_person_id ON recognized_persons(person_id);
CREATE INDEX IF NOT EXISTS idx_recognized_persons_content_id ON recognized_persons(content_id);

-- Índices para schedule_executions
CREATE INDEX IF NOT EXISTS idx_schedule_executions_schedule_id ON schedule_executions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_executions_status ON schedule_executions(status);
CREATE INDEX IF NOT EXISTS idx_schedule_executions_started_at ON schedule_executions(started_at);

-- Índices para playlists
CREATE INDEX IF NOT EXISTS idx_playlists_totem_id ON playlists(totem_id);
CREATE INDEX IF NOT EXISTS idx_playlists_campaign_id ON playlists(campaign_id);
CREATE INDEX IF NOT EXISTS idx_playlists_client_id ON playlists(client_id);
CREATE INDEX IF NOT EXISTS idx_playlists_is_active ON playlists(is_active);
CREATE INDEX IF NOT EXISTS idx_playlists_created_at ON playlists(created_at);
CREATE INDEX IF NOT EXISTS idx_playlists_totem_campaign ON playlists(totem_id, campaign_id);

-- Índices para smart_playlists
CREATE INDEX IF NOT EXISTS idx_smart_playlists_client_id ON smart_playlists(client_id);
CREATE INDEX IF NOT EXISTS idx_smart_playlists_campaign_id ON smart_playlists(campaign_id);
CREATE INDEX IF NOT EXISTS idx_smart_playlists_status ON smart_playlists(status);

-- Índices para campaign_totems
CREATE INDEX IF NOT EXISTS idx_campaign_totems_campaign_status ON campaign_totems(campaign_id, status);

-- Índices para qr_codes
CREATE INDEX IF NOT EXISTS idx_qr_codes_client_id ON qr_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_totem_id ON qr_codes(totem_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_campaign_id ON qr_codes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_is_active ON qr_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_qr_codes_expires_at ON qr_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_qr_codes_client_active_expires ON qr_codes(client_id, is_active, expires_at);

-- Índices para remote_commands
CREATE INDEX IF NOT EXISTS idx_remote_commands_totem_id ON remote_commands(totem_id);
CREATE INDEX IF NOT EXISTS idx_remote_commands_status ON remote_commands(status);
CREATE INDEX IF NOT EXISTS idx_remote_commands_created_at ON remote_commands(created_at);
CREATE INDEX IF NOT EXISTS idx_remote_commands_command_type ON remote_commands(command_type);
CREATE INDEX IF NOT EXISTS idx_remote_commands_totem_status_created ON remote_commands(totem_id, status, created_at);

-- Índices para billing
CREATE INDEX IF NOT EXISTS idx_billing_client_id ON billing(client_id);
CREATE INDEX IF NOT EXISTS idx_billing_campaign_id ON billing(campaign_id);
CREATE INDEX IF NOT EXISTS idx_billing_totem_id ON billing(totem_id);
CREATE INDEX IF NOT EXISTS idx_billing_status ON billing(status);
CREATE INDEX IF NOT EXISTS idx_billing_due_date ON billing(due_date);
CREATE INDEX IF NOT EXISTS idx_billing_stripe_invoice_id ON billing(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscription_id ON billing(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_client_status_due ON billing(client_id, status, due_date);

-- Índices para analytics_sessions
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_totem_id ON analytics_sessions(totem_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_start ON analytics_sessions(session_start);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_totem_start ON analytics_sessions(totem_id, session_start);

-- Índices para execution_logs
CREATE INDEX IF NOT EXISTS idx_execution_logs_totem_id ON execution_logs(totem_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_executed_at ON execution_logs(executed_at);
CREATE INDEX IF NOT EXISTS idx_execution_logs_client_id ON execution_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_campaign_id ON execution_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_media_id ON execution_logs(media_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_media_id ON execution_logs(media_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_play_success ON execution_logs(play_success);
CREATE INDEX IF NOT EXISTS idx_execution_logs_totem_executed ON execution_logs(totem_id, executed_at, play_success);
CREATE INDEX IF NOT EXISTS idx_execution_logs_totem_campaign ON execution_logs(totem_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_executed_desc ON execution_logs(executed_at DESC);

-- Índices para aggregated_metrics
CREATE INDEX IF NOT EXISTS idx_aggregated_metrics_date ON aggregated_metrics(date);
CREATE INDEX IF NOT EXISTS idx_aggregated_metrics_totem_id ON aggregated_metrics(totem_id);

-- Índices para totem_update_status
CREATE INDEX IF NOT EXISTS idx_totem_update_status_status ON totem_update_status(update_status);
CREATE INDEX IF NOT EXISTS idx_totem_update_status_last_check ON totem_update_status(last_check);

-- Índices para interaction_logs
CREATE INDEX IF NOT EXISTS idx_interaction_logs_totem_id ON interaction_logs(totem_id);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_type ON interaction_logs(interaction_type);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_timestamp ON interaction_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_totem_type_timestamp ON interaction_logs(totem_id, interaction_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_timestamp_desc ON interaction_logs(timestamp DESC);

-- Índices para totem_network
CREATE INDEX IF NOT EXISTS idx_totem_network_totem_id ON totem_network(totem_id);
CREATE INDEX IF NOT EXISTS idx_totem_network_network_id ON totem_network(network_id);

-- Índices para fx_telemetry
CREATE INDEX IF NOT EXISTS idx_fx_telemetry_totem_id ON fx_telemetry(totem_id);
CREATE INDEX IF NOT EXISTS idx_fx_telemetry_effect_id ON fx_telemetry(effect_id);
CREATE INDEX IF NOT EXISTS idx_fx_telemetry_created_at ON fx_telemetry(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fx_telemetry_status ON fx_telemetry(status);
CREATE INDEX IF NOT EXISTS idx_fx_telemetry_site_id ON fx_telemetry(site_id);
CREATE INDEX IF NOT EXISTS idx_fx_telemetry_logged_at ON fx_telemetry(logged_at);
CREATE INDEX IF NOT EXISTS idx_fx_telemetry_success ON fx_telemetry(success);
CREATE INDEX IF NOT EXISTS idx_fx_telemetry_site_logged ON fx_telemetry(site_id, logged_at, success);

-- Índices para fx_totem_sites
CREATE INDEX IF NOT EXISTS idx_fx_totem_sites_totem_id ON fx_totem_sites(totem_id);
CREATE INDEX IF NOT EXISTS idx_fx_totem_sites_site_id ON fx_totem_sites(site_id);
CREATE INDEX IF NOT EXISTS idx_fx_totem_sites_role ON fx_totem_sites(role);

-- Índices para playlist_items
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id ON playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_order ON playlist_items(playlist_id, order_index);
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_order ON playlist_items(playlist_id, order_index);

-- Índices para event_logs
CREATE INDEX IF NOT EXISTS idx_event_logs_event_type ON event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_event_logs_totem_id ON event_logs(totem_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_campaign_id ON event_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_playlist_id ON event_logs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_media_id ON event_logs(media_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_timestamp ON event_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_event_logs_entity ON event_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_bi ON event_logs(totem_id, campaign_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_event_logs_event_type ON event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_event_logs_logged_at ON event_logs(logged_at);
CREATE INDEX IF NOT EXISTS idx_event_logs_totem_type ON event_logs(totem_id, event_type, logged_at);
CREATE INDEX IF NOT EXISTS idx_event_logs_totem_timestamp ON event_logs(totem_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_event_logs_timestamp_desc ON event_logs(timestamp DESC);

-- Índices para analytics_qr_scans
CREATE INDEX IF NOT EXISTS idx_analytics_qr_scans_qr_code_id ON analytics_qr_scans(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_analytics_qr_scans_totem_id ON analytics_qr_scans(totem_id);
CREATE INDEX IF NOT EXISTS idx_analytics_qr_scans_scan_timestamp ON analytics_qr_scans(scan_timestamp);

-- Índices para remote_screenshots
CREATE INDEX IF NOT EXISTS idx_remote_screenshots_totem_id ON remote_screenshots(totem_id);
CREATE INDEX IF NOT EXISTS idx_remote_screenshots_created_at ON remote_screenshots(created_at);

-- Índices para payments
CREATE INDEX IF NOT EXISTS idx_payments_billing_id ON payments(billing_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Índices para ON
CREATE INDEX IF NOT EXISTS idx_advanced_schedules_next_execution ON advanced_schedules(next_execution);
CREATE INDEX IF NOT EXISTS idx_export_schedules_next_execution ON export_schedules(next_execution);
CREATE INDEX IF NOT EXISTS idx_ota_updates_version ON ota_updates(version);

-- Índices para notifications
CREATE INDEX IF NOT EXISTS idx_notifications_notification_id ON notifications(notification_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_client_id ON notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, created_at DESC) WHERE user_id IS NOT NULL;


-- =============================================
-- COMENTÁRIOS, VIEWS, FUNCTIONS, ETC.
-- =============================================


-- Users

-- Password Reset Tokens

-- Índices para password_reset_tokens

-- Hosts

-- Locals

-- Totems

-- Smart TVs

-- Campaigns

-- Media

-- Playlists

-- Playlist Items

-- Smart Playlists


-- Ensure legacy databases have updated columns

-- Campaign Playlists

-- Campaign Totems

-- QR Codes

-- Criar índice para melhorar performance nas consultas

-- Short Links

-- Remote Commands

-- Billing


-- Payments


-- Analytics Sessions

-- Analytics Emotions

-- Analytics Gestures

-- Analytics QR Scans

-- AI Models

-- Execution Logs

-- System Logs

-- Webhook Configs

-- Webhook Deliveries

-- Alert Rules

-- Alert Logs

-- ML Tables






-- RBAC Tables




-- Approval Workflow

-- Audit Log

-- Aggregated Metrics

-- Device Certificates

-- =============================================
-- INDEXES
-- =============================================

-- Performance indexes

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

-- Criar trigger apenas se não existir (idempotente)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_clients_timestamp') THEN
        CREATE TRIGGER update_clients_timestamp BEFORE UPDATE ON clients
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_timestamp') THEN
        CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_hosts_timestamp') THEN
        CREATE TRIGGER update_hosts_timestamp BEFORE UPDATE ON hosts
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_locals_timestamp') THEN
        CREATE TRIGGER update_locals_timestamp BEFORE UPDATE ON locals
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_totems_timestamp') THEN
        CREATE TRIGGER update_totems_timestamp BEFORE UPDATE ON totems
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_smart_tvs_timestamp') THEN
        CREATE TRIGGER update_smart_tvs_timestamp BEFORE UPDATE ON smart_tvs
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_campaigns_timestamp') THEN
        CREATE TRIGGER update_campaigns_timestamp BEFORE UPDATE ON campaigns
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_medias_timestamp') THEN
        CREATE TRIGGER update_medias_timestamp BEFORE UPDATE ON medias
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_playlists_timestamp') THEN
        CREATE TRIGGER update_playlists_timestamp BEFORE UPDATE ON playlists
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_playlist_items_timestamp') THEN
        CREATE TRIGGER update_playlist_items_timestamp BEFORE UPDATE ON playlist_items
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_campaign_playlists_timestamp') THEN
        CREATE TRIGGER update_campaign_playlists_timestamp BEFORE UPDATE ON campaign_playlists
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_campaign_totems_timestamp') THEN
        CREATE TRIGGER update_campaign_totems_timestamp BEFORE UPDATE ON campaign_totems
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_webhook_configs_timestamp') THEN
        CREATE TRIGGER update_webhook_configs_timestamp BEFORE UPDATE ON webhook_configs
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_alert_rules_timestamp') THEN
        CREATE TRIGGER update_alert_rules_timestamp BEFORE UPDATE ON alert_rules
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_roles_timestamp') THEN
        CREATE TRIGGER update_roles_timestamp BEFORE UPDATE ON roles
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_approval_workflows_timestamp') THEN
        CREATE TRIGGER update_approval_workflows_timestamp BEFORE UPDATE ON approval_workflows
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ai_models_timestamp') THEN
        CREATE TRIGGER update_ai_models_timestamp BEFORE UPDATE ON ai_models
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ml_models_timestamp') THEN
        CREATE TRIGGER update_ml_models_timestamp BEFORE UPDATE ON ml_models
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_totem_ml_config_timestamp') THEN
        CREATE TRIGGER update_totem_ml_config_timestamp BEFORE UPDATE ON totem_ml_config
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;


-- =============================================
-- ADVANCED SCHEDULING MODULE
-- =============================================

-- Advanced Schedules Schema - Smart Signage v2.1
-- Sistema de agendamento avançado para campanhas e playlists

-- Tabela de agendamentos avançados

-- Índices para otimização

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_advanced_schedules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_advanced_schedules_timestamp') THEN
        CREATE TRIGGER update_advanced_schedules_timestamp BEFORE UPDATE ON advanced_schedules
            FOR EACH ROW EXECUTE FUNCTION update_advanced_schedules_timestamp();
    END IF;
END $$;

-- Tabela de histórico de execuções de agendamentos

-- Índices para histórico


-- =============================================
-- CRONSQL EXPORTS MODULE
-- =============================================

-- =============================================
-- EXPORT QUERIES AND SCHEDULES SCHEMA
-- =============================================
-- Tabelas para gerenciamento de exportações DB → Excel
-- Usando Bull + Redis para gerenciamento de filas

-- Export Queries

-- Export Schedules (Agendamentos)

-- Export Executions (Histórico de execuções)

-- Índices para performance

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_export_queries_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_export_queries_timestamp') THEN
        CREATE TRIGGER update_export_queries_timestamp
            BEFORE UPDATE ON export_queries
            FOR EACH ROW
            EXECUTE FUNCTION update_export_queries_timestamp();
    END IF;
END $$;

CREATE OR REPLACE FUNCTION update_export_schedules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_export_schedules_timestamp') THEN
        CREATE TRIGGER update_export_schedules_timestamp
            BEFORE UPDATE ON export_schedules
            FOR EACH ROW
            EXECUTE FUNCTION update_export_schedules_timestamp();
    END IF;
END $$;

-- Comentários
COMMENT ON TABLE export_queries IS 'Queries SQL para exportação (Excel, PDF, CSV)';
COMMENT ON TABLE export_schedules IS 'Agendamentos de exportação usando Bull/Redis';
COMMENT ON TABLE export_executions IS 'Histórico de execuções de exportações';

COMMENT ON COLUMN export_queries.provider IS 'Tipo de banco: PostgreSQL, Redis, Grafana, Prometheus (bancos do sistema)';
COMMENT ON COLUMN export_queries.database_config IS 'Configuração do banco (usar banco do sistema) - JSON com configurações específicas por provider. Se vazio, usa configuração do sistema';
COMMENT ON COLUMN export_queries.export_config IS 'Configuração de exportação (diretório, formato: xlsx/pdf/csv, formatação)';

COMMENT ON COLUMN export_schedules.cron_expression IS 'Expressão cron (ex: 0 8 * * * para diário às 8h)';
COMMENT ON COLUMN export_schedules.next_execution IS 'Próxima execução calculada baseada no cron';

COMMENT ON COLUMN export_executions.job_id IS 'ID do job no Bull/Redis';
COMMENT ON COLUMN export_executions.status IS 'Status: pending, running, completed, failed, cancelled';


-- =============================================
-- REPORTS MODULE
-- =============================================

-- Reports Schema - Smart Signage Pro v2.1
-- Tabelas para gerenciamento de relatórios

-- Reports Table

-- Report Templates Table

-- Índices para reports

-- Índices para report_templates


-- =============================================
-- ANALYTICS & AUDITING VIEWS
-- =============================================

-- =============================================
-- VIEWS SCHEMA - Smart Signage v2.1
-- =============================================
-- Views para mascarar queries complexas
-- Permissões de leitura apenas (SELECT)
-- =============================================

-- =============================================
-- E. EXECUÇÃO E MONITORAMENTO (Prioritário)
-- =============================================

-- E1. View: Logs de Execução Completo
CREATE OR REPLACE VIEW v_execution_logs_complete AS
SELECT 
    el.log_id,
    el.executed_at,
    el.start_time,
    el.end_time,
    el.duration_seconds,
    el.status,
    el.play_success,
    el.error_code,
    -- Totem
    t.totem_id,
    t.identifier AS totem_identifier,
    t.status AS totem_status,
    t.last_heartbeat AS totem_last_heartbeat,
    -- Localização
    l.local_id,
    l.description AS local_description,
    h.host_id,
    h.name AS host_name,
    h.contact_name AS host_contact,
    h.email AS host_email,
    h.phone AS host_phone,
    -- Cliente
    c.client_id,
    c.name AS client_name,
    c.contact_name AS client_contact,
    c.email AS client_email,
    c.phone AS client_phone,
    -- Campanha
    camp.campaign_id,
    camp.title AS campaign_title,
    camp.campaign_type AS campaign_type,
    camp.status AS campaign_status,
    camp.start_date AS campaign_start_date,
    camp.end_date AS campaign_end_date,
    -- Mídia
    m.media_id,
    m.name AS media_name,
    m.title AS media_title,
    m.media_type AS media_type,
    m.duration_seconds AS media_duration,
    m.size_bytes AS media_size,
    m.status AS media_status
FROM execution_logs el
LEFT JOIN totems t ON el.totem_id = t.totem_id
LEFT JOIN locals l ON t.local_id = l.local_id
LEFT JOIN hosts h ON l.host_id = h.host_id
LEFT JOIN clients c ON el.client_id = c.client_id
LEFT JOIN campaigns camp ON el.campaign_id = camp.campaign_id
LEFT JOIN medias m ON el.media_id = m.media_id;

COMMENT ON VIEW v_execution_logs_complete IS 'View com logs de execução completos incluindo totem, localização, cliente, campanha e mídia';

-- E2. View: Comandos Remotos por Totem
CREATE OR REPLACE VIEW v_remote_commands_complete AS
SELECT 
    rc.id AS command_id,
    rc.request_id,
    rc.command_type,
    rc.command_data,
    rc.priority,
    rc.status,
    rc.created_at,
    rc.executed_at,
    rc.result,
    -- Totem
    t.totem_id,
    t.identifier AS totem_identifier,
    t.status AS totem_status,
    t.last_heartbeat AS totem_last_heartbeat,
    -- Localização
    l.local_id,
    l.description AS local_description,
    h.host_id,
    h.name AS host_name,
    -- Criador
    u.id AS user_id,
    u.username AS user_username,
    u.name AS user_name,
    u.role AS user_role,
    -- Cliente (via totem -> campaign -> client)
    c.client_id,
    c.name AS client_name
FROM remote_commands rc
LEFT JOIN totems t ON rc.totem_id = t.totem_id
LEFT JOIN locals l ON t.local_id = l.local_id
LEFT JOIN hosts h ON l.host_id = h.host_id
LEFT JOIN users u ON rc.created_by = u.id
LEFT JOIN campaign_totems ct ON t.totem_id = ct.totem_id
LEFT JOIN campaigns camp ON ct.campaign_id = camp.campaign_id
LEFT JOIN clients c ON camp.client_id = c.client_id;

COMMENT ON VIEW v_remote_commands_complete IS 'View com comandos remotos incluindo totem, localização, criador e cliente';

-- E3. View: Performance de Playlists por Totem
CREATE OR REPLACE VIEW v_playlist_performance AS
SELECT 
    el.log_id,
    el.executed_at,
    el.duration_seconds,
    el.status,
    el.play_success,
    -- Totem
    t.totem_id,
    t.identifier AS totem_identifier,
    -- Playlist (via campaign)
    p.playlist_id,
    p.name AS playlist_name,
    p.description AS playlist_description,
    p.is_default AS playlist_is_default,
    p.loop AS playlist_loop,
    -- Campanha
    camp.campaign_id,
    camp.title AS campaign_title,
    camp.campaign_type AS campaign_type,
    camp.status AS campaign_status,
    -- Mídias da Playlist (agregado)
    COUNT(DISTINCT pi.media_id) AS media_count,
    SUM(pi.display_seconds) AS total_duration_seconds,
    -- Cliente
    c.client_id,
    c.name AS client_name,
    -- Localização
    l.local_id,
    l.description AS local_description,
    h.host_id,
    h.name AS host_name
FROM execution_logs el
LEFT JOIN totems t ON el.totem_id = t.totem_id
LEFT JOIN campaigns camp ON el.campaign_id = camp.campaign_id
LEFT JOIN playlists p ON p.campaign_id = camp.campaign_id AND p.totem_id = t.totem_id
LEFT JOIN playlist_items pi ON p.playlist_id = pi.playlist_id
LEFT JOIN clients c ON camp.client_id = c.client_id
LEFT JOIN locals l ON t.local_id = l.local_id
LEFT JOIN hosts h ON l.host_id = h.host_id
GROUP BY 
    el.log_id, el.executed_at, el.duration_seconds, el.status, el.play_success,
    t.totem_id, t.identifier,
    p.playlist_id, p.name, p.description, p.is_default, p.loop,
    camp.campaign_id, camp.title, camp.campaign_type, camp.status,
    c.client_id, c.name,
    l.local_id, l.description,
    h.host_id, h.name;

COMMENT ON VIEW v_playlist_performance IS 'View com performance de playlists incluindo agregações de mídias';

-- E4. View: Estatísticas de Execução Agregadas (por dia)
CREATE OR REPLACE VIEW v_execution_stats_daily AS
SELECT 
    DATE_TRUNC('day', el.executed_at) AS period,
    -- Totem
    t.totem_id,
    t.identifier AS totem_identifier,
    -- Campanha
    camp.campaign_id,
    camp.title AS campaign_title,
    -- Cliente
    c.client_id,
    c.name AS client_name,
    -- Métricas Agregadas
    COUNT(*) AS total_executions,
    COUNT(CASE WHEN el.play_success = true THEN 1 END) AS successful_executions,
    COUNT(CASE WHEN el.play_success = false THEN 1 END) AS failed_executions,
    AVG(el.duration_seconds) AS avg_duration_seconds,
    SUM(el.duration_seconds) AS total_duration_seconds,
    MIN(el.duration_seconds) AS min_duration_seconds,
    MAX(el.duration_seconds) AS max_duration_seconds,
    COUNT(DISTINCT el.totem_id) AS unique_totems,
    COUNT(DISTINCT el.campaign_id) AS unique_campaigns,
    COUNT(DISTINCT el.media_id) AS unique_medias
FROM execution_logs el
LEFT JOIN totems t ON el.totem_id = t.totem_id
LEFT JOIN campaigns camp ON el.campaign_id = camp.campaign_id
LEFT JOIN clients c ON el.client_id = c.client_id
WHERE el.executed_at IS NOT NULL
GROUP BY 
    DATE_TRUNC('day', el.executed_at),
    t.totem_id, t.identifier,
    camp.campaign_id, camp.title,
    c.client_id, c.name;

COMMENT ON VIEW v_execution_stats_daily IS 'View com estatísticas agregadas de execução por dia';

-- E5. View: Estatísticas de Execução Agregadas (por hora)
CREATE OR REPLACE VIEW v_execution_stats_hourly AS
SELECT 
    DATE_TRUNC('hour', el.executed_at) AS period,
    -- Totem
    t.totem_id,
    t.identifier AS totem_identifier,
    -- Campanha
    camp.campaign_id,
    camp.title AS campaign_title,
    -- Cliente
    c.client_id,
    c.name AS client_name,
    -- Métricas Agregadas
    COUNT(*) AS total_executions,
    COUNT(CASE WHEN el.play_success = true THEN 1 END) AS successful_executions,
    COUNT(CASE WHEN el.play_success = false THEN 1 END) AS failed_executions,
    AVG(el.duration_seconds) AS avg_duration_seconds,
    SUM(el.duration_seconds) AS total_duration_seconds,
    MIN(el.duration_seconds) AS min_duration_seconds,
    MAX(el.duration_seconds) AS max_duration_seconds,
    COUNT(DISTINCT el.totem_id) AS unique_totems,
    COUNT(DISTINCT el.campaign_id) AS unique_campaigns,
    COUNT(DISTINCT el.media_id) AS unique_medias
FROM execution_logs el
LEFT JOIN totems t ON el.totem_id = t.totem_id
LEFT JOIN campaigns camp ON el.campaign_id = camp.campaign_id
LEFT JOIN clients c ON el.client_id = c.client_id
WHERE el.executed_at IS NOT NULL
GROUP BY 
    DATE_TRUNC('hour', el.executed_at),
    t.totem_id, t.identifier,
    camp.campaign_id, camp.title,
    c.client_id, c.name;

COMMENT ON VIEW v_execution_stats_hourly IS 'View com estatísticas agregadas de execução por hora';

-- =============================================
-- G. RBAC E AUDITORIA (Prioritário)
-- =============================================

-- G1. View: Usuários com Roles e Permissões
-- Nota: Esta view usa JSON_AGG, então pode precisar de ajustes
CREATE OR REPLACE VIEW v_users_with_roles AS
SELECT 
    u.id AS user_id,
    u.username,
    u.email,
    u.name AS user_name,
    u.role AS user_role,
    u.is_active AS user_is_active,
    u.last_login,
    u.created_at AS user_created_at,
    -- Cliente
    c.client_id,
    c.name AS client_name,
    c.email AS client_email,
    c.phone AS client_phone,
    c.is_active AS client_active,
    -- Contagem de roles e permissões
    COUNT(DISTINCT r.role_id) AS role_count,
    COUNT(DISTINCT p.permission_id) AS permission_count
FROM users u
LEFT JOIN clients c ON u.client_id = c.client_id
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.role_id
LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.permission_id
GROUP BY 
    u.id, u.username, u.email, u.name, u.role, u.is_active, u.last_login, u.created_at,
    c.client_id, c.name, c.email, c.phone, c.is_active;

COMMENT ON VIEW v_users_with_roles IS 'View com usuários e contagem de roles e permissões';

-- G2. View: Logs de Auditoria com Contexto
CREATE OR REPLACE VIEW v_audit_logs_complete AS
SELECT 
    al.id AS audit_id,
    al.action,
    al.entity,
    al.entity_id,
    al.metadata,
    al.timestamp AS audit_timestamp,
    -- Usuário
    u.id AS user_id,
    u.username,
    u.name AS user_name,
    u.email AS user_email,
    u.role AS user_role,
    -- Cliente (via usuário)
    c.client_id,
    c.name AS client_name,
    -- Detalhes da entidade (baseado no tipo)
    CASE 
        WHEN al.entity = 'media' THEN (SELECT name FROM medias WHERE media_id = al.entity_id)
        WHEN al.entity = 'campaign' THEN (SELECT title FROM campaigns WHERE campaign_id = al.entity_id)
        WHEN al.entity = 'totem' THEN (SELECT identifier FROM totems WHERE totem_id = al.entity_id)
        WHEN al.entity = 'user' THEN (SELECT username FROM users WHERE id = al.entity_id)
        WHEN al.entity = 'client' THEN (SELECT name FROM clients WHERE client_id = al.entity_id)
        ELSE NULL
    END AS entity_name
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
LEFT JOIN clients c ON u.client_id = c.client_id;

COMMENT ON VIEW v_audit_logs_complete IS 'View com logs de auditoria incluindo usuário, cliente e nome da entidade';

-- G3. View: Atividades de Usuários por Dia
CREATE OR REPLACE VIEW v_user_activities_daily AS
SELECT 
    DATE_TRUNC('day', al.timestamp) AS period,
    -- Usuário
    u.id AS user_id,
    u.username,
    u.name AS user_name,
    u.role AS user_role,
    -- Cliente
    c.client_id,
    c.name AS client_name,
    -- Métricas Agregadas
    COUNT(*) AS total_actions,
    COUNT(DISTINCT al.entity) AS unique_entities,
    COUNT(DISTINCT al.action) AS unique_actions,
    COUNT(CASE WHEN al.action = 'create' THEN 1 END) AS create_count,
    COUNT(CASE WHEN al.action = 'update' THEN 1 END) AS update_count,
    COUNT(CASE WHEN al.action = 'delete' THEN 1 END) AS delete_count,
    COUNT(CASE WHEN al.action = 'approve' THEN 1 END) AS approve_count,
    COUNT(CASE WHEN al.action = 'login' THEN 1 END) AS login_count,
    COUNT(CASE WHEN al.action = 'logout' THEN 1 END) AS logout_count
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
LEFT JOIN clients c ON u.client_id = c.client_id
WHERE al.timestamp IS NOT NULL
GROUP BY 
    DATE_TRUNC('day', al.timestamp),
    u.id, u.username, u.name, u.role,
    c.client_id, c.name;

COMMENT ON VIEW v_user_activities_daily IS 'View com atividades de usuários agregadas por dia';

-- G4. View: Permissões por Role
CREATE OR REPLACE VIEW v_role_permissions AS
SELECT 
    r.role_id,
    r.name AS role_name,
    r.description AS role_description,
    r.is_active AS role_active,
    -- Contagem por recurso
    COUNT(DISTINCT CASE WHEN p.resource = 'media' THEN p.permission_id END) AS media_permissions,
    COUNT(DISTINCT CASE WHEN p.resource = 'campaign' THEN p.permission_id END) AS campaign_permissions,
    COUNT(DISTINCT CASE WHEN p.resource = 'totem' THEN p.permission_id END) AS totem_permissions,
    COUNT(DISTINCT CASE WHEN p.resource = 'user' THEN p.permission_id END) AS user_permissions,
    COUNT(DISTINCT CASE WHEN p.resource = 'client' THEN p.permission_id END) AS client_permissions,
    -- Total de permissões
    COUNT(DISTINCT p.permission_id) AS total_permissions,
    -- Usuários com esta role
    COUNT(DISTINCT ur.user_id) AS user_count
FROM roles r
LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.permission_id
LEFT JOIN user_roles ur ON r.role_id = ur.role_id
GROUP BY 
    r.role_id, r.name, r.description, r.is_active;

COMMENT ON VIEW v_role_permissions IS 'View com permissões por role e contagens';

-- =============================================
-- A. GESTÃO DE TOTEMS E LOCALIZAÇÃO
-- =============================================

-- A1. View: Totems com Localização Completa
CREATE OR REPLACE VIEW v_totems_complete AS
SELECT 
    t.totem_id,
    t.identifier,
    t.uin,
    t.device_id,
    t.description AS totem_description,
    t.status AS totem_status,
    t.version,
    t.firmware_version,
    t.ip_address,
    t.last_seen,
    t.last_heartbeat,
    t.active AS totem_active,
    t.blocked AS totem_blocked,
    t.blocked_until,
    t.created_at AS totem_created_at,
    t.updated_at AS totem_updated_at,
    -- Localização
    l.local_id,
    l.description AS local_description,
    l.active AS local_active,
    h.host_id,
    h.name AS host_name,
    h.contact_name AS host_contact,
    h.email AS host_email,
    h.phone AS host_phone,
    h.wths AS host_wths,
    h.description AS host_description,
    h.active AS host_active,
    -- Cliente (via campanhas)
    c.client_id,
    c.name AS client_name,
    c.contact_name AS client_contact,
    c.email AS client_email,
    c.phone AS client_phone,
    -- Smart TV
    st.smartv_id,
    st.brand AS smart_tv_brand,
    st.model AS smart_tv_model,
    st.ip_address AS smart_tv_ip,
    st.active AS smart_tv_active,
    -- Estatísticas
    COUNT(DISTINCT p.playlist_id) AS playlist_count,
    COUNT(DISTINCT ct.campaign_id) AS campaign_count,
    COUNT(DISTINCT el.log_id) AS execution_count,
    MAX(el.executed_at) AS last_execution
FROM totems t
LEFT JOIN locals l ON t.local_id = l.local_id
LEFT JOIN hosts h ON l.host_id = h.host_id
LEFT JOIN smart_tvs st ON t.totem_id = st.totem_id
LEFT JOIN playlists p ON t.totem_id = p.totem_id
LEFT JOIN campaign_totems ct ON t.totem_id = ct.totem_id
LEFT JOIN campaigns camp ON ct.campaign_id = camp.campaign_id
LEFT JOIN clients c ON camp.client_id = c.client_id
LEFT JOIN execution_logs el ON t.totem_id = el.totem_id
GROUP BY 
    t.totem_id, t.identifier, t.uin, t.device_id, t.description, t.status,
    t.version, t.firmware_version, t.ip_address, t.last_seen, t.last_heartbeat,
    t.active, t.blocked, t.blocked_until, t.created_at, t.updated_at,
    l.local_id, l.description, l.active,
    h.host_id, h.name, h.contact_name, h.email, h.phone, h.wths, h.description, h.active,
    c.client_id, c.name, c.contact_name, c.email, c.phone,
    st.smartv_id, st.brand, st.model, st.ip_address, st.active;

COMMENT ON VIEW v_totems_complete IS 'View com totems incluindo localização, cliente, smart TV e estatísticas';

-- =============================================
-- B. GESTÃO DE CAMPANHAS
-- =============================================

-- B1. View: Campanhas com Detalhes Completos
CREATE OR REPLACE VIEW v_campaigns_complete AS
SELECT 
    camp.campaign_id,
    camp.title,
    camp.description AS campaign_description,
    camp.campaign_type,
    camp.priority,
    camp.start_date,
    camp.end_date,
    camp.start_time,
    camp.end_time,
    camp.days_of_week,
    camp.status AS campaign_status,
    camp.is_active AS campaign_active,
    camp.created_at AS campaign_created_at,
    camp.updated_at AS campaign_updated_at,
    -- Cliente
    c.client_id,
    c.name AS client_name,
    c.contact_name AS client_contact,
    c.email AS client_email,
    c.phone AS client_phone,
    c.is_active AS client_active,
    -- Estatísticas
    COUNT(DISTINCT ct.totem_id) AS totem_count,
    COUNT(DISTINCT p.playlist_id) AS playlist_count,
    COUNT(DISTINCT cp.playlist_id) AS campaign_playlist_count,
    COUNT(DISTINCT qr.qr_code_id) AS qr_code_count,
    COUNT(DISTINCT sl.short_id) AS short_link_count,
    COUNT(DISTINCT el.log_id) AS execution_count,
    COUNT(DISTINCT CASE WHEN el.play_success = true THEN el.log_id END) AS successful_executions,
    COUNT(DISTINCT CASE WHEN el.play_success = false THEN el.log_id END) AS failed_executions
FROM campaigns camp
LEFT JOIN clients c ON camp.client_id = c.client_id
LEFT JOIN campaign_totems ct ON camp.campaign_id = ct.campaign_id
LEFT JOIN playlists p ON camp.campaign_id = p.campaign_id
LEFT JOIN campaign_playlists cp ON camp.campaign_id = cp.campaign_id
LEFT JOIN qr_codes qr ON camp.campaign_id = qr.campaign_id
LEFT JOIN short_links sl ON camp.campaign_id = sl.campaign_id
LEFT JOIN execution_logs el ON camp.campaign_id = el.campaign_id
GROUP BY 
    camp.campaign_id, camp.title, camp.description, camp.campaign_type, camp.priority,
    camp.start_date, camp.end_date, camp.start_time, camp.end_time, camp.days_of_week,
    camp.status, camp.is_active, camp.created_at, camp.updated_at,
    c.client_id, c.name, c.contact_name, c.email, c.phone, c.is_active;

COMMENT ON VIEW v_campaigns_complete IS 'View com campanhas incluindo cliente e estatísticas completas';

-- =============================================
-- C. GESTÃO DE MÍDIAS
-- =============================================

-- C1. View: Mídias com Detalhes e Workflow
CREATE OR REPLACE VIEW v_medias_complete AS
SELECT 
    m.media_id,
    m.name AS media_name,
    m.title AS media_title,
    m.description AS media_description,
    m.tags,
    m.version,
    m.checksum,
    m.preview_url,
    m.status AS media_status,
    m.file_path,
    m.media_type,
    m.duration_seconds,
    m.size_bytes,
    m.mime_type,
    m.width,
    m.height,
    m.created_at AS media_created_at,
    m.updated_at AS media_updated_at,
    -- Cliente
    c.client_id,
    c.name AS client_name,
    c.email AS client_email,
    c.is_active AS client_active,
    -- Criador
    u.id AS creator_id,
    u.username AS creator_username,
    u.name AS creator_name,
    u.role AS creator_role,
    -- Workflow de Aprovação
    aw.id AS workflow_id,
    aw.status AS workflow_status,
    aw.reviewed_at,
    aw.comment AS workflow_comment,
    reviewer.id AS reviewer_id,
    reviewer.username AS reviewer_username,
    reviewer.name AS reviewer_name,
    -- Estatísticas
    COUNT(DISTINCT pi.item_id) AS playlist_item_count,
    COUNT(DISTINCT p.playlist_id) AS playlist_count,
    COUNT(DISTINCT el.log_id) AS execution_count,
    COUNT(DISTINCT CASE WHEN el.play_success = true THEN el.log_id END) AS successful_plays
FROM medias m
LEFT JOIN clients c ON m.client_id = c.client_id
LEFT JOIN users u ON m.created_by = u.id
LEFT JOIN approval_workflows aw ON m.media_id = aw.media_id
LEFT JOIN users reviewer ON aw.reviewed_by = reviewer.id
LEFT JOIN playlist_items pi ON m.media_id = pi.media_id
LEFT JOIN playlists p ON pi.playlist_id = p.playlist_id
LEFT JOIN execution_logs el ON m.media_id = el.media_id
GROUP BY 
    m.media_id, m.name, m.title, m.description, m.tags, m.version, m.checksum,
    m.preview_url, m.status, m.file_path, m.media_type, m.duration_seconds,
    m.size_bytes, m.mime_type, m.width, m.height, m.created_at, m.updated_at,
    c.client_id, c.name, c.email, c.is_active,
    u.id, u.username, u.name, u.role,
    aw.id, aw.status, aw.reviewed_at, aw.comment,
    reviewer.id, reviewer.username, reviewer.name;

COMMENT ON VIEW v_medias_complete IS 'View com mídias incluindo cliente, criador, workflow e estatísticas';

-- =============================================
-- D. ANALYTICS E RELATÓRIOS
-- =============================================

-- D1. View: Sessões de Analytics por Totem
CREATE OR REPLACE VIEW v_analytics_sessions_complete AS
SELECT 
    asess.id AS session_id,
    asess.session_start,
    asess.session_end,
    asess.total_interactions,
    asess.avg_emotion_score,
    asess.dominant_emotion,
    asess.age_range,
    asess.gender,
    asess.location AS session_location,
    asess.created_at AS session_created_at,
    -- Totem
    t.totem_id,
    t.identifier AS totem_identifier,
    t.status AS totem_status,
    -- Localização
    l.local_id,
    l.description AS local_description,
    h.host_id,
    h.name AS host_name,
    -- Cliente (via campanhas)
    c.client_id,
    c.name AS client_name,
    -- Métricas de Emoções
    COUNT(DISTINCT ae.id) AS emotion_count,
    COUNT(DISTINCT CASE WHEN ae.emotion = 'happy' THEN ae.id END) AS happy_count,
    COUNT(DISTINCT CASE WHEN ae.emotion = 'sad' THEN ae.id END) AS sad_count,
    COUNT(DISTINCT CASE WHEN ae.emotion = 'angry' THEN ae.id END) AS angry_count,
    COUNT(DISTINCT CASE WHEN ae.emotion = 'surprised' THEN ae.id END) AS surprised_count,
    COUNT(DISTINCT CASE WHEN ae.emotion = 'neutral' THEN ae.id END) AS neutral_count,
    AVG(ae.confidence) AS avg_emotion_confidence,
    -- Métricas de Gestos
    COUNT(DISTINCT ag.id) AS gesture_count,
    COUNT(DISTINCT ag.gesture_type) AS unique_gesture_types,
    AVG(ag.confidence) AS avg_gesture_confidence
FROM analytics_sessions asess
LEFT JOIN totems t ON asess.totem_id = t.totem_id
LEFT JOIN locals l ON t.local_id = l.local_id
LEFT JOIN hosts h ON l.host_id = h.host_id
LEFT JOIN campaign_totems ct ON t.totem_id = ct.totem_id
LEFT JOIN campaigns camp ON ct.campaign_id = camp.campaign_id
LEFT JOIN clients c ON camp.client_id = c.client_id
LEFT JOIN analytics_emotions ae ON asess.id = ae.session_id
LEFT JOIN analytics_gestures ag ON asess.id = ag.session_id
GROUP BY 
    asess.id, asess.session_start, asess.session_end, asess.total_interactions,
    asess.avg_emotion_score, asess.dominant_emotion, asess.age_range, asess.gender,
    asess.location, asess.created_at,
    t.totem_id, t.identifier, t.status,
    l.local_id, l.description,
    h.host_id, h.name,
    c.client_id, c.name;

COMMENT ON VIEW v_analytics_sessions_complete IS 'View com sessões de analytics incluindo totem, localização, cliente e métricas de emoções/gestos';

-- =============================================
-- H. EXPORTAÇÃO (Novo Sistema)
-- =============================================

-- H1. View: Queries de Exportação com Criador
CREATE OR REPLACE VIEW v_export_queries_complete AS
SELECT 
    eq.query_id,
    eq.name AS query_name,
    eq.description AS query_description,
    eq.provider,
    eq.sql_query,
    eq.database_config,
    eq.export_config,
    eq.enabled AS query_enabled,
    eq.created_at AS query_created_at,
    eq.updated_at AS query_updated_at,
    -- Criador
    u.id AS creator_id,
    u.username AS creator_username,
    u.name AS creator_name,
    u.email AS creator_email,
    u.role AS creator_role,
    -- Estatísticas
    COUNT(DISTINCT es.schedule_id) AS schedule_count,
    COUNT(DISTINCT ee.execution_id) AS execution_count,
    COUNT(DISTINCT CASE WHEN ee.status = 'completed' THEN ee.execution_id END) AS successful_executions,
    COUNT(DISTINCT CASE WHEN ee.status = 'failed' THEN ee.execution_id END) AS failed_executions,
    MAX(ee.started_at) AS last_execution
FROM export_queries eq
LEFT JOIN users u ON eq.created_by = u.id
LEFT JOIN export_schedules es ON eq.query_id = es.query_id
LEFT JOIN export_executions ee ON eq.query_id = ee.query_id
GROUP BY 
    eq.query_id, eq.name, eq.description, eq.provider, eq.sql_query,
    eq.database_config, eq.export_config, eq.enabled, eq.created_at, eq.updated_at,
    u.id, u.username, u.name, u.email, u.role;

COMMENT ON VIEW v_export_queries_complete IS 'View com queries de exportação incluindo criador e estatísticas';

-- H2. View: Agendamentos de Exportação Completos
CREATE OR REPLACE VIEW v_export_schedules_complete AS
SELECT 
    es.schedule_id,
    es.name AS schedule_name,
    es.description AS schedule_description,
    es.cron_expression,
    es.enabled AS schedule_enabled,
    es.last_execution,
    es.next_execution,
    es.execution_count,
    es.success_count,
    es.failure_count,
    es.created_at AS schedule_created_at,
    es.updated_at AS schedule_updated_at,
    -- Query
    eq.query_id,
    eq.name AS query_name,
    eq.provider AS query_provider,
    eq.enabled AS query_enabled,
    -- Criador
    u.id AS creator_id,
    u.username AS creator_username,
    u.name AS creator_name,
    u.role AS creator_role,
    -- Estatísticas de Execução
    COUNT(DISTINCT ee.execution_id) AS total_executions,
    COUNT(DISTINCT CASE WHEN ee.status = 'completed' THEN ee.execution_id END) AS completed_executions,
    COUNT(DISTINCT CASE WHEN ee.status = 'failed' THEN ee.execution_id END) AS failed_executions,
    COUNT(DISTINCT CASE WHEN ee.status = 'running' THEN ee.execution_id END) AS running_executions,
    MAX(ee.completed_at) AS last_completed_execution,
    SUM(ee.records_exported) AS total_records_exported,
    SUM(ee.file_size) AS total_file_size
FROM export_schedules es
LEFT JOIN export_queries eq ON es.query_id = eq.query_id
LEFT JOIN users u ON es.created_by = u.id
LEFT JOIN export_executions ee ON es.schedule_id = ee.schedule_id
GROUP BY 
    es.schedule_id, es.name, es.description, es.cron_expression, es.enabled,
    es.last_execution, es.next_execution, es.execution_count, es.success_count,
    es.failure_count, es.created_at, es.updated_at,
    eq.query_id, eq.name, eq.provider, eq.enabled,
    u.id, u.username, u.name, u.role;

COMMENT ON VIEW v_export_schedules_complete IS 'View com agendamentos de exportação incluindo query, criador e estatísticas';

-- H3. View: Histórico de Execuções Completo
CREATE OR REPLACE VIEW v_export_executions_complete AS
SELECT 
    ee.execution_id,
    ee.job_id,
    ee.status AS execution_status,
    ee.started_at,
    ee.completed_at,
    ee.records_exported,
    ee.file_path,
    ee.file_size,
    ee.error_message,
    ee.execution_log,
    ee.created_at AS execution_created_at,
    -- Schedule
    es.schedule_id,
    es.name AS schedule_name,
    es.cron_expression,
    -- Query
    eq.query_id,
    eq.name AS query_name,
    eq.provider AS query_provider,
    -- Criador (via schedule)
    u.id AS creator_id,
    u.username AS creator_username,
    u.name AS creator_name,
    -- Duração calculada
    CASE 
        WHEN ee.started_at IS NOT NULL AND ee.completed_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (ee.completed_at - ee.started_at))
        ELSE NULL
    END AS duration_seconds
FROM export_executions ee
LEFT JOIN export_schedules es ON ee.schedule_id = es.schedule_id
LEFT JOIN export_queries eq ON ee.query_id = eq.query_id
LEFT JOIN users u ON es.created_by = u.id;

COMMENT ON VIEW v_export_executions_complete IS 'View com histórico de execuções incluindo schedule, query, criador e duração';

-- =============================================
-- PERMISSÕES (GRANT SELECT)
-- =============================================

-- Revogar todas as permissões existentes
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

-- Garantir que o usuário do banco tem permissões necessárias nas tabelas
-- (Isso deve ser feito pelo usuário admin, não pelo script)

-- Conceder SELECT apenas nas views para usuários de leitura
-- Criar role para usuários de leitura (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'readonly_user') THEN
        CREATE ROLE readonly_user;
    END IF;
END
$$;

-- Conceder SELECT nas views
GRANT SELECT ON v_execution_logs_complete TO readonly_user;
GRANT SELECT ON v_remote_commands_complete TO readonly_user;
GRANT SELECT ON v_playlist_performance TO readonly_user;
GRANT SELECT ON v_execution_stats_daily TO readonly_user;
GRANT SELECT ON v_execution_stats_hourly TO readonly_user;
GRANT SELECT ON v_users_with_roles TO readonly_user;
GRANT SELECT ON v_audit_logs_complete TO readonly_user;
GRANT SELECT ON v_user_activities_daily TO readonly_user;
GRANT SELECT ON v_role_permissions TO readonly_user;
GRANT SELECT ON v_totems_complete TO readonly_user;
GRANT SELECT ON v_campaigns_complete TO readonly_user;
GRANT SELECT ON v_medias_complete TO readonly_user;
GRANT SELECT ON v_analytics_sessions_complete TO readonly_user;
GRANT SELECT ON v_export_queries_complete TO readonly_user;
GRANT SELECT ON v_export_schedules_complete TO readonly_user;
GRANT SELECT ON v_export_executions_complete TO readonly_user;

-- Conceder SELECT nas views para usuário público (se necessário)
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO PUBLIC; -- Descomentar se necessário

-- Comentários finais
COMMENT ON SCHEMA public IS 'Smart Signage v2.1 - Schema com views para acesso de leitura apenas';


-- =============================================
-- SYSTEM SETTINGS & LOG ROTATION DEFAULTS
-- =============================================

-- =============================================
-- SCHEMA DE CONFIGURAÇÕES DE LOGS - Smart Signage v2.1
-- =============================================
-- Configurações parametrizáveis para sistema de logs
-- =============================================

-- Criar tabela system_settings se não existir

-- Criar índice na chave para busca rápida

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_system_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_system_settings_timestamp_trigger') THEN
        CREATE TRIGGER update_system_settings_timestamp_trigger
            BEFORE UPDATE ON system_settings
            FOR EACH ROW
            EXECUTE FUNCTION update_system_settings_timestamp();
    END IF;
END $$;

-- Comentários
COMMENT ON TABLE system_settings IS 'Configurações do sistema (incluindo logs)';
COMMENT ON COLUMN system_settings.setting_key IS 'Chave única da configuração';
COMMENT ON COLUMN system_settings.setting_value IS 'Valor da configuração';
COMMENT ON COLUMN system_settings.setting_type IS 'Tipo da configuração: string, number, boolean, json, array';
COMMENT ON COLUMN system_settings.category IS 'Categoria da configuração: logs, system, security, etc.';

-- Inserir configurações de logs no sistema (se não existirem)
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public, is_editable, default_value, validation, options) 
VALUES
  -- Configurações de rotação de logs
  (
    'log.rotation.max_size',
    '100MB',
    'string',
    'logs',
    'Tamanho máximo de cada arquivo de log antes de rotacionar (ex: 100MB, 1GB)',
    false,
    true,
    '100MB',
    '^\\d+(\\.\\d+)?\\s*(B|KB|MB|GB|TB)$',
    NULL
  ),
  (
    'log.rotation.max_days',
    '30',
    'number',
    'logs',
    'Número de dias para manter logs antigos antes de excluir',
    false,
    true,
    '30',
    '^[1-9]\\d*$',
    NULL
  ),
  (
    'log.rotation.min_free_space',
    '1GB',
    'string',
    'logs',
    'Espaço livre mínimo em disco antes de iniciar rotação agressiva (ex: 1GB, 500MB)',
    false,
    true,
    '1GB',
    '^\\d+(\\.\\d+)?\\s*(B|KB|MB|GB|TB)$',
    NULL
  ),
  (
    'log.level',
    'info',
    'string',
    'logs',
    'Nível de log (error, warn, info, debug)',
    false,
    true,
    'info',
    '^(error|warn|info|debug)$',
    '["error", "warn", "info", "debug"]'
  ),
  (
    'log.rotation.enabled',
    'true',
    'boolean',
    'logs',
    'Habilitar rotação automática de logs',
    false,
    true,
    'true',
    NULL,
    NULL
  ),
  (
    'log.rotation.compress',
    'true',
    'boolean',
    'logs',
    'Compactar logs antigos após rotação',
    false,
    true,
    'true',
    NULL,
    NULL
  ),
  (
    'log.alerts.enabled',
    'true',
    'boolean',
    'logs',
    'Habilitar alertas administrativos sobre rotação de logs',
    false,
    true,
    'true',
    NULL,
    NULL
  ),
  (
    'log.alerts.email',
    'false',
    'boolean',
    'logs',
    'Enviar alertas por email (requer configuração de email)',
    false,
    true,
    'false',
    NULL,
    NULL
  ),
  (
    'log.directory',
    '/opt/smart-signage/Logs',
    'string',
    'logs',
    'Diretório onde os logs são armazenados',
    false,
    true,
    '/opt/smart-signage/Logs',
    '^/.+$',
    NULL
  )
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description,
  is_editable = EXCLUDED.is_editable,
  validation = EXCLUDED.validation,
  options = EXCLUDED.options,
  updated_at = CURRENT_TIMESTAMP;

COMMENT ON TABLE system_settings IS 'Configurações do sistema (incluindo logs)';
COMMENT ON COLUMN system_settings.category IS 'Categoria da configuração: logs, system, security, media, etc.';

-- Inserir configurações de mídia (se não existirem)
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public, is_editable, default_value, validation, options) 
VALUES
  -- Configurações de upload de mídia
  (
    'media.upload.max_size',
    '500MB',
    'string',
    'media',
    'Tamanho máximo de arquivo para upload (ex: 100MB, 500MB, 1GB)',
    false,
    true,
    '500MB',
    '^\\d+(\\.\\d+)?\\s*(B|KB|MB|GB|TB)$',
    NULL
  ),
  (
    'media.upload.nginx_max_size',
    '500M',
    'string',
    'media',
    'Limite máximo do Nginx para upload (client_max_body_size)',
    false,
    true,
    '500M',
    '^\\d+(\\.\\d+)?\\s*(B|K|M|G|T)$',
    NULL
  ),
  (
    'media.upload.express_limit',
    '500mb',
    'string',
    'media',
    'Limite do Express body parser para upload',
    false,
    true,
    '500mb',
    '^\\d+(\\.\\d+)?\\s*(b|kb|mb|gb|tb)$',
    NULL
  ),
  (
    'media.upload.proxy_timeout',
    '300',
    'number',
    'media',
    'Timeout do proxy Nginx para uploads grandes (em segundos)',
    false,
    true,
    '300',
    '^\\d+$',
    NULL
  ),
  (
    'media.upload.allowed_types',
    'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,audio/mp3,audio/wav,audio/ogg',
    'string',
    'media',
    'Tipos MIME permitidos para upload (separados por vírgula)',
    false,
    true,
    'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,audio/mp3,audio/wav,audio/ogg',
    NULL,
    NULL
  ),
  (
    'media.storage.path',
    '/opt/smart-signage/public/assets/uploads',
    'string',
    'media',
    'Caminho do diretório de armazenamento de mídia',
    false,
    true,
    '/opt/smart-signage/public/assets/uploads',
    NULL,
    NULL
  ),
  (
    'media.storage.quota_per_client',
    '5GB',
    'string',
    'media',
    'Quota máxima de armazenamento por cliente',
    false,
    true,
    '5GB',
    '^\\d+(\\.\\d+)?\\s*(B|KB|MB|GB|TB)$',
    NULL
  ),
  (
    'media.storage.auto_cleanup',
    'false',
    'boolean',
    'media',
    'Limpar automaticamente mídias não utilizadas',
    false,
    true,
    'false',
    NULL,
    NULL
  ),
  (
    'media.storage.cleanup_days',
    '90',
    'number',
    'media',
    'Número de dias de inatividade antes de limpar mídia automaticamente',
    false,
    true,
    '90',
    '^\\d+$',
    NULL
  )
ON CONFLICT (setting_key) DO NOTHING;

-- =============================================
-- MIGRATIONS - QR Codes Table Update
-- =============================================
-- Migração para atualizar tabela qr_codes existente com novos campos
-- Esta migração é idempotente e pode ser executada múltiplas vezes

DO $$
BEGIN
    -- Verificar se a tabela qr_codes existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'qr_codes') THEN
        -- Renomear coluna id para qr_code_id se ainda não foi renomeada
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'id') THEN
            ALTER TABLE qr_codes RENAME COLUMN id TO qr_code_id;
        END IF;

        -- Adicionar coluna client_id se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'client_id') THEN
            ALTER TABLE qr_codes ADD COLUMN client_id INTEGER;
            ALTER TABLE qr_codes ADD CONSTRAINT fk_qr_codes_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE SET NULL;
        END IF;

        -- Adicionar coluna totem_id se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'totem_id') THEN
            ALTER TABLE qr_codes ADD COLUMN totem_id INTEGER;
            ALTER TABLE qr_codes ADD CONSTRAINT fk_qr_codes_totem FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE SET NULL;
        END IF;

        -- Tornar campaign_id opcional (remover NOT NULL se existir)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'campaign_id' AND is_nullable = 'NO') THEN
            ALTER TABLE qr_codes ALTER COLUMN campaign_id DROP NOT NULL;
        END IF;

        -- Adicionar coluna title se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'title') THEN
            ALTER TABLE qr_codes ADD COLUMN title TEXT;
            -- Se já existem registros, definir um título padrão baseado no content
            UPDATE qr_codes SET title = COALESCE(SUBSTRING(content, 1, 100), 'QR Code') WHERE title IS NULL;
            -- Agora tornar obrigatório
            ALTER TABLE qr_codes ALTER COLUMN title SET NOT NULL;
        END IF;

        -- Adicionar coluna description se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'description') THEN
            ALTER TABLE qr_codes ADD COLUMN description TEXT;
        END IF;

        -- Adicionar coluna size se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'size') THEN
            ALTER TABLE qr_codes ADD COLUMN size INTEGER DEFAULT 200;
        END IF;

        -- Adicionar coluna color se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'color') THEN
            ALTER TABLE qr_codes ADD COLUMN color TEXT DEFAULT '#000000';
        END IF;

        -- Adicionar coluna background_color se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'background_color') THEN
            ALTER TABLE qr_codes ADD COLUMN background_color TEXT DEFAULT '#FFFFFF';
        END IF;

        -- Adicionar coluna error_correction_level se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'error_correction_level') THEN
            ALTER TABLE qr_codes ADD COLUMN error_correction_level TEXT DEFAULT 'M';
        END IF;

        -- Adicionar coluna margin se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'margin') THEN
            ALTER TABLE qr_codes ADD COLUMN margin INTEGER DEFAULT 4;
        END IF;

        -- Adicionar coluna redirect_url se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'redirect_url') THEN
            ALTER TABLE qr_codes ADD COLUMN redirect_url TEXT;
        END IF;

        -- Adicionar coluna tracking_enabled se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'tracking_enabled') THEN
            ALTER TABLE qr_codes ADD COLUMN tracking_enabled BOOLEAN DEFAULT true;
        END IF;

        -- Adicionar coluna last_scanned_at se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'last_scanned_at') THEN
            ALTER TABLE qr_codes ADD COLUMN last_scanned_at TIMESTAMP;
        END IF;

        -- Adicionar coluna updated_at se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'qr_codes' AND column_name = 'updated_at') THEN
            ALTER TABLE qr_codes ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        END IF;

        -- Criar índices se não existirem
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'qr_codes' AND indexname = 'idx_qr_codes_client_id') THEN
            CREATE INDEX idx_qr_codes_client_id ON qr_codes(client_id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'qr_codes' AND indexname = 'idx_qr_codes_totem_id') THEN
            CREATE INDEX idx_qr_codes_totem_id ON qr_codes(totem_id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'qr_codes' AND indexname = 'idx_qr_codes_campaign_id') THEN
            CREATE INDEX idx_qr_codes_campaign_id ON qr_codes(campaign_id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'qr_codes' AND indexname = 'idx_qr_codes_is_active') THEN
            CREATE INDEX idx_qr_codes_is_active ON qr_codes(is_active);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'qr_codes' AND indexname = 'idx_qr_codes_expires_at') THEN
            CREATE INDEX idx_qr_codes_expires_at ON qr_codes(expires_at);
        END IF;

        -- Corrigir foreign key na tabela analytics_qr_scans se existir e referenciar coluna antiga
        -- Nota: A foreign key já está correta no CREATE TABLE, mas se a tabela existir com constraint antiga, precisa ser corrigida
        -- Usar abordagem simples: remover constraints antigas e recriar com referência correta
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_qr_scans') THEN
            -- Remover constraint antiga se existir (usando nome padrão ou buscando dinamicamente)
            ALTER TABLE analytics_qr_scans DROP CONSTRAINT IF EXISTS analytics_qr_scans_qr_code_id_fkey;
            ALTER TABLE analytics_qr_scans DROP CONSTRAINT IF EXISTS fk_analytics_qr_scans_qr_code;
            -- Recriar com referência correta
            ALTER TABLE analytics_qr_scans 
            ADD CONSTRAINT fk_analytics_qr_scans_qr_code 
            FOREIGN KEY (qr_code_id) REFERENCES qr_codes(qr_code_id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- =============================================
-- EVENT LOGS TABLE (v2.1)
-- =============================================
-- Tabela para registrar eventos importantes do sistema
-- (playback de vídeo, exibição de anúncios, BI, campanhas)
-- Estratégia: Arquivos locais para logs operacionais, banco para eventos importantes


-- Índices para performance

-- Índice composto para queries comuns de BI

COMMENT ON TABLE event_logs IS 'Registra eventos importantes do sistema para BI, relatórios e auditoria';
COMMENT ON COLUMN event_logs.event_type IS 'Tipo do evento (video_playback_start, ad_display_start, campaign_start, etc)';
COMMENT ON COLUMN event_logs.entity_type IS 'Tipo da entidade relacionada (media, campaign, totem, playlist, etc)';
COMMENT ON COLUMN event_logs.metadata IS 'Dados adicionais do evento em formato JSON';

-- =============================================
-- 2FA/MFA SUPPORT (v2.1)
-- =============================================
-- Migration: 2FA/MFA Support
-- Adiciona suporte para autenticação de dois fatores (TOTP)

-- Tabela para armazenar configurações de 2FA dos usuários

-- Tabela para rastrear tentativas de verificação 2FA

-- Índices para performance

-- Comentários
COMMENT ON TABLE user_two_factor IS 'Configurações de autenticação de dois fatores (TOTP) por usuário';
COMMENT ON TABLE two_factor_attempts IS 'Histórico de tentativas de verificação 2FA para auditoria e segurança';
COMMENT ON COLUMN user_two_factor.secret IS 'Secret TOTP criptografado usando AES-256';
COMMENT ON COLUMN user_two_factor.backup_codes IS 'Códigos de backup criptografados (hash SHA-256)';

-- =============================================
-- PLANS AND SUBSCRIPTIONS (v2.1)
-- =============================================
-- Migration: Add Plans and Subscriptions Tables
-- Adiciona tabelas para sistema de planos e assinaturas com integração Stripe

-- Plans Table


-- Subscriptions Table


-- Stripe Customers Table (para armazenar IDs do Stripe)


-- Adicionar colunas ao billing para integração Stripe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing' AND column_name = 'stripe_invoice_id') THEN
        ALTER TABLE billing ADD COLUMN stripe_invoice_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing' AND column_name = 'stripe_payment_intent_id') THEN
        ALTER TABLE billing ADD COLUMN stripe_payment_intent_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing' AND column_name = 'subscription_id') THEN
        ALTER TABLE billing ADD COLUMN subscription_id INTEGER;
    END IF;
END $$;


-- Adicionar foreign key para subscription_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'billing_subscription_id_fkey'
    ) THEN
        ALTER TABLE billing 
        ADD CONSTRAINT billing_subscription_id_fkey 
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(subscription_id) ON DELETE SET NULL;
    END IF;
END $$;

-- Inserir planos padrão
INSERT INTO plans (name, slug, description, price_monthly, price_yearly, billing_interval, features, limits, is_active, is_popular, sort_order)
VALUES 
    ('Básico', 'basic', 'Plano básico para pequenos negócios', 99.00, 990.00, 'month', 
     '{"totems": 5, "campaigns": 10, "storage_gb": 10, "support": "email"}',
     '{"max_totems": 5, "max_campaigns": 10, "storage_gb": 10, "support_level": "email"}',
     true, false, 1),
    ('Profissional', 'professional', 'Plano profissional para empresas', 299.00, 2990.00, 'month',
     '{"totems": 20, "campaigns": 50, "storage_gb": 100, "support": "priority", "analytics": true, "api_access": true}',
     '{"max_totems": 20, "max_campaigns": 50, "storage_gb": 100, "support_level": "priority", "analytics": true, "api_access": true}',
     true, true, 2),
    ('Enterprise', 'enterprise', 'Plano enterprise com recursos ilimitados', 999.00, 9990.00, 'month',
     '{"totems": -1, "campaigns": -1, "storage_gb": 1000, "support": "dedicated", "analytics": true, "api_access": true, "custom_integrations": true}',
     '{"max_totems": -1, "max_campaigns": -1, "storage_gb": 1000, "support_level": "dedicated", "analytics": true, "api_access": true, "custom_integrations": true}',
     true, false, 3)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- REMOTE COMMANDS ENHANCEMENTS (v2.1)
-- =============================================
-- Migration: Remote Commands System - Enhancements
-- Adiciona colunas adicionais à tabela remote_commands existente

-- Adicionar colunas que faltam (se não existirem)
DO $$ 
BEGIN
    -- Adicionar sent_at se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'remote_commands' AND column_name = 'sent_at') THEN
        ALTER TABLE remote_commands ADD COLUMN sent_at TIMESTAMP;
    END IF;

    -- Adicionar completed_at se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'remote_commands' AND column_name = 'completed_at') THEN
        ALTER TABLE remote_commands ADD COLUMN completed_at TIMESTAMP;
    END IF;

    -- Adicionar error_message se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'remote_commands' AND column_name = 'error_message') THEN
        ALTER TABLE remote_commands ADD COLUMN error_message TEXT;
    END IF;

    -- Adicionar updated_at se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'remote_commands' AND column_name = 'updated_at') THEN
        ALTER TABLE remote_commands ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Tabela para armazenar screenshots capturados remotamente

-- Índices adicionais para performance

-- Comentários
COMMENT ON TABLE remote_commands IS 'Comandos remotos enviados aos totens para controle e manutenção';
COMMENT ON TABLE remote_screenshots IS 'Screenshots capturados remotamente dos totens';
COMMENT ON COLUMN remote_commands.command_type IS 'Tipo de comando: restart, screenshot, update, config, custom';
COMMENT ON COLUMN remote_commands.status IS 'Status: pending, sent, executing, completed, failed, timeout';

-- =============================================
-- OTA UPDATES SYSTEM (v2.1)
-- =============================================
-- Migration: OTA Updates System
-- Adiciona suporte para atualizações Over-The-Air dos players

-- Tabela para armazenar atualizações OTA

-- Tabela para rastrear status de atualização de cada totem

-- Índices para performance

-- Comentários
COMMENT ON TABLE ota_updates IS 'Atualizações Over-The-Air disponíveis para players';
COMMENT ON TABLE totem_update_status IS 'Status de atualização de cada totem';
COMMENT ON COLUMN ota_updates.rollout_percentage IS 'Porcentagem de rollout gradual (0-100)';
COMMENT ON COLUMN ota_updates.status IS 'Status: draft, testing, active, paused, completed, cancelled';

-- =============================================
-- INTERACTIVE FEATURES (v2.1)
-- =============================================
-- Migration: Interactive Features
-- Adiciona suporte para tags, reconhecimento facial e rede visual

-- Tabela para armazenar tags e suas associações

-- Índice GIN para busca eficiente em metadata

-- Tabela para armazenar pessoas reconhecidas (opcional)

-- Tabela para histórico de interações

-- Tabela para rede visual (totens interconectados)

-- =============================================
-- SMARTDISPLAYFX PLUS - TABELAS FX
-- =============================================

-- Tabela para armazenar efeitos FX disponíveis

-- Tabela para regras inteligentes de acionamento

-- Tabela para timelines FX globais

-- Tabela para telemetria de execução de efeitos

-- Tabela para configurações de sites/rede estrela

-- Relação totens com sites FX

-- Índices para performance

-- Índices para tabelas FX

-- Comentários
COMMENT ON TABLE tags IS 'Tags (RFID/NFC/QR) e suas associações com conteúdo';
COMMENT ON TABLE recognized_persons IS 'Pessoas reconhecidas para personalização';
COMMENT ON TABLE interaction_logs IS 'Histórico de interações dos totens';
COMMENT ON TABLE totem_network IS 'Rede de totens interconectados';
COMMENT ON TABLE fx_effects IS 'Catálogo de efeitos FX disponíveis no sistema SmartDisplayFX Plus';
COMMENT ON TABLE fx_rules IS 'Regras inteligentes para acionamento de efeitos FX';
COMMENT ON TABLE fx_timelines IS 'Timelines globais de efeitos FX para sites';
COMMENT ON TABLE fx_telemetry IS 'Telemetria de execução de efeitos FX nos totens';
COMMENT ON TABLE fx_sites IS 'Configuração de sites/rede estrela para SmartDisplayFX Plus';
COMMENT ON TABLE fx_totem_sites IS 'Relação entre totens e sites FX';
COMMENT ON TABLE webhooks IS 'Webhooks configuráveis para notificações de eventos';
COMMENT ON COLUMN webhooks.channels IS 'Canais suportados: alerts, events, telemetry, etc';
COMMENT ON COLUMN webhooks.events IS 'Eventos específicos a serem enviados';
COMMENT ON TABLE dashboard_layouts IS 'Layouts customizáveis de dashboard por usuário';
COMMENT ON COLUMN dashboard_layouts.layout_data IS 'JSON com configuração de widgets, posições e tamanhos';
COMMENT ON TABLE backups IS 'Registro de backups automáticos do sistema';
COMMENT ON COLUMN backups.backup_type IS 'Tipo: full, database, uploads, config';
COMMENT ON COLUMN backups.status IS 'Status: completed, failed, in_progress';
COMMENT ON TABLE notifications IS 'Notificações em tempo real para usuários';
COMMENT ON COLUMN notifications.notification_type IS 'Tipo: info, success, warning, error';

-- =============================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE (v2.1 + v3.1)
-- =============================================
-- Índices adicionais para otimizar queries comuns

-- Índices para tabela users (v3.1)

-- Índices para tabela totems (v3.1)

-- Índices para tabela medias (v3.1)

-- Índices para tabela playlists (v3.1)

-- Índices para tabela campaigns (v3.1)

-- Índices para execution_logs (analytics) (v3.1)

-- Índices para fx_telemetry (v3.1)

-- Índices para event_logs (v3.1)

-- Índices compostos para queries frequentes (v3.1)

-- Índices compostos para queries frequentes

-- Índices para campos frequentemente usados em WHERE

-- Índices para ordenação e paginação

-- =============================================
-- ROLES E PERMISSÕES - HIERARQUIA COMPLETA
-- =============================================

-- Inserir Roles (Hierarquia: admin_sql > operator > admin > gerente_marketing > editoracao > visualizador > client)
INSERT INTO roles (name, description, is_active) VALUES
  ('admin_sql', 'Administrador SQL - Acesso total ao sistema e dados gerais da base de dados', true),
  ('operator', 'Operador do Sistema - Acesso a funcionalidades administrativas e manutenção, SEM dados de clientes', true),
  ('admin', 'Administrador do Cliente - Administra parâmetros administrativos e configurações do próprio cliente', true),
  ('gerente_marketing', 'Gerente de Marketing - Gerencia/cria/analisa campanhas, mídias, playlists. Total acesso à parte de marketing', true),
  ('editoracao', 'Editoração - Acesso a suprir informações relevantes e mídias. Upload e edição de conteúdo', true),
  ('visualizador', 'Visualizador - Acesso a dados e relatórios, apenas leitura', true),
  ('client', 'Cliente Final (Player) - Acesso apenas via API do player', true)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- Inserir Permissões
INSERT INTO permissions (name, resource, action, description) VALUES
  -- Sistema
  ('system.read', 'system', 'read', 'Ler configurações do sistema'),
  ('system.update', 'system', 'update', 'Atualizar configurações do sistema'),
  ('system.maintenance', 'system', 'maintenance', 'Manutenção do sistema'),
  
  -- Banco de Dados
  ('database.read', 'database', 'read', 'Ler dados gerais da base de dados'),
  ('database.write', 'database', 'write', 'Escrever na base de dados'),
  ('database.backup', 'database', 'backup', 'Criar backups'),
  ('database.restore', 'database', 'restore', 'Restaurar backups'),
  ('database.migrate', 'database', 'migrate', 'Executar migrações'),
  
  -- Usuários
  ('users.read', 'users', 'read', 'Ler usuários'),
  ('users.create', 'users', 'create', 'Criar usuários'),
  ('users.update', 'users', 'update', 'Atualizar usuários'),
  ('users.delete', 'users', 'delete', 'Deletar usuários'),
  
  -- Roles
  ('roles.read', 'roles', 'read', 'Ler roles'),
  ('roles.create', 'roles', 'create', 'Criar roles'),
  ('roles.update', 'roles', 'update', 'Atualizar roles'),
  ('roles.delete', 'roles', 'delete', 'Deletar roles'),
  
  -- Permissões
  ('permissions.read', 'permissions', 'read', 'Ler permissões'),
  ('permissions.create', 'permissions', 'create', 'Criar permissões'),
  ('permissions.update', 'permissions', 'update', 'Atualizar permissões'),
  ('permissions.delete', 'permissions', 'delete', 'Deletar permissões'),
  
  -- Clientes
  ('clients.read', 'clients', 'read', 'Ler clientes'),
  ('clients.create', 'clients', 'create', 'Criar clientes'),
  ('clients.update', 'clients', 'update', 'Atualizar clientes'),
  ('clients.delete', 'clients', 'delete', 'Deletar clientes'),
  
  -- Campanhas
  ('campaigns.read', 'campaigns', 'read', 'Ler campanhas'),
  ('campaigns.create', 'campaigns', 'create', 'Criar campanhas'),
  ('campaigns.update', 'campaigns', 'update', 'Atualizar campanhas'),
  ('campaigns.delete', 'campaigns', 'delete', 'Deletar campanhas'),
  
  -- Mídia
  ('medias.read', 'medias', 'read', 'Ler mídia'),
  ('medias.create', 'medias', 'create', 'Criar mídia'),
  ('medias.update', 'medias', 'update', 'Atualizar mídia'),
  ('medias.delete', 'medias', 'delete', 'Deletar mídia'),
  ('medias.download', 'medias', 'download', 'Download de mídia'),
  
  -- Playlists
  ('playlists.read', 'playlists', 'read', 'Ler playlists'),
  ('playlists.create', 'playlists', 'create', 'Criar playlists'),
  ('playlists.update', 'playlists', 'update', 'Atualizar playlists'),
  ('playlists.delete', 'playlists', 'delete', 'Deletar playlists'),
  ('playlists.download', 'playlists', 'download', 'Download de playlists'),
  
  -- Totens
  ('totems.read', 'totems', 'read', 'Ler totens'),
  ('totems.create', 'totems', 'create', 'Criar totens'),
  ('totems.update', 'totems', 'update', 'Atualizar totens'),
  ('totems.delete', 'totems', 'delete', 'Deletar totens'),
  ('totems.restart', 'totems', 'restart', 'Reiniciar totem'),
  ('totems.screenshot', 'totems', 'screenshot', 'Capturar screenshot'),
  ('totems.logs', 'totems', 'logs', 'Acessar logs do totem'),
  
  -- Relatórios
  ('reports.read', 'reports', 'read', 'Ler relatórios'),
  ('reports.create', 'reports', 'create', 'Criar relatórios'),
  ('reports.update', 'reports', 'update', 'Atualizar relatórios'),
  ('reports.delete', 'reports', 'delete', 'Deletar relatórios'),
  ('reports.export', 'reports', 'export', 'Exportar relatórios'),
  
  -- Analytics
  ('analytics.read', 'analytics', 'read', 'Ler analytics'),
  ('analytics.export', 'analytics', 'export', 'Exportar analytics'),
  
  -- Billing
  ('billing.read', 'billing', 'read', 'Ler dados de billing'),
  ('billing.create', 'billing', 'create', 'Criar dados de billing'),
  ('billing.update', 'billing', 'update', 'Atualizar dados de billing'),
  ('billing.delete', 'billing', 'delete', 'Deletar dados de billing'),
  
  -- Configurações
  ('settings.read', 'settings', 'read', 'Ler configurações'),
  ('settings.update', 'settings', 'update', 'Atualizar configurações'),
  
  -- Logs
  ('logs.read', 'logs', 'read', 'Ler logs'),
  ('logs.export', 'logs', 'export', 'Exportar logs'),
  
  -- OTA Updates
  ('ota.read', 'ota', 'read', 'Ler atualizações OTA'),
  ('ota.create', 'ota', 'create', 'Criar atualizações OTA'),
  ('ota.update', 'ota', 'update', 'Atualizar atualizações OTA'),
  ('ota.delete', 'ota', 'delete', 'Deletar atualizações OTA'),
  
  -- SmartDisplayFX
  ('smartdisplayfx.read', 'smartdisplayfx', 'read', 'Ler SmartDisplayFX'),
  ('smartdisplayfx.update', 'smartdisplayfx', 'update', 'Atualizar SmartDisplayFX'),
  ('smartdisplayfx.config', 'smartdisplayfx', 'config', 'Configurar SmartDisplayFX'),
  ('smartdisplayfx.logs', 'smartdisplayfx', 'logs', 'Acessar logs do SmartDisplayFX'),
  
  -- Auditoria
  ('audit.read', 'audit', 'read', 'Ler logs de auditoria'),
  ('audit.export', 'audit', 'export', 'Exportar logs de auditoria'),
  
  -- Backup
  ('backup.read', 'backup', 'read', 'Ler backups'),
  ('backup.create', 'backup', 'create', 'Criar backups'),
  ('backup.restore', 'backup', 'restore', 'Restaurar backups'),
  
  -- Monitoramento
  ('monitoring.read', 'monitoring', 'read', 'Ler monitoramento'),
  ('monitoring.update', 'monitoring', 'update', 'Atualizar monitoramento'),
  
  -- Player
  ('player.authenticate', 'player', 'authenticate', 'Autenticar player'),
  ('player.heartbeat', 'player', 'heartbeat', 'Enviar heartbeat'),
  ('player.playlist.download', 'player', 'playlist.download', 'Download de playlist'),
  ('player.media.download', 'player', 'media.download', 'Download de mídia'),
  ('player.logs.upload', 'player', 'logs.upload', 'Upload de logs'),
  ('player.screenshot.upload', 'player', 'screenshot.upload', 'Upload de screenshot')
ON CONFLICT (name) DO NOTHING;

-- Atribuir Permissões às Roles

-- ADMIN_SQL: Todas as permissões
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin_sql'
ON CONFLICT DO NOTHING;

-- OPERATOR: Apenas permissões do sistema (SEM dados de clientes)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'operator'
  AND (
    p.resource IN ('system', 'settings', 'logs', 'ota', 'smartdisplayfx', 'monitoring', 'backup')
    OR (p.resource = 'totems' AND p.action IN ('read', 'update', 'restart', 'screenshot', 'logs'))
    OR (p.resource = 'smartdisplayfx' AND p.action IN ('config', 'logs'))
  )
ON CONFLICT DO NOTHING;

-- ADMIN: Permissões do cliente (próprio cliente) - Administra parâmetros administrativos e configurações
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.resource IN ('clients', 'users', 'campaigns', 'medias', 'playlists', 'totems', 'reports', 'analytics', 'billing', 'smartdisplayfx', 'audit', 'settings', 'qr-codes', 'tags', 'ai')
  AND p.resource NOT IN ('system', 'database', 'roles', 'permissions')
ON CONFLICT DO NOTHING;

-- GERENTE_MARKETING: Total acesso à parte de marketing (campanhas, mídias, playlists)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'gerente_marketing'
  AND (
    -- Marketing completo
    (p.resource IN ('campaigns', 'medias', 'playlists', 'smart-playlist', 'qr-codes', 'tags', 'smartdisplayfx', 'ai') AND p.action IN ('read', 'create', 'update', 'delete'))
    OR
    -- Analytics e relatórios (leitura e criação)
    (p.resource IN ('analytics', 'reports') AND p.action IN ('read', 'create'))
    OR
    -- Totens (apenas leitura)
    (p.resource = 'totems' AND p.action = 'read')
  )
  AND p.resource NOT IN ('users', 'billing', 'clients', 'settings')
ON CONFLICT DO NOTHING;

-- EDITORACAO: Acesso a suprir informações relevantes e mídias
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'editoracao'
  AND (
    -- Mídias (total acesso)
    (p.resource = 'medias' AND p.action IN ('read', 'create', 'update', 'delete'))
    OR
    -- Tags (leitura e criação)
    (p.resource = 'tags' AND p.action IN ('read', 'create'))
    OR
    -- Campanhas e playlists (apenas leitura para contexto)
    (p.resource IN ('campaigns', 'playlists') AND p.action = 'read')
  )
ON CONFLICT DO NOTHING;

-- VISUALIZADOR: Apenas leitura de dados e relatórios
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'visualizador'
  AND p.action = 'read'
  AND p.resource IN ('campaigns', 'medias', 'playlists', 'totems', 'reports', 'analytics', 'smartdisplayfx', 'dashboard')
ON CONFLICT DO NOTHING;

-- CLIENT: Apenas permissões do player
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'client'
  AND p.resource = 'player'
ON CONFLICT DO NOTHING;

-- =============================================
-- SMARTDISPLAYFX PLUS - DADOS INICIAIS
-- =============================================

-- Dados iniciais: Efeitos padrão
INSERT INTO fx_effects (name, effect_type, description, default_params, is_active) VALUES
  ('Neon Warp Flow', 'neon_warp', 'Efeito de propagandas fluindo entre totens com rastro neon', 
   '{"color_a": "#00ffd5", "color_b": "#6b00ff", "intensity": 0.8, "trail_particles": 32, "duration_ms": 1600}'::jsonb, true),
  ('Ripple Sync Flow', 'ripple_sync', 'Efeito de ondas sincronizadas entre totens', 
   '{"wave_count": 3, "wave_speed": 1.0, "color": "#00ffff", "duration_ms": 2000}'::jsonb, true),
  ('Liquid Flow', 'liquid_flow', 'Efeito de fluxo líquido entre telas', 
   '{"viscosity": 0.5, "color": "#ff00ff", "duration_ms": 1800}'::jsonb, true),
  ('Holographic Swipe', 'holographic_swipe', 'Efeito de deslize holográfico', 
   '{"glow_intensity": 0.9, "color": "#ffffff", "duration_ms": 1500}'::jsonb, true),
  ('Matrix Data Flow', 'matrix_data_flow', 'Efeito estilo Matrix com dados fluindo', 
   '{"characters": "01", "speed": 1.0, "color": "#00ff00", "duration_ms": 2200}'::jsonb, true),
  ('Particle Burst', 'particle_burst', 'Efeito de explosão de partículas', 
   '{"particle_count": 50, "color": "#ffff00", "duration_ms": 1200}'::jsonb, true)
ON CONFLICT (name) DO UPDATE SET
  effect_type = EXCLUDED.effect_type,
  description = EXCLUDED.description,
  default_params = EXCLUDED.default_params,
  updated_at = CURRENT_TIMESTAMP;

-- Dados iniciais: Regras padrão (exemplos)
INSERT INTO fx_rules (name, description, conditions, actions, priority, is_active) VALUES
  ('Jovem - Promo Games', 'Mostrar promo de games para jovens', 
   '{"age_bucket": ["14-25", "18-25"], "mood": ["happy", "neutral"]}'::jsonb,
   '{"effect_type": "neon_warp", "content_category": "games", "priority": "high"}'::jsonb,
   10, true),
  ('Atenção Alta - Produto Premium', 'Mostrar produto premium quando atenção alta', 
   '{"attention_ms": {"min": 2000}, "mood": ["happy", "surprised"]}'::jsonb,
   '{"effect_type": "holographic_swipe", "content_category": "premium", "priority": "high"}'::jsonb,
   15, true),
  ('Tag Específica - Conteúdo Personalizado', 'Mostrar conteúdo baseado em tag', 
   '{"interaction_type": "tag_id", "tag_category": ["vip", "premium"]}'::jsonb,
   '{"effect_type": "particle_burst", "use_tag_content": true, "priority": "critical"}'::jsonb,
   20, true)
ON CONFLICT DO NOTHING;


