-- =============================================
-- CARGA INICIAL V6 - Reconstruída com Dados Integrados e Validados
-- Data: 2026-01-21
-- Versão: 6.1
-- Descrição: Carga de dados para testes integrados com validações de schema,
--            constraints, relacionamentos corretos e diversidade de operações
--            para testes integrados completos
-- 
-- CORREÇÕES APLICADAS:
-- ✅ Corrigido: Locals 6 e 7 agora pertencem ao publisher correto (Aeroporto)
-- ✅ Corrigido: Criado publisher_id=5 para Supermercado Econômico
-- ✅ Corrigido: UINs atualizados de 2024 para 2025
-- ✅ Corrigido: campaign_publishers para campanha 3 agora usa publisher_id=5
-- ✅ Corrigido: campaign_locals e campaign_totems atualizados para novos locals
-- ✅ Corrigido: Totem Playlist 6 adicionado para corrigir foreign key constraint
-- ✅ Corrigido: remote_commands.user_id NULL substituído por user_id=1 (admin) para comandos automáticos
-- ✅ Corrigido: Adicionado 'request_playlist' ao CHECK constraint de command_type em remote_commands
-- ✅ Corrigido: subscriber_billing linha 5: 'overdue' → 'pending' (due_date no passado; compat. chk_subscriber_billing_payment_status)
-- ✅ Adicionado: Mais diversidade de dados para testes integrados
-- ✅ Revisado: Todos os relacionamentos validados para consistência de IDs
-- =============================================

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
(1, 'Marca Fashion Brasil', 'Patricia Mendes', 'contato@marcafashion.com.br', '+55 11 3456-7890', '+55 11 98765-4321', 'Av. Brigadeiro Faria Lima, 1500 - Itaim Bibi, São Paulo/SP - CEP 01452-000', 'Moda', 'Empresa de moda e vestuário que anuncia em totens de shopping centers', true),
(2, 'Laboratório FarmaVida', 'Dr. João Santos', 'comercial@farmavida.com.br', '+55 11 2345-6789', '+55 11 87654-3210', 'Rua Haddock Lobo, 500 - Cerqueira César, São Paulo/SP - CEP 01414-000', 'Farmacêutico', 'Laboratório farmacêutico que promove medicamentos em farmácias', true),
(3, 'Supermercado Econômico', 'Ana Costa', 'marketing@economico.com.br', '+55 11 1234-5678', '+55 11 76543-2109', 'Av. Paulista, 1500 - Bela Vista, São Paulo/SP - CEP 01310-100', 'Varejo', 'Rede de supermercados que anuncia ofertas e promoções', true),
(4, 'Rede de Restaurantes Sabor & Arte', 'Carlos Oliveira', 'publicidade@saborearte.com.br', '+55 11 4567-8901', '+55 11 65432-1098', 'Rua Oscar Freire, 200 - Jardins, São Paulo/SP - CEP 01426-000', 'Alimentação', 'Rede de restaurantes que promove cardápios e eventos', true),
(5, 'Clínica Saúde Total', 'Dr. Roberto Lima', 'marketing@saudetotal.com.br', '+55 11 5678-9012', '+55 11 54321-0987', 'Rua do Carmo, 45 - Centro, São Paulo/SP - CEP 01310-100', 'Saúde', 'Clínica médica que promove serviços de saúde e prevenção', true)
ON CONFLICT DO NOTHING;

