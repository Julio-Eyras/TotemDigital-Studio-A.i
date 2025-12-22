-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 5: Tabelas de Relacionamento N:N e Outras
-- =============================================

-- =============================================
-- SUBSCRIPTIONS (Assinaturas - apenas Publishers)
-- =============================================

CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id SERIAL PRIMARY KEY,
    publisher_id INTEGER NOT NULL, -- FK para publishers (assinatura é do publisher)
    plan_id INTEGER NOT NULL, -- FK para plans
    
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    
    status TEXT DEFAULT 'active', 
        -- active, cancelled, past_due, unpaid, trialing, paused
    
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMP,
    
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_subscription_status 
        CHECK (status IN ('active', 'cancelled', 'past_due', 'unpaid', 'trialing', 'paused')),
    CONSTRAINT chk_subscription_period 
        CHECK (current_period_start IS NULL OR current_period_end IS NULL OR 
               current_period_start <= current_period_end)
);

COMMENT ON TABLE subscriptions IS 'Assinaturas de publishers (publishers pagam para usar o sistema)';
COMMENT ON COLUMN subscriptions.publisher_id IS 'Publisher que possui a assinatura';

-- =============================================
-- USER_ROLES (Relacionamento N:M users ↔ roles)
-- =============================================

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL, -- FK para users
    role_id INTEGER NOT NULL, -- FK para roles
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER, -- FK para users
    
    PRIMARY KEY (user_id, role_id)
);

COMMENT ON TABLE user_roles IS 'Relacionamento N:M entre users e roles (RBAC)';

-- =============================================
-- ROLE_PERMISSIONS (Relacionamento N:M roles ↔ permissions)
-- =============================================

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL, -- FK para roles
    permission_id INTEGER NOT NULL, -- FK para permissions
    
    PRIMARY KEY (role_id, permission_id)
);

COMMENT ON TABLE role_permissions IS 'Relacionamento N:M entre roles e permissions (RBAC)';

-- =============================================
-- CAMPAIGN_PLAYLISTS (Relacionamento N:M campaigns ↔ playlists)
-- =============================================

CREATE TABLE IF NOT EXISTS campaign_playlists (
    campaign_id INTEGER NOT NULL, -- FK para campaigns
    playlist_id INTEGER NOT NULL, -- FK para playlists
    
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (campaign_id, playlist_id)
);

COMMENT ON TABLE campaign_playlists IS 'Relacionamento N:M entre campaigns e playlists';

-- =============================================
-- CAMPAIGN_TOTEMS (Relacionamento N:M campaigns ↔ totems)
-- =============================================

CREATE TABLE IF NOT EXISTS campaign_totems (
    campaign_id INTEGER NOT NULL, -- FK para campaigns
    totem_id INTEGER NOT NULL, -- FK para totems
    
    -- Agendamento específico para este totem
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    start_time TEXT, -- HH:MM
    end_time TEXT, -- HH:MM
    days_of_week TEXT, -- JSON array
    
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_campaign_totem_dates 
        CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date),
    
    PRIMARY KEY (campaign_id, totem_id)
);

COMMENT ON TABLE campaign_totems IS 'Relacionamento N:M entre campaigns e totems (qual campanha em qual totem)';
COMMENT ON COLUMN campaign_totems.totem_id IS 'Totem onde campanha será exibida';
COMMENT ON COLUMN campaign_totems.campaign_id IS 'Campanha do subscriber (anunciante)';

-- =============================================
-- CAMPAIGN_PUBLISHERS (Relacionamento N:M campaigns ↔ publishers)
-- =============================================

CREATE TABLE IF NOT EXISTS campaign_publishers (
    campaign_id INTEGER NOT NULL, -- FK para campaigns
    publisher_id INTEGER NOT NULL, -- FK para publishers
    
    -- Configurações específicas para este publisher
    revenue_share_percentage NUMERIC(5, 2), -- % específico para este publisher nesta campanha
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_campaign_publisher_revenue_share 
        CHECK (
            (revenue_share_percentage IS NULL) OR
            (revenue_share_percentage >= 0 AND revenue_share_percentage <= 100)
        ),
    
    PRIMARY KEY (campaign_id, publisher_id)
);

COMMENT ON TABLE campaign_publishers IS 'Relacionamento N:M entre campaigns e publishers';
COMMENT ON COLUMN campaign_publishers.revenue_share_percentage IS '% de revenue share específico para este publisher nesta campanha';

-- =============================================
-- CAMPAIGN_LOCALS (Relacionamento N:M campaigns ↔ locals)
-- =============================================

CREATE TABLE IF NOT EXISTS campaign_locals (
    campaign_id INTEGER NOT NULL, -- FK para campaigns
    local_id INTEGER NOT NULL, -- FK para locals
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (campaign_id, local_id)
);

COMMENT ON TABLE campaign_locals IS 'Relacionamento N:M entre campaigns e locals';

-- =============================================
-- PLAYLIST_APPROVALS (REMOVIDO)
-- =============================================
-- REMOVIDO: Playlists não requerem aprovação se mídias já foram aprovadas
-- Isso agiliza processos para assinantes gerenciarem suas campanhas
-- Aprovação de mídias é suficiente para garantir qualidade e segurança

