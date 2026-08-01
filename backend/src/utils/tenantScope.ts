/**
 * Escopo de tenant para agregações (analytics, dashboard, etc.).
 * `null` = visão global (apenas papéis admin).
 */
import { isStudioRuntime } from '../config/installationRuntime';
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
 * Se o host portal força tenant (`portalTenant`), esse escopo prevalece
 * (exceto owner_system, que mantém visão global via isAdminRole).
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
  portalTenant?: {
    role: 'publisher' | 'subscriber';
    publisherId?: number;
    subscriberId?: number;
  };
}): Promise<TenantScope | null> {
  if (req.portalTenant && req.user?.role !== 'owner_system') {
    if (req.portalTenant.role === 'publisher' && req.portalTenant.publisherId != null) {
      return { scopedPublisherId: Number(req.portalTenant.publisherId) };
    }
    if (req.portalTenant.role === 'subscriber' && req.portalTenant.subscriberId != null) {
      return { scopedSubscriberId: Number(req.portalTenant.subscriberId) };
    }
  }

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

  if (isStudioRuntime()) {
    const ownerId = await resolveCompactOwnerPublisherId(getDatabase());
    if (!ownerId) return { scopedPublisherId: -1 };
    return { scopedPublisherId: ownerId };
  }

  const pid = req.user?.publisherId;
  if (pid == null) return { scopedPublisherId: -1 };
  return { scopedPublisherId: Number(pid) };
}
