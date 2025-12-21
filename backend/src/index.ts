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
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import { blockClientDataAccess } from './middleware/operatorProtection.middleware';
import { auditSystemUsers } from './middleware/auditSystemUsers.middleware';
import { getLogger } from './config/logger';
import { LogRotationService } from './services/logRotationService';
import { logInfo, logError, logWarn, logInfoSync } from './utils/loggerHelper';
import { getWebSocketService } from './services/websocketService';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import clientRoutes from './routes/clients';
import dashboardRoutes from './routes/dashboard';
import playerRoutes from './routes/players'; // API de gerenciamento de players
import totemRoutes from './routes/totems';
import mediaRoutes from './routes/media';
import playlistRoutes from './routes/playlists';
import campaignRoutes from './routes/campaigns';
import qrcodeRoutes from './routes/qrcodes';
import analyticsRoutes from './routes/analytics';
import billingRoutes from './routes/billing';
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
import { rateLimitHeavyOperations } from './middleware/rateLimitUser.middleware';
import { openApiSpec } from './config/swagger';
import { getExpressLimit } from './config/mediaConfig';

// Services
import { SystemService } from './services/systemService';

const app = express();
const PORT = config.server.port;
const HOST = config.server.host;

// =============================================
// MIDDLEWARE GLOBAL
// =============================================

// Nginx em frente ao Express
// Confiar apenas em proxies locais (ex.: Nginx na mesma máquina)
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// Security
app.use(helmet({
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
  crossOriginEmbedderPolicy: false
}));

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
    name: 'Smart Signage Pro v2.0',
    version: '2.0.0',
    type: 'REST API',
    description: 'API Backend do Sistema de Sinalização Digital',
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
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
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
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware as any, userRoutes);
app.use('/api/clients', authMiddleware as any, blockClientDataAccess as any, clientRoutes);
app.use('/api/totems', totemRoutes);
app.use('/api/players', authMiddleware as any, playerRoutes);
app.use('/api/media', blockClientDataAccess as any, mediaRoutes);
app.use('/api/playlists', blockClientDataAccess as any, playlistRoutes);
app.use('/api/campaigns', blockClientDataAccess as any, campaignRoutes);
app.use('/api/qrcodes', blockClientDataAccess as any, qrcodeRoutes);
app.use('/api/qr-codes', blockClientDataAccess as any, qrcodeRoutes); // Alias para compatibilidade com frontend
app.use('/api/analytics', blockClientDataAccess as any, analyticsRoutes);
app.use('/api/billing', authMiddleware as any, blockClientDataAccess as any, billingRoutes);
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

// Servir player com suporte a UIN como parâmetro
app.get('/player', (_req, res) => {
  const playerPath = config.player.path;
  res.sendFile(playerPath);
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

process.on('SIGTERM', async () => {
  let shutdownFailed = false;
  
  // Usar try/catch explícito para capturar erros síncronos e assíncronos
  try {
    await logInfo('SIGTERM recebido. Iniciando shutdown graceful...');
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
});

process.on('SIGINT', async () => {
  let shutdownFailed = false;
  
  // Usar try/catch explícito para capturar erros síncronos e assíncronos
  try {
    await logInfo('SIGINT recebido. Iniciando shutdown graceful...');
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
});

// =============================================
// STARTUP
// =============================================

async function startServer() {
  try {
    await logInfo('Iniciando Smart Signage v2.1...');
    
    // Inicializar database PRIMEIRO (necessário para carregar configurações de mídia)
    await logInfo('Conectando ao database...');
    await initializeDatabase();
    
    // Carregar configurações de mídia DEPOIS de inicializar o banco
    await logInfo('Carregando configurações de mídia do banco de dados...');
    const { loadMediaConfig } = await import('./config/mediaConfig');
    try {
      await loadMediaConfig();
      await logInfo('Configurações de mídia carregadas do banco de dados');
    } catch (err: any) {
      await logWarn('Erro ao carregar configurações de mídia (usando padrões)', { error: err.message });
    }
    
    // Inicializar Redis
    await logInfo('Conectando ao Redis...');
    await initializeRedis();
    const redisConnected = await testRedisConnection();
    if (!redisConnected) {
      throw new Error('Falha ao conectar ao Redis');
    }
    
    // Inicializar Bull Queue
    await logInfo('Inicializando Bull Queue...');
    initializeExportQueue();
    registerExportWorker();
    
    // Inicializar Bull Queue de Agendamento Avançado
    await logInfo('Inicializando Bull Queue de Agendamento Avançado...');
    initializeAdvancedScheduleQueue();
    registerAdvancedScheduleWorker();
    
    // Inicializar Invoice Worker
    await logInfo('Inicializando Invoice Worker...');
    const invoiceWorker = new InvoiceWorker();
    invoiceWorker.start();
    (global as any).invoiceWorker = invoiceWorker; // Salvar para graceful shutdown
    
    // Carregar agendamentos ativos
    await logInfo('Carregando agendamentos ativos...');
    await exportScheduleService.loadAllActiveSchedules();
    
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
      logInfoSync('Servidor rodando', {
        server: `http://${HOST}:${PORT}`,
        player: `http://${HOST}:${PORT}/player`,
        admin: `http://${HOST}:${PORT}/admin`,
        apiDocs: `http://${HOST}:${PORT}/api-docs`,
        health: `http://${HOST}:${PORT}/health`,
        websocket: `ws://${HOST}:${PORT}/ws`
      });
      logInfoSync('Configurações do sistema', {
        database: 'PostgreSQL',
        redis: 'Conectado',
        bullQueue: 'Ativo',
        websocket: 'Ativo',
        aiProvider: process.env.AI_PROVIDER || 'ollama'
      });
    });
    
  } catch (error: any) {
    await logError('Erro ao iniciar servidor', error);
    process.exit(1);
  }
}

// Iniciar servidor
startServer();

export default app;
