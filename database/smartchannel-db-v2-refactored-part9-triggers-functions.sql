-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 9: Triggers e Funções SQL
-- =============================================

-- =============================================
-- FUNÇÃO: Atualizar updated_at automaticamente
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS 'Trigger function para atualizar automaticamente o campo updated_at';

-- =============================================
-- TRIGGERS: updated_at automático para todas as tabelas
-- =============================================

-- Tabelas principais
DROP TRIGGER IF EXISTS trigger_subscribers_updated_at ON subscribers;
CREATE TRIGGER trigger_subscribers_updated_at BEFORE UPDATE ON subscribers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_publishers_updated_at ON publishers;
CREATE TRIGGER trigger_publishers_updated_at BEFORE UPDATE ON publishers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_locals_updated_at ON locals;
CREATE TRIGGER trigger_locals_updated_at BEFORE UPDATE ON locals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_totems_updated_at ON totems;
CREATE TRIGGER trigger_totems_updated_at BEFORE UPDATE ON totems
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_smart_tvs_updated_at ON smart_tvs;
CREATE TRIGGER trigger_smart_tvs_updated_at BEFORE UPDATE ON smart_tvs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_campaigns_updated_at ON campaigns;
CREATE TRIGGER trigger_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_medias_updated_at ON medias;
CREATE TRIGGER trigger_medias_updated_at BEFORE UPDATE ON medias
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_playlists_updated_at ON playlists;
CREATE TRIGGER trigger_playlists_updated_at BEFORE UPDATE ON playlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_playlist_items_updated_at ON playlist_items;
CREATE TRIGGER trigger_playlist_items_updated_at BEFORE UPDATE ON playlist_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Billing
DROP TRIGGER IF EXISTS trigger_subscriber_billing_updated_at ON subscriber_billing;
CREATE TRIGGER trigger_subscriber_billing_updated_at BEFORE UPDATE ON subscriber_billing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_publisher_billing_updated_at ON publisher_billing;
CREATE TRIGGER trigger_publisher_billing_updated_at BEFORE UPDATE ON publisher_billing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Contratos
DROP TRIGGER IF EXISTS trigger_subscriber_contracts_updated_at ON subscriber_contracts;
CREATE TRIGGER trigger_subscriber_contracts_updated_at BEFORE UPDATE ON subscriber_contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_publisher_contracts_updated_at ON publisher_contracts;
CREATE TRIGGER trigger_publisher_contracts_updated_at BEFORE UPDATE ON publisher_contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Subscriptions
DROP TRIGGER IF EXISTS trigger_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trigger_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Outras tabelas
DROP TRIGGER IF EXISTS trigger_plans_updated_at ON plans;
CREATE TRIGGER trigger_plans_updated_at BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_system_settings_updated_at ON system_settings;
CREATE TRIGGER trigger_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_totem_ml_config_updated_at ON totem_ml_config;
CREATE TRIGGER trigger_totem_ml_config_updated_at BEFORE UPDATE ON totem_ml_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_remote_commands_updated_at ON remote_commands;
CREATE TRIGGER trigger_remote_commands_updated_at BEFORE UPDATE ON remote_commands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_ota_updates_updated_at ON ota_updates;
CREATE TRIGGER trigger_ota_updates_updated_at BEFORE UPDATE ON ota_updates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_totem_update_status_updated_at ON totem_update_status;
CREATE TRIGGER trigger_totem_update_status_updated_at BEFORE UPDATE ON totem_update_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_user_two_factor_updated_at ON user_two_factor;
CREATE TRIGGER trigger_user_two_factor_updated_at BEFORE UPDATE ON user_two_factor
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- REMOVIDO: playlist_approvals não existe mais
-- CREATE TRIGGER trigger_playlist_approvals_updated_at BEFORE UPDATE ON playlist_approvals
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabelas de relacionamento N:M
DROP TRIGGER IF EXISTS trigger_campaign_playlists_updated_at ON campaign_playlists;
-- Nota: campaign_playlists não tem updated_at, apenas created_at

