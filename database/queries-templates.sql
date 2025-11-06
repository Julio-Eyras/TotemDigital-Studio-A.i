-- =============================================
-- QUERIES TEMPLATE - Smart Signage v2.1
-- =============================================
-- Queries complexas com múltiplos JOINs
-- Organizadas por módulo/funcionalidade
-- Parametrizáveis e reutilizáveis
-- =============================================

-- =============================================
-- E. EXECUÇÃO E MONITORAMENTO (Prioritário)
-- =============================================

-- E1. Logs de Execução Completo
-- Objetivo: Ver histórico de execuções com contexto completo
-- Uso: Dashboard, Relatórios, Debug
-- Parâmetros: client_id (opcional), totem_id (opcional), campaign_id (opcional), 
--             start_date (opcional), end_date (opcional), status (opcional)
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
LEFT JOIN medias m ON el.media_id = m.media_id
WHERE 1=1
    -- Filtros dinâmicos (remover WHERE 1=1 e usar apenas os necessários)
    -- AND el.client_id = :client_id
    -- AND el.totem_id = :totem_id
    -- AND el.campaign_id = :campaign_id
    -- AND el.executed_at >= :start_date
    -- AND el.executed_at <= :end_date
    -- AND el.status = :status
    -- AND el.play_success = :play_success
    -- AND t.active = true
    -- AND c.active = true
ORDER BY el.executed_at DESC
-- LIMIT :limit OFFSET :offset  -- Paginação

-- E2. Comandos Remotos por Totem
-- Objetivo: Monitorar comandos enviados aos totens
-- Uso: Debug, Monitoramento, Auditoria
-- Parâmetros: totem_id (opcional), command_type (opcional), status (opcional),
--             created_by (opcional), start_date (opcional), end_date (opcional)
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
LEFT JOIN clients c ON camp.client_id = c.client_id
WHERE 1=1
    -- Filtros dinâmicos
    -- AND rc.totem_id = :totem_id
    -- AND rc.command_type = :command_type
    -- AND rc.status = :status
    -- AND rc.created_by = :created_by
    -- AND rc.created_at >= :start_date
    -- AND rc.created_at <= :end_date
    -- AND t.active = true
ORDER BY rc.created_at DESC
-- LIMIT :limit OFFSET :offset

-- E3. Performance de Playlists por Totem
-- Objetivo: Analisar execução de playlists com detalhes
-- Uso: Analytics, Otimização, Relatórios
-- Parâmetros: totem_id (opcional), playlist_id (opcional), campaign_id (opcional),
--             start_date (opcional), end_date (opcional)
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
    -- Mídias da Playlist
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
WHERE 1=1
    -- Filtros dinâmicos
    -- AND el.totem_id = :totem_id
    -- AND p.playlist_id = :playlist_id
    -- AND el.campaign_id = :campaign_id
    -- AND el.executed_at >= :start_date
    -- AND el.executed_at <= :end_date
    -- AND el.play_success = true
    -- AND t.active = true
    -- AND p.is_active = true
GROUP BY 
    el.log_id, el.executed_at, el.duration_seconds, el.status, el.play_success,
    t.totem_id, t.identifier,
    p.playlist_id, p.name, p.description, p.is_default, p.loop,
    camp.campaign_id, camp.title, camp.campaign_type, camp.status,
    c.client_id, c.name,
    l.local_id, l.description,
    h.host_id, h.name
ORDER BY el.executed_at DESC
-- LIMIT :limit OFFSET :offset

-- E4. Estatísticas de Execução Agregadas
-- Objetivo: Métricas agregadas de execução por período
-- Uso: Dashboard, Relatórios, Analytics
-- Parâmetros: client_id (opcional), totem_id (opcional), campaign_id (opcional),
--             start_date (opcional), end_date (opcional), granularity ('day'|'hour')
SELECT 
    DATE_TRUNC(
        CASE 
            WHEN :granularity = 'hour' THEN 'hour'
            ELSE 'day'
        END,
        el.executed_at
    ) AS period,
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
WHERE 1=1
    -- Filtros dinâmicos
    -- AND el.client_id = :client_id
    -- AND el.totem_id = :totem_id
    -- AND el.campaign_id = :campaign_id
    -- AND el.executed_at >= :start_date
    -- AND el.executed_at <= :end_date
    -- AND t.active = true
    -- AND c.active = true
GROUP BY 
    DATE_TRUNC(
        CASE 
            WHEN :granularity = 'hour' THEN 'hour'
            ELSE 'day'
        END,
        el.executed_at
    ),
    t.totem_id, t.identifier,
    camp.campaign_id, camp.title,
    c.client_id, c.name
