/**
 * Autorização explícita para escrita/gestão de faturamento (subscriber + publisher billing).
 * Inclui owner_system, papéis tenant de faturamento e, no modo compacto mono, o publicador dono.
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { TOTEMDIGITAL_COMPACT } from '../config/featureFlags';

const norm = (r: string | undefined) => String(r || '').trim().toLowerCase();

const TENANT_BILLING_ROLES = new Set([
  'admin',
  'admin_sql',
  'operador_faturamento',
  'gerente_financeiro',
]);

/**
 * POST/PUT em faturas (APIs modernas). `owner_system` incluído de forma explícita na documentação;
 * o middleware global `authorizeRole` já faz bypass para owner_system — aqui garantimos o mesmo
 * contrato num único sítio legível e permitimos `publisher_user` só em TOTEMDIGITAL_COMPACT.
 */
export const authorizeBillingManagement = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Usuário não autenticado',
      code: 'NOT_AUTHENTICATED',
    });
    return;
  }

  const r = norm(req.user.role);
  if (r === 'owner_system') {
    next();
    return;
  }
  if (TENANT_BILLING_ROLES.has(r)) {
    next();
    return;
  }
  if (TOTEMDIGITAL_COMPACT && r === 'publisher_user') {
    next();
    return;
  }

  res.status(403).json({
    error: 'Acesso negado. Permissões insuficientes para gestão de faturamento.',
    code: 'INSUFFICIENT_PERMISSIONS',
  });
};
