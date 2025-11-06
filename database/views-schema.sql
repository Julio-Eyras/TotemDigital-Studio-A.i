-- =============================================
-- VIEWS SCHEMA - Smart Signage v2.1
-- =============================================
-- Views para mascarar queries complexas
-- Permissões de leitura apenas (SELECT)
-- =============================================

-- =============================================
-- E. EXECUÇÃO E MONITORAMENTO (Prioritário)
-- =============================================

-- E1. View: Logs de Execução Completo
CREATE OR REPLACE VIEW v_execution_logs_complete AS
SELECT 
    el.log_id,
    el.executed_at,
    el.start_time,
    el.end_time,
    el.duration_seconds,
    el.status,
    el.play_success,
    el.error_code,
    -- Totem
    t.totem_id,
    t.identifier AS totem_identifier,
    t.status AS totem_status,
    t.last_heartbeat AS totem_last_heartbeat,
    -- Localização
    l.local_id,
    l.description AS local_description,
    h.host_id,
    h.name AS host_name,
    h.contact_name AS host_contact,
    h.email AS host_email,
    h.phone AS host_phone,
    -- Cliente
    c.client_id,
    c.name AS client_name,
    c.contact_name AS client_contact,
    c.email AS client_email,
    c.phone AS client_phone,
    -- Campanha
    camp.campaign_id,
    camp.title AS campaign_title,
    camp.campaign_type AS campaign_type,
    camp.status AS campaign_status,
    camp.start_date AS campaign_start_date,
    camp.end_date AS campaign_end_date,
    -- Mídia
    m.media_id,
    m.name AS media_name,
    m.title AS media_title,
    m.media_type AS media_type,
    m.duration_seconds AS media_duration,
    m.size_bytes AS media_size,
    m.status AS media_status
FROM execution_logs el
LEFT JOIN totems t ON el.totem_id = t.totem_id
LEFT JOIN locals l ON t.local_id = l.local_id
LEFT JOIN hosts h ON l.host_id = h.host_id
LEFT JOIN clients c ON el.client_id = c.client_id
LEFT JOIN campaigns camp ON el.campaign_id = camp.campaign_id
LEFT JOIN medias m ON el.media_id = m.media_id;

COMMENT ON VIEW v_execution_logs_complete IS 'View com logs de execução completos incluindo totem, localização, cliente, campanha e mídia';

-- E2. View: Comandos Remotos por Totem
CREATE OR REPLACE VIEW v_remote_commands_complete AS
SELECT 
    rc.id AS command_id,
    rc.request_id,
    rc.command_type,
    rc.command_data,
    rc.priority,
    rc.status,
    rc.created_at,
    rc.executed_at,
    rc.result,
    -- Totem
    t.totem_id,
    t.identifier AS totem_identifier,
    t.status AS totem_status,
    t.last_heartbeat AS totem_last_heartbeat,
    -- Localização
    l.local_id,
    l.description AS local_description,
    h.host_id,
    h.name AS host_name,
    -- Criador
    u.id AS user_id,
    u.username AS user_username,
    u.name AS user_name,
    u.role AS user_role,
    -- Cliente (via totem -> campaign -> client)
    c.client_id,
    c.name AS client_name
FROM remote_commands rc
LEFT JOIN totems t ON rc.totem_id = t.totem_id
LEFT JOIN locals l ON t.local_id = l.local_id
LEFT JOIN hosts h ON l.host_id = h.host_id
LEFT JOIN users u ON rc.created_by = u.id
LEFT JOIN campaign_totems ct ON t.totem_id = ct.totem_id
LEFT JOIN campaigns camp ON ct.campaign_id = camp.campaign_id
LEFT JOIN clients c ON camp.client_id = c.client_id;

COMMENT ON VIEW v_remote_commands_complete IS 'View com comandos remotos incluindo totem, localização, criador e cliente';