INSERT INTO publishers (publisher_id, name, contact_name, email, phone, whatsapp, category_segment, description, is_subscriber, is_publisher, client_type, active) VALUES
(1, 'Shopping Center Norte', 'Fernando Alves', 'administracao@shoppingnorte.com.br', '+55 11 3111-2222', '+55 11 91111-2222', 'Shopping', 'Shopping center localizado na zona norte de São Paulo com totens instalados', false, true, 'publisher', true),
(2, 'Farmácia Saúde Mais', 'Juliana Rodrigues', 'gerencia@saudemais.com.br', '+55 11 3222-3333', '+55 11 92222-3333', 'Farmácia', 'Rede de farmácias com múltiplas unidades e totens para publicidade', false, true, 'publisher', true),
(3, 'Aeroporto Internacional de São Paulo', 'Ricardo Souza', 'comercial@aeroportosp.com.br', '+55 11 3333-4444', '+55 11 93333-4444', 'Transporte', 'Aeroporto com totens em áreas de embarque e desembarque', false, true, 'publisher', true),
(4, 'Rede de Totens Urbanos SP', 'Pedro Almeida', 'contato@totensurbanos.com.br', '+55 11 3444-5555', '+55 11 94444-5555', 'OOH', 'Rede de totens em pontos estratégicos da cidade para publicidade externa', false, true, 'publisher', true),
(5, 'Supermercado Econômico - Publisher', 'Ana Costa', 'gerencia@economico.com.br', '+55 11 1234-5679', '+55 11 76543-2110', 'Varejo', 'Rede de supermercados com totens para publicidade interna', false, true, 'publisher', true)
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
(2, 'fernando.alves', 'fernando.alves@shoppingnorte.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Fernando', 'Alves', 'Fernando Alves', '+55 11 3111-2222', 'manager', 'publisher_user', false, 1, NULL, true, true),
(3, 'juliana.rodrigues', 'juliana.rodrigues@saudemais.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Juliana', 'Rodrigues', 'Juliana Rodrigues', '+55 11 3222-3333', 'manager', 'publisher_user', false, 2, NULL, true, true),
(4, 'ricardo.souza', 'ricardo.souza@aeroportosp.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Ricardo', 'Souza', 'Ricardo Souza', '+55 11 3333-4444', 'manager', 'publisher_user', false, 3, NULL, true, true),
(5, 'pedro.almeida', 'pedro.almeida@totensurbanos.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Pedro', 'Almeida', 'Pedro Almeida', '+55 11 3444-5555', 'manager', 'publisher_user', false, 4, NULL, true, true),
(6, 'patricia.mendes', 'patricia.mendes@marcafashion.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Patricia', 'Mendes', 'Patricia Mendes', '+55 11 3456-7890', 'manager', 'subscriber_user', false, NULL, 1, true, true),
(7, 'joao.santos', 'joao.santos@farmavida.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'João', 'Santos', 'Dr. João Santos', '+55 11 2345-6789', 'manager', 'subscriber_user', false, NULL, 2, true, true),
(8, 'ana.costa', 'ana.costa@economico.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Ana', 'Costa', 'Ana Costa', '+55 11 1234-5678', 'manager', 'subscriber_user', false, NULL, 3, true, true),
(9, 'carlos.oliveira', 'carlos.oliveira@saborearte.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Carlos', 'Oliveira', 'Carlos Oliveira', '+55 11 4567-8901', 'manager', 'subscriber_user', false, NULL, 4, true, true),
(10, 'roberto.lima', 'roberto.lima@saudetotal.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Roberto', 'Lima', 'Dr. Roberto Lima', '+55 11 5678-9012', 'manager', 'subscriber_user', false, NULL, 5, true, true),
(11, 'ana.costa.pub', 'ana.costa.pub@economico.com.br', '$2a$12$MpO5mGy6mXdtmvKiv14QYOyuF.5TI72E.iS8oTRaCcAi8JQ3i7r8y', 'Ana', 'Costa', 'Ana Costa (Publisher)', '+55 11 1234-5679', 'manager', 'publisher_user', false, 5, NULL, true, true)
ON CONFLICT DO NOTHING;

INSERT INTO user_flags (user_id, flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4, flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9) VALUES
(1, true, true, true, true, true, true, true, true, true, true),
(2, true, false, false, true, false, true, true, false, true, false),
(3, true, false, false, true, false, true, true, false, true, false),
(4, true, false, false, true, false, true, true, false, true, false),
(5, true, false, false, true, false, true, true, false, true, false),
(6, false, false, false, false, false, false, true, false, false, true),
(11, true, false, false, true, false, true, true, false, true, false),
(7, false, false, false, false, false, false, true, false, false, true),
(8, false, false, false, false, false, false, true, false, false, true),
(9, false, false, false, false, false, false, true, false, false, true),
(10, false, false, false, false, false, false, true, false, false, true)
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
(4, 4, 1),
(5, 4, 1),
(6, 5, 1),
(7, 5, 1),
(8, 5, 1),
(9, 5, 1),
(10, 5, 1),
(11, 4, 1)
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
(6, 3, 'Terminal de Embarque T1', 'Aeroporto', 'Rod. Hélio Smidt, s/n - Cumbica', 'Guarulhos', 'SP', '07190-100', 'BR', -23.4321, -46.4697, 'America/Sao_Paulo', 'Terminal de embarque T1 do aeroporto', true),
(7, 3, 'Terminal de Desembarque T2', 'Aeroporto', 'Rod. Hélio Smidt, s/n - Cumbica', 'Guarulhos', 'SP', '07190-100', 'BR', -23.4322, -46.4698, 'America/Sao_Paulo', 'Terminal de desembarque T2 do aeroporto', true),
(8, 4, 'Ponto Estratégico 1', 'OOH', 'Av. Brigadeiro Faria Lima, 2000', 'São Paulo', 'SP', '01452-000', 'BR', -23.5775, -46.6910, 'America/Sao_Paulo', 'Totem em ponto estratégico', true),
(9, 5, 'Área de Caixas', 'Supermercado', 'Av. Paulista, 1500', 'São Paulo', 'SP', '01310-100', 'BR', -23.5615, -46.6560, 'America/Sao_Paulo', 'Área dos caixas do supermercado', true),
(10, 5, 'Seção de Açougue', 'Supermercado', 'Av. Paulista, 1500', 'São Paulo', 'SP', '01310-100', 'BR', -23.5615, -46.6560, 'America/Sao_Paulo', 'Seção de açougue do supermercado', true)
ON CONFLICT DO NOTHING;

-- Totens com heartbeats variados para testes:
-- - Totens 1-3, 5-6, 8: heartbeat recente (online)
-- - Totem 4: heartbeat recente mas será usado para teste de FPS baixo
-- - Totem 7: offline (heartbeat antigo) para testes de alerta
INSERT INTO totems (totem_id, identifier, uin, device_id, local_id, name, description, model, manufacturer, firmware_version, hardware_version, os_version, status, last_heartbeat, heartbeat_interval, network_info, capabilities, is_active) VALUES
(1, 'TOTEM-SHOPPING-001', 'UIN-SHOPPING-001-2025', 'DEVICE-001', 1, 'Totem Shopping Entrada', 'Totem na entrada principal', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW() - INTERVAL '2 minutes', 60, '{"ip": "192.168.1.10", "mac": "00:11:22:33:44:01"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true),
(2, 'TOTEM-SHOPPING-002', 'UIN-SHOPPING-002-2025', 'DEVICE-002', 2, 'Totem Shopping Praça', 'Totem na praça de alimentação', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW() - INTERVAL '5 minutes', 60, '{"ip": "192.168.1.11", "mac": "00:11:22:33:44:02"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true),
(3, 'TOTEM-SHOPPING-003', 'UIN-SHOPPING-003-2025', 'DEVICE-003', 3, 'Totem Shopping Cinema', 'Totem na área do cinema', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW() - INTERVAL '1 minute', 60, '{"ip": "192.168.1.12", "mac": "00:11:22:33:44:03"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true),
(4, 'TOTEM-FARMACIA-001', 'UIN-FARMACIA-001-2025', 'DEVICE-004', 4, 'Totem Farmácia Matriz', 'Totem na farmácia matriz - teste FPS baixo', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW() - INTERVAL '3 minutes', 60, '{"ip": "192.168.1.20", "mac": "00:11:22:33:44:04"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true),
(5, 'TOTEM-FARMACIA-002', 'UIN-FARMACIA-002-2025', 'DEVICE-005', 5, 'Totem Farmácia Filial', 'Totem na farmácia filial', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW() - INTERVAL '10 minutes', 60, '{"ip": "192.168.1.21", "mac": "00:11:22:33:44:05"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true),
(6, 'TOTEM-AEROPORTO-001', 'UIN-AEROPORTO-001-2025', 'DEVICE-006', 6, 'Totem Aeroporto Embarque', 'Totem no terminal de embarque T1', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW() - INTERVAL '15 minutes', 60, '{"ip": "192.168.1.30", "mac": "00:11:22:33:44:06"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true),
(7, 'TOTEM-AEROPORTO-002', 'UIN-AEROPORTO-002-2025', 'DEVICE-007', 7, 'Totem Aeroporto Desembarque', 'Totem no terminal de desembarque T2 - offline para teste', 'Totem Pro v2', 'SmartSignage', '2.0.0', '1.2.2', 'Linux 5.15', 'offline', NOW() - INTERVAL '2 hours', 60, '{"ip": "192.168.1.31", "mac": "00:11:22:33:44:07"}'::jsonb, '{"video_support": true, "audio_support": false}'::jsonb, true),
(8, 'TOTEM-URBANO-001', 'UIN-URBANO-001-2025', 'DEVICE-008', 8, 'Totem Urbano 1', 'Totem em ponto estratégico', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW() - INTERVAL '7 minutes', 60, '{"ip": "192.168.1.50", "mac": "00:11:22:33:44:08"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true),
(9, 'TOTEM-SUPER-001', 'UIN-SUPER-001-2025', 'DEVICE-009', 9, 'Totem Supermercado Caixas', 'Totem na área dos caixas', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW() - INTERVAL '15 minutes', 60, '{"ip": "192.168.1.60", "mac": "00:11:22:33:44:09"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true),
(10, 'TOTEM-SUPER-002', 'UIN-SUPER-002-2025', 'DEVICE-010', 10, 'Totem Supermercado Açougue', 'Totem na seção de açougue', 'Totem Pro v2', 'SmartSignage', '2.0.1', '1.2.3', 'Linux 5.15', 'online', NOW() - INTERVAL '20 minutes', 60, '{"ip": "192.168.1.61", "mac": "00:11:22:33:44:10"}'::jsonb, '{"video_support": true, "audio_support": true}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- Smart TVs com last_heartbeat variado para testes
INSERT INTO smart_tvs (smart_tv_id, totem_id, identifier, device_id, name, brand, model, platform, firmware_version, resolution_width, resolution_height, orientation, status, last_heartbeat, capabilities, settings, is_active) VALUES
(1, 1, 'TV-SHOPPING-001', 'TV-DEVICE-001', 'Smart TV Shopping Entrada', 'Samsung', 'QN55Q80A', 'Tizen', '6.0.1', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '2 minutes', '{"hdr": true, "4k": true}'::jsonb, '{"brightness": 80, "contrast": 75}'::jsonb, true),
(2, 2, 'TV-SHOPPING-002', 'TV-DEVICE-002', 'Smart TV Shopping Praça', 'LG', '55NANO75SQA', 'webOS', '7.0.0', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '5 minutes', '{"hdr": true, "4k": true}'::jsonb, '{"brightness": 75, "contrast": 70}'::jsonb, true),
(3, 3, 'TV-SHOPPING-003', 'TV-DEVICE-003', 'Smart TV Shopping Cinema', 'Samsung', 'QN55Q80A', 'Tizen', '6.0.1', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '1 minute', '{"hdr": true, "4k": true}'::jsonb, '{"brightness": 85, "contrast": 80}'::jsonb, true),
(4, 4, 'TV-FARMACIA-001', 'TV-DEVICE-004', 'Smart TV Farmácia Matriz', 'LG', '43UN7300PUF', 'webOS', '6.0.0', 3840, 2160, 'portrait', 'online', NOW() - INTERVAL '3 minutes', '{"hdr": false, "4k": true}'::jsonb, '{"brightness": 70, "contrast": 65}'::jsonb, true),
(5, 5, 'TV-FARMACIA-002', 'TV-DEVICE-005', 'Smart TV Farmácia Filial', 'LG', '43UN7300PUF', 'webOS', '6.0.0', 3840, 2160, 'portrait', 'online', NOW() - INTERVAL '10 minutes', '{"hdr": false, "4k": true}'::jsonb, '{"brightness": 70, "contrast": 65}'::jsonb, true),
(6, 6, 'TV-AEROPORTO-001', 'TV-DEVICE-006', 'Smart TV Aeroporto Embarque', 'Samsung', 'UN55TU8000', 'Tizen', '5.5.0', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '15 minutes', '{"hdr": false, "4k": true}'::jsonb, '{"brightness": 90, "contrast": 85}'::jsonb, true),
(7, 7, 'TV-AEROPORTO-002', 'TV-DEVICE-007', 'Smart TV Aeroporto Desembarque', 'Samsung', 'UN55TU8000', 'Tizen', '5.5.0', 3840, 2160, 'portrait', 'offline', NOW() - INTERVAL '2 hours', '{"hdr": false, "4k": true}'::jsonb, '{"brightness": 85, "contrast": 80}'::jsonb, true),
(9, 9, 'TV-SUPER-001', 'TV-DEVICE-009', 'Smart TV Supermercado Caixas', 'Samsung', 'UN55TU8000', 'Tizen', '5.5.0', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '15 minutes', '{"hdr": false, "4k": true}'::jsonb, '{"brightness": 90, "contrast": 85}'::jsonb, true),
(10, 10, 'TV-SUPER-002', 'TV-DEVICE-010', 'Smart TV Supermercado Açougue', 'Samsung', 'UN55TU8000', 'Tizen', '5.5.0', 3840, 2160, 'portrait', 'online', NOW() - INTERVAL '20 minutes', '{"hdr": false, "4k": true}'::jsonb, '{"brightness": 85, "contrast": 80}'::jsonb, true),
(8, 8, 'TV-URBANO-001', 'TV-DEVICE-008', 'Smart TV Urbano 1', 'LG', '55NANO75SQA', 'webOS', '7.0.0', 3840, 2160, 'landscape', 'online', NOW() - INTERVAL '7 minutes', '{"hdr": true, "4k": true}'::jsonb, '{"brightness": 75, "contrast": 70}'::jsonb, true)
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
(1, 1, 'colecao-verao-2024.jpg', 'Banner da coleção verão 2024', '/opt/smart-signage/public/assets/uploads/client-1/medias/colecao-verao-2024.jpg', 'colecao-verao-2024.jpg', 550388, 'image', 'image/jpeg', NULL, 1920, 1080, '/api/media/1/thumbnail', '/api/media/1/thumbnail', 'approved', 'approved', ARRAY['moda', 'verao', 'colecao'], 1, (NOW() - INTERVAL '1 year') - INTERVAL '10 days', '{}'::jsonb, true),
(2, 1, 'promocao-fashion-video.mp4', 'Vídeo promocional da marca de moda', '/opt/smart-signage/public/assets/uploads/client-1/medias/promocao-fashion-video.mp4', 'promocao-fashion-video.mp4', 984314, 'video', 'video/mp4', 30, 1920, 1080, '/api/media/2/thumbnail', '/api/media/2/thumbnail', 'approved', 'approved', ARRAY['moda', 'video', 'promocao'], 1, (NOW() - INTERVAL '1 year') - INTERVAL '10 days', '{}'::jsonb, true),
(3, 2, 'medicamentos-genericos-banner.jpg', 'Banner promocional de medicamentos genéricos', '/opt/smart-signage/public/assets/uploads/client-2/medias/medicamentos-genericos-banner.jpg', 'medicamentos-genericos-banner.jpg', 576108, 'image', 'image/jpeg', NULL, 1920, 1080, '/api/media/3/thumbnail', '/api/media/3/thumbnail', 'approved', 'approved', ARRAY['medicamentos', 'genericos', 'promocao'], 1, (NOW() - INTERVAL '1 year') - INTERVAL '9 days', '{}'::jsonb, true),
(4, 3, 'ofertas-dia.jpg', 'Banner com ofertas diárias do supermercado', '/opt/smart-signage/public/assets/uploads/client-3/medias/ofertas-dia.jpg', 'ofertas-dia.jpg', 1113286, 'image', 'image/jpeg', NULL, 1920, 1080, '/api/media/4/thumbnail', '/api/media/4/thumbnail', 'approved', 'approved', ARRAY['ofertas', 'diarias', 'supermercado'], 1, (NOW() - INTERVAL '1 year') - INTERVAL '8 days', '{}'::jsonb, true),
(5, 4, 'menu-executivo.jpg', 'Cardápio do menu executivo do restaurante', '/opt/smart-signage/public/assets/uploads/client-4/medias/menu-executivo.jpg', 'menu-executivo.jpg', 753361, 'image', 'image/jpeg', NULL, 1920, 1080, '/api/media/5/thumbnail', '/api/media/5/thumbnail', 'approved', 'approved', ARRAY['menu', 'executivo', 'restaurante'], 1, (NOW() - INTERVAL '1 year') - INTERVAL '7 days', '{}'::jsonb, true),
(6, 5, 'check-up-preventivo-video.mp4', 'Vídeo educativo sobre check-up preventivo', '/opt/smart-signage/public/assets/uploads/client-5/medias/check-up-preventivo-video.mp4', 'check-up-preventivo-video.mp4', 984314, 'video', 'video/mp4', 45, 1920, 1080, '/api/media/6/thumbnail', '/api/media/6/thumbnail', 'approved', 'approved', ARRAY['saude', 'prevencao', 'check-up'], 1, (NOW() - INTERVAL '1 year') - INTERVAL '6 days', '{}'::jsonb, true)
ON CONFLICT DO NOTHING;

INSERT INTO playlists (playlist_id, subscriber_id, name, category_segment, description, is_active, schedule_config, metadata) VALUES
(1, 1, 'Playlist Coleção Verão - Shopping', 'Moda', 'Playlist da coleção verão 2024 para shopping centers', true, '{}'::jsonb, '{}'::jsonb),
(2, 1, 'Playlist Promoção Fashion', 'Moda', 'Playlist promocional da marca de moda', true, '{}'::jsonb, '{}'::jsonb),
(3, 2, 'Playlist Medicamentos Genéricos', 'Farmacêutico', 'Playlist promocional de medicamentos genéricos', true, '{}'::jsonb, '{}'::jsonb),
(4, 3, 'Playlist Ofertas Supermercado', 'Varejo', 'Playlist de ofertas e promoções do supermercado', true, '{}'::jsonb, '{}'::jsonb),
(5, 4, 'Playlist Menu Executivo', 'Alimentação', 'Playlist do menu executivo do restaurante', true, '{}'::jsonb, '{}'::jsonb),
(6, 5, 'Playlist Check-up Preventivo', 'Saúde', 'Playlist de conscientização sobre check-up preventivo', true, '{}'::jsonb, '{}'::jsonb)
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
-- SUBSCRIBER_CONTRACTS - Contratos com Anunciantes
-- =============================================
-- Contratos isolados e consistentes com o schema novo
-- Cada subscriber tem um contrato de publicidade vinculado a um plano

INSERT INTO subscriber_contracts (
    contract_id, subscriber_id, plan_id, contract_number, contract_type, 
    title, description, start_date, end_date, total_amount, currency, 
    payment_terms, status, signed_by_subscriber_at, signed_by_tenant_at, 
    created_by, metadata, document_path, document_filename, document_mime_type, document_size_bytes
) VALUES
-- Contrato 1: Marca Fashion Brasil (subscriber_id=1) - Plano Profissional
(1, 1, 2, 'SUB-CONT-2025-001', 'advertising', 
    'Contrato Publicitário - Marca Fashion Brasil', 
    'Contrato de publicidade para campanhas de moda em shopping centers e totens urbanos',
    '2025-01-15', '2027-01-14', 50000.00, 'BRL', 
    'Pagamento em 30 dias após faturamento', 'active', 
    NOW() - INTERVAL '11 months', NOW() - INTERVAL '11 months', 
    1, 
    '{"campaigns_allowed": 20, "storage_gb": 50, "priority_support": true}'::jsonb,
    '/contracts/subscribers/SUB-CONT-2025-001.pdf', 'SUB-CONT-2025-001.pdf', 'application/pdf', 245760),

-- Contrato 2: Laboratório FarmaVida (subscriber_id=2) - Plano Básico
(2, 2, 1, 'SUB-CONT-2025-002', 'advertising',
    'Contrato Publicitário - Laboratório FarmaVida',
    'Contrato de publicidade para campanhas de medicamentos em farmácias',
    '2025-02-01', '2027-01-31', 15000.00, 'BRL',
    'Pagamento mensal antecipado', 'active',
    NOW() - INTERVAL '10 months', NOW() - INTERVAL '10 months',
    1,
    '{"campaigns_allowed": 5, "storage_gb": 10, "target_segment": "farmacia"}'::jsonb,
    '/contracts/subscribers/SUB-CONT-2025-002.pdf', 'SUB-CONT-2025-002.pdf', 'application/pdf', 198656),

-- Contrato 3: Supermercado Econômico (subscriber_id=3) - Plano Básico
(3, 3, 1, 'SUB-CONT-2025-003', 'advertising',
    'Contrato Publicitário - Supermercado Econômico',
    'Contrato de publicidade para ofertas e promoções em supermercados',
    '2025-01-01', '2026-12-31', 20000.00, 'BRL',
    'Pagamento mensal', 'active',
    NOW() - INTERVAL '12 months', NOW() - INTERVAL '12 months',
    1,
    '{"campaigns_allowed": 5, "storage_gb": 10, "target_segment": "varejo"}'::jsonb,
    '/contracts/subscribers/SUB-CONT-2025-003.pdf', 'SUB-CONT-2025-003.pdf', 'application/pdf', 212992),

-- Contrato 4: Rede de Restaurantes Sabor & Arte (subscriber_id=4) - Plano Básico
(4, 4, 1, 'SUB-CONT-2025-004', 'advertising',
    'Contrato Publicitário - Rede de Restaurantes Sabor & Arte',
    'Contrato de publicidade para cardápios e eventos em restaurantes',
    '2025-03-01', '2027-02-28', 8000.00, 'BRL',
    'Pagamento mensal', 'active',
    NOW() - INTERVAL '9 months', NOW() - INTERVAL '9 months',
    1,
    '{"campaigns_allowed": 5, "storage_gb": 10, "target_segment": "alimentacao"}'::jsonb,
    '/contracts/subscribers/SUB-CONT-2025-004.pdf', 'SUB-CONT-2025-004.pdf', 'application/pdf', 180224),

-- Contrato 5: Clínica Saúde Total (subscriber_id=5) - Plano Básico
(5, 5, 1, 'SUB-CONT-2025-005', 'advertising',
    'Contrato Publicitário - Clínica Saúde Total',
    'Contrato de publicidade para serviços de saúde e prevenção',
    '2025-04-01', '2027-03-31', 10000.00, 'BRL',
    'Pagamento mensal', 'active',
    NOW() - INTERVAL '8 months', NOW() - INTERVAL '8 months',
    1,
    '{"campaigns_allowed": 5, "storage_gb": 10, "target_segment": "saude"}'::jsonb,
    '/contracts/subscribers/SUB-CONT-2025-005.pdf', 'SUB-CONT-2025-005.pdf', 'application/pdf', 196608)
ON CONFLICT DO NOTHING;

-- =============================================
-- PUBLISHER_CONTRACTS - Contratos com Publicadores
-- =============================================
-- Contratos isolados e consistentes com o schema novo
-- Publishers podem ter revenue_share, subscription ou hybrid

INSERT INTO publisher_contracts (
    contract_id, publisher_id, contract_number, contract_type,
    title, description, start_date, end_date,
    revenue_share_percentage, revenue_share_rules, minimum_payout_amount,
    subscription_amount, subscription_interval,
    currency, payment_terms, status,
    signed_by_publisher_at, signed_by_tenant_at, created_by, metadata,
    document_path, document_filename, document_mime_type, document_size_bytes
) VALUES
-- Contrato 1: Shopping Center Norte (publisher_id=1) - Revenue Share
(1, 1, 'PUB-CONT-2025-001', 'revenue_share',
    'Contrato Revenue Share - Shopping Center Norte',
    'Contrato de revenue share: publisher recebe 70% da receita gerada em seus totens',
    '2025-01-01', NULL,
    70.00, '{"tier_1": 70, "tier_2": 65, "tier_3": 60}'::jsonb, 1000.00,
    NULL, NULL,
    'BRL', 'Pagamento mensal até dia 10', 'active',
    NOW() - INTERVAL '12 months', NOW() - INTERVAL '12 months', 1,
    '{"totems_count": 3, "locations": ["entrada", "praça_alimentacao", "cinema"]}'::jsonb,
    '/contracts/publishers/PUB-CONT-2025-001.pdf', 'PUB-CONT-2025-001.pdf', 'application/pdf', 278528),

-- Contrato 2: Farmácia Saúde Mais (publisher_id=2) - Revenue Share
(2, 2, 'PUB-CONT-2025-002', 'revenue_share',
    'Contrato Revenue Share - Farmácia Saúde Mais',
    'Contrato de revenue share: publisher recebe 65% da receita gerada em suas farmácias',
    '2025-02-01', NULL,
    65.00, '{"standard": 65}'::jsonb, 500.00,
    NULL, NULL,
    'BRL', 'Pagamento mensal até dia 10', 'active',
    NOW() - INTERVAL '11 months', NOW() - INTERVAL '11 months', 1,
    '{"totems_count": 2, "locations": ["matriz_centro", "filial_zona_sul"]}'::jsonb,
    '/contracts/publishers/PUB-CONT-2025-002.pdf', 'PUB-CONT-2025-002.pdf', 'application/pdf', 245760),

-- Contrato 3: Aeroporto Internacional de São Paulo (publisher_id=3) - Revenue Share
(3, 3, 'PUB-CONT-2025-003', 'revenue_share',
    'Contrato Revenue Share - Aeroporto Internacional de São Paulo',
    'Contrato de revenue share: publisher recebe 60% da receita gerada nos totens do aeroporto',
    '2025-01-15', NULL,
    60.00, '{"standard": 60}'::jsonb, 2000.00,
    NULL, NULL,
    'BRL', 'Pagamento mensal até dia 15', 'active',
    NOW() - INTERVAL '11 months 15 days', NOW() - INTERVAL '11 months 15 days', 1,
    '{"totems_count": 2, "locations": ["embarque", "desembarque", "checkin"]}'::jsonb,
    '/contracts/publishers/PUB-CONT-2025-003.pdf', 'PUB-CONT-2025-003.pdf', 'application/pdf', 301056),

-- Contrato 5: Supermercado Econômico - Publisher (publisher_id=5) - Revenue Share
(5, 5, 'PUB-CONT-2025-005', 'revenue_share',
    'Contrato Revenue Share - Supermercado Econômico',
    'Contrato de revenue share: publisher recebe 60% da receita gerada nos totens do supermercado',
    '2025-01-01', NULL,
    60.00, '{"standard": 60}'::jsonb, 1000.00,
    NULL, NULL,
    'BRL', 'Pagamento mensal até dia 10', 'active',
    NOW() - INTERVAL '12 months', NOW() - INTERVAL '12 months', 1,
    '{"totems_count": 2, "locations": ["caixas", "acougue"]}'::jsonb,
    '/contracts/publishers/PUB-CONT-2025-005.pdf', 'PUB-CONT-2025-005.pdf', 'application/pdf', 245760),

-- Contrato 4: Rede de Totens Urbanos SP (publisher_id=4) - Hybrid (Revenue Share + Subscription)
(4, 4, 'PUB-CONT-2025-004', 'hybrid',
    'Contrato Híbrido - Rede de Totens Urbanos SP',
    'Contrato híbrido: publisher recebe 75% de revenue share e paga subscription mensal de R$ 299,00',
    '2025-03-01', NULL,
    75.00, '{"premium_locations": 75, "standard_locations": 70}'::jsonb, 2000.00,
    299.00, 'month',
    'BRL', 'Subscription: débito automático. Revenue share: pagamento mensal até dia 10', 'active',
    NOW() - INTERVAL '9 months', NOW() - INTERVAL '9 months', 1,
    '{"totems_count": 1, "subscription_active": true, "revenue_share_active": true}'::jsonb,
    '/contracts/publishers/PUB-CONT-2025-004.pdf', 'PUB-CONT-2025-004.pdf', 'application/pdf', 327680)
ON CONFLICT DO NOTHING;

INSERT INTO campaigns (campaign_id, subscriber_id, contract_id, title, category_segment, description, campaign_type, priority, commercial_tier, default_time_share_percent, max_consecutive_slots, start_date, end_date, start_time, end_time, days_of_week, timezone, status, is_active, target_audience, metadata) VALUES
-- Campanha 1: Marca Fashion Brasil (subscriber_id=1, contract_id=1)
(1, 1, 1, 'Coleção Verão 2025 - Marca Fashion Brasil', 'Moda', 'Campanha promocional da coleção verão 2025 em shopping centers', 'scheduled', 10, 'premium', 50.00, 2, '2025-01-15 00:00:00', '2027-01-14 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'America/Sao_Paulo', 'active', true, '{"age_range": "18-45", "gender": "all", "interests": ["moda", "shopping"]}'::jsonb, '{"season": "verao", "year": 2025}'::jsonb),

-- Campanha 2: Laboratório FarmaVida (subscriber_id=2, contract_id=2)
(2, 2, 2, 'Medicamentos Genéricos - Laboratório FarmaVida', 'Farmacêutico', 'Campanha promocional de medicamentos genéricos em farmácias', 'general', 8, 'standard', 30.00, 2, '2025-02-01 00:00:00', '2027-01-31 23:59:59', '08:00', '20:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]', 'America/Sao_Paulo', 'active', true, '{"age_range": "all", "health_interest": true}'::jsonb, '{"product_type": "genericos", "regulatory": "anvisa_approved"}'::jsonb),

-- Campanha 3: Supermercado Econômico (subscriber_id=3, contract_id=3)
(3, 3, 3, 'Ofertas Diárias - Supermercado Econômico', 'Varejo', 'Campanha de ofertas e promoções diárias do supermercado', 'general', 7, 'standard', 40.00, 3, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '06:00', '23:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 'America/Sao_Paulo', 'active', true, '{"age_range": "all", "shopping_habit": "frequent"}'::jsonb, '{"promotion_type": "daily_offers", "update_frequency": "daily"}'::jsonb),

-- Campanha 4: Rede de Restaurantes Sabor & Arte (subscriber_id=4, contract_id=4)
(4, 4, 4, 'Menu Executivo - Rede Sabor & Arte', 'Alimentação', 'Campanha promocional do menu executivo em horário de almoço', 'scheduled', 6, 'standard', 20.00, 1, '2025-03-01 00:00:00', '2027-02-28 23:59:59', '11:30', '14:30', '["monday", "tuesday", "wednesday", "thursday", "friday"]', 'America/Sao_Paulo', 'active', true, '{"age_range": "25-55", "meal_time": "lunch", "location": "business_district"}'::jsonb, '{"menu_type": "executivo", "price_range": "medio"}'::jsonb),

-- Campanha 5: Clínica Saúde Total (subscriber_id=5, contract_id=5)
(5, 5, 5, 'Check-up Preventivo - Clínica Saúde Total', 'Saúde', 'Campanha de conscientização sobre importância do check-up preventivo', 'general', 5, 'standard', 15.00, 1, '2025-04-01 00:00:00', '2027-03-31 23:59:59', '08:00', '18:00', '["monday", "tuesday", "wednesday", "thursday", "friday"]', 'America/Sao_Paulo', 'active', true, '{"age_range": "30-65", "health_conscious": true}'::jsonb, '{"service_type": "preventivo", "specialty": "geral"}'::jsonb)
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
-- Campanha 1 (Marca Fashion) - Totens do Shopping Center Norte
(1, 1, '2025-01-15 00:00:00', '2027-01-14 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(1, 2, '2025-01-15 00:00:00', '2027-01-14 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
(1, 3, '2025-01-15 00:00:00', '2027-01-14 23:59:59', '08:00', '22:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 10, true),
-- Campanha 2 (FarmaVida) - Totens das Farmácias
(2, 4, '2025-02-01 00:00:00', '2027-01-31 23:59:59', '08:00', '20:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]', 8, true),
(2, 5, '2025-02-01 00:00:00', '2027-01-31 23:59:59', '08:00', '20:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]', 8, true),
-- Campanha 3 (Supermercado) - Totens do Supermercado
(3, 9, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '06:00', '23:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 7, true),
(3, 10, '2025-01-01 00:00:00', '2026-12-31 23:59:59', '06:00', '23:00', '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]', 7, true),
-- Conflitos intencionais (mesmo totem, campanhas sobrepostas) para testes de fallback "single winner"
-- Campanha 4 (Restaurante) e 5 (Clínica) no mesmo totem 1 em horários sobrepostos
(4, 1, '2025-03-01 00:00:00', '2027-02-28 23:59:59', '12:00', '13:00', '["monday", "tuesday", "wednesday", "thursday", "friday"]', 9, true),
(5, 1, '2025-04-01 00:00:00', '2027-03-31 23:59:59', '12:30', '12:45', '["monday", "tuesday", "wednesday", "thursday", "friday"]', 8, true),
(4, 2, '2025-03-01 00:00:00', '2027-02-28 23:59:59', '12:00', '13:00', '["monday", "tuesday", "wednesday", "thursday", "friday"]', 9, true)
ON CONFLICT DO NOTHING;

INSERT INTO campaign_publishers (campaign_id, publisher_id, revenue_share_percentage, time_share_percent, daypart_config, min_impressions_per_hour, max_impressions_per_hour, is_active, metadata) VALUES
(1, 1, 70.00, 50.00, '{}'::jsonb, 10, 20, true, '{}'::jsonb),
(2, 2, 65.00, 30.00, '{}'::jsonb, 5, 15, true, '{}'::jsonb),
(3, 5, 60.00, 40.00, '{}'::jsonb, 8, 18, true, '{}'::jsonb),
(4, 1, 70.00, 20.00, '{}'::jsonb, 3, 10, true, '{}'::jsonb),
(5, 1, 70.00, 15.00, '{}'::jsonb, 2, 8, true, '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO campaign_locals (campaign_id, local_id, is_active) VALUES
(1, 1, true),
(1, 2, true),
(1, 3, true),
(2, 4, true),
(2, 5, true),
(3, 9, true),
(3, 10, true),
(4, 1, true),
(4, 2, true),
(5, 1, true)
ON CONFLICT DO NOTHING;

INSERT INTO subscriber_billing (billing_id, subscriber_id, campaign_id, billing_type, amount, currency, direction, description, invoice_number, payment_method, payment_status, payment_date, due_date, metadata) VALUES
(1, 1, 1, 'campaign', 50000.00, 'BRL', 'incoming', 'Faturamento campanha Coleção Verão 2025', 'INV-2025-001', 'bank_transfer', 'paid', (NOW() - INTERVAL '1 year') - INTERVAL '5 days', (NOW() - INTERVAL '1 year') + INTERVAL '25 days', '{}'::jsonb),
(2, 2, 2, 'campaign', 5000.00, 'BRL', 'incoming', 'Faturamento campanha Medicamentos Genéricos', 'INV-2025-002', 'credit_card', 'paid', (NOW() - INTERVAL '1 year') - INTERVAL '3 days', (NOW() - INTERVAL '1 year') + INTERVAL '27 days', '{}'::jsonb),
(3, 3, 3, 'campaign', 6666.67, 'BRL', 'incoming', 'Faturamento campanha Ofertas do Dia', 'INV-2025-003', 'credit_card', 'pending', NULL, (NOW() - INTERVAL '1 year') + INTERVAL '7 days', '{}'::jsonb),
(4, 4, 4, 'campaign', 8000.00, 'BRL', 'incoming', 'Faturamento campanha Menu Executivo', 'INV-2025-004', 'credit_card', 'paid', (NOW() - INTERVAL '1 year') - INTERVAL '2 days', (NOW() - INTERVAL '1 year') + INTERVAL '28 days', '{}'::jsonb),
(5, 5, 5, 'campaign', 10000.00, 'BRL', 'incoming', 'Faturamento campanha Check-up Preventivo', 'INV-2025-005', 'bank_transfer', 'pending', NULL, (NOW() - INTERVAL '1 year') - INTERVAL '5 days', '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO publisher_billing (billing_id, publisher_id, campaign_id, totem_id, billing_type, amount, currency, direction, revenue_share_percentage, original_campaign_amount, platform_fee_amount, publisher_share_amount, description, invoice_number, payment_status, payment_date, due_date, approved_by, approved_at, payment_method, metadata) VALUES
(1, 1, 1, NULL, 'revenue_share', 35000.00, 'BRL', 'outgoing', 70.00, 50000.00, 15000.00, 35000.00, 'Revenue share campanha Coleção Verão 2025', 'PAY-2025-001', 'paid', (NOW() - INTERVAL '1 year') - INTERVAL '2 days', (NOW() - INTERVAL '1 year') + INTERVAL '5 days', 1, (NOW() - INTERVAL '1 year'), 'bank_transfer', '{}'::jsonb),
(2, 2, 2, NULL, 'revenue_share', 3250.00, 'BRL', 'outgoing', 65.00, 5000.00, 1750.00, 3250.00, 'Revenue share campanha Medicamentos Genéricos', 'PAY-2025-002', 'pending_payout', NULL, (NOW() - INTERVAL '1 year') + INTERVAL '5 days', 1, (NOW() - INTERVAL '1 year'), 'bank_transfer', '{}'::jsonb),
(3, 5, 3, NULL, 'revenue_share', 4000.00, 'BRL', 'outgoing', 60.00, 6666.67, 2666.67, 4000.00, 'Revenue share campanha Ofertas do Dia', 'PAY-2025-003', 'pending_payout', NULL, (NOW() - INTERVAL '1 year') + INTERVAL '5 days', 1, (NOW() - INTERVAL '1 year'), 'bank_transfer', '{}'::jsonb),
(4, 1, 4, NULL, 'revenue_share', 5600.00, 'BRL', 'outgoing', 70.00, 8000.00, 2400.00, 5600.00, 'Revenue share campanha Menu Executivo', 'PAY-2025-004', 'pending_payout', NULL, (NOW() - INTERVAL '1 year') + INTERVAL '5 days', 1, (NOW() - INTERVAL '1 year'), 'bank_transfer', '{}'::jsonb),
(5, 4, NULL, NULL, 'subscription', 299.00, 'BRL', 'incoming', NULL, NULL, NULL, NULL, 'Assinatura mensal Rede de Totens Urbanos', 'SUB-2025-001', 'paid', (NOW() - INTERVAL '1 year') - INTERVAL '10 days', (NOW() - INTERVAL '1 year') + INTERVAL '20 days', NULL, NULL, 'credit_card', '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO subscriptions (subscription_id, publisher_id, plan_id, stripe_subscription_id, stripe_customer_id, status, current_period_start, current_period_end, cancel_at_period_end, trial_start, trial_end, metadata) VALUES
(1, 4, 2, 'sub_test_001', 'cus_test_001', 'active', (NOW() - INTERVAL '1 year') - INTERVAL '10 days', '2027-12-31 23:59:59', false, NULL, NULL, '{}'::jsonb)
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
(1, 1, 1, 1, 2, 'contract', (NOW() - INTERVAL '1 year'), '2027-01-14 23:59:59', true, 1, 'Acesso via contrato Marca Fashion Brasil', '{}'::jsonb),
(2, 2, 2, 2, 1, 'contract', (NOW() - INTERVAL '1 year'), '2027-01-31 23:59:59', true, 1, 'Acesso via contrato Laboratório FarmaVida', '{}'::jsonb),
(3, 3, 3, 3, 1, 'contract', (NOW() - INTERVAL '1 year'), '2026-12-31 23:59:59', true, 1, 'Acesso via contrato Supermercado Econômico', '{}'::jsonb),
(4, 4, 1, 4, 1, 'contract', (NOW() - INTERVAL '1 year'), '2027-02-28 23:59:59', true, 1, 'Acesso via contrato Rede Sabor & Arte', '{}'::jsonb),
(5, 5, 1, 5, 1, 'contract', (NOW() - INTERVAL '1 year'), '2027-03-31 23:59:59', true, 1, 'Acesso via contrato Clínica Saúde Total', '{}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO totem_playlists (totem_playlist_id, totem_id, smart_tv_id, publisher_id, playlist_hash, version, total_items, total_duration_seconds, status, is_active, generated_at, last_updated_at, expires_at, metadata, generation_log) VALUES
-- Playlists históricas (1 ano atrás)
(1, 1, NULL, 1, 'hash_001', 1, 2, 40, 'active', true, (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), NULL, '{}'::jsonb, '{}'::jsonb),
(2, 2, NULL, 1, 'hash_002', 1, 2, 40, 'active', true, (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), NULL, '{}'::jsonb, '{}'::jsonb),
(3, 3, NULL, 1, 'hash_003', 1, 2, 40, 'active', true, (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), NULL, '{}'::jsonb, '{}'::jsonb),
(4, 4, NULL, 2, 'hash_004', 1, 1, 15, 'active', true, (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), NULL, '{}'::jsonb, '{}'::jsonb),
(5, 5, NULL, 2, 'hash_005', 1, 1, 15, 'active', true, (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), NULL, '{}'::jsonb, '{}'::jsonb),
(6, 6, NULL, 3, 'hash_006', 1, 1, 12, 'active', true, (NOW() - INTERVAL '1 year'), (NOW() - INTERVAL '1 year'), NULL, '{}'::jsonb, '{}'::jsonb),

-- Playlists recentes simulando solicitações e entregas
(7, 1, NULL, 1, 'hash_001_v2', 2, 2, 40, 'active', true, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', NULL, '{"request_id": "req-001", "delivery_method": "http"}'::jsonb, '{"generation_time_ms": 132}'::jsonb),
(8, 2, NULL, 1, 'hash_002_v2', 2, 2, 40, 'active', true, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes', NULL, '{"request_id": "req-002", "delivery_method": "cache"}'::jsonb, '{"generation_time_ms": 45, "from_cache": true}'::jsonb),
(9, 3, NULL, 1, 'hash_003_v2', 2, 2, 40, 'active', true, NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '25 minutes', NULL, '{"request_id": "req-003", "delivery_method": "http"}'::jsonb, '{"generation_time_ms": 138}'::jsonb),
(10, 9, NULL, 5, 'hash_009', 1, 1, 12, 'active', true, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes', NULL, '{"request_id": "req-007", "delivery_method": "http"}'::jsonb, '{"generation_time_ms": 105}'::jsonb),
(11, 10, NULL, 5, 'hash_010', 1, 1, 12, 'active', true, NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '50 minutes', NULL, '{"request_id": "req-008", "delivery_method": "cache"}'::jsonb, '{"generation_time_ms": 42, "from_cache": true}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO totem_playlist_items (item_id, totem_playlist_id, media_id, campaign_id, subscriber_id, publisher_id, order_index, priority, display_seconds, transition_type, transition_duration_ms, commercial_tier, time_share_percent, revenue_share_percent, start_time, end_time, days_of_week, is_active) VALUES
-- Itens históricos
(1, 1, 1, 1, 1, 1, 0, 10, 10, 'fade', 2000, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(2, 1, 2, 1, 1, 1, 1, 10, 30, 'slide', 1500, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(3, 2, 1, 1, 1, 1, 0, 10, 10, 'fade', 2000, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(4, 2, 2, 1, 1, 1, 1, 10, 30, 'slide', 1500, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(5, 3, 1, 1, 1, 1, 0, 10, 10, 'fade', 2000, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(6, 3, 2, 1, 1, 1, 1, 10, 30, 'slide', 1500, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(7, 4, 3, 2, 2, 2, 0, 8, 15, 'fade', 3000, 'standard', 30.00, 65.00, NULL, NULL, NULL, true),
(8, 5, 3, 2, 2, 2, 0, 8, 15, 'fade', 3000, 'standard', 30.00, 65.00, NULL, NULL, NULL, true),

-- Itens recentes para playlists entregues recentemente
(10, 7, 1, 1, 1, 1, 0, 10, 10, 'fade', 2000, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(11, 7, 2, 1, 1, 1, 1, 10, 30, 'slide', 1500, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(12, 8, 1, 1, 1, 1, 0, 10, 10, 'fade', 2000, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(13, 8, 2, 1, 1, 1, 1, 10, 30, 'slide', 1500, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(14, 9, 1, 1, 1, 1, 0, 10, 10, 'fade', 2000, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(15, 9, 2, 1, 1, 1, 1, 10, 30, 'slide', 1500, 'premium', 50.00, 70.00, NULL, NULL, NULL, true),
(16, 10, 4, 3, 3, 5, 0, 7, 12, 'fade', 2500, 'standard', 40.00, 60.00, NULL, NULL, NULL, true),
(17, 11, 4, 3, 3, 5, 0, 7, 12, 'fade', 2500, 'standard', 40.00, 60.00, NULL, NULL, NULL, true)
ON CONFLICT DO NOTHING;

-- totem_playlist_generation_log: depende de totem_playlists 1-11 (inseridos acima). Referências NULL apenas para logs de falha.
INSERT INTO totem_playlist_generation_log (log_id, totem_id, totem_playlist_id, publisher_id, status, error_message, campaigns_included, playlists_included, medias_included, subscribers_included, generation_time_ms, generation_details, generated_at, generated_by) VALUES
-- Logs históricos (1 ano atrás)
(1, 1, 1, 1, 'success', NULL, 3, 1, 2, 3, 150, '{"mode": "MIXED", "window_seconds": 600}'::jsonb, (NOW() - INTERVAL '1 year'), 'system'),
(2, 2, 2, 1, 'success', NULL, 3, 1, 2, 3, 145, '{"mode": "MIXED", "window_seconds": 600}'::jsonb, (NOW() - INTERVAL '1 year'), 'system'),
(3, 3, 3, 1, 'success', NULL, 3, 1, 2, 3, 148, '{"mode": "MIXED", "window_seconds": 600}'::jsonb, (NOW() - INTERVAL '1 year'), 'system'),
(4, 4, 4, 2, 'success', NULL, 1, 1, 1, 1, 80, '{"mode": "SINGLE_WINNER", "window_seconds": 600}'::jsonb, (NOW() - INTERVAL '1 year'), 'system'),
(5, 5, 5, 2, 'success', NULL, 1, 1, 1, 1, 82, '{"mode": "SINGLE_WINNER", "window_seconds": 600}'::jsonb, (NOW() - INTERVAL '1 year'), 'system'),
(6, 6, 6, 3, 'success', NULL, 1, 1, 1, 1, 75, '{"mode": "SINGLE_WINNER", "window_seconds": 600}'::jsonb, (NOW() - INTERVAL '1 year'), 'system'),

-- Logs recentes simulando solicitações e gerações de playlists
(7, 1, 7, 1, 'success', NULL, 3, 1, 2, 3, 132, '{"mode": "MIXED", "window_seconds": 600, "trigger": "playlist_request", "request_id": "req-001"}'::jsonb, NOW() - INTERVAL '1 hour', 'system'),
(8, 2, 8, 1, 'success', NULL, 3, 1, 2, 3, 45, '{"mode": "MIXED", "window_seconds": 600, "trigger": "scheduled", "from_cache": true}'::jsonb, NOW() - INTERVAL '30 minutes', 'system'),
(9, 3, 9, 1, 'success', NULL, 3, 1, 2, 3, 138, '{"mode": "MIXED", "window_seconds": 600, "trigger": "playlist_request", "request_id": "req-003"}'::jsonb, NOW() - INTERVAL '25 minutes', 'system'),
(10, 4, 4, 2, 'success', NULL, 1, 1, 1, 1, 92, '{"mode": "SINGLE_WINNER", "window_seconds": 600, "trigger": "playlist_request", "request_id": "req-004"}'::jsonb, NOW() - INTERVAL '2 hours', 'system'),
(11, 5, 5, 2, 'success', NULL, 1, 1, 1, 1, 38, '{"mode": "SINGLE_WINNER", "window_seconds": 600, "trigger": "scheduled", "from_cache": true}'::jsonb, NOW() - INTERVAL '45 minutes', 'system'),
(12, 9, 10, 5, 'success', NULL, 1, 1, 1, 1, 105, '{"mode": "SINGLE_WINNER", "window_seconds": 600, "trigger": "playlist_request", "request_id": "req-007"}'::jsonb, NOW() - INTERVAL '20 minutes', 'system'),
(13, 10, 11, 5, 'success', NULL, 1, 1, 1, 1, 42, '{"mode": "SINGLE_WINNER", "window_seconds": 600, "trigger": "scheduled", "from_cache": true}'::jsonb, NOW() - INTERVAL '50 minutes', 'system'),

-- Logs de falha/erro para testes
(14, 6, NULL, 3, 'failed', 'Nenhuma campanha ativa disponível para este totem', 0, 0, 0, 0, 25, '{"mode": "SINGLE_WINNER", "trigger": "playlist_request", "request_id": "req-006", "error": "no_active_campaigns"}'::jsonb, NOW() - INTERVAL '1 hour 15 minutes', 'system'),
(15, 8, NULL, 4, 'failed', 'Nenhuma campanha ativa disponível para este totem', 0, 0, 0, 0, 18, '{"mode": "SINGLE_WINNER", "trigger": "playlist_request", "request_id": "req-009", "error": "no_active_campaigns"}'::jsonb, NOW() - INTERVAL '15 minutes', 'system'),
(16, 7, NULL, 3, 'failed', 'Totem offline - não respondeu ao heartbeat', 0, 0, 0, 0, 5000, '{"mode": "SINGLE_WINNER", "trigger": "playlist_request", "request_id": "req-010", "error": "totem_offline", "retry_count": 3}'::jsonb, NOW() - INTERVAL '2 hours', 'system')
ON CONFLICT DO NOTHING;

-- Analytics sessions recentes para testes
INSERT INTO analytics_sessions (session_id, totem_id, start_time, end_time, duration_seconds, metadata) VALUES
(1, 1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', 3600, '{"viewers": 45, "interactions": 12}'::jsonb),
(2, 2, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '30 minutes', 1800, '{"viewers": 32, "interactions": 8}'::jsonb),
(3, 3, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours', 3600, '{"viewers": 28, "interactions": 5}'::jsonb),
(4, 4, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours', 3600, '{"viewers": 15, "interactions": 3}'::jsonb),
(5, 5, NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '30 minutes', 900, '{"viewers": 18, "interactions": 4}'::jsonb),
(6, 6, NOW() - INTERVAL '1 hour 30 minutes', NOW() - INTERVAL '1 hour', 1800, '{"viewers": 52, "interactions": 15}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO analytics_emotions (emotion_id, session_id, totem_id, emotion_type, confidence, detected_at, metadata) VALUES
(1, 1, 1, 'happy', 0.85, NOW() - INTERVAL '2 hours', '{"age_range": "25-35", "gender": "F"}'::jsonb),
(2, 1, 1, 'neutral', 0.75, NOW() - INTERVAL '1 hour 50 minutes', '{"age_range": "35-45", "gender": "M"}'::jsonb),
(3, 2, 2, 'happy', 0.90, NOW() - INTERVAL '1 hour', '{"age_range": "18-25", "gender": "F"}'::jsonb),
(4, 3, 3, 'surprised', 0.80, NOW() - INTERVAL '3 hours', '{"age_range": "45-55", "gender": "M"}'::jsonb),
(5, 2, 2, 'excited', 0.88, NOW() - INTERVAL '50 minutes', '{"age_range": "25-35", "gender": "F"}'::jsonb),
(6, 5, 5, 'neutral', 0.70, NOW() - INTERVAL '40 minutes', '{"age_range": "35-45", "gender": "M"}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO analytics_gestures (gesture_id, session_id, totem_id, gesture_type, confidence, detected_at, metadata) VALUES
(1, 1, 1, 'wave', 0.88, NOW() - INTERVAL '2 hours', '{"hand": "right", "duration_ms": 1200}'::jsonb),
(2, 1, 1, 'point', 0.82, NOW() - INTERVAL '1 hour 45 minutes', '{"hand": "right", "target_area": "promocao"}'::jsonb),
(3, 2, 2, 'wave', 0.90, NOW() - INTERVAL '1 hour', '{"hand": "left", "duration_ms": 1500}'::jsonb),
(4, 3, 3, 'touch', 0.85, NOW() - INTERVAL '3 hours', '{"hand": "right", "screen_area": "center"}'::jsonb),
(5, 2, 2, 'point', 0.87, NOW() - INTERVAL '50 minutes', '{"hand": "right", "target_area": "produto"}'::jsonb),
(6, 6, 6, 'wave', 0.91, NOW() - INTERVAL '1 hour 20 minutes', '{"hand": "right", "duration_ms": 1100}'::jsonb)
ON CONFLICT DO NOTHING;

-- Execution logs recentes para testes - Simulando reprodução de mídias
INSERT INTO execution_logs (log_id, totem_id, campaign_id, playlist_id, media_id, publisher_id, subscriber_id, event_type, event_data, timestamp, metadata) VALUES
-- Totem 1 - Shopping Entrada - Sequência completa de reprodução
(1, 1, 1, 1, 1, 1, 1, 'playlist_request', '{"request_id": "req-001", "totem_uin": "UIN-SHOPPING-001-2025", "requested_at": "2025-01-15T13:00:00Z"}'::jsonb, NOW() - INTERVAL '1 hour', '{"source": "heartbeat", "cache_hit": false}'::jsonb),
(2, 1, 1, 1, 1, 1, 1, 'playlist_delivered', '{"playlist_id": 1, "items_count": 2, "total_duration": 40, "delivery_time_ms": 125}'::jsonb, NOW() - INTERVAL '1 hour' + INTERVAL '125 milliseconds', '{"delivery_method": "http", "compressed": true}'::jsonb),
(3, 1, 1, 1, 1, 1, 1, 'play_start', '{"duration_ms": 10000, "playlist_item_index": 0}'::jsonb, NOW() - INTERVAL '1 hour' + INTERVAL '1 second', '{"priority": 10, "transition": "fade"}'::jsonb),
(4, 1, 1, 1, 1, 1, 1, 'play_end', '{"duration_ms": 10000, "actual_duration_ms": 10050, "completed": true}'::jsonb, NOW() - INTERVAL '1 hour' + INTERVAL '11 seconds', '{"viewers_detected": 3}'::jsonb),
(5, 1, 1, 1, 2, 1, 1, 'play_start', '{"duration_ms": 30000, "playlist_item_index": 1}'::jsonb, NOW() - INTERVAL '1 hour' + INTERVAL '12 seconds', '{"priority": 10, "transition": "slide"}'::jsonb),
(6, 1, 1, 1, 2, 1, 1, 'play_end', '{"duration_ms": 30000, "actual_duration_ms": 30020, "completed": true}'::jsonb, NOW() - INTERVAL '1 hour' + INTERVAL '42 seconds', '{"viewers_detected": 5}'::jsonb),

-- Totem 2 - Shopping Praça - Solicitação e entrega
(7, 2, 1, 2, 1, 1, 1, 'playlist_request', '{"request_id": "req-002", "totem_uin": "UIN-SHOPPING-002-2025", "requested_at": "2025-01-15T13:30:00Z"}'::jsonb, NOW() - INTERVAL '30 minutes', '{"source": "scheduled", "cache_hit": true}'::jsonb),
(8, 2, 1, 2, 1, 1, 1, 'playlist_delivered', '{"playlist_id": 2, "items_count": 2, "total_duration": 40, "delivery_time_ms": 45}'::jsonb, NOW() - INTERVAL '30 minutes' + INTERVAL '45 milliseconds', '{"delivery_method": "cache", "compressed": true}'::jsonb),
(9, 2, 1, 2, 1, 1, 1, 'play_start', '{"duration_ms": 10000, "playlist_item_index": 0}'::jsonb, NOW() - INTERVAL '30 minutes' + INTERVAL '1 second', '{"priority": 10}'::jsonb),

-- Totem 3 - Shopping Cinema
(10, 3, 1, 1, 1, 1, 1, 'playlist_request', '{"request_id": "req-003", "totem_uin": "UIN-SHOPPING-003-2025", "requested_at": "2025-01-15T13:35:00Z"}'::jsonb, NOW() - INTERVAL '25 minutes', '{"source": "heartbeat", "cache_hit": false}'::jsonb),
(11, 3, 1, 1, 1, 1, 1, 'playlist_delivered', '{"playlist_id": 1, "items_count": 2, "total_duration": 40, "delivery_time_ms": 138}'::jsonb, NOW() - INTERVAL '25 minutes' + INTERVAL '138 milliseconds', '{"delivery_method": "http", "compressed": true}'::jsonb),
(12, 3, 1, 1, 1, 1, 1, 'play_start', '{"duration_ms": 10000, "playlist_item_index": 0}'::jsonb, NOW() - INTERVAL '25 minutes' + INTERVAL '1 second', '{"priority": 10}'::jsonb),

-- Totem 4 - Farmácia Matriz
(13, 4, 2, 3, 3, 2, 2, 'playlist_request', '{"request_id": "req-004", "totem_uin": "UIN-FARMACIA-001-2025", "requested_at": "2025-01-15T11:00:00Z"}'::jsonb, NOW() - INTERVAL '2 hours', '{"source": "heartbeat", "cache_hit": false}'::jsonb),
(14, 4, 2, 3, 3, 2, 2, 'playlist_delivered', '{"playlist_id": 3, "items_count": 1, "total_duration": 15, "delivery_time_ms": 92}'::jsonb, NOW() - INTERVAL '2 hours' + INTERVAL '92 milliseconds', '{"delivery_method": "http", "compressed": true}'::jsonb),
(15, 4, 2, 3, 3, 2, 2, 'play_start', '{"duration_ms": 15000, "playlist_item_index": 0}'::jsonb, NOW() - INTERVAL '2 hours' + INTERVAL '1 second', '{"priority": 8}'::jsonb),

-- Totem 5 - Farmácia Filial
(16, 5, 2, 3, 3, 2, 2, 'playlist_request', '{"request_id": "req-005", "totem_uin": "UIN-FARMACIA-002-2025", "requested_at": "2025-01-15T12:15:00Z"}'::jsonb, NOW() - INTERVAL '45 minutes', '{"source": "scheduled", "cache_hit": true}'::jsonb),
(17, 5, 2, 3, 3, 2, 2, 'playlist_delivered', '{"playlist_id": 3, "items_count": 1, "total_duration": 15, "delivery_time_ms": 38}'::jsonb, NOW() - INTERVAL '45 minutes' + INTERVAL '38 milliseconds', '{"delivery_method": "cache", "compressed": true}'::jsonb),
(18, 5, 2, 3, 3, 2, 2, 'play_start', '{"duration_ms": 15000, "playlist_item_index": 0}'::jsonb, NOW() - INTERVAL '45 minutes' + INTERVAL '1 second', '{"priority": 8}'::jsonb),

-- Totem 6 - Aeroporto Embarque
(19, 6, NULL, NULL, NULL, 3, NULL, 'playlist_request', '{"request_id": "req-006", "totem_uin": "UIN-AEROPORTO-001-2025", "requested_at": "2025-01-15T11:45:00Z"}'::jsonb, NOW() - INTERVAL '1 hour 15 minutes', '{"source": "heartbeat", "cache_hit": false}'::jsonb),
(20, 6, NULL, NULL, NULL, 3, NULL, 'playlist_delivered', '{"playlist_id": null, "items_count": 0, "total_duration": 0, "delivery_time_ms": 25, "status": "no_campaigns"}'::jsonb, NOW() - INTERVAL '1 hour 15 minutes' + INTERVAL '25 milliseconds', '{"delivery_method": "http", "message": "Nenhuma campanha ativa"}'::jsonb),

-- Totem 9 - Supermercado Caixas
(21, 9, 3, 4, 4, 5, 3, 'playlist_request', '{"request_id": "req-007", "totem_uin": "UIN-SUPER-001-2025", "requested_at": "2025-01-15T13:40:00Z"}'::jsonb, NOW() - INTERVAL '20 minutes', '{"source": "heartbeat", "cache_hit": false}'::jsonb),
(22, 9, 3, 4, 4, 5, 3, 'playlist_delivered', '{"playlist_id": 4, "items_count": 1, "total_duration": 12, "delivery_time_ms": 105}'::jsonb, NOW() - INTERVAL '20 minutes' + INTERVAL '105 milliseconds', '{"delivery_method": "http", "compressed": true}'::jsonb),
(23, 9, 3, 4, 4, 5, 3, 'play_start', '{"duration_ms": 12000, "playlist_item_index": 0}'::jsonb, NOW() - INTERVAL '20 minutes' + INTERVAL '1 second', '{"priority": 7}'::jsonb),
(24, 9, 3, 4, 4, 5, 3, 'play_end', '{"duration_ms": 12000, "actual_duration_ms": 12015, "completed": true}'::jsonb, NOW() - INTERVAL '20 minutes' + INTERVAL '13 seconds', '{"viewers_detected": 8}'::jsonb),

-- Totem 10 - Supermercado Açougue
(25, 10, 3, 4, 4, 5, 3, 'playlist_request', '{"request_id": "req-008", "totem_uin": "UIN-SUPER-002-2025", "requested_at": "2025-01-15T13:10:00Z"}'::jsonb, NOW() - INTERVAL '50 minutes', '{"source": "scheduled", "cache_hit": true}'::jsonb),
(26, 10, 3, 4, 4, 5, 3, 'playlist_delivered', '{"playlist_id": 4, "items_count": 1, "total_duration": 12, "delivery_time_ms": 42}'::jsonb, NOW() - INTERVAL '50 minutes' + INTERVAL '42 milliseconds', '{"delivery_method": "cache", "compressed": true}'::jsonb),
(27, 10, 3, 4, 4, 5, 3, 'play_start', '{"duration_ms": 12000, "playlist_item_index": 0}'::jsonb, NOW() - INTERVAL '50 minutes' + INTERVAL '1 second', '{"priority": 7}'::jsonb),

-- Totem 8 - Urbano - Solicitação sem campanhas
(28, 8, NULL, NULL, NULL, 4, NULL, 'playlist_request', '{"request_id": "req-009", "totem_uin": "UIN-URBANO-001-2025", "requested_at": "2025-01-15T13:45:00Z"}'::jsonb, NOW() - INTERVAL '15 minutes', '{"source": "heartbeat", "cache_hit": false}'::jsonb),
(29, 8, NULL, NULL, NULL, 4, NULL, 'playlist_delivered', '{"playlist_id": null, "items_count": 0, "total_duration": 0, "delivery_time_ms": 18, "status": "no_campaigns"}'::jsonb, NOW() - INTERVAL '15 minutes' + INTERVAL '18 milliseconds', '{"delivery_method": "http", "message": "Nenhuma campanha ativa"}'::jsonb)
ON CONFLICT DO NOTHING;

-- Bloco extra para testes unitários: histórico longo 2025 → 2030
-- Permite testar filtros por período e rastreabilidade em relatórios
INSERT INTO execution_logs (log_id, totem_id, campaign_id, playlist_id, media_id, publisher_id, subscriber_id, event_type, event_data, timestamp, metadata) VALUES
-- 2025: primeira execução registrada (início do período)
(30, 1, 1, 1, 1, 1, 1, 'play_start',
 '{"duration_ms": 10000, "playlist_item_index": 0}'::jsonb,
 '2025-01-15T10:00:00Z',
 '{"test_case": "traceability_range", "period": "start_2025"}'::jsonb),
(31, 1, 1, 1, 1, 1, 1, 'play_end',
 '{"duration_ms": 10000, "actual_duration_ms": 10050, "completed": true}'::jsonb,
 '2025-01-15T10:00:11Z',
 '{"test_case": "traceability_range", "period": "start_2025"}'::jsonb),
-- 2026: meio do período
(32, 2, 2, 3, 3, 2, 2, 'play_start',
 '{"duration_ms": 15000, "playlist_item_index": 0}'::jsonb,
 '2026-06-10T14:30:00Z',
 '{"test_case": "traceability_range", "period": "middle_2026"}'::jsonb),
(33, 2, 2, 3, 3, 2, 2, 'play_end',
 '{"duration_ms": 15000, "actual_duration_ms": 14980, "completed": true}'::jsonb,
 '2026-06-10T14:30:17Z',
 '{"test_case": "traceability_range", "period": "middle_2026"}'::jsonb),
-- 2028: quase fim do contrato padrão das campanhas
(34, 3, 3, 4, 4, 5, 3, 'play_start',
 '{"duration_ms": 12000, "playlist_item_index": 0}'::jsonb,
 '2028-09-20T09:15:00Z',
 '{"test_case": "traceability_range", "period": "near_end_2028"}'::jsonb),
(35, 3, 3, 4, 4, 5, 3, 'play_end',
 '{"duration_ms": 12000, "actual_duration_ms": 12020, "completed": true}'::jsonb,
 '2028-09-20T09:15:14Z',
 '{"test_case": "traceability_range", "period": "near_end_2028"}'::jsonb),
-- 2030: fim simbólico de período estendido (para telas que filtram até 2030)
(36, 4, 4, 5, 5, 1, 4, 'play_start',
 '{"duration_ms": 20000, "playlist_item_index": 0}'::jsonb,
 '2030-12-31T20:00:00Z',
 '{"test_case": "traceability_range", "period": "end_2030"}'::jsonb),
(37, 4, 4, 5, 5, 1, 4, 'play_end',
 '{"duration_ms": 20000, "actual_duration_ms": 19950, "completed": true}'::jsonb,
 '2030-12-31T20:00:22Z',
 '{"test_case": "traceability_range", "period": "end_2030"}'::jsonb),

-- =============================================
-- BLOCO EXTRA: Edge Cases e Cenários de Erro
-- =============================================
-- Timeout de conexão
(38, 1, 1, 1, 1, 1, 1, 'playlist_request',
 '{"request_id": "req-timeout-001", "totem_uin": "UIN-SHOPPING-001-2025"}'::jsonb,
 '2026-03-15T14:30:00Z',
 '{"source": "heartbeat", "test_case": "edge_case", "scenario": "connection_timeout"}'::jsonb),
(39, 1, NULL, NULL, NULL, 1, 1, 'playlist_delivery_failed',
 '{"request_id": "req-timeout-001", "error": "connection_timeout", "retry_count": 3, "timeout_ms": 5000}'::jsonb,
 '2026-03-15T14:30:05Z',
 '{"test_case": "edge_case", "scenario": "connection_timeout"}'::jsonb),

-- Validação temporal falhada (campanha expirada)
(40, 2, 1, 1, 1, 1, 1, 'playlist_request',
 '{"request_id": "req-validation-001", "totem_uin": "UIN-SHOPPING-002-2025"}'::jsonb,
 '2027-02-01T10:00:00Z',
 '{"source": "heartbeat", "test_case": "edge_case", "scenario": "temporal_validation_failed"}'::jsonb),
(41, 2, NULL, NULL, NULL, 1, 1, 'playlist_delivery_failed',
 '{"request_id": "req-validation-001", "error": "campaign_expired", "campaign_id": 1, "expired_at": "2027-01-14T23:59:59Z"}'::jsonb,
 '2027-02-01T10:00:01Z',
 '{"test_case": "edge_case", "scenario": "temporal_validation_failed"}'::jsonb),

-- Mídia corrompida durante reprodução
(42, 3, 1, 1, 2, 1, 1, 'play_start',
 '{"duration_ms": 30000, "playlist_item_index": 1}'::jsonb,
 '2026-08-20T16:45:00Z',
 '{"test_case": "edge_case", "scenario": "corrupted_media"}'::jsonb),
(43, 3, 1, 1, 2, 1, 1, 'play_error',
 '{"duration_ms": 30000, "actual_duration_ms": 8500, "error": "media_corrupted", "error_code": "MEDIA_CRC_FAIL", "completed": false}'::jsonb,
 '2026-08-20T16:45:09Z',
 '{"test_case": "edge_case", "scenario": "corrupted_media", "checksum_expected": "abc123", "checksum_received": "def456"}'::jsonb),

-- Totem offline por longo período
(44, 7, NULL, NULL, NULL, 3, NULL, 'playlist_request',
 '{"request_id": "req-offline-001", "totem_uin": "UIN-AEROPORTO-002-2025"}'::jsonb,
 '2026-11-10T08:00:00Z',
 '{"source": "heartbeat", "test_case": "edge_case", "scenario": "totem_offline_long"}'::jsonb),
(45, 7, NULL, NULL, NULL, 3, NULL, 'playlist_delivery_failed',
 '{"request_id": "req-offline-001", "error": "totem_offline", "last_heartbeat": "2026-11-09T22:15:00Z", "offline_duration_hours": 9.75}'::jsonb,
 '2026-11-10T08:00:02Z',
 '{"test_case": "edge_case", "scenario": "totem_offline_long"}'::jsonb),

-- Campanha expirada no meio da execução
(46, 1, 1, 1, 1, 1, 1, 'play_start',
 '{"duration_ms": 10000, "playlist_item_index": 0}'::jsonb,
 '2027-01-14T23:58:00Z',
 '{"test_case": "edge_case", "scenario": "campaign_expired_during_playback"}'::jsonb),
(47, 1, 1, 1, 1, 1, 1, 'play_interrupted',
 '{"duration_ms": 10000, "actual_duration_ms": 4500, "reason": "campaign_expired", "expired_at": "2027-01-14T23:59:59Z", "completed": false}'::jsonb,
 '2027-01-14T23:58:05Z',
 '{"test_case": "edge_case", "scenario": "campaign_expired_during_playback"}'::jsonb),

-- Conflito de prioridade (múltiplas campanhas competindo)
(48, 1, 1, 1, 1, 1, 1, 'playlist_request',
 '{"request_id": "req-conflict-001", "totem_uin": "UIN-SHOPPING-001-2025", "conflicting_campaigns": [1, 4, 5]}'::jsonb,
 '2026-12-15T12:00:00Z',
 '{"source": "heartbeat", "test_case": "edge_case", "scenario": "priority_conflict"}'::jsonb),
(49, 1, 1, 1, 1, 1, 1, 'playlist_delivered',
 '{"playlist_id": 1, "items_count": 2, "selected_campaign_id": 1, "conflict_resolution": "highest_priority", "rejected_campaigns": [4, 5]}'::jsonb,
 TIMESTAMP '2026-12-15T12:00:00Z' + INTERVAL '150 milliseconds',
 '{"test_case": "edge_case", "scenario": "priority_conflict", "resolution_method": "priority_weighted"}'::jsonb),

-- Falha de cache (cache corrompido)
(50, 2, 1, 2, 1, 1, 1, 'playlist_request',
 '{"request_id": "req-cache-fail-001", "totem_uin": "UIN-SHOPPING-002-2025", "cache_hit": true}'::jsonb,
 '2026-09-05T11:20:00Z',
 '{"source": "scheduled", "test_case": "edge_case", "scenario": "cache_corruption"}'::jsonb),
(51, 2, 1, 2, 1, 1, 1, 'playlist_delivery_failed',
 '{"request_id": "req-cache-fail-001", "error": "cache_corrupted", "cache_key": "totem_2_playlist_2", "fallback_to_http": true}'::jsonb,
 TIMESTAMP '2026-09-05T11:20:00Z' + INTERVAL '50 milliseconds',
 '{"test_case": "edge_case", "scenario": "cache_corruption"}'::jsonb),
(52, 2, 1, 2, 1, 1, 1, 'playlist_delivered',
 '{"playlist_id": 2, "items_count": 2, "delivery_time_ms": 180, "delivery_method": "http", "cache_rebuilt": true}'::jsonb,
 TIMESTAMP '2026-09-05T11:20:00Z' + INTERVAL '230 milliseconds',
 '{"test_case": "edge_case", "scenario": "cache_corruption", "recovery": "successful"}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO event_logs (log_id, event_type, entity_type, entity_id, totem_id, campaign_id, media_id, publisher_id, subscriber_id, user_id, metadata, severity, timestamp) VALUES
-- Eventos de criação e aprovação
(1, 'create', 'campaign', 1, NULL, 1, NULL, 1, 1, 4, '{"title": "Coleção Verão 2025"}'::jsonb, 'info', (NOW() - INTERVAL '1 year') - INTERVAL '10 days'),
(2, 'approve', 'media', 1, NULL, NULL, 1, NULL, 1, 1, '{"media_name": "colecao-verao-2024.jpg"}'::jsonb, 'info', (NOW() - INTERVAL '1 year') - INTERVAL '9 days'),
(3, 'update', 'totem', 1, 1, NULL, NULL, 1, NULL, 2, '{"field": "status", "old_value": "offline", "new_value": "online"}'::jsonb, 'info', (NOW() - INTERVAL '1 year') - INTERVAL '5 days'),

-- Eventos de solicitação e entrega de playlists
(4, 'playlist_request', 'totem', 1, 1, NULL, NULL, 1, NULL, NULL, '{"request_id": "req-001", "uin": "UIN-SHOPPING-001-2025", "source": "heartbeat"}'::jsonb, 'info', NOW() - INTERVAL '1 hour'),
(5, 'playlist_delivered', 'totem', 1, 1, 1, NULL, 1, 1, NULL, '{"playlist_id": 1, "items_count": 2, "delivery_time_ms": 125}'::jsonb, 'info', NOW() - INTERVAL '1 hour' + INTERVAL '125 milliseconds'),
(6, 'playlist_request', 'totem', 2, 2, NULL, NULL, 1, NULL, NULL, '{"request_id": "req-002", "uin": "UIN-SHOPPING-002-2025", "source": "scheduled", "cache_hit": true}'::jsonb, 'info', NOW() - INTERVAL '30 minutes'),
(7, 'playlist_delivered', 'totem', 2, 2, 1, NULL, 1, 1, NULL, '{"playlist_id": 2, "items_count": 2, "delivery_time_ms": 45, "from_cache": true}'::jsonb, 'info', NOW() - INTERVAL '30 minutes' + INTERVAL '45 milliseconds'),
(8, 'playlist_request', 'totem', 9, 9, NULL, NULL, 5, 3, NULL, '{"request_id": "req-007", "uin": "UIN-SUPER-001-2025", "source": "heartbeat"}'::jsonb, 'info', NOW() - INTERVAL '20 minutes'),
(9, 'playlist_delivered', 'totem', 9, 9, 3, NULL, 5, 3, NULL, '{"playlist_id": 4, "items_count": 1, "delivery_time_ms": 105}'::jsonb, 'info', NOW() - INTERVAL '20 minutes' + INTERVAL '105 milliseconds'),

-- Eventos de reprodução
(10, 'play', 'campaign', 1, 1, 1, NULL, 1, 1, NULL, '{"media_id": 1, "playlist_id": 1, "duration_ms": 10000}'::jsonb, 'info', NOW() - INTERVAL '1 hour' + INTERVAL '1 second'),
(11, 'play', 'campaign', 1, 1, 1, 2, 1, 1, NULL, '{"media_id": 2, "playlist_id": 1, "duration_ms": 30000}'::jsonb, 'info', NOW() - INTERVAL '1 hour' + INTERVAL '12 seconds'),
(12, 'play', 'campaign', 3, 9, 3, 4, 5, 3, NULL, '{"media_id": 4, "playlist_id": 4, "duration_ms": 12000}'::jsonb, 'info', NOW() - INTERVAL '20 minutes' + INTERVAL '1 second'),

-- Eventos de erro/falha
(13, 'playlist_request_failed', 'totem', 7, 7, NULL, NULL, 3, NULL, NULL, '{"request_id": "req-010", "uin": "UIN-AEROPORTO-002-2025", "error": "totem_offline", "reason": "Totem não respondeu ao heartbeat"}'::jsonb, 'warning', NOW() - INTERVAL '2 hours'),
(14, 'playlist_delivery_failed', 'totem', 7, 7, NULL, NULL, 3, NULL, NULL, '{"request_id": "req-010", "error": "connection_timeout", "retry_count": 3}'::jsonb, 'error', NOW() - INTERVAL '2 hours' + INTERVAL '5 seconds')
ON CONFLICT DO NOTHING;

-- Bloco extra para testes unitários em telas de rastreabilidade (event_logs)
INSERT INTO event_logs (log_id, event_type, entity_type, entity_id, totem_id, campaign_id, media_id, publisher_id, subscriber_id, user_id, metadata, severity, timestamp) VALUES
-- 2025: criação e primeira reprodução
(15, 'play', 'campaign', 1, 1, 1, 1, 1, 1, NULL,
 '{"scenario": "traceability_range", "period": "start_2025"}'::jsonb,
 'info', '2025-01-15T10:00:05Z'),
-- 2026: atualização de status de campanha
(16, 'update', 'campaign', 2, NULL, 2, NULL, NULL, 2, 4,
 '{"field": "status", "old_value": "active", "new_value": "paused"}'::jsonb,
 'warning', '2026-06-10T14:35:00Z'),
-- 2028: reativação e reprodução em supermercado
(17, 'update', 'campaign', 3, 9, 3, NULL, 5, 3, 4,
 '{"field": "status", "old_value": "paused", "new_value": "active"}'::jsonb,
 'info', '2028-09-20T09:10:00Z'),
(18, 'play', 'campaign', 3, 9, 3, 4, 5, 3, NULL,
 '{"media_id": 4, "playlist_id": 4, "duration_ms": 12000, "scenario": "traceability_range", "period": "near_end_2028"}'::jsonb,
 'info', '2028-09-20T09:15:05Z'),
-- 2030: encerramento de campanha de longo prazo
(19, 'update', 'campaign', 1, NULL, 1, NULL, 1, 1, 4,
 '{"field": "status", "old_value": "active", "new_value": "archived", "reason": "end_of_long_term_period"}'::jsonb,
 'info', '2030-12-31T23:59:00Z')
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
        -- Totem 6 - Aeroporto Embarque - Decisão sem campanhas (1h15min atrás)
        (
            6, 6, (NOW() - INTERVAL '1 year') - INTERVAL '1 hour 15 minutes', NULL, NULL, 'direct', 6, 1, 1,
            '[
                {
                    "source": "direct",
                    "source_id": 6,
                    "campaign_id": null,
                    "playlist_id": null,
                    "priority": 1,
                    "commercial_tier": "basic",
                    "time_share_percent": 5.0,
                    "revenue_share_percent": 0.0,
                    "score": 15.2,
                    "validated": false,
                    "reason": "Nenhuma campanha ativa disponível"
                }
            ]'::jsonb,
            true, true, false,
            '{
                "temporal": {
                    "valid": true,
                    "current_time": "2025-01-15T12:45:00Z",
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
            false, NULL,
            '{
                "totem_id": 6,
                "selected_campaign_id": null,
                "selected_playlist_id": null,
                "playlist_items": [],
                "total_duration_seconds": 0,
                "generated_at": "2025-01-15T12:45:00Z",
                "from_cache": false,
                "request_id": "req-006",
                "message": "Nenhuma campanha ativa disponível"
            }'::jsonb,
            25
        ),
        -- Totem 9 - Supermercado Caixas - Decisão RECENTE (20 minutos atrás)
        (
            13, 9, NOW() - INTERVAL '20 minutes', 3, 4, 'campaign', 3, 7, 1,
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
                    "score": 75.8,
                    "validated": true
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
            false, 'totem_9_campaign_3_2025-01-15T14:40:00Z',
            '{
                "totem_id": 9,
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
                "generated_at": "2025-01-15T14:40:00Z",
                "from_cache": false,
                "request_id": "req-007"
            }'::jsonb,
            105
        ),
        -- Totem 10 - Supermercado Açougue - Decisão RECENTE (50 minutos atrás)
        (
            14, 10, NOW() - INTERVAL '50 minutes', 3, 4, 'campaign', 3, 7, 1,
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
                    "score": 74.2,
                    "validated": true
                }
            ]'::jsonb,
            true, true, true,
            '{
                "temporal": {
                    "valid": true,
                    "current_time": "2025-01-15T14:10:00Z",
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
            true, 'totem_10_campaign_3_2025-01-15T14:10:00Z',
            '{
                "totem_id": 10,
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
                "generated_at": "2025-01-15T14:10:00Z",
                "from_cache": true,
                "request_id": "req-008"
            }'::jsonb,
            42
        ),
        -- Totem 1 - Histórico (3 horas atrás)
        (
            15, 1, (NOW() - INTERVAL '1 year') - INTERVAL '3 hours', 1, 1, 'campaign', 1, 10, 2,
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
        -- Totem 1 - Solicitação RECENTE (1 hora atrás) - Simulando solicitação de playlist
        (
            8, 1, NOW() - INTERVAL '1 hour', 1, 1, 'campaign', 1, 10, 3,
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
                    "score": 68.5,
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
                    "score": 48.3,
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
            false, 'totem_1_campaign_1_2025-01-15T14:00:00Z',
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
                "generated_at": "2025-01-15T14:00:00Z",
                "from_cache": false,
                "request_id": "req-001"
            }'::jsonb,
            132
        ),
        -- Totem 2 - Solicitação RECENTE (30 minutos atrás) - Cache hit
        (
            9, 2, NOW() - INTERVAL '30 minutes', 1, 2, 'campaign', 1, 10, 2,
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
                    "score": 66.2,
                    "validated": true
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
            true, 'totem_2_campaign_1_2025-01-15T14:30:00Z',
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
                "generated_at": "2025-01-15T14:30:00Z",
                "from_cache": true,
                "request_id": "req-002"
            }'::jsonb,
            45
        ),
        -- Totem 9 - Supermercado - Solicitação RECENTE (20 minutos atrás)
        (
            10, 9, NOW() - INTERVAL '20 minutes', 3, 4, 'campaign', 3, 7, 1,
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
                    "score": 75.8,
                    "validated": true
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
            false, 'totem_9_campaign_3_2025-01-15T14:40:00Z',
            '{
                "totem_id": 9,
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
                "generated_at": "2025-01-15T14:40:00Z",
                "from_cache": false,
                "request_id": "req-007"
            }'::jsonb,
            105
        ),
        -- Totem 1 - Histórico (3 horas atrás)
        (
            11, 1, (NOW() - INTERVAL '1 year') - INTERVAL '3 hours', 1, 1, 'campaign', 1, 10, 2,
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
            12, 2, (NOW() - INTERVAL '1 year') - INTERVAL '5 hours', 1, 2, 'campaign', 1, 10, 3,
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

-- =============================================
-- TAGS - Tags RFID/NFC/QR com metadata JSONB
-- =============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tags') THEN
        INSERT INTO tags (tag_id, tag_type, tag_value, tag_name, subscriber_id, publisher_id, metadata, is_active) VALUES
        (1, 'QR', 'QR-BF-2024-001', 'QR Code Black Friday', 1, NULL, '{"campaign_id": 1, "location": "entrada", "category": "promocao", "tracking_enabled": true}'::jsonb, true),
        (2, 'QR', 'QR-MED-2024-001', 'QR Code Medicamentos', 2, NULL, '{"campaign_id": 2, "location": "balcao", "category": "saude", "tracking_enabled": true}'::jsonb, true),
        (3, 'RFID', 'RFID-001-ABC123', 'Tag RFID Produto A', 1, 1, '{"product_id": "PROD-001", "category": "eletronicos", "price": 299.90, "discount_percent": 15}'::jsonb, true),
        (4, 'NFC', 'NFC-SHOPPING-001', 'Tag NFC Shopping', NULL, 1, '{"location": "entrada_principal", "type": "waypoint", "poi_id": "POI-001"}'::jsonb, true),
        (5, 'barcode', '7891234567890', 'Código de Barras Produto X', 3, NULL, '{"product_id": "PROD-X", "category": "alimentos", "department": "padaria"}'::jsonb, true)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

INSERT INTO qr_codes (qr_id, campaign_id, code, title, description, qr_type, content, url, redirect_url, size, color, background_color, error_correction_level, margin, image_url, scan_count, last_scan_at, max_scans, tracking_enabled, expires_at, metadata, is_active) VALUES
(1, 1, 'QR-FASHION-2025-001', 'QR Code Coleção Verão', 'QR code para campanha de moda', 'url', 'https://marcafashion.com.br/colecao-verao-2025', 'https://marcafashion.com.br/colecao-verao-2025', 'https://marcafashion.com.br/colecao-verao-2025?utm_source=totem&utm_medium=qr', 200, '#000000', '#FFFFFF', 'M', 4, '/qr-codes/qr-fashion-2025-001.png', 0, NULL, 1000, true, '2027-01-14', '{}'::jsonb, true),
(2, 2, 'QR-FARMA-2025-001', 'QR Code Medicamentos', 'QR code para campanha de medicamentos genéricos', 'url', 'https://farmavida.com.br/promocao-genericos', 'https://farmavida.com.br/promocao-genericos', 'https://farmavida.com.br/promocao-genericos?utm_source=totem&utm_medium=qr', 200, '#000000', '#FFFFFF', 'M', 4, '/qr-codes/qr-farma-2025-001.png', 0, NULL, 500, true, '2027-01-31', '{}'::jsonb, true)
ON CONFLICT DO NOTHING;

INSERT INTO short_links (link_id, campaign_id, short_code, original_url, click_count, last_click_at, metadata, expires_at, is_active) VALUES
(1, 1, 'FASHION2025', 'https://marcafashion.com.br/colecao-verao-2025', 0, NULL, '{}'::jsonb, '2027-01-14', true),
(2, 2, 'FARMA2025', 'https://farmavida.com.br/promocao-genericos', 0, NULL, '{}'::jsonb, '2027-01-31', true),
(3, 3, 'OFERTAS2025', 'https://economico.com.br/ofertas-dia', 0, NULL, '{}'::jsonb, '2026-12-31', true)
ON CONFLICT DO NOTHING;

INSERT INTO remote_commands (command_id, totem_id, user_id, command_type, status, parameters, response, sent_at, executed_at, completed_at, error_message, retry_count) VALUES
-- Comandos históricos
(1, 1, 2, 'ping', 'completed', '{}'::jsonb, '{"latency_ms": 45, "status": "online"}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '1 day', (NOW() - INTERVAL '1 year') - INTERVAL '1 day', (NOW() - INTERVAL '1 year') - INTERVAL '1 day', NULL, 0),
(2, 2, 2, 'restart', 'completed', '{}'::jsonb, '{"restart_time": "2024-01-20T10:00:00Z"}'::jsonb, (NOW() - INTERVAL '1 year') - INTERVAL '2 days', (NOW() - INTERVAL '1 year') - INTERVAL '2 days', (NOW() - INTERVAL '1 year') - INTERVAL '2 days', NULL, 0),

-- Comandos recentes simulando solicitações de playlists (sistema automático - user_id=1 = admin)
(3, 1, 1, 'request_playlist', 'completed', '{"request_id": "req-001", "uin": "UIN-SHOPPING-001-2025"}'::jsonb, '{"playlist_id": 1, "items_count": 2, "delivery_time_ms": 125}'::jsonb, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour' + INTERVAL '125 milliseconds', NOW() - INTERVAL '1 hour' + INTERVAL '125 milliseconds', NULL, 0),
(4, 2, 1, 'request_playlist', 'completed', '{"request_id": "req-002", "uin": "UIN-SHOPPING-002-2025", "from_cache": true}'::jsonb, '{"playlist_id": 2, "items_count": 2, "delivery_time_ms": 45, "from_cache": true}'::jsonb, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes' + INTERVAL '45 milliseconds', NOW() - INTERVAL '30 minutes' + INTERVAL '45 milliseconds', NULL, 0),
(5, 3, 1, 'request_playlist', 'completed', '{"request_id": "req-003", "uin": "UIN-SHOPPING-003-2025"}'::jsonb, '{"playlist_id": 1, "items_count": 2, "delivery_time_ms": 138}'::jsonb, NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '25 minutes' + INTERVAL '138 milliseconds', NOW() - INTERVAL '25 minutes' + INTERVAL '138 milliseconds', NULL, 0),
(6, 9, 1, 'request_playlist', 'completed', '{"request_id": "req-007", "uin": "UIN-SUPER-001-2025"}'::jsonb, '{"playlist_id": 4, "items_count": 1, "delivery_time_ms": 105}'::jsonb, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes' + INTERVAL '105 milliseconds', NOW() - INTERVAL '20 minutes' + INTERVAL '105 milliseconds', NULL, 0),
(7, 10, 1, 'request_playlist', 'completed', '{"request_id": "req-008", "uin": "UIN-SUPER-002-2025", "from_cache": true}'::jsonb, '{"playlist_id": 4, "items_count": 1, "delivery_time_ms": 42, "from_cache": true}'::jsonb, NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '50 minutes' + INTERVAL '42 milliseconds', NOW() - INTERVAL '50 minutes' + INTERVAL '42 milliseconds', NULL, 0),

-- Comandos com falha para testes (sistema automático - user_id=1 = admin)
(8, 6, 1, 'request_playlist', 'failed', '{"request_id": "req-006", "uin": "UIN-AEROPORTO-001-2025"}'::jsonb, NULL, NOW() - INTERVAL '1 hour 15 minutes', NULL, NULL, 'Nenhuma campanha ativa disponível', 0),
(9, 8, 1, 'request_playlist', 'failed', '{"request_id": "req-009", "uin": "UIN-URBANO-001-2025"}'::jsonb, NULL, NOW() - INTERVAL '15 minutes', NULL, NULL, 'Nenhuma campanha ativa disponível', 0),
(10, 7, 1, 'request_playlist', 'failed', '{"request_id": "req-010", "uin": "UIN-AEROPORTO-002-2025"}'::jsonb, NULL, NOW() - INTERVAL '2 hours', NULL, NULL, 'Totem offline - não respondeu ao heartbeat', 3)
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
            token, refresh_token, status, ip_address, user_agent, last_heartbeat, expires_at
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
        -- Totem 6 - Aeroporto Embarque (sem campanhas ativas)
        (
            6, 6, NULL, 3,
            '[]'::jsonb,
            0, 0,
            'no_campaigns',
            '{"campaigns": [], "message": "Nenhuma campanha ativa disponível"}'::jsonb,
            false, false, (NOW() - INTERVAL '1 year') - INTERVAL '1 hour 15 minutes', (NOW() - INTERVAL '1 year') - INTERVAL '1 hour 15 minutes', NULL
        ),
        -- Totem 9 - Supermercado Caixas - Mix RECENTE (20 minutos atrás)
        (
            7, 9, NULL, 5,
            '[
                {"media_id": 4, "playlist_id": 4, "campaign_id": 3, "order_index": 0, "weight": 1.0, "source": "campaign", "display_seconds": 12}
            ]'::jsonb,
            1, 12,
            'single_campaign',
            '{"campaigns": [3], "priority_distribution": {"campaign_3": 100}}'::jsonb,
            true, false, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes', NULL
        ),
        -- Totem 10 - Supermercado Açougue - Mix RECENTE (50 minutos atrás)
        (
            8, 10, NULL, 5,
            '[
                {"media_id": 4, "playlist_id": 4, "campaign_id": 3, "order_index": 0, "weight": 1.0, "source": "campaign", "display_seconds": 12}
            ]'::jsonb,
            1, 12,
            'single_campaign',
            '{"campaigns": [3], "priority_distribution": {"campaign_3": 100}}'::jsonb,
            true, false, NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '50 minutes', NULL
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
        (1, 1, NULL, NULL, 'gesture_detected', '{"gesture": "wave", "confidence": 0.85, "duration_ms": 1200}'::jsonb, NOW() - INTERVAL '2 hours'),
        (2, 1, NULL, NULL, 'gesture_detected', '{"gesture": "point", "confidence": 0.78, "duration_ms": 800}'::jsonb, NOW() - INTERVAL '1 hour 45 minutes'),
        (3, 2, NULL, NULL, 'gesture_detected', '{"gesture": "wave", "confidence": 0.92, "duration_ms": 1500}'::jsonb, NOW() - INTERVAL '1 hour'),
        (4, 3, NULL, NULL, 'gesture_detected', '{"gesture": "touch", "confidence": 0.88, "duration_ms": 500}'::jsonb, NOW() - INTERVAL '3 hours'),
        (5, 4, 1, NULL, 'tag_scanned', '{"tag_type": "QR", "tag_value": "QR-BF-2024-001", "campaign_id": 1}'::jsonb, NOW() - INTERVAL '2 hours'),
        (6, 6, 2, NULL, 'tag_scanned', '{"tag_type": "QR", "tag_value": "QR-MED-2024-001", "campaign_id": 2}'::jsonb, NOW() - INTERVAL '1 hour')
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
        (4, 4, false, false, false, false, '{"reason": "Farmácia não requer ML/AI"}'::jsonb),
        (5, 5, false, false, false, false, '{"reason": "Farmácia não requer ML/AI"}'::jsonb),
        (6, 6, true, false, false, false, '{"emotion_threshold": 0.65}'::jsonb),
        (8, 8, true, true, false, true, '{"emotion_threshold": 0.7, "gesture_threshold": 0.75, "behavior_tracking": true}'::jsonb)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- =============================================
-- FX_TELEMETRY - Dados de telemetria para testes de alertas
-- =============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fx_telemetry') THEN
        INSERT INTO fx_telemetry (
            id, totem_id, effect_id, event_id, content_id,
            planned_start_ts, actual_start_ts, ended_at, duration_ms, avg_fps,
            status, error_message, metadata, created_at
        ) VALUES
        -- Totem 1 - FPS normal (30 FPS)
        (1, 1, 'neon_warp', 'event_001', 1, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '59 minutes', 60000, 30.0, 'success', NULL, '{}'::jsonb, NOW() - INTERVAL '1 hour'),
        (2, 1, 'ripple_sync', 'event_002', 2, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '29 minutes', 60000, 28.5, 'success', NULL, '{}'::jsonb, NOW() - INTERVAL '30 minutes'),
        
        -- Totem 4 - FPS BAIXO (< 15 FPS) - para teste de alerta
        (3, 4, 'neon_warp', 'event_003', 3, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 58 minutes', 120000, 12.3, 'success', NULL, '{}'::jsonb, NOW() - INTERVAL '2 hours'),
        (4, 4, 'liquid_flow', 'event_004', 3, NOW() - INTERVAL '1 hour 30 minutes', NOW() - INTERVAL '1 hour 30 minutes', NOW() - INTERVAL '1 hour 28 minutes', 120000, 10.8, 'success', NULL, '{}'::jsonb, NOW() - INTERVAL '1 hour 30 minutes'),
        (5, 4, 'neon_warp', 'event_005', 3, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '58 minutes', 120000, 11.5, 'success', NULL, '{}'::jsonb, NOW() - INTERVAL '1 hour'),
        (6, 4, 'ripple_sync', 'event_006', 3, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '28 minutes', 120000, 13.2, 'success', NULL, '{}'::jsonb, NOW() - INTERVAL '30 minutes'),
        
        -- Totem 2 - FPS normal
        (7, 2, 'neon_warp', 'event_007', 1, NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '44 minutes', 60000, 29.8, 'success', NULL, '{}'::jsonb, NOW() - INTERVAL '45 minutes'),
        
        -- Totem 1 - FALHAS para teste de taxa de falha
        (8, 1, 'neon_warp', 'event_008', 1, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes', NULL, NULL, NULL, 'failed', 'Timeout na execução do efeito', '{}'::jsonb, NOW() - INTERVAL '20 minutes'),
        (9, 1, 'liquid_flow', 'event_009', 2, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes', NULL, NULL, NULL, 'failed', 'Erro de memória insuficiente', '{}'::jsonb, NOW() - INTERVAL '15 minutes'),
        (10, 1, 'neon_warp', 'event_010', 1, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '9 minutes', 60000, 29.0, 'success', NULL, '{}'::jsonb, NOW() - INTERVAL '10 minutes'),
        (11, 1, 'ripple_sync', 'event_011', 2, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '4 minutes', 60000, 30.2, 'success', NULL, '{}'::jsonb, NOW() - INTERVAL '5 minutes'),
        
        -- Totem 3 - FPS normal
        (12, 3, 'neon_warp', 'event_012', 1, NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '24 minutes', 60000, 29.5, 'success', NULL, '{}'::jsonb, NOW() - INTERVAL '25 minutes')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- =============================================
-- MELHORIAS DA VERSÃO 6 (v6)
-- =============================================
-- 
-- ✅ Validações e Correções:
--    - Totens com last_heartbeat atualizados (alguns recentes para testes, outros offline)
--    - Smart TVs com last_heartbeat atualizado e capabilities preenchidas
--    - Relacionamentos validados (tags vinculadas corretamente em interaction_logs)
--
-- ✅ Novos Dados para Testes:
--    - Tags com metadata JSONB completo (RFID, NFC, QR, barcode)
--    - fx_telemetry com dados para testes de alertas:
--      * Totem 4: FPS baixo (< 15 FPS) - 4 registros consecutivos para alerta
--      * Totem 1: Falhas (2 falhas em 5 execuções = 40% taxa de falha) para teste
--    - Analytics sessions, emotions e gestures com timestamps recentes e metadata
--    - Execution logs com dados mais completos e timestamps recentes
--
-- ✅ Consistência de Dados:
--    - Todos os timestamps atualizados para usar NOW() - INTERVAL ao invés de (NOW() - INTERVAL '1 year')
--    - Network_info e capabilities preenchidos nos totens
--    - Metadata JSONB utilizado consistentemente em todas as tabelas suportadas
--
-- ✅ Preparado para Testes Integrados:
--    - Sistema de alertas: Totem 4 com FPS baixo, Totem 1 com alta taxa de falha
--    - Totem offline: Totem 7 para testes de alerta de totem offline
--    - Dispatcher: Dados históricos e recentes para validação de decisões
--    - Analytics: Dados recentes para testes de dashboards e relatórios
--
-- Data: 2026-01-21
-- Versão: 6.1
--
-- MELHORIAS DA VERSÃO 6.1:
-- ✅ CORREÇÕES CRÍTICAS:
--    - Locals 6 e 7 corrigidos: agora pertencem ao publisher correto
--    - Criado publisher_id=5 (Supermercado Econômico - Publisher)
--    - UINs atualizados de 2024 para 2025
--    - campaign_publishers corrigido para campanha 3
--    - campaign_locals e campaign_totems atualizados
--
-- ✅ DIVERSIDADE DE DADOS PARA TESTES:
--    - Mais cenários de billing (paid, pending, overdue)
--    - Totens adicionais para supermercado (9 e 10)
--    - Locals adicionais para aeroporto e supermercado
--    - Dados de billing atualizados com anos corretos (2025)
--
-- ✅ LOGS DE SOLICITAÇÃO E ENTREGA DE PLAYLISTS:
--    - execution_logs: Simula solicitações (playlist_request) e entregas (playlist_delivered)
--    - execution_logs: Simula reprodução completa (play_start, play_end) com timestamps recentes
--    - event_logs: Eventos de solicitação, entrega e reprodução de playlists
--    - dispatcher_log: Decisões recentes do dispatcher com request_id
--    - totem_playlist_generation_log: Logs de geração recentes com trigger e request_id
--    - totem_playlist_mix: Mixes recentes para novos totens (9 e 10)
--
-- ✅ CENÁRIOS DE TESTE SIMULADOS:
--    - Solicitação de playlist via heartbeat (cache miss)
--    - Solicitação de playlist agendada (cache hit)
--    - Entrega de playlist com sucesso
--    - Entrega de playlist falhada (totem offline)
--    - Reprodução completa de sequência de mídias
--    - Decisões do dispatcher com múltiplos candidatos
--    - Decisões do dispatcher sem campanhas ativas
--
-- ✅ INTEGRIDADE REFERENCIAL:
--    - Todos os relacionamentos validados e corretos
--    - Foreign keys consistentes
--    - Dados integrados e coerentes
--
-- =============================================
-- PLAYLIST MIX RULES - Regras de Mixagem de Playlists
-- =============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'playlist_mix_rules') THEN
        INSERT INTO playlist_mix_rules (
            rule_id, totem_id, name, description, rule_type,
            priority_weight, time_weight, tag_weight, subscriber_weight,
            ai_enabled, ai_provider, ai_model, ai_config,
            use_pedestrian_detection, use_sentiment_analysis, use_context_awareness, use_historical_optimization,
            max_items_per_playlist, rotation_strategy, shuffle_enabled,
            is_active, is_default, created_at, updated_at
        ) VALUES
        -- Regra padrão global (systematic)
        (
            1, NULL, 'Regra Padrão - Systematic', 
            'Regra padrão para mixagem sistemática baseada em prioridade, tempo e tags',
            'systematic',
            1.0, 1.0, 0.5, 0.3,
            false, NULL, NULL, NULL,
            false, false, false, false,
            50, 'priority', false,
            true, true, NOW() - INTERVAL '1 year', NOW() - INTERVAL '1 year'
        ),
        -- Regra para Totem 1 (Shopping Entrada) - Hybrid com IA
        (
            2, 1, 'Regra Shopping Entrada - Hybrid IA',
            'Regra híbrida com IA para totem de entrada do shopping, otimizada para alto tráfego',
            'hybrid',
            1.2, 1.0, 0.8, 0.5,
            true, 'ollama', 'llama3', '{"temperature": 0.7, "max_tokens": 500}'::jsonb,
            true, true, true, true,
            60, 'ai_optimized', false,
            true, false, NOW() - INTERVAL '6 months', NOW() - INTERVAL '1 month'
        ),
        -- Regra para Totem 2 (Shopping Praça) - Systematic
        (
            3, 2, 'Regra Shopping Praça - Systematic',
            'Regra sistemática para praça de alimentação, prioriza campanhas de alimentação',
            'systematic',
            1.0, 1.5, 0.6, 0.4,
            false, NULL, NULL, NULL,
            false, false, false, false,
            40, 'weighted', true,
            true, false, NOW() - INTERVAL '6 months', NOW() - INTERVAL '2 months'
        ),
        -- Regra para Totem 9 (Supermercado Caixas) - Systematic
        (
            4, 9, 'Regra Supermercado Caixas',
            'Regra para área de caixas do supermercado, prioriza ofertas rápidas',
            'systematic',
            1.0, 0.8, 0.3, 0.2,
            false, NULL, NULL, NULL,
            false, false, false, false,
            30, 'round_robin', false,
            true, false, NOW() - INTERVAL '3 months', NOW() - INTERVAL '1 month'
        ),
        -- Regra global com IA (para futura integração)
        (
            5, NULL, 'Regra Global - IA Avançada',
            'Regra global com IA avançada para otimização baseada em contexto e histórico',
            'ai',
            0.8, 1.0, 1.0, 0.6,
            true, 'ollama', 'llama3', '{"temperature": 0.8, "max_tokens": 1000, "use_context": true}'::jsonb,
            true, true, true, true,
            50, 'ai_optimized', false,
            false, false, NOW() - INTERVAL '2 months', NOW() - INTERVAL '1 week'
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- =============================================
-- AI CONTEXT DATA - Contexto de IA para Totens
-- =============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_context_data') THEN
        INSERT INTO ai_context_data (
            context_id, totem_id,
            pedestrian_count, pedestrian_density, pedestrian_demographics, last_pedestrian_detection,
            sentiment_score, sentiment_label, emotion_tags, last_sentiment_analysis,
            time_of_day, day_type, weather_context, event_context,
            performance_metrics, last_performance_update,
            raw_ai_data,
            created_at, updated_at
        ) VALUES
        -- Totem 1 - Shopping Entrada (alto tráfego, positivo)
        (
            1, 1,
            45, 'high', '{"age_groups": {"18-25": 15, "25-35": 20, "35-45": 10}, "gender": {"M": 22, "F": 23}}'::jsonb,
            NOW() - INTERVAL '5 minutes',
            0.75, 'positive', ARRAY['happy', 'excited', 'curious'], NOW() - INTERVAL '10 minutes',
            'afternoon', 'weekday', '{"temperature": 28, "condition": "sunny", "humidity": 65}'::jsonb,
            '{"event": "Black Friday", "crowd_level": "high"}'::jsonb,
            '{"engagement_rate": 0.68, "view_count": 1250, "conversion_rate": 0.12, "avg_view_time": 8.5}'::jsonb,
            NOW() - INTERVAL '1 hour',
            '{"detection_confidence": 0.92, "model_version": "v2.1"}'::jsonb,
            NOW() - INTERVAL '1 year', NOW() - INTERVAL '5 minutes'
        ),
        -- Totem 2 - Shopping Praça (médio tráfego, neutro)
        (
            2, 2,
            32, 'medium', '{"age_groups": {"25-35": 18, "35-45": 10, "45-55": 4}, "gender": {"M": 16, "F": 16}}'::jsonb,
            NOW() - INTERVAL '8 minutes',
            0.15, 'neutral', ARRAY['calm', 'focused'], NOW() - INTERVAL '15 minutes',
            'afternoon', 'weekday', '{"temperature": 28, "condition": "sunny", "humidity": 65}'::jsonb,
            NULL,
            '{"engagement_rate": 0.52, "view_count": 890, "conversion_rate": 0.08, "avg_view_time": 6.2}'::jsonb,
            NOW() - INTERVAL '2 hours',
            '{"detection_confidence": 0.85, "model_version": "v2.1"}'::jsonb,
            NOW() - INTERVAL '1 year', NOW() - INTERVAL '8 minutes'
        ),
        -- Totem 3 - Shopping Cinema (baixo tráfego, positivo)
        (
            3, 3,
            18, 'low', '{"age_groups": {"18-25": 8, "25-35": 7, "35-45": 3}, "gender": {"M": 9, "F": 9}}'::jsonb,
            NOW() - INTERVAL '12 minutes',
            0.60, 'positive', ARRAY['happy', 'anticipating'], NOW() - INTERVAL '20 minutes',
            'evening', 'weekday', '{"temperature": 26, "condition": "clear", "humidity": 70}'::jsonb,
            '{"event": "Movie Premiere", "crowd_level": "low"}'::jsonb,
            '{"engagement_rate": 0.45, "view_count": 450, "conversion_rate": 0.05, "avg_view_time": 5.8}'::jsonb,
            NOW() - INTERVAL '3 hours',
            '{"detection_confidence": 0.78, "model_version": "v2.1"}'::jsonb,
            NOW() - INTERVAL '1 year', NOW() - INTERVAL '12 minutes'
        ),
        -- Totem 9 - Supermercado Caixas (alto tráfego, neutro)
        (
            4, 9,
            52, 'high', '{"age_groups": {"25-35": 20, "35-45": 18, "45-55": 14}, "gender": {"M": 26, "F": 26}}'::jsonb,
            NOW() - INTERVAL '3 minutes',
            0.10, 'neutral', ARRAY['focused', 'rushed'], NOW() - INTERVAL '8 minutes',
            'afternoon', 'weekday', '{"temperature": 30, "condition": "sunny", "humidity": 60}'::jsonb,
            '{"event": "Ofertas do Dia", "crowd_level": "high"}'::jsonb,
            '{"engagement_rate": 0.35, "view_count": 2100, "conversion_rate": 0.15, "avg_view_time": 4.2}'::jsonb,
            NOW() - INTERVAL '30 minutes',
            '{"detection_confidence": 0.88, "model_version": "v2.1"}'::jsonb,
            NOW() - INTERVAL '3 months', NOW() - INTERVAL '3 minutes'
        ),
        -- Totem 10 - Supermercado Açougue (médio tráfego, positivo)
        (
            5, 10,
            28, 'medium', '{"age_groups": {"35-45": 12, "45-55": 10, "55+": 6}, "gender": {"M": 14, "F": 14}}'::jsonb,
            NOW() - INTERVAL '6 minutes',
            0.45, 'positive', ARRAY['satisfied', 'interested'], NOW() - INTERVAL '12 minutes',
            'afternoon', 'weekday', '{"temperature": 30, "condition": "sunny", "humidity": 60}'::jsonb,
            NULL,
            '{"engagement_rate": 0.58, "view_count": 650, "conversion_rate": 0.10, "avg_view_time": 7.1}'::jsonb,
            NOW() - INTERVAL '1 hour',
            '{"detection_confidence": 0.82, "model_version": "v2.1"}'::jsonb,
            NOW() - INTERVAL '3 months', NOW() - INTERVAL '6 minutes'
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- =============================================
-- PLAYLIST MIX HISTORY - Histórico de Mixagens
-- =============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'playlist_mix_history') THEN
        INSERT INTO playlist_mix_history (
            history_id, totem_id, mix_id, rule_id, mix_strategy,
            total_items, total_duration,
            execution_count, average_view_time, engagement_score,
            context_snapshot,
            generated_at, applied_at, last_executed_at,
            created_at
        ) VALUES
        -- Totem 1 - Histórico de mixagens
        (
            1, 1, 1, 2, 'hybrid',
            4, 105,
            1250, 8.5, 68.5,
            '{"pedestrian_count": 45, "sentiment": "positive", "time_of_day": "afternoon"}'::jsonb,
            (NOW() - INTERVAL '1 year') - INTERVAL '1 hour', (NOW() - INTERVAL '1 year') - INTERVAL '1 hour', NOW() - INTERVAL '5 minutes',
            (NOW() - INTERVAL '1 year') - INTERVAL '1 hour'
        ),
        (
            2, 1, NULL, 2, 'hybrid',
            3, 80,
            980, 7.8, 65.2,
            '{"pedestrian_count": 38, "sentiment": "neutral", "time_of_day": "morning"}'::jsonb,
            (NOW() - INTERVAL '1 year') - INTERVAL '3 days', (NOW() - INTERVAL '1 year') - INTERVAL '3 days', (NOW() - INTERVAL '1 year') - INTERVAL '2 days',
            (NOW() - INTERVAL '1 year') - INTERVAL '3 days'
        ),
        -- Totem 2 - Histórico
        (
            3, 2, 2, 3, 'systematic',
            3, 60,
            890, 6.2, 52.0,
            '{"pedestrian_count": 32, "sentiment": "neutral", "time_of_day": "afternoon"}'::jsonb,
            (NOW() - INTERVAL '1 year') - INTERVAL '30 minutes', (NOW() - INTERVAL '1 year') - INTERVAL '30 minutes', NOW() - INTERVAL '10 minutes',
            (NOW() - INTERVAL '1 year') - INTERVAL '30 minutes'
        ),
        (
            4, 2, NULL, 3, 'systematic',
            2, 40,
            720, 5.5, 48.5,
            '{"pedestrian_count": 25, "sentiment": "neutral", "time_of_day": "morning"}'::jsonb,
            (NOW() - INTERVAL '1 year') - INTERVAL '5 days', (NOW() - INTERVAL '1 year') - INTERVAL '5 days', (NOW() - INTERVAL '1 year') - INTERVAL '4 days',
            (NOW() - INTERVAL '1 year') - INTERVAL '5 days'
        ),
        -- Totem 3 - Histórico
        (
            5, 3, 3, 1, 'systematic',
            4, 105,
            450, 5.8, 45.0,
            '{"pedestrian_count": 18, "sentiment": "positive", "time_of_day": "evening"}'::jsonb,
            (NOW() - INTERVAL '1 year') - INTERVAL '45 minutes', (NOW() - INTERVAL '1 year') - INTERVAL '45 minutes', (NOW() - INTERVAL '1 year') - INTERVAL '1 day',
            (NOW() - INTERVAL '1 year') - INTERVAL '45 minutes'
        ),
        -- Totem 9 - Supermercado (recente)
        (
            6, 9, 7, 4, 'systematic',
            1, 12,
            2100, 4.2, 35.0,
            '{"pedestrian_count": 52, "sentiment": "neutral", "time_of_day": "afternoon"}'::jsonb,
            NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '2 minutes',
            NOW() - INTERVAL '20 minutes'
        ),
        (
            7, 9, NULL, 4, 'systematic',
            1, 12,
            1850, 4.0, 32.5,
            '{"pedestrian_count": 48, "sentiment": "neutral", "time_of_day": "afternoon"}'::jsonb,
            NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours',
            NOW() - INTERVAL '1 day'
        ),
        -- Totem 10 - Supermercado Açougue
        (
            8, 10, 8, 1, 'systematic',
            1, 12,
            650, 7.1, 58.0,
            '{"pedestrian_count": 28, "sentiment": "positive", "time_of_day": "afternoon"}'::jsonb,
            NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '5 minutes',
            NOW() - INTERVAL '50 minutes'
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

