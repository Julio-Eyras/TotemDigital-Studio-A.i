/**
 * No modo TotemDigital compacto, gestores (admin roles) usam apenas faturamento de anunciantes na UI.
 * Bloqueia API publisher-billing para esses papéis; publisher_user mantém acesso.
 */
import { Response, NextFunction } from 'express';
import { TOTEMDIGITAL_COMPACT } from '../config/featureFlags';
import { isAdminRole } from '../utils/tenantScope';
import { AuthenticatedRequest } from './auth.middleware';

export function compactPublisherBillingGuard(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!TOTEMDIGITAL_COMPACT) {
    next();
    return;
  }
  if (!req.user || !isAdminRole(req.user.role)) {
    next();
    return;
  }
  res.status(403).json({
    success: false,
    error:
      'Faturamento de exibidor não está disponível no modo compacto para gestores. Use faturamento de anunciantes.',
    code: 'COMPACT_PUBLISHER_BILLING_DISABLED',
  });
}
