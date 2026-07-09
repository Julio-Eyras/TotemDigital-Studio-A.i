-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 3: Tabelas Dependentes (Locais, Totens, TVs, Campanhas, Mídias)
-- =============================================

-- =============================================
-- LOCALS (Locais do Publisher)
-- =============================================

CREATE TABLE IF NOT EXISTS locals (
    local_id SERIAL PRIMARY KEY,
    publisher_id INTEGER NOT NULL, -- FK para publishers (obrigatório - locals pertencem apenas a publishers)
    created_via_contract_id INTEGER, -- FK para subscriber_contracts ou publisher_contracts (rastreabilidade)
    name TEXT NOT NULL,
    category_segment TEXT, -- Categoria/segmento do local (ex.: Farmácia, Cinema, Academia, etc.)
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    country TEXT DEFAULT 'BR',
    latitude REAL,
    longitude REAL,
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint: local deve ter publisher_id (obrigatório)
    CONSTRAINT chk_local_owner 
        CHECK (publisher_id IS NOT NULL)
);

COMMENT ON TABLE locals IS 'Locais físicos onde totens estão instalados';
COMMENT ON COLUMN locals.publisher_id IS 'Publisher (publicador) dono deste local';
COMMENT ON COLUMN locals.created_via_contract_id IS 'Contrato que gerou a criação deste local (rastreabilidade)';
COMMENT ON COLUMN locals.category_segment IS 'Categoria/segmento do local (taxonomia livre ou controlada)';

-- =============================================
-- TOTEMS (Edge Nodes - Micro-servidores)
-- =============================================

CREATE TABLE IF NOT EXISTS totems (
    totem_id SERIAL PRIMARY KEY,
    identifier TEXT UNIQUE NOT NULL, -- Identificador único do totem
    uin TEXT UNIQUE, -- Unique Identifier Number
    device_id TEXT UNIQUE, -- Device ID único
    
    local_id INTEGER NOT NULL, -- FK para locals (totem pertence a local/publisher)
    created_via_contract_id INTEGER, -- FK para subscriber_contracts ou publisher_contracts (rastreabilidade)
    -- REMOVIDO: client_id (erro conceitual - totem NÃO pertence a subscriber)
    
    name TEXT,
    description TEXT,
    model TEXT,
    manufacturer TEXT,
    firmware_version TEXT,
    hardware_version TEXT,
    os_version TEXT,
    
    status TEXT DEFAULT 'offline', -- pending_activation, pending_approval, offline, online, error, maintenance, syncing
    last_heartbeat TIMESTAMP,
    heartbeat_interval INTEGER DEFAULT 60, -- segundos

    -- Forçar estado online por janela de tempo (útil para debug/admin)
    forced_online_until TIMESTAMP,

    network_info JSONB, -- IP, MAC, DNS, etc.
    capabilities JSONB, -- Recursos do totem

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_totem_status
        CHECK (status IN ('pending_activation', 'pending_approval', 'offline', 'online', 'error', 'maintenance', 'syncing'))
);
COMMENT ON TABLE totems IS 'Totens - micro-servidores edge que controlam Smart TVs';
COMMENT ON COLUMN totems.local_id IS 'Local onde totem está instalado (FK → locals → publishers)';
COMMENT ON COLUMN totems.identifier IS 'Identificador único do totem';
COMMENT ON COLUMN totems.status IS 'Status atual do totem: pending_activation, pending_approval, offline, online, error, maintenance, syncing';

-- Compatibilidade para bancos já criados: ampliar a constraint de status dos totens.
DO $$
BEGIN
    ALTER TABLE totems DROP CONSTRAINT IF EXISTS chk_totem_status;
    ALTER TABLE totems
        ADD CONSTRAINT chk_totem_status
        CHECK (status IN ('pending_activation', 'pending_approval', 'offline', 'online', 'error', 'maintenance', 'syncing'));
END $$;

-- =============================================
-- SMART_TVS (Displays Controlados)
-- =============================================

CREATE TABLE IF NOT EXISTS smart_tvs (
    smart_tv_id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL, -- FK para totems (1 totem : N TVs)
    created_via_contract_id INTEGER, -- FK para subscriber_contracts ou publisher_contracts (rastreabilidade)
    
    identifier TEXT UNIQUE NOT NULL,
    device_id TEXT UNIQUE,
    name TEXT,
    brand TEXT, -- LG, Samsung, Sony, etc.
    model TEXT,
    platform TEXT, -- webOS, Tizen, Android TV, etc.
    firmware_version TEXT,
    
    resolution_width INTEGER,
    resolution_height INTEGER,
    orientation TEXT DEFAULT 'landscape', -- landscape, portrait
    
    status TEXT DEFAULT 'offline', -- offline, online, playing, error
    last_heartbeat TIMESTAMP, -- Último heartbeat/contato do dispositivo

    capabilities JSONB, -- Recursos da TV
    settings JSONB, -- Configurações específicas
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_smart_tv_orientation 
        CHECK (orientation IN ('landscape', 'portrait')),
    CONSTRAINT chk_smart_tv_status 
        CHECK (status IN ('offline', 'online', 'playing', 'error', 'sleeping'))
);