DROP TRIGGER IF EXISTS trigger_campaign_medias_updated_at ON campaign_medias;
CREATE TRIGGER trigger_campaign_medias_updated_at BEFORE UPDATE ON campaign_medias
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_campaign_publishers_updated_at ON campaign_publishers;
CREATE TRIGGER trigger_campaign_publishers_updated_at BEFORE UPDATE ON campaign_publishers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_campaign_totems_updated_at ON campaign_totems;
CREATE TRIGGER trigger_campaign_totems_updated_at BEFORE UPDATE ON campaign_totems
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabelas do Motor de Playlists
DROP TRIGGER IF EXISTS trigger_totem_playlists_updated_at ON totem_playlists;
CREATE TRIGGER trigger_totem_playlists_updated_at BEFORE UPDATE ON totem_playlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_totem_playlist_items_updated_at ON totem_playlist_items;
CREATE TRIGGER trigger_totem_playlist_items_updated_at BEFORE UPDATE ON totem_playlist_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNÇÃO: Validar JSONB de configurações de plan
-- =============================================

CREATE OR REPLACE FUNCTION validate_plan_jsonb()
RETURNS TRIGGER AS $$
BEGIN
    -- Validação básica: features e limits devem ser objetos JSON
    IF NEW.features IS NOT NULL AND jsonb_typeof(NEW.features) != 'object' THEN
        RAISE EXCEPTION 'plan.features must be a JSON object';
    END IF;
    
    IF NEW.limits IS NOT NULL AND jsonb_typeof(NEW.limits) != 'object' THEN
        RAISE EXCEPTION 'plan.limits must be a JSON object';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_plan_jsonb ON plans;
CREATE TRIGGER trigger_validate_plan_jsonb
    BEFORE INSERT OR UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION validate_plan_jsonb();

-- =============================================
-- FUNÇÃO: Derivar subscriber_id em playlists
-- =============================================

CREATE OR REPLACE FUNCTION derive_playlist_subscriber_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Se playlist tem campaign_id, derivar subscriber_id da campanha
    IF NEW.campaign_id IS NOT NULL AND NEW.subscriber_id IS NULL THEN
        SELECT subscriber_id INTO NEW.subscriber_id
        FROM campaigns
        WHERE campaign_id = NEW.campaign_id;
    END IF;
    
    -- Se playlist tem totem_id, derivar publisher_id do totem
    IF NEW.totem_id IS NOT NULL AND NEW.publisher_id IS NULL THEN
        SELECT l.publisher_id INTO NEW.publisher_id
        FROM totems t
        JOIN locals l ON t.local_id = l.local_id
        WHERE t.totem_id = NEW.totem_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_derive_playlist_ids ON playlists;
CREATE TRIGGER trigger_derive_playlist_ids
    BEFORE INSERT OR UPDATE ON playlists
    FOR EACH ROW EXECUTE FUNCTION derive_playlist_subscriber_id();

-- =============================================
-- FUNÇÃO: Derivar publisher_id e subscriber_id em execution_logs
-- =============================================

CREATE OR REPLACE FUNCTION derive_execution_log_ids()
RETURNS TRIGGER AS $$
BEGIN
    -- Derivar publisher_id do totem
    IF NEW.totem_id IS NOT NULL AND NEW.publisher_id IS NULL THEN
        SELECT l.publisher_id INTO NEW.publisher_id
        FROM totems t
        JOIN locals l ON t.local_id = l.local_id
        WHERE t.totem_id = NEW.totem_id;
    END IF;
    
    -- Derivar subscriber_id da campanha
    IF NEW.campaign_id IS NOT NULL AND NEW.subscriber_id IS NULL THEN
        SELECT subscriber_id INTO NEW.subscriber_id
        FROM campaigns
        WHERE campaign_id = NEW.campaign_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_derive_execution_log_ids ON execution_logs;
CREATE TRIGGER trigger_derive_execution_log_ids
    BEFORE INSERT ON execution_logs
    FOR EACH ROW EXECUTE FUNCTION derive_execution_log_ids();

-- =============================================
-- FUNÇÃO: Validar revenue share em publisher_billing
-- =============================================

