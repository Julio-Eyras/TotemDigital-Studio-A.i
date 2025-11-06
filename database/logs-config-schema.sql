-- =============================================
-- SCHEMA DE CONFIGURAÇÕES DE LOGS - Smart Signage v2.1
-- =============================================
-- Configurações parametrizáveis para sistema de logs
-- =============================================

-- Criar tabela system_settings se não existir
CREATE TABLE IF NOT EXISTS system_settings (
    setting_id SERIAL PRIMARY KEY,
    setting_key VARCHAR(255) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(50) NOT NULL DEFAULT 'string', -- string, number, boolean, json, array
    category VARCHAR(100) DEFAULT 'system',
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    is_editable BOOLEAN DEFAULT true,
    validation TEXT, -- regex ou validação
    options JSONB, -- opções disponíveis (para selects)
    default_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar índice na chave para busca rápida
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_system_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_system_settings_timestamp_trigger ON system_settings;
CREATE TRIGGER update_system_settings_timestamp_trigger
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_system_settings_timestamp();

-- Comentários
COMMENT ON TABLE system_settings IS 'Configurações do sistema (incluindo logs)';
COMMENT ON COLUMN system_settings.setting_key IS 'Chave única da configuração';
COMMENT ON COLUMN system_settings.setting_value IS 'Valor da configuração';
COMMENT ON COLUMN system_settings.setting_type IS 'Tipo da configuração: string, number, boolean, json, array';
COMMENT ON COLUMN system_settings.category IS 'Categoria da configuração: logs, system, security, etc.';

-- Inserir configurações de logs no sistema (se não existirem)
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
    '^\\d+(\\.\\d+)?\\s*(B|KB|MB|GB|TB)$',
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
    '^[1-9]\\d*$',
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
    '^\\d+(\\.\\d+)?\\s*(B|KB|MB|GB|TB)$',
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

COMMENT ON TABLE system_settings IS 'Configurações do sistema (incluindo logs)';
COMMENT ON COLUMN system_settings.category IS 'Categoria da configuração: logs, system, security, etc.';

