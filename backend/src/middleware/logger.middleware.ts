/**
 * Logger Middleware - Smart Signage v2.0
 * Middleware para logging de requisições
 */

import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/auditService';
import { logInfo, logError } from '../utils/loggerHelper';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const originalSend = res.send;

  // Interceptar resposta para calcular tempo de processamento
  res.send = function(data) {
    const processingTime = Date.now() - startTime;
    
    // Log da requisição (não bloqueante)
    logInfo('Requisição processada', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      processingTime,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }).catch(() => {
      // Fallback silencioso se logging falhar
    });
    
    // Log de auditoria para requisições autenticadas (não bloqueante)
    if (req.user?.id && req.method !== 'GET') {
      (async () => {
        try {
          const auditService = new AuditService();
          await auditService.log('request', req.method.toLowerCase(), req.user.id, {
            url: req.url,
            method: req.method,
            statusCode: res.statusCode,
            processingTime,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          });
        } catch (error) {
          logError('Erro ao registrar auditoria no request logger', error, {
            method: req.method,
            url: req.url,
            userId: req.user?.id
          }).catch(() => {
            // Fallback silencioso se logging falhar
          });
        }
      })();
    }

    return originalSend.call(this, data);
  };

  next();
};