CREATE OR REPLACE FUNCTION validate_publisher_billing_revenue_share()
RETURNS TRIGGER AS $$
BEGIN
    -- Se é revenue_share, validar campos obrigatórios
    IF NEW.billing_type = 'revenue_share' THEN
        IF NEW.revenue_share_percentage IS NULL THEN
            RAISE EXCEPTION 'revenue_share_percentage is required for revenue_share billing_type';
        END IF;
        
        IF NEW.original_campaign_amount IS NULL THEN
            RAISE EXCEPTION 'original_campaign_amount is required for revenue_share billing_type';
        END IF;
        
        IF NEW.direction != 'outgoing' THEN
            RAISE EXCEPTION 'revenue_share must have direction = outgoing';
        END IF;
        
        -- Calcular publisher_share_amount e platform_fee_amount se não preenchidos
        IF NEW.publisher_share_amount IS NULL THEN
            NEW.publisher_share_amount := NEW.original_campaign_amount * (NEW.revenue_share_percentage / 100.0);
        END IF;
        
        IF NEW.platform_fee_amount IS NULL THEN
            NEW.platform_fee_amount := NEW.original_campaign_amount - NEW.publisher_share_amount;
        END IF;
        
        -- Validar consistência
        IF ABS(NEW.publisher_share_amount + NEW.platform_fee_amount - NEW.original_campaign_amount) > 0.01 THEN
            RAISE EXCEPTION 'publisher_share_amount + platform_fee_amount must equal original_campaign_amount';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_publisher_billing_revenue_share ON publisher_billing;
CREATE TRIGGER trigger_validate_publisher_billing_revenue_share
    BEFORE INSERT OR UPDATE ON publisher_billing
    FOR EACH ROW EXECUTE FUNCTION validate_publisher_billing_revenue_share();

-- =============================================
-- TRIGGERS: updated_at para tabelas de acesso
-- =============================================

DROP TRIGGER IF EXISTS trigger_plan_publisher_access_updated_at ON plan_publisher_access;
CREATE TRIGGER trigger_plan_publisher_access_updated_at 
    BEFORE UPDATE ON plan_publisher_access
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_subscriber_publisher_access_updated_at ON subscriber_publisher_access;
CREATE TRIGGER trigger_subscriber_publisher_access_updated_at 
    BEFORE UPDATE ON subscriber_publisher_access
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNÇÃO: Validar acesso Subscriber → Publisher
-- =============================================