-- E3. View: Performance de Playlists por Totem
CREATE OR REPLACE VIEW v_playlist_performance AS
SELECT 
    el.log_id,
    el.executed_at,
    el.duration_seconds,
    el.status,
    el.play_success,
    -- Totem
    t.totem_id,
    t.identifier AS totem_identifier,
    -- Playlist (via campaign)
    p.playlist_id,
    p.name AS playlist_name,
    p.description AS playlist_description,
    p.is_default AS playlist_is_default,
    p.loop AS playlist_loop,
    -- Campanha
    camp.campaign_id,
    camp.title AS campaign_title,
    camp.campaign_type AS campaign_type,
    camp.status AS campaign_status,
    -- Mídias da Playlist (agregado)
    COUNT(DISTINCT pi.media_id) AS media_count,
    SUM(pi.display_seconds) AS total_duration_seconds,
    -- Cliente
    c.client_id,
    c.name AS client_name,
    -- Localização
    l.local_id,
    l.description AS local_description,
    h.host_id,
    h.name AS host_name
FROM execution_logs el
LEFT JOIN totems t ON el.totem_id = t.totem_id
LEFT JOIN campaigns camp ON el.campaign_id = camp.campaign_id
LEFT JOIN playlists p ON p.campaign_id = camp.campaign_id AND p.totem_id = t.totem_id
LEFT JOIN playlist_items pi ON p.playlist_id = pi.playlist_id
LEFT JOIN clients c ON camp.client_id = c.client_id
LEFT JOIN locals l ON t.local_id = l.local_id
LEFT JOIN hosts h ON l.host_id = h.host_id
GROUP BY 
    el.log_id, el.executed_at, el.duration_seconds, el.status, el.play_success,
    t.totem_id, t.identifier,
    p.playlist_id, p.name, p.description, p.is_default, p.loop,
    camp.campaign_id, camp.title, camp.campaign_type, camp.status,
    c.client_id, c.name,
    l.local_id, l.description,
    h.host_id, h.name;

COMMENT ON VIEW v_playlist_performance IS 'View com performance de playlists incluindo agregações de mídias';

-- E4. View: Estatísticas de Execução Agregadas (por dia)
CREATE OR REPLACE VIEW v_execution_stats_daily AS
SELECT 
    DATE_TRUNC('day', el.executed_at) AS period,
    -- Totem
    t.totem_id,
    t.identifier AS totem_identifier,
    -- Campanha
    camp.campaign_id,
    camp.title AS campaign_title,
    -- Cliente
    c.client_id,
    c.name AS client_name,
    -- Métricas Agregadas
    COUNT(*) AS total_executions,
    COUNT(CASE WHEN el.play_success = true THEN 1 END) AS successful_executions,
    COUNT(CASE WHEN el.play_success = false THEN 1 END) AS failed_executions,
    AVG(el.duration_seconds) AS avg_duration_seconds,
    SUM(el.duration_seconds) AS total_duration_seconds,
    MIN(el.duration_seconds) AS min_duration_seconds,
    MAX(el.duration_seconds) AS max_duration_seconds,
    COUNT(DISTINCT el.totem_id) AS unique_totems,
    COUNT(DISTINCT el.campaign_id) AS unique_campaigns,
    COUNT(DISTINCT el.media_id) AS unique_medias
FROM execution_logs el
LEFT JOIN totems t ON el.totem_id = t.totem_id
LEFT JOIN campaigns camp ON el.campaign_id = camp.campaign_id
LEFT JOIN clients c ON el.client_id = c.client_id
WHERE el.executed_at IS NOT NULL
GROUP BY 
    DATE_TRUNC('day', el.executed_at),
    t.totem_id, t.identifier,
    camp.campaign_id, camp.title,
    c.client_id, c.name;

COMMENT ON VIEW v_execution_stats_daily IS 'View com estatísticas agregadas de execução por dia';

-- E5. View: Estatísticas de Execução Agregadas (por hora)
CREATE OR REPLACE VIEW v_execution_stats_hourly AS
SELECT 
    DATE_TRUNC('hour', el.executed_at) AS period,
    -- Totem
    t.totem_id,
    t.identifier AS totem_identifier,
    -- Campanha
    camp.campaign_id,
    camp.title AS campaign_title,
    -- Cliente
    c.client_id,
    c.name AS client_name,
    -- Métricas Agregadas
    COUNT(*) AS total_executions,
    COUNT(CASE WHEN el.play_success = true THEN 1 END) AS successful_executions,
    COUNT(CASE WHEN el.play_success = false THEN 1 END) AS failed_executions,
    AVG(el.duration_seconds) AS avg_duration_seconds,
    SUM(el.duration_seconds) AS total_duration_seconds,
    MIN(el.duration_seconds) AS min_duration_seconds,
    MAX(el.duration_seconds) AS max_duration_seconds,
    COUNT(DISTINCT el.totem_id) AS unique_totems,
    COUNT(DISTINCT el.campaign_id) AS unique_campaigns,
    COUNT(DISTINCT el.media_id) AS unique_medias
