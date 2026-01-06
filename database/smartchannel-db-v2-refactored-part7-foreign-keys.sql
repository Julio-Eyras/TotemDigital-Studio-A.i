-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 7: Foreign Keys (Todas as FKs em ordem)
-- =============================================

-- =============================================
-- FKs da tabela USERS
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_users_publisher'
        AND t.relname = 'users'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT fk_users_publisher 
            FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================
-- FKs da tabela LOCALS
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_locals_publisher'
        AND t.relname = 'locals'
    ) THEN
        ALTER TABLE locals
            ADD CONSTRAINT fk_locals_publisher 
            FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
            ON DELETE CASCADE;
    END IF;
    
    -- Foreign key para subscriber_id em locals
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_locals_subscriber'
    ) THEN
        ALTER TABLE locals
            ADD CONSTRAINT fk_locals_subscriber 
            FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- FKs da tabela TOTEMS
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_totems_local'
        AND t.relname = 'totems'
    ) THEN
        ALTER TABLE totems
            ADD CONSTRAINT fk_totems_local 
            FOREIGN KEY (local_id) REFERENCES locals(local_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- FKs da tabela SMART_TVS
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_smart_tvs_totem'
        AND t.relname = 'smart_tvs'
    ) THEN
        ALTER TABLE smart_tvs
            ADD CONSTRAINT fk_smart_tvs_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- FKs da tabela CAMPAIGNS
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_campaigns_subscriber'
        AND t.relname = 'campaigns'
    ) THEN
        ALTER TABLE campaigns
            ADD CONSTRAINT fk_campaigns_subscriber 
            FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- FKs da tabela MEDIAS
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_medias_subscriber'
        AND t.relname = 'medias'
    ) THEN
        ALTER TABLE medias
            ADD CONSTRAINT fk_medias_subscriber 
            FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_medias_approved_by'
        AND t.relname = 'medias'
    ) THEN
        ALTER TABLE medias
            ADD CONSTRAINT fk_medias_approved_by 
            FOREIGN KEY (approved_by) REFERENCES users(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================
-- FKs da tabela PLAYLISTS
-- =============================================
-- REMOVIDO: fk_playlists_totem - totem_id foi removido de playlists
-- REMOVIDO: fk_playlists_campaign - campaign_id foi removido de playlists
-- REMOVIDO: fk_playlists_publisher - publisher_id foi removido de playlists
-- Playlists agora pertencem apenas ao subscriber que as criou
-- Relacionamento com campanhas é feito via campaign_playlists (N:M)

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_playlists_subscriber'
        AND t.relname = 'playlists'
    ) THEN
        ALTER TABLE playlists
            ADD CONSTRAINT fk_playlists_subscriber 
            FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- FKs da tabela PLAYLIST_ITEMS
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_playlist_items_playlist'
        AND t.relname = 'playlist_items'
    ) THEN
        ALTER TABLE playlist_items
            ADD CONSTRAINT fk_playlist_items_playlist 
            FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_playlist_items_media'
        AND t.relname = 'playlist_items'
    ) THEN
        ALTER TABLE playlist_items
            ADD CONSTRAINT fk_playlist_items_media 
            FOREIGN KEY (media_id) REFERENCES medias(media_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- FKs da tabela SUBSCRIPTIONS
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_subscriptions_publisher'
        AND t.relname = 'subscriptions'
    ) THEN
        ALTER TABLE subscriptions
            ADD CONSTRAINT fk_subscriptions_publisher 
            FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_subscriptions_plan'
        AND t.relname = 'subscriptions'
    ) THEN
        ALTER TABLE subscriptions
            ADD CONSTRAINT fk_subscriptions_plan 
            FOREIGN KEY (plan_id) REFERENCES plans(plan_id) 
            ON DELETE RESTRICT;
    END IF;
END $$;