ORDER BY period DESC, total_executions DESC
-- LIMIT :limit OFFSET :offset

-- =============================================
-- G. RBAC E AUDITORIA (Prioritário)
-- =============================================

-- G1. Usuários com Roles e Permissões Completas
-- Objetivo: Ver permissões completas de usuários
-- Uso: Administração, Segurança, Auditoria
-- Parâmetros: user_id (opcional), role_id (opcional), client_id (opcional),
--             is_active (opcional), role_name (opcional)
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
    -- Roles (JSON agregado)
    COALESCE(
        json_agg(
            DISTINCT jsonb_build_object(
                'role_id', r.role_id,
                'role_name', r.name,
                'role_description', r.description,
                'role_active', r.is_active,
                'granted_at', ur.created_at
            )
        ) FILTER (WHERE r.role_id IS NOT NULL),
        '[]'::json
    ) AS roles,
    -- Permissões (JSON agregado)
    COALESCE(
        json_agg(
            DISTINCT jsonb_build_object(
                'permission_id', p.permission_id,
                'permission_name', p.name,
                'resource', p.resource,
                'action', p.action,
                'description', p.description
            )
        ) FILTER (WHERE p.permission_id IS NOT NULL),
        '[]'::json
    ) AS permissions,
    -- Contagem de roles e permissões
    COUNT(DISTINCT r.role_id) AS role_count,
    COUNT(DISTINCT p.permission_id) AS permission_count
FROM users u
LEFT JOIN clients c ON u.client_id = c.client_id
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.role_id
LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.permission_id
WHERE 1=1
    -- Filtros dinâmicos
    -- AND u.id = :user_id
    -- AND r.role_id = :role_id
    -- AND u.client_id = :client_id
    -- AND u.is_active = :is_active
    -- AND r.name = :role_name
    -- AND c.active = true
GROUP BY 
    u.id, u.username, u.email, u.name, u.role, u.is_active, u.last_login, u.created_at,
    c.client_id, c.name, c.email, c.phone, c.active
ORDER BY u.created_at DESC
-- LIMIT :limit OFFSET :offset

-- G2. Logs de Auditoria com Contexto Completo
-- Objetivo: Ver histórico de ações com contexto completo
-- Uso: Auditoria, Segurança, Compliance
-- Parâmetros: user_id (opcional), entity (opcional), entity_id (opcional),
--             action (opcional), start_date (opcional), end_date (opcional)
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
LEFT JOIN clients c ON u.client_id = c.client_id
WHERE 1=1
    -- Filtros dinâmicos
    -- AND al.user_id = :user_id
    -- AND al.entity = :entity
    -- AND al.entity_id = :entity_id
    -- AND al.action = :action
    -- AND al.timestamp >= :start_date
    -- AND al.timestamp <= :end_date
    -- AND u.is_active = true
ORDER BY al.timestamp DESC
-- LIMIT :limit OFFSET :offset

-- G3. Atividades de Usuários por Período
-- Objetivo: Analisar atividade de usuários ao longo do tempo
-- Uso: Analytics, Segurança, Auditoria
-- Parâmetros: user_id (opcional), client_id (opcional), start_date (opcional),
--             end_date (opcional), granularity ('day'|'hour')
SELECT 
    DATE_TRUNC(
        CASE 
            WHEN :granularity = 'hour' THEN 'hour'
            ELSE 'day'
        END,
        al.timestamp
    ) AS period,
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
WHERE 1=1
    -- Filtros dinâmicos
    -- AND al.user_id = :user_id
    -- AND u.client_id = :client_id
    -- AND al.timestamp >= :start_date
    -- AND al.timestamp <= :end_date
    -- AND u.is_active = true
GROUP BY 
    DATE_TRUNC(
        CASE 
            WHEN :granularity = 'hour' THEN 'hour'
            ELSE 'day'
        END,
        al.timestamp
    ),
    u.id, u.username, u.name, u.role,
    c.client_id, c.name
ORDER BY period DESC, total_actions DESC
-- LIMIT :limit OFFSET :offset

