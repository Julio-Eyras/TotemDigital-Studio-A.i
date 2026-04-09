-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- PARTE 10: Views e Materialized Views
-- =============================================

-- =============================================
-- VIEW: Totens com informações de publisher
-- =============================================

CREATE OR REPLACE VIEW totems_with_publisher AS
SELECT 
    t.*,
    l.name as local_name,
    l.address as local_address,
    p.publisher_id,
    p.name as publisher_name,
    p.email as publisher_email
FROM totems t
JOIN locals l ON t.local_id = l.local_id
JOIN publishers p ON l.publisher_id = p.publisher_id;

COMMENT ON VIEW totems_with_publisher IS 'View denormalizada com informações completas de totem, local e publisher';

-- =============================================
-- VIEW: Campanhas com informações de subscriber
-- =============================================

CREATE OR REPLACE VIEW campaigns_with_subscriber AS
SELECT 
    c.*,
    s.name as subscriber_name,
    s.email as subscriber_email,
    s.phone as subscriber_phone
FROM campaigns c
JOIN subscribers s ON c.subscriber_id = s.subscriber_id;

COMMENT ON VIEW campaigns_with_subscriber IS 'View denormalizada com informações completas de campanha e subscriber';

-- =============================================
-- VIEW: Dispatcher Timeline (Tabular, pronta para UI)
-- =============================================

CREATE OR REPLACE VIEW v_dispatcher_timeline AS
SELECT
    d.decision_id,
    d.log_id,
    d.ref_timestamp,
    d.bucket_start,
    d.bucket_end,
    d.decision_mode,
    d.window_seconds,
    d.status,
    d.severity,
    d.has_error,
    d.execution_time_ms,
    d.from_cache,

    d.totem_id,
    t.identifier AS totem_identifier,
    t.name AS totem_name,

    d.publisher_id,
    p.name AS publisher_name,

    d.local_id,
    l.name AS local_name,
    d.local_category_segment,

    d.dominant_campaign_id,
    c.title AS dominant_campaign_title,
    d.dominant_campaign_category_segment,

    d.dominant_subscriber_id,
    s.name AS dominant_subscriber_name
FROM dispatcher_decisions d
JOIN totems t ON t.totem_id = d.totem_id
JOIN publishers p ON p.publisher_id = d.publisher_id
LEFT JOIN locals l ON l.local_id = d.local_id
LEFT JOIN campaigns c ON c.campaign_id = d.dominant_campaign_id
LEFT JOIN subscribers s ON s.subscriber_id = d.dominant_subscriber_id;

COMMENT ON VIEW v_dispatcher_timeline IS
    'Timeline tabular (indexável) de decisões do dispatcher. Fonte principal para UI de auditoria/traceability.';

-- =============================================
-- VIEW: Conteúdo agendado por Subscriber (campanhas → playlists → mídias)
-- =============================================
-- Objetivo: facilitar auditoria/BI e debugging do agendamento por subscriber.
-- - Expande alvos de campanha (totem direto e publisher/grupo)
-- - Expande playlists e mídias associadas (via campaign_playlists → playlist_items → medias)

CREATE OR REPLACE VIEW subscriber_scheduled_campaigns_playlists_medias AS
WITH campaign_targets AS (
    -- Campanhas diretas por TOTEM (campaign_totems sobrescreve janela/priority quando definido)
    SELECT
        c.subscriber_id,
        c.campaign_id,
        c.title AS campaign_title,
        c.status AS campaign_status,
        c.is_active AS campaign_is_active,
        COALESCE(ct.start_date, c.start_date) AS start_date,
        COALESCE(ct.end_date, c.end_date) AS end_date,
        COALESCE(ct.start_time, c.start_time) AS start_time,
        COALESCE(ct.end_time, c.end_time) AS end_time,
        COALESCE(ct.days_of_week, c.days_of_week) AS days_of_week,
        COALESCE(ct.priority, c.priority) AS effective_priority,
        'totem'::text AS target_type,
        ct.totem_id AS totem_id,
        NULL::integer AS publisher_id
    FROM campaigns c
    JOIN campaign_totems ct
      ON c.campaign_id = ct.campaign_id
     AND ct.is_active = true
    WHERE c.is_active = true

    UNION ALL

    -- Campanhas por PUBLISHER/GRUPO (campanha vale para todos os locais/totens do publisher)
    SELECT
        c.subscriber_id,
        c.campaign_id,
        c.title AS campaign_title,
        c.status AS campaign_status,
        c.is_active AS campaign_is_active,
        c.start_date,
        c.end_date,
        c.start_time,
        c.end_time,
        c.days_of_week,
        c.priority AS effective_priority,
        'publisher'::text AS target_type,
        NULL::integer AS totem_id,
        cp.publisher_id
    FROM campaigns c
    JOIN campaign_publishers cp
      ON c.campaign_id = cp.campaign_id
     AND cp.is_active = true
    WHERE c.is_active = true
)
SELECT
    ct.subscriber_id,
    s.name AS subscriber_name,

    ct.campaign_id,
    ct.campaign_title,
    ct.campaign_status,
    ct.campaign_is_active,
    ct.effective_priority,

    ct.target_type,
    ct.totem_id,
    ct.publisher_id,
    p.name AS publisher_name,

    ct.start_date,
    ct.end_date,
    ct.start_time,
    ct.end_time,
    ct.days_of_week,

    cpl.playlist_id,
    pl.name AS playlist_name,
    cpl.priority AS campaign_playlist_priority,

    pi.item_id,
    pi.order_index AS playlist_order_index,
    pi.display_seconds AS playlist_display_seconds,

    m.media_id,
    m.name AS media_name,
    m.media_type,
    m.file_path,
    m.file_name,
    m.duration_seconds AS media_duration_seconds,
    m.status AS media_status,
    m.is_active AS media_is_active