-- =============================================
-- FKs das tabelas de BILLING
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_subscriber_billing_subscriber'
        AND t.relname = 'subscriber_billing'
    ) THEN
        ALTER TABLE subscriber_billing
            ADD CONSTRAINT fk_subscriber_billing_subscriber 
            FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_subscriber_billing_campaign'
        AND t.relname = 'subscriber_billing'
    ) THEN
        ALTER TABLE subscriber_billing
            ADD CONSTRAINT fk_subscriber_billing_campaign 
            FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_publisher_billing_publisher'
        AND t.relname = 'publisher_billing'
    ) THEN
        ALTER TABLE publisher_billing
            ADD CONSTRAINT fk_publisher_billing_publisher 
            FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_publisher_billing_campaign'
        AND t.relname = 'publisher_billing'
    ) THEN
        ALTER TABLE publisher_billing
            ADD CONSTRAINT fk_publisher_billing_campaign 
            FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_publisher_billing_totem'
        AND t.relname = 'publisher_billing'
    ) THEN
        ALTER TABLE publisher_billing
            ADD CONSTRAINT fk_publisher_billing_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_publisher_billing_subscription'
        AND t.relname = 'publisher_billing'
    ) THEN
        ALTER TABLE publisher_billing
            ADD CONSTRAINT fk_publisher_billing_subscription 
            FOREIGN KEY (subscription_id) REFERENCES subscriptions(subscription_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_publisher_billing_approved_by'
        AND t.relname = 'publisher_billing'
    ) THEN
        ALTER TABLE publisher_billing
            ADD CONSTRAINT fk_publisher_billing_approved_by 
            FOREIGN KEY (approved_by) REFERENCES users(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================
-- FKs das tabelas de CONTRATOS
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_subscriber_contracts_subscriber'
        AND t.relname = 'subscriber_contracts'
    ) THEN
        ALTER TABLE subscriber_contracts
            ADD CONSTRAINT fk_subscriber_contracts_subscriber 
            FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_subscriber_contracts_created_by'
        AND t.relname = 'subscriber_contracts'
    ) THEN
        ALTER TABLE subscriber_contracts
            ADD CONSTRAINT fk_subscriber_contracts_created_by 
            FOREIGN KEY (created_by) REFERENCES users(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- FK para plan_id em subscriber_contracts
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_subscriber_contracts_plan'
        AND t.relname = 'subscriber_contracts'
    ) THEN
        ALTER TABLE subscriber_contracts
            ADD CONSTRAINT fk_subscriber_contracts_plan 
            FOREIGN KEY (plan_id) REFERENCES plans(plan_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_publisher_contracts_publisher'
        AND t.relname = 'publisher_contracts'
    ) THEN
        ALTER TABLE publisher_contracts
            ADD CONSTRAINT fk_publisher_contracts_publisher 
            FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_publisher_contracts_created_by'
        AND t.relname = 'publisher_contracts'
    ) THEN
        ALTER TABLE publisher_contracts
            ADD CONSTRAINT fk_publisher_contracts_created_by 
            FOREIGN KEY (created_by) REFERENCES users(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================
-- FKs das tabelas de RELACIONAMENTO N:M
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_user_roles_user'
        AND t.relname = 'user_roles'
    ) THEN
        ALTER TABLE user_roles
            ADD CONSTRAINT fk_user_roles_user 
            FOREIGN KEY (user_id) REFERENCES users(id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_user_roles_role'
        AND t.relname = 'user_roles'
    ) THEN
        ALTER TABLE user_roles
            ADD CONSTRAINT fk_user_roles_role 
            FOREIGN KEY (role_id) REFERENCES roles(role_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_user_roles_assigned_by'
        AND t.relname = 'user_roles'
    ) THEN
        ALTER TABLE user_roles
            ADD CONSTRAINT fk_user_roles_assigned_by 
            FOREIGN KEY (assigned_by) REFERENCES users(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_role_permissions_role'
        AND t.relname = 'role_permissions'
    ) THEN
        ALTER TABLE role_permissions
            ADD CONSTRAINT fk_role_permissions_role 
            FOREIGN KEY (role_id) REFERENCES roles(role_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_role_permissions_permission'
        AND t.relname = 'role_permissions'
    ) THEN
        ALTER TABLE role_permissions
            ADD CONSTRAINT fk_role_permissions_permission 
            FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_campaign_playlists_campaign'
        AND t.relname = 'campaign_playlists'
    ) THEN
        ALTER TABLE campaign_playlists
            ADD CONSTRAINT fk_campaign_playlists_campaign 
            FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_campaign_playlists_playlist'
        AND t.relname = 'campaign_playlists'
    ) THEN
        ALTER TABLE campaign_playlists
            ADD CONSTRAINT fk_campaign_playlists_playlist 
            FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- FKs da tabela CAMPAIGN_MEDIAS
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_campaign_medias_campaign'
        AND t.relname = 'campaign_medias'
    ) THEN
        ALTER TABLE campaign_medias
            ADD CONSTRAINT fk_campaign_medias_campaign 
            FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_campaign_medias_media'
        AND t.relname = 'campaign_medias'
    ) THEN
        ALTER TABLE campaign_medias
            ADD CONSTRAINT fk_campaign_medias_media 
            FOREIGN KEY (media_id) REFERENCES medias(media_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_campaign_totems_campaign'
        AND t.relname = 'campaign_totems'
    ) THEN
        ALTER TABLE campaign_totems
            ADD CONSTRAINT fk_campaign_totems_campaign 
            FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_campaign_totems_totem'
        AND t.relname = 'campaign_totems'
    ) THEN
        ALTER TABLE campaign_totems
            ADD CONSTRAINT fk_campaign_totems_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_campaign_publishers_campaign'
        AND t.relname = 'campaign_publishers'
    ) THEN
        ALTER TABLE campaign_publishers
            ADD CONSTRAINT fk_campaign_publishers_campaign 
            FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_campaign_publishers_publisher'
        AND t.relname = 'campaign_publishers'
    ) THEN
        ALTER TABLE campaign_publishers
            ADD CONSTRAINT fk_campaign_publishers_publisher 
            FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_campaign_locals_campaign'
        AND t.relname = 'campaign_locals'
    ) THEN
        ALTER TABLE campaign_locals
            ADD CONSTRAINT fk_campaign_locals_campaign 
            FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_campaign_locals_local'
        AND t.relname = 'campaign_locals'
    ) THEN
        ALTER TABLE campaign_locals
            ADD CONSTRAINT fk_campaign_locals_local 
            FOREIGN KEY (local_id) REFERENCES locals(local_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- REMOVIDO: playlist_approvals não existe mais (playlists não requerem aprovação)

-- =============================================
-- FKs das tabelas de ANALYTICS
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_analytics_sessions_totem'
        AND t.relname = 'analytics_sessions'
    ) THEN
        ALTER TABLE analytics_sessions
            ADD CONSTRAINT fk_analytics_sessions_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_analytics_emotions_session'
        AND t.relname = 'analytics_emotions'
    ) THEN
        ALTER TABLE analytics_emotions
            ADD CONSTRAINT fk_analytics_emotions_session 
            FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_analytics_emotions_totem'
        AND t.relname = 'analytics_emotions'
    ) THEN
        ALTER TABLE analytics_emotions
            ADD CONSTRAINT fk_analytics_emotions_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_analytics_gestures_session'
        AND t.relname = 'analytics_gestures'
    ) THEN
        ALTER TABLE analytics_gestures
            ADD CONSTRAINT fk_analytics_gestures_session 
            FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_analytics_gestures_totem'
        AND t.relname = 'analytics_gestures'
    ) THEN
        ALTER TABLE analytics_gestures
            ADD CONSTRAINT fk_analytics_gestures_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_execution_logs_totem'
        AND t.relname = 'execution_logs'
    ) THEN
        ALTER TABLE execution_logs
            ADD CONSTRAINT fk_execution_logs_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_execution_logs_campaign'
        AND t.relname = 'execution_logs'
    ) THEN
        ALTER TABLE execution_logs
            ADD CONSTRAINT fk_execution_logs_campaign 
            FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_execution_logs_playlist'
        AND t.relname = 'execution_logs'
    ) THEN
        ALTER TABLE execution_logs
            ADD CONSTRAINT fk_execution_logs_playlist 
            FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_execution_logs_media'
        AND t.relname = 'execution_logs'
    ) THEN
        ALTER TABLE execution_logs
            ADD CONSTRAINT fk_execution_logs_media 
            FOREIGN KEY (media_id) REFERENCES medias(media_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_execution_logs_publisher'
        AND t.relname = 'execution_logs'
    ) THEN
        ALTER TABLE execution_logs
            ADD CONSTRAINT fk_execution_logs_publisher 
            FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_execution_logs_subscriber'
        AND t.relname = 'execution_logs'
    ) THEN
        ALTER TABLE execution_logs
            ADD CONSTRAINT fk_execution_logs_subscriber 
            FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================
