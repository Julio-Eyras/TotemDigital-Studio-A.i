/**
 * Middleware de Detecção de Subdomínio / portal por slug
 * - publisher.dominio / subscriber.dominio → portal de papel
 * - {slug}.publisher.dominio / {slug}.subscriber.dominio → tenant
 * - Headers Nginx: X-Subdomain-Type, X-Tenant-Slug (opcional)
 * - Isolamento JWT ↔ tenant: enforcePortalTenantAccess (pós-auth)
 */

import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../config/database';
import { detectPortalFromHostname } from '../utils/portalHost';
import {
  checkPortalTenantAccess,
  PortalTenantResolved,
} from '../utils/portalTenantAccess';
import { resolvePortalTenantBySlug } from '../services/portalHostService';
import { logError } from '../utils/loggerHelper';

export interface SubdomainRequest extends Request {
  subdomainType?: 'publisher' | 'subscriber' | 'main';
  tenantSlug?: string;
  rolePortal?: boolean;
  portalTenant?: PortalTenantResolved;
}

export const detectSubdomain = async (
  req: SubdomainRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
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

    const role = req.subdomainType;
    if (
      req.tenantSlug &&
      (role === 'publisher' || role === 'subscriber')
    ) {
      const tenant = await resolvePortalTenantBySlug(getDatabase() as any, req.tenantSlug, role);
      if (!tenant) {
        res.status(404).json({
          error: `Tenant «${req.tenantSlug}» não encontrado neste portal`,
          code: 'UNKNOWN_TENANT_SLUG',
        });
        return;
      }
      req.portalTenant = {
        role: tenant.role,
        slug: tenant.slug,
        publisherId: tenant.publisherId,
        subscriberId: tenant.subscriberId,
      };
      res.setHeader('X-Portal-Tenant-Id', String(tenant.publisherId ?? tenant.subscriberId ?? ''));
    }

    next();
  } catch (error) {
    await logError('Erro ao resolver tenant do portal', error);
    res.status(500).json({
      error: 'Erro ao resolver tenant do portal',
      code: 'PORTAL_TENANT_RESOLVE_ERROR',
    });
  }
};

/**
 * Valida acesso por subdomínio (papel do portal).
 * Isolamento por slug: ver enforcePortalTenantAccess (após auth).
 * Nota: usa userType (camelCase), não user_type.
 */
export const validateSubdomainAccess = (
  req: SubdomainRequest,
  res: Response,
  next: NextFunction
): void => {
  const subdomainType = req.subdomainType;
  const user = (req as any).user as
    | { role?: string; userType?: string; user_type?: string }
    | undefined;

  if (!user) {
    return next();
  }

  const userType = user.userType || user.user_type;

  if (subdomainType === 'publisher') {
    const isPublisher = userType === 'publisher_user';
    const isOwnerSystem = user.role === 'owner_system';

    if (!isPublisher && !isOwnerSystem) {
      res.status(403).json({
        error: 'Acesso negado: Esta interface é exclusiva para publishers ou owner_system',
        code: 'INVALID_SUBDOMAIN_ACCESS',
      });
      return;
    }
  } else if (subdomainType === 'subscriber') {
    const isSubscriber =
      userType === 'subscriber_user' ||
      user.role === 'subscriber' ||
      user.role === 'subscriber_user' ||
      user.role === 'client';
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

/**
 * Após auth: host com slug força o tenant do JWT.
 * Sem portalTenant → no-op. Sem user → no-op (401 fica a cargo do auth).
 */
export const enforcePortalTenantAccess = (
  req: SubdomainRequest,
  res: Response,
  next: NextFunction
): void => {
  const result = checkPortalTenantAccess(
    req.portalTenant,
    (req as any).user,
    (req as any).subscriberId
  );
  if (!result.ok) {
    res.status(result.status).json({
      error: result.error,
      code: result.code,
    });
    return;
  }
  next();
};