FROM execution_logs el
LEFT JOIN totems t ON el.totem_id = t.totem_id
LEFT JOIN campaigns camp ON el.campaign_id = camp.campaign_id
LEFT JOIN clients c ON el.client_id = c.client_id
WHERE el.executed_at IS NOT NULL
GROUP BY 
    DATE_TRUNC('hour', el.executed_at),
    t.totem_id, t.identifier,
    camp.campaign_id, camp.title,
    c.client_id, c.name;

COMMENT ON VIEW v_execution_stats_hourly IS 'View com estatísticas agregadas de execução por hora';

-- =============================================
-- G. RBAC E AUDITORIA (Prioritário)
-- =============================================

-- G1. View: Usuários com Roles e Permissões
-- Nota: Esta view usa JSON_AGG, então pode precisar de ajustes
CREATE OR REPLACE VIEW v_users_with_roles AS
SELECT 
    u.id AS user_id,
    u.username,
    u.email,
    u.name AS user_name,
    u.role AS user_role,
    u.is_active AS user_is_active,
    u.last_login,
    u.created_at AS user_created_at,
    -- Cliente
    c.client_id,
    c.name AS client_name,
    c.email AS client_email,
    c.phone AS client_phone,
    c.active AS client_active,
    -- Contagem de roles e permissões
    COUNT(DISTINCT r.role_id) AS role_count,
    COUNT(DISTINCT p.permission_id) AS permission_count
FROM users u
LEFT JOIN clients c ON u.client_id = c.client_id
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.role_id
LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.permission_id
GROUP BY 
    u.id, u.username, u.email, u.name, u.role, u.is_active, u.last_login, u.created_at,
    c.client_id, c.name, c.email, c.phone, c.active;

COMMENT ON VIEW v_users_with_roles IS 'View com usuários e contagem de roles e permissões';

-- G2. View: Logs de Auditoria com Contexto
CREATE OR REPLACE VIEW v_audit_logs_complete AS
SELECT 
    al.id AS audit_id,
    al.action,
    al.entity,
    al.entity_id,
    al.metadata,
    al.timestamp AS audit_timestamp,
    -- Usuário
    u.id AS user_id,
    u.username,
    u.name AS user_name,
    u.email AS user_email,
    u.role AS user_role,
    -- Cliente (via usuário)
    c.client_id,
    c.name AS client_name,
    -- Detalhes da entidade (baseado no tipo)
    CASE 
        WHEN al.entity = 'media' THEN (SELECT name FROM medias WHERE media_id = al.entity_id)
        WHEN al.entity = 'campaign' THEN (SELECT title FROM campaigns WHERE campaign_id = al.entity_id)
        WHEN al.entity = 'totem' THEN (SELECT identifier FROM totems WHERE totem_id = al.entity_id)
        WHEN al.entity = 'user' THEN (SELECT username FROM users WHERE id = al.entity_id)
        WHEN al.entity = 'client' THEN (SELECT name FROM clients WHERE client_id = al.entity_id)
        ELSE NULL
    END AS entity_name
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
LEFT JOIN clients c ON u.client_id = c.client_id;

COMMENT ON VIEW v_audit_logs_complete IS 'View com logs de auditoria incluindo usuário, cliente e nome da entidade';

