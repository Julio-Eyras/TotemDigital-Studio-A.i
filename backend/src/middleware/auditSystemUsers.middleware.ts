/**
 * Audit System Users Middleware
 * Audita todas as ações de ADMIN_SQL e OPERATOR
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { AuditService } from '../services/auditService';

const auditService = new AuditService();

/**
 * Middleware para auditar ações de ADMIN_SQL e OPERATOR
 * Todas as ações desses usuários devem ser registradas para auditoria
 */
export const auditSystemUsers = async (
  req: Request | AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user && (authReq.user.role === 'admin_sql' || authReq.user.role === 'operator')) {
    // Capturar resposta original
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    
    let statusCode = 200;
    res.status = function (code: number) {
      statusCode = code;
      return originalStatus(code);
    };

    res.json = function (body: any) {
      // Registrar auditoria (não bloquear se falhar)
      auditService.log(
        'system',
        `${req.method.toLowerCase()}_${req.path.replace(/\//g, '_').replace(/[^a-z0-9_]/gi, '')}`,
        authReq.user!.id,
        {
          role: authReq.user!.role,
          method: req.method,
          path: req.path,
          statusCode,
          query: req.query,
          body: sanitizeForAudit(req.body),
          responseSize: body ? JSON.stringify(body).length : 0
        }
      ).catch(() => {
        // Não bloquear se auditoria falhar
      });

      return originalJson(body);
    };
  }

  next();
};

/**
 * Remove dados sensíveis do body antes de auditar
 */
function sanitizeForAudit(body: any): any {
  if (!body) return body;
  
  if (typeof body !== 'object') return body;
  
  const sanitized = Array.isArray(body) ? [...body] : { ...body };
  
  // Remover dados sensíveis
  const sensitiveFields = ['password', 'password_hash', 'token', 'secret', 'api_key', 'private_key'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }
  
  return sanitized;
}