COMMENT ON TABLE smart_tvs IS 'Smart TVs controladas pelos totens';
COMMENT ON COLUMN smart_tvs.totem_id IS 'Totem que controla estas TVs (1:N) - Um totem pode controlar múltiplas Smart TVs';

-- Compatibilidade: se o banco já foi criado com coluna `tv_id`, renomear para `smart_tv_id`.
-- (Sem migração dedicada; idempotente para ambientes novos e re-aplicações do schema.)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'smart_tvs'
          AND column_name = 'tv_id'
    )
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'smart_tvs'
          AND column_name = 'smart_tv_id'
    ) THEN
        ALTER TABLE smart_tvs RENAME COLUMN tv_id TO smart_tv_id;
    END IF;
END $$;

-- =============================================
-- CAMPAIGNS (Campanhas dos Subscribers)
-- =============================================

CREATE TABLE IF NOT EXISTS campaigns (
    campaign_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER NOT NULL, -- FK para subscribers (anunciante)
    contract_id INTEGER, -- FK para subscriber_contracts (opcional, mas necessário para execução nos totens)
    
    title TEXT NOT NULL,
    category_segment TEXT, -- Categoria/segmento da campanha (ex.: Black Friday, Saúde, Cinema, etc.)
    description TEXT,
    campaign_type TEXT DEFAULT 'general', -- general, scheduled, interactive
    priority INTEGER DEFAULT 1, -- 1-10, maior = mais prioridade
    
    -- Camada comercial
    commercial_tier TEXT DEFAULT 'standard', -- premium, standard, remnant
    default_time_share_percent NUMERIC(5, 2) DEFAULT 0, -- % alvo de share de tempo (fallback)
    max_consecutive_slots INTEGER DEFAULT 2, -- maximo de slots consecutivos na fila
    
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    start_time TEXT, -- HH:MM
    end_time TEXT, -- HH:MM
    days_of_week TEXT, -- JSON array: ["mon", "tue", "wed"]
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    
    -- Configuração avançada de agendamento (datas/dias/horários)
    -- Formato sugerido:
    -- {
    --   "date_range": {
    --     "start_date": "2026-03-11",
    --     "end_date": "2026-03-31"
    --   },
    --   "days_of_week": ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],
    --   "time_windows": [
    --     { "start": "07:30", "end": "09:00" },
    --     { "start": "11:30", "end": "13:30" },
    --     { "start": "19:00", "end": "22:00" }
    --   ]
    -- }
    -- Regras:
    -- - Se days_of_week estiver ausente, assumir todos os dias da semana.
    -- - Se time_windows estiver ausente ou vazio, assumir o dia inteiro (00:00–23:59) nos dias permitidos.
    -- - Se date_range não estiver definido, usar start_date/end_date das colunas legadas.
    schedule_config JSONB,
    
    status TEXT DEFAULT 'draft', -- draft, pending_approval, approved, active, paused, finished, cancelled, deleted
    is_active BOOLEAN DEFAULT true,
    
    target_audience JSONB, -- Critérios de público-alvo
    metadata JSONB, -- Metadados adicionais
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_campaign_type 
        CHECK (campaign_type IN ('general', 'scheduled', 'interactive', 'recurring')),
    CONSTRAINT chk_campaign_status 
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'active', 'paused', 'finished', 'cancelled', 'deleted')),
    CONSTRAINT chk_campaign_dates 
        CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date),
    CONSTRAINT chk_campaign_priority 
        CHECK (priority >= 1 AND priority <= 10),
    CONSTRAINT chk_campaign_commercial_tier
        CHECK (commercial_tier IN ('premium', 'standard', 'remnant')),
    CONSTRAINT chk_campaign_time_share
        CHECK (default_time_share_percent >= 0 AND default_time_share_percent <= 100),
    CONSTRAINT chk_campaign_max_consecutive_slots
        CHECK (max_consecutive_slots IS NULL OR max_consecutive_slots >= 1)
);

COMMENT ON TABLE campaigns IS 'Campanhas publicitárias criadas por subscribers (anunciantes). Apenas campanhas vinculadas a contratos ativos podem ser executadas nos totens.';
COMMENT ON COLUMN campaigns.subscriber_id IS 'Subscriber (anunciante) dono da campanha';
COMMENT ON COLUMN campaigns.contract_id IS 'Contrato do subscriber vinculado à campanha. Opcional, mas necessário para execução nos totens.';
COMMENT ON COLUMN campaigns.status IS 'Status: draft, pending_approval, approved, active, paused, finished, cancelled, deleted';
COMMENT ON COLUMN campaigns.category_segment IS 'Categoria/segmento da campanha (taxonomia livre ou controlada)';
COMMENT ON COLUMN campaigns.schedule_config IS 'Configuração detalhada de agendamento (JSON). Ver comentários na definição da coluna para formato e regras de fallback.';

-- =============================================
-- MEDIAS (Mídias dos Subscribers)
-- =============================================