-- G3. View: Atividades de Usuários por Dia
CREATE OR REPLACE VIEW v_user_activities_daily AS
SELECT 
    DATE_TRUNC('day', al.timestamp) AS period,
    -- Usuário
    u.id AS user_id,
    u.username,
    u.name AS user_name,
    u.role AS user_role,
    -- Cliente
    c.client_id,
    c.name AS client_name,
    -- Métricas Agregadas
    COUNT(*) AS total_actions,
    COUNT(DISTINCT al.entity) AS unique_entities,
    COUNT(DISTINCT al.action) AS unique_actions,
    COUNT(CASE WHEN al.action = 'create' THEN 1 END) AS create_count,
    COUNT(CASE WHEN al.action = 'update' THEN 1 END) AS update_count,
    COUNT(CASE WHEN al.action = 'delete' THEN 1 END) AS delete_count,
    COUNT(CASE WHEN al.action = 'approve' THEN 1 END) AS approve_count,
    COUNT(CASE WHEN al.action = 'login' THEN 1 END) AS login_count,
    COUNT(CASE WHEN al.action = 'logout' THEN 1 END) AS logout_count
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
LEFT JOIN clients c ON u.client_id = c.client_id
WHERE al.timestamp IS NOT NULL
GROUP BY 
    DATE_TRUNC('day', al.timestamp),
    u.id, u.username, u.name, u.role,
    c.client_id, c.name;

COMMENT ON VIEW v_user_activities_daily IS 'View com atividades de usuários agregadas por dia';

-- G4. View: Permissões por Role
CREATE OR REPLACE VIEW v_role_permissions AS
SELECT 
    r.role_id,
    r.name AS role_name,
    r.description AS role_description,
    r.is_active AS role_active,
    -- Contagem por recurso
    COUNT(DISTINCT CASE WHEN p.resource = 'media' THEN p.permission_id END) AS media_permissions,
    COUNT(DISTINCT CASE WHEN p.resource = 'campaign' THEN p.permission_id END) AS campaign_permissions,
    COUNT(DISTINCT CASE WHEN p.resource = 'totem' THEN p.permission_id END) AS totem_permissions,
    COUNT(DISTINCT CASE WHEN p.resource = 'user' THEN p.permission_id END) AS user_permissions,
    COUNT(DISTINCT CASE WHEN p.resource = 'client' THEN p.permission_id END) AS client_permissions,
    -- Total de permissões
    COUNT(DISTINCT p.permission_id) AS total_permissions,
    -- Usuários com esta role
    COUNT(DISTINCT ur.user_id) AS user_count
FROM roles r
LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.permission_id
LEFT JOIN user_roles ur ON r.role_id = ur.role_id
GROUP BY 
    r.role_id, r.name, r.description, r.is_active;

COMMENT ON VIEW v_role_permissions IS 'View com permissões por role e contagens';

-- =============================================
-- A. GESTÃO DE TOTEMS E LOCALIZAÇÃO
-- =============================================

-- A1. View: Totems com Localização Completa
CREATE OR REPLACE VIEW v_totems_complete AS
SELECT 
    t.totem_id,
    t.identifier,
    t.uin,
    t.device_id,
    t.description AS totem_description,
    t.status AS totem_status,
    t.version,
    t.firmware_version,
    t.ip_address,
    t.last_seen,
    t.last_heartbeat,
    t.active AS totem_active,
    t.blocked AS totem_blocked,
    t.blocked_until,
    t.created_at AS totem_created_at,
    t.updated_at AS totem_updated_at,
    -- Localização
    l.local_id,
    l.description AS local_description,
    l.active AS local_active,
    h.host_id,
    h.name AS host_name,
    h.contact_name AS host_contact,
    h.email AS host_email,
    h.phone AS host_phone,
    h.wths AS host_wths,
    h.description AS host_description,
    h.active AS host_active,
    -- Cliente (via campanhas)
    c.client_id,
    c.name AS client_name,
    c.contact_name AS client_contact,
    c.email AS client_email,
    c.phone AS client_phone,
    -- Smart TV
    st.smartv_id,
    st.brand AS smart_tv_brand,
    st.model AS smart_tv_model,
    st.ip_address AS smart_tv_ip,
    st.active AS smart_tv_active,
    -- Estatísticas
    COUNT(DISTINCT p.playlist_id) AS playlist_count,
    COUNT(DISTINCT ct.campaign_id) AS campaign_count,
    COUNT(DISTINCT el.log_id) AS execution_count,
    MAX(el.executed_at) AS last_execution