-- FKs da tabela TOTEM_PLAYLISTS
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_totem_playlists_totem'
        AND t.relname = 'totem_playlists'
    ) THEN
        ALTER TABLE totem_playlists
            ADD CONSTRAINT fk_totem_playlists_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    -- Criar foreign key para smart_tv_id apenas se a coluna existir
    -- Usar EXCEPTION para capturar erro caso a coluna não exista
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public'
        AND c.conname = 'fk_totem_playlists_smart_tv'
        AND t.relname = 'totem_playlists'
    ) THEN
        BEGIN
            ALTER TABLE totem_playlists
                ADD CONSTRAINT fk_totem_playlists_smart_tv 
                FOREIGN KEY (smart_tv_id) REFERENCES smart_tvs(smart_tv_id) 
                ON DELETE CASCADE;
        EXCEPTION
            WHEN SQLSTATE '42703' THEN
                -- Coluna smart_tv_id não existe (SQLSTATE 42703 = undefined_column)
                -- Ignorar silenciosamente
                NULL;
            WHEN OTHERS THEN
                -- Outros erros: mostrar NOTICE mas não falhar
                RAISE NOTICE 'Aviso ao criar foreign key fk_totem_playlists_smart_tv: %', SQLERRM;
        END;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_totem_playlists_publisher'
        AND t.relname = 'totem_playlists'
    ) THEN
        ALTER TABLE totem_playlists
            ADD CONSTRAINT fk_totem_playlists_publisher 
            FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- FKs da tabela TOTEM_PLAYLIST_ITEMS
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_totem_playlist_items_playlist'
        AND t.relname = 'totem_playlist_items'
    ) THEN
        ALTER TABLE totem_playlist_items
            ADD CONSTRAINT fk_totem_playlist_items_playlist 
            FOREIGN KEY (totem_playlist_id) REFERENCES totem_playlists(totem_playlist_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_totem_playlist_items_media'
        AND t.relname = 'totem_playlist_items'
    ) THEN
        ALTER TABLE totem_playlist_items
            ADD CONSTRAINT fk_totem_playlist_items_media 
            FOREIGN KEY (media_id) REFERENCES medias(media_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_totem_playlist_items_campaign'
        AND t.relname = 'totem_playlist_items'
    ) THEN
        ALTER TABLE totem_playlist_items
            ADD CONSTRAINT fk_totem_playlist_items_campaign 
            FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_totem_playlist_items_subscriber'
        AND t.relname = 'totem_playlist_items'
    ) THEN
        ALTER TABLE totem_playlist_items
            ADD CONSTRAINT fk_totem_playlist_items_subscriber 
            FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_totem_playlist_items_publisher'
        AND t.relname = 'totem_playlist_items'
    ) THEN
        ALTER TABLE totem_playlist_items
            ADD CONSTRAINT fk_totem_playlist_items_publisher 
            FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- FKs da tabela TOTEM_PLAYLIST_GENERATION_LOG
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_totem_playlist_gen_log_totem'
        AND t.relname = 'totem_playlist_generation_log'
    ) THEN
        ALTER TABLE totem_playlist_generation_log
            ADD CONSTRAINT fk_totem_playlist_gen_log_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_totem_playlist_gen_log_playlist'
        AND t.relname = 'totem_playlist_generation_log'
    ) THEN
        ALTER TABLE totem_playlist_generation_log
            ADD CONSTRAINT fk_totem_playlist_gen_log_playlist 
            FOREIGN KEY (totem_playlist_id) REFERENCES totem_playlists(totem_playlist_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_totem_playlist_gen_log_publisher'
        AND t.relname = 'totem_playlist_generation_log'
    ) THEN
        ALTER TABLE totem_playlist_generation_log
            ADD CONSTRAINT fk_totem_playlist_gen_log_publisher 
            FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- FKs das tabelas de ML/AI
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_totem_ml_config_totem'
        AND t.relname = 'totem_ml_config'
    ) THEN
        ALTER TABLE totem_ml_config
            ADD CONSTRAINT fk_totem_ml_config_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_emotion_data_totem'
        AND t.relname = 'emotion_data'
    ) THEN
        ALTER TABLE emotion_data
            ADD CONSTRAINT fk_emotion_data_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_gesture_data_totem'
        AND t.relname = 'gesture_data'
    ) THEN
        ALTER TABLE gesture_data
            ADD CONSTRAINT fk_gesture_data_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_behavior_data_totem'
        AND t.relname = 'behavior_data'
    ) THEN
        ALTER TABLE behavior_data
            ADD CONSTRAINT fk_behavior_data_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_recognized_persons_totem'
        AND t.relname = 'recognized_persons'
    ) THEN
        ALTER TABLE recognized_persons
            ADD CONSTRAINT fk_recognized_persons_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_interaction_logs_totem'
        AND t.relname = 'interaction_logs'
    ) THEN
        ALTER TABLE interaction_logs
            ADD CONSTRAINT fk_interaction_logs_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_interaction_logs_tag'
        AND t.relname = 'interaction_logs'
    ) THEN
        ALTER TABLE interaction_logs
            ADD CONSTRAINT fk_interaction_logs_tag 
            FOREIGN KEY (tag_id) REFERENCES tags(tag_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_interaction_logs_person'
        AND t.relname = 'interaction_logs'
    ) THEN
        ALTER TABLE interaction_logs
            ADD CONSTRAINT fk_interaction_logs_person 
            FOREIGN KEY (person_id) REFERENCES recognized_persons(person_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_tags_subscriber'
        AND t.relname = 'tags'
    ) THEN
        ALTER TABLE tags
            ADD CONSTRAINT fk_tags_subscriber 
            FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_tags_publisher'
        AND t.relname = 'tags'
    ) THEN
        ALTER TABLE tags
            ADD CONSTRAINT fk_tags_publisher 
            FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================
