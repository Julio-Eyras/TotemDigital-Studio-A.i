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
import { apiLimiter, validatePayloadSize, sanitizeQueryParams, validateOrigin, playerApiLimiter, playerTokenLimiter } from './middleware/security.middleware';
import { config } from './config/env';
import { initializeDatabase, closeDatabase } from './config/database';
import { initializeRedis, closeRedis, testRedisConnection } from './config/redis';
import { stopOperationalWorkers } from './startup/operationalWorkersLifecycle';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware';
import { responseFormatMiddleware } from './middleware/responseFormat.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import { auditSystemUsers } from './middleware/auditSystemUsers.middleware';
import { detectSubdomain, validateSubdomainAccess } from './middleware/subdomain.middleware';
import { localeMiddleware } from './middleware/locale.middleware';
import { getLogger } from './config/logger';
import { LogRotationService } from './services/logRotationService';
import { logInfo, logError, logWarn, logInfoSync, logWarnSync } from './utils/loggerHelper';
import { getWebSocketService } from './services/websocketService';
import { APP_VERSION, APP_NAME, APP_DESCRIPTION } from './config/version';
import fs from 'fs';
import path from 'path';

// Routes
import { dispatcherDebugService } from './services/dispatcherDebugService';
import { createDatabaseWrapper } from './config/database-pg';
import { openApiSpec } from './config/swagger';
import { getExpressLimit, getStoragePath } from './config/mediaConfig';
import { registerCompactRoutes } from './startup/registerCompactRoutes';
import {

  getInstallationProfileFromEnv,
  isSinglePublisherInstallation,
} from './policy/installationPolicy';
import debugRoutes from './routes/debug';
import playerDebugRoutes from './routes/player-debug';

// Services
import { SystemService } from './services/systemService';
import { normalizeError } from './utils/errors';

const app = express();
const PORT = config.server.port;
const HOST = config.server.host;
/** Perfil no arranque (env); refinado após warmInstallationRuntime na BD. */
const bootInstallationProfile = getInstallationProfileFromEnv();
const bootStudioMode = isSinglePublisherInstallation(bootInstallationProfile);
const APP_PROFILE = bootStudioMode ? 'smart-signage-studio' : 'smartsignage-pro';

// Evitar ruído no console do navegador (favicon.ico 404)
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// Não deixar o Express responder a pedidos de upgrade WebSocket em /ws
// (o servidor WebSocket trata o evento 'upgrade' no mesmo HTTP server)
app.use((req, res, next) => {
  if (req.path !== '/ws') return next();
  if (req.headers.upgrade === 'websocket') {
    return; // não chamar next() = não enviar resposta; o upgrade fica com o WebSocketServer
  }
  // GET /ws sem Upgrade: evitar que caia no catch-all (index.html 200). Exigir upgrade.
  res.setHeader('Content-Type', 'application/json');
  res.status(426).json({
    error: 'Upgrade Required',
    message: 'Esta rota aceita apenas conexões WebSocket. Use Upgrade: websocket.',
    code: 'WS_UPGRADE_REQUIRED'
  });
});

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

// Resposta padronizada (successJson, errorJson) - PLANO_MELHORIAS item 4
app.use(responseFormatMiddleware);

// Detecção de subdomínio (deve vir antes das rotas)
// TotemDigital compacto simplifica operação para domínio único.
if (!bootStudioMode) {
  app.use(detectSubdomain);
}

// Detecção de locale (query ?lang= / Accept-Language / subdomínio)
// Injeta req.locale e req.t(translationKey, params?) — fallback pt-BR
app.use(localeMiddleware);

// Security middlewares
app.use(validateOrigin);
app.use(sanitizeQueryParams);
app.use(validatePayloadSize()); // Usa valor de securityConfig.maxPayloadSize

// Rate limiting - aplicar limiter genérico em todas as rotas API
app.use('/api/', apiLimiter);

// Static files (assets e uploads) – usar caminho configurável para dev/prod
const defaultAssetsBase = '/opt/smart-signage/public/assets';
const assetsBase = process.env.ASSETS_BASE_PATH
  ? path.resolve(process.env.ASSETS_BASE_PATH)
  : fs.existsSync(defaultAssetsBase)
    ? defaultAssetsBase
    : path.join(process.cwd(), 'public', 'assets');