FROM totems t
LEFT JOIN locals l ON t.local_id = l.local_id
LEFT JOIN hosts h ON l.host_id = h.host_id
LEFT JOIN smart_tvs st ON t.totem_id = st.totem_id
LEFT JOIN playlists p ON t.totem_id = p.totem_id
LEFT JOIN campaign_totems ct ON t.totem_id = ct.totem_id
LEFT JOIN campaigns camp ON ct.campaign_id = camp.campaign_id
LEFT JOIN clients c ON camp.client_id = c.client_id
LEFT JOIN execution_logs el ON t.totem_id = el.totem_id
GROUP BY 
    t.totem_id, t.identifier, t.uin, t.device_id, t.description, t.status,
    t.version, t.firmware_version, t.ip_address, t.last_seen, t.last_heartbeat,
    t.active, t.blocked, t.blocked_until, t.created_at, t.updated_at,
    l.local_id, l.description, l.active,
    h.host_id, h.name, h.contact_name, h.email, h.phone, h.wths, h.description, h.active,
    c.client_id, c.name, c.contact_name, c.email, c.phone,
    st.smartv_id, st.brand, st.model, st.ip_address, st.active;

COMMENT ON VIEW v_totems_complete IS 'View com totems incluindo localização, cliente, smart TV e estatísticas';

-- =============================================
-- B. GESTÃO DE CAMPANHAS
-- =============================================

-- B1. View: Campanhas com Detalhes Completos
CREATE OR REPLACE VIEW v_campaigns_complete AS
SELECT 
    camp.campaign_id,
    camp.title,
    camp.description AS campaign_description,
    camp.campaign_type,
    camp.priority,
    camp.start_date,
    camp.end_date,
    camp.start_time,
    camp.end_time,
    camp.days_of_week,
    camp.status AS campaign_status,
    camp.is_active AS campaign_active,
    camp.created_at AS campaign_created_at,
    camp.updated_at AS campaign_updated_at,
    -- Cliente
    c.client_id,
    c.name AS client_name,
    c.contact_name AS client_contact,
    c.email AS client_email,
    c.phone AS client_phone,
    c.active AS client_active,
    -- Estatísticas
    COUNT(DISTINCT ct.totem_id) AS totem_count,
    COUNT(DISTINCT p.playlist_id) AS playlist_count,
    COUNT(DISTINCT cp.playlist_id) AS campaign_playlist_count,
    COUNT(DISTINCT qr.id) AS qr_code_count,
    COUNT(DISTINCT sl.short_id) AS short_link_count,
    COUNT(DISTINCT el.log_id) AS execution_count,
    COUNT(DISTINCT CASE WHEN el.play_success = true THEN el.log_id END) AS successful_executions,
    COUNT(DISTINCT CASE WHEN el.play_success = false THEN el.log_id END) AS failed_executions
FROM campaigns camp
LEFT JOIN clients c ON camp.client_id = c.client_id
LEFT JOIN campaign_totems ct ON camp.campaign_id = ct.campaign_id
LEFT JOIN playlists p ON camp.campaign_id = p.campaign_id
LEFT JOIN campaign_playlists cp ON camp.campaign_id = cp.campaign_id
LEFT JOIN qr_codes qr ON camp.campaign_id = qr.campaign_id
LEFT JOIN short_links sl ON camp.campaign_id = sl.campaign_id
LEFT JOIN execution_logs el ON camp.campaign_id = el.campaign_id
GROUP BY 
    camp.campaign_id, camp.title, camp.description, camp.campaign_type, camp.priority,
    camp.start_date, camp.end_date, camp.start_time, camp.end_time, camp.days_of_week,
    camp.status, camp.is_active, camp.created_at, camp.updated_at,
    c.client_id, c.name, c.contact_name, c.email, c.phone, c.active;

COMMENT ON VIEW v_campaigns_complete IS 'View com campanhas incluindo cliente e estatísticas completas';

-- =============================================
-- C. GESTÃO DE MÍDIAS
-- =============================================

