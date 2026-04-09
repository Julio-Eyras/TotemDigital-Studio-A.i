-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 11: Tabelas e Funcionalidades de Mix Inteligente de Playlists
-- =============================================

-- =============================================
-- PLAYLIST_MIX_RULES (Regras de Mixagem)
-- =============================================

CREATE TABLE IF NOT EXISTS playlist_mix_rules (
    rule_id SERIAL PRIMARY KEY,
    totem_id INTEGER, -- NULL = regra global, INTEGER = regra específica do totem
    name TEXT NOT NULL,
    description TEXT,
    
    -- Tipo de regra
    rule_type TEXT NOT NULL DEFAULT 'systematic', -- 'systematic', 'ai', 'hybrid'
    
    -- Regras Sistemáticas
    priority_weight NUMERIC(5, 2) DEFAULT 1.0, -- Peso da prioridade da campanha (0.0 a 10.0)
    time_weight NUMERIC(5, 2) DEFAULT 1.0, -- Peso do horário (0.0 a 10.0)
    tag_weight NUMERIC(5, 2) DEFAULT 1.0, -- Peso das tags (0.0 a 10.0)
    subscriber_weight NUMERIC(5, 2) DEFAULT 1.0, -- Peso do subscriber (0.0 a 10.0)
    
    -- Configurações de IA
    ai_enabled BOOLEAN DEFAULT false,
    ai_provider TEXT, -- 'ollama', 'openai', 'anthropic', 'custom'
    ai_model TEXT, -- Modelo específico a usar
    ai_config JSONB, -- Configurações específicas do provedor de IA
    
    -- Recursos de IA
    use_pedestrian_detection BOOLEAN DEFAULT false, -- Reconhecimento de transeuntes
    use_sentiment_analysis BOOLEAN DEFAULT false, -- Análise de sentimento
    use_context_awareness BOOLEAN DEFAULT false, -- Consciência contextual
    use_historical_optimization BOOLEAN DEFAULT false, -- Otimização baseada em histórico
    
    -- Configurações de Mixagem
    max_items_per_playlist INTEGER DEFAULT 50, -- Máximo de itens por playlist mixada
    rotation_strategy TEXT DEFAULT 'round_robin', -- 'round_robin', 'priority', 'weighted', 'ai_optimized'
    shuffle_enabled BOOLEAN DEFAULT false, -- Se deve embaralhar dentro da mesma prioridade
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false, -- Se é a regra padrão
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_playlist_mix_rule_type 
        CHECK (rule_type IN ('systematic', 'ai', 'hybrid')),
    CONSTRAINT chk_playlist_mix_rotation_strategy 
        CHECK (rotation_strategy IN ('round_robin', 'priority', 'weighted', 'ai_optimized')),
    CONSTRAINT chk_playlist_mix_weights 
        CHECK (
            priority_weight >= 0 AND priority_weight <= 10 AND
            time_weight >= 0 AND time_weight <= 10 AND
            tag_weight >= 0 AND tag_weight <= 10 AND
            subscriber_weight >= 0 AND subscriber_weight <= 10
        )
);

COMMENT ON TABLE playlist_mix_rules IS 'Regras de mixagem inteligente de playlists para totens';
COMMENT ON COLUMN playlist_mix_rules.totem_id IS 'NULL = regra global, INTEGER = regra específica do totem';
COMMENT ON COLUMN playlist_mix_rules.rule_type IS 'Tipo: systematic (apenas regras), ai (apenas IA), hybrid (ambos)';
COMMENT ON COLUMN playlist_mix_rules.ai_enabled IS 'Se IA está habilitada para esta regra';
COMMENT ON COLUMN playlist_mix_rules.use_pedestrian_detection IS 'Usar reconhecimento de transeuntes';
COMMENT ON COLUMN playlist_mix_rules.use_sentiment_analysis IS 'Usar análise de sentimento';
COMMENT ON COLUMN playlist_mix_rules.rotation_strategy IS 'Estratégia de rotação: round_robin, priority, weighted, ai_optimized';

-- =============================================
-- AI_CONTEXT_DATA (Dados de Contexto para IA)
-- =============================================