const uploadsPath = path.join(assetsBase, 'uploads');
// Servir /assets/uploads/* a partir do path configurado (DB/medias), para evitar 404 quando ASSETS_BASE_PATH difere do storage
app.get(/^\/assets\/uploads\/(.*)$/, (req, res): void => {
  const subpath = (req.params[0] || '').replace(/^\/+/, '').replace(/\.\./g, '');
  if (!subpath) {
    res.status(404).end();
    return;
  }
  const wantsPlayerBinary = /\.(mp4|webm|mov|mkv|m4v|avi|mp3|wav|ogg|aac)$/i.test(subpath);
  const sendMissingPlaceholder = (): void => {
    // UI (img): SVG amigável. Player-AD: NUNCA — grava SVG como .mp4 e fica ecrã preto.
    if (wantsPlayerBinary) {
      res.status(404).json({
        success: false,
        error: 'Arquivo de mídia não encontrado no servidor',
        path: `/assets/uploads/${subpath}`,
      });
      return;
    }
    const placeholderSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225" role="img" aria-label="Mídia não encontrada">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="400" height="225" fill="url(#bg)"/>
  <rect x="32" y="32" width="336" height="161" rx="12" ry="12" fill="none" stroke="#475569" stroke-width="2" stroke-dasharray="6 6"/>
  <circle cx="90" cy="112" r="26" fill="#0f172a" stroke="#38bdf8" stroke-width="3"/>
  <path d="M78 114l8-8 8 8 6-6 10 10" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="150" y="110" fill="#e5e7eb" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="18" font-weight="600">
    Pré-visualização indisponível
  </text>
  <text x="150" y="136" fill="#9ca3af" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="13">
    Arquivo de mídia não encontrado no servidor.
  </text>
</svg>`;
    res.status(200).type('image/svg+xml').send(placeholderSvg.trim());
  };
  try {
    const base = getStoragePath();
    if (!base) {
      sendMissingPlaceholder();
      return;
    }
    const filePath = path.join(base, subpath);
    const resolvedBase = path.resolve(base);
    const resolvedFile = path.resolve(filePath);
    if (!resolvedFile.startsWith(resolvedBase)) {
      res.status(403).end();
      return;
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      sendMissingPlaceholder();
      return;
    }
    res.sendFile(filePath);
  } catch {
    res.status(404).end();
  }
});
if (assetsBase) {
  app.use('/assets', express.static(assetsBase));
  if (fs.existsSync(uploadsPath)) {
    app.use('/uploads', express.static(uploadsPath));
  } else {
    try {
      fs.mkdirSync(uploadsPath, { recursive: true });
      app.use('/uploads', express.static(uploadsPath));
    } catch {
      logInfoSync(`[Static] Pasta uploads não encontrada: ${uploadsPath} (crie para servir mídias estáticas)`);
    }
  }
  logInfoSync(`[Static] Servindo assets em /assets a partir de: ${assetsBase}`);
}

// =============================================
// ROUTES
// =============================================

// Root route - API information
app.get('/', (_req, res) => {
  const endpoints = bootStudioMode
    ? {
        health: '/health',
        api: '/api',
        authentication: '/api/auth',
        dashboard: '/api/dashboard',
        locals: '/api/locals',
        totems: '/api/totems',
        players: '/api/players',
        dispatcherTotem: '/api/dispatcher-totem',
        dispatcherDebug: '/api/dispatcher-debug',
        media: '/api/media',
        playlists: '/api/playlists',
        campaigns: '/api/campaigns',
        settings: '/api/settings',
        playerApi: '/api/player',
      }
    : {
        health: '/health',
        api: '/api',
        authentication: '/api/auth',
        dashboard: '/api/dashboard',
        users: '/api/users',
        clients: '/api/clients',
        players: '/api/players',
        media: '/api/media',
        playlists: '/api/playlists',
        playerApi: '/api/player',
        admin: '/admin',
      };

  res.json({
    name: APP_NAME,
    version: APP_VERSION,
    type: 'REST API',
    description: APP_DESCRIPTION,
    profile: APP_PROFILE,
    studioMode: bootStudioMode,
    compactMode: bootStudioMode,
    installationProfile: bootInstallationProfile,
    endpoints,
    documentation: '/api/openapi.json',
    swaggerUi: config.server.isDevelopment ? '/api-docs' : null,
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
      profile: APP_PROFILE,
      studioMode: bootStudioMode,
    compactMode: bootStudioMode,
    installationProfile: bootInstallationProfile,
      database: health.database,
      memory: health.memory,
      disk: health.disk,
      uptime: process.uptime()
    });} catch (error: unknown) {
      const e = normalizeError(error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: e.message
    });
  }
});

// System info
app.get('/api/system/info', async (_req, res) => {
  try {
    const systemService = new SystemService();
    const info = await systemService.getSystemInfo();
    res.json({
      ...info,
      profile: APP_PROFILE,
      studioMode: bootStudioMode,
    compactMode: bootStudioMode,
    installationProfile: bootInstallationProfile,
    });} catch (error: unknown) {
      const e = normalizeError(error);
    res.status(500).json({ error: e.message });
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
      profile: APP_PROFILE,
      studioMode: bootStudioMode,
    compactMode: bootStudioMode,
    installationProfile: bootInstallationProfile,
      database: health.database,
      memory: health.memory,
      disk: health.disk,
      uptime: process.uptime()
    });} catch (error: unknown) {
      const e = normalizeError(error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: e.message
    });
  }
});

// Middleware de auditoria para ADMIN_SQL e OPERATOR (aplicar antes das rotas)
app.use('/api', auditSystemUsers as any);

// Validação de acesso por subdomínio (aplicar antes das rotas autenticadas)
if (!bootStudioMode) {
  app.use('/api', validateSubdomainAccess);
}

// Docs JSON (Swagger OpenAPI)
app.get('/api/docs.json', (_req, res) => {
  res.json(openApiSpec);
});

// Player routes (sem autenticação)
import playerValidationRoutes from './routes/player';

app.get(['/player', '/player/'], (_req, res) => {
  res.status(410).json({
    error: 'gone',
    message: 'A página HTML player-web foi retirada. Players de campo: Player-AD, Player-Linux, Player-WOS, Tizen — contrato /api/player/*.'
  });
});

app.use('/api/player/token', playerTokenLimiter);
app.use('/api/player', playerApiLimiter);
app.use('/api/player', playerValidationRoutes);
app.use('/api/player/debug', authMiddleware as any, playerDebugRoutes);
app.use('/api/debug', debugRoutes);

// Catálogo OpenAPI (JSON) — disponível em todos os ambientes
app.get('/api/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

// Swagger UI — só em desenvolvimento (try-it-out)
if (config.server.isDevelopment) {
  const swaggerUi = require('swagger-ui-express');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    customSiteTitle: 'TotemDigital Studio API',
  }));
}

// Servir frontend build quando acessado via backend (evita ChunkLoadError em /static/js/*)
const defaultFrontendBuild = path.resolve(config.email?.frontendBuildPath || '/opt/smart-signage/frontend/build');
const devFrontendBuild = path.join(process.cwd(), '..', 'frontend', 'build');
const frontendBuildPath = fs.existsSync(defaultFrontendBuild)
  ? defaultFrontendBuild
  : path.resolve(devFrontendBuild);
const frontendIndexPath = path.join(frontendBuildPath, 'index.html');
const frontendStaticPath = path.join(frontendBuildPath, 'static');
if (fs.existsSync(frontendBuildPath) && fs.existsSync(frontendIndexPath)) {
  if (fs.existsSync(frontendStaticPath)) {
    app.use('/static', express.static(frontendStaticPath));
    logInfoSync(`[Static] Frontend /static servido de: ${frontendStaticPath}`);
  }
  app.use(express.static(frontendBuildPath, { index: false }));
  const apiPathPrefixes = ['/api', '/health', '/player', '/ws', '/uploads', '/assets', '/api-docs', '/api-docs/'];
  app.get('*', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const p = req.path || '';
    if (apiPathPrefixes.some(prefix => p === prefix || p.startsWith(prefix + '/'))) return next();
    // Verificar se arquivo existe antes de tentar servir
    if (fs.existsSync(frontendIndexPath)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(frontendIndexPath, (err) => {
        if (err) {
          logError(`Erro ao servir index.html: ${err.message}`, err as Error, { path: req.path }).catch(() => {});
          next();
        }
      });
    } else {
      logWarnSync(`Frontend index.html não encontrado em: ${frontendIndexPath}`, { path: req.path });
      next();
    }
  });
}

// 404 e errorHandler: registados em startServer() APÓS registerCompactRoutes/registerProRoutes.
// Se ficarem aqui no topo do ficheiro, capturam POST /api/* antes das rotas async e devolvem 404 no login.

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
    // Workers operacionais (Bull + crons) — antes de fechar Redis
    try {
      await stopOperationalWorkers('Shutdown');
      await logInfo('Workers operacionais parados');
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
    
    // Database
    try {
      await closeDatabase();
      await logInfo('Database desconectado');
    } catch {
      shutdownFailed = true;
    }
    
    // Sair com código de erro se alguma operação falhou
    process.exit(shutdownFailed ? 1 : 0);
} catch (error: unknown) {
    const e = normalizeError(error);
    try {
      await logError('Erro durante shutdown', e.error);
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
    if (bootStudioMode) {
      await logInfo('Smart Signage Studio: perfil mono (single_publisher); paridade API Pro onde aplicável');
    }
    
    // Inicializar database PRIMEIRO (necessário para carregar configurações de mídia)
    await logInfo('Conectando ao database...');
    await initializeDatabase();

    try {
      const dbWarm = createDatabaseWrapper();
      const { warmInstallationRuntime } = await import('./config/installationRuntime');
      const profile = await warmInstallationRuntime(dbWarm);
      await logInfo(`Perfil de instalação ativo: ${profile}`);
      if (profile !== bootInstallationProfile) {
        await logWarn(
          'Perfil de instalação (BD) difere do env no arranque; runtime usa valor da BD',
          { envProfile: bootInstallationProfile, runtimeProfile: profile }
        );
      }
 
} catch (err: unknown) {

      const e = normalizeError(err);
      await logWarn('Perfil de instalação: usando variáveis de ambiente', { error: e.message });
    }
    
    // Conectar query logger para debug online
    try {
      const db = createDatabaseWrapper();
      db.setQueryLogger((query, params, duration, rowCount, error) => {
        dispatcherDebugService.logQuery(query, params, duration, rowCount, error, 'dispatcher');
      });
      await logInfo('Query logger conectado para debug online');
} catch (err: unknown) {
  const e = normalizeError(err);
      await logWarn('Erro ao conectar query logger (debug continuará funcionando)', { error: e.message });
    }
    
    // Carregar configurações de mídia DEPOIS de inicializar o banco
    await logInfo('Carregando configurações de mídia do banco de dados...');
    const { loadMediaConfig } = await import('./config/mediaConfig');
    try {
      await loadMediaConfig();
      await logInfo('Configurações de mídia carregadas do banco de dados');
} catch (err: unknown) {
  const e = normalizeError(err);
      await logWarn('Erro ao carregar configurações de mídia (usando padrões)', { error: e.message });
    }

    // Registrar rotas da API conforme perfil (compacto/pro)
    await logInfo('Registrando rotas da API...');
    registerCompactRoutes(app);
    const { registerExtendedApiRoutes } = await import('./startup/registerExtendedApiRoutes');
    registerExtendedApiRoutes(app);
    const { isStudioRuntime: studioAtBoot } = await import('./config/installationRuntime');
    await logInfo(
      studioAtBoot()
        ? 'Modo Studio: rotas API base + estendidas registadas'
        : 'Modo Pro: rotas API base + estendidas registadas'
    );

    // Handlers finais: obrigatório depois das rotas API (registradas acima de forma assíncrona).
    app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint não encontrado',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });
    app.use(errorHandler);
    
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
 
}} catch (error: unknown) {
      const e = normalizeError(error);
        await logWarn('Erro ao conectar ao Redis, continuando sem cache', { error: e.message });
      }
      
    } else {
      await logInfo('Redis desabilitado (CACHE_ENABLED=false), continuando sem cache e filas');
    }

    const { isStudioRuntime } = await import('./config/installationRuntime');
    const { resolveInstallationCapabilities } = await import('./services/installationProfileService');
    const { buildOperationalWorkerFlags } = await import('./policy/installationPolicy');
    const capsForWorkers = await resolveInstallationCapabilities(createDatabaseWrapper());
    const workerFlags = buildOperationalWorkerFlags(capsForWorkers);
    await logInfo('Workers condicionados às capabilities da instalação', {
      multiAgency: capsForWorkers.multiAgency,
      ...workerFlags,
    });
    if (isStudioRuntime()) {
      const { initializeCompactStartup } = await import('./startup/startupCompact');
      await initializeCompactStartup({
        redisEnabled: config.redis.enabled,
        workerFlags,
      });
    } else {
      const { initializeProStartup } = await import('./startup/startupPro');
      await initializeProStartup({
        redisEnabled: config.redis.enabled,
        workerFlags,
      });
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
        aiProvider: process.env.AI_PROVIDER || 'ollama'
      });
    });} catch (error: unknown) {
      const e = normalizeError(error);
    await logError('Erro ao iniciar servidor', e.error);
    process.exit(1);
  }
}

// Tratamento de erros não capturados: logar e sair para o systemd reiniciar (retomar continuidade).
// IMPORTANTE: estes handlers NÃO PODEM depender do banco/redis (podem estar indisponíveis),
// e NUNCA devem lançar exceções (senão vira loop e o processo cai).
// Saída com exit(1) garante que o systemd (Restart=always) reinicie o serviço.
const FATAL_EXIT_DELAY_MS = 2000;

process.on('uncaughtException', (error: Error) => {
  // eslint-disable-next-line no-console
  console.error('[FATAL][uncaughtException]', error);

  logError('Erro não capturado (uncaughtException)', error, {
    type: 'uncaughtException',
    timestamp: new Date().toISOString(),
  }).catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[FATAL][uncaughtException][logError failed]', e);
  });

  setTimeout(() => process.exit(1), FATAL_EXIT_DELAY_MS);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
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

  setTimeout(() => process.exit(1), FATAL_EXIT_DELAY_MS);
});

// Iniciar servidor
startServer();

export default app;