-- C1. View: Mídias com Detalhes e Workflow
CREATE OR REPLACE VIEW v_medias_complete AS
SELECT 
    m.media_id,
    m.name AS media_name,
    m.title AS media_title,
    m.description AS media_description,
    m.tags,
    m.version,
    m.checksum,
    m.preview_url,
    m.status AS media_status,
    m.file_path,
    m.media_type,
    m.duration_seconds,
    m.size_bytes,
    m.mime_type,
    m.width,
    m.height,
    m.created_at AS media_created_at,
    m.updated_at AS media_updated_at,
    -- Cliente
    c.client_id,
    c.name AS client_name,
    c.email AS client_email,
    c.active AS client_active,
    -- Criador
    u.id AS creator_id,
    u.username AS creator_username,
    u.name AS creator_name,
    u.role AS creator_role,
    -- Workflow de Aprovação
    aw.id AS workflow_id,
    aw.status AS workflow_status,
    aw.reviewed_at,
    aw.comment AS workflow_comment,
    reviewer.id AS reviewer_id,
    reviewer.username AS reviewer_username,
    reviewer.name AS reviewer_name,
    -- Estatísticas
    COUNT(DISTINCT pi.item_id) AS playlist_item_count,
    COUNT(DISTINCT p.playlist_id) AS playlist_count,
    COUNT(DISTINCT el.log_id) AS execution_count,
    COUNT(DISTINCT CASE WHEN el.play_success = true THEN el.log_id END) AS successful_plays
FROM medias m
LEFT JOIN clients c ON m.client_id = c.client_id
LEFT JOIN users u ON m.created_by = u.id
LEFT JOIN approval_workflows aw ON m.media_id = aw.media_id
LEFT JOIN users reviewer ON aw.reviewed_by = reviewer.id
LEFT JOIN playlist_items pi ON m.media_id = pi.media_id
LEFT JOIN playlists p ON pi.playlist_id = p.playlist_id
LEFT JOIN execution_logs el ON m.media_id = el.media_id
GROUP BY 
    m.media_id, m.name, m.title, m.description, m.tags, m.version, m.checksum,
    m.preview_url, m.status, m.file_path, m.media_type, m.duration_seconds,
    m.size_bytes, m.mime_type, m.width, m.height, m.created_at, m.updated_at,
    c.client_id, c.name, c.email, c.active,
    u.id, u.username, u.name, u.role,
    aw.id, aw.status, aw.reviewed_at, aw.comment,
    reviewer.id, reviewer.username, reviewer.name;

COMMENT ON VIEW v_medias_complete IS 'View com mídias incluindo cliente, criador, workflow e estatísticas';

-- =============================================
-- D. ANALYTICS E RELATÓRIOS
-- =============================================

-- D1. View: Sessões de Analytics por Totem
CREATE OR REPLACE VIEW v_analytics_sessions_complete AS
SELECT 
    asess.id AS session_id,
    asess.session_start,
    asess.session_end,
    asess.total_interactions,
    asess.avg_emotion_score,
    asess.dominant_emotion,
    asess.age_range,
    asess.gender,
    asess.location AS session_location,
    asess.created_at AS session_created_at,
    -- Totem
    t.totem_id,
    t.identifier AS totem_identifier,
    t.status AS totem_status,
    -- Localização
    l.local_id,
    l.description AS local_description,
    h.host_id,
    h.name AS host_name,
    -- Cliente (via campanhas)
    c.client_id,
    c.name AS client_name,
    -- Métricas de Emoções
    COUNT(DISTINCT ae.id) AS emotion_count,
    COUNT(DISTINCT CASE WHEN ae.emotion = 'happy' THEN ae.id END) AS happy_count,
    COUNT(DISTINCT CASE WHEN ae.emotion = 'sad' THEN ae.id END) AS sad_count,
    COUNT(DISTINCT CASE WHEN ae.emotion = 'angry' THEN ae.id END) AS angry_count,
    COUNT(DISTINCT CASE WHEN ae.emotion = 'surprised' THEN ae.id END) AS surprised_count,
    COUNT(DISTINCT CASE WHEN ae.emotion = 'neutral' THEN ae.id END) AS neutral_count,
    AVG(ae.confidence) AS avg_emotion_confidence,
    -- Métricas de Gestos
    COUNT(DISTINCT ag.id) AS gesture_count,
    COUNT(DISTINCT ag.gesture_type) AS unique_gesture_types,
    AVG(ag.confidence) AS avg_gesture_confidence
