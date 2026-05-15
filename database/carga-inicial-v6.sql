-- =============================================
-- CARGA INICIAL V6 - Seed enxuto (Totem Digital)
-- Data: 2026-03-07
-- Descrição: 1 publisher (totem digital), 3 locais (vários totens podem se distribuir por cidade/local), 1 totem (tot001), 1 plano, 1 assinante com contrato
-- =============================================

-- =============================================
-- LIMPEZA ANTES DA CARGA
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
-- 1 PUBLISHER: totem digital (cidade Encruzilhada)
-- Obrigatório antes de publisher_contracts (FK fk_publisher_contracts_publisher).
-- prepare_seed_with_owner_profile (install) substitui totemdigital.* / Totem Digital / Encruzilhada.
-- =============================================
INSERT INTO publishers (publisher_id, name, contact_name, email, phone, whatsapp, category_segment, description, is_subscriber, is_publisher, client_type, is_active) VALUES
(1, 'totem digital', 'Contato Totem Digital', 'contato@totemdigital.local', NULL, NULL, 'Totens', 'Publisher Totem Digital - Encruzilhada', false, true, 'publisher', true)
ON CONFLICT (publisher_id) DO NOTHING;

-- =============================================
-- 1 SUBSCRIBER (assinante com contrato no plano do publisher)
-- =============================================
--INSERT INTO subscribers (subscriber_id, name, contact_name, email, phone, whatsapp, address, category_segment, description, is_active) VALUES
--(1, 'Assinante Demo', 'Contato Demo', 'assinante@demo.local', NULL, NULL, 'Encruzilhada', 'Demo', 'Assinante de demonstração', true);

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
ON CONFLICT (name) DO NOTHING;

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

-- Plano atrelado ao publisher "totem digital"
--INSERT INTO plans (plan_id, name, slug, description, price_monthly, price_yearly, currency, billing_interval, features, limits, is_active, is_popular, is_default, sort_order) VALUES
--(1, 'Plano Totem Digital', 'plano-totem-digital', 'Plano para assinantes do publisher Totem Digital', 199.00, 1990.00, 'BRL', 'month', '{"campaigns":20,"storage_gb":50}'::jsonb, '{"totems":10,"campaigns":20,"storage_gb":50}'::jsonb, true, true, true, 1)
--ON CONFLICT (slug) DO NOTHING;

INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description) VALUES
('app.name', 'SmartSignage', 'string', 'system', 'Nome da aplicação'),
('app.version', '2.0.0', 'string', 'system', 'Versão'),
('dispatcher.cache_ttl_seconds', '300', 'number', 'dispatcher', 'TTL cache dispatcher'),
('dispatcher.cache_enabled', 'true', 'boolean', 'dispatcher', 'Cache dispatcher'),
('media.upload.max_size', '2GB', 'string', 'media', 'Tamanho máximo por arquivo de mídia (0 = sem limite no Multer; Express/Nginx usam teto 2G quando 0)'),
('media.upload.nginx_max_size', '2G', 'string', 'media', 'Limite Nginx (client_max_body_size)'),
('media.upload.express_limit', '2gb', 'string', 'media', 'Limite de body Express/Multer'),
('media.upload.proxy_timeout', '300', 'number', 'media', 'Timeout do proxy para upload (segundos)'),
('media.upload.allowed_types', 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,audio/mp3,audio/wav,audio/ogg', 'string', 'media', 'Tipos MIME permitidos (separados por vírgula)'),
('media.storage.path', '/opt/smart-signage/public/assets/uploads', 'string', 'media', 'Caminho base para armazenamento de mídias (uploads)'),
('media.storage.quota_per_client', '5GB', 'string', 'media', 'Cota global de referência (0 ou 0GB = ilimitado). Enforcement de armazenamento: limits.defaults.storage_gb + planos.'),
('media.storage.auto_cleanup', 'false', 'boolean', 'media', 'Limpeza automática de arquivos antigos'),
('media.storage.cleanup_days', '90', 'number', 'media', 'Dias de retenção para limpeza automática'),
('limits.defaults.storage_gb', '0', 'number', 'limits', 'GB padrão quando o plano não define storage_gb ou sem contrato; 0 = ilimitado'),
('limits.defaults.campaigns', '0', 'number', 'limits', 'Campanhas padrão; 0 = ilimitado'),
('limits.defaults.totems', '0', 'number', 'limits', 'Totens padrão; 0 = ilimitado'),
('limits.defaults.medias', '0', 'number', 'limits', 'Mídias padrão; 0 = ilimitado'),
('limits.defaults.playlists', '0', 'number', 'limits', 'Playlists padrão; 0 = ilimitado'),
('ui.combo.subscribers.status_filter', '[{"value":"active","label":"Ativos","activeOnly":true},{"value":"all","label":"Todos"}]', 'json', 'ui', 'Opções do combo Status na tela de Anunciantes')
ON CONFLICT (setting_key) DO NOTHING;

UPDATE system_settings
SET is_public = true,
    is_editable = true,
    default_value = '[{"value":"active","label":"Ativos","activeOnly":true},{"value":"all","label":"Todos"}]',
    updated_at = CURRENT_TIMESTAMP
WHERE setting_key = 'ui.combo.subscribers.status_filter';

-- Chave legada (JSON) substituída por media.upload.allowed_types (string) consumida pelo backend
DELETE FROM system_settings WHERE setting_key = 'media.allowed_types';

-- =============================================
-- USERS: admin + usuário publisher + usuário subscriber
-- OBS: username "totemdigital.admin" é placeholder dinâmico e será substituído no install
--      por SYSTEM_OWNER_ADMIN_USERNAME (scripts/install-smartsignage.sh).
-- =============================================
INSERT INTO users (username, email, password_hash, first_name, last_name, name, phone, role, user_type, is_tenant_user, publisher_id, subscriber_id, is_active, email_verified) VALUES
('totemdigital.admin', 'admin@smartsignage.local', '$2a$12$eenSYwwg9qOkcleFuH2lrOL5u3nAMN8MqQlsOQJh59mg16gcBu5A2', 'Admin', 'Sistema', 'Admin Sistema', NULL, 'admin', 'system_user', true, NULL, NULL, true, true)

ON CONFLICT (username) DO NOTHING;

INSERT INTO user_flags (user_id, flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4, flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9) VALUES
((SELECT id FROM users WHERE username = 'totemdigital.admin'), true, true, true, true, true, true, true, true, true, true)

ON CONFLICT (user_id) DO UPDATE SET
  flag_smart_0 = EXCLUDED.flag_smart_0, flag_smart_1 = EXCLUDED.flag_smart_1, flag_smart_2 = EXCLUDED.flag_smart_2,
  flag_smart_3 = EXCLUDED.flag_smart_3, flag_smart_4 = EXCLUDED.flag_smart_4, flag_smart_5 = EXCLUDED.flag_smart_5,
  flag_smart_6 = EXCLUDED.flag_smart_6, flag_smart_7 = EXCLUDED.flag_smart_7, flag_smart_8 = EXCLUDED.flag_smart_8, flag_smart_9 = EXCLUDED.flag_smart_9;

INSERT INTO role_flags_default (role, flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4, flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9) VALUES
('owner_system', true, true, true, true, true, true, true, true, true, true),
('admin', true, false, true, true, true, true, true, true, true, true),
('publisher_user', true, false, true, true, false, true, true, false, true, false),
('subscriber_user', false, false, false, false, false, false, true, false, false, true)
ON CONFLICT (role) DO NOTHING;

INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES
((SELECT id FROM users WHERE username = 'totemdigital.admin'), 1, (SELECT id FROM users WHERE username = 'totemdigital.admin'))
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10),
(2, 1), (2, 2), (2, 3), (2, 4), (2, 5), (2, 6), (2, 7), (2, 8), (2, 9), (2, 10),
(3, 1), (3, 2), (3, 3), (3, 4), (3, 5), (3, 6), (3, 7), (3, 8), (3, 9), (3, 10)

ON CONFLICT DO NOTHING;

