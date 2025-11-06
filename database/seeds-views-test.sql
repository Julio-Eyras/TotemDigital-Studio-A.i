-- =============================================
-- SEEDS PARA TESTE DAS VIEWs - Smart Signage v2.1
-- =============================================
-- Dados de exemplo para testar todas as views criadas
-- Executar após init-data.sql e views-schema.sql
-- =============================================

-- =============================================
-- E. EXECUÇÃO E MONITORAMENTO
-- =============================================

-- Execution Logs (para testar v_execution_logs_complete)
INSERT INTO execution_logs (totem_id, client_id, campaign_id, media_id, executed_at, start_time, end_time, duration_seconds, status, play_success, error_code) VALUES
-- Logs recentes (últimas 24h)
(1, 1, 1, 1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours' + INTERVAL '10 seconds', 10, 'executed', true, NULL),
(1, 1, 1, 2, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour' + INTERVAL '30 seconds', 30, 'executed', true, NULL),
(2, 1, 1, 1, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes' + INTERVAL '10 seconds', 10, 'executed', true, NULL),
(2, 1, 1, 2, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes' + INTERVAL '30 seconds', 30, 'executed', true, NULL),
(3, 1, 1, 1, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes' + INTERVAL '10 seconds', 10, 'executed', true, NULL),
-- Logs com erro
(4, 2, 2, 3, NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '45 minutes' + INTERVAL '5 seconds', 5, 'executed', false, 'MEDIA_NOT_FOUND'),
(5, 2, 2, 3, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour' + INTERVAL '3 seconds', 3, 'executed', false, 'NETWORK_ERROR'),
-- Logs antigos (última semana)
(1, 1, 1, 1, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '10 seconds', 10, 'executed', true, NULL),
(1, 1, 1, 2, NOW() - INTERVAL '3 days' + INTERVAL '1 hour', NOW() - INTERVAL '3 days' + INTERVAL '1 hour', NOW() - INTERVAL '3 days' + INTERVAL '1 hour 30 seconds', 30, 'executed', true, NULL),
(2, 1, 1, 1, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '10 seconds', 10, 'executed', true, NULL),
(6, 3, 3, 4, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' + INTERVAL '12 seconds', 12, 'executed', true, NULL),
-- Logs por hora (para testar v_execution_stats_hourly)
(1, 1, 1, 1, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '59 minutes', 60, 'executed', true, NULL),
(1, 1, 1, 2, NOW() - INTERVAL '1 hour' + INTERVAL '10 minutes', NOW() - INTERVAL '1 hour' + INTERVAL '10 minutes', NOW() - INTERVAL '50 minutes', 30, 'executed', true, NULL),
(2, 1, 1, 1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 50 minutes', 60, 'executed', true, NULL),
(2, 1, 1, 2, NOW() - INTERVAL '2 hours' + INTERVAL '15 minutes', NOW() - INTERVAL '2 hours' + INTERVAL '15 minutes', NOW() - INTERVAL '1 hour 45 minutes', 30, 'executed', true, NULL);

-- Remote Commands (para testar v_remote_commands_complete)
INSERT INTO remote_commands (totem_id, request_id, command_type, command_data, priority, status, created_at, executed_at, result, created_by) VALUES
(1, 'CMD-001', 'update_playlist', '{"playlist_id": 1}', 1, 'completed', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '55 minutes', '{"success": true}', 1),
(1, 'CMD-002', 'change_brightness', '{"brightness": 90}', 2, 'completed', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '25 minutes', '{"success": true, "new_brightness": 90}', 1),
(2, 'CMD-003', 'reboot', '{"delay": 60}', 1, 'pending', NOW() - INTERVAL '10 minutes', NULL, NULL, 2),
(3, 'CMD-004', 'play_media', '{"media_id": 1}', 3, 'completed', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '4 minutes', '{"success": true}', 1),
(4, 'CMD-005', 'update_playlist', '{"playlist_id": 3}', 1, 'executing', NOW() - INTERVAL '2 minutes', NULL, NULL, 3),
(5, 'CMD-006', 'change_brightness', '{"brightness": 75}', 2, 'failed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours 55 minutes', '{"error": "Device offline"}', 2);

-- =============================================
-- G. RBAC E AUDITORIA
-- =============================================

-- Audit Logs (para testar v_audit_logs_complete e v_user_activities_daily)
INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, timestamp) VALUES
-- Ações de hoje
(1, 'login', 'auth', NULL, '{"ip": "192.168.1.50", "userAgent": "Mozilla/5.0"}', NOW() - INTERVAL '2 hours'),
(2, 'create', 'campaign', 1, '{"title": "Promoção Black Friday"}', NOW() - INTERVAL '1 hour 30 minutes'),
(1, 'update', 'media', 1, '{"field": "status", "old_value": "draft", "new_value": "published"}', NOW() - INTERVAL '1 hour'),
(3, 'create', 'totem', 4, '{"identifier": "TOTEM-FARMACIA-001"}', NOW() - INTERVAL '45 minutes'),
(1, 'approve', 'media', 2, '{"reason": "Aprovado para publicação"}', NOW() - INTERVAL '30 minutes'),
(2, 'delete', 'campaign', 5, '{"title": "Campanha Antiga"}', NOW() - INTERVAL '15 minutes'),
(1, 'login', 'auth', NULL, '{"ip": "192.168.1.50", "userAgent": "Mozilla/5.0"}', NOW() - INTERVAL '10 minutes'),
-- Ações dos últimos dias
(1, 'create', 'user', 5, '{"username": "operador.shopping"}', NOW() - INTERVAL '1 day'),
(2, 'update', 'campaign', 1, '{"field": "status", "old_value": "draft", "new_value": "active"}', NOW() - INTERVAL '1 day' + INTERVAL '2 hours'),
(1, 'delete', 'media', 7, '{"name": "Mídia Antiga"}', NOW() - INTERVAL '2 days'),
(3, 'create', 'client', 6, '{"name": "Academia FitLife"}', NOW() - INTERVAL '3 days'),
(1, 'login', 'auth', NULL, '{"ip": "192.168.1.50"}', NOW() - INTERVAL '3 days'),
(2, 'update', 'totem', 1, '{"field": "status", "old_value": "offline", "new_value": "online"}', NOW() - INTERVAL '4 days'),
(1, 'approve', 'media', 3, '{"reason": "Aprovado"}', NOW() - INTERVAL '5 days'),
(1, 'logout', 'auth', NULL, '{}', NOW() - INTERVAL '6 days');

-- User Roles (para testar v_users_with_roles)
INSERT INTO roles (role_id, name, description, is_active) VALUES
(1, 'admin', 'Administrador do sistema', true),
(2, 'manager', 'Gerente de campanhas', true),
(3, 'operator', 'Operador de totens', true),
(4, 'viewer', 'Visualizador de relatórios', true),
(5, 'client', 'Cliente final', true)
ON CONFLICT DO NOTHING;

INSERT INTO permissions (permission_id, name, resource, action, description) VALUES
(1, 'media.create', 'media', 'create', 'Criar mídias'),
(2, 'media.read', 'media', 'read', 'Visualizar mídias'),
(3, 'media.update', 'media', 'update', 'Atualizar mídias'),
(4, 'media.delete', 'media', 'delete', 'Excluir mídias'),
(5, 'campaign.create', 'campaign', 'create', 'Criar campanhas'),
(6, 'campaign.read', 'campaign', 'read', 'Visualizar campanhas'),
(7, 'campaign.update', 'campaign', 'update', 'Atualizar campanhas'),
(8, 'campaign.delete', 'campaign', 'delete', 'Excluir campanhas'),
(9, 'totem.read', 'totem', 'read', 'Visualizar totens'),
(10, 'totem.update', 'totem', 'update', 'Atualizar totens'),
(11, 'analytics.read', 'analytics', 'read', 'Visualizar analytics'),
(12, 'user.create', 'user', 'create', 'Criar usuários'),
(13, 'user.read', 'user', 'read', 'Visualizar usuários'),
(14, 'user.update', 'user', 'update', 'Atualizar usuários'),
(15, 'user.delete', 'user', 'delete', 'Excluir usuários')
ON CONFLICT DO NOTHING;

-- Atribuir roles aos usuários
INSERT INTO user_roles (user_id, role_id, granted_by) VALUES
(1, 1, 1), -- admin tem role admin
(2, 2, 1), -- maria.silva tem role manager
(3, 2, 1), -- joao.santos tem role manager
(4, 2, 1), -- ana.costa tem role manager
(5, 3, 1), -- operador.shopping tem role operator
(6, 3, 1), -- operador.farmacia tem role operator
(7, 4, 1)  -- viewer.relatorios tem role viewer
ON CONFLICT DO NOTHING;

-- Atribuir permissões às roles
INSERT INTO role_permissions (role_id, permission_id) VALUES
-- Admin tem todas as permissões
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10), (1, 11), (1, 12), (1, 13), (1, 14), (1, 15),
-- Manager tem permissões de campanha e mídia
(2, 1), (2, 2), (2, 3), (2, 4), (2, 5), (2, 6), (2, 7), (2, 8), (2, 9), (2, 11),
-- Operator tem permissões de leitura e atualização de totens
(3, 2), (3, 6), (3, 9), (3, 10), (3, 11),
-- Viewer tem apenas leitura
(4, 2), (4, 6), (4, 9), (4, 11)
ON CONFLICT DO NOTHING;

-- =============================================
-- D. ANALYTICS E RELATÓRIOS
-- =============================================

-- Analytics Sessions (para testar v_analytics_sessions_complete)
INSERT INTO analytics_sessions (totem_id, session_start, session_end, total_interactions, avg_emotion_score, dominant_emotion, age_range, gender, location) VALUES
(1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 50 minutes', 15, 75.5, 'happy', '25-35', 'M', 'Entrada Principal'),
(1, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '45 minutes', 8, 68.2, 'neutral', '18-25', 'F', 'Entrada Principal'),
(2, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '20 minutes', 12, 82.1, 'happy', '35-50', 'M', 'Praça Alimentação'),
(2, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '5 minutes', 5, 55.0, 'sad', '25-35', 'F', 'Praça Alimentação'),
(3, NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours 45 minutes', 20, 78.9, 'happy', '18-25', 'M', 'Área Cinema'),
(4, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day 23 hours 50 minutes', 10, 72.3, 'neutral', '35-50', 'F', 'Farmácia Matriz');

-- Analytics Emotions (para testar v_analytics_sessions_complete)
INSERT INTO analytics_emotions (session_id, emotion, confidence, timestamp, face_detected) VALUES
-- Sessão 1
(1, 'happy', 85.5, NOW() - INTERVAL '2 hours', true),
(1, 'happy', 82.3, NOW() - INTERVAL '1 hour 55 minutes', true),
(1, 'neutral', 70.0, NOW() - INTERVAL '1 hour 52 minutes', true),
(1, 'happy', 88.1, NOW() - INTERVAL '1 hour 50 minutes', true),
-- Sessão 2
(2, 'neutral', 65.0, NOW() - INTERVAL '1 hour', true),
(2, 'sad', 55.2, NOW() - INTERVAL '55 minutes', true),
(2, 'neutral', 68.5, NOW() - INTERVAL '50 minutes', true),
(2, 'neutral', 72.0, NOW() - INTERVAL '45 minutes', true),
-- Sessão 3
(3, 'happy', 90.0, NOW() - INTERVAL '30 minutes', true),
(3, 'happy', 85.5, NOW() - INTERVAL '25 minutes', true),
(3, 'surprised', 78.2, NOW() - INTERVAL '20 minutes', true);

-- Analytics Gestures (para testar v_analytics_sessions_complete)
INSERT INTO analytics_gestures (session_id, gesture_type, coordinates, confidence, timestamp, action_triggered) VALUES
(1, 'wave', '{"x": 100, "y": 200}', 85.5, NOW() - INTERVAL '2 hours', 'play_media'),
(1, 'point', '{"x": 300, "y": 400}', 82.3, NOW() - INTERVAL '1 hour 55 minutes', 'show_info'),
(2, 'thumbs_up', '{"x": 150, "y": 250}', 90.0, NOW() - INTERVAL '1 hour', 'like_content'),
(3, 'wave', '{"x": 200, "y": 300}', 88.1, NOW() - INTERVAL '30 minutes', 'play_media'),
(3, 'point', '{"x": 400, "y": 500}', 75.5, NOW() - INTERVAL '25 minutes', 'show_info');

-- Analytics QR Scans
INSERT INTO analytics_qr_scans (qr_code_id, totem_id, scan_timestamp, user_agent, ip_address, location) VALUES
(1, 1, NOW() - INTERVAL '1 hour', 'Mozilla/5.0 (iPhone)', '192.168.1.150', 'Shopping Center Norte'),
(1, 1, NOW() - INTERVAL '45 minutes', 'Mozilla/5.0 (Android)', '192.168.1.151', 'Shopping Center Norte'),
(2, 2, NOW() - INTERVAL '30 minutes', 'Mozilla/5.0 (iPhone)', '192.168.1.152', 'Shopping Center Norte'),
(2, 2, NOW() - INTERVAL '15 minutes', 'Mozilla/5.0 (Android)', '192.168.1.153', 'Shopping Center Norte'),
(3, 4, NOW() - INTERVAL '1 day', 'Mozilla/5.0 (iPhone)', '192.168.2.150', 'Farmácia Central');

-- =============================================
-- H. EXPORTAÇÃO (Novo Sistema)
-- =============================================

-- Export Queries (para testar v_export_queries_complete)
INSERT INTO export_queries (query_id, name, description, provider, sql_query, database_config, export_config, enabled, created_by) VALUES
(1, 'Logs de Execução Diários', 'Exporta logs de execução do último dia', 'PostgreSQL', 'SELECT * FROM v_execution_logs_complete WHERE executed_at >= CURRENT_DATE', '{}', '{"outputDirectory": "./exports", "fileName": "execution_logs", "format": "xlsx", "sheetName": "Logs", "applyFormatting": true, "timestampSuffix": true}', true, 1),
(2, 'Estatísticas de Campanhas', 'Exporta estatísticas agregadas de campanhas', 'PostgreSQL', 'SELECT * FROM v_campaigns_complete WHERE campaign_active = true', '{}', '{"outputDirectory": "./exports", "fileName": "campaign_stats", "format": "pdf", "applyFormatting": true, "timestampSuffix": true}', true, 1),
(3, 'Usuários e Permissões', 'Exporta lista de usuários com suas permissões', 'PostgreSQL', 'SELECT * FROM v_users_with_roles ORDER BY user_created_at DESC', '{}', '{"outputDirectory": "./exports", "fileName": "users_roles", "format": "csv", "applyFormatting": false, "timestampSuffix": true}', true, 1),
(4, 'Analytics por Totem', 'Exporta sessões de analytics por totem', 'PostgreSQL', 'SELECT * FROM v_analytics_sessions_complete WHERE session_start >= CURRENT_DATE - INTERVAL ''7 days''', '{}', '{"outputDirectory": "./exports", "fileName": "analytics_sessions", "format": "xlsx", "sheetName": "Analytics", "applyFormatting": true, "timestampSuffix": true}', true, 2)
ON CONFLICT DO NOTHING;

-- Export Schedules (para testar v_export_schedules_complete)
INSERT INTO export_schedules (schedule_id, name, description, query_id, cron_expression, enabled, last_execution, next_execution, execution_count, success_count, failure_count, created_by) VALUES
(1, 'Exportação Diária de Logs', 'Exporta logs de execução diariamente às 8h', 1, '0 8 * * *', true, NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day', 30, 28, 2, 1),
(2, 'Exportação Semanal de Campanhas', 'Exporta estatísticas de campanhas semanalmente', 2, '0 9 * * 1', true, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' + INTERVAL '1 week', 4, 4, 0, 1),
(3, 'Exportação Mensal de Usuários', 'Exporta lista de usuários mensalmente', 3, '0 10 1 * *', true, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days' + INTERVAL '1 month', 1, 1, 0, 1),
(4, 'Exportação Diária de Analytics', 'Exporta analytics diariamente às 18h', 4, '0 18 * * *', false, NULL, NULL, 0, 0, 0, 2)
ON CONFLICT DO NOTHING;

-- Export Executions (para testar v_export_executions_complete)
INSERT INTO export_executions (execution_id, schedule_id, query_id, job_id, status, started_at, completed_at, records_exported, file_path, file_size, error_message, execution_log) VALUES
(1, 1, 1, 'job-001', 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '5 seconds', 150, './exports/execution_logs_2024-01-15_08-00-00.xlsx', 1024000, NULL, 'Exportação concluída: 150 registros em 5.00s'),
(2, 1, 1, 'job-002', 'completed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '4 seconds', 142, './exports/execution_logs_2024-01-14_08-00-00.xlsx', 980000, NULL, 'Exportação concluída: 142 registros em 4.00s'),
(3, 1, 1, 'job-003', 'failed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '2 seconds', 0, NULL, NULL, 'Erro ao conectar ao banco de dados', 'Erro: Connection timeout'),
(4, 2, 2, 'job-004', 'completed', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' + INTERVAL '8 seconds', 25, './exports/campaign_stats_2024-01-08_09-00-00.pdf', 2048000, NULL, 'Exportação concluída: 25 registros em 8.00s'),
(5, 3, 3, 'job-005', 'completed', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days' + INTERVAL '3 seconds', 7, './exports/users_roles_2023-12-01_10-00-00.csv', 51200, NULL, 'Exportação concluída: 7 registros em 3.00s'),
(6, 1, 1, 'job-006', 'running', NOW() - INTERVAL '5 minutes', NULL, 0, NULL, NULL, NULL, 'Exportação em andamento...')
ON CONFLICT DO NOTHING;

-- =============================================
-- DADOS ADICIONAIS PARA TESTES
-- =============================================

-- Campaign Totems (para relacionar campanhas com totens)
INSERT INTO campaign_totems (totem_id, campaign_id, scheduled_start, scheduled_end, status, config, is_active) VALUES
(1, 1, NOW() - INTERVAL '1 day', NOW() + INTERVAL '10 days', 'active', '{}', true),
(2, 1, NOW() - INTERVAL '1 day', NOW() + INTERVAL '10 days', 'active', '{}', true),
(3, 1, NOW() - INTERVAL '1 day', NOW() + INTERVAL '10 days', 'active', '{}', true),
(4, 2, NOW() - INTERVAL '30 days', NOW() + INTERVAL '60 days', 'active', '{}', true),
(5, 2, NOW() - INTERVAL '30 days', NOW() + INTERVAL '60 days', 'active', '{}', true),
(6, 3, NOW() - INTERVAL '30 days', NOW() + INTERVAL '60 days', 'active', '{}', true)
ON CONFLICT DO NOTHING;

-- Campaign Playlists
INSERT INTO campaign_playlists (campaign_id, playlist_id, priority, active) VALUES
(1, 1, 1, true),
(1, 2, 2, true),
(2, 3, 1, true),
(3, 4, 1, true)
ON CONFLICT DO NOTHING;

-- Approval Workflows (para testar v_medias_complete)
INSERT INTO approval_workflows (media_id, status, reviewed_by, reviewed_at, comment) VALUES
(1, 'approved', 1, NOW() - INTERVAL '2 days', 'Aprovado para publicação'),
(2, 'approved', 1, NOW() - INTERVAL '1 day', 'Aprovado'),
(3, 'review', NULL, NULL, NULL),
(4, 'approved', 2, NOW() - INTERVAL '3 days', 'Aprovado'),
(5, 'rejected', 1, NOW() - INTERVAL '5 days', 'Qualidade insuficiente')
ON CONFLICT DO NOTHING;

-- =============================================
-- FIM DOS SEEDS
-- =============================================

-- Verificar contagens
SELECT 
    'Execution Logs' AS tabela, COUNT(*) AS registros FROM execution_logs
UNION ALL
SELECT 'Remote Commands', COUNT(*) FROM remote_commands
UNION ALL
SELECT 'Audit Logs', COUNT(*) FROM audit_logs
UNION ALL
SELECT 'Analytics Sessions', COUNT(*) FROM analytics_sessions
UNION ALL
SELECT 'Analytics Emotions', COUNT(*) FROM analytics_emotions
UNION ALL
SELECT 'Analytics Gestures', COUNT(*) FROM analytics_gestures
UNION ALL
SELECT 'Export Queries', COUNT(*) FROM export_queries
UNION ALL
SELECT 'Export Schedules', COUNT(*) FROM export_schedules
UNION ALL
SELECT 'Export Executions', COUNT(*) FROM export_executions;

