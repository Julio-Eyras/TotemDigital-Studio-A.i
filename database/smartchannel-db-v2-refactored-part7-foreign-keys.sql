-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 7: Foreign Keys (Todas as FKs em ordem)
-- =============================================

-- =============================================
-- FKs da tabela USERS
-- =============================================

ALTER TABLE users
    ADD CONSTRAINT fk_users_publisher 
    FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
    ON DELETE SET NULL;

-- =============================================
-- FKs da tabela LOCALS
-- =============================================

ALTER TABLE locals
    ADD CONSTRAINT fk_locals_publisher 
    FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
    ON DELETE CASCADE;

-- =============================================
-- FKs da tabela TOTEMS
-- =============================================

ALTER TABLE totems
    ADD CONSTRAINT fk_totems_local 
    FOREIGN KEY (local_id) REFERENCES locals(local_id) 
    ON DELETE CASCADE;

-- =============================================
-- FKs da tabela SMART_TVS
-- =============================================

ALTER TABLE smart_tvs
    ADD CONSTRAINT fk_smart_tvs_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

-- =============================================
-- FKs da tabela CAMPAIGNS
-- =============================================

ALTER TABLE campaigns
    ADD CONSTRAINT fk_campaigns_subscriber 
    FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
    ON DELETE CASCADE;

-- =============================================
-- FKs da tabela MEDIAS
-- =============================================

ALTER TABLE medias
    ADD CONSTRAINT fk_medias_subscriber 
    FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
    ON DELETE CASCADE;

ALTER TABLE medias
    ADD CONSTRAINT fk_medias_approved_by 
    FOREIGN KEY (approved_by) REFERENCES users(id) 
    ON DELETE SET NULL;

-- =============================================
-- FKs da tabela PLAYLISTS
-- =============================================
-- REMOVIDO: fk_playlists_totem - totem_id foi removido de playlists
-- REMOVIDO: fk_playlists_campaign - campaign_id foi removido de playlists
-- REMOVIDO: fk_playlists_publisher - publisher_id foi removido de playlists
-- Playlists agora pertencem apenas ao subscriber que as criou
-- Relacionamento com campanhas é feito via campaign_playlists (N:M)

ALTER TABLE playlists
    ADD CONSTRAINT fk_playlists_subscriber 
    FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
    ON DELETE CASCADE;

-- =============================================
-- FKs da tabela PLAYLIST_ITEMS
-- =============================================

ALTER TABLE playlist_items
    ADD CONSTRAINT fk_playlist_items_playlist 
    FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) 
    ON DELETE CASCADE;

ALTER TABLE playlist_items
    ADD CONSTRAINT fk_playlist_items_media 
    FOREIGN KEY (media_id) REFERENCES medias(media_id) 
    ON DELETE CASCADE;

-- =============================================
-- FKs da tabela SUBSCRIPTIONS
-- =============================================

ALTER TABLE subscriptions
    ADD CONSTRAINT fk_subscriptions_publisher 
    FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
    ON DELETE CASCADE;

ALTER TABLE subscriptions
    ADD CONSTRAINT fk_subscriptions_plan 
    FOREIGN KEY (plan_id) REFERENCES plans(plan_id) 
    ON DELETE RESTRICT;

-- =============================================
-- FKs das tabelas de BILLING
-- =============================================

ALTER TABLE subscriber_billing
    ADD CONSTRAINT fk_subscriber_billing_subscriber 
    FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
    ON DELETE CASCADE;

ALTER TABLE subscriber_billing
    ADD CONSTRAINT fk_subscriber_billing_campaign 
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
    ON DELETE SET NULL;

ALTER TABLE publisher_billing
    ADD CONSTRAINT fk_publisher_billing_publisher 
    FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
    ON DELETE CASCADE;

ALTER TABLE publisher_billing
    ADD CONSTRAINT fk_publisher_billing_campaign 
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
    ON DELETE SET NULL;

ALTER TABLE publisher_billing
    ADD CONSTRAINT fk_publisher_billing_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE SET NULL;

ALTER TABLE publisher_billing
    ADD CONSTRAINT fk_publisher_billing_subscription 
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(subscription_id) 
    ON DELETE SET NULL;

ALTER TABLE publisher_billing
    ADD CONSTRAINT fk_publisher_billing_approved_by 
    FOREIGN KEY (approved_by) REFERENCES users(id) 
    ON DELETE SET NULL;

-- =============================================
-- FKs das tabelas de CONTRATOS
-- =============================================

ALTER TABLE subscriber_contracts
    ADD CONSTRAINT fk_subscriber_contracts_subscriber 
    FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
    ON DELETE CASCADE;

ALTER TABLE subscriber_contracts
    ADD CONSTRAINT fk_subscriber_contracts_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) 
    ON DELETE SET NULL;

ALTER TABLE publisher_contracts
    ADD CONSTRAINT fk_publisher_contracts_publisher 
    FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
    ON DELETE CASCADE;

