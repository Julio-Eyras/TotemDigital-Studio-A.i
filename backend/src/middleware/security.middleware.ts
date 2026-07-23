/**
 * Security Middleware - Smart Signage v2.1
 * Middlewares de segurança centralizados
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logWarn } from '../utils/loggerHelper';
import { securityConfig, getEnvNumber } from '../config/env';

function playerRateLimitKey(req: Request): string {
  const uin = String(req.query?.uin || (req.body as { uin?: string })?.uin || '').trim();
  if (uin) {
    return `uin:${uin}`;
  }
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Rate limit dedicado à API do player (heartbeat, dispatch, eventos).
 * /api/player estava excluído do apiLimiter global.
 */
export const playerApiLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs,
  max: Math.max(getEnvNumber('PLAYER_API_RATE_LIMIT_MAX', 400), 60),
  message: {
    error: 'Muitas requisições do player. Tente novamente em alguns minutos.',
    retryAfter: '15 minutos',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: playerRateLimitKey,
  handler: (_req, res, _next, options) => {
    const retryAfterSec = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(options.statusCode).json({
      error: 'Muitas requisições do player. Tente novamente em alguns minutos.',
      retryAfter: retryAfterSec,
      retryAfterSeconds: retryAfterSec,
    });
  },
});

/** Limite mais restrito para emissão de token (anti enumeração de UIN). */
export const playerTokenLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs,
  max: Math.max(getEnvNumber('PLAYER_TOKEN_RATE_LIMIT_MAX', 30), 10),
  message: {
    error: 'Muitas solicitações de token do player. Tente novamente em alguns minutos.',
    retryAfter: '15 minutos',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${playerRateLimitKey(req)}:token`,
  handler: (_req, res, _next, options) => {
    const retryAfterSec = Math.ceil(options.windowMs / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(options.statusCode).json({
      error: 'Muitas solicitações de token do player. Tente novamente em alguns minutos.',
      retryAfter: retryAfterSec,
      retryAfterSeconds: retryAfterSec,
    });
  },
});

/**
 * Rate limiter genérico para API
 */
export const apiLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs,
  max: Math.max(securityConfig.rateLimit.maxRequests, 500), // mínimo 500/15min para uso normal do painel
  message: {
    error: 'Muitas requisições. Tente novamente em alguns minutos.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // OBS: este middleware é montado em `app.use('/api', apiLimiter)`,
    // então `req.path` aqui é relativo ao mount (ex.: '/auth/login').
    const fullPath = (req.baseUrl || '') + (req.path || '');

    // Pular rate limit para health checks, estáticos, auth e debug (auth já tem limiter próprio)
    const pathCheck = fullPath || req.path || req.originalUrl || '';
    return pathCheck === '/api/health' ||
           pathCheck.startsWith('/api/health/') ||
           pathCheck.startsWith('/api/auth') ||
           pathCheck.startsWith('/api/static/') ||
           pathCheck.startsWith('/api/assets/') ||
           pathCheck.startsWith('/api/dispatcher-debug/') ||
           pathCheck.startsWith('/api/player') || // /api/player e /api/player-static
           pathCheck.startsWith('/player-static/');
  }
});

/**
 * Rate limiter mais restritivo para autenticação (prevenir brute force)
 * Nota: Usa keyGenerator padrão do express-rate-limit para evitar problemas com IPv6
 */
export const authLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.authWindowMs,
  // Default do env (5) é muito agressivo e causa 429 em uso normal (principalmente em LAN/proxy).
  // Mantemos configurável via ENV, mas garantimos um mínimo razoável.
  max: Math.max(securityConfig.rateLimit.authMaxRequests, 20),
  message: {
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Removido keyGenerator customizado para evitar erro ERR_ERL_KEY_GEN_IPV6
  // O rate limiter padrão já funciona bem para autenticação por IP
});

/**
 * Rate limiter para uploads (prevenir abuso de storage)
 */
export const uploadLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.uploadWindowMs,
  max: securityConfig.rateLimit.uploadMaxRequests,
  message: {
    error: 'Limite de uploads excedido. Tente novamente mais tarde.',
    retryAfter: '1 hora'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter para operações sensíveis (delete, update críticos)
 */
export const sensitiveOperationLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.sensitiveWindowMs,
  max: securityConfig.rateLimit.sensitiveMaxRequests,
  message: {
    error: 'Muitas operações sensíveis. Aguarde alguns minutos.',
    retryAfter: '10 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Middleware para validar tamanho do payload
 */
export const validatePayloadSize = (maxSizeBytes?: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const resolved =
      maxSizeBytes !== undefined && maxSizeBytes !== null
        ? maxSizeBytes
        : securityConfig.maxPayloadSize;
    if (resolved <= 0) {
      next();
      return;
    }

    // Upload multipart: limite vem do multer/nginx, não do Content-Length global
    const contentType = req.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      next();
      return;
    }

    const contentLength = req.get('content-length');

    if (contentLength && parseInt(contentLength, 10) > resolved) {
      logWarn('Payload muito grande rejeitado', {
        size: contentLength,
        maxSize: resolved,
        url: req.url,
        method: req.method,
        ip: req.ip
      }).catch(() => {});
      
      res.status(413).json({
        error: 'Payload muito grande',
        message: `O tamanho máximo permitido é ${Math.round(resolved / 1024 / 1024)}MB`,
        maxSize: resolved
      });
      return;
    }
    
    next();
  };
};

/**
 * Middleware para validar Content-Type em rotas que esperam JSON
 */
export const validateJsonContentType = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.get('content-type');
    
    if (!contentType || !contentType.includes('application/json')) {
      // Permitir multipart/form-data para uploads
      if (contentType && contentType.includes('multipart/form-data')) {
        next();
        return;
      }
      
      res.status(415).json({
        error: 'Content-Type inválido',
        message: 'Esta rota requer Content-Type: application/json',
        received: contentType || 'não fornecido'
      });
      return;
    }
  }
  
  next();
};

/**
 * Middleware para prevenir NoSQL injection (sanitizar query strings)
 */
export const sanitizeQueryParams = (req: Request, _res: Response, next: NextFunction): void => {
  // Sanitizar parâmetros de query removendo caracteres perigosos
  if (req.query) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        // Remover caracteres perigosos comuns em NoSQL injection
        sanitized[key] = value.replace(/[$<>{}[\]\\]/g, '');
      } else {
        sanitized[key] = value;
      }
    }
    req.query = sanitized;
  }
  
  next();
};

/**
 * Middleware para validar origem de requisições (prevenir CSRF básico)
 */
export const validateOrigin = (req: Request, _res: Response, next: NextFunction): void => {
  // Apenas validar em métodos que modificam dados
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  
  const origin = req.get('origin');
  const referer = req.get('referer');
  
  // Se não há origin/referer, pode ser uma requisição direta (API client)
  // Permitir, mas logar para auditoria
  if (!origin && !referer) {
    logWarn('Requisição sem origin/referer', {
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent')
    }).catch(() => {});
  }
  
  // Validação mais rigorosa pode ser adicionada aqui se necessário
  // Por enquanto, confiar no CORS configurado no index.ts
  
  next();
};

