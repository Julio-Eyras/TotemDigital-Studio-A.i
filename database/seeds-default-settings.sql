-- =============================================
-- Seeds para Configurações Padrão do Sistema
-- =============================================
-- Este arquivo insere configurações padrão necessárias para o funcionamento do sistema
-- Inclui configurações de logs, mídia e outras configurações essenciais
-- =============================================

-- =============================================
-- CONFIGURAÇÕES DE LOGS
-- =============================================

INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public, is_editable, default_value, validation, options) 
VALUES
  -- Configurações de rotação de logs
  (
    'log.rotation.max_size',
    '100MB',
    'string',
    'logs',
    'Tamanho máximo de cada arquivo de log antes de rotacionar (ex: 100MB, 1GB)',
    false,
    true,
    '100MB',
    '^\d+(\.\d+)?\s*(B|KB|MB|GB|TB)$',
    NULL
  ),
  (
    'log.rotation.max_days',
    '30',
    'number',
    'logs',
    'Número de dias para manter logs antigos antes de excluir',
    false,
    true,
    '30',
    '^[1-9]\d*$',
    NULL
  ),
  (
    'log.rotation.min_free_space',
    '1GB',
    'string',
    'logs',
    'Espaço livre mínimo em disco antes de iniciar rotação agressiva (ex: 1GB, 500MB)',
    false,
    true,
    '1GB',
    '^\d+(\.\d+)?\s*(B|KB|MB|GB|TB)$',
    NULL
  ),
  (
    'log.level',
    'info',
    'string',
    'logs',
    'Nível de log (error, warn, info, debug)',
    false,
    true,
    'info',
    '^(error|warn|info|debug)$',
    '["error", "warn", "info", "debug"]'
  ),
  (
    'log.rotation.enabled',
    'true',
    'boolean',
    'logs',
    'Habilitar rotação automática de logs',
    false,
    true,
    'true',
    NULL,
    NULL
  ),
  (
    'log.rotation.compress',
    'true',
    'boolean',
    'logs',
    'Compactar logs antigos após rotação',
    false,
    true,
    'true',
    NULL,
    NULL
  ),
  (
    'log.alerts.enabled',
    'true',
    'boolean',
    'logs',
    'Habilitar alertas administrativos sobre rotação de logs',
    false,
    true,
    'true',
    NULL,
    NULL
  ),
  (
    'log.alerts.email',
    'false',
    'boolean',
    'logs',
    'Enviar alertas por email (requer configuração de email)',
    false,
    true,
    'false',
    NULL,
    NULL
  ),
  (
    'log.directory',
    '/opt/smart-signage/Logs',
    'string',
    'logs',
    'Diretório onde os logs são armazenados',
    false,
    true,
    '/opt/smart-signage/Logs',
    '^/.+$',
    NULL
  )
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description,
  is_editable = EXCLUDED.is_editable,
  validation = EXCLUDED.validation,
  options = EXCLUDED.options,
  updated_at = CURRENT_TIMESTAMP;

-- =============================================
-- CONFIGURAÇÕES DE INTERFACE / COMBOS
-- =============================================

INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public, is_editable, default_value, validation, options)
VALUES
  (
    'ui.combo.subscribers.status_filter',
    '[{"value":"active","label":"Ativos","activeOnly":true},{"value":"all","label":"Todos"}]',
    'json',
    'ui',
    'Opções do combo Status na tela de Anunciantes. Use activeOnly=true para filtrar apenas ativos; sem activeOnly lista todos.',
    true,
    true,
    '[{"value":"active","label":"Ativos","activeOnly":true},{"value":"all","label":"Todos"}]',
    NULL,
    NULL
  )
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description,
  is_editable = EXCLUDED.is_editable,
  validation = EXCLUDED.validation,
  options = EXCLUDED.options,
  default_value = EXCLUDED.default_value,
  setting_type = EXCLUDED.setting_type,
  category = EXCLUDED.category,
  is_public = EXCLUDED.is_public,
  updated_at = CURRENT_TIMESTAMP;

