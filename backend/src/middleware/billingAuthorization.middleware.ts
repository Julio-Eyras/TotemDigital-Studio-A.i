/**
 * Autorização explícita para escrita/gestão de faturamento (subscriber + publisher billing).
 * Inclui `owner_system` (dono do produto; no mono compacto alinha-se ao exibidor único),
 * papéis tenant de faturamento e, no modo compacto mono, o `publisher_user` operador do exibidor.
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { isStudioRuntime } from '../config/installationRuntime';
import { getDatabase } from '../config/database';

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
 * contrato num único sítio legível e permitimos `publisher_user` só em isStudioRuntime().
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
  if (isStudioRuntime() && r === 'publisher_user') {
    next();
    return;
  }

  res.status(403).json({
    error: 'Acesso negado. Permissões insuficientes para gestão de faturamento.',
    code: 'INSUFFICIENT_PERMISSIONS',
  });
};

function canManageBilling(req: AuthenticatedRequest): boolean {
  if (!req.user) return false;
  const r = norm(req.user.role);
  if (r === 'owner_system') return true;
  if (TENANT_BILLING_ROLES.has(r)) return true;
  if (isStudioRuntime() && r === 'publisher_user') return true;
  return false;
}

/**
 * Gestão de faturamento OU anunciante pagando a própria fatura (stripe-checkout).
 */
export const authorizeBillingManagementOrSubscriberSelf = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Usuário não autenticado', code: 'NOT_AUTHENTICATED' });
    return;
  }
  if (canManageBilling(req)) {
    next();
    return;
  }

  const r = norm(req.user.role);
  if (r !== 'subscriber_user') {
    res.status(403).json({
      error: 'Acesso negado.',
      code: 'INSUFFICIENT_PERMISSIONS',
    });
    return;
  }

  const billingId = parseInt(String(req.params.id || ''), 10);
  const subscriberId = req.user.subscriberId ?? (req.user as { subscriber_id?: number }).subscriber_id;
  if (!Number.isFinite(billingId) || !subscriberId) {
    res.status(403).json({ error: 'Acesso negado.', code: 'INSUFFICIENT_PERMISSIONS' });
    return;
  }

  try {
    const row = (await getDatabase().findFirst(
      `SELECT subscriber_id, payment_status FROM subscriber_billing WHERE billing_id = $1`,
      [billingId]
    )) as { subscriber_id: number; payment_status: string } | null;
    if (!row || row.subscriber_id !== subscriberId) {
      res.status(403).json({ error: 'Fatura não pertence a este anunciante.', code: 'FORBIDDEN' });
      return;
    }
    if (row.payment_status === 'paid') {
      res.status(400).json({ success: false, message: 'Fatura já paga' });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: 'Erro ao validar fatura', code: 'INTERNAL_ERROR' });
  }
};

/**
 * Gestão de faturamento OU exibidor pagando fatura incoming própria (stripe-checkout).
 */
export const authorizeBillingManagementOrPublisherSelf = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Usuário não autenticado', code: 'NOT_AUTHENTICATED' });
    return;
  }
  if (canManageBilling(req)) {
    next();
    return;
  }

  const r = norm(req.user.role);
  if (r !== 'publisher_user') {
    res.status(403).json({ error: 'Acesso negado.', code: 'INSUFFICIENT_PERMISSIONS' });
    return;
  }

  const billingId = parseInt(String(req.params.id || ''), 10);
  const publisherId = req.user.publisherId ?? (req.user as { publisher_id?: number }).publisher_id;
  if (!Number.isFinite(billingId) || !publisherId) {
    res.status(403).json({ error: 'Acesso negado.', code: 'INSUFFICIENT_PERMISSIONS' });
    return;
  }

  try {
    const row = (await getDatabase().findFirst(
      `SELECT publisher_id, direction, payment_status FROM publisher_billing WHERE billing_id = $1`,
      [billingId]
    )) as { publisher_id: number; direction: string; payment_status: string } | null;

    if (!row || row.publisher_id !== publisherId) {
      res.status(403).json({ error: 'Fatura não pertence a este exibidor.', code: 'FORBIDDEN' });
      return;
    }
    if (row.direction !== 'incoming') {
      res.status(400).json({ success: false, message: 'Apenas faturas de entrada podem ser pagas online' });
      return;
    }
    if (row.payment_status === 'paid') {
      res.status(400).json({ success: false, message: 'Fatura já paga' });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: 'Erro ao validar fatura', code: 'INTERNAL_ERROR' });
  }
};