-- G4. Permissões por Role e Recurso
-- Objetivo: Ver mapeamento completo de permissões por role
-- Uso: Administração, Configuração, Segurança
-- Parâmetros: role_id (opcional), resource (opcional), action (opcional)
SELECT 
    r.role_id,
    r.name AS role_name,
    r.description AS role_description,
    r.is_active AS role_active,
    -- Permissões (JSON agregado)
    COALESCE(
        json_agg(
            DISTINCT jsonb_build_object(
                'permission_id', p.permission_id,
                'permission_name', p.name,
                'resource', p.resource,
                'action', p.action,
                'description', p.description
            )
            ORDER BY p.resource, p.action
        ) FILTER (WHERE p.permission_id IS NOT NULL),
        '[]'::json
    ) AS permissions,
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
WHERE 1=1
    -- Filtros dinâmicos
    -- AND r.role_id = :role_id
    -- AND p.resource = :resource
    -- AND p.action = :action
    -- AND r.is_active = true
GROUP BY 
    r.role_id, r.name, r.description, r.is_active
ORDER BY r.name
-- LIMIT :limit OFFSET :offset

-- =============================================
-- A. GESTÃO DE TOTEMS E LOCALIZAÇÃO
-- =============================================

-- A1. Lista de Totems com Localização Completa
-- Objetivo: Visualizar totems com informações de local, host e cliente
-- Uso: Dashboard, Monitoramento, Administração
-- Parâmetros: totem_id (opcional), host_id (opcional), local_id (opcional),
--             client_id (opcional), status (opcional), active (opcional)
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
WHERE 1=1
    -- Filtros dinâmicos
    -- AND t.totem_id = :totem_id
    -- AND h.host_id = :host_id
    -- AND l.local_id = :local_id
    -- AND c.client_id = :client_id
    -- AND t.status = :status
    -- AND t.active = :active
    -- AND h.active = true
    -- AND l.active = true
GROUP BY 
    t.totem_id, t.identifier, t.uin, t.device_id, t.description, t.status,
    t.version, t.firmware_version, t.ip_address, t.last_seen, t.last_heartbeat,
    t.active, t.blocked, t.blocked_until, t.created_at, t.updated_at,
    l.local_id, l.description, l.active,
    h.host_id, h.name, h.contact_name, h.email, h.phone, h.wths, h.description, h.active,
    c.client_id, c.name, c.contact_name, c.email, c.phone,
    st.smartv_id, st.brand, st.model, st.ip_address, st.active
ORDER BY t.last_heartbeat DESC NULLS LAST, t.created_at DESC
-- LIMIT :limit OFFSET :offset

-- =============================================
-- B. GESTÃO DE CAMPANHAS
-- =============================================

-- B1. Campanhas com Detalhes Completos
-- Objetivo: Visualizar campanhas com todos os detalhes relacionados
-- Uso: Dashboard, Administração, Relatórios
-- Parâmetros: campaign_id (opcional), client_id (opcional), status (opcional),
--             campaign_type (opcional), is_active (opcional), start_date (opcional), end_date (opcional)
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
WHERE 1=1
    -- Filtros dinâmicos
    -- AND camp.campaign_id = :campaign_id
    -- AND camp.client_id = :client_id
    -- AND camp.status = :status
    -- AND camp.campaign_type = :campaign_type
    -- AND camp.is_active = :is_active
    -- AND camp.start_date >= :start_date
    -- AND camp.end_date <= :end_date
    -- AND c.active = true
GROUP BY 
    camp.campaign_id, camp.title, camp.description, camp.campaign_type, camp.priority,
    camp.start_date, camp.end_date, camp.start_time, camp.end_time, camp.days_of_week,
    camp.status, camp.is_active, camp.created_at, camp.updated_at,
    c.client_id, c.name, c.contact_name, c.email, c.phone, c.active
ORDER BY camp.created_at DESC
-- LIMIT :limit OFFSET :offset

-- =============================================
-- C. GESTÃO DE MÍDIAS
-- =============================================

-- C1. Mídias com Detalhes e Workflow
-- Objetivo: Visualizar mídias com informações de aprovação e uso
-- Uso: Dashboard, Administração, Workflow
-- Parâmetros: media_id (opcional), client_id (opcional), status (opcional),
--             media_type (opcional), workflow_status (opcional), created_by (opcional)
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
WHERE 1=1
    -- Filtros dinâmicos
    -- AND m.media_id = :media_id
    -- AND m.client_id = :client_id
    -- AND m.status = :status
    -- AND m.media_type = :media_type
    -- AND aw.status = :workflow_status
    -- AND m.created_by = :created_by
    -- AND c.active = true
GROUP BY 
    m.media_id, m.name, m.title, m.description, m.tags, m.version, m.checksum,
    m.preview_url, m.status, m.file_path, m.media_type, m.duration_seconds,
    m.size_bytes, m.mime_type, m.width, m.height, m.created_at, m.updated_at,
    c.client_id, c.name, c.email, c.active,
    u.id, u.username, u.name, u.role,
    aw.id, aw.status, aw.reviewed_at, aw.comment,
    reviewer.id, reviewer.username, reviewer.name