-- =============================================
-- CONFIGURAÇÕES DO DISPATCHER (DB-first / Timeline)
-- =============================================

INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public, is_editable, default_value, validation, options)
VALUES
  (
    'dispatcher.default_mode',
    'MIXED',
    'string',
    'dispatcher',
    'Modo padrão do dispatcher: MIXED (gera sequência mixada por janela) ou SINGLE_WINNER (1 vencedor por instante).',
    false,
    true,
    'MIXED',
    '^(MIXED|SINGLE_WINNER)$',
    '["MIXED","SINGLE_WINNER"]'
  ),
  (
    'dispatcher.window_seconds',
    '600',
    'number',
    'dispatcher',
    'Tamanho padrão da janela do dispatcher em segundos (ex.: 600 = 10 minutos).',
    false,
    true,
    '600',
    '^[1-9]\d*$',
    NULL
  ),
  (
    'dispatcher.max_items_per_window',
    '300',
    'number',
    'dispatcher',
    'Limite máximo de itens gerados por janela (cap de segurança para payload/performance).',
    false,
    true,
    '300',
    '^[1-9]\d*$',
    NULL
  ),
  (
    'dispatcher.inner_rotation',
    'RR_CAMPAIGN_PLAYLISTS',
    'string',
    'dispatcher',
    'Estratégia determinística dentro da campanha: round-robin entre playlists da campanha.',
    false,
    true,
    'RR_CAMPAIGN_PLAYLISTS',
    '^(RR_CAMPAIGN_PLAYLISTS)$',
    '["RR_CAMPAIGN_PLAYLISTS"]'
  ),
  (
    'dispatcher.inner_item_rotation',
    'RR_PLAYLIST_ITEMS',
    'string',
    'dispatcher',
    'Estratégia determinística dentro da playlist: round-robin entre itens/mídias da playlist.',
    false,
    true,
    'RR_PLAYLIST_ITEMS',
    '^(RR_PLAYLIST_ITEMS)$',
    '["RR_PLAYLIST_ITEMS"]'
  ),
  (
    'dispatcher.seed_strategy',
    'TIME_BUCKET_HASH',
    'string',
    'dispatcher',
    'Estratégia de seed para replay determinístico (ex.: hash(totem_id, bucket_start, context_snapshot_hash)).',
    false,
    true,
    'TIME_BUCKET_HASH',
    '^(TIME_BUCKET_HASH)$',
    '["TIME_BUCKET_HASH"]'
  )
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description,
  is_editable = EXCLUDED.is_editable,
  validation = EXCLUDED.validation,
  options = EXCLUDED.options,
  default_value = EXCLUDED.default_value,
  setting_type = EXCLUDED.setting_type,
  category = EXCLUDED.category,
  is_public = EXCLUDED.is_public,
  updated_at = CURRENT_TIMESTAMP;

-- =============================================
-- CONFIGURAÇÕES DE MÍDIA
-- =============================================

INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public, is_editable, default_value, validation, options) 
VALUES
  (
    'media.upload.max_size',
    '2GB',
    'string',
    'media',
    'Tamanho máximo de arquivo para upload (0 = sem limite no Multer; use 2GB como teto operacional padrão)',
    false,
    true,
    '2GB',
    '^(0|\\d+(\\.\\d+)?\\s*(B|KB|MB|GB|TB))$',
    NULL
  ),
  (
    'media.upload.nginx_max_size',
    '2G',
    'string',
    'media',
    'Limite máximo do Nginx para upload (client_max_body_size)',
    false,
    true,
    '2G',
    '^(0|\\d+(\\.\\d+)?\\s*(B|K|M|G|T))$',
    NULL
  ),
  (
    'media.upload.express_limit',
    '2gb',
    'string',
    'media',
    'Limite de body do Express/Multer para upload (alinhar ao max_size)',
    false,
    true,
    '2gb',
    NULL,
    NULL
  ),
  (
    'media.upload.proxy_timeout',
    '300',
    'number',
    'media',
    'Timeout do proxy para uploads longos (segundos)',
    false,
    true,
    '300',
    '^[0-9]+$',
    NULL
  ),
  (
    'media.upload.allowed_types',
    'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,video/quicktime,audio/mp3,audio/wav,audio/ogg',
    'string',
    'media',
    'Tipos MIME permitidos (lista separada por vírgula; mesmo formato lido pelo backend em runtime)',
    false,
    true,
    'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,video/quicktime,audio/mp3,audio/wav,audio/ogg',
    NULL,
    NULL
  ),
  (
    'media.storage.path',
    '/opt/smart-signage/public/assets/uploads',
    'string',
    'media',
    'Caminho base para armazenamento de mídias',
    false,
    true,
    '/opt/smart-signage/public/assets/uploads',
    '^/.+$',
    NULL
  ),
  (
    'media.storage.quota_per_client',
    '5GB',
    'string',
    'media',
    'Cota global de referência por cliente (string ex.: 5GB). Use 0 ou 0GB para ilimitado. O enforcement de upload segue limits.defaults.storage_gb + planos (getMaxLimits).',
    false,
    true,
    '5GB',
    '^\d+(\.\d+)?\s*(B|KB|MB|GB|TB)$',
    NULL
  ),
  (
    'media.storage.auto_cleanup',
    'false',
    'boolean',
    'media',
    'Ativar limpeza automática de arquivos antigos no diretório de mídias',
    false,
    true,
    'false',
    NULL,
    NULL
  ),
  (
    'media.storage.cleanup_days',
    '90',
    'number',
    'media',
    'Idade mínima (dias) para arquivos serem candidatos à limpeza automática',
    false,
    true,
    '90',
    '^[0-9]+$',
    NULL
  )
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description,
  is_editable = EXCLUDED.is_editable,
  validation = EXCLUDED.validation,
  options = EXCLUDED.options,
  updated_at = CURRENT_TIMESTAMP;

-- =============================================
-- LIMITES PADRÃO (Pro e Compact): inteiro >= 0; 0 = ilimitado quando aplicável.
-- Usados quando o JSON limits do plano não define a chave (merge em getMaxLimits).
-- Valores podem ser sobrescritos pelo install (variáveis LIMITS_DEFAULT_*).
-- =============================================

INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public, is_editable, default_value, validation, options)
VALUES
  (
    'limits.defaults.storage_gb',
    '0',
    'number',
    'limits',
    'Armazenamento (GB) padrão quando o plano não define storage_gb ou sem contrato ativo. 0 = ilimitado.',
    false,
    true,
    '0',
    '^[0-9]+$',
    NULL
  ),
  (
    'limits.defaults.campaigns',
    '0',
    'number',
    'limits',
    'Campanhas padrão quando o plano omite campaigns ou sem contrato ativo. 0 = ilimitado.',
    false,
    true,
    '0',
    '^[0-9]+$',
    NULL
  ),
  (
    'limits.defaults.totems',
    '0',
    'number',
    'limits',
    'Totens padrão quando o plano omite totems ou sem contrato ativo. 0 = ilimitado.',
    false,
    true,
    '0',
    '^[0-9]+$',
    NULL
  ),
  (
    'limits.defaults.medias',
    '0',
    'number',
    'limits',
    'Mídias padrão quando o plano omite medias em limits. 0 = ilimitado (recomendado).',
    false,
    true,
    '0',
    '^[0-9]+$',
    NULL
  ),
  (
    'limits.defaults.playlists',
    '0',
    'number',
    'limits',
    'Playlists padrão quando o plano omite playlists em limits. 0 = ilimitado (recomendado).',
    false,
    true,
    '0',
    '^[0-9]+$',
    NULL
  )
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description,
  is_editable = EXCLUDED.is_editable,
  validation = EXCLUDED.validation,
  options = EXCLUDED.options,
  default_value = EXCLUDED.default_value,
  updated_at = CURRENT_TIMESTAMP;

