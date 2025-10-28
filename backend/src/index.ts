/**
 * Smart Signage v2.0 - Backend Principal
 * Sistema unificado com suporte a SQLite e PostgreSQL
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { initializeDatabase, closeDatabase, getDatabase } from './config/database';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware';
import { authMiddleware } from './middleware/auth.middleware';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import clientRoutes from './routes/clients';
import dashboardRoutes from './routes/dashboard';
import playerRoutes from './routes/players';
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
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
app.use('/api/players', authMiddleware, playerRoutes);
app.use('/api/media', authMiddleware, mediaRoutes);
app.use('/api/playlists', authMiddleware, playlistRoutes);
app.use('/api/campaigns', authMiddleware, campaignRoutes);
app.use('/api/qrcodes', authMiddleware, qrcodeRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/billing', authMiddleware, billingRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/reports', authMiddleware, reportsRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/smart-playlist', authMiddleware, smartPlaylistRoutes);

// Player routes (sem autenticação)
app.get('/player', (req, res) => {
  res.sendFile('/opt/smart-signage/player/index.html');
});

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
  const swaggerSpec = require('./config/swagger');
  
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
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
  console.log('🔄 SIGTERM recebido. Iniciando shutdown graceful...');
  
  try {
    await closeDatabase();
    console.log('✅ Database desconectado');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro durante shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('🔄 SIGINT recebido. Iniciando shutdown graceful...');
  
  try {
    await closeDatabase();
    console.log('✅ Database desconectado');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro durante shutdown:', error);
    process.exit(1);
  }
});

// =============================================
// STARTUP
// =============================================

async function startServer() {
  try {
    console.log('🚀 Iniciando Smart Signage v2.0...');
    
    // Inicializar database
    console.log('📊 Conectando ao database...');
    await initializeDatabase();
    
    // Inicializar serviços
    console.log('⚙️ Inicializando serviços...');
    const systemService = new SystemService();
    await systemService.initialize();
    
    const notificationService = new NotificationService();
    await notificationService.initialize();
    
    // AuditService será inicializado lazy quando necessário
    
    // Iniciar servidor
    app.listen(PORT, HOST, () => {
      console.log('✅ Smart Signage v2.0 iniciado com sucesso!');
      console.log(`🌐 Servidor rodando em http://${HOST}:${PORT}`);
      console.log(`📱 Player: http://${HOST}:${PORT}/player`);
      console.log(`🔧 Admin: http://${HOST}:${PORT}/admin`);
      console.log(`📚 API Docs: http://${HOST}:${PORT}/api-docs`);
      console.log(`💚 Health: http://${HOST}:${PORT}/health`);
      console.log(`🗄️ Database: ${process.env.DB_DRIVER || 'sqlite'}`);
      console.log(`🤖 AI Provider: ${process.env.AI_PROVIDER || 'ollama'}`);
      console.log('=====================================');
    });
    
  } catch (error: any) {
    console.error('❌ Erro ao iniciar servidor:', error.message);
    process.exit(1);
  }
}

// Iniciar servidor
startServer();

export default app;
