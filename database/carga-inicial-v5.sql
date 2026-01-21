-- =============================================
-- LIMPEZA ANTES DA CARGA (MANTÉM SOMENTE `users`)
-- =============================================
-- ATENÇÃO: este bloco apaga os dados de TODAS as tabelas do schema `public`,
-- exceto a tabela `users` (mantém o login primário).
-- Use apenas em ambiente de DEV/SEED.
DO $$
DECLARE
  _tables text;
BEGIN
  SELECT string_agg(format('%I.%I', table_schema, table_name), ', ')
    INTO _tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name <> 'users';

  IF _tables IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || _tables || ' RESTART IDENTITY CASCADE';
  END IF;
END $$;

INSERT INTO subscribers (subscriber_id, name, contact_name, email, phone, whatsapp, address, category_segment, description, is_active) VALUES
(1, 'Shopping Center Norte', 'Maria Silva', 'maria.silva@shoppingnorte.com.br', '+55 11 3456-7890', '+55 11 98765-4321', 'Av. Cruzeiro do Sul, 1100 - Santana, São Paulo/SP - CEP 02013-000', 'Shopping', 'Shopping center localizado na zona norte de São Paulo', true),
(2, 'Rede de Farmácias Saúde+', 'João Santos', 'joao.santos@saudemais.com.br', '+55 11 2345-6789', '+55 11 87654-3210', 'Rua XV de Novembro, 250 - Centro, São Paulo/SP - CEP 01010-000', 'Farmácia', 'Rede de farmácias com múltiplas unidades', true),
(3, 'Supermercado Econômico', 'Ana Costa', 'ana.costa@economico.com.br', '+55 11 1234-5678', '+55 11 76543-2109', 'Av. Paulista, 1500 - Bela Vista, São Paulo/SP - CEP 01310-100', 'Supermercado', 'Supermercado com foco em economia', true),
(4, 'Restaurante Sabor & Arte', 'Carlos Oliveira', 'carlos.oliveira@saborearte.com.br', '+55 11 4567-8901', '+55 11 65432-1098', 'Rua Oscar Freire, 200 - Jardins, São Paulo/SP - CEP 01426-000', 'Restaurante', 'Restaurante gourmet especializado em culinária brasileira', true),
(5, 'Clínica Médica Vida Saudável', 'Dr. Roberto Lima', 'roberto.lima@vidasaudavel.com.br', '+55 11 5678-9012', '+55 11 54321-0987', 'Rua do Carmo, 45 - Centro, São Paulo/SP - CEP 01310-100', 'Saúde', 'Clínica médica com foco em prevenção', true)
ON CONFLICT DO NOTHING;

INSERT INTO publishers (publisher_id, name, contact_name, email, phone, whatsapp, category_segment, description, is_subscriber, is_publisher, client_type, active) VALUES
(1, 'Shopping Center Norte - Administração', 'Maria Silva', 'admin@shoppingnorte.com.br', '+55 11 3456-7890', '+55 11 98765-4321', 'Shopping', 'Administração do shopping center', false, true, 'publisher', true),
(2, 'Farmácia Central - Matriz', 'João Santos', 'matriz@saudemais.com.br', '+55 11 2345-6789', '+55 11 87654-3210', 'Farmácia', 'Matriz da rede de farmácias', false, true, 'publisher', true),
(3, 'Supermercado Econômico - Filial Centro', 'Ana Costa', 'centro@economico.com.br', '+55 11 1234-5678', '+55 11 76543-2109', 'Supermercado', 'Filial central do supermercado', false, true, 'publisher', true),
(4, 'Rede de Totens Urbanos', 'Pedro Almeida', 'pedro@totensurbanos.com.br', '+55 11 9999-8888', '+55 11 99999-8888', 'OOH', 'Rede de totens em pontos estratégicos da cidade', false, true, 'publisher', true)
ON CONFLICT DO NOTHING;

INSERT INTO roles (role_id, name, description, is_active) VALUES
(1, 'owner_system', 'Proprietário do sistema', true),
(2, 'admin_sql', 'Administrador SQL', true),
(3, 'admin', 'Administrador', true),
(4, 'publisher_user', 'Usuário Publisher', true),
(5, 'subscriber_user', 'Usuário Subscriber', true),
(6, 'operator', 'Operador', true),
(7, 'viewer', 'Visualizador', true)
ON CONFLICT DO NOTHING;

INSERT INTO permissions (permission_id, name, resource, action, description) VALUES
(1, 'media.create', 'media', 'create', 'Criar mídias'),
(2, 'media.read', 'media', 'read', 'Visualizar mídias'),
(3, 'media.update', 'media', 'update', 'Editar mídias'),
(4, 'media.delete', 'media', 'delete', 'Excluir mídias'),
(5, 'campaign.create', 'campaign', 'create', 'Criar campanhas'),
(6, 'campaign.read', 'campaign', 'read', 'Visualizar campanhas'),
(7, 'campaign.update', 'campaign', 'update', 'Editar campanhas'),
(8, 'campaign.delete', 'campaign', 'delete', 'Excluir campanhas'),
(9, 'totem.read', 'totem', 'read', 'Visualizar totens'),
(10, 'totem.update', 'totem', 'update', 'Editar totens')
ON CONFLICT DO NOTHING;

INSERT INTO plans (plan_id, name, slug, description, price_monthly, price_yearly, currency, billing_interval, features, limits, is_active, is_popular, sort_order) VALUES
(1, 'Plano Básico', 'plano-basico', 'Plano básico para pequenos anunciantes', 99.00, 990.00, 'BRL', 'month', '{"campaigns":5,"storage_gb":10}'::jsonb, '{"totems":3,"campaigns":5,"storage_gb":10}'::jsonb, true, false, 1),
(2, 'Plano Profissional', 'plano-profissional', 'Plano profissional para médias empresas', 299.00, 2990.00, 'BRL', 'month', '{"campaigns":20,"storage_gb":50}'::jsonb, '{"totems":10,"campaigns":20,"storage_gb":50}'::jsonb, true, true, 2),
(3, 'Plano Enterprise', 'plano-enterprise', 'Plano enterprise para grandes empresas', 999.00, 9990.00, 'BRL', 'month', '{"campaigns":100,"storage_gb":500}'::jsonb, '{"totems":50,"campaigns":100,"storage_gb":500}'::jsonb, true, false, 3)
ON CONFLICT DO NOTHING;

INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description) VALUES
('app.name', 'SmartSignage Pro', 'string', 'system', 'Nome da aplicação'),
('app.version', '2.0.0', 'string', 'system', 'Versão da aplicação'),
('dispatcher.cache_ttl_seconds', '300', 'number', 'dispatcher', 'TTL do cache do dispatcher em segundos'),
('dispatcher.cache_enabled', 'true', 'boolean', 'dispatcher', 'Habilitar cache do dispatcher'),
('dispatcher.default_mode', 'MIXED', 'string', 'dispatcher', 'Modo padrão do dispatcher: MIXED (gera sequência mixada por janela) ou SINGLE_WINNER (1 vencedor por instante).'),
('dispatcher.window_seconds', '600', 'number', 'dispatcher', 'Tamanho padrão da janela do dispatcher em segundos (ex.: 600 = 10 minutos).'),
('dispatcher.max_items_per_window', '300', 'number', 'dispatcher', 'Limite máximo de itens gerados por janela (cap de segurança para payload/performance).'),
('dispatcher.inner_rotation', 'RR_CAMPAIGN_PLAYLISTS', 'string', 'dispatcher', 'Estratégia determinística dentro da campanha: round-robin entre playlists da campanha.'),
('dispatcher.inner_item_rotation', 'RR_PLAYLIST_ITEMS', 'string', 'dispatcher', 'Estratégia determinística dentro da playlist: round-robin entre itens/mídias da playlist.'),
('dispatcher.seed_strategy', 'TIME_BUCKET_HASH', 'string', 'dispatcher', 'Estratégia de seed para replay determinístico (ex.: hash(totem_id, bucket_start, context_snapshot_hash)).')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO users (id, username, email, password_hash, first_name, last_name, name, phone, role, user_type, is_tenant_user, publisher_id, subscriber_id, is_active, email_verified) VALUES
(1, 'admin', 'admin@smartsignage.local', '$2a$12$eenSYwwg9qOkcleFuH2lrOL5u3nAMN8MqQlsOQJh59mg16gcBu5A2', 'Admin', 'Sistema', 'Admin Sistema', '+55 11 0000-0000', 'admin', 'system_user', true, NULL, NULL, true, true),
(2, 'maria.silva', 'maria.silva@shoppingnorte.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Maria', 'Silva', 'Maria Silva', '+55 11 3456-7890', 'manager', 'publisher_user', false, 1, NULL, true, true),
(3, 'joao.santos', 'joao.santos@saudemais.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'João', 'Santos', 'João Santos', '+55 11 2345-6789', 'manager', 'publisher_user', false, 2, NULL, true, true),
(4, 'ana.costa', 'ana.costa@economico.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Ana', 'Costa', 'Ana Costa', '+55 11 1234-5678', 'manager', 'subscriber_user', false, NULL, 3, true, true),
(5, 'carlos.oliveira', 'carlos.oliveira@saborearte.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Carlos', 'Oliveira', 'Carlos Oliveira', '+55 11 4567-8901', 'manager', 'subscriber_user', false, NULL, 4, true, true)
ON CONFLICT DO NOTHING;

INSERT INTO user_flags (user_id, flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4, flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9) VALUES
(1, true, true, true, true, true, true, true, true, true, true),
(2, true, false, false, true, false, true, true, false, true, false),
(3, true, false, false, true, false, true, true, false, true, false),
(4, false, false, false, false, false, false, true, false, false, true),
(5, false, false, false, false, false, false, true, false, false, true)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO role_flags_default (role, flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4, flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9) VALUES
('owner_system', true, true, true, true, true, true, true, true, true, true),
('admin_sql', true, true, true, true, true, true, true, true, true, true),
('admin', true, false, true, true, true, true, true, true, true, true),
('publisher_user', true, false, false, true, false, true, true, false, true, false),
('subscriber_user', false, false, false, false, false, false, true, false, false, true),
('operator', true, false, false, false, false, false, false, false, false, false),
('viewer', false, false, false, false, false, false, true, false, false, false)
ON CONFLICT (role) DO NOTHING;

INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES
(1, 1, 1),
(2, 4, 1),
(3, 4, 1),
(4, 5, 1),
(5, 5, 1)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10),
(2, 1), (2, 2), (2, 3), (2, 4), (2, 5), (2, 6), (2, 7), (2, 8), (2, 9), (2, 10),
(3, 1), (3, 2), (3, 3), (3, 4), (3, 5), (3, 6), (3, 7), (3, 8), (3, 9), (3, 10),
(4, 2), (4, 6), (4, 9),
(5, 2), (5, 5), (5, 6)
ON CONFLICT DO NOTHING;

INSERT INTO locals (local_id, publisher_id, name, category_segment, address, city, state, zip_code, country, latitude, longitude, timezone, description, is_active) VALUES
(1, 1, 'Entrada Principal', 'Shopping', 'Av. Cruzeiro do Sul, 1100', 'São Paulo', 'SP', '02013-000', 'BR', -23.5000, -46.6333, 'America/Sao_Paulo', 'Entrada principal do shopping', true),
(2, 1, 'Praça de Alimentação', 'Shopping', 'Av. Cruzeiro do Sul, 1100', 'São Paulo', 'SP', '02013-000', 'BR', -23.5001, -46.6334, 'America/Sao_Paulo', 'Praça de alimentação do shopping', true),
(3, 1, 'Área do Cinema', 'Cinema', 'Av. Cruzeiro do Sul, 1100', 'São Paulo', 'SP', '02013-000', 'BR', -23.5002, -46.6335, 'America/Sao_Paulo', 'Área do cinema', true),
(4, 2, 'Farmácia Matriz - Centro', 'Farmácia', 'Rua XV de Novembro, 250', 'São Paulo', 'SP', '01010-000', 'BR', -23.5500, -46.6333, 'America/Sao_Paulo', 'Farmácia matriz no centro', true),
(5, 2, 'Farmácia Filial - Zona Sul', 'Farmácia', 'Av. Paulista, 1000', 'São Paulo', 'SP', '01310-100', 'BR', -23.5615, -46.6560, 'America/Sao_Paulo', 'Farmácia filial zona sul', true),
(6, 3, 'Área de Caixas', 'Supermercado', 'Av. Paulista, 1500', 'São Paulo', 'SP', '01310-100', 'BR', -23.5615, -46.6560, 'America/Sao_Paulo', 'Área dos caixas do supermercado', true),
(7, 3, 'Seção de Açougue', 'Supermercado', 'Av. Paulista, 1500', 'São Paulo', 'SP', '01310-100', 'BR', -23.5615, -46.6560, 'America/Sao_Paulo', 'Seção de açougue', true),
(8, 4, 'Ponto Estratégico 1', 'OOH', 'Av. Brigadeiro Faria Lima, 2000', 'São Paulo', 'SP', '01452-000', 'BR', -23.5775, -46.6910, 'America/Sao_Paulo', 'Totem em ponto estratégico', true)
ON CONFLICT DO NOTHING;

