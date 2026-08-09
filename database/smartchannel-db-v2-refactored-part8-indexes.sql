-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 8: Índices (Incluindo Parciais e Compostos)
-- =============================================

-- =============================================
-- ÍNDICES BASE - CHAVES ÚNICAS E BUSCA
-- =============================================

-- Subscribers
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(is_active) WHERE is_active = true;

-- Publishers
CREATE INDEX IF NOT EXISTS idx_publishers_active ON publishers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_publishers_client_type ON publishers(client_type);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_publisher ON users(publisher_id) WHERE publisher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_subscriber ON users(subscriber_id) WHERE subscriber_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(is_tenant_user) WHERE is_tenant_user = true;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);

-- Locals
CREATE INDEX IF NOT EXISTS idx_locals_publisher ON locals(publisher_id) WHERE publisher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_locals_contract ON locals(created_via_contract_id) WHERE created_via_contract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_locals_active ON locals(is_active) WHERE is_active = true;

-- Totems
CREATE INDEX IF NOT EXISTS idx_totems_local ON totems(local_id);
CREATE INDEX IF NOT EXISTS idx_totems_contract ON totems(created_via_contract_id) WHERE created_via_contract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_totems_identifier ON totems(identifier);
CREATE INDEX IF NOT EXISTS idx_totems_status ON totems(status);
CREATE INDEX IF NOT EXISTS idx_totems_heartbeat ON totems(last_heartbeat) WHERE status = 'online';
CREATE INDEX IF NOT EXISTS idx_totems_active ON totems(is_active) WHERE is_active = true;

-- Smart TVs
CREATE INDEX IF NOT EXISTS idx_smart_tvs_totem ON smart_tvs(totem_id);
CREATE INDEX IF NOT EXISTS idx_smart_tvs_contract ON smart_tvs(created_via_contract_id) WHERE created_via_contract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_smart_tvs_identifier ON smart_tvs(identifier);
CREATE INDEX IF NOT EXISTS idx_smart_tvs_status ON smart_tvs(status);

-- Campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_subscriber ON campaigns(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_contract_id ON campaigns(contract_id) WHERE contract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_campaigns_pending_approval ON campaigns(status) WHERE status = 'pending_approval';

-- Medias
CREATE INDEX IF NOT EXISTS idx_medias_subscriber ON medias(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_medias_publisher ON medias(publisher_id) WHERE publisher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_medias_status ON medias(status);
CREATE INDEX IF NOT EXISTS idx_medias_approval_status ON medias(approval_status) WHERE approval_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_medias_active ON medias(is_active) WHERE is_active = true;

-- Playlists
-- REMOVIDO: idx_playlists_totem - totem_id foi removido de playlists (relacionamento via campaign_totems)
-- REMOVIDO: idx_playlists_campaign - campaign_id foi removido de playlists (relacionamento via campaign_playlists)
CREATE INDEX IF NOT EXISTS idx_playlists_subscriber ON playlists(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_playlists_active ON playlists(is_active) WHERE is_active = true;

-- Plans (compatibilidade: index para planos populares/padrão)
CREATE INDEX IF NOT EXISTS idx_plans_popular_default_active
ON plans (is_popular DESC, is_default DESC)
WHERE is_active = true;

-- =============================================
-- ÍNDICES DE BILLING
-- =============================================

-- Subscriber Billing
CREATE INDEX IF NOT EXISTS idx_subscriber_billing_subscriber ON subscriber_billing(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_billing_campaign ON subscriber_billing(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriber_billing_status ON subscriber_billing(payment_status);
CREATE INDEX IF NOT EXISTS idx_subscriber_billing_created ON subscriber_billing(created_at DESC);

-- Publisher Billing
CREATE INDEX IF NOT EXISTS idx_publisher_billing_publisher ON publisher_billing(publisher_id);
CREATE INDEX IF NOT EXISTS idx_publisher_billing_campaign ON publisher_billing(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_publisher_billing_status ON publisher_billing(payment_status);
CREATE INDEX IF NOT EXISTS idx_publisher_billing_direction ON publisher_billing(direction);
CREATE INDEX IF NOT EXISTS idx_publisher_billing_pending_payout ON publisher_billing(payment_status) 
    WHERE direction = 'outgoing' AND payment_status = 'pending_payout';
CREATE INDEX IF NOT EXISTS idx_publisher_billing_created ON publisher_billing(created_at DESC);

-- =============================================
-- ÍNDICES DE CONTRATOS
-- =============================================

CREATE INDEX IF NOT EXISTS idx_subscriber_contracts_subscriber ON subscriber_contracts(subscriber_id) WHERE subscriber_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriber_contracts_status ON subscriber_contracts(status);
CREATE INDEX IF NOT EXISTS idx_subscriber_contracts_plan ON subscriber_contracts(plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_publisher_contracts_publisher ON publisher_contracts(publisher_id) WHERE publisher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_publisher_contracts_status ON publisher_contracts(status);
-- Removed indexes on created_before_* (no longer used)

-- =============================================
-- ÍNDICES DE CONTROLE DE ACESSO SUBSCRIBER → PUBLISHER
-- =============================================

-- Plan Local Access (Compact)
CREATE INDEX IF NOT EXISTS idx_plan_local_access_plan
    ON plan_local_access(plan_id)
    WHERE is_allowed = true;

CREATE INDEX IF NOT EXISTS idx_plan_local_access_local
    ON plan_local_access(local_id)
    WHERE is_allowed = true;

-- Plan Publisher Access
CREATE INDEX IF NOT EXISTS idx_plan_publisher_access_plan 
    ON plan_publisher_access(plan_id) 
    WHERE is_allowed = true;

CREATE INDEX IF NOT EXISTS idx_plan_publisher_access_publisher 
    ON plan_publisher_access(publisher_id) 
    WHERE is_allowed = true;

-- Subscriber Publisher Access
CREATE INDEX IF NOT EXISTS idx_subscriber_publisher_access_subscriber 
    ON subscriber_publisher_access(subscriber_id, is_active) 
    WHERE is_active = true AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_subscriber_publisher_access_publisher 
    ON subscriber_publisher_access(publisher_id, is_active) 
    WHERE is_active = true AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_subscriber_publisher_access_contract 
    ON subscriber_publisher_access(contract_id) 
    WHERE contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriber_publisher_access_expires 
    ON subscriber_publisher_access(expires_at) 
    WHERE expires_at IS NOT NULL AND is_active = true;

-- Índice composto para validação rápida
CREATE INDEX IF NOT EXISTS idx_subscriber_publisher_access_lookup 
    ON subscriber_publisher_access(subscriber_id, publisher_id, is_active, expires_at) 
    WHERE is_active = true AND revoked_at IS NULL;

-- =============================================
-- ÍNDICES DE RELACIONAMENTO N:M
-- =============================================

CREATE INDEX IF NOT EXISTS idx_campaign_totems_campaign ON campaign_totems(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_totems_totem ON campaign_totems(totem_id);
CREATE INDEX IF NOT EXISTS idx_campaign_totems_active ON campaign_totems(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_campaign_totems_dates ON campaign_totems(start_date, end_date) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_campaign_publishers_campaign ON campaign_publishers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_publishers_publisher ON campaign_publishers(publisher_id);

CREATE INDEX IF NOT EXISTS idx_campaign_playlists_campaign ON campaign_playlists(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_playlists_playlist ON campaign_playlists(playlist_id);
CREATE INDEX IF NOT EXISTS idx_campaign_playlists_active ON campaign_playlists(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_campaign_medias_campaign ON campaign_medias(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_medias_media ON campaign_medias(media_id);
CREATE INDEX IF NOT EXISTS idx_campaign_medias_active ON campaign_medias(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_campaign_medias_order ON campaign_medias(campaign_id, order_index) WHERE is_active = true;

-- =============================================
-- ÍNDICES DE TOTEM_PLAYLISTS (Motor de Playlists)
-- =============================================

CREATE INDEX IF NOT EXISTS idx_totem_playlists_totem ON totem_playlists(totem_id);
-- Index para smart_tv_id (apenas se a coluna existir)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'totem_playlists' 
        AND column_name = 'smart_tv_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_totem_playlists_smart_tv ON totem_playlists(smart_tv_id) WHERE smart_tv_id IS NOT NULL;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_totem_playlists_publisher ON totem_playlists(publisher_id);
CREATE INDEX IF NOT EXISTS idx_totem_playlists_active ON totem_playlists(is_active, status) WHERE is_active = true AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_totem_playlists_hash ON totem_playlists(playlist_hash) WHERE playlist_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_totem_playlists_generated ON totem_playlists(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_totem_playlists_expires ON totem_playlists(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_totem_playlist_items_playlist ON totem_playlist_items(totem_playlist_id);
CREATE INDEX IF NOT EXISTS idx_totem_playlist_items_media ON totem_playlist_items(media_id);
CREATE INDEX IF NOT EXISTS idx_totem_playlist_items_campaign ON totem_playlist_items(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_totem_playlist_items_subscriber ON totem_playlist_items(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_totem_playlist_items_order ON totem_playlist_items(totem_playlist_id, order_index) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_totem_playlist_items_tier ON totem_playlist_items(commercial_tier) WHERE commercial_tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_totem_playlist_gen_log_totem ON totem_playlist_generation_log(totem_id);
CREATE INDEX IF NOT EXISTS idx_totem_playlist_gen_log_status ON totem_playlist_generation_log(status, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_totem_playlist_gen_log_playlist ON totem_playlist_generation_log(totem_playlist_id) WHERE totem_playlist_id IS NOT NULL;

-- =============================================
-- ÍNDICES DE ANALYTICS E LOGS (CRÍTICOS PARA PERFORMANCE)
-- =============================================

-- Execution Logs (Tabela grande - índices parciais importantes)
CREATE INDEX IF NOT EXISTS idx_execution_logs_totem_time ON execution_logs(totem_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_execution_logs_campaign_time ON execution_logs(campaign_id, timestamp DESC) 
    WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_execution_logs_publisher_time ON execution_logs(publisher_id, timestamp DESC) 
    WHERE publisher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_execution_logs_event_type ON execution_logs(event_type, timestamp DESC);
-- REMOVIDO: Índice parcial com NOW() não é permitido (função não é IMMUTABLE)
-- Para logs recentes, usar índice completo em timestamp DESC e filtrar na query
-- CREATE INDEX IF NOT EXISTS idx_execution_logs_recent ON execution_logs(timestamp DESC) 
--     WHERE timestamp > NOW() - INTERVAL '30 days';

-- Analytics Sessions
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_totem ON analytics_sessions(totem_id, start_time DESC);
-- REMOVIDO: Índice parcial com NOW() não é permitido (função não é IMMUTABLE)
-- Para sessões recentes, usar índice completo em start_time DESC e filtrar na query
-- CREATE INDEX IF NOT EXISTS idx_analytics_sessions_recent ON analytics_sessions(start_time DESC) 
--     WHERE start_time > NOW() - INTERVAL '7 days';

-- Analytics Emotions
CREATE INDEX IF NOT EXISTS idx_analytics_emotions_session ON analytics_emotions(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_emotions_totem_time ON analytics_emotions(totem_id, detected_at DESC);

-- Analytics Gestures
CREATE INDEX IF NOT EXISTS idx_analytics_gestures_session ON analytics_gestures(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_gestures_totem_time ON analytics_gestures(totem_id, detected_at DESC);

-- Event Logs
CREATE INDEX IF NOT EXISTS idx_event_logs_entity ON event_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_totem_time ON event_logs(totem_id, timestamp DESC) 
    WHERE totem_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_logs_severity_time ON event_logs(severity, timestamp DESC) 
    WHERE severity IN ('error', 'critical');

-- Dispatcher Logs
CREATE INDEX IF NOT EXISTS idx_dispatcher_log_totem_timestamp 
    ON dispatcher_log(totem_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_dispatcher_log_timestamp 
    ON dispatcher_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_dispatcher_log_campaign 
    ON dispatcher_log(selected_campaign_id) 
    WHERE selected_campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dispatcher_log_playlist 
    ON dispatcher_log(selected_playlist_id) 
    WHERE selected_playlist_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dispatcher_log_created_at 
    ON dispatcher_log(created_at DESC);

-- =============================================
-- Dispatcher Timeline (Tabular) - índices para UI/filters/group-by
-- =============================================

CREATE INDEX IF NOT EXISTS idx_dispatcher_decisions_time
    ON dispatcher_decisions(ref_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_dispatcher_decisions_totem_time
    ON dispatcher_decisions(totem_id, ref_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_dispatcher_decisions_publisher_time
    ON dispatcher_decisions(publisher_id, ref_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_dispatcher_decisions_status_time
    ON dispatcher_decisions(status, ref_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_dispatcher_decisions_mode_bucket
    ON dispatcher_decisions(decision_mode, bucket_start DESC);

CREATE INDEX IF NOT EXISTS idx_dispatcher_decisions_local_category
    ON dispatcher_decisions(local_category_segment)
    WHERE local_category_segment IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dispatcher_decisions_campaign_category
    ON dispatcher_decisions(dominant_campaign_category_segment)
    WHERE dominant_campaign_category_segment IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dispatcher_decision_campaigns_decision
    ON dispatcher_decision_campaigns(decision_id);

CREATE INDEX IF NOT EXISTS idx_dispatcher_decision_campaigns_campaign
    ON dispatcher_decision_campaigns(campaign_id);

CREATE INDEX IF NOT EXISTS idx_dispatcher_decision_campaigns_subscriber
    ON dispatcher_decision_campaigns(subscriber_id)
    WHERE subscriber_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dispatcher_decision_items_decision_order
    ON dispatcher_decision_items(decision_id, order_index);

CREATE INDEX IF NOT EXISTS idx_dispatcher_decision_items_playlist
    ON dispatcher_decision_items(playlist_id)
    WHERE playlist_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dispatcher_decision_items_media
    ON dispatcher_decision_items(media_id)
    WHERE media_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dispatcher_events_decision
    ON dispatcher_events(decision_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_dispatcher_events_totem_time
    ON dispatcher_events(totem_id, ts DESC)
    WHERE totem_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dispatcher_events_reason
    ON dispatcher_events(reason_code, ts DESC)
    WHERE reason_code IS NOT NULL;

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time ON audit_logs(user_id, timestamp DESC) 
    WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_publisher_time ON audit_logs(publisher_id, timestamp DESC) 
    WHERE publisher_id IS NOT NULL;

-- =============================================
-- ÍNDICES DE CONTROLE REMOTO
-- =============================================

CREATE INDEX IF NOT EXISTS idx_remote_commands_totem_status ON remote_commands(totem_id, status);
CREATE INDEX IF NOT EXISTS idx_remote_commands_pending ON remote_commands(status, created_at) 
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_remote_commands_delivery_lease
    ON remote_commands(totem_id, status, sent_at)
    WHERE status IN ('pending', 'sent');
CREATE INDEX IF NOT EXISTS idx_remote_commands_user ON remote_commands(user_id, created_at DESC);

-- =============================================
-- ÍNDICES DE OTA
-- =============================================

CREATE INDEX IF NOT EXISTS idx_ota_updates_platform_status ON ota_updates(platform, status);
CREATE INDEX IF NOT EXISTS idx_player_release_channels_designated
    ON player_release_channels(designated_update_id)
    WHERE designated_update_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_totem_update_status_ota ON totem_update_status(ota_update_id) WHERE ota_update_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_totem_update_status_totem ON totem_update_status(totem_id);
CREATE INDEX IF NOT EXISTS idx_totem_update_status_state ON totem_update_status(update_status);
CREATE INDEX IF NOT EXISTS idx_publish_templates_featured ON publish_templates(featured, featured_sort) WHERE featured = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_menu_categories_subscriber ON menu_categories(subscriber_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_menu_products_subscriber ON menu_products(subscriber_id, category_id, sort_order);

-- =============================================
-- ÍNDICES DE SUBSCRIPTIONS
-- =============================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_publisher ON subscriptions(publisher_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id) 
    WHERE stripe_subscription_id IS NOT NULL;

-- =============================================
-- ÍNDICES DE RELATÓRIOS
-- =============================================

CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);

-- =============================================
-- ÍNDICES ADICIONAIS PARA BUSCA E PERFORMANCE
-- =============================================

-- Playlist Items (ordem é importante)
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_order ON playlist_items(playlist_id, order_index);

-- QR Codes e Short Links
-- QR Codes
CREATE INDEX IF NOT EXISTS idx_qr_codes_campaign ON qr_codes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_code ON qr_codes(code);
CREATE INDEX IF NOT EXISTS idx_qr_codes_active ON qr_codes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_qr_codes_expires ON qr_codes(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qr_codes_type ON qr_codes(qr_type);
CREATE INDEX IF NOT EXISTS idx_short_links_campaign ON short_links(campaign_id);
CREATE INDEX IF NOT EXISTS idx_short_links_code ON short_links(short_code);

-- Tags
CREATE INDEX IF NOT EXISTS idx_tags_type_value ON tags(tag_type, tag_value);
CREATE INDEX IF NOT EXISTS idx_tags_subscriber ON tags(subscriber_id) WHERE subscriber_id IS NOT NULL;

-- Interaction Logs
CREATE INDEX IF NOT EXISTS idx_interaction_logs_totem_time ON interaction_logs(totem_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_tag ON interaction_logs(tag_id) WHERE tag_id IS NOT NULL;

-- Dashboard Layouts
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_user_id ON dashboard_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_is_default ON dashboard_layouts(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_is_shared ON dashboard_layouts(is_shared) WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_data ON dashboard_layouts USING GIN (layout_data);