FROM analytics_sessions asess
LEFT JOIN totems t ON asess.totem_id = t.totem_id
LEFT JOIN locals l ON t.local_id = l.local_id
LEFT JOIN hosts h ON l.host_id = h.host_id
LEFT JOIN campaign_totems ct ON t.totem_id = ct.totem_id
LEFT JOIN campaigns camp ON ct.campaign_id = camp.campaign_id
LEFT JOIN clients c ON camp.client_id = c.client_id
LEFT JOIN analytics_emotions ae ON asess.id = ae.session_id
LEFT JOIN analytics_gestures ag ON asess.id = ag.session_id
GROUP BY 
    asess.id, asess.session_start, asess.session_end, asess.total_interactions,
    asess.avg_emotion_score, asess.dominant_emotion, asess.age_range, asess.gender,
    asess.location, asess.created_at,
    t.totem_id, t.identifier, t.status,
    l.local_id, l.description,
    h.host_id, h.name,
    c.client_id, c.name;

COMMENT ON VIEW v_analytics_sessions_complete IS 'View com sessões de analytics incluindo totem, localização, cliente e métricas de emoções/gestos';

-- =============================================
-- H. EXPORTAÇÃO (Novo Sistema)
-- =============================================

-- H1. View: Queries de Exportação com Criador
CREATE OR REPLACE VIEW v_export_queries_complete AS
SELECT 
    eq.query_id,
    eq.name AS query_name,
    eq.description AS query_description,
    eq.provider,
    eq.sql_query,
    eq.database_config,
    eq.export_config,
    eq.enabled AS query_enabled,
    eq.created_at AS query_created_at,
    eq.updated_at AS query_updated_at,
    -- Criador
    u.id AS creator_id,
    u.username AS creator_username,
    u.name AS creator_name,
    u.email AS creator_email,
    u.role AS creator_role,
    -- Estatísticas
    COUNT(DISTINCT es.schedule_id) AS schedule_count,
    COUNT(DISTINCT ee.execution_id) AS execution_count,
    COUNT(DISTINCT CASE WHEN ee.status = 'completed' THEN ee.execution_id END) AS successful_executions,
    COUNT(DISTINCT CASE WHEN ee.status = 'failed' THEN ee.execution_id END) AS failed_executions,
    MAX(ee.started_at) AS last_execution
FROM export_queries eq
LEFT JOIN users u ON eq.created_by = u.id
LEFT JOIN export_schedules es ON eq.query_id = es.query_id
LEFT JOIN export_executions ee ON eq.query_id = ee.query_id
GROUP BY 
    eq.query_id, eq.name, eq.description, eq.provider, eq.sql_query,
    eq.database_config, eq.export_config, eq.enabled, eq.created_at, eq.updated_at,
    u.id, u.username, u.name, u.email, u.role;

COMMENT ON VIEW v_export_queries_complete IS 'View com queries de exportação incluindo criador e estatísticas';

-- H2. View: Agendamentos de Exportação Completos
CREATE OR REPLACE VIEW v_export_schedules_complete AS
SELECT 
    es.schedule_id,
    es.name AS schedule_name,
    es.description AS schedule_description,
    es.cron_expression,
    es.enabled AS schedule_enabled,
    es.last_execution,
    es.next_execution,
    es.execution_count,
    es.success_count,
    es.failure_count,
    es.created_at AS schedule_created_at,
    es.updated_at AS schedule_updated_at,
    -- Query
    eq.query_id,
    eq.name AS query_name,
    eq.provider AS query_provider,
    eq.enabled AS query_enabled,
    -- Criador
    u.id AS creator_id,
    u.username AS creator_username,
    u.name AS creator_name,
    u.role AS creator_role,
    -- Estatísticas de Execução
    COUNT(DISTINCT ee.execution_id) AS total_executions,
    COUNT(DISTINCT CASE WHEN ee.status = 'completed' THEN ee.execution_id END) AS completed_executions,
    COUNT(DISTINCT CASE WHEN ee.status = 'failed' THEN ee.execution_id END) AS failed_executions,
    COUNT(DISTINCT CASE WHEN ee.status = 'running' THEN ee.execution_id END) AS running_executions,
    MAX(ee.completed_at) AS last_completed_execution,
    SUM(ee.records_exported) AS total_records_exported,
    SUM(ee.file_size) AS total_file_size
