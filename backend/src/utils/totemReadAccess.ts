/**
 * Autorização de leitura por totem_id (campanhas/QR codes ligados ao totem).
 */
import { getTotemService } from '../services/totemService';
import { isAdminRole } from './tenantScope';
import { isSubscriberTenantRole, resolvePublisherIdFromRequest } from './tenantClientAccess';

export async function assertTotemReadAccess(req: any, totemId: number): Promise<void> {
  if (isAdminRole(req.user?.role)) {
    return;
  }

  const subId = req.subscriberId ?? req.user?.subscriberId ?? req.user?.clientId;

  if (isSubscriberTenantRole(req)) {
    if (subId == null || Number.isNaN(Number(subId))) {
      const err: any = new Error('Acesso negado');
      err.statusCode = 403;
      throw err;
    }
    const ok = await getTotemService().isTotemAccessibleToSubscriber(totemId, Number(subId));
    if (!ok) {
      const err: any = new Error('Acesso negado: totem fora do seu escopo');
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  const publisherId = await resolvePublisherIdFromRequest(req);
  if (publisherId == null) {
    return;
  }

  const totem = await getTotemService().getTotemById(totemId);
  if (!totem) {
    const err: any = new Error('Totem não encontrado');
    err.statusCode = 404;
    throw err;
  }
  if (!totem.publisherId || Number(totem.publisherId) !== Number(publisherId)) {
    const err: any = new Error('Acesso negado: totem não pertence ao seu publisher');
    err.statusCode = 403;
    throw err;
  }
}