-- =============================================
-- 3 LOCAIS do publisher owner (modo compacto: um publisher; vários locais como no Pro)
-- =============================================
--INSERT INTO locals (local_id, publisher_id, name, category_segment, address, city, state, zip_code, country, timezone, description, is_active) VALUES
--(1, 1, 'academia', 'Academia', NULL, 'encruzilhada', NULL, NULL, 'BR', 'America/Sao_Paulo', 'Local Academia - Encruzilhada', true)


-- =============================================
-- 1 TOTEM: identifier=tot001, UIN=tot001 (ex.: local academia)
-- =============================================
--INSERT INTO totems (totem_id, identifier, uin, device_id, local_id, name, description, status, last_heartbeat, heartbeat_interval, network_info, capabilities, is_active) VALUES
--(1, 'tot001', 'tot001', 'tot001', 1, 'Totem Digital 001', 'Totem principal - Academia Encruzilhada', 'online', NOW() - INTERVAL '2 minutes', 60, '{"ip": "192.168.1.10"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true);

-- =============================================
-- CONTRATO DO SUBSCRIBER (plano Plano Totem Digital)
-- =============================================
--INSERT INTO subscriber_contracts (
--    contract_id, subscriber_id, plan_id, contract_number, contract_type, title, description,
--    start_date, end_date, total_amount, currency, payment_terms, status,
--    signed_by_subscriber_at, signed_by_tenant_at, created_by, metadata, is_active
--) VALUES
--(1, 1, 1, 'SUB-1.000001', 'advertising', 'Contrato Assinante Demo', 'Contrato no Plano Totem Digital', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', 2388.00, 'BRL', 'Mensal', 'active', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', 1, '{}'::jsonb, true);

-- Contrato do publisher (opcional - rastreabilidade)
INSERT INTO publisher_contracts (
    contract_id, publisher_id, contract_number, contract_type, title, description,
    start_date, revenue_share_percentage, revenue_share_rules, minimum_payout_amount,
    currency, payment_terms, status, signed_by_publisher_at, signed_by_tenant_at, created_by, metadata, is_active
) VALUES
(1, 1, 'PUB-1.000001', 'revenue_share', 'Contrato ', 'Contrato publisher Totem Digital', CURRENT_DATE, 70.00, '{}'::jsonb, 200.00, 'BRL', 'Mensal', 'active', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', (SELECT id FROM users WHERE username = 'totemdigital.admin'), '{}'::jsonb, true)
ON CONFLICT (publisher_id, contract_number) DO NOTHING;

-- =============================================
-- PLAN_PUBLISHER_ACCESS / PLAN_LOCAL_ACCESS (modo compacto)
-- =============================================
--INSERT INTO plan_publisher_access (plan_id, publisher_id, is_allowed, restrictions, notes, is_active) VALUES
--(1, 1, true, '{}'::jsonb, 'Plano Totem Digital - acesso aos totens do publisher totem digital', true);
-- plan_local_access: em instalações com demo dinâmica, o install-smartsignage.sh preenche
-- plan_local_access para cada local demo + Estoque e para os planos bronze/silver/gold (ver bloco PL/pgSQL do seed).

-- =============================================
-- SUBSCRIBER_PUBLISHER_ACCESS: assinante 1 com acesso ao publisher 1 via contrato/plano
-- =============================================
--INSERT INTO subscriber_publisher_access (access_id, subscriber_id, publisher_id, contract_id, plan_id, access_type, granted_at, expires_at, is_active, granted_by, notes, metadata) VALUES
--(1, 1, 1, 1, 1, 'contract', NOW() - INTERVAL '7 days', CURRENT_DATE + INTERVAL '1 year', true, 1, 'Acesso Assinante Demo ao publisher Totem Digital (Plano Totem Digital)', '{}'::jsonb);

-- =============================================
-- Migração de paths de mídia (idempotente; sem mídias nesta carga)
-- =============================================
UPDATE medias SET file_path = REPLACE(file_path, '/client-', '/subscriber-') WHERE file_path LIKE '%/client-%';
UPDATE medias SET thumbnail_url = REPLACE(thumbnail_url, '/client-', '/subscriber-') WHERE thumbnail_url LIKE '%/client-%';
UPDATE medias SET preview_url = REPLACE(preview_url, '/client-', '/subscriber-') WHERE preview_url LIKE '%/client-%';
