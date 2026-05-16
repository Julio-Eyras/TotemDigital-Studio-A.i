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
    is_active BOOLEAN DEFAULT true,
    
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMP,
    
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    
    billing_interval TEXT DEFAULT 'month', -- month, four_month, semester, year
    
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

-- Snapshot/Auditoria: metadados (JSONB) por associação campanha↔playlist (ex: origem, estado no momento, regras aplicadas)
ALTER TABLE campaign_playlists
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- =============================================
-- CAMPAIGN_MEDIAS (Relacionamento N:M campaigns ↔ medias)
-- =============================================

CREATE TABLE IF NOT EXISTS campaign_medias (
    campaign_id INTEGER NOT NULL, -- FK para campaigns
    media_id INTEGER NOT NULL, -- FK para medias
    
    -- Configurações específicas para esta mídia nesta campanha
    display_seconds INTEGER, -- Duração de exibição em segundos (sobrescreve duração padrão da mídia)
    order_index INTEGER DEFAULT 0, -- Ordem de exibição na campanha (quando não em playlist)
    priority INTEGER DEFAULT 1, -- Prioridade de exibição
    
    -- Agendamento específico para esta mídia
    start_time TEXT, -- HH:MM (horário específico, se aplicável)
    end_time TEXT, -- HH:MM
    days_of_week TEXT, -- JSON array
    
    transitions JSONB, -- Efeitos de transição
    metadata JSONB, -- Metadados adicionais
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_campaign_media_order 
        CHECK (order_index >= 0),
    CONSTRAINT chk_campaign_media_display_seconds
        CHECK (display_seconds IS NULL OR display_seconds > 0),
    
    PRIMARY KEY (campaign_id, media_id)
);

COMMENT ON TABLE campaign_medias IS 'Relacionamento N:M entre campaigns e medias (mídias diretamente associadas, sem playlist)';
COMMENT ON COLUMN campaign_medias.display_seconds IS 'Duração de exibição em segundos (sobrescreve duração padrão da mídia)';
COMMENT ON COLUMN campaign_medias.order_index IS 'Ordem de exibição na campanha (quando não em playlist)';