CREATE TABLE IF NOT EXISTS medias (
    media_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER, -- FK para subscribers (opcional no modo Publicar em Totem)
    publisher_id INTEGER, -- FK para publishers (biblioteca da organização)
    
    name TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    
    media_type TEXT NOT NULL, -- video, image, html, widget, iframe
    mime_type TEXT,
    
    duration_seconds INTEGER, -- Para vídeos
    width INTEGER, -- Para imagens/vídeos
    height INTEGER, -- Para imagens/vídeos
    
    thumbnail_url TEXT,
    preview_url TEXT,
    
    status TEXT DEFAULT 'draft', -- draft, pending_approval, approved, rejected, archived
    approval_status TEXT, -- pending, approved, rejected (mantido para compatibilidade)
    rejection_reason TEXT, -- Razão de rejeição
    
    approved_by INTEGER, -- FK para users (tenant user que aprovou)
    approved_at TIMESTAMP,
    
    tags TEXT[], -- Array de tags
    metadata JSONB, -- Metadados adicionais
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_media_type 
        CHECK (media_type IN ('video', 'image', 'html', 'widget', 'iframe', 'audio', 'pdf')),
    CONSTRAINT chk_media_status 
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'archived')),
    CONSTRAINT chk_media_approval_status 
        CHECK (approval_status IS NULL OR approval_status IN ('pending', 'approved', 'rejected'))
);

COMMENT ON TABLE medias IS 'Biblioteca de mídias (organização e/ou anunciante legado)';
COMMENT ON COLUMN medias.subscriber_id IS 'Subscriber legado (modo Pro); NULL no modo Publicar em Totem';
COMMENT ON COLUMN medias.publisher_id IS 'Organização dona da mídia no modo Publicar em Totem';
COMMENT ON COLUMN medias.status IS 'Status da mídia no workflow de aprovação';
COMMENT ON COLUMN medias.approved_by IS 'User (tenant) que aprovou a mídia';

-- Compat: biblioteca por organização (modo Publicar em Totem)
ALTER TABLE IF EXISTS medias ADD COLUMN IF NOT EXISTS publisher_id INTEGER;
ALTER TABLE IF EXISTS medias ALTER COLUMN subscriber_id DROP NOT NULL;

DO $medias_direct_totem$
BEGIN
  IF to_regclass('public.medias') IS NULL THEN
    RETURN;
  END IF;
  UPDATE medias m
  SET publisher_id = p.publisher_id
  FROM publishers p
  WHERE m.publisher_id IS NULL
    AND p.is_active = true
    AND p.publisher_id = (SELECT MIN(publisher_id) FROM publishers WHERE is_active = true);
END;
$medias_direct_totem$;

-- =============================================
-- PLAYLISTS (Playlists - Polimórfica)
-- =============================================

CREATE TABLE IF NOT EXISTS playlists (
    playlist_id SERIAL PRIMARY KEY,
    
    -- Playlist pertence apenas ao subscriber (anunciante) que a criou
    subscriber_id INTEGER NOT NULL, -- FK para subscribers (OBRIGATÓRIO)
    
    name TEXT NOT NULL,
    category_segment TEXT, -- Categoria/segmento da playlist (ex.: Promoções, Institucional, Cinema, etc.)
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    
    schedule_config JSONB, -- Configurações de agendamento
    metadata JSONB, -- Metadados adicionais
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_playlist_subscriber 
        FOREIGN KEY (subscriber_id) 
        REFERENCES subscribers(subscriber_id) 
        ON DELETE CASCADE
);

COMMENT ON TABLE playlists IS 'Playlists criadas por subscribers (anunciantes). Podem estar associadas a múltiplas campanhas via campaign_playlists.';
COMMENT ON COLUMN playlists.subscriber_id IS 'Subscriber (anunciante) que criou a playlist - OBRIGATÓRIO';
COMMENT ON COLUMN playlists.category_segment IS 'Categoria/segmento da playlist (taxonomia livre ou controlada)';

-- =============================================
-- PLAYLIST_ITEMS (Itens das Playlists)
-- =============================================

CREATE TABLE IF NOT EXISTS playlist_items (
    item_id SERIAL PRIMARY KEY,
    playlist_id INTEGER NOT NULL, -- FK para playlists
    media_id INTEGER NOT NULL, -- FK para medias
    
    display_seconds INTEGER DEFAULT 10, -- Duração de exibição em segundos
    order_index INTEGER NOT NULL DEFAULT 0, -- Ordem na playlist
    
    start_time TEXT, -- HH:MM (horário específico, se aplicável)
    end_time TEXT, -- HH:MM
    days_of_week TEXT, -- JSON array
    
    transitions JSONB, -- Efeitos de transição
    metadata JSONB, -- Metadados adicionais
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_playlist_item_order 
        CHECK (order_index >= 0)
);

COMMENT ON TABLE playlist_items IS 'Itens (mídias) de uma playlist';
COMMENT ON COLUMN playlist_items.order_index IS 'Ordem de exibição na playlist (0 = primeiro)';

