-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 12: Funções e Triggers para Mix Inteligente de Playlists
-- =============================================

-- =============================================
-- FUNÇÃO: Obter Regra de Mixagem para Totem
-- =============================================

CREATE OR REPLACE FUNCTION get_mix_rule_for_totem(p_totem_id INTEGER)
RETURNS TABLE (
    rule_id INTEGER,
    name TEXT,
    rule_type TEXT,
    priority_weight NUMERIC,
    time_weight NUMERIC,
    tag_weight NUMERIC,
    subscriber_weight NUMERIC,
    ai_enabled BOOLEAN,
    ai_provider TEXT,
    ai_model TEXT,
    ai_config JSONB,
    use_pedestrian_detection BOOLEAN,
    use_sentiment_analysis BOOLEAN,
    use_context_awareness BOOLEAN,
    use_historical_optimization BOOLEAN,
    max_items_per_playlist INTEGER,
    rotation_strategy TEXT,
    shuffle_enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.rule_id,
        r.name,
        r.rule_type,
        r.priority_weight,
        r.time_weight,
        r.tag_weight,
        r.subscriber_weight,
        r.ai_enabled,
        r.ai_provider,
        r.ai_model,
        r.ai_config,
        r.use_pedestrian_detection,
        r.use_sentiment_analysis,
        r.use_context_awareness,
        r.use_historical_optimization,
        r.max_items_per_playlist,
        r.rotation_strategy,
        r.shuffle_enabled
    FROM playlist_mix_rules r
    WHERE r.is_active = true
      AND (
          (r.totem_id = p_totem_id) -- Regra específica do totem
          OR (r.totem_id IS NULL AND r.is_default = true) -- Regra padrão global
      )
    ORDER BY 
        CASE WHEN r.totem_id = p_totem_id THEN 0 ELSE 1 END, -- Priorizar regra específica
        r.is_default DESC,
        r.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_mix_rule_for_totem IS 'Retorna a regra de mixagem ativa para um totem (específica ou padrão)';

-- =============================================
-- FUNÇÃO: Obter Contexto de IA para Totem
-- =============================================

CREATE OR REPLACE FUNCTION get_ai_context_for_totem(p_totem_id INTEGER)
RETURNS TABLE (
    context_id INTEGER,
    pedestrian_count INTEGER,
    pedestrian_density TEXT,
    pedestrian_demographics JSONB,
    sentiment_score NUMERIC,
    sentiment_label TEXT,
    emotion_tags TEXT[],
    time_of_day TEXT,
    day_type TEXT,
    weather_context JSONB,
    event_context JSONB,
    performance_metrics JSONB,
    updated_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.context_id,
        c.pedestrian_count,
        c.pedestrian_density,
        c.pedestrian_demographics,
        c.sentiment_score,
        c.sentiment_label,
        c.emotion_tags,
        c.time_of_day,
        c.day_type,
        c.weather_context,
        c.event_context,
        c.performance_metrics,
        c.updated_at
    FROM ai_context_data c
    WHERE c.totem_id = p_totem_id
    ORDER BY c.updated_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_ai_context_for_totem IS 'Retorna o contexto de IA mais recente para um totem';

-- =============================================
-- FUNÇÃO: Marcar Mixagem como Atual
-- =============================================

CREATE OR REPLACE FUNCTION set_current_mix_for_totem(
    p_totem_id INTEGER,
    p_mix_id INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_result BOOLEAN := false;
BEGIN
    -- Desmarcar todas as mixagens anteriores como atuais
    UPDATE totem_playlist_mix
    SET is_current = false,
        updated_at = CURRENT_TIMESTAMP
    WHERE totem_id = p_totem_id
      AND is_current = true;
    
    -- Marcar a nova mixagem como atual
    UPDATE totem_playlist_mix
    SET is_current = true,
        applied_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE totem_id = p_totem_id
      AND mix_id = p_mix_id
      AND is_active = true;
    
    -- Verificar se a atualização foi bem-sucedida
    SELECT EXISTS(
        SELECT 1 
        FROM totem_playlist_mix 
        WHERE totem_id = p_totem_id 
          AND mix_id = p_mix_id 
          AND is_current = true
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_current_mix_for_totem IS 'Marca uma mixagem como a atual para um totem';

-- =============================================
-- FUNÇÃO: Obter Playlist Mixada Atual do Totem
-- =============================================

CREATE OR REPLACE FUNCTION get_current_mix_for_totem(p_totem_id INTEGER)
RETURNS TABLE (
    mix_id INTEGER,
    mix_version INTEGER,
    mix_items JSONB,
    total_items INTEGER,
    total_duration INTEGER,
    mix_strategy TEXT,
    context_snapshot JSONB,
    generated_at TIMESTAMP,
    applied_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.mix_id,
        m.mix_version,
        m.mix_items,
        m.total_items,
        m.total_duration,
        m.mix_strategy,
        m.context_snapshot,
        m.generated_at,
        m.applied_at
    FROM totem_playlist_mix m
    WHERE m.totem_id = p_totem_id
      AND m.is_current = true
      AND m.is_active = true
    ORDER BY m.generated_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_current_mix_for_totem IS 'Retorna a playlist mixada atual de um totem';

-- =============================================
-- TRIGGER: Atualizar updated_at em playlist_mix_rules
-- =============================================

CREATE OR REPLACE FUNCTION update_playlist_mix_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_playlist_mix_rules_updated_at ON playlist_mix_rules;
CREATE TRIGGER trigger_update_playlist_mix_rules_updated_at
    BEFORE UPDATE ON playlist_mix_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_playlist_mix_rules_updated_at();

-- =============================================
-- TRIGGER: Atualizar updated_at em ai_context_data
-- =============================================

CREATE OR REPLACE FUNCTION update_ai_context_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_context_data_updated_at ON ai_context_data;
CREATE TRIGGER trigger_update_ai_context_data_updated_at
    BEFORE UPDATE ON ai_context_data
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_context_data_updated_at();

-- =============================================
-- TRIGGER: Atualizar updated_at em totem_playlist_mix
-- =============================================

CREATE OR REPLACE FUNCTION update_totem_playlist_mix_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_totem_playlist_mix_updated_at ON totem_playlist_mix;
CREATE TRIGGER trigger_update_totem_playlist_mix_updated_at
    BEFORE UPDATE ON totem_playlist_mix
    FOR EACH ROW
    EXECUTE FUNCTION update_totem_playlist_mix_updated_at();

-- =============================================
-- TRIGGER: Garantir apenas uma regra padrão global
-- =============================================

CREATE OR REPLACE FUNCTION ensure_single_default_mix_rule()
RETURNS TRIGGER AS $$
BEGIN
    -- Se está marcando como padrão e é global (totem_id IS NULL)
    IF NEW.is_default = true AND NEW.totem_id IS NULL THEN
        -- Desmarcar outras regras padrão globais
        UPDATE playlist_mix_rules
        SET is_default = false
        WHERE rule_id != NEW.rule_id
          AND totem_id IS NULL
          AND is_default = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_default_mix_rule ON playlist_mix_rules;
CREATE TRIGGER trigger_ensure_single_default_mix_rule
    BEFORE INSERT OR UPDATE ON playlist_mix_rules
    FOR EACH ROW
    WHEN (NEW.is_default = true AND NEW.totem_id IS NULL)
    EXECUTE FUNCTION ensure_single_default_mix_rule();

-- =============================================
-- TRIGGER: Garantir apenas uma mixagem atual por totem
-- =============================================

CREATE OR REPLACE FUNCTION ensure_single_current_mix_per_totem()
RETURNS TRIGGER AS $$
BEGIN
    -- Se está marcando como atual
    IF NEW.is_current = true THEN
        -- Desmarcar outras mixagens atuais do mesmo totem
        UPDATE totem_playlist_mix
        SET is_current = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE totem_id = NEW.totem_id
          AND mix_id != NEW.mix_id
          AND is_current = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_current_mix_per_totem ON totem_playlist_mix;
CREATE TRIGGER trigger_ensure_single_current_mix_per_totem
    BEFORE INSERT OR UPDATE ON totem_playlist_mix
    FOR EACH ROW
    WHEN (NEW.is_current = true)
    EXECUTE FUNCTION ensure_single_current_mix_per_totem();

-- =============================================
-- TRIGGER: Registrar histórico ao aplicar mixagem
-- =============================================

CREATE OR REPLACE FUNCTION log_mix_history_on_apply()
RETURNS TRIGGER AS $$
BEGIN
    -- Quando uma mixagem é marcada como atual (applied_at é definido)
    IF NEW.is_current = true AND NEW.applied_at IS NOT NULL AND 
       (OLD.applied_at IS NULL OR OLD.applied_at != NEW.applied_at) THEN
        -- Registrar no histórico
        INSERT INTO playlist_mix_history (
            totem_id,
            mix_id,
            rule_id,
            mix_strategy,
            total_items,
            total_duration,
            context_snapshot,
            generated_at,
            applied_at
        )
        VALUES (
            NEW.totem_id,
            NEW.mix_id,
            NEW.rule_id,
            NEW.mix_strategy,
            NEW.total_items,
            NEW.total_duration,
            NEW.context_snapshot,
            NEW.generated_at,
            NEW.applied_at
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_mix_history_on_apply ON totem_playlist_mix;
CREATE TRIGGER trigger_log_mix_history_on_apply
    AFTER UPDATE ON totem_playlist_mix
    FOR EACH ROW
    WHEN (NEW.is_current = true AND NEW.applied_at IS NOT NULL)
    EXECUTE FUNCTION log_mix_history_on_apply();

