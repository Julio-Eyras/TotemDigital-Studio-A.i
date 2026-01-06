/**
 * Environment Configuration - Smart Signage v2.1
 * Centraliza e valida todas as variáveis de ambiente
 */

import dotenv from 'dotenv';
import { logWarnSync } from '../utils/loggerHelper';

// Carregar .env
dotenv.config();

/**
 * Valida se uma variável de ambiente está definida
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória não definida: ${key}`);
  }
  return value;
}

/**
 * Obtém variável de ambiente com valor padrão
 */
function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Obtém variável de ambiente numérica com valor padrão
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Obtém variável de ambiente booleana
 */
function getEnvBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Converte tamanho de string (ex: "100MB") para bytes
 */
function parseSize(size: string): number {
  const match = size.match(/^(\d+)([KMGT]?B)$/i);
  if (!match) return 0;
  
  const value = parseInt(match[1], 10);
  const unit = match[2].toUpperCase();
  
  const multipliers: { [key: string]: number } = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024
  };
  
  return value * (multipliers[unit] || 1);
}

/**
 * Configuração do servidor
 */
export const serverConfig = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: getEnvNumber('PORT', 3000),
  host: getEnv('HOST', '0.0.0.0'),
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development'
};

/**
 * Configuração do banco de dados
 */
const dbDriver = getEnv('DB_DRIVER', 'postgresql');

// Validar que apenas PostgreSQL é suportado
if (dbDriver !== 'postgresql' && dbDriver !== 'postgres') {
  throw new Error(
    `❌ ERRO: Driver de banco de dados '${dbDriver}' não é suportado. ` +
    `Apenas PostgreSQL é suportado (DB_DRIVER=postgresql). ` +
    `Verifique SQL (único suportado).`
  );
}

export const databaseConfig = {
  driver: dbDriver,
  url: requireEnv('DATABASE_URL'),
  host: getEnv('DB_HOST', 'localhost'),
  port: getEnvNumber('DB_PORT', 5432),
  database: getEnv('DB_NAME', 'smartsignage'),
  user: getEnv('DB_USER', 'smartsignage'),
  password: getEnv('DB_PASSWORD', ''),
  poolSize: getEnvNumber('DB_POOL_SIZE', 20),
  connectionTimeout: getEnvNumber('DB_CONNECTION_TIMEOUT', 30000)
};

/**
 * Configuração de autenticação JWT
 */
export const jwtConfig = {
  secret: requireEnv('JWT_SECRET'),
  twoFactorEncryptionKey: getEnv('TWO_FACTOR_ENCRYPTION_KEY', requireEnv('JWT_SECRET')), // Usa JWT_SECRET como fallback
  expiresIn: getEnv('JWT_EXPIRES_IN', '24h'),
  refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '7d')
};

/**
 * Configuração de segurança
 */
export const securityConfig = {
  playerAbandonPin: getEnv('PLAYER_ABANDON_PIN', '1234'),
  bcryptRounds: getEnvNumber('BCRYPT_ROUNDS', 12),
  corsOrigins: getEnv('CORS_ORIGIN', 'http://localhost:3000,http://localhost:3001').split(','),
  maxPayloadSize: parseSize(getEnv('MAX_PAYLOAD_SIZE', '10MB')),
  rateLimit: {
    windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutos
    maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
    authWindowMs: getEnvNumber('AUTH_RATE_LIMIT_WINDOW_MS', 900000), // 15 minutos
    authMaxRequests: getEnvNumber('AUTH_RATE_LIMIT_MAX_REQUESTS', 5),
    uploadWindowMs: getEnvNumber('UPLOAD_RATE_LIMIT_WINDOW_MS', 3600000), // 1 hora
    uploadMaxRequests: getEnvNumber('UPLOAD_RATE_LIMIT_MAX_REQUESTS', 20),
    sensitiveWindowMs: getEnvNumber('SENSITIVE_RATE_LIMIT_WINDOW_MS', 600000), // 10 minutos
    sensitiveMaxRequests: getEnvNumber('SENSITIVE_RATE_LIMIT_MAX_REQUESTS', 10)
  }
};

/**
 * Configuração de upload de arquivos
 */
