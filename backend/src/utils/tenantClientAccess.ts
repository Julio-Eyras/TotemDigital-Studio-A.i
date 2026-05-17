/**
 * Autorização para parâmetros de rota do tipo "cliente" (subscriber / publisher).
 * Usado em dashboard por cliente, campanhas por cliente, etc.
 */
import { getDatabase } from '../config/database';
import { isStudioRuntime } from '../config/installationRuntime';
import { resolveCompactOwnerPublisherId } from './compactOwnerPublisher';
import { isAdminRole } from './tenantScope';

export type TenantClientParamAccessOptions = {
  /**
   * Quando true (ex.: estatísticas do dashboard), publisher pode passar o próprio `publisher_id`
   * na URL para visão agregada do publisher.
   * Quando false (ex.: campanhas por `subscriber_id`), o id deve ser de assinante com vínculo ao plano.
   */
  allowPublisherViewOwnPublisherId?: boolean;
  /**
   * Quando true, `requestedId` é sempre um `publisher_id` (ex.: contrato de publisher).
   * Apenas o publisher dono (token) ou admin passa; não interpreta o id como `subscriber_id` na query de plano.
   */
  requestedIdIsPublisherScope?: boolean;
};

function isSubscriberLikeRole(req: any): boolean {
  const role = req.user?.role || '';
  return (
    role === 'subscriber' ||
    role === 'subscriber_user' ||
    req.user?.userType === 'subscriber_user'
  );
}

/** Token/compact → publisher_id (para escopo de API). */
export async function resolvePublisherIdFromRequest(req: any): Promise<number | undefined> {
  let publisherId = req.user?.publisherId != null ? Number(req.user.publisherId) : undefined;
  if (isStudioRuntime() && (publisherId == null || Number.isNaN(publisherId))) {
    const ownerId = await resolveCompactOwnerPublisherId(getDatabase());
    if (ownerId) publisherId = ownerId;
  }
  return publisherId != null && !Number.isNaN(publisherId) ? publisherId : undefined;
}

async function resolvePublisherIdForAccess(req: any): Promise<number | undefined> {
  return resolvePublisherIdFromRequest(req);
}

/** Assinante/cliente na UI (lista de campanhas, etc.). */
export function isSubscriberTenantRole(req: any): boolean {
  const role = req.user?.role || '';
  return (
    role === 'client' ||
    role === 'subscriber' ||
    role === 'subscriber_user' ||
    req.user?.userType === 'subscriber_user'
  );
}

/**
 * Garante que o usuário só acesse dados do assinante (ou publisher próprio quando permitido)
 * conforme o mesmo modelo do dashboard.
 */
export async function assertTenantClientParamAccess(
  req: any,
  requestedId: number,
  options?: TenantClientParamAccessOptions
): Promise<void> {
  const allowPublisherSelf = options?.allowPublisherViewOwnPublisherId === true;

  if (isAdminRole(req.user?.role)) {
    return;
  }

  const role = req.user?.role || '';
  const tokenSubscriberId = req.subscriberId ?? req.user?.subscriberId;

  if (role === 'client') {
    if (req.user?.clientId == null || Number(req.user.clientId) !== Number(requestedId)) {
      const err: any = new Error('Acesso negado');
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  if (isSubscriberLikeRole(req)) {
    if (!tokenSubscriberId || Number(tokenSubscriberId) !== Number(requestedId)) {
      const err: any = new Error('Acesso negado');
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  if (options?.requestedIdIsPublisherScope === true) {
    const pubId = await resolvePublisherIdForAccess(req);
    if (pubId == null || Number(requestedId) !== Number(pubId)) {
      const err: any = new Error('Acesso negado');
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  const publisherId = await resolvePublisherIdForAccess(req);

  if (publisherId != null && Number(requestedId) === Number(publisherId)) {
    if (allowPublisherSelf) {
      return;
    }
    const err: any = new Error(
      'Acesso negado: este recurso é escopado por assinante; informe o subscriber_id'
    );
    err.statusCode = 403;
    throw err;
  }

  if (publisherId == null) {
    const err: any = new Error('Acesso negado');
    err.statusCode = 403;
    throw err;
  }

  const linked = await getDatabase().findFirst(
    `
    SELECT 1 AS ok
    FROM subscriber_contracts sc
    INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
      AND ppa.publisher_id = ?
      AND ppa.is_allowed = true
      AND COALESCE(ppa.is_active, true) = true
    WHERE sc.subscriber_id = ?
      AND sc.status = 'active'
      AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
      AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
    LIMIT 1
  `,
    [publisherId, requestedId]
  );

  if (!linked) {
    const err: any = new Error('Acesso negado: sem vínculo com este cliente ou publisher');
    err.statusCode = 403;
    throw err;
  }
}