FROM campaign_targets ct
JOIN subscribers s
  ON s.subscriber_id = ct.subscriber_id
LEFT JOIN publishers p
  ON p.publisher_id = ct.publisher_id
LEFT JOIN campaign_playlists cpl
  ON cpl.campaign_id = ct.campaign_id
 AND cpl.is_active = true
LEFT JOIN playlists pl
  ON pl.playlist_id = cpl.playlist_id
 AND pl.is_active = true
LEFT JOIN playlist_items pi
  ON pi.playlist_id = pl.playlist_id
 AND pi.is_active = true
LEFT JOIN medias m
  ON m.media_id = pi.media_id
 AND m.is_active = true;

COMMENT ON VIEW subscriber_scheduled_campaigns_playlists_medias IS
    'Lista conteúdo agendado por subscriber (campanhas → playlists → mídias) com expansão de alvo (totem/publisher).';

-- =============================================
-- VIEW: Publishers com revenue share ativo
-- =============================================

CREATE OR REPLACE VIEW publishers_with_active_revenue_share AS
SELECT DISTINCT
    p.*,
    pc.revenue_share_percentage,
    pc.revenue_share_rules,
    pc.minimum_payout_amount
FROM publishers p
JOIN publisher_contracts pc ON p.publisher_id = pc.publisher_id
WHERE pc.contract_type IN ('revenue_share', 'hybrid')
  AND pc.status = 'active'
  AND (pc.end_date IS NULL OR pc.end_date >= CURRENT_DATE);

COMMENT ON VIEW publishers_with_active_revenue_share IS 'Publishers com contratos de revenue share ativos';

-- =============================================
-- VIEW: Payouts pendentes de aprovação
-- =============================================

CREATE OR REPLACE VIEW pending_publisher_payouts AS
SELECT 
    pb.*,
    p.name as publisher_name,
    p.email as publisher_email,
    u.username as approved_by_username,
    c.title as campaign_title
FROM publisher_billing pb
JOIN publishers p ON pb.publisher_id = p.publisher_id
LEFT JOIN users u ON pb.approved_by = u.id
LEFT JOIN campaigns c ON pb.campaign_id = c.campaign_id
WHERE pb.direction = 'outgoing'
  AND pb.payment_status = 'pending_payout'
  AND pb.amount > 0;

COMMENT ON VIEW pending_publisher_payouts IS 'Payouts de publishers aguardando aprovação do tenant';

-- =============================================
-- VIEW: Mídias pendentes de aprovação
-- =============================================

CREATE OR REPLACE VIEW pending_media_approvals AS
SELECT 
    m.*,
    s.name as subscriber_name,
    s.email as subscriber_email
FROM medias m
JOIN subscribers s ON m.subscriber_id = s.subscriber_id
WHERE m.status = 'pending_approval'
  AND m.is_active = true;

COMMENT ON VIEW pending_media_approvals IS 'Mídias aguardando aprovação do tenant';

-- =============================================
-- VIEW: Playlists pendentes de aprovação
-- =============================================

-- REMOVIDO: playlist_approvals não existe mais (playlists não requerem aprovação)
-- VIEW pending_playlist_approvals foi removida pois playlists não requerem aprovação

-- =============================================
-- VIEW: Estatísticas de campanhas por subscriber
-- =============================================

CREATE OR REPLACE VIEW campaign_stats_by_subscriber AS
SELECT 
    s.subscriber_id,
    s.name as subscriber_name,
    COUNT(DISTINCT c.campaign_id) as total_campaigns,
    COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.campaign_id END) as active_campaigns,
    COUNT(DISTINCT CASE WHEN c.status = 'pending_approval' THEN c.campaign_id END) as pending_campaigns,
    COUNT(DISTINCT m.media_id) as total_medias,
    COUNT(DISTINCT CASE WHEN m.status = 'approved' THEN m.media_id END) as approved_medias
FROM subscribers s
LEFT JOIN campaigns c ON s.subscriber_id = c.subscriber_id
LEFT JOIN medias m ON s.subscriber_id = m.subscriber_id
GROUP BY s.subscriber_id, s.name;

COMMENT ON VIEW campaign_stats_by_subscriber IS 'Estatísticas agregadas de campanhas e mídias por subscriber';

