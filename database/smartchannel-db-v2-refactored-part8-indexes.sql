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
CREATE INDEX IF NOT EXISTS idx_publishers_active ON publishers(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_publishers_client_type ON publishers(client_type);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_publisher ON users(publisher_id) WHERE publisher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(is_tenant_user) WHERE is_tenant_user = true;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);

-- Locals
CREATE INDEX IF NOT EXISTS idx_locals_publisher ON locals(publisher_id);
CREATE INDEX IF NOT EXISTS idx_locals_active ON locals(is_active) WHERE is_active = true;

-- Totems
CREATE INDEX IF NOT EXISTS idx_totems_local ON totems(local_id);
CREATE INDEX IF NOT EXISTS idx_totems_identifier ON totems(identifier);
CREATE INDEX IF NOT EXISTS idx_totems_status ON totems(status);
CREATE INDEX IF NOT EXISTS idx_totems_heartbeat ON totems(last_heartbeat) WHERE status = 'online';
CREATE INDEX IF NOT EXISTS idx_totems_active ON totems(is_active) WHERE is_active = true;

-- Smart TVs
CREATE INDEX IF NOT EXISTS idx_smart_tvs_totem ON smart_tvs(totem_id);
CREATE INDEX IF NOT EXISTS idx_smart_tvs_identifier ON smart_tvs(identifier);
CREATE INDEX IF NOT EXISTS idx_smart_tvs_status ON smart_tvs(status);

-- Campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_subscriber ON campaigns(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_campaigns_pending_approval ON campaigns(status) WHERE status = 'pending_approval';

-- Medias
CREATE INDEX IF NOT EXISTS idx_medias_subscriber ON medias(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_medias_status ON medias(status);
CREATE INDEX IF NOT EXISTS idx_medias_approval_status ON medias(approval_status) WHERE approval_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_medias_active ON medias(is_active) WHERE is_active = true;

-- Playlists
-- REMOVIDO: idx_playlists_totem - totem_id foi removido de playlists (relacionamento via campaign_totems)
-- REMOVIDO: idx_playlists_campaign - campaign_id foi removido de playlists (relacionamento via campaign_playlists)
CREATE INDEX IF NOT EXISTS idx_playlists_subscriber ON playlists(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_playlists_active ON playlists(is_active) WHERE is_active = true;

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

CREATE INDEX IF NOT EXISTS idx_subscriber_contracts_subscriber ON subscriber_contracts(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_contracts_status ON subscriber_contracts(status);
CREATE INDEX IF NOT EXISTS idx_publisher_contracts_publisher ON publisher_contracts(publisher_id);
CREATE INDEX IF NOT EXISTS idx_publisher_contracts_status ON publisher_contracts(status);

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
-- Índice parcial para logs recentes (últimos 30 dias)
CREATE INDEX IF NOT EXISTS idx_execution_logs_recent ON execution_logs(timestamp DESC) 
    WHERE timestamp > NOW() - INTERVAL '30 days';

-- Analytics Sessions
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_totem ON analytics_sessions(totem_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_recent ON analytics_sessions(start_time DESC) 
    WHERE start_time > NOW() - INTERVAL '7 days';

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
CREATE INDEX IF NOT EXISTS idx_remote_commands_user ON remote_commands(user_id, created_at DESC);

-- =============================================
-- ÍNDICES DE OTA
-- =============================================

CREATE INDEX IF NOT EXISTS idx_ota_updates_platform_status ON ota_updates(platform, status);
CREATE INDEX IF NOT EXISTS idx_totem_update_status_ota ON totem_update_status(ota_update_id);
CREATE INDEX IF NOT EXISTS idx_totem_update_status_totem ON totem_update_status(totem_id, status);

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

