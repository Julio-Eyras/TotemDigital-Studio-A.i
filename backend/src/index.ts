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
import { closeExportQueue, closeAdvancedScheduleQueue } from './config/queue';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware';
import { responseFormatMiddleware } from './middleware/responseFormat.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import { auditSystemUsers } from './middleware/auditSystemUsers.middleware';
import { detectSubdomain, validateSubdomainAccess } from './middleware/subdomain.middleware';
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
import { TOTEMDIGITAL_COMPACT } from './config/featureFlags';
import { registerCompactRoutes } from './startup/registerCompactRoutes';
import debugRoutes from './routes/debug';
import playerDebugRoutes from './routes/player-debug';

// Services
import { SystemService } from './services/systemService';

const app = express();
const PORT = config.server.port;
const HOST = config.server.host;
const APP_PROFILE = TOTEMDIGITAL_COMPACT ? 'totemdigital-compact' : 'smartsignage-pro';

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
if (!TOTEMDIGITAL_COMPACT) {
  app.use(detectSubdomain);
}

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
  try {
    const base = getStoragePath();
    if (!base) {
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225" role="img" aria-label="Mídia não encontrada"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#0f172a"/></linearGradient></defs><rect width="400" height="225" fill="url(#bg)"/><rect x="32" y="32" width="336" height="161" rx="12" ry="12" fill="none" stroke="#475569" stroke-width="2" stroke-dasharray="6 6"/><text x="150" y="110" fill="#e5e7eb" font-family="system-ui,sans-serif" font-size="18">Pré-visualização indisponível</text></svg>`;
      res.status(200).type('image/svg+xml').send(placeholderSvg.trim());
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
      // Fallback amigável: se o arquivo físico não existe (ex.: mídias demo não copiadas),
      // devolver um SVG simples em vez de 404 para evitar erros visuais na UI.
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
  const endpoints = TOTEMDIGITAL_COMPACT
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
        player: '/player',
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
        player: '/player',
        admin: '/admin',
      };

  res.json({
    name: APP_NAME,
    version: APP_VERSION,
    type: 'REST API',
    description: APP_DESCRIPTION,
    profile: APP_PROFILE,
    compactMode: TOTEMDIGITAL_COMPACT,
    endpoints,
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
      profile: APP_PROFILE,
      compactMode: TOTEMDIGITAL_COMPACT,
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
    res.json({
      ...info,
      profile: APP_PROFILE,
      compactMode: TOTEMDIGITAL_COMPACT,
    });
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
      profile: APP_PROFILE,
      compactMode: TOTEMDIGITAL_COMPACT,
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
if (!TOTEMDIGITAL_COMPACT) {
  app.use('/api', validateSubdomainAccess);
}

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
  '/opt/smart-signage/player-web', // Diretório de produção (install copia aqui)
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

// IMPORTANTE: Rota /api/player-static/* DEVE vir ANTES de todas as rotas app.use('/api/...')
// para evitar que outras rotas interceptem antes.
// Usar regex para capturar todo o path (propagandas/vinhetas/arquivo.mp4, js/app.js, etc.)
app.get(/^\/api\/player-static\/(.*)$/, (req, res) => {
  const subpathRaw = (req.params[0] || '').replace(/^\//, '');
  if (!subpathRaw) {
    return res.status(404).end();
  }

  const filePath = path.join(playerDir, subpathRaw);
  const resolvedPlayer = path.resolve(playerDir);
  const resolvedFile = path.resolve(filePath);

  // Garantir que o arquivo está dentro de playerDir (evita path traversal)
  if (!resolvedFile.startsWith(resolvedPlayer)) {
    return res.status(403).end();
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    logWarn(`[Player Static] Arquivo não encontrado: ${req.path} -> ${filePath} (playerDir: ${playerDir})`);
    return res.status(404).end();
  }

  if (filePath.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  } else if (filePath.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
  } else if (filePath.endsWith('.json')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  logInfoSync(`[Player Static] ✅ Servindo: ${req.path} -> ${filePath}`);
  return res.sendFile(filePath);
});

// Servir arquivos estáticos do player (js/, css/, etc.)
// IMPORTANTE: Este middleware DEVE vir ANTES das rotas app.get('/player') e app.get('/player/')
// Middleware global que intercepta /player/* antes das rotas específicas
app.use((req, res, next) => {
  // Só processar requisições para /player/* que não sejam exatamente /player ou /player/
  if (!req.path.startsWith('/player/')) {
    return next();
  }
  
  // Se é exatamente /player ou /player/, deixar para rotas abaixo
  if (req.path === '/player' || req.path === '/player/') {
    return next();
  }
  
  // Extrair subpath: /player/js/app.js -> js/app.js
  const subpath = req.path.slice('/player/'.length);
  
  // Construir caminho completo do arquivo
  const filePath = path.join(playerDir, subpath);
  
  // Verificar path traversal (garantir que não sai do playerDir)
  const resolvedPlayerDir = path.resolve(playerDir);
  const resolvedFilePath = path.resolve(filePath);
  if (!resolvedFilePath.startsWith(resolvedPlayerDir)) {
    logWarn(`[Player] Path traversal bloqueado: ${req.path} -> ${filePath}`);
    return res.status(403).end();
  }
  
  // Verificar se arquivo existe
  if (!fs.existsSync(filePath)) {
    logWarn(`[Player] Arquivo não encontrado: ${req.path} -> ${filePath}`);
    logWarn(`[Player] playerDir: ${playerDir}, subpath: ${subpath}`);
    logWarn(`[Player] Diretório existe? ${fs.existsSync(playerDir)}`);
    if (fs.existsSync(playerDir)) {
      const jsPath = path.join(playerDir, 'js');
      logWarn(`[Player] js/ existe? ${fs.existsSync(jsPath)}`);
      if (fs.existsSync(jsPath)) {
        const files = fs.readdirSync(jsPath);
        logWarn(`[Player] Arquivos em js/: ${files.join(', ')}`);
      }
    }
    return next();
  }
  
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return next();
  }
  
  // Servir arquivo
  logInfoSync(`[Player] ✅ Servindo: ${req.path} -> ${filePath}`);
  res.removeHeader('Strict-Transport-Security');
  res.removeHeader('Upgrade-Insecure-Requests');
  if (filePath.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  } else if (filePath.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
  } else if (filePath.endsWith('.json')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  res.sendFile(filePath);
});

// Servir player index.html com suporte a UIN como parâmetro
// Usar playerDir (já resolvido na inicialização) em vez de config.player.path para evitar "Player não encontrado"
const playerIndexPath = path.join(playerDir, 'index.html');

app.get('/player', (req, res) => {
  // Se é um arquivo estático (js/, css/, etc.) que não foi encontrado, retornar 404
  if (req.path !== '/player' && req.path.startsWith('/player/')) {
    const pathWithoutPrefix = req.path.substring('/player'.length);
    if (!pathWithoutPrefix.endsWith('/') && 
        !pathWithoutPrefix.match(/\.(js|css|json|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i)) {
      logWarn(`[Player] Arquivo estático não encontrado: ${req.path}`);
      return res.status(404).json({ error: 'Arquivo não encontrado', path: req.path });
    }
  }
  if (fs.existsSync(playerIndexPath)) {
    res.removeHeader('Strict-Transport-Security');
    res.removeHeader('Upgrade-Insecure-Requests');
    return res.sendFile(playerIndexPath);
  }
  logWarn(`[Server] Arquivo index.html do player não encontrado: ${playerIndexPath} (playerDir: ${playerDir})`);
  return res.status(404).json({ error: 'Player não encontrado' });
});

// Também servir /player/ (com barra final) - necessário para URLs com query string
app.get('/player/', (_req, res) => {
  if (fs.existsSync(playerIndexPath)) {
    res.removeHeader('Strict-Transport-Security');
    res.removeHeader('Upgrade-Insecure-Requests');
    return res.sendFile(playerIndexPath);
  }
  logWarn(`[Server] Arquivo index.html do player não encontrado: ${playerIndexPath} (playerDir: ${playerDir})`);
  return res.status(404).json({ error: 'Player não encontrado' });
});

// API de validação do player (antes do middleware de autenticação)
app.use('/api/player', playerValidationRoutes);
app.use('/api/player/debug', authMiddleware as any, playerDebugRoutes); // Debug de transações do player (requer autenticação)
app.use('/api/debug', debugRoutes); // Debug endpoints (logs, diagnóstico)

// Diagnóstico do player (público, para descobrir por que /player/js/* retorna 404)
app.get('/api/debug/player-static', (_req, res) => {
  const files = {
    'js/activationCode.js': fs.existsSync(path.join(playerDir, 'js', 'activationCode.js')),
    'js/app.js': fs.existsSync(path.join(playerDir, 'js', 'app.js')),
    'js/api/client.js': fs.existsSync(path.join(playerDir, 'js', 'api', 'client.js')),
    'js/cache/MediaCacheManager.js': fs.existsSync(path.join(playerDir, 'js', 'cache', 'MediaCacheManager.js')),
    'js/cache/PlaylistChangeDetector.js': fs.existsSync(path.join(playerDir, 'js', 'cache', 'PlaylistChangeDetector.js')),
    'index.html': fs.existsSync(path.join(playerDir, 'index.html'))
  };
  const allExist = Object.values(files).every(Boolean);
  res.json({
    playerDir,
    filesExist: files,
    allJsPresent: allExist,
    message: allExist
      ? 'Backend tem os arquivos. Se ainda 404, o Nginx NÃO está fazendo proxy de /player para o backend.'
      : 'Backend NÃO encontra os arquivos. Copie player-web para ' + playerDir + ' e reinicie o backend.'
  });
});

app.get('/player/config', async (_req, res) => {
  try {
    const systemService = new SystemService();
    const config = await systemService.getPlayerConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API Documentation
if (config.server.isDevelopment) {
  const swaggerUi = require('swagger-ui-express');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
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
    if (TOTEMDIGITAL_COMPACT) {
      await logInfo('Modo TotemDigital compacto ativo (mono; dono/admin com paridade de API Pro onde aplicável)');
    }
    
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

    // Registrar rotas da API conforme perfil (compacto/pro)
    await logInfo('Registrando rotas da API...');
    registerCompactRoutes(app);
    if (TOTEMDIGITAL_COMPACT) {
      const { registerCompactProParityRoutes } = await import('./startup/registerCompactProParityRoutes');
      registerCompactProParityRoutes(app);
      await logInfo('Modo compacto: rotas Pro de paridade registadas (API alinhada ao dono/admin)');
    } else {
      const { registerProRoutes } = await import('./startup/registerProRoutes');
      registerProRoutes(app);
    }

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
        }
      } catch (error: any) {
        await logWarn('Erro ao conectar ao Redis, continuando sem cache', { error: error.message });
      }
      
    } else {
      await logInfo('Redis desabilitado (CACHE_ENABLED=false), continuando sem cache e filas');
    }

    if (TOTEMDIGITAL_COMPACT) {
      const { initializeCompactStartup } = await import('./startup/startupCompact');
      await initializeCompactStartup({ redisEnabled: config.redis.enabled });
    } else {
      const { initializeProStartup } = await import('./startup/startupPro');
      await initializeProStartup({ redisEnabled: config.redis.enabled });
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

      // Servir index.html do player (mesmo playerDir da app principal)
      playerApp.get('/', (_req, res) => {
        if (fs.existsSync(playerIndexPath)) {
          res.sendFile(playerIndexPath);
        } else {
          logWarn(`[Player Server] Arquivo index.html não encontrado: ${playerIndexPath}`);
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

  setTimeout(() => process.exit(1), FATAL_EXIT_DELAY_MS);
});

// Iniciar servidor
startServer();

export default app;