-- FKs das tabelas de CONTROLE REMOTO
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_remote_commands_totem'
        AND t.relname = 'remote_commands'
    ) THEN
        ALTER TABLE remote_commands
            ADD CONSTRAINT fk_remote_commands_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_remote_commands_user'
        AND t.relname = 'remote_commands'
    ) THEN
        ALTER TABLE remote_commands
            ADD CONSTRAINT fk_remote_commands_user 
            FOREIGN KEY (user_id) REFERENCES users(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================
-- FKs das tabelas de OTA
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_ota_updates_created_by'
        AND t.relname = 'ota_updates'
    ) THEN
        ALTER TABLE ota_updates
            ADD CONSTRAINT fk_ota_updates_created_by 
            FOREIGN KEY (created_by) REFERENCES users(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_totem_update_status_ota'
        AND t.relname = 'totem_update_status'
    ) THEN
        ALTER TABLE totem_update_status
            ADD CONSTRAINT fk_totem_update_status_ota 
            FOREIGN KEY (ota_update_id) REFERENCES ota_updates(id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_totem_update_status_totem'
        AND t.relname = 'totem_update_status'
    ) THEN
        ALTER TABLE totem_update_status
            ADD CONSTRAINT fk_totem_update_status_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- FKs das tabelas SMARTDISPLAYFX
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_fx_totem_sites_totem'
        AND t.relname = 'fx_totem_sites'
    ) THEN
        ALTER TABLE fx_totem_sites
            ADD CONSTRAINT fk_fx_totem_sites_totem 
            FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_fx_totem_sites_site'
        AND t.relname = 'fx_totem_sites'
    ) THEN
        ALTER TABLE fx_totem_sites
            ADD CONSTRAINT fk_fx_totem_sites_site 
            FOREIGN KEY (site_id) REFERENCES fx_sites(site_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- FKs das tabelas de AUDITORIA
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_audit_logs_user'
        AND t.relname = 'audit_logs'
    ) THEN
        ALTER TABLE audit_logs
            ADD CONSTRAINT fk_audit_logs_user 
            FOREIGN KEY (user_id) REFERENCES users(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_audit_logs_publisher'
        AND t.relname = 'audit_logs'
    ) THEN
        ALTER TABLE audit_logs
            ADD CONSTRAINT fk_audit_logs_publisher 
            FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_audit_logs_subscriber'
        AND t.relname = 'audit_logs'
    ) THEN
        ALTER TABLE audit_logs
            ADD CONSTRAINT fk_audit_logs_subscriber 
            FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_user_two_factor_user'
        AND t.relname = 'user_two_factor'
    ) THEN
        ALTER TABLE user_two_factor
            ADD CONSTRAINT fk_user_two_factor_user 
            FOREIGN KEY (user_id) REFERENCES users(id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_two_factor_attempts_user'
        AND t.relname = 'two_factor_attempts'
    ) THEN
        ALTER TABLE two_factor_attempts
            ADD CONSTRAINT fk_two_factor_attempts_user 
            FOREIGN KEY (user_id) REFERENCES users(id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_password_reset_tokens_user'
        AND t.relname = 'password_reset_tokens'
    ) THEN
        ALTER TABLE password_reset_tokens
            ADD CONSTRAINT fk_password_reset_tokens_user 
            FOREIGN KEY (user_id) REFERENCES users(id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- FKs das tabelas de RELATÓRIOS
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_reports_created_by'
        AND t.relname = 'reports'
    ) THEN
        ALTER TABLE reports
            ADD CONSTRAINT fk_reports_created_by 
            FOREIGN KEY (created_by) REFERENCES users(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_report_templates_created_by'
        AND t.relname = 'report_templates'
    ) THEN
        ALTER TABLE report_templates
            ADD CONSTRAINT fk_report_templates_created_by 
            FOREIGN KEY (created_by) REFERENCES users(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================
-- FKs das tabelas de AGENDAMENTO
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_advanced_schedules_created_by'
        AND t.relname = 'advanced_schedules'
    ) THEN
        ALTER TABLE advanced_schedules
            ADD CONSTRAINT fk_advanced_schedules_created_by 
            FOREIGN KEY (created_by) REFERENCES users(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================
-- FKs das tabelas de QR CODES E LINKS
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_qr_codes_campaign'
        AND t.relname = 'qr_codes'
    ) THEN
        ALTER TABLE qr_codes
            ADD CONSTRAINT fk_qr_codes_campaign 
            FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_short_links_campaign'
        AND t.relname = 'short_links'
    ) THEN
        ALTER TABLE short_links
            ADD CONSTRAINT fk_short_links_campaign 
            FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- FKs das tabelas de UI
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_dashboard_layouts_user'
        AND t.relname = 'dashboard_layouts'
    ) THEN
        ALTER TABLE dashboard_layouts
            ADD CONSTRAINT fk_dashboard_layouts_user 
            FOREIGN KEY (user_id) REFERENCES users(id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- FKs das tabelas de BACKUP
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_backups_created_by'
        AND t.relname = 'backups'
    ) THEN
        ALTER TABLE backups
            ADD CONSTRAINT fk_backups_created_by 
            FOREIGN KEY (created_by) REFERENCES users(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================
-- FKs das tabelas STRIPE
-- =============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_stripe_customers_subscriber'
        AND t.relname = 'stripe_customers'
    ) THEN
        ALTER TABLE stripe_customers
            ADD CONSTRAINT fk_stripe_customers_subscriber 
            FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_stripe_customers_publisher'
        AND t.relname = 'stripe_customers'
    ) THEN
        ALTER TABLE stripe_customers
            ADD CONSTRAINT fk_stripe_customers_publisher 
            FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================