ORDER BY m.created_at DESC
-- LIMIT :limit OFFSET :offset

-- =============================================
-- D. ANALYTICS E RELATÓRIOS
-- =============================================

-- D1. Sessões de Analytics por Totem com Demografia
-- Objetivo: Analisar interações por totem com informações demográficas
-- Uso: Analytics, Relatórios, Marketing
-- Parâmetros: totem_id (opcional), session_id (opcional), start_date (opcional),
--             end_date (opcional), host_id (opcional), client_id (opcional)
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
WHERE 1=1
    -- Filtros dinâmicos
    -- AND asess.totem_id = :totem_id
    -- AND asess.id = :session_id
    -- AND asess.session_start >= :start_date
    -- AND asess.session_end <= :end_date
    -- AND h.host_id = :host_id
    -- AND c.client_id = :client_id
    -- AND t.active = true
GROUP BY 
    asess.id, asess.session_start, asess.session_end, asess.total_interactions,
    asess.avg_emotion_score, asess.dominant_emotion, asess.age_range, asess.gender,
    asess.location, asess.created_at,
    t.totem_id, t.identifier, t.status,
    l.local_id, l.description,
    h.host_id, h.name,
    c.client_id, c.name
ORDER BY asess.session_start DESC
-- LIMIT :limit OFFSET :offset

-- =============================================
-- H. EXPORTAÇÃO (Novo Sistema)
-- =============================================

-- H1. Queries de Exportação com Criador
-- Objetivo: Ver queries de exportação com informações do criador
-- Uso: Administração, Auditoria
-- Parâmetros: query_id (opcional), created_by (opcional), provider (opcional),
--             enabled (opcional)
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
    MAX(ee.executed_at) AS last_execution
FROM export_queries eq
LEFT JOIN users u ON eq.created_by = u.id
LEFT JOIN export_schedules es ON eq.query_id = es.query_id
LEFT JOIN export_executions ee ON eq.query_id = ee.query_id
WHERE 1=1
    -- Filtros dinâmicos
    -- AND eq.query_id = :query_id
    -- AND eq.created_by = :created_by
    -- AND eq.provider = :provider
    -- AND eq.enabled = :enabled
GROUP BY 
    eq.query_id, eq.name, eq.description, eq.provider, eq.sql_query,
    eq.database_config, eq.export_config, eq.enabled, eq.created_at, eq.updated_at,
    u.id, u.username, u.name, u.email, u.role
ORDER BY eq.created_at DESC
-- LIMIT :limit OFFSET :offset

-- H2. Agendamentos de Exportação Completos
-- Objetivo: Ver agendamentos com query e criador
-- Uso: Administração, Monitoramento
-- Parâmetros: schedule_id (opcional), query_id (opcional), enabled (opcional),
--             created_by (opcional)
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
WHERE 1=1
    -- Filtros dinâmicos
    -- AND es.schedule_id = :schedule_id
    -- AND es.query_id = :query_id
    -- AND es.enabled = :enabled
    -- AND es.created_by = :created_by
GROUP BY 
    es.schedule_id, es.name, es.description, es.cron_expression, es.enabled,
    es.last_execution, es.next_execution, es.execution_count, es.success_count,
    es.failure_count, es.created_at, es.updated_at,
    eq.query_id, eq.name, eq.provider, eq.enabled,
    u.id, u.username, u.name, u.role
ORDER BY es.created_at DESC
-- LIMIT :limit OFFSET :offset

-- H3. Histórico de Execuções Completo
-- Objetivo: Ver histórico completo de execuções com detalhes
-- Uso: Debug, Auditoria, Relatórios
-- Parâmetros: execution_id (opcional), schedule_id (opcional), query_id (opcional),
--             status (opcional), start_date (opcional), end_date (opcional)
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
LEFT JOIN users u ON es.created_by = u.id
WHERE 1=1
    -- Filtros dinâmicos
    -- AND ee.execution_id = :execution_id
    -- AND ee.schedule_id = :schedule_id
    -- AND ee.query_id = :query_id
    -- AND ee.status = :status
    -- AND ee.started_at >= :start_date
    -- AND ee.completed_at <= :end_date
ORDER BY ee.started_at DESC NULLS LAST, ee.created_at DESC
-- LIMIT :limit OFFSET :offset

-- =============================================
-- FIM DAS QUERIES TEMPLATE
-- =============================================

