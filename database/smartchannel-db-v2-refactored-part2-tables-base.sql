-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 2: Tabelas Base (Sem FKs Externas)
-- =============================================

-- =============================================
-- SUBSCRIBERS (antes: clients)
-- =============================================

CREATE TABLE IF NOT EXISTS subscribers (
    subscriber_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    whatsapp TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE subscribers IS 'Anunciantes/Assinantes que compram espaço publicitário';
COMMENT ON COLUMN subscribers.subscriber_id IS 'ID único do assinante (anunciante)';
COMMENT ON COLUMN subscribers.name IS 'Nome/razão social do assinante';
COMMENT ON COLUMN subscribers.email IS 'Email único do assinante';
COMMENT ON COLUMN subscribers.is_active IS 'Se false, assinante está inativo';

-- =============================================
-- PUBLISHERS (antes: hosts)
-- =============================================

CREATE TABLE IF NOT EXISTS publishers (
    publisher_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    whatsapp TEXT,
    description TEXT,
    
    -- Flags de tipo
    is_subscriber BOOLEAN DEFAULT false,
    is_publisher BOOLEAN DEFAULT true,
    client_type TEXT NOT NULL DEFAULT 'publisher', -- 'subscriber', 'publisher', 'both'
    
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_publisher_client_type 
        CHECK (client_type IN ('subscriber', 'publisher', 'both'))
);

COMMENT ON TABLE publishers IS 'Publicadores - clientes que instalam totens e Smart TVs';
COMMENT ON COLUMN publishers.publisher_id IS 'ID único do publisher';
COMMENT ON COLUMN publishers.is_subscriber IS 'Se true, publisher também é assinante';
COMMENT ON COLUMN publishers.is_publisher IS 'Se true, publisher publica conteúdo';
COMMENT ON COLUMN publishers.client_type IS 'Tipo: subscriber, publisher ou both';

-- =============================================
-- ROLES (sem mudanças)
-- =============================================

CREATE TABLE IF NOT EXISTS roles (
    role_id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- PERMISSIONS (sem mudanças)
-- =============================================

CREATE TABLE IF NOT EXISTS permissions (
    permission_id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    resource TEXT NOT NULL, -- media, campaign, totem, analytics, etc.
    action TEXT NOT NULL, -- create, read, update, delete, approve
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- PLANS (sem mudanças)
-- =============================================

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

-- =============================================
-- SYSTEM SETTINGS (sem mudanças)
-- =============================================

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

-- Inserir configurações de contratos
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description)
VALUES 
    ('contracts.storage_path', '/opt/smart-signage/contracts', 'string', 'contracts',
     'Caminho base para armazenamento de contratos (PDF, DOC, DOCX)'),
    ('contracts.max_file_size_mb', '10', 'number', 'contracts',
     'Tamanho máximo de arquivo de contrato em MB'),
    ('contracts.allowed_mime_types', '["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]', 'json', 'contracts',
     'Tipos MIME permitidos para contratos')
ON CONFLICT (setting_key) DO NOTHING;

-- =============================================
-- USERS (MODIFICADA - com publisher_id, is_tenant_user, user_type)
-- =============================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    
    -- NOVO: Relacionamento com publisher
    publisher_id INTEGER, -- NULL se for tenant user
    
    -- NOVO: Tipo de usuário
    user_type TEXT NOT NULL DEFAULT 'publisher_user', 
        -- 'system_user' (tenant/admin), 'subscriber_user', 'publisher_user'
    is_tenant_user BOOLEAN DEFAULT false, -- True se for admin/operador do sistema
    
    role TEXT, -- Role direta (mantido para compatibilidade)
    first_name TEXT,
    last_name TEXT,
    name TEXT, -- Nome completo (mantido para compatibilidade)
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_users_user_type 
        CHECK (user_type IN ('system_user', 'subscriber_user', 'publisher_user')),
    CONSTRAINT chk_users_tenant_logic 
        CHECK (
            (is_tenant_user = true AND publisher_id IS NULL) OR
            (is_tenant_user = false AND publisher_id IS NOT NULL)
        )
);

COMMENT ON TABLE users IS 'Usuários do sistema SmartSignage';
COMMENT ON COLUMN users.publisher_id IS 'FK para publisher (NULL se for tenant user)';
COMMENT ON COLUMN users.user_type IS 'Tipo: system_user, subscriber_user, publisher_user';
COMMENT ON COLUMN users.is_tenant_user IS 'True se for admin/operador do sistema (tenant)';

-- =============================================
-- OUTRAS TABELAS BASE (sem FKs externas)
-- =============================================

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

CREATE TABLE IF NOT EXISTS fx_effects (
    effect_id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    effect_type TEXT NOT NULL, -- 'neon_warp', 'ripple_sync', 'liquid_flow', etc.
    description TEXT,
    default_params JSONB DEFAULT '{}'::jsonb,
    preview_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fx_rules (
    rule_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    site_id TEXT, -- Opcional: regra específica de site (FK para fx_sites)
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fx_timelines (
    timeline_id SERIAL PRIMARY KEY,
    site_id TEXT NOT NULL, -- FK para fx_sites
    name TEXT,
    version INTEGER DEFAULT 1,
    events JSONB NOT NULL,
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

