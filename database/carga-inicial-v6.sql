-- =============================================
-- CARGA INICIAL V6 - Seed enxuto para testes
-- Data: 2026-01-26
-- Versão: 6.3
-- Descrição: 10 subscribers, propagandas por tema, planos Shoppings/Supermercados/Farmácias
--
-- Estrutura:
-- Publishers 1-2 (Zaffari, Koch): totens e Smart TVs (mantidos)
-- Planos: Shoppings (4), Supermercados (5), Farmácias (6)
-- Subscribers 1-10: cada um em plano diferente, mídias por tema
-- Playlists e campanhas por subscriber - vinculadas aos publishers conforme plano (campaign_totems, campaign_publishers, campaign_locals, subscriber_publisher_access)
--
-- Mídias: copiadas de player-web/propagandas e vinhetas pelo instalador
-- =============================================

-- =============================================
-- LIMPEZA ANTES DA CARGA
-- Não listamos a tabela users no TRUNCATE; porém, devido ao CASCADE,
-- ao truncar subscribers e publishers a tabela users também é truncada
-- (users tem FK para subscribers e publishers). Os dados iniciais de
-- users são re-inseridos pelo INSERT abaixo.
-- =============================================
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

-- =============================================
-- SUBSCRIBERS (10) - por tema/segmento
-- =============================================
INSERT INTO subscribers (subscriber_id, name, contact_name, email, phone, whatsapp, address, category_segment, description, is_active) VALUES
(1, 'Cestto', 'Contato Cestto', 'contato@cestto.com.br', '+55 51 3333-1111', '+55 51 99999-1111', 'Porto Alegre, RS', 'Supermercado', 'Rede de supermercados Cestto', true),
(2, 'Bourbon', 'Contato Bourbon', 'contato@bourbon.com.br', '+55 51 3333-2222', '+55 51 99999-2222', 'Porto Alegre, RS', 'Shopping', 'Shopping Bourbon', true),
(3, 'Panvel', 'Contato Panvel', 'contato@panvel.com.br', '+55 51 3333-3333', '+55 51 99999-3333', 'Porto Alegre, RS', 'Farmácia', 'Rede de farmácias Panvel', true),
(4, 'Fruteira Geraldo', 'Contato Fruteira', 'contato@fruteirageraldo.com.br', '+55 51 3333-4444', '+55 51 99999-4444', 'Porto Alegre, RS', 'Supermercado', 'Supermercado e frutaria', true),
(5, 'Fashion Store', 'Contato Fashion', 'contato@fashionstore.com.br', '+55 51 3333-5555', '+55 51 99999-5555', 'Porto Alegre, RS', 'Shopping', 'Loja de moda em shopping', true),
(6, 'Beleza Produtos', 'Contato Beleza', 'contato@belezaprodutos.com.br', '+55 51 3333-6666', '+55 51 99999-6666', 'Porto Alegre, RS', 'Supermercado', 'Cosméticos e beleza', true),
(7, 'Check-up Saúde', 'Contato Check-up', 'contato@checkupsaude.com.br', '+55 51 3333-7777', '+55 51 99999-7777', 'Porto Alegre, RS', 'Farmácia', 'Farmácia e saúde', true),
(8, 'Super Promo', 'Contato Super Promo', 'contato@superpromo.com.br', '+55 51 3333-8888', '+55 51 99999-8888', 'Porto Alegre, RS', 'Supermercado', 'Promoções de supermercado', true),
(9, 'Smartsignage Demo', 'Contato Smartsignage', 'contato@smartsignage.demo', '+55 51 3333-9999', '+55 51 99999-9999', 'Porto Alegre, RS', 'Shopping', 'Demonstração institucional', true),
(10, 'Menu Executivo', 'Contato Menu', 'contato@menuexecutivo.com.br', '+55 51 3333-0000', '+55 51 99999-0000', 'Porto Alegre, RS', 'Shopping', 'Alimentação em shopping', true)
ON CONFLICT DO NOTHING;

-- =============================================
-- PUBLISHERS (2) - is_active=true para iniciar ativos
-- =============================================
INSERT INTO publishers (publisher_id, name, contact_name, email, phone, whatsapp, category_segment, description, is_subscriber, is_publisher, client_type, is_active) VALUES
(1, 'Cia.Totem Digital', 'Gerente ismael', 'ismael@totemdigital.com.br', '+55 51 3220-1000', '+55 51 98000-1000', 'Shopping', 'Rede de shoppings Cia Zaffari', false, true, 'publisher', true),
(2, 'Grupo Koch', 'Gerente Koch', 'admin@koch.com.br', '+55 51 3220-2000', '+55 51 98000-2000', 'Shopping', 'Grupo Koch - múltiplos totens', false, true, 'publisher', true)
ON CONFLICT DO NOTHING;

-- =============================================
-- ROLES, PERMISSIONS, PLANS, SYSTEM_SETTINGS
-- =============================================
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

INSERT INTO plans (plan_id, name, slug, description, price_monthly, price_yearly, currency, billing_interval, features, limits, is_active, is_popular, is_default, sort_order) VALUES
(1, 'Plano Básico', 'plano-basico', 'Plano básico', 99.00, 990.00, 'BRL', 'month', '{"campaigns":30,"storage_gb":50}'::jsonb, '{"totems":3,"campaigns":30,"storage_gb":50}'::jsonb, true, false, true, 1),
(2, 'Plano Profissional', 'plano-profissional', 'Plano profissional', 299.00, 2990.00, 'BRL', 'month', '{"campaigns":20,"storage_gb":50}'::jsonb, '{"totems":10,"campaigns":20,"storage_gb":50}'::jsonb, true, true, false, 2),
(3, 'Plano Enterprise', 'plano-enterprise', 'Plano enterprise', 999.00, 9990.00, 'BRL', 'month', '{"campaigns":100,"storage_gb":500}'::jsonb, '{"totems":50,"campaigns":100,"storage_gb":500}'::jsonb, true, false, false, 3),
(4, 'Plano Shoppings', 'plano-shoppings', 'Plano para anunciantes em shoppings', 399.00, 3990.00, 'BRL', 'month', '{"campaigns":30,"storage_gb":80}'::jsonb, '{"totems":15,"campaigns":30,"storage_gb":80}'::jsonb, true, false, false, 4),
(5, 'Plano Supermercados', 'plano-supermercados', 'Plano para anunciantes em supermercados', 349.00, 3490.00, 'BRL', 'month', '{"campaigns":25,"storage_gb":60}'::jsonb, '{"totems":12,"campaigns":25,"storage_gb":60}'::jsonb, true, false, false, 5),
(6, 'Plano Farmácias', 'plano-farmacias', 'Plano para anunciantes em farmácias', 299.00, 2990.00, 'BRL', 'month', '{"campaigns":20,"storage_gb":50}'::jsonb, '{"totems":10,"campaigns":20,"storage_gb":50}'::jsonb, true, false, false, 6)
ON CONFLICT DO NOTHING;

INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description) VALUES
('app.name', 'SmartSignage Pro', 'string', 'system', 'Nome da aplicação'),
('app.version', '2.0.0', 'string', 'system', 'Versão'),
('dispatcher.cache_ttl_seconds', '300', 'number', 'dispatcher', 'TTL cache dispatcher'),
('dispatcher.cache_enabled', 'true', 'boolean', 'dispatcher', 'Cache dispatcher'),
('media.storage.path', '/opt/smart-signage/public/assets/uploads', 'string', 'media', 'Caminho uploads')
ON CONFLICT (setting_key) DO NOTHING;

-- =============================================
-- USERS (admin + publishers + 10 subscribers)
-- =============================================
INSERT INTO users (id, username, email, password_hash, first_name, last_name, name, phone, role, user_type, is_tenant_user, publisher_id, subscriber_id, is_active, email_verified) VALUES
(1, 'admin', 'admin@smartsignage.local', '$2a$12$eenSYwwg9qOkcleFuH2lrOL5u3nAMN8MqQlsOQJh59mg16gcBu5A2', 'Admin', 'Sistema', 'Admin Sistema', '+55 11 0000-0000', 'admin', 'system_user', true, NULL, NULL, true, true),
(2, 'totemdigital.admin', 'ismael@totemdiigital.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Admin', 'totem_digital', 'Admin totem digital', '+55 51 3220-1000', 'manager', 'publisher_user', false, 1, NULL, true, true),
(3, 'koch.admin', 'admin@koch.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Admin', 'Koch', 'Admin Koch', '+55 51 3220-2000', 'manager', 'publisher_user', false, 2, NULL, true, true),
(4, 'cestto.admin', 'contato@cestto.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Admin', 'Cestto', 'Admin Cestto', '+55 51 3333-1111', 'manager', 'subscriber_user', false, NULL, 1, true, true),
(5, 'bourbon.admin', 'contato@bourbon.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Admin', 'Bourbon', 'Admin Bourbon', '+55 51 3333-2222', 'manager', 'subscriber_user', false, NULL, 2, true, true),
(6, 'panvel.admin', 'contato@panvel.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Admin', 'Panvel', 'Admin Panvel', '+55 51 3333-3333', 'manager', 'subscriber_user', false, NULL, 3, true, true),
(7, 'fruteira.admin', 'contato@fruteirageraldo.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Admin', 'Fruteira', 'Admin Fruteira', '+55 51 3333-4444', 'manager', 'subscriber_user', false, NULL, 4, true, true),
(8, 'fashion.admin', 'contato@fashionstore.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Admin', 'Fashion', 'Admin Fashion', '+55 51 3333-5555', 'manager', 'subscriber_user', false, NULL, 5, true, true),
(9, 'beleza.admin', 'contato@belezaprodutos.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Admin', 'Beleza', 'Admin Beleza', '+55 51 3333-6666', 'manager', 'subscriber_user', false, NULL, 6, true, true),
(10, 'checkup.admin', 'contato@checkupsaude.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Admin', 'Check-up', 'Admin Check-up', '+55 51 3333-7777', 'manager', 'subscriber_user', false, NULL, 7, true, true),
(11, 'superpromo.admin', 'contato@superpromo.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Admin', 'Super Promo', 'Admin Super Promo', '+55 51 3333-8888', 'manager', 'subscriber_user', false, NULL, 8, true, true),
(12, 'smartsignage.admin', 'contato@smartsignage.demo', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Admin', 'Smartsignage', 'Admin Smartsignage', '+55 51 3333-9999', 'manager', 'subscriber_user', false, NULL, 9, true, true),
(13, 'menu.admin', 'contato@menuexecutivo.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Admin', 'Menu', 'Admin Menu', '+55 51 3333-0000', 'manager', 'subscriber_user', false, NULL, 10, true, true)
ON CONFLICT DO NOTHING;

INSERT INTO user_flags (user_id, flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4, flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9) VALUES
(1, true, true, true, true, true, true, true, true, true, true),
(2, true, false, false, true, false, true, true, false, true, false),
(3, true, false, false, true, false, true, true, false, true, false),
(4, false, false, false, false, false, false, true, false, false, true),
(5, false, false, false, false, false, false, true, false, false, true),
(6, false, false, false, false, false, false, true, false, false, true),
(7, false, false, false, false, false, false, true, false, false, true),
(8, false, false, false, false, false, false, true, false, false, true),
(9, false, false, false, false, false, false, true, false, false, true),
(10, false, false, false, false, false, false, true, false, false, true),
(11, false, false, false, false, false, false, true, false, false, true),
(12, false, false, false, false, false, false, true, false, false, true),
(13, false, false, false, false, false, false, true, false, false, true)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO role_flags_default (role, flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4, flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9) VALUES
('owner_system', true, true, true, true, true, true, true, true, true, true),
('admin', true, false, true, true, true, true, true, true, true, true),
('publisher_user', true, false, false, true, false, true, true, false, true, false),
('subscriber_user', false, false, false, false, false, false, true, false, false, true)
ON CONFLICT (role) DO NOTHING;

INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES
(1, 1, 1),
(2, 4, 1),
(3, 4, 1),
(4, 5, 1),
(5, 5, 1),
(6, 5, 1),
(7, 5, 1),
(8, 5, 1),
(9, 5, 1),
(10, 5, 1),
(11, 5, 1),
(12, 5, 1),
(13, 5, 1)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10),
(2, 1), (2, 2), (2, 3), (2, 4), (2, 5), (2, 6), (2, 7), (2, 8), (2, 9), (2, 10),
(3, 1), (3, 2), (3, 3), (3, 4), (3, 5), (3, 6), (3, 7), (3, 8), (3, 9), (3, 10),
(4, 2), (4, 6), (4, 9),
(5, 2), (5, 5), (5, 6)
ON CONFLICT DO NOTHING;

-- =============================================
-- LOCALS
-- Publisher 1: Higienopolis, Praça Alimentação
-- Publisher 2: 5 locals (Locais 1-5)
-- =============================================
INSERT INTO locals (local_id, publisher_id, name, category_segment, address, city, state, zip_code, country, latitude, longitude, timezone, description, is_active) VALUES
(1, 1, 'Higienopolis', 'Shopping', 'Av. Presidente Vargas, 1000', 'Porto Alegre', 'RS', '90460-000', 'BR', -30.0277, -51.2287, 'America/Sao_Paulo', 'Totem Higienopolis', true),
(2, 1, 'Praça Alimentação', 'Shopping', 'Av. Presidente Vargas, 1000', 'Porto Alegre', 'RS', '90460-000', 'BR', -30.0278, -51.2288, 'America/Sao_Paulo', '2 Smart TVs Praça Alimentação', true),
(3, 2, 'Local Koch 1', 'Shopping', 'Av. dos Estados, 100', 'Porto Alegre', 'RS', '90000-000', 'BR', -30.0300, -51.2300, 'America/Sao_Paulo', 'Totem 1 Grupo Koch', true),
(4, 2, 'Local Koch 2', 'Shopping', 'Av. dos Estados, 200', 'Porto Alegre', 'RS', '90000-000', 'BR', -30.0301, -51.2301, 'America/Sao_Paulo', 'Totem 2 Grupo Koch', true),
(5, 2, 'Local Koch 3', 'Shopping', 'Av. dos Estados, 300', 'Porto Alegre', 'RS', '90000-000', 'BR', -30.0302, -51.2302, 'America/Sao_Paulo', 'Totem 3 Grupo Koch', true),
(6, 2, 'Local Koch 4', 'Shopping', 'Av. dos Estados, 400', 'Porto Alegre', 'RS', '90000-000', 'BR', -30.0303, -51.2303, 'America/Sao_Paulo', 'Totem 4 Grupo Koch', true),
(7, 2, 'Local Koch 5', 'Shopping', 'Av. dos Estados, 500', 'Porto Alegre', 'RS', '90000-000', 'BR', -30.0304, -51.2304, 'America/Sao_Paulo', 'Totem 5 Grupo Koch', true)
ON CONFLICT DO NOTHING;