ALTER TABLE publisher_contracts
    ADD CONSTRAINT fk_publisher_contracts_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) 
    ON DELETE SET NULL;

-- =============================================
-- FKs das tabelas de RELACIONAMENTO N:M
-- =============================================

ALTER TABLE user_roles
    ADD CONSTRAINT fk_user_roles_user 
    FOREIGN KEY (user_id) REFERENCES users(id) 
    ON DELETE CASCADE;

ALTER TABLE user_roles
    ADD CONSTRAINT fk_user_roles_role 
    FOREIGN KEY (role_id) REFERENCES roles(role_id) 
    ON DELETE CASCADE;

ALTER TABLE user_roles
    ADD CONSTRAINT fk_user_roles_assigned_by 
    FOREIGN KEY (assigned_by) REFERENCES users(id) 
    ON DELETE SET NULL;

ALTER TABLE role_permissions
    ADD CONSTRAINT fk_role_permissions_role 
    FOREIGN KEY (role_id) REFERENCES roles(role_id) 
    ON DELETE CASCADE;

ALTER TABLE role_permissions
    ADD CONSTRAINT fk_role_permissions_permission 
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) 
    ON DELETE CASCADE;

ALTER TABLE campaign_playlists
    ADD CONSTRAINT fk_campaign_playlists_campaign 
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
    ON DELETE CASCADE;

ALTER TABLE campaign_playlists
    ADD CONSTRAINT fk_campaign_playlists_playlist 
    FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) 
    ON DELETE CASCADE;

ALTER TABLE campaign_totems
    ADD CONSTRAINT fk_campaign_totems_campaign 
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
    ON DELETE CASCADE;

ALTER TABLE campaign_totems
    ADD CONSTRAINT fk_campaign_totems_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

ALTER TABLE campaign_publishers
    ADD CONSTRAINT fk_campaign_publishers_campaign 
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
    ON DELETE CASCADE;

ALTER TABLE campaign_publishers
    ADD CONSTRAINT fk_campaign_publishers_publisher 
    FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
    ON DELETE CASCADE;

ALTER TABLE campaign_locals
    ADD CONSTRAINT fk_campaign_locals_campaign 
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
    ON DELETE CASCADE;

ALTER TABLE campaign_locals
    ADD CONSTRAINT fk_campaign_locals_local 
    FOREIGN KEY (local_id) REFERENCES locals(local_id) 
    ON DELETE CASCADE;

-- REMOVIDO: playlist_approvals não existe mais (playlists não requerem aprovação)

-- =============================================
-- FKs das tabelas de ANALYTICS
-- =============================================

ALTER TABLE analytics_sessions
    ADD CONSTRAINT fk_analytics_sessions_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

ALTER TABLE analytics_emotions
    ADD CONSTRAINT fk_analytics_emotions_session 
    FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id) 
    ON DELETE CASCADE;

ALTER TABLE analytics_emotions
    ADD CONSTRAINT fk_analytics_emotions_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

ALTER TABLE analytics_gestures
    ADD CONSTRAINT fk_analytics_gestures_session 
    FOREIGN KEY (session_id) REFERENCES analytics_sessions(session_id) 
    ON DELETE CASCADE;

ALTER TABLE analytics_gestures
    ADD CONSTRAINT fk_analytics_gestures_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

ALTER TABLE execution_logs
    ADD CONSTRAINT fk_execution_logs_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

ALTER TABLE execution_logs
    ADD CONSTRAINT fk_execution_logs_campaign 
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
    ON DELETE SET NULL;

ALTER TABLE execution_logs
    ADD CONSTRAINT fk_execution_logs_playlist 
    FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) 
    ON DELETE SET NULL;

ALTER TABLE execution_logs
    ADD CONSTRAINT fk_execution_logs_media 
    FOREIGN KEY (media_id) REFERENCES medias(media_id) 
    ON DELETE SET NULL;

ALTER TABLE execution_logs
    ADD CONSTRAINT fk_execution_logs_publisher 
    FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
    ON DELETE SET NULL;

ALTER TABLE execution_logs
    ADD CONSTRAINT fk_execution_logs_subscriber 
    FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
    ON DELETE SET NULL;

-- =============================================
-- FKs das tabelas de ML/AI
-- =============================================

ALTER TABLE totem_ml_config
    ADD CONSTRAINT fk_totem_ml_config_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

ALTER TABLE emotion_data
    ADD CONSTRAINT fk_emotion_data_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

ALTER TABLE gesture_data
    ADD CONSTRAINT fk_gesture_data_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

ALTER TABLE behavior_data
    ADD CONSTRAINT fk_behavior_data_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

ALTER TABLE recognized_persons
    ADD CONSTRAINT fk_recognized_persons_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

ALTER TABLE interaction_logs
    ADD CONSTRAINT fk_interaction_logs_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

