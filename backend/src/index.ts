/**
 * Smart Signage v2.1 - Backend Principal
 * PostgreSQL-only (Prisma removido)
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { initializeDatabase, closeDatabase, getDatabase } from './config/database';
import { initializeRedis, closeRedis, testRedisConnection } from './config/redis';
import { initializeExportQueue, closeExportQueue, initializeAdvancedScheduleQueue, closeAdvancedScheduleQueue } from './config/queue';
import { registerExportWorker } from './workers/exportWorker';
import { registerAdvancedScheduleWorker } from './workers/advancedScheduleWorker';
import { exportScheduleService } from './services/exportScheduleService';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import { getLogger, reloadLogger } from './config/logger';
import { LogRotationService } from './services/logRotationService';
import { logInfo, logError, logWarn } from './utils/loggerHelper';

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
import { openApiSpec } from './config/swagger';

// Services
import { SystemService } from './services/systemService';
import { NotificationService } from './services/notificationService';
import { AuditService } from './services/auditService';

const app = express();
const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

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
const corsOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:80', 'http://nginx:80'];
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Permite requisições sem origem (como mobile apps ou requisições diretas)
    if (!origin) return callback(null, true);
    
    // Verifica se a origem está na lista permitida
    if (corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Em produção, aceitar também requisições do Nginx
      if (process.env.NODE_ENV === 'production') {
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
import { getExpressLimit } from './config/mediaConfig';

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

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Muitas requisições. Tente novamente em alguns minutos.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Static files
app.use('/assets', express.static('/opt/smart-signage/public/assets'));
app.use('/uploads', express.static('/opt/smart-signage/public/assets/uploads'));

// =============================================
// ROUTES
// =============================================

// Root route - API information
app.get('/', (req, res) => {
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
    documentation: process.env.NODE_ENV !== 'production' ? '/api-docs' : 'Not available in production',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', async (req, res) => {
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
app.get('/api/system/info', async (req, res) => {
  try {
    const systemService = new SystemService();
    const info = await systemService.getSystemInfo();
    res.json(info);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API Health check
app.get('/api/health', async (req, res) => {
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/clients', authMiddleware, clientRoutes);
app.use('/api/totems', totemRoutes);
app.use('/api/players', authMiddleware, playerRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/qrcodes', qrcodeRoutes);
app.use('/api/qr-codes', qrcodeRoutes); // Alias para compatibilidade com frontend
app.use('/api/analytics', analyticsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/smart-playlist', smartPlaylistRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/export-queries', exportQueriesRoutes);
app.use('/api/export-schedules', exportSchedulesRoutes);
app.use('/api/export-executions', exportExecutionsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/advanced-schedules', advancedSchedulesRoutes);
app.use('/api/email', emailRoutes);

// Docs JSON (Swagger OpenAPI)
app.get('/api/docs.json', (req, res) => {
  res.json(openApiSpec);
});

// Player routes (sem autenticação)
import playerValidationRoutes from './routes/player';

// Servir player com suporte a UIN como parâmetro
app.get('/player', (req, res) => {
  const playerPath = process.env.PLAYER_PATH || '/opt/smart-signage/player/index.html';
  res.sendFile(playerPath);
});

// API de validação do player (antes do middleware de autenticação)
app.use('/api/player', playerValidationRoutes);
app.use('/api/player/debug', authMiddleware, playerDebugRoutes); // Debug de transações do player (requer autenticação)
app.use('/api/debug', debugRoutes); // Debug endpoints (logs, diagnóstico)

app.get('/player/config', async (req, res) => {
  try {
    const systemService = new SystemService();
    const config = await systemService.getPlayerConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin routes
app.get('/admin', (req, res) => {
  res.sendFile('/opt/smart-signage/frontend/index.html');
});

// API Documentation
if (process.env.NODE_ENV !== 'production') {
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
  } catch (logErr) {
    console.error('Failed to log SIGTERM:', logErr);
  }
  
  try {
    try {
      await closeExportQueue();
    } catch (err) {
      shutdownFailed = true;
      console.error('Failed to close export queue:', err);
    }
    
    try {
      await logInfo('Queue de exportação fechada');
    } catch (logErr) {
      console.error('Failed to log export queue closure:', logErr);
    }
    
    try {
      await closeAdvancedScheduleQueue();
    } catch (err) {
      shutdownFailed = true;
      console.error('Failed to close advanced schedule queue:', err);
    }
    
    try {
      await logInfo('Queue de agendamento avançado fechada');
    } catch (logErr) {
      console.error('Failed to log schedule queue closure:', logErr);
    }
    
    try {
      await closeRedis();
    } catch (err) {
      shutdownFailed = true;
      console.error('Failed to close Redis:', err);
    }
    
    try {
      await logInfo('Redis desconectado');
    } catch (logErr) {
      console.error('Failed to log Redis disconnection:', logErr);
    }
    
    try {
      await closeDatabase();
    } catch (err) {
      shutdownFailed = true;
      console.error('Failed to close database:', err);
    }
    
    try {
      await logInfo('Database desconectado');
    } catch (logErr) {
      console.error('Failed to log database disconnection:', logErr);
    }
    
    // Sair com código de erro se alguma operação falhou
    process.exit(shutdownFailed ? 1 : 0);
  } catch (error) {
    try {
      await logError('Erro durante shutdown', error);
    } catch (logErr) {
      // Se até o logging de erro falhar, pelo menos logar no console
      console.error('Failed to log shutdown error:', logErr);
      console.error('Original shutdown error:', error);
    }
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  let shutdownFailed = false;
  
  // Usar try/catch explícito para capturar erros síncronos e assíncronos
  try {
    await logInfo('SIGINT recebido. Iniciando shutdown graceful...');
  } catch (logErr) {
    console.error('Failed to log SIGINT:', logErr);
  }
  
  try {
    try {
      await closeExportQueue();
    } catch (err) {
      shutdownFailed = true;
      console.error('Failed to close export queue:', err);
    }
    
    try {
      await logInfo('Queue de exportação fechada');
    } catch (logErr) {
      console.error('Failed to log export queue closure:', logErr);
    }
    
    try {
      await closeAdvancedScheduleQueue();
    } catch (err) {
      shutdownFailed = true;
      console.error('Failed to close advanced schedule queue:', err);
    }
    
    try {
      await logInfo('Queue de agendamento avançado fechada');
    } catch (logErr) {
      console.error('Failed to log schedule queue closure:', logErr);
    }
    
    try {
      await closeRedis();
    } catch (err) {
      shutdownFailed = true;
      console.error('Failed to close Redis:', err);
    }
    
    try {
      await logInfo('Redis desconectado');
    } catch (logErr) {
      console.error('Failed to log Redis disconnection:', logErr);
    }
    
    try {
      await closeDatabase();
    } catch (err) {
      shutdownFailed = true;
      console.error('Failed to close database:', err);
    }
    
    try {
      await logInfo('Database desconectado');
    } catch (logErr) {
      console.error('Failed to log database disconnection:', logErr);
    }
    
    // Sair com código de erro se alguma operação falhou
    process.exit(shutdownFailed ? 1 : 0);
  } catch (error) {
    try {
      await logError('Erro durante shutdown', error);
    } catch (logErr) {
      // Se até o logging de erro falhar, pelo menos logar no console
      console.error('Failed to log shutdown error:', logErr);
      console.error('Original shutdown error:', error);
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
    
    const notificationService = new NotificationService();
    await notificationService.initialize();
    
    // AuditService será inicializado lazy quando necessário
    
    // Iniciar servidor
    app.listen(PORT, HOST, () => {
      console.log('✅ Smart Signage v2.1 iniciado com sucesso!');
      console.log(`🌐 Servidor rodando em http://${HOST}:${PORT}`);
      console.log(`📱 Player: http://${HOST}:${PORT}/player`);
      console.log(`🔧 Admin: http://${HOST}:${PORT}/admin`);
      console.log(`📚 API Docs: http://${HOST}:${PORT}/api-docs`);
      console.log(`💚 Health: http://${HOST}:${PORT}/health`);
      console.log(`🗄️ Database: PostgreSQL`);
      console.log(`🔴 Redis: Conectado`);
      console.log(`📦 Bull Queue: Ativo`);
      console.log(`🤖 AI Provider: ${process.env.AI_PROVIDER || 'ollama'}`);
      console.log('=====================================');
    });
    
  } catch (error: any) {
    await logError('Erro ao iniciar servidor', error);
    process.exit(1);
  }
}

// Iniciar servidor
startServer();

export default app;