-- Snapshot/Auditoria: metadados (JSONB) por associação campanha↔mídia (ex: estado no momento, regras aplicadas)
ALTER TABLE campaign_medias
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

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
    
    -- Configuracao comercial por publisher/grupo
    time_share_percent NUMERIC(5, 2), -- % de share de tempo nesta combinacao campanha/publisher
    daypart_config JSONB, -- configuracao por faixas horarias (ex: {\"12-13\": {\"time_share_percent\": 50}})
    min_impressions_per_hour INTEGER,
    max_impressions_per_hour INTEGER,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_campaign_publisher_revenue_share 
        CHECK (
            (revenue_share_percentage IS NULL) OR
            (revenue_share_percentage >= 0 AND revenue_share_percentage <= 100)
        ),
    CONSTRAINT chk_campaign_publisher_time_share
        CHECK (
            (time_share_percent IS NULL) OR
            (time_share_percent >= 0 AND time_share_percent <= 100)
        ),
    CONSTRAINT chk_campaign_publisher_impressions
        CHECK (
            (min_impressions_per_hour IS NULL OR min_impressions_per_hour >= 0) AND
            (max_impressions_per_hour IS NULL OR max_impressions_per_hour >= 0)
        ),
    
    PRIMARY KEY (campaign_id, publisher_id)
);

COMMENT ON TABLE campaign_publishers IS 'Relacionamento N:M entre campaigns e publishers';
COMMENT ON COLUMN campaign_publishers.revenue_share_percentage IS '% de revenue share específico para este publisher nesta campanha';

-- Snapshot/Auditoria: metadados (JSONB) por associação campanha↔publisher (ex: contrato/plano no momento, validade atual)
ALTER TABLE campaign_publishers
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

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
-- PLAN_LOCAL_ACCESS (Escopo Compact: Plano ↔ Local)
-- =============================================

CREATE TABLE IF NOT EXISTS plan_local_access (
    plan_id INTEGER NOT NULL,
    local_id INTEGER NOT NULL,

    -- Controle de acesso
    is_allowed BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,

    -- Restrições específicas do plano para este local
    restrictions JSONB DEFAULT '{}'::jsonb,

    -- Metadados
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (plan_id, local_id)
);

COMMENT ON TABLE plan_local_access IS
    'Define quais locais um plano permite acessar no modo compact (escopo plano -> local)';
COMMENT ON COLUMN plan_local_access.plan_id IS
    'Plano que define o acesso ao local';
COMMENT ON COLUMN plan_local_access.local_id IS
    'Local que pode ser acessado por este plano no modo compact';
COMMENT ON COLUMN plan_local_access.is_allowed IS
    'Se false, bloqueia explicitamente o acesso ao local para o plano';
COMMENT ON COLUMN plan_local_access.restrictions IS
    'Restrições específicas por local: limites, janelas, regras comerciais, etc.';

-- =============================================
-- PLAN_PUBLISHER_ACCESS (Controle de acesso Plano → Publisher)
-- =============================================

CREATE TABLE IF NOT EXISTS plan_publisher_access (
    plan_id INTEGER NOT NULL,
    publisher_id INTEGER NOT NULL,
    
    -- Controle de acesso
    is_allowed BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    
    -- Restrições específicas do plano para este publisher
    restrictions JSONB DEFAULT '{}'::jsonb,
        -- Exemplo: { 
        --   "max_campaigns": 10,
        --   "revenue_share_min": 5,
        --   "priority": "high",
        --   "time_slots": ["08:00-18:00"]
        -- }
    
    -- Metadados
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (plan_id, publisher_id)
);

COMMENT ON TABLE plan_publisher_access IS 
    'Define quais publishers um plano permite acessar (configuração base do plano)';
COMMENT ON COLUMN plan_publisher_access.plan_id IS 
    'Plano que define o acesso';
COMMENT ON COLUMN plan_publisher_access.publisher_id IS 
    'Publisher que pode ser acessado por este plano';
COMMENT ON COLUMN plan_publisher_access.is_allowed IS 
    'Se false, explicitamente bloqueia acesso (mesmo que contrato permita)';
COMMENT ON COLUMN plan_publisher_access.restrictions IS 
    'Restrições específicas: limites de campanhas, revenue share mínimo, etc.';

-- =============================================
-- SUBSCRIBER_PUBLISHER_ACCESS (Controle de acesso Subscriber → Publisher)
-- =============================================

CREATE TABLE IF NOT EXISTS subscriber_publisher_access (
    access_id SERIAL PRIMARY KEY,
    
    -- Relacionamentos
    subscriber_id INTEGER NOT NULL,
    publisher_id INTEGER NOT NULL,
    contract_id INTEGER, -- NULL = acesso direto do plano (sem contrato específico)
    plan_id INTEGER, -- Plano base (se aplicável, para auditoria)
    
    -- Controle de acesso
    access_type TEXT NOT NULL DEFAULT 'contract', 
        -- 'plan' = herdado do plano (criado automaticamente)
        -- 'contract' = definido no contrato específico
        -- 'override' = sobrescreve configuração do plano
    
    -- Controle temporal
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- NULL = sem expiração
    revoked_at TIMESTAMP,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadados
    granted_by INTEGER, -- FK para users (quem concedeu acesso)
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_subscriber_publisher_access_type 
        CHECK (access_type IN ('plan', 'contract', 'override')),
    CONSTRAINT chk_subscriber_publisher_access_dates 
        CHECK (expires_at IS NULL OR granted_at <= expires_at),
    CONSTRAINT chk_subscriber_publisher_access_revoked 
        CHECK (revoked_at IS NULL OR granted_at <= revoked_at)
);

COMMENT ON TABLE subscriber_publisher_access IS 
    'Gerencia o acesso de subscribers a publishers, com base em planos ou contratos.';
COMMENT ON COLUMN subscriber_publisher_access.access_type IS 
    'Tipo de acesso: plan (herdado), contract (via contrato), override (manual)';
COMMENT ON COLUMN subscriber_publisher_access.expires_at IS 
    'Data de expiração do acesso (NULL = sem expiração)';

-- =============================================
-- TOTEM_PLAYLISTS (Playlists Geradas por Totem/TV)
-- =============================================
-- Esta tabela armazena as playlists FINAIS geradas pelo motor para cada totem/TV
-- As playlists são geradas automaticamente baseadas em:
-- - Campanhas ativas de subscribers que têm acesso ao publisher do totem
-- - Regras comerciais (time share, tiers, etc.)
-- - Status (apenas ativas e autorizadas)

CREATE TABLE IF NOT EXISTS totem_playlists (
    totem_playlist_id SERIAL PRIMARY KEY,
    
    -- Relacionamentos
    totem_id INTEGER NOT NULL, -- FK para totems
    smart_tv_id INTEGER, -- FK para smart_tvs (se aplicável, NULL = totem inteiro)
    publisher_id INTEGER NOT NULL, -- FK para publishers (denormalizado para performance)
    
    -- Metadados da playlist gerada
    playlist_hash TEXT, -- Hash da playlist para detectar mudanças
    version INTEGER DEFAULT 1, -- Versão da playlist (incrementa a cada regeneração)
    total_items INTEGER DEFAULT 0, -- Total de itens na playlist
    total_duration_seconds INTEGER DEFAULT 0, -- Duração total em segundos
    
    -- Status
    status TEXT DEFAULT 'active', -- active, paused, invalidated
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Quando foi gerada
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Última atualização
    expires_at TIMESTAMP, -- Quando expira (NULL = não expira)
    
    -- Metadados
    metadata JSONB DEFAULT '{}'::jsonb, -- Informações sobre geração, regras aplicadas, etc.
    generation_log JSONB, -- Log detalhado da geração (quais campanhas incluídas, etc.)
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_totem_playlist_status 
        CHECK (status IN ('active', 'paused', 'invalidated'))
);

COMMENT ON TABLE totem_playlists IS 
    'Playlists FINAIS geradas pelo motor para cada totem/TV. Geradas automaticamente baseadas em campanhas ativas de subscribers com acesso ao publisher.';
COMMENT ON COLUMN totem_playlists.totem_id IS 
    'Totem para o qual a playlist foi gerada';
COMMENT ON COLUMN totem_playlists.smart_tv_id IS 
    'Smart TV específica (NULL = playlist para todo o totem)';
COMMENT ON COLUMN totem_playlists.publisher_id IS 
    'Publisher do totem (denormalizado para performance)';
COMMENT ON COLUMN totem_playlists.playlist_hash IS 
    'Hash MD5/SHA da playlist para detectar mudanças e invalidar cache';
COMMENT ON COLUMN totem_playlists.version IS 
    'Versão da playlist (incrementa a cada regeneração)';
COMMENT ON COLUMN totem_playlists.generation_log IS 
    'Log detalhado: quais campanhas foram incluídas, regras aplicadas, etc.';

-- =============================================
-- TOTEM_PLAYLIST_ITEMS (Itens da Playlist Gerada)
-- =============================================
-- Armazena os itens (mídias) da playlist final gerada para cada totem/TV
-- Ordenados conforme regras comerciais aplicadas

CREATE TABLE IF NOT EXISTS totem_playlist_items (
    item_id SERIAL PRIMARY KEY,
    
    -- Relacionamentos
    totem_playlist_id INTEGER NOT NULL, -- FK para totem_playlists
    media_id INTEGER NOT NULL, -- FK para medias
    campaign_id INTEGER, -- FK para campaigns (opcional, para rastreamento)
    subscriber_id INTEGER NOT NULL, -- FK para subscribers (denormalizado)
    publisher_id INTEGER NOT NULL, -- FK para publishers (denormalizado)
    
    -- Ordem e prioridade
    order_index INTEGER NOT NULL DEFAULT 0, -- Ordem de exibição na playlist
    priority INTEGER DEFAULT 1, -- Prioridade (maior = mais importante)
    
    -- Configurações de exibição
    display_seconds INTEGER, -- Duração de exibição (sobrescreve duração padrão da mídia)
    transition_type TEXT DEFAULT 'fade', -- fade, slide, cut, etc.
    transition_duration_ms INTEGER DEFAULT 500, -- Duração da transição em ms
    
    -- Regras comerciais aplicadas
    commercial_tier TEXT, -- premium, standard, remnant
    time_share_percent NUMERIC(5, 2), -- % de share de tempo desta mídia
    revenue_share_percent NUMERIC(5, 2), -- % de revenue share
    
    -- Agendamento
    start_time TEXT, -- HH:MM (horário específico, se aplicável)
    end_time TEXT, -- HH:MM
    days_of_week TEXT, -- JSON array
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_totem_playlist_item_order 
        CHECK (order_index >= 0),
    CONSTRAINT chk_totem_playlist_item_display_seconds
        CHECK (display_seconds IS NULL OR display_seconds > 0),
    CONSTRAINT chk_totem_playlist_item_commercial_tier
        CHECK (commercial_tier IS NULL OR commercial_tier IN ('premium', 'standard', 'remnant')),
    CONSTRAINT chk_totem_playlist_item_time_share
        CHECK (
            (time_share_percent IS NULL) OR
            (time_share_percent >= 0 AND time_share_percent <= 100)
        ),
    CONSTRAINT chk_totem_playlist_item_revenue_share
        CHECK (
            (revenue_share_percent IS NULL) OR
            (revenue_share_percent >= 0 AND revenue_share_percent <= 100)
        )
);

COMMENT ON TABLE totem_playlist_items IS 
    'Itens (mídias) das playlists FINAIS geradas para cada totem/TV. Ordenados conforme regras comerciais.';
COMMENT ON COLUMN totem_playlist_items.totem_playlist_id IS 
    'Playlist gerada à qual este item pertence';
COMMENT ON COLUMN totem_playlist_items.order_index IS 
    'Ordem de exibição na playlist (0 = primeiro)';
COMMENT ON COLUMN totem_playlist_items.commercial_tier IS 
    'Tier comercial da campanha/mídia (premium, standard, remnant)';
COMMENT ON COLUMN totem_playlist_items.time_share_percent IS 
    '% de share de tempo que esta mídia deve ocupar no mix';

-- =============================================
-- TOTEM_PLAYLIST_GENERATION_LOG (Log de Gerações)
-- =============================================
-- Log detalhado de cada geração de playlist para auditoria e debug

CREATE TABLE IF NOT EXISTS totem_playlist_generation_log (
    log_id SERIAL PRIMARY KEY,
    
    -- Relacionamentos
    totem_id INTEGER NOT NULL, -- FK para totems
    totem_playlist_id INTEGER, -- FK para totem_playlists (NULL se falhou)
    publisher_id INTEGER NOT NULL, -- FK para publishers
    
    -- Status da geração
    status TEXT NOT NULL, -- success, failed, partial
    error_message TEXT, -- Mensagem de erro (se falhou)
    
    -- Estatísticas
    campaigns_included INTEGER DEFAULT 0, -- Quantas campanhas foram incluídas
    playlists_included INTEGER DEFAULT 0, -- Quantas playlists foram incluídas
    medias_included INTEGER DEFAULT 0, -- Quantas mídias foram incluídas
    subscribers_included INTEGER DEFAULT 0, -- Quantos subscribers foram incluídos
    
    -- Tempo de processamento
    generation_time_ms INTEGER, -- Tempo de geração em milissegundos
    
    -- Detalhes
    generation_details JSONB, -- Detalhes da geração (quais campanhas, regras aplicadas, etc.)
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_by TEXT DEFAULT 'system' -- 'system', 'manual', 'scheduled', etc.
);

COMMENT ON TABLE totem_playlist_generation_log IS 
    'Log detalhado de cada geração de playlist para auditoria e debug';
COMMENT ON COLUMN totem_playlist_generation_log.status IS 
    'Status: success (sucesso), failed (falhou), partial (parcial)';
COMMENT ON COLUMN totem_playlist_generation_log.generation_details IS 
    'Detalhes JSON: quais campanhas foram incluídas, regras aplicadas, etc.';
