import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { getDatabase } from '../config/database';
import { getSubscriberService } from '../services/subscriberService';

const ADMIN_DISPATCHER_ROLES = new Set([
  'admin',
  'admin_sql',
  'owner_system',
  'operador_tecnico',
  'operador_faturamento',
  'operador_comercial',
  'gerente_marketing',
  'editoracao',
]);

/**
 * Garante que o utilizador autenticado pode consultar o totem indicado em :totemId.
 */
export async function assertDispatcherTotemScope(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const totemId = parseInt(String(req.params.totemId), 10);
  if (!Number.isFinite(totemId) || totemId <= 0) {
    res.status(400).json({ error: 'totemId inválido' });
    return;
  }

  const role = String(req.user?.role || '').toLowerCase();
  if (ADMIN_DISPATCHER_ROLES.has(role)) {
    next();
    return;
  }

  const db = getDatabase();
  const publisherId = req.user?.publisherId;
  if (publisherId) {
    const row = await db.findFirst(
      `
      SELECT 1 AS ok
      FROM totems t
      INNER JOIN locals l ON l.local_id = t.local_id
      WHERE t.totem_id = $1
        AND l.publisher_id = $2
        AND COALESCE(t.is_active, true) = true
      LIMIT 1
    `,
      [totemId, publisherId]
    );
    if (row) {
      next();
      return;
    }
    res.status(403).json({ error: 'Acesso negado a este totem' });
    return;
  }

  const subscriberId = req.user?.subscriberId;
  if (subscriberId) {
    const ok = await getSubscriberService().validateTotemAccess(subscriberId, totemId);
    if (ok) {
      next();
      return;
    }
    res.status(403).json({ error: 'Acesso negado a este totem' });
    return;
  }

  res.status(403).json({ error: 'Acesso negado' });
}