-- Modo simples de programação (mix round-robin; UI sem agendamento)
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public, is_editable, default_value, validation, options)
VALUES
  (
    'totem.simple_mode_enabled',
    'true',
    'boolean',
    'totem',
    'Habilita modo simples: mix multi-anunciante round-robin e publicação sem agendamento na UI',
    true,
    true,
    'true',
    '^(true|false)$',
    '["true", "false"]'
  )
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description,
  is_public = EXCLUDED.is_public,
  is_editable = EXCLUDED.is_editable,
  default_value = EXCLUDED.default_value,
  validation = EXCLUDED.validation,
  options = EXCLUDED.options,
  updated_at = CURRENT_TIMESTAMP;

-- Complementos de produto (Fase A: persistência; Fase B: gates menu/API)
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public, is_editable, default_value, validation, options)
VALUES
  (
    'installation.modules',
    '{}',
    'json',
    'system',
    'Complementos de produto da instalação (JSON). Distinto de flag_smart_* por utilizador. {} = defaults do perfil.',
    false,
    true,
    '{}',
    NULL,
    NULL
  )
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description,
  is_public = EXCLUDED.is_public,
  is_editable = EXCLUDED.is_editable,
  default_value = EXCLUDED.default_value,
  updated_at = CURRENT_TIMESTAMP;

-- Portal DNS/Nginx por publisher/anunciante
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public, is_editable, default_value, validation, options)
VALUES
  (
    'portal.base_domain',
    '',
    'string',
    'portal',
    'Domínio base dos portais (ex.: totemdigital.app.br). Vazio = só DNS local / hosts manuais.',
    false,
    true,
    '',
    NULL,
    NULL
  ),
  (
    'portal.dns_mode',
    'off',
    'string',
    'portal',
    'Modo DNS/Nginx: off | public_wildcard | local_dnsmasq',
    false,
    true,
    'off',
    '^(off|public_wildcard|local_dnsmasq)$',
    '["off","public_wildcard","local_dnsmasq"]'
  ),
  (
    'portal.sync_enabled',
    'false',
    'boolean',
    'portal',
    'Se true, a API tenta correr scripts/sync-portal-hosts.sh após alterar slugs (requer sudoers).',
    false,
    true,
    'false',
    '^(true|false)$',
    '["true","false"]'
  ),
  (
    'portal.dns_provider',
    'off',
    'string',
    'portal',
    'Provedor DNS: off | manual | cloudflare (token só via env CLOUDFLARE_API_TOKEN).',
    false,
    true,
    'off',
    '^(off|manual|cloudflare)$',
    '["off","manual","cloudflare"]'
  ),
  (
    'portal.cloudflare_zone_id',
    '',
    'string',
    'portal',
    'Cloudflare Zone ID para sync de wildcards.',
    false,
    true,
    '',
    NULL,
    NULL
  ),
  (
    'portal.dns_target_ipv4',
    '',
    'string',
    'portal',
    'IPv4 alvo dos registos A wildcard do portal.',
    false,
    true,
    '',
    NULL,
    NULL
  ),
  (
    'portal.ssl_wildcard_enabled',
    'false',
    'boolean',
    'portal',
    'Permite emitir/planear LE wildcard DNS-01 para *.publisher / *.subscriber.',
    false,
    true,
    'false',
    '^(true|false)$',
    '["true","false"]'
  ),
  (
    'portal.ssl_email',
    '',
    'string',
    'portal',
    'Email Let''s Encrypt para certificado wildcard do portal.',
    false,
    true,
    '',
    NULL,
    NULL
  ),
  (
    'portal.seed_second_agency',
    'true',
    'boolean',
    'portal',
    'Ao activar multi-agência com 1 org, cria 2ª agência + anunciante demo.',
    false,
    true,
    'true',
    '^(true|false)$',
    '["true","false"]'
  )
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description,
  is_public = EXCLUDED.is_public,
  is_editable = EXCLUDED.is_editable,
  default_value = EXCLUDED.default_value,
  validation = EXCLUDED.validation,
  options = EXCLUDED.options,
  updated_at = CURRENT_TIMESTAMP;

