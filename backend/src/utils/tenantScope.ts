/**
 * Escopo de tenant para agregações (analytics, dashboard, etc.).
 * `null` = visão global (apenas papéis admin).
 */
import { TOTEMDIGITAL_COMPACT } from '../config/featureFlags';
import { getDatabase } from '../config/database';
import { resolveCompactOwnerPublisherId } from './compactOwnerPublisher';

export interface TenantScope {
  scopedPublisherId?: number;
  scopedSubscriberId?: number;
}

const ADMIN_ROLES = new Set([
  'admin',
  'admin_sql',
  'owner_system',
  'operador_tecnico',
  'operador_faturamento',
  'operador_comercial'
]);

export function isAdminRole(role?: string): boolean {
  return ADMIN_ROLES.has(role || '');
}

/**
 * Resolve escopo a partir do request autenticado (admin → null).
 */
export async function resolveTenantScope(req: {
  user?: {
    role?: string;
    clientId?: number;
    publisherId?: number;
    subscriberId?: number;
    userType?: string;
  };
  subscriberId?: number;
}): Promise<TenantScope | null> {
  if (isAdminRole(req.user?.role)) {
    return null;
  }

  const role = req.user?.role || '';

  if (role === 'client') {
    const cid = req.user?.clientId;
    if (cid == null) return { scopedSubscriberId: -1 };
    return { scopedSubscriberId: Number(cid) };
  }

  const subId = req.subscriberId ?? req.user?.subscriberId;
  const isSubscriberRole =
    role === 'subscriber' || role === 'subscriber_user' || req.user?.userType === 'subscriber_user';

  if (isSubscriberRole) {
    if (!subId) return { scopedSubscriberId: -1 };
    return { scopedSubscriberId: Number(subId) };
  }

  if (TOTEMDIGITAL_COMPACT) {
    const ownerId = await resolveCompactOwnerPublisherId(getDatabase());
    if (!ownerId) return { scopedPublisherId: -1 };
    return { scopedPublisherId: ownerId };
  }

  const pid = req.user?.publisherId;
  if (pid == null) return { scopedPublisherId: -1 };
  return { scopedPublisherId: Number(pid) };
}