CREATE TABLE IF NOT EXISTS ai_context_data (
    context_id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    
    -- Dados de Transeuntes
    pedestrian_count INTEGER DEFAULT 0, -- Número de pessoas detectadas
    pedestrian_density TEXT, -- 'low', 'medium', 'high'
    pedestrian_demographics JSONB, -- {age_groups: {...}, gender: {...}}
    last_pedestrian_detection TIMESTAMP,
    
    -- Análise de Sentimento
    sentiment_score NUMERIC(3, 2), -- -1.0 (negativo) a 1.0 (positivo)
    sentiment_label TEXT, -- 'positive', 'neutral', 'negative'
    emotion_tags TEXT[], -- Array de emoções detectadas
    last_sentiment_analysis TIMESTAMP,
    
    -- Contexto Temporal e Ambiental
    time_of_day TEXT, -- 'morning', 'afternoon', 'evening', 'night'
    day_type TEXT, -- 'weekday', 'weekend', 'holiday'
    weather_context JSONB, -- {temperature, condition, humidity, etc}
    event_context JSONB, -- Eventos especiais no local
    
    -- Histórico de Performance
    performance_metrics JSONB, -- {engagement_rate, view_count, conversion_rate, etc}
    last_performance_update TIMESTAMP,
    
    -- Dados brutos da IA
    raw_ai_data JSONB, -- Dados brutos retornados pela IA
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_ai_context_sentiment_score 
        CHECK (sentiment_score IS NULL OR (sentiment_score >= -1.0 AND sentiment_score <= 1.0)),
    CONSTRAINT chk_ai_context_sentiment_label 
        CHECK (sentiment_label IS NULL OR sentiment_label IN ('positive', 'neutral', 'negative')),
    CONSTRAINT chk_ai_context_pedestrian_density 
        CHECK (pedestrian_density IS NULL OR pedestrian_density IN ('low', 'medium', 'high'))
);

COMMENT ON TABLE ai_context_data IS 'Dados de contexto coletados para IA (transeuntes, sentimento, ambiente)';
COMMENT ON COLUMN ai_context_data.pedestrian_count IS 'Número de pessoas detectadas no momento';
COMMENT ON COLUMN ai_context_data.sentiment_score IS 'Score de sentimento: -1.0 (negativo) a 1.0 (positivo)';
COMMENT ON COLUMN ai_context_data.performance_metrics IS 'Métricas de performance históricas para otimização';

-- =============================================
-- TOTEM_PLAYLIST_MIX (Playlist Mixada Final do Totem)
-- =============================================

