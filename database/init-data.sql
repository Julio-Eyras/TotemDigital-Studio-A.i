-- Smart Signage Pro v2.0 - Dados de Exemplo PostgreSQL
-- Arquivo: database/init-data.sql
-- Compatível com PostgreSQL 15+

-- =============================================
-- LIMPEZA E PREPARAÇÃO
-- =============================================

-- Desabilitar triggers temporariamente para inserção em massa
-- Nota: session_replication_role requer privilégios superuser
-- Removido para permitir execução com usuário normal
-- SET session_replication_role = replica;

-- =============================================
-- DADOS DE EXEMPLO - CLIENTES
-- =============================================

INSERT INTO clients (client_id, name, contact_name, email, phone, wths, active) VALUES 
(1, 'Shopping Center Norte', 'Maria Silva', 'maria.silva@shoppingnorte.com.br', '+55 11 3456-7890', '+55 11 98765-4321', true),
(2, 'Rede de Farmácias Saúde+', 'João Santos', 'joao.santos@saudemais.com.br', '+55 11 2345-6789', '+55 11 87654-3210', true),
(3, 'Supermercado Econômico', 'Ana Costa', 'ana.costa@economico.com.br', '+55 11 1234-5678', '+55 11 76543-2109', true),
(4, 'Restaurante Sabor & Arte', 'Carlos Oliveira', 'carlos.oliveira@saborearte.com.br', '+55 11 4567-8901', '+55 11 65432-1098', true),
(5, 'Clínica Médica Vida Saudável', 'Dr. Roberto Lima', 'roberto.lima@vidasaudavel.com.br', '+55 11 5678-9012', '+55 11 54321-0987', true),
(6, 'Academia FitLife', 'Patricia Mendes', 'patricia.mendes@fitlife.com.br', '+55 11 6789-0123', '+55 11 43210-9876', true),
(7, 'Loja de Eletrônicos TechStore', 'Fernando Alves', 'fernando.alves@techstore.com.br', '+55 11 7890-1234', '+55 11 32109-8765', true),
(8, 'Salão de Beleza Glamour', 'Lucia Ferreira', 'lucia.ferreira@glamour.com.br', '+55 11 8901-2345', '+55 11 21098-7654', true);

-- =============================================
-- DADOS DE EXEMPLO - HOSTS E LOCAIS
-- =============================================

INSERT INTO hosts (host_id, name, contact_name, email, phone, wths, description, active) VALUES 
(1, 'Shopping Center Norte - Administração', 'Maria Silva', 'admin@shoppingnorte.com.br', '+55 11 3456-7890', '+55 11 98765-4321', 'Administração do shopping', true),
(2, 'Farmácia Central - Matriz', 'João Santos', 'matriz@saudemais.com.br', '+55 11 2345-6789', '+55 11 87654-3210', 'Matriz da rede de farmácias', true),
(3, 'Supermercado Econômico - Filial Centro', 'Ana Costa', 'centro@economico.com.br', '+55 11 1234-5678', '+55 11 76543-2109', 'Filial central do supermercado', true);

INSERT INTO locals (local_id, host_id, description, active) VALUES 
('SHOPPING-NORTE-ENTRADA', 1, 'Entrada principal do shopping', true),
('SHOPPING-NORTE-PRACA', 1, 'Praça de alimentação', true),
('SHOPPING-NORTE-CINEMA', 1, 'Área do cinema', true),
('FARMACIA-CENTRAL-MATRIZ', 2, 'Farmácia matriz - centro', true),
('FARMACIA-CENTRAL-FILIAL1', 2, 'Farmácia filial - zona sul', true),
('FARMACIA-CENTRAL-FILIAL2', 2, 'Farmácia filial - zona norte', true),
('SUPER-CENTRO-CAIXA', 3, 'Área de caixas do supermercado', true),
('SUPER-CENTRO-ACOUGUE', 3, 'Seção de açougue', true);

-- =============================================
-- DADOS DE EXEMPLO - USUÁRIOS
-- =============================================

