/**
 * Rate Limiting por Usuário - Smart Signage Pro v3.1
 * Middleware para limitar requisições por usuário autenticado
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { logWarn } from '../utils/loggerHelper';

export interface RateLimitConfig {
  windowMs: number; // Janela de tempo em milissegundos
  maxRequests: number; // Máximo de requisições na janela
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 200, // 200 requisições por minuto (aumentado para evitar bloqueios)
  message: 'Muitas requisições.',
  skipSuccessfulRequests: false,
  skipFailedRequests: false
};

/**
 * Rate limiter por usuário
 */
export const rateLimitByUser = (config: Partial<RateLimitConfig> = {}) => {
  const finalConfig = { ...defaultConfig, ...config };
  const redis = getRedisClient();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Se Redis não está disponível, permitir requisição (sem rate limiting)
    if (!redis) {
      return next();
    }
    
    // Aplicar apenas para usuários autenticados
    const user = (req as any).user;
    if (!user || !user.id) {
      return next();
    }

    const userId = user.id;
    const key = `rate_limit:user:${userId}`;
    const windowStart = Math.floor(Date.now() / finalConfig.windowMs);

    try {
      // Verificar contador atual
      const current = await redis.get(`${key}:${windowStart}`);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= finalConfig.maxRequests) {
        // Limite excedido
        await logWarn('Rate limit excedido por usuário', {
          userId,
          count,
          maxRequests: finalConfig.maxRequests,
          path: req.path
        });

        // Calcular tempo restante até o próximo window
        const timeUntilNextWindow = finalConfig.windowMs - (Date.now() % finalConfig.windowMs);
        const retryAfterSeconds = Math.ceil(timeUntilNextWindow / 1000);
        
        res.status(429).json({
          success: false,
          error: {
            message: `${finalConfig.message} Aguarde ${Math.ceil(retryAfterSeconds / 60)} minuto(s) antes de tentar novamente.`,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: retryAfterSeconds
          }
        });
        res.setHeader('Retry-After', retryAfterSeconds.toString());
        return;
      }

      // Incrementar contador
      await redis.incr(`${key}:${windowStart}`);
      await redis.expire(`${key}:${windowStart}`, Math.ceil(finalConfig.windowMs / 1000));

      // Adicionar headers de rate limit
      res.setHeader('X-RateLimit-Limit', finalConfig.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, finalConfig.maxRequests - count - 1).toString());
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + finalConfig.windowMs).toISOString());

      next();
    } catch (error: unknown) {
      // Em caso de erro no Redis, permitir requisição mas logar
      await logWarn('Erro ao verificar rate limit', {
        error: (error as Error).message,
        userId
      });
      next();
    }
  };
};

/**
 * Rate limiter específico para operações pesadas
 */
export const rateLimitHeavyOperations = rateLimitByUser({
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 20, // 20 operações pesadas por minuto (aumentado)
  message: 'Muitas operações pesadas.'
});

/**
 * Rate limiter para uploads
 */
export const rateLimitUploads = rateLimitByUser({
  windowMs: 60 * 60 * 1000, // 1 hora
  maxRequests: 50, // 50 uploads por hora
  message: 'Limite de uploads excedido. Tente novamente mais tarde.'
});