-- Financeiro: bloqueio operacional por inadimplência
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public, is_editable, default_value, validation, options)
VALUES
  (
    'financial.block_publish_on_overdue',
    'true',
    'boolean',
    'financial',
    'Bloqueia novas publicações (Publicar em Tela, campanhas ativas) quando o anunciante tem prestações vencidas',
    false,
    true,
    'true',
    '^(true|false)$',
    '["true", "false"]'
  ),
  (
    'financial.admin_override_overdue_block',
    'true',
    'boolean',
    'financial',
    'Permite owner_system, admin_sql e admin publicar mesmo com prestações vencidas (override operacional)',
    false,
    true,
    'true',
    '^(true|false)$',
    '["true","false"]'
  ),
  (
    'financial.block_publish_overdue_grace_days',
    '0',
    'number',
    'financial',
    'Dias de tolerância após o vencimento antes de bloquear publicações e pausar campanhas (0 = bloqueia no 1º dia após vencimento)',
    false,
    true,
    '0',
    '^[0-9]+$',
    NULL
  ),
  (
    'financial.auto_pause_campaigns_on_block',
    'true',
    'boolean',
    'financial',
    'Pausa automaticamente campanhas ativas quando o bloqueio por inadimplência entra em vigor',
    false,
    true,
    'true',
    '^(true|false)$',
    '["true", "false"]'
  ),
  (
    'financial.notify_block_email_enabled',
    'true',
    'boolean',
    'financial',
    'Envia e-mail padronizado ao anunciante quando o bloqueio automático é aplicado',
    false,
    true,
    'true',
    '^(true|false)$',
    '["true", "false"]'
  ),
  (
    'financial.notify_block_whatsapp_enabled',
    'true',
    'boolean',
    'financial',
    'Envia WhatsApp ao anunciante (Meta Cloud API se configurada; senão link wa.me no e-mail)',
    false,
    true,
    'true',
    '^(true|false)$',
    '["true", "false"]'
  ),
  (
    'financial.overdue_block_email_subject',
    'Publicação suspensa — {{subscriber_name}} ({{overdue_count}} prestação(ões) em atraso)',
    'string',
    'financial',
    'Assunto do e-mail de bloqueio. Placeholders: {{subscriber_name}}, {{overdue_count}}, {{amount_total}}, {{grace_days}}, {{days_overdue}}, {{billing_url}}, {{invoice_list}}, {{merchant_name}}',
    false,
    true,
    'Publicação suspensa — {{subscriber_name}} ({{overdue_count}} prestação(ões) em atraso)',
    NULL,
    NULL
  ),
  (
    'financial.overdue_block_email_body',
    'Olá {{subscriber_name}},\n\nA publicação nas telas foi suspensa após {{grace_days}} dia(s) de tolerância.\n\nPrestações em atraso: {{overdue_count}}\nValor total: {{amount_total}}\nMaior atraso: {{days_overdue}} dia(s)\n\n{{invoice_list}}\n\nRegularize: {{billing_url}}\n\n{{merchant_name}}',
    'string',
    'financial',
    'Corpo do e-mail de bloqueio (texto). Use os mesmos placeholders do assunto.',
    false,
    true,
    'Olá {{subscriber_name}},\n\nA publicação nas telas foi suspensa após {{grace_days}} dia(s) de tolerância.\n\nRegularize: {{billing_url}}',
    NULL,
    NULL
  ),
  (
    'financial.overdue_block_whatsapp_message',
    'Olá {{subscriber_name}}, sua publicação foi suspensa por inadimplência ({{overdue_count}} prestação(ões), {{amount_total}}, {{days_overdue}} dia(s) de atraso). Regularize: {{billing_url}}',
    'string',
    'financial',
    'Mensagem WhatsApp de bloqueio. Placeholders iguais ao e-mail.',
    false,
    true,
    'Olá {{subscriber_name}}, regularize em {{billing_url}}',
    NULL,
    NULL
  ),
  (
    'financial.worker_enabled',
    'true',
    'boolean',
    'financial',
    'Worker financeiro (crons de faturas, lembretes e bloqueio). Desligue para pausar rotinas sem reiniciar o servidor.',
    false,
    true,
    'true',
    '^(true|false)$',
    '["true", "false"]'
  ),
  (
    'financial.merchant_whatsapp_number',
    '',
    'string',
    'financial',
    'WhatsApp do financeiro da plataforma (link wa.me nos e-mails). Apenas dígitos, com DDI.',
    false,
    true,
    '',
    NULL,
    NULL
  ),
  (
    'financial.smtp_enabled',
    'false',
    'boolean',
    'financial',
    'Habilita envio de e-mails (lembretes, bloqueio por inadimplência, etc.)',
    false,
    true,
    'false',
    '^(true|false)$',
    '["true", "false"]'
  ),
  (
    'financial.smtp_host',
    'smtp.gmail.com',
    'string',
    'financial',
    'Servidor SMTP (host)',
    false,
    true,
    'smtp.gmail.com',
    NULL,
    NULL
  ),
  (
    'financial.smtp_port',
    '587',
    'number',
    'financial',
    'Porta SMTP',
    false,
    true,
    '587',
    '^[0-9]+$',
    NULL
  ),
  (
    'financial.smtp_secure',
    'false',
    'boolean',
    'financial',
    'SMTP SSL direto (porta 465). Para STARTTLS na 587, deixe false.',
    false,
    true,
    'false',
    '^(true|false)$',
    '["true", "false"]'
  ),
  (
    'financial.smtp_user',
    '',
    'string',
    'financial',
    'Usuário SMTP',
    false,
    true,
    '',
    NULL,
    NULL
  ),
  (
    'financial.smtp_pass',
    '',
    'string',
    'financial',
    'Senha SMTP (mascarada na UI; deixe em branco ao salvar para manter a atual)',
    false,
    true,
    '',
    NULL,
    NULL
  ),
  (
    'financial.smtp_from',
    'Smart Signage <noreply@smartsignage.com>',
    'string',
    'financial',
    'Remetente dos e-mails (From)',
    false,
    true,
    'Smart Signage <noreply@smartsignage.com>',
    NULL,
    NULL
  ),
  (
    'financial.smtp_tls_reject_unauthorized',
    'true',
    'boolean',
    'financial',
    'Rejeitar certificado SMTP inválido (TLS)',
    false,
    true,
    'true',
    '^(true|false)$',
    '["true", "false"]'
  ),
  (
    'financial.whatsapp_api_token',
    '',
    'string',
    'financial',
    'Token Meta Cloud API (WhatsApp Business). Deixe vazio para usar apenas link wa.me.',
    false,
    true,
    '',
    NULL,
    NULL
  ),
  (
    'financial.whatsapp_phone_number_id',
    '',
    'string',
    'financial',
    'Phone Number ID da Meta Cloud API (WhatsApp)',
    false,
    true,
    '',
    NULL,
    NULL
  ),
  (
    'financial.whatsapp_api_version',
    'v21.0',
    'string',
    'financial',
    'Versão da Graph API Meta (WhatsApp)',
    false,
    true,
    'v21.0',
    NULL,
    NULL
  )
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_public = EXCLUDED.is_public,
  is_editable = EXCLUDED.is_editable,
  default_value = EXCLUDED.default_value,
  validation = EXCLUDED.validation,
  options = EXCLUDED.options,
  updated_at = CURRENT_TIMESTAMP;

-- Chave legada (JSON); o runtime usa media.upload.allowed_types (string)
DELETE FROM system_settings WHERE setting_key = 'media.allowed_types';