-- FKs das tabelas PLAN_PUBLISHER_ACCESS e SUBSCRIBER_PUBLISHER_ACCESS
-- =============================================

-- FK para plan_publisher_access.plan_id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_plan_publisher_access_plan'
        AND t.relname = 'plan_publisher_access'
    ) THEN
        ALTER TABLE plan_publisher_access
            ADD CONSTRAINT fk_plan_publisher_access_plan 
            FOREIGN KEY (plan_id) REFERENCES plans(plan_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- FK para plan_publisher_access.publisher_id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_plan_publisher_access_publisher'
        AND t.relname = 'plan_publisher_access'
    ) THEN
        ALTER TABLE plan_publisher_access
            ADD CONSTRAINT fk_plan_publisher_access_publisher 
            FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- FK para subscriber_publisher_access.subscriber_id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_subscriber_publisher_access_subscriber'
        AND t.relname = 'subscriber_publisher_access'
    ) THEN
        ALTER TABLE subscriber_publisher_access
            ADD CONSTRAINT fk_subscriber_publisher_access_subscriber 
            FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- FK para subscriber_publisher_access.publisher_id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_subscriber_publisher_access_publisher'
        AND t.relname = 'subscriber_publisher_access'
    ) THEN
        ALTER TABLE subscriber_publisher_access
            ADD CONSTRAINT fk_subscriber_publisher_access_publisher 
            FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- FK para subscriber_publisher_access.contract_id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_subscriber_publisher_access_contract'
        AND t.relname = 'subscriber_publisher_access'
    ) THEN
        ALTER TABLE subscriber_publisher_access
            ADD CONSTRAINT fk_subscriber_publisher_access_contract 
            FOREIGN KEY (contract_id) REFERENCES subscriber_contracts(contract_id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- FK para subscriber_publisher_access.plan_id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_subscriber_publisher_access_plan'
        AND t.relname = 'subscriber_publisher_access'
    ) THEN
        ALTER TABLE subscriber_publisher_access
            ADD CONSTRAINT fk_subscriber_publisher_access_plan 
            FOREIGN KEY (plan_id) REFERENCES plans(plan_id) 
            ON DELETE SET NULL;
    END IF;
END $$;

-- FK para subscriber_publisher_access.granted_by
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'fk_subscriber_publisher_access_granted_by'
        AND t.relname = 'subscriber_publisher_access'
    ) THEN
        ALTER TABLE subscriber_publisher_access
            ADD CONSTRAINT fk_subscriber_publisher_access_granted_by 
            FOREIGN KEY (granted_by) REFERENCES users(id) 
            ON DELETE SET NULL;
    END IF;
END $$;