ALTER TABLE interaction_logs
    ADD CONSTRAINT fk_interaction_logs_tag 
    FOREIGN KEY (tag_id) REFERENCES tags(tag_id) 
    ON DELETE SET NULL;

ALTER TABLE interaction_logs
    ADD CONSTRAINT fk_interaction_logs_person 
    FOREIGN KEY (person_id) REFERENCES recognized_persons(person_id) 
    ON DELETE SET NULL;

ALTER TABLE tags
    ADD CONSTRAINT fk_tags_subscriber 
    FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
    ON DELETE SET NULL;

ALTER TABLE tags
    ADD CONSTRAINT fk_tags_publisher 
    FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
    ON DELETE SET NULL;

-- =============================================
-- FKs das tabelas de CONTROLE REMOTO
-- =============================================

ALTER TABLE remote_commands
    ADD CONSTRAINT fk_remote_commands_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

ALTER TABLE remote_commands
    ADD CONSTRAINT fk_remote_commands_user 
    FOREIGN KEY (user_id) REFERENCES users(id) 
    ON DELETE SET NULL;

-- =============================================
-- FKs das tabelas de OTA
-- =============================================

ALTER TABLE ota_updates
    ADD CONSTRAINT fk_ota_updates_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) 
    ON DELETE SET NULL;

ALTER TABLE totem_update_status
    ADD CONSTRAINT fk_totem_update_status_ota 
    FOREIGN KEY (ota_update_id) REFERENCES ota_updates(id) 
    ON DELETE CASCADE;

ALTER TABLE totem_update_status
    ADD CONSTRAINT fk_totem_update_status_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

-- =============================================
-- FKs das tabelas SMARTDISPLAYFX
-- =============================================

ALTER TABLE fx_totem_sites
    ADD CONSTRAINT fk_fx_totem_sites_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

ALTER TABLE fx_totem_sites
    ADD CONSTRAINT fk_fx_totem_sites_site 
    FOREIGN KEY (site_id) REFERENCES fx_sites(site_id) 
    ON DELETE CASCADE;

-- =============================================
-- FKs das tabelas de AUDITORIA
-- =============================================

ALTER TABLE audit_logs
    ADD CONSTRAINT fk_audit_logs_user 
    FOREIGN KEY (user_id) REFERENCES users(id) 
    ON DELETE SET NULL;

ALTER TABLE audit_logs
    ADD CONSTRAINT fk_audit_logs_publisher 
    FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
    ON DELETE SET NULL;

ALTER TABLE audit_logs
    ADD CONSTRAINT fk_audit_logs_subscriber 
    FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
    ON DELETE SET NULL;

ALTER TABLE user_two_factor
    ADD CONSTRAINT fk_user_two_factor_user 
    FOREIGN KEY (user_id) REFERENCES users(id) 
    ON DELETE CASCADE;

ALTER TABLE two_factor_attempts
    ADD CONSTRAINT fk_two_factor_attempts_user 
    FOREIGN KEY (user_id) REFERENCES users(id) 
    ON DELETE CASCADE;

ALTER TABLE password_reset_tokens
    ADD CONSTRAINT fk_password_reset_tokens_user 
    FOREIGN KEY (user_id) REFERENCES users(id) 
    ON DELETE CASCADE;

-- =============================================
-- FKs das tabelas de RELATÓRIOS
-- =============================================

ALTER TABLE reports
    ADD CONSTRAINT fk_reports_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) 
    ON DELETE SET NULL;

ALTER TABLE report_templates
    ADD CONSTRAINT fk_report_templates_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) 
    ON DELETE SET NULL;

-- =============================================
-- FKs das tabelas de AGENDAMENTO
-- =============================================

ALTER TABLE advanced_schedules
    ADD CONSTRAINT fk_advanced_schedules_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) 
    ON DELETE SET NULL;

-- =============================================
-- FKs das tabelas de QR CODES E LINKS
-- =============================================

ALTER TABLE qr_codes
    ADD CONSTRAINT fk_qr_codes_campaign 
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
    ON DELETE CASCADE;

ALTER TABLE short_links
    ADD CONSTRAINT fk_short_links_campaign 
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
    ON DELETE CASCADE;

-- =============================================
-- FKs das tabelas de UI
-- =============================================

ALTER TABLE dashboard_layouts
    ADD CONSTRAINT fk_dashboard_layouts_user 
    FOREIGN KEY (user_id) REFERENCES users(id) 
    ON DELETE CASCADE;

-- =============================================
-- FKs das tabelas de BACKUP
-- =============================================

ALTER TABLE backups
    ADD CONSTRAINT fk_backups_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) 
    ON DELETE SET NULL;

-- =============================================
-- FKs das tabelas STRIPE
-- =============================================

ALTER TABLE stripe_customers
    ADD CONSTRAINT fk_stripe_customers_subscriber 
    FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
    ON DELETE SET NULL;

ALTER TABLE stripe_customers
    ADD CONSTRAINT fk_stripe_customers_publisher 
    FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
    ON DELETE SET NULL;

