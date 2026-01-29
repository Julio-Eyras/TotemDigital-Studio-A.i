/**
 * Smart Signage v2.1 - Backend Principal
 * PostgreSQL-only (Prisma removido)
 */

import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { apiLimiter, validatePayloadSize, sanitizeQueryParams, validateOrigin } from './middleware/security.middleware';
import { config } from './config/env';
import { initializeDatabase, closeDatabase } from './config/database';
import { initializeRedis, closeRedis, testRedisConnection } from './config/redis';
import { initializeExportQueue, closeExportQueue, initializeAdvancedScheduleQueue, closeAdvancedScheduleQueue } from './config/queue';
import { registerExportWorker } from './workers/exportWorker';
import { registerAdvancedScheduleWorker } from './workers/advancedScheduleWorker';
import { exportScheduleService } from './services/exportScheduleService';
import { InvoiceWorker } from './workers/invoiceWorker';
import { SubscriberAccessNotificationWorker } from './workers/subscriberAccessNotificationWorker';
import { getPlaylistEngineWorkerInstance } from './workers/playlistEngineWorker';
import cron from 'node-cron';
import { getAlertService } from './services/alertService';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import { blockClientDataAccess } from './middleware/operatorProtection.middleware';
import { auditSystemUsers } from './middleware/auditSystemUsers.middleware';
import { detectSubdomain, validateSubdomainAccess } from './middleware/subdomain.middleware';
import { getLogger } from './config/logger';
import { LogRotationService } from './services/logRotationService';
import { logInfo, logError, logWarn, logInfoSync } from './utils/loggerHelper';
import { getWebSocketService } from './services/websocketService';
import { APP_VERSION, APP_NAME, APP_DESCRIPTION } from './config/version';
import fs from 'fs';
import path from 'path';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import clientRoutes from './routes/clients'; // TODO: Deprecar - usar subscribers
import subscriberRoutes from './routes/subscribers'; // NOVO: Subscribers (anunciantes)
import publisherRoutes from './routes/publishers'; // NOVO: Publishers (publicadores)
import localRoutes from './routes/locals'; // NOVO: Locals (locais físicos dos publishers)
import smartTvRoutes from './routes/smart-tvs'; // NOVO: Smart TVs (controladas pelos totens)
import subscriberAccessRoutes from './routes/subscriber-access'; // NOVO: Controle de acesso Subscriber → Publisher
import contractRoutes from './routes/contracts'; // NOVO: Contratos de Subscribers
import dashboardRoutes from './routes/dashboard';
import playerRoutes from './routes/players'; // API de gerenciamento de players
import totemRoutes from './routes/totems';
import mediaRoutes from './routes/media';
import playlistRoutes from './routes/playlists';
import playlistMixRoutes from './routes/playlist-mix';
import playlistEngineRoutes from './routes/playlist-engine';
import campaignRoutes from './routes/campaigns';
import qrcodeRoutes from './routes/qrcodes';
import analyticsRoutes from './routes/analytics';
import billingRoutes from './routes/billing'; // TODO: Deprecar - usar subscriber-billing e publisher-billing
import subscriberBillingRoutes from './routes/subscriber-billing'; // NOVO: Billing de subscribers
import publisherBillingRoutes from './routes/publisher-billing'; // NOVO: Billing de publishers
import plansRoutes from './routes/plans';
import subscriptionsRoutes from './routes/subscriptions';
import settingsRoutes from './routes/settings';
import reportsRoutes from './routes/reports';
import aiRoutes from './routes/ai';
import smartPlaylistRoutes from './routes/smart-playlist';
import debugRoutes from './routes/debug';
import exportQueriesRoutes from './routes/export-queries';
import exportSchedulesRoutes from './routes/export-schedules';
import exportExecutionsRoutes from './routes/export-executions';
import logsRoutes from './routes/logs';
import playerDebugRoutes from './routes/player-debug';
import advancedSchedulesRoutes from './routes/advanced-schedules';
import emailRoutes from './routes/email';
import otaUpdatesRoutes from './routes/ota-updates';
import tagsRoutes from './routes/tags';
import facialRecognitionRoutes from './routes/facial-recognition';
import networkRoutes from './routes/network';
import smartDisplayFxRoutes from './routes/smartdisplayfx';
import smartDisplayFxEffectsRoutes from './routes/smartdisplayfx-effects';
import smartDisplayFxRulesRoutes from './routes/smartdisplayfx-rules';
import smartDisplayFxTimelinesRoutes from './routes/smartdisplayfx-timelines';
import smartDisplayFxSitesRoutes from './routes/smartdisplayfx-sites';
import smartDisplayFxTelemetryRoutes from './routes/smartdisplayfx-telemetry';
import smartDisplayFxAnalyticsRoutes from './routes/smartdisplayfx-analytics';
import alertsRoutes from './routes/alerts';
import rolesRoutes from './routes/roles';
import permissionsRoutes from './routes/permissions';
import webhooksRoutes from './routes/webhooks';
import dashboardLayoutsRoutes from './routes/dashboard-layouts';
import backupsRoutes from './routes/backups';
import healthRoutes from './routes/health';
import notificationsRoutes from './routes/notifications';
import dispatcherTotemRoutes from './routes/dispatcher-totem';
import dispatcherDebugRoutes from './routes/dispatcher-debug';
import { dispatcherDebugService } from './services/dispatcherDebugService';
import { createDatabaseWrapper } from './config/database-pg';
import { rateLimitHeavyOperations } from './middleware/rateLimitUser.middleware';
import { openApiSpec } from './config/swagger';
import { getExpressLimit } from './config/mediaConfig';