-- =============================================
-- TOTEMS
-- Publisher 1: 1 totem Higienopolis (local 1), 1 totem Praça (local 2) - total 2
-- Publisher 2: 5 totens (locals 3-7)
-- =============================================
INSERT INTO totems (totem_id, identifier, uin, device_id, local_id, name, description, model, manufacturer, firmware_version, hardware_version, os_version, status, last_heartbeat, heartbeat_interval, network_info, capabilities, is_active) VALUES
(1, 'TOTEM-ZAFFARI-001', 'UIN-ZAFFARI-001-2025', 'DEV-ZAFFARI-001', 1, 'Totem Higienopolis', 'Totem Zaffari Higienopolis', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW() - INTERVAL '2 minutes', 60, '{"ip": "192.168.1.10"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true),
(2, 'TOTEM-ZAFFARI-002', 'UIN-ZAFFARI-002-2025', 'DEV-ZAFFARI-002', 2, 'Totem Praça Alimentação', 'Totem Praça Zaffari - 2 Smart TVs', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW() - INTERVAL '3 minutes', 60, '{"ip": "192.168.1.11"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true),
(3, 'TOTEM-KOCH-001', 'UIN-KOCH-001-2025', 'DEV-KOCH-001', 3, 'Totem Koch 1', 'Totem Grupo Koch 1', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW() - INTERVAL '1 minute', 60, '{"ip": "192.168.1.20"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true),
(4, 'TOTEM-KOCH-002', 'UIN-KOCH-002-2025', 'DEV-KOCH-002', 4, 'Totem Koch 2', 'Totem Grupo Koch 2', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW() - INTERVAL '4 minutes', 60, '{"ip": "192.168.1.21"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true),
(5, 'TOTEM-KOCH-003', 'UIN-KOCH-003-2025', 'DEV-KOCH-003', 5, 'Totem Koch 3', 'Totem Grupo Koch 3', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW() - INTERVAL '2 minutes', 60, '{"ip": "192.168.1.22"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true),
(6, 'TOTEM-KOCH-004', 'UIN-KOCH-004-2025', 'DEV-KOCH-004', 6, 'Totem Koch 4', 'Totem Grupo Koch 4', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW() - INTERVAL '5 minutes', 60, '{"ip": "192.168.1.23"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true),
(7, 'TOTEM-KOCH-005', 'UIN-KOCH-005-2025', 'DEV-KOCH-005', 7, 'Totem Koch 5', 'Totem Grupo Koch 5', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW() - INTERVAL '3 minutes', 60, '{"ip": "192.168.1.24"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- =============================================
-- SMART TVs (2 no totem 2 Zaffari, 2 em cada totem Koch = 10)
-- =============================================
INSERT INTO smart_tvs (smart_tv_id, totem_id, identifier, device_id, name, brand, model, platform, firmware_version, resolution_width, resolution_height, orientation, status, last_heartbeat, capabilities, settings, is_active) VALUES
(1, 2, 'TV-ZAFFARI-PRACA-01', 'TV-ZAFF-01', 'Smart TV Praça 1', 'Samsung', 'QN55Q80A', 'Tizen', '6.0.1', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '2 minutes', '{"hdr": true, "4k": true}'::jsonb, '{}'::jsonb, true),
(2, 2, 'TV-ZAFFARI-PRACA-02', 'TV-ZAFF-02', 'Smart TV Praça 2', 'Samsung', 'QN55Q80A', 'Tizen', '6.0.1', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '3 minutes', '{"hdr": true, "4k": true}'::jsonb, '{}'::jsonb, true),
(3, 3, 'TV-KOCH-01-A', 'TV-KOCH-01A', 'Smart TV Koch 1-A', 'LG', '55NANO75', 'webOS', '7.0.0', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '1 minute', '{"hdr": true, "4k": true}'::jsonb, '{}'::jsonb, true),
(4, 3, 'TV-KOCH-01-B', 'TV-KOCH-01B', 'Smart TV Koch 1-B', 'LG', '55NANO75', 'webOS', '7.0.0', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '2 minutes', '{"hdr": true, "4k": true}'::jsonb, '{}'::jsonb, true),
(5, 4, 'TV-KOCH-02-A', 'TV-KOCH-02A', 'Smart TV Koch 2-A', 'LG', '55NANO75', 'webOS', '7.0.0', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '4 minutes', '{"hdr": true, "4k": true}'::jsonb, '{}'::jsonb, true),
(6, 4, 'TV-KOCH-02-B', 'TV-KOCH-02B', 'Smart TV Koch 2-B', 'LG', '55NANO75', 'webOS', '7.0.0', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '3 minutes', '{"hdr": true, "4k": true}'::jsonb, '{}'::jsonb, true),
(7, 5, 'TV-KOCH-03-A', 'TV-KOCH-03A', 'Smart TV Koch 3-A', 'LG', '55NANO75', 'webOS', '7.0.0', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '2 minutes', '{"hdr": true, "4k": true}'::jsonb, '{}'::jsonb, true),
(8, 5, 'TV-KOCH-03-B', 'TV-KOCH-03B', 'Smart TV Koch 3-B', 'LG', '55NANO75', 'webOS', '7.0.0', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '2 minutes', '{"hdr": true, "4k": true}'::jsonb, '{}'::jsonb, true),
(9, 6, 'TV-KOCH-04-A', 'TV-KOCH-04A', 'Smart TV Koch 4-A', 'LG', '55NANO75', 'webOS', '7.0.0', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '5 minutes', '{"hdr": true, "4k": true}'::jsonb, '{}'::jsonb, true),
(10, 6, 'TV-KOCH-04-B', 'TV-KOCH-04B', 'Smart TV Koch 4-B', 'LG', '55NANO75', 'webOS', '7.0.0', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '4 minutes', '{"hdr": true, "4k": true}'::jsonb, '{}'::jsonb, true),
(11, 7, 'TV-KOCH-05-A', 'TV-KOCH-05A', 'Smart TV Koch 5-A', 'LG', '55NANO75', 'webOS', '7.0.0', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '3 minutes', '{"hdr": true, "4k": true}'::jsonb, '{}'::jsonb, true),
(12, 7, 'TV-KOCH-05-B', 'TV-KOCH-05B', 'Smart TV Koch 5-B', 'LG', '55NANO75', 'webOS', '7.0.0', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '3 minutes', '{"hdr": true, "4k": true}'::jsonb, '{}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- =============================================
-- MEDIAS - Propagandas por tema/subscriber
-- Path: uploads/subscriber-{id}/medias/{arquivo} (copiados de player-web/propagandas e vinhetas)
-- =============================================
INSERT INTO medias (
  media_id, subscriber_id, name, description, file_path, file_name, file_size_bytes,
  media_type, mime_type, duration_seconds, width, height,
  thumbnail_url, preview_url,
  status, approval_status, tags,
  approved_by, approved_at, metadata,
  is_active
) VALUES
-- Subscriber 1 Cestto (Supermercados) - tema supermercado
(1, 1, 'Cestto_00005', 'Propaganda Cestto - imagem', '/opt/smart-signage/public/assets/uploads/subscriber-1/medias/Cestto_00005.png', 'Cestto_00005.png', 150000, 'image', 'image/png', NULL, 1920, 1080, '/api/media/1/thumbnail', '/api/media/1/thumbnail', 'approved', 'approved', ARRAY['cestto', 'supermercado'], 1, NOW() - INTERVAL '1 day', '{}'::jsonb, true),
(2, 1, 'Cestto_0001', 'Propaganda Cestto - vídeo', '/opt/smart-signage/public/assets/uploads/subscriber-1/medias/Cestto_0001.mp4', 'Cestto_0001.mp4', 500000, 'video', 'video/mp4', 30, 1920, 1080, '/api/media/2/thumbnail', '/api/media/2/thumbnail', 'approved', 'approved', ARRAY['cestto', 'supermercado'], 1, NOW() - INTERVAL '1 day', '{}'::jsonb, true),
-- Subscriber 2 Bourbon (Shoppings) - tema shopping
(3, 2, 'zaffari-bourbon', 'Propaganda Zaffari Bourbon', '/opt/smart-signage/public/assets/uploads/subscriber-2/medias/zaffari-bourbon_8255.jpg', 'zaffari-bourbon_8255.jpg', 120000, 'image', 'image/jpeg', NULL, 1920, 1080, '/api/media/3/thumbnail', '/api/media/3/thumbnail', 'approved', 'approved', ARRAY['bourbon', 'shopping'], 1, NOW() - INTERVAL '1 day', '{}'::jsonb, true),
-- Subscriber 3 Panvel (Farmácias) - tema farmácia
(4, 3, 'Panvel_0001', 'Propaganda Panvel', '/opt/smart-signage/public/assets/uploads/subscriber-3/medias/Panvel_0001.mp4', 'Panvel_0001.mp4', 450000, 'video', 'video/mp4', 20, 1920, 1080, '/api/media/4/thumbnail', '/api/media/4/thumbnail', 'approved', 'approved', ARRAY['panvel', 'farmacia'], 1, NOW() - INTERVAL '1 day', '{}'::jsonb, true),
(5, 3, 'Panvel_ABC', 'Propaganda Panvel ABC', '/opt/smart-signage/public/assets/uploads/subscriber-3/medias/Panvel_ABC-00010.jpg', 'Panvel_ABC-00010.jpg', 100000, 'image', 'image/jpeg', NULL, 1920, 1080, '/api/media/5/thumbnail', '/api/media/5/thumbnail', 'approved', 'approved', ARRAY['panvel', 'farmacia'], 1, NOW() - INTERVAL '1 day', '{}'::jsonb, true),
-- Subscriber 4 Fruteira Geraldo (Supermercados)
(6, 4, 'Fruteiradogeraldo0001', 'Propaganda Fruteira', '/opt/smart-signage/public/assets/uploads/subscriber-4/medias/Fruteiradogeraldo0001.jpg', 'Fruteiradogeraldo0001.jpg', 180000, 'image', 'image/jpeg', NULL, 1920, 1080, '/api/media/6/thumbnail', '/api/media/6/thumbnail', 'approved', 'approved', ARRAY['fruteira', 'supermercado'], 1, NOW() - INTERVAL '1 day', '{}'::jsonb, true),
(7, 4, 'Fruteiradogeraldo0002', 'Propaganda Fruteira vídeo', '/opt/smart-signage/public/assets/uploads/subscriber-4/medias/Fruteiradogeraldo0002.mp4', 'Fruteiradogeraldo0002.mp4', 520000, 'video', 'video/mp4', 25, 1920, 1080, '/api/media/7/thumbnail', '/api/media/7/thumbnail', 'approved', 'approved', ARRAY['fruteira', 'supermercado'], 1, NOW() - INTERVAL '1 day', '{}'::jsonb, true),
-- Subscriber 5 Fashion Store (Shoppings) - tema moda
(8, 5, 'Fashion_Woman', 'Propaganda Fashion', '/opt/smart-signage/public/assets/uploads/subscriber-5/medias/Fashion_Woman-0001.webp', 'Fashion_Woman-0001.webp', 80000, 'image', 'image/webp', NULL, 1920, 1080, '/api/media/8/thumbnail', '/api/media/8/thumbnail', 'approved', 'approved', ARRAY['fashion', 'moda', 'shopping'], 1, NOW() - INTERVAL '1 day', '{}'::jsonb, true),
(9, 5, 'moda_homem', 'Propaganda Moda Homem', '/opt/smart-signage/public/assets/uploads/subscriber-5/medias/moda_homem.webp', 'moda_homem.webp', 90000, 'image', 'image/webp', NULL, 1920, 1080, '/api/media/9/thumbnail', '/api/media/9/thumbnail', 'approved', 'approved', ARRAY['moda', 'shopping'], 1, NOW() - INTERVAL '1 day', '{}'::jsonb, true),
-- Subscriber 6 Beleza Produtos (Supermercados)
(10, 6, 'beleza-produtos', 'Propaganda Beleza', '/opt/smart-signage/public/assets/uploads/subscriber-6/medias/beleza-produtos-0001.mp4', 'beleza-produtos-0001.mp4', 380000, 'video', 'video/mp4', 15, 1920, 1080, '/api/media/10/thumbnail', '/api/media/10/thumbnail', 'approved', 'approved', ARRAY['beleza', 'supermercado'], 1, NOW() - INTERVAL '1 day', '{}'::jsonb, true),
-- Subscriber 7 Check-up Saúde (Farmácias)
(11, 7, 'check-up', 'Propaganda Check-up Saúde', '/opt/smart-signage/public/assets/uploads/subscriber-7/medias/check-up.jpg', 'check-up.jpg', 110000, 'image', 'image/jpeg', NULL, 1920, 1080, '/api/media/11/thumbnail', '/api/media/11/thumbnail', 'approved', 'approved', ARRAY['checkup', 'farmacia', 'saude'], 1, NOW() - INTERVAL '1 day', '{}'::jsonb, true),
-- Subscriber 8 Super Promo (Supermercados)
(12, 8, 'supermercado-promocoes', 'Promoções Supermercado', '/opt/smart-signage/public/assets/uploads/subscriber-8/medias/supermercado-promocoes.jpg', 'supermercado-promocoes.jpg', 140000, 'image', 'image/jpeg', NULL, 1920, 1080, '/api/media/12/thumbnail', '/api/media/12/thumbnail', 'approved', 'approved', ARRAY['supermercado', 'promo'], 1, NOW() - INTERVAL '1 day', '{}'::jsonb, true),
(13, 8, 'black-friday-banner', 'Black Friday', '/opt/smart-signage/public/assets/uploads/subscriber-8/medias/black-friday-banner.jpg', 'black-friday-banner.jpg', 95000, 'image', 'image/jpeg', NULL, 1920, 1080, '/api/media/13/thumbnail', '/api/media/13/thumbnail', 'approved', 'approved', ARRAY['blackfriday', 'supermercado'], 1, NOW() - INTERVAL '1 day', '{}'::jsonb, true),
-- Subscriber 9 Smartsignage Demo (Shoppings) - institucional
(14, 9, 'Smartsignage-interface-333', 'Smartsignage Demo', '/opt/smart-signage/public/assets/uploads/subscriber-9/medias/Smartsignage-interface-333.mp4', 'Smartsignage-interface-333.mp4', 600000, 'video', 'video/mp4', 30, 1920, 1080, '/api/media/14/thumbnail', '/api/media/14/thumbnail', 'approved', 'approved', ARRAY['smartsignage', 'shopping'], 1, NOW() - INTERVAL '1 day', '{}'::jsonb, true),
(15, 9, 'Resgate Totem', 'Resgate Totem', '/opt/smart-signage/public/assets/uploads/subscriber-9/medias/Resgate Totem-_001.mp4', 'Resgate Totem-_001.mp4', 250000, 'video', 'video/mp4', 10, 1920, 1080, '/api/media/15/thumbnail', '/api/media/15/thumbnail', 'approved', 'approved', ARRAY['smartsignage', 'shopping'], 1, NOW() - INTERVAL '1 day', '{}'::jsonb, true),
-- Subscriber 10 Menu Executivo (Shoppings) - alimentação
(16, 10, 'menu-executivo', 'Menu Executivo', '/opt/smart-signage/public/assets/uploads/subscriber-10/medias/menu-executivo.jpg', 'menu-executivo.jpg', 130000, 'image', 'image/jpeg', NULL, 1920, 1080, '/api/media/16/thumbnail', '/api/media/16/thumbnail', 'approved', 'approved', ARRAY['menu', 'alimentacao', 'shopping'], 1, NOW() - INTERVAL '1 day', '{}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- =============================================
-- SUBSCRIBER_CONTRACTS - Cada subscriber em plano diferente
-- Planos: 4=Shoppings, 5=Supermercados, 6=Farmácias
-- =============================================
-- contract_number: regra SUB-{subscriber_id}.{seq} (gerado no banco em criação atómica; na carga usamos formato alinhado)
INSERT INTO subscriber_contracts (
    contract_id, subscriber_id, plan_id, contract_number, contract_type, title, description,
    start_date, end_date, total_amount, currency, payment_terms, status,
    signed_by_subscriber_at, signed_by_tenant_at, created_by, metadata,
    document_path, document_filename, document_mime_type, document_size_bytes, is_active
) VALUES
(1, 1, 5, 'SUB-1.000001', 'advertising', 'Contrato Cestto', 'Contrato publicitário - Plano Supermercados', '2025-01-01', '2026-12-31', 25000.00, 'BRL', 'Mensal', 'active', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', 1, '{}'::jsonb, NULL, NULL, NULL, 0, true),
(2, 2, 4, 'SUB-2.000001', 'advertising', 'Contrato Bourbon', 'Contrato publicitário - Plano Shoppings', '2025-01-01', '2026-12-31', 30000.00, 'BRL', 'Mensal', 'active', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', 1, '{}'::jsonb, NULL, NULL, NULL, 0, true),
(3, 3, 6, 'SUB-3.000001', 'advertising', 'Contrato Panvel', 'Contrato publicitário - Plano Farmácias', '2025-01-01', '2026-12-31', 20000.00, 'BRL', 'Mensal', 'active', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', 1, '{}'::jsonb, NULL, NULL, NULL, 0, true),
(4, 4, 5, 'SUB-4.000001', 'advertising', 'Contrato Fruteira Geraldo', 'Contrato publicitário - Plano Supermercados', '2025-01-01', '2026-12-31', 22000.00, 'BRL', 'Mensal', 'active', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', 1, '{}'::jsonb, NULL, NULL, NULL, 0, true),
(5, 5, 4, 'SUB-5.000001', 'advertising', 'Contrato Fashion Store', 'Contrato publicitário - Plano Shoppings', '2025-01-01', '2026-12-31', 28000.00, 'BRL', 'Mensal', 'active', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', 1, '{}'::jsonb, NULL, NULL, NULL, 0, true),
(6, 6, 5, 'SUB-6.000001', 'advertising', 'Contrato Beleza Produtos', 'Contrato publicitário - Plano Supermercados', '2025-01-01', '2026-12-31', 18000.00, 'BRL', 'Mensal', 'active', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', 1, '{}'::jsonb, NULL, NULL, NULL, 0, true),
(7, 7, 6, 'SUB-7.000001', 'advertising', 'Contrato Check-up Saúde', 'Contrato publicitário - Plano Farmácias', '2025-01-01', '2026-12-31', 19000.00, 'BRL', 'Mensal', 'active', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', 1, '{}'::jsonb, NULL, NULL, NULL, 0, true),
(8, 8, 5, 'SUB-8.000001', 'advertising', 'Contrato Super Promo', 'Contrato publicitário - Plano Supermercados', '2025-01-01', '2026-12-31', 21000.00, 'BRL', 'Mensal', 'active', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', 1, '{}'::jsonb, NULL, NULL, NULL, 0, true),
(9, 9, 4, 'SUB-9.000001', 'advertising', 'Contrato Smartsignage Demo', 'Contrato publicitário - Plano Shoppings', '2025-01-01', '2026-12-31', 15000.00, 'BRL', 'Mensal', 'active', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', 1, '{}'::jsonb, NULL, NULL, NULL, 0, true),
(10, 10, 4, 'SUB-10.000001', 'advertising', 'Contrato Menu Executivo', 'Contrato publicitário - Plano Shoppings', '2025-01-01', '2026-12-31', 24000.00, 'BRL', 'Mensal', 'active', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', 1, '{}'::jsonb, NULL, NULL, NULL, 0, true)
ON CONFLICT DO NOTHING;

-- contract_number: regra PUB-{publisher_id}.{seq} (gerado no banco em criação atómica; na carga usamos formato alinhado)
INSERT INTO publisher_contracts (
    contract_id, publisher_id, contract_number, contract_type, title, description,
    start_date, end_date, revenue_share_percentage, revenue_share_rules, minimum_payout_amount,
    subscription_amount, subscription_interval, currency, payment_terms, status,
    signed_by_publisher_at, signed_by_tenant_at, created_by, metadata,
    document_path, document_filename, document_mime_type, document_size_bytes, is_active
) VALUES
(1, 1, 'PUB-1.000001', 'revenue_share', 'Contrato Zaffari', 'Revenue share Zaffari', '2025-01-01', NULL, 70.00, '{}'::jsonb, 500.00, NULL, NULL, 'BRL', 'Mensal', 'active', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days', 1, '{}'::jsonb, NULL, NULL, NULL, 0, true),
(2, 2, 'PUB-2.000001', 'revenue_share', 'Contrato Koch', 'Revenue share Grupo Koch', '2025-01-01', NULL, 65.00, '{}'::jsonb, 1000.00, NULL, NULL, 'BRL', 'Mensal', 'active', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days', 1, '{}'::jsonb, NULL, NULL, NULL, 0, true)
ON CONFLICT DO NOTHING;

-- =============================================
-- PLAYLISTS - Uma playlist por subscriber com suas mídias
-- =============================================
INSERT INTO playlists (playlist_id, subscriber_id, name, category_segment, description, is_active, schedule_config, metadata) VALUES
(1, 1, 'playlist_cestto', 'Supermercado', 'Playlist Cestto - propagandas supermercado', true, '{}'::jsonb, '{}'::jsonb),
(2, 2, 'playlist_bourbon', 'Shopping', 'Playlist Bourbon - propagandas shopping', true, '{}'::jsonb, '{}'::jsonb),
(3, 3, 'playlist_panvel', 'Farmácia', 'Playlist Panvel - propagandas farmácia', true, '{}'::jsonb, '{}'::jsonb),
(4, 4, 'playlist_fruteira', 'Supermercado', 'Playlist Fruteira Geraldo', true, '{}'::jsonb, '{}'::jsonb),
(5, 5, 'playlist_fashion', 'Shopping', 'Playlist Fashion Store - moda', true, '{}'::jsonb, '{}'::jsonb),
(6, 6, 'playlist_beleza', 'Supermercado', 'Playlist Beleza Produtos', true, '{}'::jsonb, '{}'::jsonb),
(7, 7, 'playlist_checkup', 'Farmácia', 'Playlist Check-up Saúde', true, '{}'::jsonb, '{}'::jsonb),
(8, 8, 'playlist_superpromo', 'Supermercado', 'Playlist Super Promo', true, '{}'::jsonb, '{}'::jsonb),
(9, 9, 'playlist_smartsignage', 'Shopping', 'Playlist Smartsignage Demo', true, '{}'::jsonb, '{}'::jsonb),
(10, 10, 'playlist_menu', 'Shopping', 'Playlist Menu Executivo', true, '{}'::jsonb, '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO playlist_items (item_id, playlist_id, media_id, display_seconds, order_index, start_time, end_time, days_of_week, transitions, is_active) VALUES
(1, 1, 1, 15, 0, NULL, NULL, NULL, '{}'::jsonb, true),
(2, 1, 2, 30, 1, NULL, NULL, NULL, '{}'::jsonb, true),
(3, 2, 3, 15, 0, NULL, NULL, NULL, '{}'::jsonb, true),
(4, 3, 4, 20, 0, NULL, NULL, NULL, '{}'::jsonb, true),
(5, 3, 5, 15, 1, NULL, NULL, NULL, '{}'::jsonb, true),
(6, 4, 6, 15, 0, NULL, NULL, NULL, '{}'::jsonb, true),
(7, 4, 7, 25, 1, NULL, NULL, NULL, '{}'::jsonb, true),
(8, 5, 8, 15, 0, NULL, NULL, NULL, '{}'::jsonb, true),
(9, 5, 9, 15, 1, NULL, NULL, NULL, '{}'::jsonb, true),
(10, 6, 10, 15, 0, NULL, NULL, NULL, '{}'::jsonb, true),
(11, 7, 11, 15, 0, NULL, NULL, NULL, '{}'::jsonb, true),
(12, 8, 12, 15, 0, NULL, NULL, NULL, '{}'::jsonb, true),
(13, 8, 13, 15, 1, NULL, NULL, NULL, '{}'::jsonb, true),
(14, 9, 14, 30, 0, NULL, NULL, NULL, '{}'::jsonb, true),
(15, 9, 15, 10, 1, NULL, NULL, NULL, '{}'::jsonb, true),
(16, 10, 16, 15, 0, NULL, NULL, NULL, '{}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- =============================================
-- CAMPANHAS - Uma por subscriber, vinculadas aos publishers conforme plano contratado
-- (plan_publisher_access: planos 4,5,6 têm acesso a publishers 1 e 2)
-- =============================================
INSERT INTO campaigns (campaign_id, subscriber_id, contract_id, title, category_segment, description, campaign_type, priority, commercial_tier, default_time_share_percent, max_consecutive_slots, start_date, end_date, start_time, end_time, days_of_week, timezone, status, is_active, target_audience, metadata) VALUES
(1, 1, 1, 'Cestto Ofertas', 'Supermercado', 'Campanha Cestto - propagandas supermercado', 'general', 10, 'premium', 50.00, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(2, 2, 2, 'Bourbon Shopping', 'Shopping', 'Campanha Bourbon - propagandas shopping', 'general', 10, 'premium', 50.00, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(3, 3, 3, 'Panvel Farmácia', 'Farmácia', 'Campanha Panvel - propagandas farmácia', 'general', 10, 'premium', 50.00, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(4, 4, 4, 'Fruteira Geraldo', 'Supermercado', 'Campanha Fruteira - propagandas supermercado', 'general', 10, 'standard', 40.00, 2, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(5, 5, 5, 'Fashion Store Moda', 'Shopping', 'Campanha Fashion - propagandas moda', 'general', 10, 'premium', 50.00, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(6, 6, 6, 'Beleza Produtos', 'Supermercado', 'Campanha Beleza - cosméticos', 'general', 8, 'standard', 40.00, 2, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(7, 7, 7, 'Check-up Saúde', 'Farmácia', 'Campanha Check-up - farmácia e saúde', 'general', 10, 'premium', 50.00, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(8, 8, 8, 'Super Promo Ofertas', 'Supermercado', 'Campanha Super Promo - promoções', 'general', 9, 'standard', 45.00, 2, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(9, 9, 9, 'Smartsignage Institucional', 'Shopping', 'Campanha Smartsignage - demo institucional', 'general', 8, 'standard', 40.00, 2, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb),
(10, 10, 10, 'Menu Executivo Alimentação', 'Shopping', 'Campanha Menu Executivo - alimentação', 'general', 10, 'premium', 50.00, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'America/Sao_Paulo', 'active', true, '{}'::jsonb, '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO campaign_playlists (campaign_id, playlist_id, priority, is_active, metadata) VALUES
(1, 1, 1, true, '{}'::jsonb),
(2, 2, 1, true, '{}'::jsonb),
(3, 3, 1, true, '{}'::jsonb),
(4, 4, 1, true, '{}'::jsonb),
(5, 5, 1, true, '{}'::jsonb),
(6, 6, 1, true, '{}'::jsonb),
(7, 7, 1, true, '{}'::jsonb),
(8, 8, 1, true, '{}'::jsonb),
(9, 9, 1, true, '{}'::jsonb),
(10, 10, 1, true, '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO campaign_medias (campaign_id, media_id, display_seconds, order_index, priority, start_time, end_time, days_of_week, transitions, is_active, metadata) VALUES
(1, 1, 15, 0, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(1, 2, 30, 1, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(2, 3, 15, 0, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(3, 4, 20, 0, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(3, 5, 15, 1, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(4, 6, 15, 0, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(4, 7, 25, 1, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(5, 8, 15, 0, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(5, 9, 15, 1, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(6, 10, 15, 0, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(7, 11, 15, 0, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(8, 12, 15, 0, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(8, 13, 15, 1, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(9, 14, 30, 0, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(9, 15, 10, 1, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb),
(10, 16, 15, 0, 10, NULL, NULL, NULL, '{}'::jsonb, true, '{}'::jsonb)
ON CONFLICT DO NOTHING;

-- =============================================
-- VÍNCULOS CONFORME PLANO CONTRATADO
-- Cada subscriber tem plano (4=Shoppings, 5=Supermercados, 6=Farmácias).
-- plan_publisher_access permite planos 4,5,6 acessarem publishers 1 (Zaffari) e 2 (Koch).
-- Abaixo: campaign_totems, campaign_publishers, campaign_locals e subscriber_publisher_access.
-- =============================================

-- campaign_totems: cada campanha nos totens dos publishers permitidos (1-2 Zaffari, 3-7 Koch)
INSERT INTO campaign_totems (campaign_id, totem_id, start_date, end_date, start_time, end_time, days_of_week, priority, is_active) VALUES
(1, 1, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(1, 2, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(1, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(1, 4, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(1, 5, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(1, 6, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(1, 7, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(2, 1, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(2, 2, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(2, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(2, 4, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(2, 5, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(2, 6, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(2, 7, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(3, 1, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(3, 2, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(3, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(3, 4, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(3, 5, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(3, 6, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(3, 7, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(4, 1, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(4, 2, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(4, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(4, 4, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(4, 5, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(4, 6, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(4, 7, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(5, 1, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(5, 2, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(5, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(5, 4, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(5, 5, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(5, 6, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(5, 7, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(6, 1, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 8, true),
(6, 2, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 8, true),
(6, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 8, true),
(6, 4, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 8, true),
(6, 5, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 8, true),
(6, 6, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 8, true),
(6, 7, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 8, true),
(7, 1, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(7, 2, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(7, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(7, 4, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(7, 5, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(7, 6, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(7, 7, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(8, 1, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 9, true),
(8, 2, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 9, true),
(8, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 9, true),
(8, 4, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 9, true),
(8, 5, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 9, true),
(8, 6, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 9, true),
(8, 7, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 9, true),
(9, 1, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 8, true),
(9, 2, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 8, true),
(9, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 8, true),
(9, 4, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 8, true),
(9, 5, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 8, true),
(9, 6, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 8, true),
(9, 7, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 8, true),
(10, 1, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(10, 2, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(10, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(10, 4, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(10, 5, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(10, 6, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(10, 7, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true)
ON CONFLICT DO NOTHING;

-- campaign_publishers: revenue share conforme contrato do publisher (Zaffari 70%, Koch 65%)
-- time_share conforme campanha (default_time_share_percent)
INSERT INTO campaign_publishers (campaign_id, publisher_id, revenue_share_percentage, time_share_percent, daypart_config, min_impressions_per_hour, max_impressions_per_hour, is_active, metadata) VALUES
(1, 1, 70.00, 50.00, '{}'::jsonb, 5, 15, true, '{}'::jsonb),
(1, 2, 65.00, 50.00, '{}'::jsonb, 5, 15, true, '{}'::jsonb),
(2, 1, 70.00, 50.00, '{}'::jsonb, 5, 15, true, '{}'::jsonb),
(2, 2, 65.00, 50.00, '{}'::jsonb, 5, 15, true, '{}'::jsonb),
(3, 1, 70.00, 50.00, '{}'::jsonb, 5, 15, true, '{}'::jsonb),
(3, 2, 65.00, 50.00, '{}'::jsonb, 5, 15, true, '{}'::jsonb),
(4, 1, 70.00, 40.00, '{}'::jsonb, 4, 12, true, '{}'::jsonb),
(4, 2, 65.00, 40.00, '{}'::jsonb, 4, 12, true, '{}'::jsonb),
(5, 1, 70.00, 50.00, '{}'::jsonb, 5, 15, true, '{}'::jsonb),
(5, 2, 65.00, 50.00, '{}'::jsonb, 5, 15, true, '{}'::jsonb),
(6, 1, 70.00, 40.00, '{}'::jsonb, 4, 12, true, '{}'::jsonb),
(6, 2, 65.00, 40.00, '{}'::jsonb, 4, 12, true, '{}'::jsonb),
(7, 1, 70.00, 50.00, '{}'::jsonb, 5, 15, true, '{}'::jsonb),
(7, 2, 65.00, 50.00, '{}'::jsonb, 5, 15, true, '{}'::jsonb),
(8, 1, 70.00, 45.00, '{}'::jsonb, 4, 14, true, '{}'::jsonb),
(8, 2, 65.00, 45.00, '{}'::jsonb, 4, 14, true, '{}'::jsonb),
(9, 1, 70.00, 40.00, '{}'::jsonb, 4, 12, true, '{}'::jsonb),
(9, 2, 65.00, 40.00, '{}'::jsonb, 4, 12, true, '{}'::jsonb),
(10, 1, 70.00, 50.00, '{}'::jsonb, 5, 15, true, '{}'::jsonb),
(10, 2, 65.00, 50.00, '{}'::jsonb, 5, 15, true, '{}'::jsonb)
ON CONFLICT DO NOTHING;

-- campaign_locals: cada campanha nos locais dos publishers (1-2 Zaffari, 3-7 Koch)
INSERT INTO campaign_locals (campaign_id, local_id, is_active) VALUES
(1, 1, true), (1, 2, true), (1, 3, true), (1, 4, true), (1, 5, true), (1, 6, true), (1, 7, true),
(2, 1, true), (2, 2, true), (2, 3, true), (2, 4, true), (2, 5, true), (2, 6, true), (2, 7, true),
(3, 1, true), (3, 2, true), (3, 3, true), (3, 4, true), (3, 5, true), (3, 6, true), (3, 7, true),
(4, 1, true), (4, 2, true), (4, 3, true), (4, 4, true), (4, 5, true), (4, 6, true), (4, 7, true),
(5, 1, true), (5, 2, true), (5, 3, true), (5, 4, true), (5, 5, true), (5, 6, true), (5, 7, true),
(6, 1, true), (6, 2, true), (6, 3, true), (6, 4, true), (6, 5, true), (6, 6, true), (6, 7, true),
(7, 1, true), (7, 2, true), (7, 3, true), (7, 4, true), (7, 5, true), (7, 6, true), (7, 7, true),
(8, 1, true), (8, 2, true), (8, 3, true), (8, 4, true), (8, 5, true), (8, 6, true), (8, 7, true),
(9, 1, true), (9, 2, true), (9, 3, true), (9, 4, true), (9, 5, true), (9, 6, true), (9, 7, true),
(10, 1, true), (10, 2, true), (10, 3, true), (10, 4, true), (10, 5, true), (10, 6, true), (10, 7, true)
ON CONFLICT DO NOTHING;

-- subscriber_publisher_access: cada subscriber com acesso aos publishers permitidos pelo plano (1 e 2)
-- contract_id e plan_id do contrato do subscriber; access_type 'contract'
INSERT INTO subscriber_publisher_access (access_id, subscriber_id, publisher_id, contract_id, plan_id, access_type, granted_at, expires_at, is_active, granted_by, notes, metadata) VALUES
(1, 1, 1, 1, 5, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Cestto em Zaffari (Plano Supermercados)', '{}'::jsonb),
(2, 1, 2, 1, 5, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Cestto em Koch (Plano Supermercados)', '{}'::jsonb),
(3, 2, 1, 2, 4, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Bourbon em Zaffari (Plano Shoppings)', '{}'::jsonb),
(4, 2, 2, 2, 4, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Bourbon em Koch (Plano Shoppings)', '{}'::jsonb),
(5, 3, 1, 3, 6, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Panvel em Zaffari (Plano Farmácias)', '{}'::jsonb),
(6, 3, 2, 3, 6, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Panvel em Koch (Plano Farmácias)', '{}'::jsonb),
(7, 4, 1, 4, 5, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Fruteira em Zaffari (Plano Supermercados)', '{}'::jsonb),
(8, 4, 2, 4, 5, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Fruteira em Koch (Plano Supermercados)', '{}'::jsonb),
(9, 5, 1, 5, 4, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Fashion em Zaffari (Plano Shoppings)', '{}'::jsonb),
(10, 5, 2, 5, 4, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Fashion em Koch (Plano Shoppings)', '{}'::jsonb),
(11, 6, 1, 6, 5, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Beleza em Zaffari (Plano Supermercados)', '{}'::jsonb),
(12, 6, 2, 6, 5, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Beleza em Koch (Plano Supermercados)', '{}'::jsonb),
(13, 7, 1, 7, 6, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Check-up em Zaffari (Plano Farmácias)', '{}'::jsonb),
(14, 7, 2, 7, 6, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Check-up em Koch (Plano Farmácias)', '{}'::jsonb),
(15, 8, 1, 8, 5, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Super Promo em Zaffari (Plano Supermercados)', '{}'::jsonb),
(16, 8, 2, 8, 5, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Super Promo em Koch (Plano Supermercados)', '{}'::jsonb),
(17, 9, 1, 9, 4, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Smartsignage em Zaffari (Plano Shoppings)', '{}'::jsonb),
(18, 9, 2, 9, 4, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Smartsignage em Koch (Plano Shoppings)', '{}'::jsonb),
(19, 10, 1, 10, 4, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Menu Executivo em Zaffari (Plano Shoppings)', '{}'::jsonb),
(20, 10, 2, 10, 4, 'contract', NOW() - INTERVAL '60 days', '2026-12-31 23:59:59', true, 1, 'Acesso Menu Executivo em Koch (Plano Shoppings)', '{}'::jsonb)
ON CONFLICT DO NOTHING;

-- =============================================
-- PLAN_PUBLISHER_ACCESS (planos 1-6 com acesso a publishers 1-2)
-- =============================================
INSERT INTO plan_publisher_access (plan_id, publisher_id, is_allowed, restrictions, notes, is_active) VALUES
(1, 1, true, '{}'::jsonb, NULL, true),
(1, 2, true, '{}'::jsonb, NULL, true),
(2, 1, true, '{}'::jsonb, NULL, true),
(2, 2, true, '{}'::jsonb, NULL, true),
(3, 1, true, '{}'::jsonb, NULL, true),
(3, 2, true, '{}'::jsonb, NULL, true),
(4, 1, true, '{}'::jsonb, NULL, true),
(4, 2, true, '{}'::jsonb, NULL, true),
(5, 1, true, '{}'::jsonb, NULL, true),
(5, 2, true, '{}'::jsonb, NULL, true),
(6, 1, true, '{}'::jsonb, NULL, true),
(6, 2, true, '{}'::jsonb, NULL, true)
ON CONFLICT DO NOTHING;

-- =============================================
-- DATA MIGRATION INTEGRADA: Atualizar caminhos de mídia
-- Original: database/data-migrations/016-update-media-paths-client-to-subscriber.sql
-- Objetivo: migrar paths contendo '/client-' para '/subscriber-'
-- Idempotente: usa UPDATE ... WHERE LIKE; pode ser executado repetidas vezes sem efeitos colaterais
-- =============================================
DO $$
DECLARE
    v_count_file_path INTEGER;
    v_count_thumbnail INTEGER;
    v_count_preview INTEGER;
BEGIN
    IF to_regclass('public.medias') IS NULL THEN
        RAISE NOTICE 'Tabela medias não existe — pulando migração de caminhos de mídia';
        RETURN;
    END IF;

    SELECT COUNT(*) INTO v_count_file_path
    FROM medias 
    WHERE file_path LIKE '%/client-%';
    
    SELECT COUNT(*) INTO v_count_thumbnail
    FROM medias 
    WHERE thumbnail_url LIKE '%/client-%';
    
    SELECT COUNT(*) INTO v_count_preview
    FROM medias 
    WHERE preview_url LIKE '%/client-%';
    
    RAISE NOTICE 'Registros a atualizar (media paths): file_path=% thumbnail_url=% preview_url=%', v_count_file_path, v_count_thumbnail, v_count_preview;
END $$;

-- Atualizar file_path
UPDATE medias 
SET file_path = REPLACE(file_path, '/client-', '/subscriber-') 
WHERE file_path LIKE '%/client-%';

-- Atualizar thumbnail_url
UPDATE medias 
SET thumbnail_url = REPLACE(thumbnail_url, '/client-', '/subscriber-') 
WHERE thumbnail_url LIKE '%/client-%';

-- Atualizar preview_url
UPDATE medias 
SET preview_url = REPLACE(preview_url, '/client-', '/subscriber-') 
WHERE preview_url LIKE '%/client-%';

DO $$
DECLARE
    v_remaining_file_path INTEGER;
    v_remaining_thumbnail INTEGER;
    v_remaining_preview INTEGER;
    v_total_subscriber INTEGER;
BEGIN
    IF to_regclass('public.medias') IS NULL THEN
        RETURN;
    END IF;

    SELECT COUNT(*) INTO v_remaining_file_path
    FROM medias 
    WHERE file_path LIKE '%/client-%';
    
    SELECT COUNT(*) INTO v_remaining_thumbnail
    FROM medias 
    WHERE thumbnail_url LIKE '%/client-%';
    
    SELECT COUNT(*) INTO v_remaining_preview
    FROM medias 
    WHERE preview_url LIKE '%/client-%';
    
    SELECT COUNT(*) INTO v_total_subscriber
    FROM medias 
    WHERE file_path LIKE '%/subscriber-%';
    
    RAISE NOTICE 'Resultado da migração (media paths): remaining_file_path=% remaining_thumbnail=% remaining_preview=% total_with_subscriber=%', v_remaining_file_path, v_remaining_thumbnail, v_remaining_preview, v_total_subscriber;
    
    IF v_remaining_file_path > 0 OR v_remaining_thumbnail > 0 OR v_remaining_preview > 0 THEN
        RAISE WARNING 'Alguns caminhos ainda contêm "client-". Verifique manualmente.';
    END IF;
END $$;