-- Hash da senha 'admin123' usando bcrypt
INSERT INTO users (id, client_id, username, email, password_hash, name, role, is_active, last_login) VALUES 
(1, NULL, 'admin', 'admin@smartsignage.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4Kz8K2', 'Administrador', 'admin', true, NOW()),
(2, 1, 'maria.silva', 'maria.silva@shoppingnorte.com.br', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4Kz8K2', 'Maria Silva', 'manager', true, NOW()),
(3, 2, 'joao.santos', 'joao.santos@farmaciapop.com.br', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4Kz8K2', 'João Santos', 'manager', true, NOW()),
(4, 3, 'ana.costa', 'ana.costa@restaurantebomgusto.com.br', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4Kz8K2', 'Ana Costa', 'manager', true, NOW()),
(5, 1, 'operador.shopping', 'operador@shoppingnorte.com.br', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4Kz8K2', 'Operador Shopping', 'operator', true, NOW()),
(6, 2, 'operador.farmacia', 'operador@farmaciapop.com.br', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4Kz8K2', 'Operador Farmácia', 'operator', true, NOW()),
(7, NULL, 'viewer.relatorios', 'viewer@smartsignage.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4Kz8K2', 'Visualizador', 'viewer', true, NOW());

-- =============================================
-- DADOS DE EXEMPLO - TOTEMS
-- =============================================

INSERT INTO totems (totem_id, identifier, uin, device_id, local_id, description, config, status, version, firmware_version, ip_address, last_seen, last_heartbeat, active, blocked) VALUES 
(1, 'TOTEM-SHOPPING-001', 'UIN-SHOPPING-001-2024', 'DEVICE-001', 'SHOPPING-NORTE-ENTRADA', 'Totem Entrada Principal', '{"resolution": "1920x1080", "orientation": "portrait", "brightness": 80}', 'online', '2.0.1', '1.2.3', '192.168.1.100', NOW(), NOW(), true, false),
(2, 'TOTEM-SHOPPING-002', 'UIN-SHOPPING-002-2024', 'DEVICE-002', 'SHOPPING-NORTE-PRACA', 'Totem Praça Alimentação', '{"resolution": "1920x1080", "orientation": "landscape", "brightness": 75}', 'online', '2.0.1', '1.2.3', '192.168.1.101', NOW(), NOW(), true, false),
(3, 'TOTEM-SHOPPING-003', 'UIN-SHOPPING-003-2024', 'DEVICE-003', 'SHOPPING-NORTE-CINEMA', 'Totem Área Cinema', '{"resolution": "1920x1080", "orientation": "portrait", "brightness": 70}', 'online', '2.0.1', '1.2.3', '192.168.1.102', NOW(), NOW(), true, false),
(4, 'TOTEM-FARMACIA-001', 'UIN-FARMACIA-001-2024', 'DEVICE-004', 'FARMACIA-CENTRAL-MATRIZ', 'Totem Farmácia Matriz', '{"resolution": "1920x1080", "orientation": "portrait", "brightness": 85}', 'online', '2.0.1', '1.2.3', '192.168.2.100', NOW(), NOW(), true, false),
(5, 'TOTEM-FARMACIA-002', 'UIN-FARMACIA-002-2024', 'DEVICE-005', 'FARMACIA-CENTRAL-FILIAL1', 'Totem Farmácia Filial Sul', '{"resolution": "1920x1080", "orientation": "portrait", "brightness": 85}', 'online', '2.0.1', '1.2.3', '192.168.2.101', NOW(), NOW(), true, false),
(6, 'TOTEM-SUPER-001', 'UIN-SUPER-001-2024', 'DEVICE-006', 'SUPER-CENTRO-CAIXA', 'Totem Área Caixas', '{"resolution": "1920x1080", "orientation": "landscape", "brightness": 80}', 'online', '2.0.1', '1.2.3', '192.168.3.100', NOW(), NOW(), true, false),
(7, 'TOTEM-SUPER-002', 'UIN-SUPER-002-2024', 'DEVICE-007', 'SUPER-CENTRO-ACOUGUE', 'Totem Seção Açougue', '{"resolution": "1920x1080", "orientation": "portrait", "brightness": 75}', 'offline', '2.0.0', '1.2.2', '192.168.3.101', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', true, false);

-- =============================================
-- DADOS DE EXEMPLO - SMART TVs
-- =============================================

INSERT INTO smart_tvs (smartv_id, totem_id, brand, model, ip_address, config, active) VALUES 
('TV-SHOPPING-001', 1, 'Samsung', 'QN55Q80A', '192.168.1.200', '{"resolution": "3840x2160", "refresh_rate": 60, "hdr": true}', true),
('TV-SHOPPING-002', 2, 'LG', '55NANO75SQA', '192.168.1.201', '{"resolution": "3840x2160", "refresh_rate": 60, "hdr": true}', true),
('TV-SHOPPING-003', 3, 'Samsung', 'QN55Q80A', '192.168.1.202', '{"resolution": "3840x2160", "refresh_rate": 60, "hdr": true}', true),
('TV-FARMACIA-001', 4, 'LG', '43UN7300PUF', '192.168.2.200', '{"resolution": "3840x2160", "refresh_rate": 60, "hdr": false}', true),
('TV-FARMACIA-002', 5, 'LG', '43UN7300PUF', '192.168.2.201', '{"resolution": "3840x2160", "refresh_rate": 60, "hdr": false}', true),
('TV-SUPER-001', 6, 'Samsung', 'UN55TU8000', '192.168.3.200', '{"resolution": "3840x2160", "refresh_rate": 60, "hdr": false}', true),
('TV-SUPER-002', 7, 'Samsung', 'UN55TU8000', '192.168.3.201', '{"resolution": "3840x2160", "refresh_rate": 60, "hdr": false}', true);

-- =============================================
-- DADOS DE EXEMPLO - CAMPANHAS
-- =============================================

INSERT INTO campaigns (campaign_id, client_id, title, description, campaign_type, priority, start_date, end_date, start_time, end_time, days_of_week, status, is_active) VALUES 
(1, 1, 'Promoção Black Friday', 'Campanha especial para Black Friday com ofertas imperdíveis', 'scheduled', 1, '2024-11-20', '2024-11-30', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'active', true),
(2, 2, 'Campanha Medicamentos', 'Promoção de medicamentos genéricos', 'general', 2, '2024-10-01', '2024-12-31', '08:00', '20:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]', 'active', true),
(3, 3, 'Ofertas do Dia', 'Ofertas especiais diárias do supermercado', 'general', 3, '2024-10-01', '2024-12-31', '06:00', '23:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'active', true),
(4, 4, 'Menu Executivo', 'Promoção do menu executivo', 'scheduled', 2, '2024-10-01', '2024-12-31', '11:30', '14:30', '["monday", "tuesday", "wednesday", "thursday", "friday"]', 'active', true),
(5, 5, 'Check-up Preventivo', 'Campanha de conscientização sobre check-up', 'general', 1, '2024-10-01', '2024-12-31', '08:00', '18:00', '["monday", "tuesday", "wednesday", "thursday", "friday"]', 'active', true),
(6, 6, 'Plano Anual', 'Promoção de planos anuais da academia', 'scheduled', 1, '2024-11-01', '2024-12-31', '06:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'active', true);

-- =============================================
-- DADOS DE EXEMPLO - MÍDIAS
-- =============================================

INSERT INTO medias (media_id, client_id, name, title, description, tags, version, checksum, preview_url, status, created_by, file_path, media_type, duration_seconds, size_bytes, mime_type, width, height) VALUES 
(1, 1, 'black-friday-banner.jpg', 'Black Friday 2024', 'Banner principal da Black Friday', '["promocao", "black-friday", "ofertas"]', 1, 'abc123def456', '/previews/black-friday-banner.jpg', 'published', 2, '/media/shopping/black-friday-banner.jpg', 'image', 10, 2048576, 'image/jpeg', 1920, 1080),
(2, 1, 'ofertas-video.mp4', 'Ofertas Imperdíveis', 'Vídeo com as principais ofertas', '["promocao", "video", "ofertas"]', 1, 'def456ghi789', '/previews/ofertas-video.mp4', 'published', 2, '/media/shopping/ofertas-video.mp4', 'video', 30, 15728640, 'video/mp4', 1920, 1080),
(3, 2, 'medicamentos-banner.jpg', 'Medicamentos Genéricos', 'Banner promocional de medicamentos', '["medicamentos", "genericos", "promocao"]', 1, 'ghi789jkl012', '/previews/medicamentos-banner.jpg', 'published', 3, '/media/farmacia/medicamentos-banner.jpg', 'image', 15, 1536000, 'image/jpeg', 1920, 1080),
(4, 3, 'ofertas-dia.jpg', 'Ofertas do Dia', 'Banner com ofertas diárias', '["ofertas", "diarias", "supermercado"]', 1, 'jkl012mno345', '/previews/ofertas-dia.jpg', 'published', 4, '/media/supermercado/ofertas-dia.jpg', 'image', 12, 1024000, 'image/jpeg', 1920, 1080),
(5, 4, 'menu-executivo.jpg', 'Menu Executivo', 'Cardápio do menu executivo', '["menu", "executivo", "restaurante"]', 1, 'mno345pqr678', '/previews/menu-executivo.jpg', 'published', 4, '/media/restaurante/menu-executivo.jpg', 'image', 20, 2560000, 'image/jpeg', 1920, 1080),
(6, 5, 'check-up-video.mp4', 'Check-up Preventivo', 'Vídeo educativo sobre check-up', '["saude", "prevencao", "check-up"]', 1, 'pqr678stu901', '/previews/check-up-video.mp4', 'published', 5, '/media/clinica/check-up-video.mp4', 'video', 45, 25165824, 'video/mp4', 1920, 1080),
(7, 6, 'plano-anual.jpg', 'Plano Anual Academia', 'Banner promocional do plano anual', '["academia", "plano", "anual"]', 1, 'stu901vwx234', '/previews/plano-anual.jpg', 'published', 6, '/media/academia/plano-anual.jpg', 'image', 8, 1280000, 'image/jpeg', 1920, 1080);

-- Mídias de demonstração
INSERT INTO medias (media_id, client_id, name, title, description, tags, version, checksum, preview_url, status, created_by, file_path, media_type, duration_seconds, size_bytes, mime_type, width, height) VALUES
(8, NULL, 'smart-signage-pro-1.jpg', 'Smart Signage-Pro 1', 'Apresentação comercial da solução', '["demo", "comercial"]', 1, 'demo1', '/previews/demo1.jpg', 'published', 1, '/media/demo/smart-signage-pro-1.jpg', 'image', 12, 800000, 'image/jpeg', 1920, 1080),
(9, NULL, 'smart-signage-pro-2.jpg', 'Smart Signage-Pro 2', 'Destaques e funcionalidades', '["demo", "funcionalidades"]', 1, 'demo2', '/previews/demo2.jpg', 'published', 1, '/media/demo/smart-signage-pro-2.jpg', 'image', 12, 900000, 'image/jpeg', 1920, 1080);

-- =============================================
-- DADOS DE EXEMPLO - PLAYLISTS
-- =============================================

INSERT INTO playlists (playlist_id, totem_id, campaign_id, name, description, is_default, medias, loop, config, is_active) VALUES 
(1, 1, 1, 'Playlist Black Friday - Entrada', 'Playlist principal da Black Friday na entrada', true, '[]', true, '{"transition_duration": 2000, "fade_effect": true}', true),
(2, 2, 1, 'Playlist Black Friday - Praça', 'Playlist da Black Friday na praça de alimentação', true, '[]', true, '{"transition_duration": 1500, "fade_effect": true}', true),
(3, 4, 2, 'Playlist Medicamentos', 'Playlist promocional de medicamentos', true, '[]', true, '{"transition_duration": 3000, "fade_effect": false}', true),
(4, 6, 3, 'Playlist Ofertas Supermercado', 'Playlist de ofertas do supermercado', true, '[]', true, '{"transition_duration": 2500, "fade_effect": true}', true);

-- =============================================
-- DADOS DE EXEMPLO - ITENS DE PLAYLIST
-- =============================================

INSERT INTO playlist_items (item_id, playlist_id, media_id, order_index, display_seconds, transition, start_time_offset_seconds) VALUES 
(1, 1, 1, 1, 10, 'fade', 0),
(2, 1, 2, 2, 30, 'slide', 0),
(3, 2, 1, 1, 10, 'fade', 0),
(4, 2, 2, 2, 30, 'slide', 0),
(5, 3, 3, 1, 15, 'fade', 0),
(6, 4, 4, 1, 12, 'fade', 0);

-- =============================================
-- DADOS DE EXEMPLO - CAMPANHAS E PLAYLISTS
-- =============================================

INSERT INTO campaign_playlists (campaign_id, playlist_id, priority, active) VALUES 
(1, 1, 1, true),
(1, 2, 2, true),
(2, 3, 1, true),
(3, 4, 1, true);

-- =============================================
-- DADOS DE EXEMPLO - CAMPANHAS E TOTEMS
-- =============================================

INSERT INTO campaign_totems (totem_id, campaign_id, scheduled_start, scheduled_end, status, config, is_active) VALUES 
(1, 1, '2024-11-20 08:00:00', '2024-11-30 22:00:00', 'active', '{"priority": 1, "override_other_campaigns": true}', true),
(2, 1, '2024-11-20 08:00:00', '2024-11-30 22:00:00', 'active', '{"priority": 1, "override_other_campaigns": true}', true),
(3, 1, '2024-11-20 08:00:00', '2024-11-30 22:00:00', 'active', '{"priority": 1, "override_other_campaigns": true}', true),
(4, 2, '2024-10-01 08:00:00', '2024-12-31 20:00:00', 'active', '{"priority": 2, "override_other_campaigns": false}', true),
(5, 2, '2024-10-01 08:00:00', '2024-12-31 20:00:00', 'active', '{"priority": 2, "override_other_campaigns": false}', true),
(6, 3, '2024-10-01 06:00:00', '2024-12-31 23:00:00', 'active', '{"priority": 3, "override_other_campaigns": false}', true);

-- =============================================
-- DADOS DE EXEMPLO - QR CODES
-- =============================================

INSERT INTO qr_codes (campaign_id, content, qr_type, template, refresh_interval_ms, deeplink_url, utm_params, expires_at, max_scans, scan_count, is_active) VALUES 
(1, 'https://shoppingnorte.com.br/black-friday', 'promotion', 'default', 30000, 'https://shoppingnorte.com.br/black-friday', '{"utm_source": "totem", "utm_medium": "qr", "utm_campaign": "black-friday"}', '2024-11-30 23:59:59', 1000, 0, true),
(2, 'https://saudemais.com.br/promocao-medicamentos', 'promotion', 'pharmacy', 60000, 'https://saudemais.com.br/promocao-medicamentos', '{"utm_source": "totem", "utm_medium": "qr", "utm_campaign": "medicamentos"}', '2024-12-31 23:59:59', 500, 0, true),
(3, 'https://economico.com.br/ofertas-dia', 'promotion', 'supermarket', 30000, 'https://economico.com.br/ofertas-dia', '{"utm_source": "totem", "utm_medium": "qr", "utm_campaign": "ofertas-dia"}', '2024-12-31 23:59:59', 2000, 0, true);

-- =============================================
-- DADOS DE EXEMPLO - LINKS CURTOS
-- =============================================

INSERT INTO short_links (short_id, campaign_id, totem_id, target_url, expires_at, max_scans, scan_count, status) VALUES 
('BF2024', 1, 1, 'https://shoppingnorte.com.br/black-friday', '2024-11-30 23:59:59', 1000, 0, 'active'),
('MED2024', 2, 4, 'https://saudemais.com.br/promocao-medicamentos', '2024-12-31 23:59:59', 500, 0, 'active'),
('OFERTAS', 3, 6, 'https://economico.com.br/ofertas-dia', '2024-12-31 23:59:59', 2000, 0, 'active');

-- =============================================
-- DADOS DE EXEMPLO - COMANDOS REMOTOS
-- =============================================

INSERT INTO remote_commands (totem_id, request_id, command_type, command_data, priority, status, created_at, created_by) VALUES 
(1, 'CMD-001', 'restart', '{"reason": "maintenance", "scheduled": true}', 1, 'completed', NOW() - INTERVAL '1 hour', 1),
(2, 'CMD-002', 'update_config', '{"brightness": 85, "volume": 50}', 2, 'pending', NOW() - INTERVAL '30 minutes', 2),
(3, 'CMD-003', 'playlist_refresh', '{"force": true}', 3, 'executing', NOW() - INTERVAL '10 minutes', 1);

-- =============================================
-- DADOS DE EXEMPLO - ANALYTICS SESSIONS
-- =============================================

INSERT INTO analytics_sessions (totem_id, session_start, session_end, total_interactions, avg_emotion_score, dominant_emotion, age_range, gender, location) VALUES 
(1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 45 minutes', 15, 75.5, 'happy', '25-35', 'female', 'entrance'),
(2, NOW() - INTERVAL '1 hour 30 minutes', NOW() - INTERVAL '1 hour', 8, 68.2, 'neutral', '35-45', 'male', 'food_court'),
(4, NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '30 minutes', 12, 82.1, 'happy', '45-55', 'female', 'pharmacy'),
(6, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '5 minutes', 6, 71.8, 'neutral', '25-35', 'male', 'checkout');

-- =============================================
-- DADOS DE EXEMPLO - ANALYTICS EMOTIONS
-- =============================================

INSERT INTO analytics_emotions (session_id, emotion, confidence, timestamp, face_detected) VALUES 
(1, 'happy', 85.5, NOW() - INTERVAL '2 hours', true),
(1, 'happy', 78.2, NOW() - INTERVAL '1 hour 50 minutes', true),
(1, 'neutral', 65.8, NOW() - INTERVAL '1 hour 40 minutes', true),
(2, 'neutral', 72.1, NOW() - INTERVAL '1 hour 30 minutes', true),
(2, 'happy', 68.9, NOW() - INTERVAL '1 hour 20 minutes', true),
(3, 'happy', 88.3, NOW() - INTERVAL '45 minutes', true),
(3, 'happy', 79.6, NOW() - INTERVAL '40 minutes', true),
(4, 'neutral', 74.2, NOW() - INTERVAL '20 minutes', true);

-- =============================================
-- DADOS DE EXEMPLO - ANALYTICS GESTURES
-- =============================================

INSERT INTO analytics_gestures (session_id, gesture_type, coordinates, confidence, timestamp, action_triggered) VALUES 
(1, 'wave', '{"x": 960, "y": 540}', 82.5, NOW() - INTERVAL '2 hours', 'content_interaction'),
(1, 'point', '{"x": 1200, "y": 300}', 76.8, NOW() - INTERVAL '1 hour 50 minutes', 'qr_scan'),
(2, 'thumbs_up', '{"x": 800, "y": 600}', 89.2, NOW() - INTERVAL '1 hour 30 minutes', 'content_like'),
(3, 'wave', '{"x": 1000, "y": 400}', 85.7, NOW() - INTERVAL '45 minutes', 'content_interaction'),
(4, 'point', '{"x": 1100, "y": 500}', 78.3, NOW() - INTERVAL '20 minutes', 'qr_scan');

-- =============================================
-- DADOS DE EXEMPLO - ANALYTICS QR SCANS
-- =============================================

INSERT INTO analytics_qr_scans (qr_code_id, totem_id, scan_timestamp, user_agent, ip_address, location) VALUES 
(1, 1, NOW() - INTERVAL '1 hour 50 minutes', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)', '192.168.1.150', 'entrance'),
(1, 2, NOW() - INTERVAL '1 hour 20 minutes', 'Mozilla/5.0 (Android 11; Mobile; rv:68.0)', '192.168.1.151', 'food_court'),
(2, 4, NOW() - INTERVAL '40 minutes', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)', '192.168.2.150', 'pharmacy'),
(3, 6, NOW() - INTERVAL '15 minutes', 'Mozilla/5.0 (Android 11; Mobile; rv:68.0)', '192.168.3.150', 'checkout');

-- =============================================
-- DADOS DE EXEMPLO - LOGS DE EXECUÇÃO
-- =============================================

INSERT INTO execution_logs (totem_id, client_id, campaign_id, media_id, executed_at, start_time, end_time, duration_seconds, status, play_success, error_code) VALUES 
(1, 1, 1, 1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 59 minutes 50 seconds', 10, 'executed', true, NULL),
(1, 1, 1, 2, NOW() - INTERVAL '1 hour 59 minutes 50 seconds', NOW() - INTERVAL '1 hour 59 minutes 50 seconds', NOW() - INTERVAL '1 hour 59 minutes 20 seconds', 30, 'executed', true, NULL),
(2, 1, 1, 1, NOW() - INTERVAL '1 hour 30 minutes', NOW() - INTERVAL '1 hour 30 minutes', NOW() - INTERVAL '1 hour 29 minutes 50 seconds', 10, 'executed', true, NULL),
(4, 2, 2, 3, NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '44 minutes 45 seconds', 15, 'executed', true, NULL),
(6, 3, 3, 4, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '19 minutes 48 seconds', 12, 'executed', true, NULL);

-- =============================================
-- DADOS DE EXEMPLO - LOGS DO SISTEMA
-- =============================================

INSERT INTO system_logs (event_type, description) VALUES 
('system_start', 'Sistema Smart Signage iniciado'),
('user_login', 'Usuário admin fez login'),
('campaign_created', 'Campanha Black Friday criada'),
('totem_online', 'Totem TOTEM-SHOPPING-001 conectado'),
('media_uploaded', 'Mídia black-friday-banner.jpg enviada'),
('playlist_generated', 'Playlist Black Friday - Entrada gerada'),
('qr_code_scanned', 'QR Code BF2024 escaneado'),
('analytics_session', 'Nova sessão de analytics iniciada');

-- =============================================
-- DADOS DE EXEMPLO - CONFIGURAÇÕES DE WEBHOOK
-- =============================================

INSERT INTO webhook_configs (url, events, secret, timeout_ms, retry_count, is_active) VALUES 
('https://shoppingnorte.com.br/webhooks/totem-events', '["totem_online", "totem_offline", "qr_scan"]', 'webhook_secret_123', 5000, 3, true),
('https://saudemais.com.br/webhooks/analytics', '["analytics_session", "emotion_detected", "gesture_detected"]', 'webhook_secret_456', 3000, 2, true),
('https://economico.com.br/webhooks/campaigns', '["campaign_started", "campaign_ended", "media_played"]', 'webhook_secret_789', 7000, 3, true);

-- =============================================
-- DADOS DE EXEMPLO - REGRAS DE ALERTA
-- =============================================

INSERT INTO alert_rules (name, metric, condition, threshold, duration, is_active, notification_channels) VALUES 
('Totem Offline', 'totem_status', 'eq', 0, 300, true, '["email", "sms", "webhook"]'),
('High Error Rate', 'error_rate', 'gt', 5.0, 600, true, '["email", "webhook"]'),
('Low Engagement', 'avg_emotion_score', 'lt', 50.0, 1800, true, '["email"]'),
('QR Scan Spike', 'qr_scans_per_hour', 'gt', 100, 300, true, '["webhook"]');

-- =============================================
-- DADOS DE EXEMPLO - CONFIGURAÇÕES ML
-- =============================================

INSERT INTO totem_ml_config (totem_id, emotion_detection_enabled, gesture_recognition_enabled, face_detection_enabled, confidence_threshold, processing_interval, max_sessions_per_day) VALUES 
(1, true, true, true, 70.0, 1000, 1000),
(2, true, true, true, 70.0, 1000, 1000),
(3, true, true, true, 70.0, 1000, 1000),
(4, true, false, true, 75.0, 2000, 500),
(5, true, false, true, 75.0, 2000, 500),
(6, true, true, true, 65.0, 1500, 800),
(7, false, false, false, 80.0, 5000, 200);

-- =============================================
-- DADOS DE EXEMPLO - SESSÕES ML
-- =============================================

INSERT INTO ml_sessions (session_id, totem_id, start_time, end_time, total_emotions, total_gestures, avg_emotion_confidence, avg_gesture_confidence, status) VALUES 
(1, 1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 45 minutes', 15, 8, 78.5, 82.3, 'completed'),
(2, 2, NOW() - INTERVAL '1 hour 30 minutes', NOW() - INTERVAL '1 hour', 8, 3, 68.2, 75.6, 'completed'),
(3, 4, NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '30 minutes', 12, 0, 82.1, 0.0, 'completed'),
(4, 6, NOW() - INTERVAL '20 minutes', NULL, 6, 2, 71.8, 78.9, 'active');

-- =============================================
-- DADOS DE EXEMPLO - DADOS DE EMOCIONES
-- =============================================

INSERT INTO emotion_data (totem_id, session_id, emotion, confidence, timestamp, user_demographics) VALUES 
(1, 1, 'happy', 85.5, NOW() - INTERVAL '2 hours', '{"age_range": "25-35", "gender": "female"}'),
(1, 1, 'happy', 78.2, NOW() - INTERVAL '1 hour 50 minutes', '{"age_range": "25-35", "gender": "female"}'),
(1, 1, 'neutral', 65.8, NOW() - INTERVAL '1 hour 40 minutes', '{"age_range": "25-35", "gender": "female"}'),
(2, 2, 'neutral', 72.1, NOW() - INTERVAL '1 hour 30 minutes', '{"age_range": "35-45", "gender": "male"}'),
(2, 2, 'happy', 68.9, NOW() - INTERVAL '1 hour 20 minutes', '{"age_range": "35-45", "gender": "male"}'),
(4, 3, 'happy', 88.3, NOW() - INTERVAL '45 minutes', '{"age_range": "45-55", "gender": "female"}'),
(4, 3, 'happy', 79.6, NOW() - INTERVAL '40 minutes', '{"age_range": "45-55", "gender": "female"}'),
(6, 4, 'neutral', 74.2, NOW() - INTERVAL '20 minutes', '{"age_range": "25-35", "gender": "male"}');

-- =============================================
-- DADOS DE EXEMPLO - DADOS DE GESTOS
-- =============================================

INSERT INTO gesture_data (totem_id, session_id, gesture, confidence, timestamp, action_taken) VALUES 
(1, 1, 'wave', 82.5, NOW() - INTERVAL '2 hours', 'content_interaction'),
(1, 1, 'point', 76.8, NOW() - INTERVAL '1 hour 50 minutes', 'qr_scan'),
(2, 2, 'thumbs_up', 89.2, NOW() - INTERVAL '1 hour 30 minutes', 'content_like'),
(6, 4, 'wave', 85.7, NOW() - INTERVAL '20 minutes', 'content_interaction'),
(6, 4, 'point', 78.3, NOW() - INTERVAL '15 minutes', 'qr_scan');

-- =============================================
-- DADOS DE EXEMPLO - DADOS DE COMPORTAMENTO
-- =============================================

INSERT INTO behavior_data (session_id, totem_id, duration, interactions, emotion_changes, gesture_count, timestamp) VALUES 
(1, 1, 900, 15, 3, 2, NOW() - INTERVAL '2 hours'),
(2, 2, 1800, 8, 2, 1, NOW() - INTERVAL '1 hour 30 minutes'),
(3, 4, 900, 12, 2, 0, NOW() - INTERVAL '45 minutes'),
(4, 6, 1200, 6, 1, 2, NOW() - INTERVAL '20 minutes');

-- =============================================
-- DADOS DE EXEMPLO - MÉTRICAS AGREGADAS
-- =============================================

INSERT INTO aggregated_metrics (date, granularity, totem_id, campaign_id, media_id, impressions, play_time_seconds, unique_sessions, error_count) VALUES 
(CURRENT_DATE, 'day', 1, 1, 1, 150, 1500, 25, 0),
(CURRENT_DATE, 'day', 1, 1, 2, 120, 3600, 20, 0),
(CURRENT_DATE, 'day', 2, 1, 1, 100, 1000, 15, 0),
(CURRENT_DATE, 'day', 2, 1, 2, 80, 2400, 12, 0),
(CURRENT_DATE, 'day', 4, 2, 3, 200, 3000, 30, 0),
(CURRENT_DATE, 'day', 6, 3, 4, 180, 2160, 28, 0);

-- =============================================
-- DADOS DE EXEMPLO - CERTIFICADOS DE DISPOSITIVO
-- =============================================

INSERT INTO device_certificates (totem_id, certificate_pem, private_key_pem, issued_at, expires_at, status) VALUES 
(1, '-----BEGIN CERTIFICATE-----...', '-----BEGIN PRIVATE KEY-----...', NOW(), NOW() + INTERVAL '1 year', 'active'),
(2, '-----BEGIN CERTIFICATE-----...', '-----BEGIN PRIVATE KEY-----...', NOW(), NOW() + INTERVAL '1 year', 'active'),
(3, '-----BEGIN CERTIFICATE-----...', '-----BEGIN PRIVATE KEY-----...', NOW(), NOW() + INTERVAL '1 year', 'active'),
(4, '-----BEGIN CERTIFICATE-----...', '-----BEGIN PRIVATE KEY-----...', NOW(), NOW() + INTERVAL '1 year', 'active'),
(5, '-----BEGIN CERTIFICATE-----...', '-----BEGIN PRIVATE KEY-----...', NOW(), NOW() + INTERVAL '1 year', 'active'),
(6, '-----BEGIN CERTIFICATE-----...', '-----BEGIN PRIVATE KEY-----...', NOW(), NOW() + INTERVAL '1 year', 'active'),
(7, '-----BEGIN CERTIFICATE-----...', '-----BEGIN PRIVATE KEY-----...', NOW(), NOW() + INTERVAL '1 year', 'active');

-- =============================================
-- DADOS DE EXEMPLO - WORKFLOW DE APROVAÇÃO
-- =============================================

INSERT INTO approval_workflows (media_id, status, reviewed_by, reviewed_at, comment) VALUES 
(1, 'approved', 1, NOW() - INTERVAL '1 day', 'Aprovado para Black Friday'),
(2, 'approved', 1, NOW() - INTERVAL '1 day', 'Vídeo aprovado com sucesso'),
(3, 'approved', 1, NOW() - INTERVAL '2 days', 'Banner de medicamentos aprovado'),
(4, 'review', NULL, NULL, 'Aguardando revisão'),
(5, 'approved', 2, NOW() - INTERVAL '3 days', 'Menu executivo aprovado'),
(6, 'approved', 1, NOW() - INTERVAL '4 days', 'Vídeo educativo aprovado'),
(7, 'approved', 1, NOW() - INTERVAL '5 days', 'Banner academia aprovado');

-- =============================================
-- DADOS DE EXEMPLO - LOGS DE AUDITORIA
-- =============================================

INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, timestamp) VALUES 
(1, 'create', 'campaign', 1, '{"title": "Promoção Black Friday", "client_id": 1}', NOW() - INTERVAL '1 day'),
(2, 'create', 'media', 1, '{"name": "black-friday-banner.jpg", "type": "image"}', NOW() - INTERVAL '1 day'),
(1, 'approve', 'media', 1, '{"status": "approved", "comment": "Aprovado para Black Friday"}', NOW() - INTERVAL '1 day'),
(1, 'create', 'playlist', 1, '{"name": "Playlist Black Friday - Entrada", "totem_id": 1}', NOW() - INTERVAL '1 day'),
(2, 'update', 'totem', 1, '{"status": "online", "last_heartbeat": "2024-10-26T17:00:00Z"}', NOW() - INTERVAL '2 hours'),
(1, 'scan', 'qr_code', 1, '{"qr_code_id": 1, "totem_id": 1, "location": "entrance"}', NOW() - INTERVAL '1 hour 50 minutes');

-- =============================================
-- FINALIZAÇÃO
-- =============================================

-- Reabilitar triggers
-- Nota: session_replication_role requer privilégios superuser
-- Removido para permitir execução com usuário normal
-- SET session_replication_role = DEFAULT;

-- Atualizar sequências para PostgreSQL
SELECT setval('clients_client_id_seq', (SELECT MAX(client_id) FROM clients));
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('hosts_host_id_seq', (SELECT MAX(host_id) FROM hosts));
SELECT setval('totems_totem_id_seq', (SELECT MAX(totem_id) FROM totems));
SELECT setval('campaigns_campaign_id_seq', (SELECT MAX(campaign_id) FROM campaigns));
SELECT setval('medias_media_id_seq', (SELECT MAX(media_id) FROM medias));
SELECT setval('playlists_playlist_id_seq', (SELECT MAX(playlist_id) FROM playlists));
SELECT setval('playlist_items_item_id_seq', (SELECT MAX(item_id) FROM playlist_items));

-- =============================================
-- FIM DOS DADOS DE EXEMPLO
-- =============================================
