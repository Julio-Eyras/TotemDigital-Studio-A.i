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
    'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,audio/mp3,audio/wav,audio/ogg',
    'string',
    'media',
    'Tipos MIME permitidos (lista separada por vírgula; mesmo formato lido pelo backend em runtime)',
    false,
    true,
    'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,audio/mp3,audio/wav,audio/ogg',
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

-- Chave legada (JSON); o runtime usa media.upload.allowed_types (string)
DELETE FROM system_settings WHERE setting_key = 'media.allowed_types';