export const uploadConfig = {
  maxSize: parseSize(getEnv('UPLOAD_MAX_SIZE', '100MB')),
  path: getEnv('UPLOAD_PATH', './uploads'),
  mediaQuotaPerClient: parseSize(getEnv('MEDIA_QUOTA_PER_CLIENT', '5GB')),
  allowedMimeTypes: getEnv('ALLOWED_FILE_TYPES', 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/ogg,audio/mp3,audio/wav,audio/ogg').split(',')
};

/**
 * Configuração do Redis
 */
export const redisConfig = {
  enabled: getEnvBoolean('CACHE_ENABLED', true),
  url: getEnv('REDIS_URL', 'redis://localhost:6379'),
  host: getEnv('REDIS_HOST', 'localhost'),
  port: getEnvNumber('REDIS_PORT', 6379),
  password: getEnv('REDIS_PASSWORD', ''),
  db: getEnvNumber('REDIS_DB', 0),
  defaultTtl: getEnvNumber('CACHE_TTL', 3600) // 1 hora padrão
};

/**
 * Configuração de logging
 */
export const loggingConfig = {
  level: getEnv('LOG_LEVEL', 'info'),
  file: getEnv('LOG_FILE', './logs/app.log'),
  maxSize: getEnv('LOG_MAX_SIZE', '10MB'),
  maxFiles: getEnvNumber('LOG_MAX_FILES', 5),
  enableConsole: getEnvBoolean('LOG_ENABLE_CONSOLE', true)
};

/**
 * Configuração de mensageria (SmartDisplayFX / MQTT)
 */
export const messagingConfig = {
  mqtt: {
    enabled: getEnvBoolean('SMARTDISPLAYFX_MQTT_ENABLED', false),
    url: getEnv('SMARTDISPLAYFX_MQTT_URL', 'mqtt://localhost:1883'),
    username: getEnv('SMARTDISPLAYFX_MQTT_USERNAME', ''),
    password: getEnv('SMARTDISPLAYFX_MQTT_PASSWORD', ''),
    prefix: getEnv('SMARTDISPLAYFX_MQTT_PREFIX', 'smartdisplay')
  }
};

/**
 * Configuração de IA
 */
export const aiConfig = {
  provider: getEnv('AI_PROVIDER', 'ollama'),
  model: getEnv('AI_MODEL', 'llama3.2:3b'),
  ollama: {
    baseUrl: getEnv('OLLAMA_BASE_URL', 'http://localhost:11434'),
    timeout: getEnvNumber('OLLAMA_TIMEOUT', 30000)
  },
  openai: {
    apiKey: getEnv('OPENAI_API_KEY', ''),
    model: getEnv('OPENAI_MODEL', 'gpt-3.5-turbo')
  },
  anthropic: {
    apiKey: getEnv('ANTHROPIC_API_KEY', ''),
    model: getEnv('ANTHROPIC_MODEL', 'claude-3-haiku-20240307')
  }
};

/**
 * Configuração de email
 */
export const emailConfig = {
  enabled: getEnvBoolean('EMAIL_ENABLED', false),
  smtp: {
    host: getEnv('SMTP_HOST', 'smtp.gmail.com'),
    port: getEnvNumber('SMTP_PORT', 587),
    secure: getEnvBoolean('SMTP_SECURE', false),
    user: getEnv('SMTP_USER', ''),
    pass: getEnv('SMTP_PASS', ''),
    from: getEnv('SMTP_FROM', 'Smart Signage <noreply@smartsignage.com>'),
    tlsRejectUnauthorized: getEnvBoolean('SMTP_TLS_REJECT_UNAUTHORIZED', true)
  },
  frontendUrl: getEnv('FRONTEND_URL', 'http://localhost:3001')
};

/**
 * Configuração de monitoramento
 */
export const monitoringConfig = {
  healthCheckEnabled: getEnvBoolean('HEALTH_CHECK_ENABLED', true),
  metricsEnabled: getEnvBoolean('METRICS_ENABLED', true),
  prometheus: {
    url: getEnv('PROMETHEUS_URL', 'http://localhost:9090'),
    port: getEnvNumber('PROMETHEUS_PORT', 9090),
    timeout: getEnvNumber('PROMETHEUS_TIMEOUT', 30000)
  },
  grafana: {
    url: getEnv('GRAFANA_URL', 'http://localhost:3002'),
    apiKey: getEnv('GRAFANA_API_KEY', ''),
    username: getEnv('GRAFANA_USERNAME', 'admin'),
    password: getEnv('GRAFANA_PASSWORD', 'admin'),
    datasourceId: getEnvNumber('GRAFANA_DATASOURCE_ID', 1),
    timeout: getEnvNumber('GRAFANA_TIMEOUT', 30000)
  }
};

/**
 * Configuração de backup
 */
export const backupConfig = {
  enabled: getEnvBoolean('BACKUP_ENABLED', true),
  interval: getEnv('BACKUP_INTERVAL', '24h'),
  retentionDays: getEnvNumber('BACKUP_RETENTION_DAYS', 30),
  path: getEnv('BACKUP_PATH', './backups')
};

/**
 * Configuração de analytics
 */
export const analyticsConfig = {
  enabled: getEnvBoolean('ANALYTICS_ENABLED', true),
  retentionDays: getEnvNumber('ANALYTICS_RETENTION_DAYS', 365),
  batchSize: getEnvNumber('ANALYTICS_BATCH_SIZE', 1000)
};

/**
 * Configuração do Player/Totem
 */
export const playerConfig = {
  path: getEnv('PLAYER_PATH', '/opt/smart-signage/player-web/index.html'),
  dir: getEnv('PLAYER_DIR', '/opt/smart-signage/player-web'),
  serverUrl: getEnv('SERVER_URL', ''), // Se vazio, será construído automaticamente
  heartbeatInterval: getEnvNumber('HEARTBEAT_INTERVAL', 30000),
  autoStart: getEnvBoolean('PLAYER_AUTO_START', true),
  fullscreen: getEnvBoolean('PLAYER_FULLSCREEN', true),
  portrait: getEnvBoolean('PLAYER_PORTRAIT', false)
};

/**
 * Configuração do Stripe
 */
export const stripeConfig = {
  enabled: getEnvBoolean('STRIPE_ENABLED', false),
  secretKey: getEnv('STRIPE_SECRET_KEY', ''),
  publishableKey: getEnv('STRIPE_PUBLISHABLE_KEY', ''),
  webhookSecret: getEnv('STRIPE_WEBHOOK_SECRET', ''),
  currency: getEnv('STRIPE_CURRENCY', 'brl'),
  apiVersion: getEnv('STRIPE_API_VERSION', '2024-11-20.acacia')
};

/**
 * Valida configurações críticas na inicialização
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // Validar JWT_SECRET
  if (!jwtConfig.secret || jwtConfig.secret === 'your-super-secret-jwt-key-change-this-in-production') {
    errors.push('JWT_SECRET deve ser alterado em produção!');
  }

  // Validar DATABASE_URL
  if (!databaseConfig.url || databaseConfig.url.includes('localhost') && serverConfig.isProduction) {
    logWarnSync('DATABASE_URL parece estar usando localhost em produção', {});
  }

  // Validar CORS em produção
  if (serverConfig.isProduction && securityConfig.corsOrigins.includes('http://localhost')) {
    logWarnSync('CORS_ORIGIN contém localhost em produção - considere usar domínio real', {});
  }

  // Validar Redis se cache estiver habilitado
  if (redisConfig.enabled && !redisConfig.host) {
    errors.push('CACHE_ENABLED=true mas REDIS_HOST não está configurado');
  }

  if (errors.length > 0) {
    const errorMessage = `Erros de configuração:\n${errors.map(e => `  - ${e}`).join('\n')}`;
    if (serverConfig.isProduction) {
      throw new Error(errorMessage);
    } else {
      logWarnSync(errorMessage, {});
    }
  }
}

/**
 * Exporta todas as configurações
 */
export const config = {
  server: serverConfig,
  database: databaseConfig,
  jwt: jwtConfig,
  security: securityConfig,
  upload: uploadConfig,
  redis: redisConfig,
  logging: loggingConfig,
  ai: aiConfig,
  email: emailConfig,
  monitoring: monitoringConfig,
  backup: backupConfig,
  analytics: analyticsConfig,
  stripe: stripeConfig,
  player: playerConfig
};

// Validar na importação (apenas em produção)
if (serverConfig.isProduction) {
  validateConfig();
}

