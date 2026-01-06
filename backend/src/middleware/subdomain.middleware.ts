/**
 * Middleware de Detecção de Subdomínio
 * Detecta se a requisição vem de publisher.sistema.com ou subscriber.sistema.com
 */

import { Request, Response, NextFunction } from 'express';

export interface SubdomainRequest extends Request {
  subdomainType?: 'publisher' | 'subscriber' | 'main';
}

/**
 * Middleware para detectar subdomínio da requisição
 */
export const detectSubdomain = (
  req: SubdomainRequest, 
  res: Response, 
  next: NextFunction
): void => {
  const hostname = req.hostname || '';
  
  // Extrair subdomínio (primeira parte antes do primeiro ponto)
  const parts = hostname.split('.');
  const subdomain = parts.length > 2 ? parts[0] : '';
  
  // Verificar se é subdomínio conhecido
  if (subdomain === 'publisher') {
    req.subdomainType = 'publisher';
  } else if (subdomain === 'subscriber') {
    req.subdomainType = 'subscriber';
  } else {
    req.subdomainType = 'main';
  }
  
  // Adicionar header para facilitar debug
  res.setHeader('X-Subdomain-Type', req.subdomainType);
  
  next();
};

/**
 * Middleware para validar acesso por subdomínio
 * Bloqueia acesso cruzado (publisher acessando subscriber, etc.)
 */
export const validateSubdomainAccess = (
  req: SubdomainRequest,
  res: Response,
  next: NextFunction
): void => {
  const subdomainType = req.subdomainType;
  const user = (req as any).user;
  
  if (!user) {
    return next(); // Deixar authMiddleware lidar com isso
  }
  
  // Verificar se user_type corresponde ao subdomínio
  // IMPORTANTE: Isolamento de dados - apenas owner_system pode acessar qualquer subdomínio
  // Admin e admin_sql não devem acessar subdomínios de publishers/subscribers para manter isolamento
  if (subdomainType === 'publisher') {
    const isPublisher = user.user_type === 'publisher_user' || user.user_type === 'publisher_subscriber';
    const isOwnerSystem = user.role === 'owner_system';
    
    if (!isPublisher && !isOwnerSystem) {
      res.status(403).json({
        error: 'Acesso negado: Esta interface é exclusiva para publishers ou owner_system',
        code: 'INVALID_SUBDOMAIN_ACCESS'
      });
      return;
    }
  } else if (subdomainType === 'subscriber') {
    const isSubscriber = user.user_type === 'subscriber_user' || user.user_type === 'publisher_subscriber';
    const isOwnerSystem = user.role === 'owner_system';
    
    if (!isSubscriber && !isOwnerSystem) {
      res.status(403).json({
        error: 'Acesso negado: Esta interface é exclusiva para subscribers ou owner_system',
        code: 'INVALID_SUBDOMAIN_ACCESS'
      });
      return;
    }
  }
  
  next();
};