// Services
import { SystemService } from './services/systemService';

const app = express();
const PORT = config.server.port;
const HOST = config.server.host;

// Evitar ruído no console do navegador (favicon.ico 404)
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// =============================================
// MIDDLEWARE GLOBAL
// =============================================

// Nginx em frente ao Express
// Confiar apenas em proxies locais (ex.: Nginx na mesma máquina)
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// Security: Helmet NÃO deve ser aplicado às rotas /player (player usa inline scripts e não deve ter CSP/COOP)
app.use((req, res, next) => {
  if (req.path.startsWith('/player')) {
    // Player: apenas headers básicos, sem CSP/COOP para evitar bloqueio de inline scripts
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return next();
  }
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginOpenerPolicy: config.server.isProduction ? { policy: 'same-origin' } : false,
    crossOriginEmbedderPolicy: false
  })(req, res, next);
});

// CORS
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Permite requisições sem origem (como mobile apps ou requisições diretas)
    if (!origin) return callback(null, true);
    
    // Verifica se a origem está na lista permitida
    if (config.security.corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Em produção, aceitar também requisições do Nginx
      if (config.server.isProduction) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Body parsing - Configuração dinâmica de mídia
// NOTA: loadMediaConfig será chamado DEPOIS de initializeDatabase() na função startServer()
// Middleware dinâmico para body parsing (lê configuração do banco em cada requisição)
// Usa valores padrão até que o banco seja inicializado
app.use((req, res, next) => {
  const expressLimit = getExpressLimit(); // Retorna padrão se banco não inicializado
  express.json({ limit: expressLimit })(req, res, next);
});

app.use((req, res, next) => {
  const expressLimit = getExpressLimit(); // Retorna padrão se banco não inicializado
  express.urlencoded({ extended: true, limit: expressLimit })(req, res, next);
});

// Logging
app.use(morgan('combined'));
app.use(requestLogger);

// Detecção de subdomínio (deve vir antes das rotas)
app.use(detectSubdomain);

// Security middlewares
app.use(validateOrigin);
app.use(sanitizeQueryParams);
app.use(validatePayloadSize()); // Usa valor de securityConfig.maxPayloadSize

// Rate limiting - aplicar limiter genérico em todas as rotas API
app.use('/api/', apiLimiter);

// Static files
app.use('/assets', express.static('/opt/smart-signage/public/assets'));
app.use('/uploads', express.static('/opt/smart-signage/public/assets/uploads'));

// =============================================
// ROUTES
// =============================================

// Root route - API information
app.get('/', (_req, res) => {
  res.json({
    name: APP_NAME,
    version: APP_VERSION,
    type: 'REST API',
    description: APP_DESCRIPTION,
    endpoints: {
      health: '/health',
      api: '/api',
      authentication: '/api/auth',
      dashboard: '/api/dashboard',
      users: '/api/users',
      clients: '/api/clients',
      players: '/api/players',
      media: '/api/media',
      playlists: '/api/playlists',
      player: '/player',
      admin: '/admin'
    },
    documentation: config.server.isDevelopment ? '/api-docs' : 'Not available in production',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', async (_req, res) => {
  try {
    const systemService = new SystemService();
    const health = await systemService.getSystemHealth();
    const dbStatus = String(health?.database?.status || '').toLowerCase();
    const isDbHealthy = ['healthy', 'ok', 'connected'].includes(dbStatus);
    
    res.status(isDbHealthy ? 200 : 503).json({
      status: isDbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      database: health.database,
      memory: health.memory,
      disk: health.disk,
      uptime: process.uptime()
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// System info
app.get('/api/system/info', async (_req, res) => {
  try {
    const systemService = new SystemService();
    const info = await systemService.getSystemInfo();
    res.json(info);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API Health check
app.get('/api/health', async (_req, res) => {
  try {
    const systemService = new SystemService();
    const health = await systemService.getSystemHealth();
    const dbStatus = String(health?.database?.status || '').toLowerCase();
    const isDbHealthy = ['healthy', 'ok', 'connected'].includes(dbStatus);
    
    res.status(isDbHealthy ? 200 : 503).json({
      status: isDbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      database: health.database,
      memory: health.memory,
      disk: health.disk,
      uptime: process.uptime()
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Middleware de auditoria para ADMIN_SQL e OPERATOR (aplicar antes das rotas)
app.use('/api', auditSystemUsers as any);

// Validação de acesso por subdomínio (aplicar antes das rotas autenticadas)
app.use('/api', validateSubdomainAccess);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware as any, userRoutes);
// ⚠️ DEPRECATED: Esta rota está deprecated. Use /api/subscribers em vez de /api/clients
// Será removida em versão futura. Migre para /api/subscribers
app.use('/api/clients', authMiddleware as any, blockClientDataAccess as any, (_req, res, next) => {
  // Adicionar header de deprecação
  res.setHeader('X-Deprecated-Route', 'true');
  res.setHeader('X-Deprecated-Message', 'Esta rota está deprecated. Use /api/subscribers');
  next();
}, clientRoutes);
app.use('/api/subscribers', authMiddleware as any, blockClientDataAccess as any, subscriberRoutes); // NOVO: Subscribers (anunciantes)
app.use('/api/publishers', authMiddleware as any, publisherRoutes); // NOVO: Publishers (publicadores)
app.use('/api/locals', authMiddleware as any, localRoutes); // NOVO: Locals (locais físicos dos publishers)
app.use('/api/smart-tvs', authMiddleware as any, smartTvRoutes); // NOVO: Smart TVs (controladas pelos totens)
app.use('/api/subscriber-access', subscriberAccessRoutes); // NOVO: Controle de acesso Subscriber → Publisher
app.use('/api/contracts', contractRoutes); // NOVO: Contratos de Subscribers
app.use('/api/totems', totemRoutes);
app.use('/api/dispatcher-totem', dispatcherTotemRoutes); // NOVO: Dispatcher-Totem (motor de decisão)
app.use('/api/dispatcher-debug', dispatcherDebugRoutes); // Debug online do dispatcher, Redis, queries e mensagens
app.use('/api/players', authMiddleware as any, playerRoutes);
app.use('/api/media', blockClientDataAccess as any, mediaRoutes);
app.use('/api/playlists', blockClientDataAccess as any, playlistRoutes);
app.use('/api/playlist-mix', authMiddleware as any, playlistMixRoutes);
app.use('/api/playlist-engine', playlistEngineRoutes);
app.use('/api/campaigns', blockClientDataAccess as any, campaignRoutes);
app.use('/api/qrcodes', blockClientDataAccess as any, qrcodeRoutes);
app.use('/api/qr-codes', blockClientDataAccess as any, qrcodeRoutes); // Alias para compatibilidade com frontend
app.use('/api/analytics', blockClientDataAccess as any, analyticsRoutes);
// ⚠️ DEPRECATED: Esta rota está deprecated. Use /api/subscriber-billing e /api/publisher-billing
// Será removida em versão futura
app.use('/api/billing', authMiddleware as any, blockClientDataAccess as any, (_req, res, next) => {
  // Adicionar header de deprecação
  res.setHeader('X-Deprecated-Route', 'true');
  res.setHeader('X-Deprecated-Message', 'Esta rota está deprecated. Use /api/subscriber-billing ou /api/publisher-billing');
  next();
}, billingRoutes);
app.use('/api/subscriber-billing', authMiddleware as any, blockClientDataAccess as any, subscriberBillingRoutes); // NOVO: Billing de subscribers
app.use('/api/publisher-billing', authMiddleware as any, publisherBillingRoutes); // NOVO: Billing de publishers
app.use('/api/plans', plansRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', blockClientDataAccess as any, reportsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/smart-playlist', blockClientDataAccess as any, smartPlaylistRoutes);
app.use('/api/dashboard', authMiddleware as any, dashboardRoutes);
app.use('/api/export-queries', exportQueriesRoutes);
app.use('/api/export-schedules', exportSchedulesRoutes);
app.use('/api/export-executions', exportExecutionsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/advanced-schedules', advancedSchedulesRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/ota-updates', otaUpdatesRoutes);
app.use('/api/tags', blockClientDataAccess as any, tagsRoutes);
app.use('/api/facial-recognition', blockClientDataAccess as any, facialRecognitionRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/smartdisplayfx', smartDisplayFxRoutes);
app.use('/api/smartdisplayfx/effects', smartDisplayFxEffectsRoutes);
app.use('/api/smartdisplayfx/rules', smartDisplayFxRulesRoutes);
app.use('/api/smartdisplayfx/timelines', smartDisplayFxTimelinesRoutes);
app.use('/api/smartdisplayfx/sites', smartDisplayFxSitesRoutes);
app.use('/api/smartdisplayfx/telemetry', smartDisplayFxTelemetryRoutes);
app.use('/api/smartdisplayfx/analytics', smartDisplayFxAnalyticsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/dashboard-layouts', dashboardLayoutsRoutes);
app.use('/api/backups', rateLimitHeavyOperations, backupsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/notifications', notificationsRoutes);

// Docs JSON (Swagger OpenAPI)
app.get('/api/docs.json', (_req, res) => {
  res.json(openApiSpec);
});

// Player routes (sem autenticação)
import playerValidationRoutes from './routes/player';

// Servir arquivos estáticos do player (js/, css/, etc.)
// IMPORTANTE: Esta rota deve vir ANTES da rota /player para servir arquivos estáticos
let playerDir = config.player.dir || '/opt/smart-signage/player-web';

// Lista de diretórios possíveis
const possibleDirs = [
  process.env.PLAYER_DIR, // Variável de ambiente tem prioridade
  '/opt/smart-signage/player-web', // Diretório de produção
  path.join(process.cwd(), 'player-web'), // Desenvolvimento local
  config.player.dir // Config do env.ts
].filter(Boolean) as string[];

// Procurar primeiro diretório que existe
let foundDir: string | null = null;
for (const dir of possibleDirs) {
  if (fs.existsSync(dir)) {
    // Verificar se tem index.html (confirma que é o diretório do player)
    const indexPath = path.join(dir, 'index.html');
    if (fs.existsSync(indexPath)) {
      foundDir = dir;
      logInfoSync(`[Server] Diretório do player encontrado: ${dir}`);
      break;
    }
  }
}

if (foundDir) {
  playerDir = foundDir;
} else {
  // Se nenhum diretório válido foi encontrado, usar o padrão e logar aviso
  logWarn(`[Server] Nenhum diretório válido do player encontrado. Tentando: ${playerDir}`);
  logWarn(`[Server] Diretórios testados: ${possibleDirs.join(', ')}`);
  if (!fs.existsSync(playerDir)) {
    logWarn(`[Server] ⚠️ Diretório ${playerDir} não existe. Arquivos estáticos retornarão 404.`);
  }
}

logInfoSync(`[Server] Servindo player de: ${playerDir}`);

// Verificar se arquivos JS existem
const jsDir = path.join(playerDir, 'js');
const jsApiDir = path.join(playerDir, 'js', 'api');
const jsCacheDir = path.join(playerDir, 'js', 'cache');
if (fs.existsSync(jsDir)) {
  logInfoSync(`[Server] Diretório js/ encontrado: ${jsDir}`);
  if (fs.existsSync(jsApiDir)) {
    logInfoSync(`[Server] Diretório js/api/ encontrado: ${jsApiDir}`);
  } else {
    logWarn(`[Server] Diretório js/api/ NÃO encontrado: ${jsApiDir}`);
  }
  if (fs.existsSync(jsCacheDir)) {
    logInfoSync(`[Server] Diretório js/cache/ encontrado: ${jsCacheDir}`);
  } else {
    logWarn(`[Server] Diretório js/cache/ NÃO encontrado: ${jsCacheDir}`);
  }
} else {
  logWarn(`[Server] Diretório js/ NÃO encontrado: ${jsDir}`);
}

// Servir arquivos estáticos do diretório player (js/, css/, etc.)
// IMPORTANTE: Esta rota deve vir ANTES da rota /player para servir arquivos estáticos
// express.static com prefixo '/player' automaticamente remove o prefixo antes de procurar no diretório
// Então /player/js/app.js -> procura por js/app.js no playerDir
// Servir arquivos estáticos do player
// express.static com prefixo '/player' remove automaticamente o prefixo antes de procurar
// Então /player/js/app.js -> procura js/app.js no playerDir
app.use('/player', express.static(playerDir, {
  index: false, // Não servir index.html automaticamente
  setHeaders: (res, filePath) => {
    // Definir Content-Type correto para arquivos JavaScript
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    // Garantir que não há headers que forcem HTTPS
    res.removeHeader('Strict-Transport-Security');
    res.removeHeader('Upgrade-Insecure-Requests');
  },
  fallthrough: true, // IMPORTANTE: Continuar para próximas rotas se arquivo não encontrado
  dotfiles: 'ignore' // Ignorar arquivos ocultos
}));

// Servir player index.html com suporte a UIN como parâmetro
// Esta rota será chamada quando express.static não encontrar arquivo estático
// IMPORTANTE: Esta rota deve vir DEPOIS do express.static
app.get('/player', (req, res) => {
  // Se é um arquivo estático (js/, css/, etc.) que não foi encontrado, retornar 404
  if (req.path !== '/player' && req.path.startsWith('/player/')) {
    const pathWithoutPrefix = req.path.substring('/player'.length);
    // Se não termina com / e não tem extensão conhecida, pode ser arquivo estático não encontrado
    if (!pathWithoutPrefix.endsWith('/') && 
        !pathWithoutPrefix.match(/\.(js|css|json|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i)) {
      logWarn(`[Player] Arquivo estático não encontrado: ${req.path}`);
      return res.status(404).json({ error: 'Arquivo não encontrado', path: req.path });
    }
  }
  
  const playerPath = config.player.path;
  // Verificar se arquivo existe antes de enviar
  if (fs.existsSync(playerPath)) {
    // Remover headers que podem forçar HTTPS
    res.removeHeader('Strict-Transport-Security');
    res.removeHeader('Upgrade-Insecure-Requests');
    return res.sendFile(playerPath);
  } else {
    logWarn(`[Server] Arquivo index.html do player não encontrado: ${playerPath}`);
    return res.status(404).json({ error: 'Player não encontrado' });
  }
});

// Também servir /player/ (com barra final) - necessário para URLs com query string
app.get('/player/', (_req, res) => {
  const playerPath = config.player.path;
  if (fs.existsSync(playerPath)) {
    // Remover headers que podem forçar HTTPS
    res.removeHeader('Strict-Transport-Security');
    res.removeHeader('Upgrade-Insecure-Requests');
    return res.sendFile(playerPath);
  } else {
    logWarn(`[Server] Arquivo index.html do player não encontrado: ${playerPath}`);
    return res.status(404).json({ error: 'Player não encontrado' });
  }
});

// API de validação do player (antes do middleware de autenticação)
app.use('/api/player', playerValidationRoutes);
app.use('/api/player/debug', authMiddleware as any, playerDebugRoutes); // Debug de transações do player (requer autenticação)
app.use('/api/debug', debugRoutes); // Debug endpoints (logs, diagnóstico)

app.get('/player/config', async (_req, res) => {
  try {
    const systemService = new SystemService();
    const config = await systemService.getPlayerConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin routes
app.get('/admin', (_req, res) => {
  res.sendFile('/opt/smart-signage/frontend/index.html');
});

// API Documentation
if (config.server.isDevelopment) {
  const swaggerUi = require('swagger-ui-express');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint não encontrado',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use(errorHandler);

// =============================================
// GRACEFUL SHUTDOWN
// =============================================

/**
 * Executa shutdown graceful de todos os recursos
 * Extraído para função reutilizável para evitar duplicação
 */
async function gracefulShutdown(signal: string): Promise<void> {
  let shutdownFailed = false;
  
  // Usar try/catch explícito para capturar erros síncronos e assíncronos
  try {
    await logInfo(`${signal} recebido. Iniciando shutdown graceful...`);
  } catch {
    // Silenciosamente falhar - logging não disponível
  }
  
  try {
    // Export queue
    try {
      await closeExportQueue();
      await logInfo('Queue de exportação fechada');
    } catch {
      shutdownFailed = true;
    }
    
    // Advanced schedule queue
    try {
      await closeAdvancedScheduleQueue();
      await logInfo('Queue de agendamento avançado fechada');
    } catch {
      shutdownFailed = true;
    }
    
    // Redis
    try {
      await closeRedis();
      await logInfo('Redis desconectado');
    } catch {
      shutdownFailed = true;
    }
    
    // Invoice Worker
    try {
      if ((global as any).invoiceWorker) {
        (global as any).invoiceWorker.stop();
        await logInfo('Invoice Worker parado');
      }
    } catch {
      shutdownFailed = true;
    }
    
    // Subscriber Access Notification Worker
    try {
      if ((global as any).subscriberAccessNotificationWorker) {
        (global as any).subscriberAccessNotificationWorker.stop();
        await logInfo('Subscriber Access Notification Worker parado');
      }
      if ((global as any).playlistEngineWorker) {
        (global as any).playlistEngineWorker.stop();
        await logInfo('Playlist Engine Worker parado');
      }
    } catch {
      shutdownFailed = true;
    }
    
    // Playlist Mix Worker
    try {
      if ((global as any).playlistMixWorker) {
        (global as any).playlistMixWorker.stop();
        await logInfo('Playlist Mix Worker parado');
      }
    } catch {
      shutdownFailed = true;
    }
    
    // Database
    try {
      await closeDatabase();
      await logInfo('Database desconectado');
    } catch {
      shutdownFailed = true;
    }
    
    // Sair com código de erro se alguma operação falhou
    process.exit(shutdownFailed ? 1 : 0);
  } catch (error) {
    try {
      await logError('Erro durante shutdown', error);
    } catch {
      // Silenciosamente falhar - logging não disponível
    }
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// =============================================
// STARTUP
// =============================================

async function startServer() {
  try {
    await logInfo('Iniciando Smart Signage v2.1...');
    
    // Inicializar database PRIMEIRO (necessário para carregar configurações de mídia)
    await logInfo('Conectando ao database...');
    await initializeDatabase();
    
    // Conectar query logger para debug online
    try {
      const db = createDatabaseWrapper();
      db.setQueryLogger((query, params, duration, rowCount, error) => {
        dispatcherDebugService.logQuery(query, params, duration, rowCount, error, 'dispatcher');
      });
      await logInfo('Query logger conectado para debug online');
    } catch (err: any) {
      await logWarn('Erro ao conectar query logger (debug continuará funcionando)', { error: err.message });
    }
    
    // Carregar configurações de mídia DEPOIS de inicializar o banco
    await logInfo('Carregando configurações de mídia do banco de dados...');
    const { loadMediaConfig } = await import('./config/mediaConfig');
    try {
      await loadMediaConfig();
      await logInfo('Configurações de mídia carregadas do banco de dados');
    } catch (err: any) {
      await logWarn('Erro ao carregar configurações de mídia (usando padrões)', { error: err.message });
    }
    
    // Inicializar Redis (opcional)
    if (config.redis.enabled) {
      await logInfo('Conectando ao Redis...');
      try {
        await initializeRedis();
        const redisConnected = await testRedisConnection();
        if (!redisConnected) {
          await logWarn('Redis não conectado, continuando sem cache');
        } else {
          await logInfo('Redis conectado com sucesso');
        }
      } catch (error: any) {
        await logWarn('Erro ao conectar ao Redis, continuando sem cache', { error: error.message });
      }
      
      // Inicializar Bull Queue (requer Redis)
      try {
        await logInfo('Inicializando Bull Queue...');
        initializeExportQueue();
        registerExportWorker();
        
        await logInfo('Inicializando Bull Queue de Agendamento Avançado...');
        initializeAdvancedScheduleQueue();
        registerAdvancedScheduleWorker();
      } catch (error: any) {
        await logWarn('Erro ao inicializar Bull Queue, continuando sem filas', { error: error.message });
      }
    } else {
      await logInfo('Redis desabilitado (CACHE_ENABLED=false), continuando sem cache e filas');
    }
    
    // Inicializar Invoice Worker
    await logInfo('Inicializando Invoice Worker...');
    const invoiceWorker = new InvoiceWorker();
    invoiceWorker.start();
    (global as any).invoiceWorker = invoiceWorker; // Salvar para graceful shutdown
    
    // Inicializar Subscriber Access Notification Worker
    await logInfo('Inicializando Subscriber Access Notification Worker...');
    const subscriberAccessNotificationWorker = new SubscriberAccessNotificationWorker();
    subscriberAccessNotificationWorker.start();
    (global as any).subscriberAccessNotificationWorker = subscriberAccessNotificationWorker; // Salvar para graceful shutdown
    
    // Inicializar Playlist Mix Worker
    await logInfo('Inicializando Playlist Mix Worker...');
    const { getPlaylistMixWorker } = await import('./workers/playlistMixWorker');
    const playlistMixWorker = getPlaylistMixWorker();
    
    // Inicializar Playlist Engine Worker
    await logInfo('Inicializando Playlist Engine Worker...');
    const playlistEngineWorker = getPlaylistEngineWorkerInstance();
    playlistEngineWorker.start();
    (global as any).playlistEngineWorker = playlistEngineWorker; // Salvar para graceful shutdown
    playlistMixWorker.start();
    (global as any).playlistMixWorker = playlistMixWorker; // Salvar para graceful shutdown
    
    // Carregar agendamentos ativos (não crítico se falhar)
    try {
      await logInfo('Carregando agendamentos ativos...');
      await exportScheduleService.loadAllActiveSchedules();
    } catch (error: any) {
      // Não crítico - servidor pode iniciar sem agendamentos
      await logWarn('Não foi possível carregar agendamentos (continuando): ' + (error.message || error));
    }
    
    // Inicializar logger
    await logInfo('Inicializando sistema de logs...');
    const logger = await getLogger();
    logger.info('Smart Signage v2.1 iniciando...');
    
    // Inicializar Email Service
    await logInfo('Inicializando Email Service...');
    const { emailService } = await import('./services/emailService');
    if (emailService.isServiceEnabled()) {
      const emailConnected = await emailService.testConnection();
      if (emailConnected) {
        await logInfo('Email Service configurado e conectado');
      } else {
        await logWarn('Email Service configurado mas não conectado');
      }
    } else {
      await logInfo('Email Service desabilitado (SMTP não configurado)');
    }
    
    // Inicializar serviço de rotação de logs
    const logRotationService = new LogRotationService();
    // Verificar rotação a cada hora
    setInterval(async () => {
      const rotationCheck = await logRotationService.checkRotation();
      if (rotationCheck.needsRotation) {
        logger.warn(`Rotação de logs necessária: ${rotationCheck.reason}`, rotationCheck.details);
        await logRotationService.rotateLogs();
      }
    }, 60 * 60 * 1000); // 1 hora
    
    // Inicializar serviços
    await logInfo('Inicializando serviços...');
    const systemService = new SystemService();
    await systemService.initialize();
    
    // NotificationService será inicializado lazy quando necessário
    
    // AuditService será inicializado lazy quando necessário
    
    // Inicializar verificação automática de alertas (a cada 5 minutos)
    await logInfo('Inicializando verificação automática de alertas...');
    cron.schedule('*/5 * * * *', async () => {
      try {
        const alertService = getAlertService();
        const alerts = await alertService.checkAllAlerts();
        
        // Enviar alertas pelos canais configurados
        for (const alert of alerts) {
          const rule = (alertService as any).alertRules?.find((r: any) => r.id === alert.ruleId);
          if (rule && rule.enabled && rule.channels.length > 0) {
            await alertService.sendAlert(alert, rule.channels);
          }
        }
        
        if (alerts.length > 0) {
          await logInfo(`Verificação de alertas: ${alerts.length} alerta(s) encontrado(s)`, { count: alerts.length });
        }
      } catch (error: any) {
        await logError('Erro na verificação automática de alertas', error, {});
      }
    });
    
    // Criar servidor HTTP para WebSocket
    const server = http.createServer(app);
    
    // Inicializar WebSocket Service
    await logInfo('Inicializando WebSocket server...');
    const wsService = getWebSocketService();
    wsService.initialize(server);
    (global as any).wsService = wsService; // Salvar para graceful shutdown
    
    // Iniciar servidor
    server.listen(PORT, HOST, () => {
      logInfoSync('Smart Signage v2.1 iniciado com sucesso', {
        host: HOST,
        port: PORT,
        environment: config.server.nodeEnv
      });
      
      const playerUrl = config.player.port 
        ? `http://${HOST}:${config.player.port}` 
        : `http://${HOST}:${PORT}/player`;
      
      logInfoSync('Servidor rodando', {
        server: `http://${HOST}:${PORT}`,
        player: playerUrl,
        admin: `http://${HOST}:${PORT}/admin`,
        apiDocs: `http://${HOST}:${PORT}/api-docs`,
        health: `http://${HOST}:${PORT}/health`,
        websocket: `ws://${HOST}:${PORT}/ws`
      });
      logInfoSync('Configurações do sistema', {
        database: 'PostgreSQL',
        redis: config.redis.enabled ? 'Conectado' : 'Desabilitado',
        bullQueue: config.redis.enabled ? 'Ativo' : 'Desabilitado',
        websocket: 'Ativo',
        aiProvider: process.env.AI_PROVIDER || 'ollama',
        playerPort: config.player.port ? `Separada (${config.player.port})` : 'Mesma do backend'
      });
    });

    // Se PLAYER_PORT estiver definido, criar servidor Express separado para o player
    if (config.player.port && config.player.port > 0) {
      const playerApp = express();
      
      // CORS básico para o player
      playerApp.use(cors({
        origin: '*', // Player pode ser acessado de qualquer origem
        credentials: false
      }));

      // Servir arquivos estáticos do player
      playerApp.use('/', express.static(playerDir, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
          } else if (filePath.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
          }
        },
        fallthrough: false,
        dotfiles: 'ignore'
      }));

      // Servir index.html do player
      playerApp.get('/', (_req, res) => {
        const playerPath = config.player.path;
        if (fs.existsSync(playerPath)) {
          res.sendFile(playerPath);
        } else {
          logWarn(`[Player Server] Arquivo index.html não encontrado: ${playerPath}`);
          res.status(404).json({ error: 'Player não encontrado' });
        }
      });

      // Iniciar servidor do player na porta separada
      const playerServer = playerApp.listen(config.player.port, HOST, () => {
        logInfoSync(`[Player Server] Servidor do player iniciado na porta ${config.player.port}`, {
          port: config.player.port,
          host: HOST,
          url: `http://${HOST}:${config.player.port}`
        });
      });

      playerServer.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          logWarn(`[Player Server] Porta ${config.player.port} já está em uso. Player será servido na porta do backend.`);
        } else {
          logError('[Player Server] Erro ao iniciar servidor do player', error).catch(() => {});
        }
      });

      // Salvar referência para graceful shutdown
      (global as any).playerServer = playerServer;
    }
    
  } catch (error: any) {
    await logError('Erro ao iniciar servidor', error);
    process.exit(1);
  }
}

// Tratamento de erros não capturados para evitar crashes.
// IMPORTANTE: estes handlers NÃO PODEM depender do banco/redis (podem estar indisponíveis),
// e NUNCA devem lançar exceções (senão vira loop e o processo cai).
process.on('uncaughtException', (error: Error) => {
  // Log mínimo síncrono para garantir visibilidade mesmo sem DB
  // eslint-disable-next-line no-console
  console.error('[FATAL][uncaughtException]', error);

  // Tenta registrar no sistema de logs; se falhar, ignora (não pode quebrar o processo)
  logError('Erro não capturado (uncaughtException)', error, {
    type: 'uncaughtException',
    timestamp: new Date().toISOString(),
  }).catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[FATAL][uncaughtException][logError failed]', e);
  });
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  // eslint-disable-next-line no-console
  console.error('[FATAL][unhandledRejection]', err);

  logError('Promise rejeitada não tratada (unhandledRejection)', err, {
    type: 'unhandledRejection',
    promise: String(promise),
    timestamp: new Date().toISOString(),
  }).catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[FATAL][unhandledRejection][logError failed]', e);
  });
});

// Iniciar servidor
startServer();

export default app;