CREATE TABLE IF NOT EXISTS totem_playlist_mix (
    mix_id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    
    -- Informações da Mixagem
    rule_id INTEGER, -- FK para playlist_mix_rules (qual regra foi usada)
    mix_version INTEGER DEFAULT 1, -- Versão da mixagem (incrementa a cada nova mixagem)
    
    -- Itens da Playlist Mixada (JSONB array)
    -- Cada item contém: {media_id, playlist_id, campaign_id, order_index, weight, source}
    mix_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Metadados da Mixagem
    total_items INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0, -- Duração total em segundos
    mix_strategy TEXT, -- Estratégia usada: 'systematic', 'ai', 'hybrid'
    
    -- Contexto usado na mixagem
    context_snapshot JSONB, -- Snapshot do contexto no momento da mixagem
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_current BOOLEAN DEFAULT false, -- Se é a playlist atual do totem
    
    -- Timestamps
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    applied_at TIMESTAMP, -- Quando foi aplicada ao totem
    expires_at TIMESTAMP, -- Quando expira (se aplicável)
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE totem_playlist_mix IS 'Playlist mixada final gerada para cada totem';
COMMENT ON COLUMN totem_playlist_mix.mix_items IS 'Array JSONB com os itens da playlist mixada ordenados';
COMMENT ON COLUMN totem_playlist_mix.is_current IS 'Se é a playlist atualmente em execução no totem';
COMMENT ON COLUMN totem_playlist_mix.context_snapshot IS 'Snapshot do contexto (IA, ambiente) usado na mixagem';

-- =============================================
-- PLAYLIST_MIX_HISTORY (Histórico de Mixagens)
-- =============================================

CREATE TABLE IF NOT EXISTS playlist_mix_history (
    history_id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    mix_id INTEGER, -- FK para totem_playlist_mix
    
    -- Informações da Mixagem
    rule_id INTEGER,
    mix_strategy TEXT,
    total_items INTEGER,
    total_duration INTEGER,
    
    -- Performance
    execution_count INTEGER DEFAULT 0, -- Quantas vezes foi executada
    average_view_time NUMERIC(10, 2), -- Tempo médio de visualização
    engagement_score NUMERIC(5, 2), -- Score de engajamento (0-100)
    
    -- Contexto
    context_snapshot JSONB,
    
    -- Timestamps
    generated_at TIMESTAMP,
    applied_at TIMESTAMP,
    last_executed_at TIMESTAMP,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE playlist_mix_history IS 'Histórico de mixagens para análise e otimização';
COMMENT ON COLUMN playlist_mix_history.engagement_score IS 'Score de engajamento calculado (0-100)';

-- =============================================
-- FOREIGN KEYS
-- =============================================

-- playlist_mix_rules
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_playlist_mix_rules_totem'
        AND t.relname = 'playlist_mix_rules'
    ) THEN
        ALTER TABLE playlist_mix_rules
            ADD CONSTRAINT fk_playlist_mix_rules_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- ai_context_data
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_ai_context_data_totem'
        AND t.relname = 'ai_context_data'
    ) THEN
        ALTER TABLE ai_context_data
            ADD CONSTRAINT fk_ai_context_data_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- totem_playlist_mix
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_totem_playlist_mix_totem'
        AND t.relname = 'totem_playlist_mix'
    ) THEN
        ALTER TABLE totem_playlist_mix
            ADD CONSTRAINT fk_totem_playlist_mix_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_totem_playlist_mix_rule'
        AND t.relname = 'totem_playlist_mix'
    ) THEN
        ALTER TABLE totem_playlist_mix
            ADD CONSTRAINT fk_totem_playlist_mix_rule 
            FOREIGN KEY (rule_id) REFERENCES playlist_mix_rules(rule_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- playlist_mix_history
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_playlist_mix_history_totem'
        AND t.relname = 'playlist_mix_history'
    ) THEN
        ALTER TABLE playlist_mix_history
            ADD CONSTRAINT fk_playlist_mix_history_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_playlist_mix_history_mix'
        AND t.relname = 'playlist_mix_history'
    ) THEN
        ALTER TABLE playlist_mix_history
            ADD CONSTRAINT fk_playlist_mix_history_mix 
            FOREIGN KEY (mix_id) REFERENCES totem_playlist_mix(mix_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_playlist_mix_history_rule'
        AND t.relname = 'playlist_mix_history'
    ) THEN
        ALTER TABLE playlist_mix_history
            ADD CONSTRAINT fk_playlist_mix_history_rule 
            FOREIGN KEY (rule_id) REFERENCES playlist_mix_rules(rule_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================
-- INDEXES
-- =============================================

-- playlist_mix_rules
CREATE INDEX IF NOT EXISTS idx_playlist_mix_rules_totem_id 
    ON playlist_mix_rules(totem_id) 
    WHERE totem_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_playlist_mix_rules_active 
    ON playlist_mix_rules(is_active, is_default) 
    WHERE is_active = true;

-- ai_context_data
CREATE INDEX IF NOT EXISTS idx_ai_context_data_totem_id 
    ON ai_context_data(totem_id);

CREATE INDEX IF NOT EXISTS idx_ai_context_data_updated 
    ON ai_context_data(totem_id, updated_at DESC);

-- totem_playlist_mix
CREATE INDEX IF NOT EXISTS idx_totem_playlist_mix_totem_id 
    ON totem_playlist_mix(totem_id);

CREATE INDEX IF NOT EXISTS idx_totem_playlist_mix_current 
    ON totem_playlist_mix(totem_id, is_current) 
    WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_totem_playlist_mix_active 
    ON totem_playlist_mix(totem_id, is_active, generated_at DESC) 
    WHERE is_active = true;

-- playlist_mix_history
CREATE INDEX IF NOT EXISTS idx_playlist_mix_history_totem_id 
    ON playlist_mix_history(totem_id);

CREATE INDEX IF NOT EXISTS idx_playlist_mix_history_mix_id 
    ON playlist_mix_history(mix_id) 
    WHERE mix_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_playlist_mix_history_generated 
    ON playlist_mix_history(totem_id, generated_at DESC);

