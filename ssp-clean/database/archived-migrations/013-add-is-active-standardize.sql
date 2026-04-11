-- =============================================
-- Migration 013: Padronizar is_active em TODAS as tabelas
-- =============================================
-- 1. publishers: renomear active -> is_active
-- 2. plan_publisher_access: adicionar is_active (migrar de is_allowed)
-- 3. Adicionar is_active em tabelas que não têm
-- 4. Migrar dados de status/payment_status para is_active onde aplicável
-- Execução idempotente: verifica existência antes de alterar
-- =============================================

-- =============================================
-- 1. PUBLISHERS: active -> is_active
-- =============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'publishers' AND column_name = 'active'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'publishers' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE publishers RENAME COLUMN active TO is_active;
        RAISE NOTICE 'publishers: active renomeado para is_active';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'publishers' AND column_name = 'active'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'publishers' AND column_name = 'is_active'
    ) THEN
        -- Ambos existem: copiar e remover active
        UPDATE publishers SET is_active = active WHERE is_active IS DISTINCT FROM active;
        ALTER TABLE publishers DROP COLUMN active;
        RAISE NOTICE 'publishers: active consolidado em is_active e removido';
    END IF;
END $$;

-- Se publishers ainda tem active, criar is_active e migrar
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'publishers' AND column_name = 'active'
    ) THEN
        ALTER TABLE publishers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
        UPDATE publishers SET is_active = active;
        ALTER TABLE publishers DROP COLUMN IF EXISTS active;
    END IF;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- =============================================
-- 2. plan_publisher_access: adicionar is_active
-- =============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'plan_publisher_access' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE plan_publisher_access ADD COLUMN is_active BOOLEAN DEFAULT true;
        UPDATE plan_publisher_access SET is_active = COALESCE(is_allowed, true);
        RAISE NOTICE 'plan_publisher_access: is_active adicionado';
    END IF;
END $$;

-- =============================================
-- 3. Tabelas de billing e contratos
-- =============================================
DO $$
BEGIN
    IF to_regclass('public.subscriber_billing') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'subscriber_billing' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE subscriber_billing ADD COLUMN is_active BOOLEAN DEFAULT true;
        UPDATE subscriber_billing SET is_active = (payment_status NOT IN ('cancelled', 'refunded'));
        RAISE NOTICE 'subscriber_billing: is_active adicionado';
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.publisher_billing') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'publisher_billing' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE publisher_billing ADD COLUMN is_active BOOLEAN DEFAULT true;
        UPDATE publisher_billing SET is_active = (payment_status NOT IN ('cancelled', 'refunded'));
        RAISE NOTICE 'publisher_billing: is_active adicionado';
    END IF;
END $$;

-- subscriber_contracts e publisher_contracts - podem já ter is_active
DO $$
BEGIN
    IF to_regclass('public.subscriber_contracts') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'subscriber_contracts' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE subscriber_contracts ADD COLUMN is_active BOOLEAN DEFAULT true;
        UPDATE subscriber_contracts SET is_active = (status IN ('draft', 'active'));
        RAISE NOTICE 'subscriber_contracts: is_active adicionado';
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.publisher_contracts') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'publisher_contracts' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE publisher_contracts ADD COLUMN is_active BOOLEAN DEFAULT true;
        UPDATE publisher_contracts SET is_active = (status IN ('draft', 'active'));
        RAISE NOTICE 'publisher_contracts: is_active adicionado';
    END IF;
END $$;

-- =============================================
-- 4. Tabelas de relacionamento e config
-- =============================================
DO $$
DECLARE
    _tbl TEXT;
    _tables TEXT[] := ARRAY[
        'user_roles', 'role_permissions', 'permissions', 'system_settings',
        'user_flags', 'role_flags_default', 'subscriptions',
        'analytics_sessions', 'analytics_emotions', 'analytics_gestures',
        'execution_logs', 'event_logs', 'dispatcher_log', 'interaction_logs',
        'dispatcher_decisions', 'dispatcher_decision_campaigns', 'dispatcher_decision_items', 'dispatcher_events',
        'totem_ml_config', 'emotion_data', 'gesture_data', 'behavior_data',
        'recognized_persons', 'remote_commands', 'ota_updates', 'totem_update_status',
        'audit_logs', 'device_tokens', 'user_two_factor', 'two_factor_attempts', 'password_reset_tokens',
        'reports', 'report_templates', 'advanced_schedules', 'dashboard_layouts', 'backups', 'stripe_customers',
        'ai_models', 'system_logs', 'webhook_configs', 'alert_rules', 'ml_models',
        'fx_effects', 'fx_rules', 'fx_timelines', 'webhooks',
        'ai_context_data', 'playlist_mix_history', 'totem_playlist_generation_log'
    ];
BEGIN
    FOREACH _tbl IN ARRAY _tables
    LOOP
        IF to_regclass('public.' || _tbl) IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = _tbl AND column_name = 'is_active'
        ) THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN is_active BOOLEAN DEFAULT true', _tbl);
            RAISE NOTICE '%: is_active adicionado', _tbl;
        END IF;
    END LOOP;
END $$;

-- subscriptions: migrar status para is_active se já existir coluna
DO $$
BEGIN
    IF to_regclass('public.subscriptions') IS NOT NULL AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'is_active'
    ) THEN
        UPDATE subscriptions SET is_active = (status IN ('active', 'trialing')) WHERE is_active IS NULL OR status IS NOT NULL;
    END IF;
END $$;

COMMENT ON COLUMN publishers.is_active IS 'Padronizado: ex-publishers.active - indica se publisher está ativo';