-- =============================================
-- VIEW: Acesso ativo Subscriber → Publisher
-- =============================================

CREATE OR REPLACE VIEW subscriber_publisher_access_active AS
SELECT DISTINCT
    spa.subscriber_id,
    spa.publisher_id,
    spa.contract_id,
    spa.plan_id,
    spa.access_type,
    spa.granted_at,
    spa.expires_at,
    spa.metadata,
    -- Dados do subscriber
    s.name as subscriber_name,
    s.email as subscriber_email,
    -- Dados do publisher
    p.name as publisher_name,
    p.email as publisher_email,
    -- Dados do contrato (se aplicável)
    sc.contract_number,
    sc.status as contract_status,
    -- Dados do plano (se aplicável)
    pl.name as plan_name,
    pl.slug as plan_slug
FROM subscriber_publisher_access spa
JOIN subscribers s ON spa.subscriber_id = s.subscriber_id
JOIN publishers p ON spa.publisher_id = p.publisher_id
LEFT JOIN subscriber_contracts sc ON spa.contract_id = sc.contract_id
LEFT JOIN plans pl ON spa.plan_id = pl.plan_id
WHERE spa.is_active = true
  AND spa.revoked_at IS NULL
  AND (spa.expires_at IS NULL OR spa.expires_at > CURRENT_TIMESTAMP)
  AND s.is_active = true
  AND COALESCE(p.is_active, true) = true;

COMMENT ON VIEW subscriber_publisher_access_active IS 
    'View que retorna apenas acessos ativos e válidos de subscribers a publishers';

-- =============================================
-- VIEW: Estatísticas de totens por publisher
-- =============================================

CREATE OR REPLACE VIEW totem_stats_by_publisher AS
SELECT 
    p.publisher_id,
    p.name as publisher_name,
    COUNT(DISTINCT l.local_id) as total_locals,
    COUNT(DISTINCT t.totem_id) as total_totems,
    COUNT(DISTINCT CASE WHEN t.status = 'online' THEN t.totem_id END) as online_totems,
    COUNT(DISTINCT st.smart_tv_id) as total_smart_tvs,
    COUNT(DISTINCT CASE WHEN st.status = 'online' THEN st.smart_tv_id END) as online_smart_tvs
FROM publishers p
LEFT JOIN locals l ON p.publisher_id = l.publisher_id
LEFT JOIN totems t ON l.local_id = t.local_id
LEFT JOIN smart_tvs st ON t.totem_id = st.totem_id
GROUP BY p.publisher_id, p.name;

COMMENT ON VIEW totem_stats_by_publisher IS 'Estatísticas agregadas de totens e Smart TVs por publisher';

-- =============================================
-- MATERIALIZED VIEW: Revenue share consolidado (atualizar periodicamente)
-- =============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_publisher_revenue_share_consolidated AS
SELECT 
    p.publisher_id,
    p.name as publisher_name,
    COUNT(DISTINCT pb.billing_id) as total_payouts,
    SUM(pb.amount) as total_revenue_share,
    SUM(CASE WHEN pb.payment_status = 'paid' THEN pb.amount ELSE 0 END) as paid_revenue_share,
    SUM(CASE WHEN pb.payment_status = 'pending_payout' THEN pb.amount ELSE 0 END) as pending_revenue_share,
    AVG(pb.revenue_share_percentage) as avg_revenue_share_percentage
FROM publishers p
JOIN publisher_billing pb ON p.publisher_id = pb.publisher_id
WHERE pb.billing_type = 'revenue_share'
  AND pb.direction = 'outgoing'
GROUP BY p.publisher_id, p.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_publisher_revenue_share_publisher 
    ON mv_publisher_revenue_share_consolidated(publisher_id);

COMMENT ON MATERIALIZED VIEW mv_publisher_revenue_share_consolidated IS 
    'Receita consolidada de revenue share por publisher (atualizar com REFRESH MATERIALIZED VIEW)';

-- =============================================
-- MATERIALIZED VIEW: Execuções por totem (últimas 24h)
-- =============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_totem_executions_last_24h AS
SELECT 
    t.totem_id,
    t.identifier as totem_identifier,
    t.name as totem_name,
    COUNT(*) as total_executions,
    COUNT(DISTINCT el.campaign_id) as unique_campaigns,
    COUNT(DISTINCT el.media_id) as unique_medias,
    MIN(el.timestamp) as first_execution,
    MAX(el.timestamp) as last_execution
FROM totems t
JOIN execution_logs el ON t.totem_id = el.totem_id
WHERE el.timestamp > NOW() - INTERVAL '24 hours'
  AND el.event_type IN ('play_start', 'schedule_start')
GROUP BY t.totem_id, t.identifier, t.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_totem_executions_totem 
    ON mv_totem_executions_last_24h(totem_id);

COMMENT ON MATERIALIZED VIEW mv_totem_executions_last_24h IS 
    'Estatísticas de execução por totem nas últimas 24h (atualizar periodicamente)';

