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
CREATE TRIGGER trigger_subscribers_updated_at BEFORE UPDATE ON subscribers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_publishers_updated_at BEFORE UPDATE ON publishers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_locals_updated_at BEFORE UPDATE ON locals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_totems_updated_at BEFORE UPDATE ON totems
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_smart_tvs_updated_at BEFORE UPDATE ON smart_tvs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_medias_updated_at BEFORE UPDATE ON medias
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_playlists_updated_at BEFORE UPDATE ON playlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_playlist_items_updated_at BEFORE UPDATE ON playlist_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Billing
CREATE TRIGGER trigger_subscriber_billing_updated_at BEFORE UPDATE ON subscriber_billing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_publisher_billing_updated_at BEFORE UPDATE ON publisher_billing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Contratos
CREATE TRIGGER trigger_subscriber_contracts_updated_at BEFORE UPDATE ON subscriber_contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_publisher_contracts_updated_at BEFORE UPDATE ON publisher_contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Subscriptions
CREATE TRIGGER trigger_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Outras tabelas
CREATE TRIGGER trigger_plans_updated_at BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_totem_ml_config_updated_at BEFORE UPDATE ON totem_ml_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_remote_commands_updated_at BEFORE UPDATE ON remote_commands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_ota_updates_updated_at BEFORE UPDATE ON ota_updates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_totem_update_status_updated_at BEFORE UPDATE ON totem_update_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_two_factor_updated_at BEFORE UPDATE ON user_two_factor
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- REMOVIDO: playlist_approvals não existe mais
-- CREATE TRIGGER trigger_playlist_approvals_updated_at BEFORE UPDATE ON playlist_approvals
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

CREATE TRIGGER trigger_validate_publisher_billing_revenue_share
    BEFORE INSERT OR UPDATE ON publisher_billing
    FOR EACH ROW EXECUTE FUNCTION validate_publisher_billing_revenue_share();

-- =============================================
-- FUNÇÃO: Validar aprovação de playlist
-- =============================================

-- REMOVIDO: playlist_approvals não existe mais
-- CREATE OR REPLACE FUNCTION validate_playlist_approval()
RETURNS TRIGGER AS $$
BEGIN
    -- Se status = approved, approved_by e approved_at devem estar preenchidos
    IF NEW.status = 'approved' THEN
        IF NEW.approved_by IS NULL THEN
            RAISE EXCEPTION 'approved_by is required when status = approved';
        END IF;
        IF NEW.approved_at IS NULL THEN
            NEW.approved_at := CURRENT_TIMESTAMP;
        END IF;
    END IF;
    
    -- Se status = rejected, rejection_reason deve estar preenchido
    IF NEW.status = 'rejected' AND NEW.rejection_reason IS NULL OR NEW.rejection_reason = '' THEN
        RAISE WARNING 'rejection_reason should be provided when status = rejected';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

CREATE TRIGGER trigger_sync_media_approval_status
    BEFORE INSERT OR UPDATE ON medias
    FOR EACH ROW EXECUTE FUNCTION sync_media_approval_status();

