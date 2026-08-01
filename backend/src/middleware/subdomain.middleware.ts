/**
 * Middleware de Detecção de Subdomínio / portal por slug
 * - publisher.dominio / subscriber.dominio → portal de papel
 * - {slug}.publisher.dominio / {slug}.subscriber.dominio → tenant
 * - Headers Nginx: X-Subdomain-Type, X-Tenant-Slug (opcional)
 */

import { Request, Response, NextFunction } from 'express';
import { detectPortalFromHostname } from '../utils/portalHost';

export interface SubdomainRequest extends Request {
  subdomainType?: 'publisher' | 'subscriber' | 'main';
  tenantSlug?: string;
  rolePortal?: boolean;
}

export const detectSubdomain = (
  req: SubdomainRequest,
  res: Response,
  next: NextFunction
): void => {
  const hostname = req.hostname || req.headers.host?.split(':')[0] || '';
  const detected = detectPortalFromHostname(hostname);

  const headerType = String(req.headers['x-subdomain-type'] || '').toLowerCase();
  const headerSlug = String(req.headers['x-tenant-slug'] || '').trim().toLowerCase();

  if (headerType === 'publisher' || headerType === 'subscriber' || headerType === 'main') {
    req.subdomainType = headerType;
  } else {
    req.subdomainType = detected.subdomainType;
  }

  req.tenantSlug = headerSlug || detected.tenantSlug;
  req.rolePortal = Boolean(detected.rolePortal && !req.tenantSlug);

  res.setHeader('X-Subdomain-Type', req.subdomainType || 'main');
  if (req.tenantSlug) {
    res.setHeader('X-Tenant-Slug', req.tenantSlug);
  }

  next();
};

/**
 * Valida acesso por subdomínio.
 * Isolamento: só owner_system cruza portais; publisher_user / subscriber_user no respectivo portal.
 */
export const validateSubdomainAccess = (
  req: SubdomainRequest,
  res: Response,
  next: NextFunction
): void => {
  const subdomainType = req.subdomainType;
  const user = (req as any).user;

  if (!user) {
    return next();
  }

  if (subdomainType === 'publisher') {
    const isPublisher = user.user_type === 'publisher_user';
    const isOwnerSystem = user.role === 'owner_system';

    if (!isPublisher && !isOwnerSystem) {
      res.status(403).json({
        error: 'Acesso negado: Esta interface é exclusiva para publishers ou owner_system',
        code: 'INVALID_SUBDOMAIN_ACCESS',
      });
      return;
    }
  } else if (subdomainType === 'subscriber') {
    const isSubscriber = user.user_type === 'subscriber_user';
    const isOwnerSystem = user.role === 'owner_system';

    if (!isSubscriber && !isOwnerSystem) {
      res.status(403).json({
        error: 'Acesso negado: Esta interface é exclusiva para subscribers ou owner_system',
        code: 'INVALID_SUBDOMAIN_ACCESS',
      });
      return;
    }
  }

  next();
};