FROM export_schedules es
LEFT JOIN export_queries eq ON es.query_id = eq.query_id
LEFT JOIN users u ON es.created_by = u.id
LEFT JOIN export_executions ee ON es.schedule_id = ee.schedule_id
GROUP BY 
    es.schedule_id, es.name, es.description, es.cron_expression, es.enabled,
    es.last_execution, es.next_execution, es.execution_count, es.success_count,
    es.failure_count, es.created_at, es.updated_at,
    eq.query_id, eq.name, eq.provider, eq.enabled,
    u.id, u.username, u.name, u.role;

COMMENT ON VIEW v_export_schedules_complete IS 'View com agendamentos de exportação incluindo query, criador e estatísticas';

-- H3. View: Histórico de Execuções Completo
CREATE OR REPLACE VIEW v_export_executions_complete AS
SELECT 
    ee.execution_id,
    ee.job_id,
    ee.status AS execution_status,
    ee.started_at,
    ee.completed_at,
    ee.records_exported,
    ee.file_path,
    ee.file_size,
    ee.error_message,
    ee.execution_log,
    ee.created_at AS execution_created_at,
    -- Schedule
    es.schedule_id,
    es.name AS schedule_name,
    es.cron_expression,
    -- Query
    eq.query_id,
    eq.name AS query_name,
    eq.provider AS query_provider,
    -- Criador (via schedule)
    u.id AS creator_id,
    u.username AS creator_username,
    u.name AS creator_name,
    -- Duração calculada
    CASE 
        WHEN ee.started_at IS NOT NULL AND ee.completed_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (ee.completed_at - ee.started_at))
        ELSE NULL
    END AS duration_seconds
FROM export_executions ee
LEFT JOIN export_schedules es ON ee.schedule_id = es.schedule_id
LEFT JOIN export_queries eq ON ee.query_id = eq.query_id
LEFT JOIN users u ON es.created_by = u.id;

COMMENT ON VIEW v_export_executions_complete IS 'View com histórico de execuções incluindo schedule, query, criador e duração';

-- =============================================
-- PERMISSÕES (GRANT SELECT)
-- =============================================

-- Revogar todas as permissões existentes
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

-- Garantir que o usuário do banco tem permissões necessárias nas tabelas
-- (Isso deve ser feito pelo usuário admin, não pelo script)

-- Conceder SELECT apenas nas views para usuários de leitura
-- Criar role para usuários de leitura (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'readonly_user') THEN
        CREATE ROLE readonly_user;
    END IF;
END
$$;

-- Conceder SELECT nas views
GRANT SELECT ON v_execution_logs_complete TO readonly_user;
GRANT SELECT ON v_remote_commands_complete TO readonly_user;
GRANT SELECT ON v_playlist_performance TO readonly_user;
GRANT SELECT ON v_execution_stats_daily TO readonly_user;
GRANT SELECT ON v_execution_stats_hourly TO readonly_user;
GRANT SELECT ON v_users_with_roles TO readonly_user;
GRANT SELECT ON v_audit_logs_complete TO readonly_user;
GRANT SELECT ON v_user_activities_daily TO readonly_user;
GRANT SELECT ON v_role_permissions TO readonly_user;
GRANT SELECT ON v_totems_complete TO readonly_user;
GRANT SELECT ON v_campaigns_complete TO readonly_user;
GRANT SELECT ON v_medias_complete TO readonly_user;
GRANT SELECT ON v_analytics_sessions_complete TO readonly_user;
GRANT SELECT ON v_export_queries_complete TO readonly_user;
GRANT SELECT ON v_export_schedules_complete TO readonly_user;
GRANT SELECT ON v_export_executions_complete TO readonly_user;

-- Conceder SELECT nas views para usuário público (se necessário)
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO PUBLIC; -- Descomentar se necessário

-- Comentários finais
COMMENT ON SCHEMA public IS 'Smart Signage v2.1 - Schema com views para acesso de leitura apenas';

