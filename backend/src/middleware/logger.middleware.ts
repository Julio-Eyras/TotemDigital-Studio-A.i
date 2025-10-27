/**
 * Logger Middleware - Smart Signage v2.0
 * Middleware para logging de requisições
 */

import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/auditService';

export const requestLogger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const startTime = Date.now();
  const originalSend = res.send;

  // Interceptar resposta para calcular tempo de processamento
  res.send = function(data) {
    const processingTime = Date.now() - startTime;
    
    // Log da requisição
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} - ${processingTime}ms`);
    
    // Log de auditoria para requisições autenticadas
    if (req.user?.id && req.method !== 'GET') {
      try {
        const auditService = new AuditService();
        auditService.log('request', req.method.toLowerCase(), req.user.id, {
          url: req.url,
          method: req.method,
          statusCode: res.statusCode,
          processingTime,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }).catch(error => {
          console.error('❌ Erro ao registrar auditoria:', error);
        });
      } catch (error) {
        console.error('❌ Erro ao registrar auditoria:', error);
      }
    }

    return originalSend.call(this, data);
  };

  next();
};