CREATE OR REPLACE FUNCTION check_subscriber_publisher_access(
    p_subscriber_id INTEGER,
    p_publisher_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_access BOOLEAN := false;
    v_active_contract_id INTEGER;
    v_plan_id INTEGER;
BEGIN
    -- 1. Verificar se há acesso direto ativo em subscriber_publisher_access
    SELECT EXISTS (
        SELECT 1 
        FROM subscriber_publisher_access
        WHERE subscriber_id = p_subscriber_id
          AND publisher_id = p_publisher_id
          AND is_active = true
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ) INTO v_has_access;
    
    IF v_has_access THEN
        RETURN true;
    END IF;
    
    -- 2. Se não há acesso direto, verificar via contrato ativo → plano
    SELECT sc.contract_id, sc.plan_id
    INTO v_active_contract_id, v_plan_id
    FROM subscriber_contracts sc
    WHERE sc.subscriber_id = p_subscriber_id
      AND sc.status = 'active'
      AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
      AND sc.start_date <= CURRENT_DATE
    ORDER BY sc.created_at DESC
    LIMIT 1;
    
    IF v_plan_id IS NOT NULL THEN
        -- Verificar se plano permite acesso a este publisher
        SELECT EXISTS (
            SELECT 1 
            FROM plan_publisher_access
            WHERE plan_id = v_plan_id
              AND publisher_id = p_publisher_id
              AND is_allowed = true
        ) INTO v_has_access;
    END IF;
    
    RETURN COALESCE(v_has_access, false);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_subscriber_publisher_access IS 
    'Valida se um subscriber tem acesso ativo a um publisher específico';

-- =============================================
-- FUNÇÃO: Validar aprovação de playlist
-- =============================================

-- REMOVIDO: playlist_approvals não existe mais
-- CREATE OR REPLACE FUNCTION validate_playlist_approval()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     -- Se status = approved, approved_by e approved_at devem estar preenchidos
--     IF NEW.status = 'approved' THEN
--         IF NEW.approved_by IS NULL THEN
--             RAISE EXCEPTION 'approved_by is required when status = approved';
--         END IF;
--         IF NEW.approved_at IS NULL THEN
--             NEW.approved_at := CURRENT_TIMESTAMP;
--         END IF;
--     END IF;
--     
--     -- Se status = rejected, rejection_reason deve estar preenchido
--     IF NEW.status = 'rejected' AND NEW.rejection_reason IS NULL OR NEW.rejection_reason = '' THEN
--         RAISE WARNING 'rejection_reason should be provided when status = rejected';
--     END IF;
--     
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- REMOVIDO: playlist_approvals não existe mais
-- CREATE TRIGGER trigger_validate_playlist_approval
--     BEFORE INSERT OR UPDATE ON playlist_approvals
--     FOR EACH ROW EXECUTE FUNCTION validate_playlist_approval();

-- =============================================
-- FUNÇÃO: Sincronizar status de medias com approval_status
-- =============================================

CREATE OR REPLACE FUNCTION sync_media_approval_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Sincronizar approval_status com status
    IF NEW.status = 'approved' THEN
        NEW.approval_status := 'approved';
        IF NEW.approved_at IS NULL THEN
            NEW.approved_at := CURRENT_TIMESTAMP;
        END IF;
    ELSIF NEW.status = 'rejected' THEN
        NEW.approval_status := 'rejected';
    ELSIF NEW.status = 'pending_approval' THEN
        NEW.approval_status := 'pending';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_media_approval_status ON medias;
CREATE TRIGGER trigger_sync_media_approval_status
    BEFORE INSERT OR UPDATE ON medias
    FOR EACH ROW EXECUTE FUNCTION sync_media_approval_status();

-- =============================================
-- FUNÇÃO: Obter Flags Efetivas de um Usuário
-- =============================================

CREATE OR REPLACE FUNCTION get_user_effective_flags(p_user_id INTEGER)
RETURNS TABLE (
    flag_smart_0 BOOLEAN,
    flag_smart_1 BOOLEAN,
    flag_smart_2 BOOLEAN,
    flag_smart_3 BOOLEAN,
    flag_smart_4 BOOLEAN,
    flag_smart_5 BOOLEAN,
    flag_smart_6 BOOLEAN,
    flag_smart_7 BOOLEAN,
    flag_smart_8 BOOLEAN,
    flag_smart_9 BOOLEAN
) AS $$
DECLARE
    v_role TEXT;
    v_user_flags RECORD;
    v_role_flags RECORD;
BEGIN
    -- Obter role do usuário
    SELECT role INTO v_role
    FROM users
    WHERE id = p_user_id;
    
    -- Owner system tem todas as flags
    IF v_role = 'owner_system' THEN
        RETURN QUERY SELECT true, true, true, true, true, true, true, true, true, true;
        RETURN;
    END IF;
    
    -- Buscar flags personalizadas do usuário
    SELECT * INTO v_user_flags
    FROM user_flags
    WHERE user_id = p_user_id;
    
    -- Buscar flags padrão da role
    SELECT * INTO v_role_flags
    FROM role_flags_default
    WHERE role = v_role;
    
    -- Combinar: flags personalizadas têm prioridade sobre flags padrão
    RETURN QUERY SELECT
        COALESCE(v_user_flags.flag_smart_0, v_role_flags.flag_smart_0, false) as flag_smart_0,
        COALESCE(v_user_flags.flag_smart_1, v_role_flags.flag_smart_1, false) as flag_smart_1,
        COALESCE(v_user_flags.flag_smart_2, v_role_flags.flag_smart_2, false) as flag_smart_2,
        COALESCE(v_user_flags.flag_smart_3, v_role_flags.flag_smart_3, false) as flag_smart_3,
        COALESCE(v_user_flags.flag_smart_4, v_role_flags.flag_smart_4, false) as flag_smart_4,
        COALESCE(v_user_flags.flag_smart_5, v_role_flags.flag_smart_5, false) as flag_smart_5,
        COALESCE(v_user_flags.flag_smart_6, v_role_flags.flag_smart_6, false) as flag_smart_6,
        COALESCE(v_user_flags.flag_smart_7, v_role_flags.flag_smart_7, false) as flag_smart_7,
        COALESCE(v_user_flags.flag_smart_8, v_role_flags.flag_smart_8, false) as flag_smart_8,
        COALESCE(v_user_flags.flag_smart_9, v_role_flags.flag_smart_9, false) as flag_smart_9;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_effective_flags IS 'Retorna flags efetivas de um usuário (personalizadas + padrão da role). Owner system sempre retorna todas true.';