INSERT INTO totems (totem_id, identifier, uin, device_id, local_id, name, description, model, manufacturer, firmware_version, hardware_version, os_version, status, last_heartbeat, heartbeat_interval, network_info, capabilities, is_active) VALUES
(1, 'TOTEM-SHOPPING-001', 'UIN-SHOPPING-001-2024', 'DEVICE-001', 1, 'Totem Shopping Entrada', 'Totem na entrada principal', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', (NOW() - INTERVAL '1 year'), 60, '{}'::jsonb, '{}'::jsonb, true),
(2, 'TOTEM-SHOPPING-002', 'UIN-SHOPPING-002-2024', 'DEVICE-002', 2, 'Totem Shopping Praça', 'Totem na praça de alimentação', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', (NOW() - INTERVAL '1 year'), 60, '{}'::jsonb, '{}'::jsonb, true),
(3, 'TOTEM-SHOPPING-003', 'UIN-SHOPPING-003-2024', 'DEVICE-003', 3, 'Totem Shopping Cinema', 'Totem na área do cinema', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', (NOW() - INTERVAL '1 year'), 60, '{}'::jsonb, '{}'::jsonb, true),
(4, 'TOTEM-FARMACIA-001', 'UIN-FARMACIA-001-2024', 'DEVICE-004', 4, 'Totem Farmácia Matriz', 'Totem na farmácia matriz', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', (NOW() - INTERVAL '1 year'), 60, '{}'::jsonb, '{}'::jsonb, true),
(5, 'TOTEM-FARMACIA-002', 'UIN-FARMACIA-002-2024', 'DEVICE-005', 5, 'Totem Farmácia Filial', 'Totem na farmácia filial', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', (NOW() - INTERVAL '1 year'), 60, '{}'::jsonb, '{}'::jsonb, true),
(6, 'TOTEM-SUPER-001', 'UIN-SUPER-001-2024', 'DEVICE-006', 6, 'Totem Supermercado Caixas', 'Totem na área dos caixas', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', (NOW() - INTERVAL '1 year'), 60, '{}'::jsonb, '{}'::jsonb, true),
(7, 'TOTEM-SUPER-002', 'UIN-SUPER-002-2024', 'DEVICE-007', 7, 'Totem Supermercado Açougue', 'Totem na seção de açougue', 'Totem Pro v2', 'SmartSignage', '2.0.0', '1.2.2', 'Linux 5.15', 'offline', (NOW() - INTERVAL '1 year') - INTERVAL '2 hours', 60, '{}'::jsonb, '{}'::jsonb, true),
(8, 'TOTEM-URBANO-001', 'UIN-URBANO-001-2024', 'DEVICE-008', 8, 'Totem Urbano 1', 'Totem em ponto estratégico', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', (NOW() - INTERVAL '1 year'), 60, '{}'::jsonb, '{}'::jsonb, true)
ON CONFLICT DO NOTHING;

INSERT INTO smart_tvs (smart_tv_id, totem_id, identifier, device_id, name, brand, model, platform, firmware_version, resolution_width, resolution_height, orientation, status, last_seen, capabilities, settings, is_active) VALUES
(1, 1, 'TV-SHOPPING-001', 'TV-DEVICE-001', 'Smart TV Shopping Entrada', 'Samsung', 'QN55Q80A', 'Tizen', '6.0.1', 3840, 2160, 'landscape', 'online', (NOW() - INTERVAL '1 year'), '{}'::jsonb, '{}'::jsonb, true),
(2, 2, 'TV-SHOPPING-002', 'TV-DEVICE-002', 'Smart TV Shopping Praça', 'LG', '55NANO75SQA', 'webOS', '7.0.0', 3840, 2160, 'landscape', 'online', (NOW() - INTERVAL '1 year'), '{}'::jsonb, '{}'::jsonb, true),
(3, 3, 'TV-SHOPPING-003', 'TV-DEVICE-003', 'Smart TV Shopping Cinema', 'Samsung', 'QN55Q80A', 'Tizen', '6.0.1', 3840, 2160, 'landscape', 'online', (NOW() - INTERVAL '1 year'), '{}'::jsonb, '{}'::jsonb, true),
(4, 4, 'TV-FARMACIA-001', 'TV-DEVICE-004', 'Smart TV Farmácia Matriz', 'LG', '43UN7300PUF', 'webOS', '6.0.0', 3840, 2160, 'portrait', 'online', (NOW() - INTERVAL '1 year'), '{}'::jsonb, '{}'::jsonb, true),
(5, 5, 'TV-FARMACIA-002', 'TV-DEVICE-005', 'Smart TV Farmácia Filial', 'LG', '43UN7300PUF', 'webOS', '6.0.0', 3840, 2160, 'portrait', 'online', (NOW() - INTERVAL '1 year'), '{}'::jsonb, '{}'::jsonb, true),
(6, 6, 'TV-SUPER-001', 'TV-DEVICE-006', 'Smart TV Supermercado Caixas', 'Samsung', 'UN55TU8000', 'Tizen', '5.5.0', 3840, 2160, 'landscape', 'online', (NOW() - INTERVAL '1 year'), '{}'::jsonb, '{}'::jsonb, true),
(7, 7, 'TV-SUPER-002', 'TV-DEVICE-007', 'Smart TV Supermercado Açougue', 'Samsung', 'UN55TU8000', 'Tizen', '5.5.0', 3840, 2160, 'portrait', 'offline', (NOW() - INTERVAL '1 year') - INTERVAL '2 hours', '{}'::jsonb, '{}'::jsonb, true),
(8, 8, 'TV-URBANO-001', 'TV-DEVICE-008', 'Smart TV Urbano 1', 'LG', '55NANO75SQA', 'webOS', '7.0.0', 3840, 2160, 'landscape', 'online', (NOW() - INTERVAL '1 year'), '{}'::jsonb, '{}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- Nota: no backend v2, o frontend consome `thumbnailUrl/previewUrl` preferindo endpoints `/api/media/:id/thumbnail`.
-- Manter URLs "legacy" (/thumbnails, /previews) tende a quebrar em ambientes novos; por isso já gravamos endpoints da API.
INSERT INTO medias (
  media_id, subscriber_id, name, description, file_path, file_name, file_size_bytes,
  media_type, mime_type, duration_seconds, width, height,
  thumbnail_url, preview_url,
  status, approval_status, tags,
  approved_by, approved_at, metadata,
  is_active
) VALUES
(1, 1, 'black-friday-banner.jpg', 'Banner principal da Black Friday', '/opt/smart-signage/public/assets/uploads/client-1/medias/black-friday-banner.jpg', 'black-friday-banner.jpg', 550388, 'image', 'image/jpeg', NULL, 1920, 1080, '/api/media/1/thumbnail', '/api/media/1/thumbnail', 'approved', 'approved', ARRAY['promocao', 'black-friday', 'ofertas'], 1, (NOW() - INTERVAL '1 year') - INTERVAL '10 days', '{}'::jsonb, true),
(2, 1, 'ofertas-video.mp4', 'Vídeo com as principais ofertas', '/opt/smart-signage/public/assets/uploads/client-1/medias/ofertas-video.mp4', 'ofertas-video.mp4', 984314, 'video', 'video/mp4', 30, 1920, 1080, '/api/media/2/thumbnail', '/api/media/2/thumbnail', 'approved', 'approved', ARRAY['promocao', 'video', 'ofertas'], 1, (NOW() - INTERVAL '1 year') - INTERVAL '10 days', '{}'::jsonb, true),
(3, 2, 'medicamentos-banner.jpg', 'Banner promocional de medicamentos', '/opt/smart-signage/public/assets/uploads/client-2/medias/medicamentos-banner.jpg', 'medicamentos-banner.jpg', 576108, 'image', 'image/jpeg', NULL, 1920, 1080, '/api/media/3/thumbnail', '/api/media/3/thumbnail', 'approved', 'approved', ARRAY['medicamentos', 'genericos', 'promocao'], 1, (NOW() - INTERVAL '1 year') - INTERVAL '9 days', '{}'::jsonb, true),
(4, 3, 'ofertas-dia.jpg', 'Banner com ofertas diárias', '/opt/smart-signage/public/assets/uploads/client-3/medias/ofertas-dia.jpg', 'ofertas-dia.jpg', 1113286, 'image', 'image/jpeg', NULL, 1920, 1080, '/api/media/4/thumbnail', '/api/media/4/thumbnail', 'approved', 'approved', ARRAY['ofertas', 'diarias', 'supermercado'], 1, (NOW() - INTERVAL '1 year') - INTERVAL '8 days', '{}'::jsonb, true),
(5, 4, 'menu-executivo.jpg', 'Cardápio do menu executivo', '/opt/smart-signage/public/assets/uploads/client-4/medias/menu-executivo.jpg', 'menu-executivo.jpg', 753361, 'image', 'image/jpeg', NULL, 1920, 1080, '/api/media/5/thumbnail', '/api/media/5/thumbnail', 'approved', 'approved', ARRAY['menu', 'executivo', 'restaurante'], 1, (NOW() - INTERVAL '1 year') - INTERVAL '7 days', '{}'::jsonb, true),
(6, 5, 'check-up-video.mp4', 'Vídeo educativo sobre check-up', '/opt/smart-signage/public/assets/uploads/client-5/medias/check-up-video.mp4', 'check-up-video.mp4', 984314, 'video', 'video/mp4', 45, 1920, 1080, '/api/media/6/thumbnail', '/api/media/6/thumbnail', 'approved', 'approved', ARRAY['saude', 'prevencao', 'check-up'], 1, (NOW() - INTERVAL '1 year') - INTERVAL '6 days', '{}'::jsonb, true)
ON CONFLICT DO NOTHING;

INSERT INTO playlists (playlist_id, subscriber_id, name, category_segment, description, is_active, schedule_config, metadata) VALUES
(1, 1, 'Playlist Black Friday - Entrada', 'Black Friday', 'Playlist principal da Black Friday na entrada', true, '{}'::jsonb, '{}'::jsonb),
(2, 1, 'Playlist Black Friday - Praça', 'Black Friday', 'Playlist da Black Friday na praça de alimentação', true, '{}'::jsonb, '{}'::jsonb),
(3, 2, 'Playlist Medicamentos', 'Saúde', 'Playlist promocional de medicamentos', true, '{}'::jsonb, '{}'::jsonb),
(4, 3, 'Playlist Ofertas Supermercado', 'Promoções', 'Playlist de ofertas do supermercado', true, '{}'::jsonb, '{}'::jsonb),
(5, 4, 'Playlist Menu Executivo', 'Cardápio', 'Playlist do menu executivo', true, '{}'::jsonb, '{}'::jsonb),
(6, 5, 'Playlist Check-up', 'Saúde', 'Playlist de conscientização sobre check-up', true, '{}'::jsonb, '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO playlist_items (item_id, playlist_id, media_id, display_seconds, order_index, start_time, end_time, days_of_week, transitions, is_active) VALUES
(1, 1, 1, 10, 0, NULL, NULL, NULL, '{}'::jsonb, true),
(2, 1, 2, 30, 1, NULL, NULL, NULL, '{}'::jsonb, true),
(3, 2, 1, 10, 0, NULL, NULL, NULL, '{}'::jsonb, true),
(4, 2, 2, 30, 1, NULL, NULL, NULL, '{}'::jsonb, true),
(5, 3, 3, 15, 0, NULL, NULL, NULL, '{}'::jsonb, true),
(6, 4, 4, 12, 0, NULL, NULL, NULL, '{}'::jsonb, true),
(7, 5, 5, 20, 0, '15:00', '16:00', '["monday","tuesday","wednesday","thursday","friday"]', '{}'::jsonb, true),
(8, 6, 6, 45, 0, NULL, NULL, NULL, '{}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- =============================================
-- CONTRATOS (Subscriber/Publisher) + CAMPANHAS vinculadas ao contrato
-- =============================================

INSERT INTO subscriber_contracts (contract_id, subscriber_id, plan_id, contract_number, contract_type, title, description, start_date, end_date, total_amount, currency, payment_terms, status, signed_by_subscriber_at, signed_by_tenant_at, created_by, metadata) VALUES
(1, 1, 2, 'SUB-CONT-001', 'advertising', 'Contrato Publicitário Shopping Center Norte', 'Contrato de publicidade para Black Friday', '2025-11-01', '2035-11-30', 50000.00, 'BRL', 'Pagamento em 30 dias', 'active', (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), 1, '{}'::jsonb),
(2, 2, 1, 'SUB-CONT-002', 'advertising', 'Contrato Publicitário Farmácias Saúde+', 'Contrato de publicidade para campanha de medicamentos', '2025-10-01', '2035-12-31', 15000.00, 'BRL', 'Pagamento mensal', 'active', (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), 1, '{}'::jsonb),
(3, 3, 1, 'SUB-CONT-003', 'advertising', 'Contrato Publicitário Supermercado Econômico', 'Contrato de publicidade para ofertas do dia', '2025-01-01', '2035-12-31', 20000.00, 'BRL', 'Pagamento mensal', 'active', (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), 1, '{}'::jsonb),
(4, 4, 1, 'SUB-CONT-004', 'advertising', 'Contrato Publicitário Restaurante Sabor & Arte', 'Contrato de publicidade para menu executivo', '2025-01-01', '2035-12-31', 8000.00, 'BRL', 'Pagamento mensal', 'active', (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), 1, '{}'::jsonb),
(5, 5, 1, 'SUB-CONT-005', 'advertising', 'Contrato Publicitário Clínica Vida Saudável', 'Contrato de publicidade para check-up preventivo', '2025-01-01', '2035-12-31', 10000.00, 'BRL', 'Pagamento mensal', 'active', (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), 1, '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO publisher_contracts (contract_id, publisher_id, contract_number, contract_type, title, description, start_date, end_date, revenue_share_percentage, revenue_share_rules, minimum_payout_amount, subscription_amount, subscription_interval, currency, payment_terms, status, signed_by_publisher_at, signed_by_tenant_at, created_by, metadata) VALUES
(1, 1, 'PUB-CONT-001', 'revenue_share', 'Contrato Revenue Share Shopping Center Norte', 'Contrato de revenue share com 70% para o publisher', '2025-01-01', NULL, 70.00, '{}'::jsonb, 1000.00, NULL, NULL, 'BRL', 'Pagamento mensal', 'active', (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), 1, '{}'::jsonb),
(2, 2, 'PUB-CONT-002', 'revenue_share', 'Contrato Revenue Share Farmácia Central', 'Contrato de revenue share com 65% para o publisher', '2025-01-01', NULL, 65.00, '{}'::jsonb, 500.00, NULL, NULL, 'BRL', 'Pagamento mensal', 'active', (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), 1, '{}'::jsonb),
(3, 3, 'PUB-CONT-003', 'revenue_share', 'Contrato Revenue Share Supermercado Econômico', 'Contrato de revenue share com 60% para o publisher', '2025-01-01', NULL, 60.00, '{}'::jsonb, 500.00, NULL, NULL, 'BRL', 'Pagamento mensal', 'active', (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), 1, '{}'::jsonb),
(4, 4, 'PUB-CONT-004', 'hybrid', 'Contrato Híbrido Rede de Totens Urbanos', 'Contrato híbrido: revenue share + subscription', '2025-01-01', NULL, 75.00, '{}'::jsonb, 2000.00, 299.00, 'month', 'BRL', 'Pagamento mensal', 'active', (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), 1, '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO campaigns (campaign_id, subscriber_id, contract_id, title, category_segment, description, campaign_type, priority, commercial_tier, default_time_share_percent, max_consecutive_slots, start_date, end_date, start_time, end_time, days_of_week, timezone, status, is_active, target_audience, metadata) VALUES
(1, 1, 1, 'Promoção Black Friday', 'Black Friday', 'Campanha especial para Black Friday com ofertas imperdíveis', 'scheduled', 10, 'premium', 50.00, 2, '2025-11-20 00:00:00', '2035-11-30 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(2, 2, 2, 'Campanha Medicamentos', 'Saúde', 'Promoção de medicamentos genéricos', 'general', 8, 'standard', 30.00, 2, '2025-10-01 00:00:00', '2035-12-31 23:59:59', '08:00', '20:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(3, 3, 3, 'Ofertas do Dia', 'Promoções', 'Ofertas especiais diárias do supermercado', 'general', 7, 'standard', 40.00, 3, '2025-01-01 00:00:00', '2035-12-31 23:59:59', '06:00', '23:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(4, 4, 4, 'Menu Executivo', 'Restaurante', 'Promoção do menu executivo', 'scheduled', 6, 'standard', 20.00, 1, '2025-01-01 00:00:00', '2035-12-31 23:59:59', '11:30', '14:30', '["monday", "tuesday", "wednesday", "thursday", "friday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(5, 5, 5, 'Check-up Preventivo', 'Saúde', 'Campanha de conscientização sobre check-up', 'general', 5, 'standard', 15.00, 1, '2025-01-01 00:00:00', '2035-12-31 23:59:59', '08:00', '18:00', '["monday", "tuesday", "wednesday", "thursday", "friday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO campaign_playlists (campaign_id, playlist_id, priority, is_active, metadata) VALUES
(1, 1, 1, true, '{}'::jsonb),
(1, 2, 2, true, '{}'::jsonb),
(2, 3, 1, true, '{}'::jsonb),
(3, 4, 1, true, '{}'::jsonb),
(4, 5, 1, true, '{}'::jsonb),
(5, 6, 1, true, '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO campaign_medias (campaign_id, media_id, display_seconds, order_index, priority, start_time, end_time, days_of_week, transitions, is_active, metadata) VALUES
(1, 1, 10, 0, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(1, 2, 30, 1, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(2, 3, 15, 0, 8, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(3, 4, 12, 0, 7, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(4, 5, 20, 0, 6, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(5, 6, 45, 0, 5, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO campaign_totems (campaign_id, totem_id, start_date, end_date, start_time, end_time, days_of_week, priority, is_active) VALUES
(1, 1, '2025-11-20 00:00:00', '2035-11-30 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(1, 2, '2025-11-20 00:00:00', '2035-11-30 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(1, 3, '2025-11-20 00:00:00', '2035-11-30 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(2, 4, '2025-10-01 00:00:00', '2035-12-31 23:59:59', '08:00', '20:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]', 8, true),
(2, 5, '2025-10-01 00:00:00', '2035-12-31 23:59:59', '08:00', '20:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]', 8, true),
(3, 6, '2025-01-01 00:00:00', '2035-12-31 23:59:59', '06:00', '23:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 7, true),
-- Conflitos intencionais (mesmo totem, campanhas sobrepostas) para testes de fallback "single winner"
(4, 1, '2025-01-01 00:00:00', '2035-12-31 23:59:59', '12:00', '13:00', '["monday", "tuesday", "wednesday", "thursday", "friday"]', 9, true),
(5, 1, '2025-01-01 00:00:00', '2035-12-31 23:59:59', '12:30', '12:45', '["monday", "tuesday", "wednesday", "thursday", "friday"]', 8, true),
(4, 2, '2025-01-01 00:00:00', '2035-12-31 23:59:59', '12:00', '13:00', '["monday", "tuesday", "wednesday", "thursday", "friday"]', 9, true)
ON CONFLICT DO NOTHING;

INSERT INTO campaign_publishers (campaign_id, publisher_id, revenue_share_percentage, time_share_percent, daypart_config, min_impressions_per_hour, max_impressions_per_hour, is_active, metadata) VALUES
(1, 1, 70.00, 50.00, '{}'::jsonb, 10, 20, true, '{}'::jsonb),
(2, 2, 65.00, 30.00, '{}'::jsonb, 5, 15, true, '{}'::jsonb),
(3, 3, 60.00, 40.00, '{}'::jsonb, 8, 18, true, '{}'::jsonb),
(4, 1, 70.00, 20.00, '{}'::jsonb, 3, 10, true, '{}'::jsonb),
(5, 1, 70.00, 15.00, '{}'::jsonb, 2, 8, true, '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO campaign_locals (campaign_id, local_id, is_active) VALUES
(1, 1, true),
(1, 2, true),
(1, 3, true),
(2, 4, true),
(2, 5, true),
(3, 6, true),
(3, 7, true),
(4, 1, true),
(4, 2, true),
(5, 1, true)
ON CONFLICT DO NOTHING;

INSERT INTO subscriber_billing (billing_id, subscriber_id, campaign_id, billing_type, amount, currency, direction, description, invoice_number, payment_method, payment_status, payment_date, due_date, metadata) VALUES
(1, 1, 1, 'campaign', 50000.00, 'BRL', 'incoming', 'Faturamento campanha Black Friday', 'INV-2024-001', 'bank_transfer', 'paid', (NOW() - INTERVAL '1 year') - INTERVAL '5 days', (NOW() - INTERVAL '1 year') + INTERVAL '25 days', '{}'::jsonb),
(2, 2, 2, 'campaign', 5000.00, 'BRL', 'incoming', 'Faturamento campanha Medicamentos - Outubro', 'INV-2024-002', 'credit_card', 'paid', (NOW() - INTERVAL '1 year') - INTERVAL '3 days', (NOW() - INTERVAL '1 year') + INTERVAL '27 days', '{}'::jsonb),
(3, 3, 3, 'campaign', 6666.67, 'BRL', 'incoming', 'Faturamento campanha Ofertas do Dia - Outubro', 'INV-2024-003', 'credit_card', 'pending', NULL, (NOW() - INTERVAL '1 year') + INTERVAL '7 days', '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO publisher_billing (billing_id, publisher_id, campaign_id, totem_id, billing_type, amount, currency, direction, revenue_share_percentage, original_campaign_amount, platform_fee_amount, publisher_share_amount, description, invoice_number, payment_status, payment_date, due_date, approved_by, approved_at, payment_method, metadata) VALUES
(1, 1, 1, NULL, 'revenue_share', 35000.00, 'BRL', 'outgoing', 70.00, 50000.00, 15000.00, 35000.00, 'Revenue share campanha Black Friday', 'PAY-2024-001', 'pending_payout', NULL, (NOW() - INTERVAL '1 year') + INTERVAL '5 days', 1, (NOW() - INTERVAL '1 year'), 'bank_transfer', '{}'::jsonb),
(2, 2, 2, NULL, 'revenue_share', 3250.00, 'BRL', 'outgoing', 65.00, 5000.00, 1750.00, 3250.00, 'Revenue share campanha Medicamentos', 'PAY-2024-002', 'pending_payout', NULL, (NOW() - INTERVAL '1 year') + INTERVAL '5 days', 1, (NOW() - INTERVAL '1 year'), 'bank_transfer', '{}'::jsonb),
(3, 3, 3, NULL, 'revenue_share', 4000.00, 'BRL', 'outgoing', 60.00, 6666.67, 2666.67, 4000.00, 'Revenue share campanha Ofertas do Dia', 'PAY-2024-003', 'pending_payout', NULL, (NOW() - INTERVAL '1 year') + INTERVAL '5 days', 1, (NOW() - INTERVAL '1 year'), 'bank_transfer', '{}'::jsonb),
(4, 4, NULL, NULL, 'subscription', 299.00, 'BRL', 'incoming', NULL, NULL, NULL, NULL, 'Assinatura mensal Rede de Totens Urbanos', 'SUB-2024-001', 'paid', (NOW() - INTERVAL '1 year') - INTERVAL '10 days', (NOW() - INTERVAL '1 year') + INTERVAL '20 days', NULL, NULL, 'credit_card', '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO subscriptions (subscription_id, publisher_id, plan_id, stripe_subscription_id, stripe_customer_id, status, current_period_start, current_period_end, cancel_at_period_end, trial_start, trial_end, metadata) VALUES
(1, 4, 2, 'sub_test_001', 'cus_test_001', 'active', (NOW() - INTERVAL '1 year') - INTERVAL '10 days', '2035-12-31 23:59:59', false, NULL, NULL, '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO plan_publisher_access (plan_id, publisher_id, is_allowed, restrictions, notes) VALUES
(1, 1, true, '{}'::jsonb, 'Acesso básico'),
(1, 2, true, '{}'::jsonb, 'Acesso básico'),
(1, 3, true, '{}'::jsonb, 'Acesso básico'),
(2, 1, true, '{}'::jsonb, 'Acesso profissional'),
(2, 2, true, '{}'::jsonb, 'Acesso profissional'),
(3, 1, true, '{}'::jsonb, 'Acesso enterprise'),
(3, 4, true, '{}'::jsonb, 'Acesso enterprise')
ON CONFLICT DO NOTHING;

INSERT INTO subscriber_publisher_access (access_id, subscriber_id, publisher_id, contract_id, plan_id, access_type, granted_at, expires_at, is_active, granted_by, notes, metadata) VALUES
(1, 1, 1, 1, 2, 'contract', (NOW() - INTERVAL '1 year'), '2035-12-31 23:59:59', true, 1, 'Acesso via contrato Black Friday', '{}'::jsonb),
(2, 2, 2, 2, 1, 'contract', (NOW() - INTERVAL '1 year'), '2035-12-31 23:59:59', true, 1, 'Acesso via contrato Medicamentos', '{}'::jsonb),
(3, 3, 3, 3, 1, 'contract', (NOW() - INTERVAL '1 year'), '2035-12-31 23:59:59', true, 1, 'Acesso via contrato Ofertas do Dia', '{}'::jsonb),
(4, 4, 1, 4, 1, 'contract', (NOW() - INTERVAL '1 year'), '2035-12-31 23:59:59', true, 1, 'Acesso via contrato Menu Executivo', '{}'::jsonb),
(5, 5, 1, 5, 1, 'contract', (NOW() - INTERVAL '1 year'), '2035-12-31 23:59:59', true, 1, 'Acesso via contrato Check-up', '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO totem_playlists (totem_playlist_id, totem_id, smart_tv_id, publisher_id, playlist_hash, version, total_items, total_duration_seconds, status, is_active, generated_at, last_updated_at, expires_at, metadata, generation_log) VALUES
(1, 1, NULL, 1, 'hash_001', 1, 2, 40, 'active', true, (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), NULL, '{}'::jsonb, '{}'::jsonb),
(2, 2, NULL, 1, 'hash_002', 1, 2, 40, 'active', true, (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), NULL, '{}'::jsonb, '{}'::jsonb),
(3, 3, NULL, 1, 'hash_003', 1, 2, 40, 'active', true, (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), NULL, '{}'::jsonb, '{}'::jsonb),
(4, 4, NULL, 2, 'hash_004', 1, 1, 15, 'active', true, (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), NULL, '{}'::jsonb, '{}'::jsonb),
(5, 5, NULL, 2, 'hash_005', 1, 1, 15, 'active', true, (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), NULL, '{}'::jsonb, '{}'::jsonb),
(6, 6, NULL, 3, 'hash_006', 1, 1, 12, 'active', true, (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), NULL, '{}'::jsonb, '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO totem_playlist_items (item_id, totem_playlist_id, media_id, campaign_id, subscriber_id, publisher_id, order_index, priority, display_seconds, transition_type, transition_duration_ms, commercial_tier, time_share_percent, revenue_share_percent, start_time, end_time, days_of_week, is_active) VALUES
(1, 1, 1, 1, 1, 1, 0, 10, 10, 'fade', 2000, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(2, 1, 2, 1, 1, 1, 1, 10, 30, 'slide', 1500, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(3, 2, 1, 1, 1, 1, 0, 10, 10, 'fade', 2000, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(4, 2, 2, 1, 1, 1, 1, 10, 30, 'slide', 1500, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(5, 3, 1, 1, 1, 1, 0, 10, 10, 'fade', 2000, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(6, 3, 2, 1, 1, 1, 1, 10, 30, 'slide', 1500, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(7, 4, 3, 2, 2, 2, 0, 8, 15, 'fade', 3000, 'standard', 30.00, 65.00, NULL, NULL, NULL, true),
(8, 5, 3, 2, 2, 2, 0, 8, 15, 'fade', 3000, 'standard', 30.00, 65.00, NULL, NULL, NULL, true),
(9, 6, 4, 3, 3, 3, 0, 7, 12, 'fade', 2500, 'standard', 40.00, 60.00, NULL, NULL, NULL, true)
ON CONFLICT DO NOTHING;

INSERT INTO totem_playlist_generation_log (log_id, totem_id, totem_playlist_id, publisher_id, status, error_message, campaigns_included, playlists_included, medias_included, subscribers_included, generation_time_ms, generation_details, generated_at, generated_by) VALUES
(1, 1, 1, 1, 'success', NULL, 3, 1, 2, 3, 150, '{}'::jsonb, (NOW() - INTERVAL '1 year'), 'system'),
(2, 2, 2, 1, 'success', NULL, 3, 1, 2, 3, 145, '{}'::jsonb, (NOW() - INTERVAL '1 year'), 'system'),
(3, 3, 3, 1, 'success', NULL, 3, 1, 2, 3, 148, '{}'::jsonb, (NOW() - INTERVAL '1 year'), 'system'),
(4, 4, 4, 2, 'success', NULL, 1, 1, 1, 1, 80, '{}'::jsonb, (NOW() - INTERVAL '1 year'), 'system'),
(5, 5, 5, 2, 'success', NULL, 1, 1, 1, 1, 82, '{}'::jsonb, (NOW() - INTERVAL '1 year'), 'system'),
(6, 6, 6, 3, 'success', NULL, 1, 1, 1, 1, 75, '{}'::jsonb, (NOW() - INTERVAL '1 year'), 'system')
ON CONFLICT DO NOTHING;

INSERT INTO analytics_sessions (session_id, totem_id, start_time, end_time, duration_seconds, metadata) VALUES
(1, 1, (NOW() - INTERVAL '1 year') - INTERVAL '2 hours', (NOW() - INTERVAL '1 year') - INTERVAL '1 hour', 3600, '{}'::jsonb),
(2, 2, (NOW() - INTERVAL '1 year') - INTERVAL '1 hour', (NOW() - INTERVAL '1 year') - INTERVAL '30 minutes', 1800, '{}'::jsonb),
(3, 3, (NOW() - INTERVAL '1 year') - INTERVAL '3 hours', (NOW() - INTERVAL '1 year') - INTERVAL '2 hours', 3600, '{}'::jsonb),
(4, 4, (NOW() - INTERVAL '1 year') - INTERVAL '4 hours', (NOW() - INTERVAL '1 year') - INTERVAL '3 hours', 3600, '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO analytics_emotions (emotion_id, session_id, totem_id, emotion_type, confidence, detected_at, metadata) VALUES
(1, 1, 1, 'happy', 0.85, (NOW() - INTERVAL '1 year') - INTERVAL '2 hours', '{}'::jsonb),
(2, 1, 1, 'neutral', 0.75, (NOW() - INTERVAL '1 year') - INTERVAL '1 hour 50 minutes', '{}'::jsonb),
(3, 2, 2, 'happy', 0.90, (NOW() - INTERVAL '1 year') - INTERVAL '1 hour', '{}'::jsonb),
(4, 3, 3, 'surprised', 0.80, (NOW() - INTERVAL '1 year') - INTERVAL '3 hours', '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO analytics_gestures (gesture_id, session_id, totem_id, gesture_type, confidence, detected_at, metadata) VALUES
(1, 1, 1, 'wave', 0.88, (NOW() - INTERVAL '1 year') - INTERVAL '2 hours', '{}'::jsonb),
(2, 1, 1, 'point', 0.82, (NOW() - INTERVAL '1 year') - INTERVAL '1 hour 45 minutes', '{}'::jsonb),
(3, 2, 2, 'wave', 0.90, (NOW() - INTERVAL '1 year') - INTERVAL '1 hour', '{}'::jsonb),
(4, 3, 3, 'touch', 0.85, (NOW() - INTERVAL '1 year') - INTERVAL '3 hours', '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO execution_logs (log_id, totem_id, campaign_id, playlist_id, media_id, publisher_id, subscriber_id, event_type, event_data, timestamp, metadata) VALUES
(1, 1, 1, 1, 1, 1, 1, 'play_start', '{}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '1 hour', '{}'::jsonb),
(2, 1, 1, 1, 1, 1, 1, 'play_end', '{}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '1 hour' + INTERVAL '10 seconds', '{}'::jsonb),
(3, 1, 1, 1, 2, 1, 1, 'play_start', '{}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '1 hour' + INTERVAL '12 seconds', '{}'::jsonb),
(4, 2, 1, 2, 1, 1, 1, 'play_start', '{}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '30 minutes', '{}'::jsonb),
(5, 4, 2, 3, 3, 2, 2, 'play_start', '{}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '2 hours', '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO event_logs (log_id, event_type, entity_type, entity_id, totem_id, campaign_id, media_id, publisher_id, subscriber_id, user_id, metadata, severity, timestamp) VALUES
(1, 'create', 'campaign', 1, NULL, 1, NULL, 1, 1, 4, '{}'::jsonb, 'info', (NOW() - INTERVAL '1 year') - INTERVAL '10 days'),
(2, 'approve', 'media', 1, NULL, NULL, 1, NULL, 1, 1, '{}'::jsonb, 'info', (NOW() - INTERVAL '1 year') - INTERVAL '9 days'),
(3, 'update', 'totem', 1, 1, NULL, NULL, 1, NULL, 2, '{}'::jsonb, 'info', (NOW() - INTERVAL '1 year') - INTERVAL '5 days'),
(4, 'play', 'campaign', 1, 1, 1, NULL, 1, 1, NULL, '{}'::jsonb, 'info', (NOW() - INTERVAL '1 year') - INTERVAL '1 hour')
ON CONFLICT DO NOTHING;

-- =============================================
-- DISPATCHER LOG - Log de auditoria de decisões do Dispatcher-Totem
-- =============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dispatcher_log') THEN
        INSERT INTO dispatcher_log (
            log_id, totem_id, timestamp, selected_campaign_id, selected_playlist_id, 
            selected_source, selected_source_id, priority, candidates_count, candidates, 
            temporal_validation, technical_validation, integrity_validation, validation_details, 
            from_cache, cache_key, dispatch_plan, execution_time_ms
        ) VALUES
        -- Totem 1 - Shopping Entrada - Decisão recente com múltiplos candidatos
        (
            1, 1, (NOW() - INTERVAL '1 year') - INTERVAL '1 hour', 1, 1, 'campaign', 1, 10, 3,
            '[
                {
                    "source": "campaign",
                    "source_id": 1,
                    "campaign_id": 1,
                    "playlist_id": 1,
                    "priority": 10,
                    "commercial_tier": "premium",
                    "time_share_percent": 50.0,
                    "revenue_share_percent": 70.0,
                    "score": 95.5,
                    "validated": true
                },
                {
                    "source": "campaign",
                    "source_id": 4,
                    "campaign_id": 4,
                    "playlist_id": null,
                    "priority": 6,
                    "commercial_tier": "standard",
                    "time_share_percent": 20.0,
                    "revenue_share_percent": 70.0,
                    "score": 65.2,
                    "validated": true
                },
                {
                    "source": "campaign",
                    "source_id": 5,
                    "campaign_id": 5,
                    "playlist_id": null,
                    "priority": 5,
                    "commercial_tier": "standard",
                    "time_share_percent": 15.0,
                    "revenue_share_percent": 70.0,
                    "score": 45.8,
                    "validated": true
                }
            ]'::jsonb,
            true, true, true,
            '{
                "temporal": {
                    "valid": true,
                    "current_time": "2025-01-15T14:00:00Z",
                    "campaign_active": true,
                    "within_time_window": true,
                    "within_date_range": true,
                    "day_of_week_valid": true
                },
                "technical": {
                    "valid": true,
                    "totem_online": true,
                    "playlist_available": true,
                    "media_files_accessible": true,
                    "storage_space_ok": true
                },
                "integrity": {
                    "valid": true,
                    "playlist_items_count": 2,
                    "media_files_valid": true,
                    "campaign_contract_valid": true,
                    "publisher_access_valid": true
                }
            }'::jsonb,
            false, NULL,
            '{
                "totem_id": 1,
                "selected_campaign_id": 1,
                "selected_playlist_id": 1,
                "playlist_items": [
                    {
                        "media_id": 1,
                        "display_seconds": 10,
                        "order_index": 0,
                        "priority": 10,
                        "transition_type": "fade",
                        "transition_duration_ms": 2000
                    },
                    {
                        "media_id": 2,
                        "display_seconds": 30,
                        "order_index": 1,
                        "priority": 10,
                        "transition_type": "slide",
                        "transition_duration_ms": 1500
                    }
                ],
                "total_duration_seconds": 40,
                "generated_at": "2025-01-15T13:00:00Z"
            }'::jsonb,
            150
        ),
        -- Totem 2 - Shopping Praça - Decisão recente
        (
            2, 2, (NOW() - INTERVAL '1 year') - INTERVAL '30 minutes', 1, 2, 'campaign', 1, 10, 3,
            '[
                {
                    "source": "campaign",
                    "source_id": 1,
                    "campaign_id": 1,
                    "playlist_id": 2,
                    "priority": 10,
                    "commercial_tier": "premium",
                    "time_share_percent": 50.0,
                    "revenue_share_percent": 70.0,
                    "score": 94.8,
                    "validated": true
                },
                {
                    "source": "campaign",
                    "source_id": 4,
                    "campaign_id": 4,
                    "playlist_id": null,
                    "priority": 6,
                    "commercial_tier": "standard",
                    "time_share_percent": 20.0,
                    "revenue_share_percent": 70.0,
                    "score": 64.5,
                    "validated": true
                },
                {
                    "source": "direct",
                    "source_id": 2,
                    "campaign_id": null,
                    "playlist_id": null,
                    "priority": 3,
                    "commercial_tier": "basic",
                    "time_share_percent": 10.0,
                    "revenue_share_percent": 0.0,
                    "score": 30.2,
                    "validated": false
                }
            ]'::jsonb,
            true, true, true,
            '{
                "temporal": {
                    "valid": true,
                    "current_time": "2025-01-15T14:30:00Z",
                    "campaign_active": true,
                    "within_time_window": true,
                    "within_date_range": true,
                    "day_of_week_valid": true
                },
                "technical": {
                    "valid": true,
                    "totem_online": true,
                    "playlist_available": true,
                    "media_files_accessible": true,
                    "storage_space_ok": true
                },
                "integrity": {
                    "valid": true,
                    "playlist_items_count": 2,
                    "media_files_valid": true,
                    "campaign_contract_valid": true,
                    "publisher_access_valid": true
                }
            }'::jsonb,
            false, NULL,
            '{
                "totem_id": 2,
                "selected_campaign_id": 1,
                "selected_playlist_id": 2,
                "playlist_items": [
                    {
                        "media_id": 1,
                        "display_seconds": 10,
                        "order_index": 0,
                        "priority": 10,
                        "transition_type": "fade",
                        "transition_duration_ms": 2000
                    },
                    {
                        "media_id": 2,
                        "display_seconds": 30,
                        "order_index": 1,
                        "priority": 10,
                        "transition_type": "slide",
                        "transition_duration_ms": 1500
                    }
                ],
                "total_duration_seconds": 40,
                "generated_at": "2025-01-15T14:30:00Z"
            }'::jsonb,
            145
        ),
        -- Totem 4 - Farmácia Matriz - Decisão com cache
        (
            3, 4, (NOW() - INTERVAL '1 year') - INTERVAL '2 hours', 2, 3, 'campaign', 2, 8, 1,
            '[
                {
                    "source": "campaign",
                    "source_id": 2,
                    "campaign_id": 2,
                    "playlist_id": 3,
                    "priority": 8,
                    "commercial_tier": "standard",
                    "time_share_percent": 30.0,
                    "revenue_share_percent": 65.0,
                    "score": 78.3,
                    "validated": true
                }
            ]'::jsonb,
            true, true, true,
            '{
                "temporal": {
                    "valid": true,
                    "current_time": "2025-01-15T12:00:00Z",
                    "campaign_active": true,
                    "within_time_window": true,
                    "within_date_range": true,
                    "day_of_week_valid": true
                },
                "technical": {
                    "valid": true,
                    "totem_online": true,
                    "playlist_available": true,
                    "media_files_accessible": true,
                    "storage_space_ok": true
                },
                "integrity": {
                    "valid": true,
                    "playlist_items_count": 1,
                    "media_files_valid": true,
                    "campaign_contract_valid": true,
                    "publisher_access_valid": true
                }
            }'::jsonb,
            true, 'totem_4_campaign_2_2025-01-15T12:00:00Z',
            '{
                "totem_id": 4,
                "selected_campaign_id": 2,
                "selected_playlist_id": 3,
                "playlist_items": [
                    {
                        "media_id": 3,
                        "display_seconds": 15,
                        "order_index": 0,
                        "priority": 8,
                        "transition_type": "fade",
                        "transition_duration_ms": 3000
                    }
                ],
                "total_duration_seconds": 15,
                "generated_at": "2025-01-15T12:00:00Z",
                "from_cache": true
            }'::jsonb,
            80
        ),
        -- Totem 3 - Shopping Cinema - Decisão com múltiplas campanhas
        (
            4, 3, (NOW() - INTERVAL '1 year') - INTERVAL '45 minutes', 1, 1, 'campaign', 1, 10, 4,
            '[
                {
                    "source": "campaign",
                    "source_id": 1,
                    "campaign_id": 1,
                    "playlist_id": 1,
                    "priority": 10,
                    "commercial_tier": "premium",
                    "time_share_percent": 50.0,
                    "revenue_share_percent": 70.0,
                    "score": 96.2,
                    "validated": true
                },
                {
                    "source": "campaign",
                    "source_id": 4,
                    "campaign_id": 4,
                    "playlist_id": null,
                    "priority": 6,
                    "commercial_tier": "standard",
                    "time_share_percent": 20.0,
                    "revenue_share_percent": 70.0,
                    "score": 66.8,
                    "validated": true
                },
                {
                    "source": "campaign",
                    "source_id": 5,
                    "campaign_id": 5,
                    "playlist_id": null,
                    "priority": 5,
                    "commercial_tier": "standard",
                    "time_share_percent": 15.0,
                    "revenue_share_percent": 70.0,
                    "score": 47.3,
                    "validated": true
                },
                {
                    "source": "direct",
                    "source_id": 3,
                    "campaign_id": null,
                    "playlist_id": null,
                    "priority": 2,
                    "commercial_tier": "basic",
                    "time_share_percent": 5.0,
                    "revenue_share_percent": 0.0,
                    "score": 15.5,
                    "validated": false
                }
            ]'::jsonb,
            true, true, true,
            '{
                "temporal": {
                    "valid": true,
                    "current_time": "2025-01-15T14:15:00Z",
                    "campaign_active": true,
                    "within_time_window": true,
                    "within_date_range": true,
                    "day_of_week_valid": true
                },
                "technical": {
                    "valid": true,
                    "totem_online": true,
                    "playlist_available": true,
                    "media_files_accessible": true,
                    "storage_space_ok": true
                },
                "integrity": {
                    "valid": true,
                    "playlist_items_count": 2,
                    "media_files_valid": true,
                    "campaign_contract_valid": true,
                    "publisher_access_valid": true
                }
            }'::jsonb,
            false, NULL,
            '{
                "totem_id": 3,
                "selected_campaign_id": 1,
                "selected_playlist_id": 1,
                "playlist_items": [
                    {
                        "media_id": 1,
                        "display_seconds": 10,
                        "order_index": 0,
                        "priority": 10,
                        "transition_type": "fade",
                        "transition_duration_ms": 2000
                    },
                    {
                        "media_id": 2,
                        "display_seconds": 30,
                        "order_index": 1,
                        "priority": 10,
                        "transition_type": "slide",
                        "transition_duration_ms": 1500
                    }
                ],
                "total_duration_seconds": 40,
                "generated_at": "2025-01-15T14:15:00Z"
            }'::jsonb,
            162
        ),
        -- Totem 5 - Farmácia Filial - Decisão simples
        (
            5, 5, (NOW() - INTERVAL '1 year') - INTERVAL '1 hour 30 minutes', 2, 3, 'campaign', 2, 8, 1,
            '[
                {
                    "source": "campaign",
                    "source_id": 2,
                    "campaign_id": 2,
                    "playlist_id": 3,
                    "priority": 8,
                    "commercial_tier": "standard",
                    "time_share_percent": 30.0,
                    "revenue_share_percent": 65.0,
                    "score": 77.5,
                    "validated": true
                }
            ]'::jsonb,
            true, true, true,
            '{
                "temporal": {
                    "valid": true,
                    "current_time": "2025-01-15T12:30:00Z",
                    "campaign_active": true,
                    "within_time_window": true,
                    "within_date_range": true,
                    "day_of_week_valid": true
                },
                "technical": {
                    "valid": true,
                    "totem_online": true,
                    "playlist_available": true,
                    "media_files_accessible": true,
                    "storage_space_ok": true
                },
                "integrity": {
                    "valid": true,
                    "playlist_items_count": 1,
                    "media_files_valid": true,
                    "campaign_contract_valid": true,
                    "publisher_access_valid": true
                }
            }'::jsonb,
            false, NULL,
            '{
                "totem_id": 5,
                "selected_campaign_id": 2,
                "selected_playlist_id": 3,
                "playlist_items": [
                    {
                        "media_id": 3,
                        "display_seconds": 15,
                        "order_index": 0,
                        "priority": 8,
                        "transition_type": "fade",
                        "transition_duration_ms": 3000
                    }
                ],
                "total_duration_seconds": 15,
                "generated_at": "2025-01-15T12:30:00Z"
            }'::jsonb,
            92
        ),
        -- Totem 6 - Supermercado Caixas - Decisão com campanha de ofertas
        (
            6, 6, (NOW() - INTERVAL '1 year') - INTERVAL '20 minutes', 3, 4, 'campaign', 3, 7, 2,
            '[
                {
                    "source": "campaign",
                    "source_id": 3,
                    "campaign_id": 3,
                    "playlist_id": 4,
                    "priority": 7,
                    "commercial_tier": "standard",
                    "time_share_percent": 40.0,
                    "revenue_share_percent": 60.0,
                    "score": 72.4,
                    "validated": true
                },
                {
                    "source": "direct",
                    "source_id": 6,
                    "campaign_id": null,
                    "playlist_id": null,
                    "priority": 1,
                    "commercial_tier": "basic",
                    "time_share_percent": 5.0,
                    "revenue_share_percent": 0.0,
                    "score": 12.8,
                    "validated": false
                }
            ]'::jsonb,
            true, true, true,
            '{
                "temporal": {
                    "valid": true,
                    "current_time": "2025-01-15T14:40:00Z",
                    "campaign_active": true,
                    "within_time_window": true,
                    "within_date_range": true,
                    "day_of_week_valid": true
                },
                "technical": {
                    "valid": true,
                    "totem_online": true,
                    "playlist_available": true,
                    "media_files_accessible": true,
                    "storage_space_ok": true
                },
                "integrity": {
                    "valid": true,
                    "playlist_items_count": 1,
                    "media_files_valid": true,
                    "campaign_contract_valid": true,
                    "publisher_access_valid": true
                }
            }'::jsonb,
            false, NULL,
            '{
                "totem_id": 6,
                "selected_campaign_id": 3,
                "selected_playlist_id": 4,
                "playlist_items": [
                    {
                        "media_id": 4,
                        "display_seconds": 12,
                        "order_index": 0,
                        "priority": 7,
                        "transition_type": "fade",
                        "transition_duration_ms": 2500
                    }
                ],
                "total_duration_seconds": 12,
                "generated_at": "2025-01-15T14:40:00Z"
            }'::jsonb,
            118
        ),
        -- Totem 8 - Urbano 1 - Decisão com cache (última decisão)
        (
            7, 8, (NOW() - INTERVAL '1 year') - INTERVAL '15 minutes', NULL, NULL, 'direct', 8, 3, 1,
            '[
                {
                    "source": "direct",
                    "source_id": 8,
                    "campaign_id": null,
                    "playlist_id": null,
                    "priority": 3,
                    "commercial_tier": "basic",
                    "time_share_percent": 10.0,
                    "revenue_share_percent": 0.0,
                    "score": 25.0,
                    "validated": true
                }
            ]'::jsonb,
            true, true, false,
            '{
                "temporal": {
                    "valid": true,
                    "current_time": "2025-01-15T14:45:00Z",
                    "campaign_active": false,
                    "within_time_window": false,
                    "within_date_range": false,
                    "day_of_week_valid": true
                },
                "technical": {
                    "valid": true,
                    "totem_online": true,
                    "playlist_available": false,
                    "media_files_accessible": true,
                    "storage_space_ok": true
                },
                "integrity": {
                    "valid": false,
                    "playlist_items_count": 0,
                    "media_files_valid": false,
                    "campaign_contract_valid": false,
                    "publisher_access_valid": false,
                    "reason": "Nenhuma campanha ativa disponível para este totem"
                }
            }'::jsonb,
            true, 'totem_8_direct_2025-01-15T14:45:00Z',
            '{
                "totem_id": 8,
                "selected_campaign_id": null,
                "selected_playlist_id": null,
                "playlist_items": [],
                "total_duration_seconds": 0,
                "generated_at": "2025-01-15T14:45:00Z",
                "from_cache": true,
                "fallback_mode": true,
                "message": "Nenhuma campanha ativa disponível"
            }'::jsonb,
            45
        ),
        -- Totem 1 - Histórico (3 horas atrás)
        (
            8, 1, (NOW() - INTERVAL '1 year') - INTERVAL '3 hours', 1, 1, 'campaign', 1, 10, 2,
            '[
                {
                    "source": "campaign",
                    "source_id": 1,
                    "campaign_id": 1,
                    "playlist_id": 1,
                    "priority": 10,
                    "commercial_tier": "premium",
                    "time_share_percent": 50.0,
                    "revenue_share_percent": 70.0,
                    "score": 94.2,
                    "validated": true
                },
                {
                    "source": "campaign",
                    "source_id": 4,
                    "campaign_id": 4,
                    "playlist_id": null,
                    "priority": 6,
                    "commercial_tier": "standard",
                    "time_share_percent": 20.0,
                    "revenue_share_percent": 70.0,
                    "score": 64.8,
                    "validated": true
                }
            ]'::jsonb,
            true, true, true,
            '{
                "temporal": {
                    "valid": true,
                    "current_time": "2025-01-15T11:00:00Z",
                    "campaign_active": true,
                    "within_time_window": true,
                    "within_date_range": true,
                    "day_of_week_valid": true
                },
                "technical": {
                    "valid": true,
                    "totem_online": true,
                    "playlist_available": true,
                    "media_files_accessible": true,
                    "storage_space_ok": true
                },
                "integrity": {
                    "valid": true,
                    "playlist_items_count": 2,
                    "media_files_valid": true,
                    "campaign_contract_valid": true,
                    "publisher_access_valid": true
                }
            }'::jsonb,
            false, NULL,
            '{
                "totem_id": 1,
                "selected_campaign_id": 1,
                "selected_playlist_id": 1,
                "playlist_items": [
                    {
                        "media_id": 1,
                        "display_seconds": 10,
                        "order_index": 0,
                        "priority": 10,
                        "transition_type": "fade",
                        "transition_duration_ms": 2000
                    },
                    {
                        "media_id": 2,
                        "display_seconds": 30,
                        "order_index": 1,
                        "priority": 10,
                        "transition_type": "slide",
                        "transition_duration_ms": 1500
                    }
                ],
                "total_duration_seconds": 40,
                "generated_at": "2025-01-15T11:00:00Z"
            }'::jsonb,
            138
        ),
        -- Totem 2 - Histórico (5 horas atrás)
        (
            9, 2, (NOW() - INTERVAL '1 year') - INTERVAL '5 hours', 1, 2, 'campaign', 1, 10, 3,
            '[
                {
                    "source": "campaign",
                    "source_id": 1,
                    "campaign_id": 1,
                    "playlist_id": 2,
                    "priority": 10,
                    "commercial_tier": "premium",
                    "time_share_percent": 50.0,
                    "revenue_share_percent": 70.0,
                    "score": 93.5,
                    "validated": true
                },
                {
                    "source": "campaign",
                    "source_id": 4,
                    "campaign_id": 4,
                    "playlist_id": null,
                    "priority": 6,
                    "commercial_tier": "standard",
                    "time_share_percent": 20.0,
                    "revenue_share_percent": 70.0,
                    "score": 63.2,
                    "validated": true
                },
                {
                    "source": "direct",
                    "source_id": 2,
                    "campaign_id": null,
                    "playlist_id": null,
                    "priority": 3,
                    "commercial_tier": "basic",
                    "time_share_percent": 10.0,
                    "revenue_share_percent": 0.0,
                    "score": 28.5,
                    "validated": false
                }
            ]'::jsonb,
            true, true, true,
            '{
                "temporal": {
                    "valid": true,
                    "current_time": "2025-01-15T09:00:00Z",
                    "campaign_active": true,
                    "within_time_window": true,
                    "within_date_range": true,
                    "day_of_week_valid": true
                },
                "technical": {
                    "valid": true,
                    "totem_online": true,
                    "playlist_available": true,
                    "media_files_accessible": true,
                    "storage_space_ok": true
                },
                "integrity": {
                    "valid": true,
                    "playlist_items_count": 2,
                    "media_files_valid": true,
                    "campaign_contract_valid": true,
                    "publisher_access_valid": true
                }
            }'::jsonb,
            true, 'totem_2_campaign_1_2025-01-15T09:00:00Z',
            '{
                "totem_id": 2,
                "selected_campaign_id": 1,
                "selected_playlist_id": 2,
                "playlist_items": [
                    {
                        "media_id": 1,
                        "display_seconds": 10,
                        "order_index": 0,
                        "priority": 10,
                        "transition_type": "fade",
                        "transition_duration_ms": 2000
                    },
                    {
                        "media_id": 2,
                        "display_seconds": 30,
                        "order_index": 1,
                        "priority": 10,
                        "transition_type": "slide",
                        "transition_duration_ms": 1500
                    }
                ],
                "total_duration_seconds": 40,
                "generated_at": "2025-01-15T09:00:00Z",
                "from_cache": true
            }'::jsonb,
            52
        ),
        -- Totem 4 - Histórico (1 dia atrás)
        (
            10, 4, (NOW() - INTERVAL '1 year') - INTERVAL '1 day', 2, 3, 'campaign', 2, 8, 1,
            '[
                {
                    "source": "campaign",
                    "source_id": 2,
                    "campaign_id": 2,
                    "playlist_id": 3,
                    "priority": 8,
                    "commercial_tier": "standard",
                    "time_share_percent": 30.0,
                    "revenue_share_percent": 65.0,
                    "score": 76.8,
                    "validated": true
                }
            ]'::jsonb,
            true, true, true,
            '{
                "temporal": {
                    "valid": true,
                    "current_time": "2025-01-14T12:00:00Z",
                    "campaign_active": true,
                    "within_time_window": true,
                    "within_date_range": true,
                    "day_of_week_valid": true
                },
                "technical": {
                    "valid": true,
                    "totem_online": true,
                    "playlist_available": true,
                    "media_files_accessible": true,
                    "storage_space_ok": true
                },
                "integrity": {
                    "valid": true,
                    "playlist_items_count": 1,
                    "media_files_valid": true,
                    "campaign_contract_valid": true,
                    "publisher_access_valid": true
                }
            }'::jsonb,
            false, NULL,
            '{
                "totem_id": 4,
                "selected_campaign_id": 2,
                "selected_playlist_id": 3,
                "playlist_items": [
                    {
                        "media_id": 3,
                        "display_seconds": 15,
                        "order_index": 0,
                        "priority": 8,
                        "transition_type": "fade",
                        "transition_duration_ms": 3000
                    }
                ],
                "total_duration_seconds": 15,
                "generated_at": "2025-01-14T12:00:00Z"
            }'::jsonb,
            88
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

INSERT INTO qr_codes (qr_id, campaign_id, code, title, description, qr_type, content, url, redirect_url, size, color, background_color, error_correction_level, margin, image_url, scan_count, last_scan_at, max_scans, tracking_enabled, expires_at, metadata, is_active) VALUES
(1, 1, 'QR-BF-2024-001', 'QR Code Black Friday', 'QR code para campanha Black Friday', 'url', 'https://shoppingnorte.com.br/black-friday', 'https://shoppingnorte.com.br/black-friday', 'https://shoppingnorte.com.br/black-friday?utm_source=totem&utm_medium=qr', 200, '#000000', '#FFFFFF', 'M', 4, '/qr-codes/qr-bf-2024-001.png', 0, NULL, 1000, true, '2035-12-31', '{}'::jsonb, true),
(2, 2, 'QR-MED-2024-001', 'QR Code Medicamentos', 'QR code para campanha de medicamentos', 'url', 'https://saudemais.com.br/promocao-medicamentos', 'https://saudemais.com.br/promocao-medicamentos', 'https://saudemais.com.br/promocao-medicamentos?utm_source=totem&utm_medium=qr', 200, '#000000', '#FFFFFF', 'M', 4, '/qr-codes/qr-med-2024-001.png', 0, NULL, 500, true, '2035-12-31', '{}'::jsonb, true)
ON CONFLICT DO NOTHING;

INSERT INTO short_links (link_id, campaign_id, short_code, original_url, click_count, last_click_at, metadata, expires_at, is_active) VALUES
(1, 1, 'BF2024', 'https://shoppingnorte.com.br/black-friday', 0, NULL, '{}'::jsonb, '2035-12-31', true),
(2, 2, 'MED2024', 'https://saudemais.com.br/promocao-medicamentos', 0, NULL, '{}'::jsonb, '2035-12-31', true),
(3, 3, 'OFERTAS', 'https://economico.com.br/ofertas-dia', 0, NULL, '{}'::jsonb, '2035-12-31', true)
ON CONFLICT DO NOTHING;

INSERT INTO remote_commands (command_id, totem_id, user_id, command_type, status, parameters, response, sent_at, executed_at, completed_at, error_message, retry_count) VALUES
(1, 1, 2, 'ping', 'completed', '{}'::jsonb, '{}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '1 day', (NOW() - INTERVAL '1 year') - INTERVAL '1 day', (NOW() - INTERVAL '1 year') - INTERVAL '1 day', NULL, 0),
(2, 2, 2, 'restart', 'completed', '{}'::jsonb, '{}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '2 days', (NOW() - INTERVAL '1 year') - INTERVAL '2 days', (NOW() - INTERVAL '1 year') - INTERVAL '2 days', NULL, 0),
(3, 3, 2, 'load_playlist', 'pending', '{}'::jsonb, NULL, NULL, NULL, NULL, NULL, 0)
ON CONFLICT DO NOTHING;

INSERT INTO ota_updates (id, version, platform, file_path, file_size, checksum, description, changelog, is_mandatory, min_version, max_version, rollout_percentage, status, created_by, released_at) VALUES
(1, '2.0.1', 'all', '/ota/updates/v2.0.1.tar.gz', 104857600, 'sha256:abc123def456', 'Atualização de segurança e correções de bugs', 'Correções de bugs críticos e melhorias de performance', false, '2.0.0', NULL, 100, 'active', 1, (NOW() - INTERVAL '1 year') - INTERVAL '5 days'),
(2, '2.0.2', 'all', '/ota/updates/v2.0.2.tar.gz', 105000000, 'sha256:def456ghi789', 'Nova funcionalidade de analytics', 'Adicionado suporte para analytics avançado', false, '2.0.1', NULL, 50, 'testing', 1, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO totem_update_status (id, ota_update_id, totem_id, status, downloaded_at, installed_at, error_message) VALUES
(1, 1, 1, 'installed', (NOW() - INTERVAL '1 year') - INTERVAL '4 days', (NOW() - INTERVAL '1 year') - INTERVAL '4 days', NULL),
(2, 1, 2, 'installed', (NOW() - INTERVAL '1 year') - INTERVAL '4 days', (NOW() - INTERVAL '1 year') - INTERVAL '4 days', NULL),
(3, 1, 3, 'installed', (NOW() - INTERVAL '1 year') - INTERVAL '4 days', (NOW() - INTERVAL '1 year') - INTERVAL '4 days', NULL),
(4, 2, 1, 'downloaded', (NOW() - INTERVAL '1 year') - INTERVAL '1 day', NULL, NULL),
(5, 2, 2, 'pending', NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO reports (report_id, type, title, description, status, format, file_path, file_size, download_url, download_count, filters, template, custom_fields, ai_analysis, metadata, generated_at, expires_at, created_by) VALUES
(1, 'campaign', 'Relatório Campanha Black Friday', 'Relatório de performance da campanha Black Friday', 'completed', 'pdf', '/reports/campaign-1-2024-11.pdf', 2048576, '/api/reports/download/1', 3, '{}'::jsonb, 'default', '{}'::jsonb, false, '{}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '2 days', (NOW() - INTERVAL '1 year') + INTERVAL '28 days', 1),
(2, 'totem', 'Relatório Totens Shopping', 'Relatório de uso dos totens do shopping', 'completed', 'excel', '/reports/totems-shopping-2024-11.xlsx', 1536000, '/api/reports/download/2', 1, '{}'::jsonb, 'default', '{}'::jsonb, false, '{}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '1 day', (NOW() - INTERVAL '1 year') + INTERVAL '29 days', 1)
ON CONFLICT DO NOTHING;

INSERT INTO audit_logs (id, user_id, action, entity, entity_id, publisher_id, subscriber_id, metadata, ip_address, user_agent, timestamp) VALUES
(1, 1, 'create', 'campaign', 1, 1, 1, '{}'::jsonb, '192.168.1.100', 'Mozilla/5.0', (NOW() - INTERVAL '1 year') - INTERVAL '10 days'),
(2, 1, 'approve', 'media', 1, NULL, 1, '{}'::jsonb, '192.168.1.100', 'Mozilla/5.0', (NOW() - INTERVAL '1 year') - INTERVAL '9 days'),
(3, 2, 'update', 'totem', 1, 1, NULL, '{}'::jsonb, '192.168.1.101', 'Mozilla/5.0', (NOW() - INTERVAL '1 year') - INTERVAL '5 days'),
(4, 4, 'create', 'campaign', 1, 1, 1, '{}'::jsonb, '192.168.1.102', 'Mozilla/5.0', (NOW() - INTERVAL '1 year') - INTERVAL '10 days')
ON CONFLICT DO NOTHING;

-- =============================================
-- DEVICE TOKENS - Tokens de autenticação de dispositivos
-- =============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'device_tokens') THEN
        INSERT INTO device_tokens (
            device_token_id, totem_id, smart_tv_id, uin, device_id, platform, app_version,
            token, refresh_token, status, ip_address, user_agent, last_seen_at, expires_at
        ) VALUES
        -- Totem 1 - Shopping Entrada (Linux)
        (
            1, 1, NULL, 'UIN-SHOPPING-001-2024', 'DEVICE-001', 'linux', '2.1.0',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aW4iOiJVSU4tU0hPUFBJTkctMDAxLTIwMjQiLCJkZXZpY2VfaWQiOiJERVZJQ0UtMDAxIiwicGxhdGZvcm0iOiJsaW51eCIsImlhdCI6MTczNTAwMDAwMCwiZXhwIjoxNzM1MDg2NDAwfQ.token001',
            'refresh.token.001', 'active', '192.168.1.10', 'SmartSignage-Player/2.1.0 (Linux)', (NOW() - INTERVAL '1 year') - INTERVAL '5 minutes', (NOW() - INTERVAL '1 year') + INTERVAL '24 hours'
        ),
        -- Totem 2 - Shopping Praça (Linux)
        (
            2, 2, NULL, 'UIN-SHOPPING-002-2024', 'DEVICE-002', 'linux', '2.1.0',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aW4iOiJVSU4tU0hPUFBJTkctMDAyLTIwMjQiLCJkZXZpY2VfaWQiOiJERVZJQ0UtMDAyIiwicGxhdGZvcm0iOiJsaW51eCIsImlhdCI6MTczNTAwMDAwMCwiZXhwIjoxNzM1MDg2NDAwfQ.token002',
            'refresh.token.002', 'active', '192.168.1.11', 'SmartSignage-Player/2.1.0 (Linux)', (NOW() - INTERVAL '1 year') - INTERVAL '2 minutes', (NOW() - INTERVAL '1 year') + INTERVAL '24 hours'
        ),
        -- Totem 3 - Shopping Cinema (Linux)
        (
            3, 3, NULL, 'UIN-SHOPPING-003-2024', 'DEVICE-003', 'linux', '2.1.0',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aW4iOiJVSU4tU0hPUFBJTkctMDAzLTIwMjQiLCJkZXZpY2VfaWQiOiJERVZJQ0UtMDAzIiwicGxhdGZvcm0iOiJsaW51eCIsImlhdCI6MTczNTAwMDAwMCwiZXhwIjoxNzM1MDg2NDAwfQ.token003',
            'refresh.token.003', 'active', '192.168.1.12', 'SmartSignage-Player/2.1.0 (Linux)', (NOW() - INTERVAL '1 year') - INTERVAL '10 minutes', (NOW() - INTERVAL '1 year') + INTERVAL '24 hours'
        ),
        -- Totem 4 - Farmácia Matriz (Linux)
        (
            4, 4, NULL, 'UIN-FARMACIA-001-2024', 'DEVICE-004', 'linux', '2.1.0',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aW4iOiJVSU4tRkFSTUFDSUEtMDAxLTIwMjQiLCJkZXZpY2VfaWQiOiJERVZJQ0UtMDA0IiwicGxhdGZvcm0iOiJsaW51eCIsImlhdCI6MTczNTAwMDAwMCwiZXhwIjoxNzM1MDg2NDAwfQ.token004',
            'refresh.token.004', 'active', '192.168.1.20', 'SmartSignage-Player/2.1.0 (Linux)', (NOW() - INTERVAL '1 year') - INTERVAL '1 hour', (NOW() - INTERVAL '1 year') + INTERVAL '24 hours'
        ),
        -- Totem 5 - Farmácia Filial (Linux)
        (
            5, 5, NULL, 'UIN-FARMACIA-002-2024', 'DEVICE-005', 'linux', '2.1.0',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aW4iOiJVSU4tRkFSTUFDSUEtMDAyLTIwMjQiLCJkZXZpY2VfaWQiOiJERVZJQ0UtMDA1IiwicGxhdGZvcm0iOiJsaW51eCIsImlhdCI6MTczNTAwMDAwMCwiZXhwIjoxNzM1MDg2NDAwfQ.token005',
            'refresh.token.005', 'active', '192.168.1.21', 'SmartSignage-Player/2.1.0 (Linux)', (NOW() - INTERVAL '1 year') - INTERVAL '30 minutes', (NOW() - INTERVAL '1 year') + INTERVAL '24 hours'
        ),
        -- Totem 6 - Supermercado Caixas (Linux)
        (
            6, 6, NULL, 'UIN-SUPER-001-2024', 'DEVICE-006', 'linux', '2.1.0',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aW4iOiJVSU4tU1VQRVItMDAxLTIwMjQiLCJkZXZpY2VfaWQiOiJERVZJQ0UtMDA2IiwicGxhdGZvcm0iOiJsaW51eCIsImlhdCI6MTczNTAwMDAwMCwiZXhwIjoxNzM1MDg2NDAwfQ.token006',
            'refresh.token.006', 'active', '192.168.1.30', 'SmartSignage-Player/2.1.0 (Linux)', (NOW() - INTERVAL '1 year') - INTERVAL '15 minutes', (NOW() - INTERVAL '1 year') + INTERVAL '24 hours'
        ),
        -- Totem 8 - Urbano 1 (Linux)
        (
            7, 8, NULL, 'UIN-URBANO-001-2024', 'DEVICE-008', 'linux', '2.1.0',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aW4iOiJVSU4tVVJCQU5PLTAwMS0yMDI0IiwiZGV2aWNlX2lkIjoiREVWSUNFLTAwOCIsInBsYXRmb3JtIjoibGludXgiLCJpYXQiOjE3MzUwMDAwMDAsImV4cCI6MTczNTA4NjQwMH0.token008',
            'refresh.token.008', 'active', '192.168.1.50', 'SmartSignage-Player/2.1.0 (Linux)', (NOW() - INTERVAL '1 year') - INTERVAL '5 minutes', (NOW() - INTERVAL '1 year') + INTERVAL '24 hours'
        ),
        -- Smart TV 1 - Shopping Entrada (Tizen)
        (
            8, 1, 1, 'UIN-SHOPPING-001-2024', 'TV-DEVICE-001', 'tizen', '2.1.0',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aW4iOiJVSU4tU0hPUFBJTkctMDAxLTIwMjQiLCJkZXZpY2VfaWQiOiJUVi1ERVZJQ0UtMDAxIiwicGxhdGZvcm0iOiJ0aXplbiIsImlhdCI6MTczNTAwMDAwMCwiZXhwIjoxNzM1MDg2NDAwfQ.tv.token001',
            'refresh.tv.token.001', 'active', '192.168.1.10', 'SmartSignage-Player/2.1.0 (Tizen)', (NOW() - INTERVAL '1 year') - INTERVAL '3 minutes', (NOW() - INTERVAL '1 year') + INTERVAL '24 hours'
        ),
        -- Smart TV 2 - Shopping Praça (webOS)
        (
            9, 2, 2, 'UIN-SHOPPING-002-2024', 'TV-DEVICE-002', 'webos', '2.1.0',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aW4iOiJVSU4tU0hPUFBJTkctMDAyLTIwMjQiLCJkZXZpY2VfaWQiOiJUVi1ERVZJQ0UtMDAyIiwicGxhdGZvcm0iOiJ3ZWJvcyIsImlhdCI6MTczNTAwMDAwMCwiZXhwIjoxNzM1MDg2NDAwfQ.tv.token002',
            'refresh.tv.token.002', 'active', '192.168.1.11', 'SmartSignage-Player/2.1.0 (webOS)', (NOW() - INTERVAL '1 year') - INTERVAL '1 minute', (NOW() - INTERVAL '1 year') + INTERVAL '24 hours'
        ),
        -- Smart TV 3 - Shopping Cinema (Tizen)
        (
            10, 3, 3, 'UIN-SHOPPING-003-2024', 'TV-DEVICE-003', 'tizen', '2.1.0',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aW4iOiJVSU4tU0hPUFBJTkctMDAzLTIwMjQiLCJkZXZpY2VfaWQiOiJUVi1ERVZJQ0UtMDAzIiwicGxhdGZvcm0iOiJ0aXplbiIsImlhdCI6MTczNTAwMDAwMCwiZXhwIjoxNzM1MDg2NDAwfQ.tv.token003',
            'refresh.tv.token.003', 'active', '192.168.1.12', 'SmartSignage-Player/2.1.0 (Tizen)', (NOW() - INTERVAL '1 year') - INTERVAL '8 minutes', (NOW() - INTERVAL '1 year') + INTERVAL '24 hours'
        ),
        -- Smart TV 4 - Farmácia Matriz (webOS)
        (
            11, 4, 4, 'UIN-FARMACIA-001-2024', 'TV-DEVICE-004', 'webos', '2.1.0',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aW4iOiJVSU4tRkFSTUFDSUEtMDAxLTIwMjQiLCJkZXZpY2VfaWQiOiJUVi1ERVZJQ0UtMDA0IiwicGxhdGZvcm0iOiJ3ZWJvcyIsImlhdCI6MTczNTAwMDAwMCwiZXhwIjoxNzM1MDg2NDAwfQ.tv.token004',
            'refresh.tv.token.004', 'active', '192.168.1.20', 'SmartSignage-Player/2.1.0 (webOS)', (NOW() - INTERVAL '1 year') - INTERVAL '45 minutes', (NOW() - INTERVAL '1 year') + INTERVAL '24 hours'
        ),
        -- Smart TV 5 - Farmácia Filial (webOS)
        (
            12, 5, 5, 'UIN-FARMACIA-002-2024', 'TV-DEVICE-005', 'webos', '2.1.0',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aW4iOiJVSU4tRkFSTUFDSUEtMDAyLTIwMjQiLCJkZXZpY2VfaWQiOiJUVi1ERVZJQ0UtMDA1IiwicGxhdGZvcm0iOiJ3ZWJvcyIsImlhdCI6MTczNTAwMDAwMCwiZXhwIjoxNzM1MDg2NDAwfQ.tv.token005',
            'refresh.tv.token.005', 'active', '192.168.1.21', 'SmartSignage-Player/2.1.0 (webOS)', (NOW() - INTERVAL '1 year') - INTERVAL '20 minutes', (NOW() - INTERVAL '1 year') + INTERVAL '24 hours'
        ),
        -- Smart TV 6 - Supermercado Caixas (Tizen)
        (
            13, 6, 6, 'UIN-SUPER-001-2024', 'TV-DEVICE-006', 'tizen', '2.1.0',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aW4iOiJVSU4tU1VQRVItMDAxLTIwMjQiLCJkZXZpY2VfaWQiOiJUVi1ERVZJQ0UtMDA2IiwicGxhdGZvcm0iOiJ0aXplbiIsImlhdCI6MTczNTAwMDAwMCwiZXhwIjoxNzM1MDg2NDAwfQ.tv.token006',
            'refresh.tv.token.006', 'active', '192.168.1.30', 'SmartSignage-Player/2.1.0 (Tizen)', (NOW() - INTERVAL '1 year') - INTERVAL '12 minutes', (NOW() - INTERVAL '1 year') + INTERVAL '24 hours'
        ),
        -- Smart TV 8 - Urbano 1 (webOS)
        (
            14, 8, 8, 'UIN-URBANO-001-2024', 'TV-DEVICE-008', 'webos', '2.1.0',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aW4iOiJVSU4tVVJCQU5PLTAwMS0yMDI0IiwiZGV2aWNlX2lkIjoiVFYtREVWSUNFLTAwOCIsInBsYXRmb3JtIjoid2Vib3MiLCJpYXQiOjE3MzUwMDAwMDAsImV4cCI6MTczNTA4NjQwMH0.tv.token008',
            'refresh.tv.token.008', 'active', '192.168.1.50', 'SmartSignage-Player/2.1.0 (webOS)', (NOW() - INTERVAL '1 year') - INTERVAL '4 minutes', (NOW() - INTERVAL '1 year') + INTERVAL '24 hours'
        ),
        -- Token expirado (exemplo de histórico)
        (
            15, 7, 7, 'UIN-SUPER-002-2024', 'DEVICE-007', 'linux', '2.0.0',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.token',
            NULL, 'expired', '192.168.1.31', 'SmartSignage-Player/2.0.0 (Linux)', (NOW() - INTERVAL '1 year') - INTERVAL '3 days', (NOW() - INTERVAL '1 year') - INTERVAL '1 day'
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- =============================================
-- TOTEM PLAYLIST MIX - Mix inteligente de playlists
-- =============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'totem_playlist_mix') THEN
        INSERT INTO totem_playlist_mix (
            mix_id, totem_id, rule_id, mix_version, mix_items, total_items, total_duration,
            mix_strategy, context_snapshot, is_active, is_current, generated_at, applied_at, expires_at
        ) VALUES
        -- Totem 1 - Mix com múltiplas campanhas
        (
            1, 1, NULL, 2,
            '[
                {"media_id": 1, "playlist_id": 1, "campaign_id": 1, "order_index": 0, "weight": 0.5, "source": "campaign", "display_seconds": 10},
                {"media_id": 2, "playlist_id": 1, "campaign_id": 1, "order_index": 1, "weight": 0.5, "source": "campaign", "display_seconds": 30},
                {"media_id": 5, "playlist_id": null, "campaign_id": 4, "order_index": 2, "weight": 0.2, "source": "campaign", "display_seconds": 20},
                {"media_id": 6, "playlist_id": null, "campaign_id": 5, "order_index": 3, "weight": 0.15, "source": "campaign", "display_seconds": 45}
            ]'::jsonb,
            4, 105,
            'priority_weighted',
            '{"campaigns": [1, 4, 5], "priority_distribution": {"campaign_1": 50, "campaign_4": 20, "campaign_5": 15, "fallback": 15}}'::jsonb,
            true, true, (NOW() - INTERVAL '1 year') - INTERVAL '1 hour', (NOW() - INTERVAL '1 year') - INTERVAL '1 hour', NULL
        ),
        -- Totem 2 - Mix com campanha principal
        (
            2, 2, NULL, 2,
            '[
                {"media_id": 1, "playlist_id": 2, "campaign_id": 1, "order_index": 0, "weight": 0.6, "source": "campaign", "display_seconds": 10},
                {"media_id": 2, "playlist_id": 2, "campaign_id": 1, "order_index": 1, "weight": 0.6, "source": "campaign", "display_seconds": 30},
                {"media_id": 5, "playlist_id": null, "campaign_id": 4, "order_index": 2, "weight": 0.25, "source": "campaign", "display_seconds": 20}
            ]'::jsonb,
            3, 60,
            'priority_weighted',
            '{"campaigns": [1, 4], "priority_distribution": {"campaign_1": 60, "campaign_4": 25, "fallback": 15}}'::jsonb,
            true, false, (NOW() - INTERVAL '1 year') - INTERVAL '30 minutes', (NOW() - INTERVAL '1 year') - INTERVAL '30 minutes', NULL
        ),
        -- Totem 3 - Mix Shopping Cinema
        (
            3, 3, NULL, 2,
            '[
                {"media_id": 1, "playlist_id": 1, "campaign_id": 1, "order_index": 0, "weight": 0.55, "source": "campaign", "display_seconds": 10},
                {"media_id": 2, "playlist_id": 1, "campaign_id": 1, "order_index": 1, "weight": 0.55, "source": "campaign", "display_seconds": 30},
                {"media_id": 5, "playlist_id": null, "campaign_id": 4, "order_index": 2, "weight": 0.2, "source": "campaign", "display_seconds": 20},
                {"media_id": 6, "playlist_id": null, "campaign_id": 5, "order_index": 3, "weight": 0.15, "source": "campaign", "display_seconds": 45}
            ]'::jsonb,
            4, 105,
            'priority_weighted',
            '{"campaigns": [1, 4, 5], "priority_distribution": {"campaign_1": 55, "campaign_4": 20, "campaign_5": 15, "fallback": 10}}'::jsonb,
            true, false, (NOW() - INTERVAL '1 year') - INTERVAL '45 minutes', (NOW() - INTERVAL '1 year') - INTERVAL '45 minutes', NULL
        ),
        -- Totem 4 - Mix Farmácia Matriz
        (
            4, 4, NULL, 2,
            '[
                {"media_id": 3, "playlist_id": 3, "campaign_id": 2, "order_index": 0, "weight": 1.0, "source": "campaign", "display_seconds": 15}
            ]'::jsonb,
            1, 15,
            'single_campaign',
            '{"campaigns": [2], "priority_distribution": {"campaign_2": 100}}'::jsonb,
            true, false, (NOW() - INTERVAL '1 year') - INTERVAL '2 hours', (NOW() - INTERVAL '1 year') - INTERVAL '2 hours', NULL
        ),
        -- Totem 5 - Mix Farmácia Filial
        (
            5, 5, NULL, 2,
            '[
                {"media_id": 3, "playlist_id": 3, "campaign_id": 2, "order_index": 0, "weight": 1.0, "source": "campaign", "display_seconds": 15}
            ]'::jsonb,
            1, 15,
            'single_campaign',
            '{"campaigns": [2], "priority_distribution": {"campaign_2": 100}}'::jsonb,
            true, false, (NOW() - INTERVAL '1 year') - INTERVAL '1 hour 30 minutes', (NOW() - INTERVAL '1 year') - INTERVAL '1 hour 30 minutes', NULL
        ),
        -- Totem 6 - Mix Supermercado Caixas
        (
            6, 6, NULL, 2,
            '[
                {"media_id": 4, "playlist_id": 4, "campaign_id": 3, "order_index": 0, "weight": 1.0, "source": "campaign", "display_seconds": 12}
            ]'::jsonb,
            1, 12,
            'single_campaign',
            '{"campaigns": [3], "priority_distribution": {"campaign_3": 100}}'::jsonb,
            true, false, (NOW() - INTERVAL '1 year') - INTERVAL '20 minutes', (NOW() - INTERVAL '1 year') - INTERVAL '20 minutes', NULL
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- =============================================
-- INTERACTION LOGS - Logs de interações com totens
-- =============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'interaction_logs') THEN
        INSERT INTO interaction_logs (
            interaction_id, totem_id, tag_id, person_id, interaction_type, interaction_data, timestamp
        ) VALUES
        (1, 1, NULL, NULL, 'gesture_detected', '{"gesture": "wave", "confidence": 0.85, "duration_ms": 1200}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '2 hours'),
        (2, 1, NULL, NULL, 'gesture_detected', '{"gesture": "point", "confidence": 0.78, "duration_ms": 800}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '1 hour 45 minutes'),
        (3, 2, NULL, NULL, 'gesture_detected', '{"gesture": "wave", "confidence": 0.92, "duration_ms": 1500}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '1 hour'),
        (4, 3, NULL, NULL, 'gesture_detected', '{"gesture": "touch", "confidence": 0.88, "duration_ms": 500}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '3 hours'),
        (5, 4, NULL, NULL, 'tag_scanned', '{"tag_type": "QR", "tag_value": "QR-BF-2024-001", "campaign_id": 1}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '4 hours'),
        (6, 6, NULL, NULL, 'tag_scanned', '{"tag_type": "QR", "tag_value": "QR-MED-2024-001", "campaign_id": 2}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '5 hours')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- =============================================
-- TOTEM ML CONFIG - Configurações de ML/AI para totens
-- =============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'totem_ml_config') THEN
        INSERT INTO totem_ml_config (
            config_id, totem_id, emotion_detection_enabled, gesture_detection_enabled,
            face_recognition_enabled, behavior_analysis_enabled, config
        ) VALUES
        (1, 1, true, true, false, true, '{"emotion_threshold": 0.7, "gesture_threshold": 0.75, "behavior_tracking": true}'::jsonb),
        (2, 2, true, true, false, true, '{"emotion_threshold": 0.7, "gesture_threshold": 0.75, "behavior_tracking": true}'::jsonb),
        (3, 3, true, true, false, true, '{"emotion_threshold": 0.7, "gesture_threshold": 0.75, "behavior_tracking": true}'::jsonb),
        (4, 4, false, false, false, false, '{}'::jsonb),
        (5, 5, false, false, false, false, '{}'::jsonb),
        (6, 6, true, false, false, false, '{"emotion_threshold": 0.65}'::jsonb),
        (8, 8, true, true, false, true, '{"emotion_threshold": 0.7, "gesture_threshold": 0.75, "behavior_tracking": true}'::jsonb)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

