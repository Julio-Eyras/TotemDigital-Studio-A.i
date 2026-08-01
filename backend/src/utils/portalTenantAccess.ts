/**
 * Regras puras de isolamento JWT ↔ tenant do host (portal slug).
 * Usado pelo middleware após auth; testável sem Express.
 */

export type PortalTenantResolved = {
  role: 'publisher' | 'subscriber';
  slug: string;
  publisherId?: number;
  subscriberId?: number;
};

export type PortalTenantUser = {
  role?: string;
  publisherId?: number;
  subscriberId?: number;
  clientId?: number;
  userType?: string;
};

export type PortalTenantAccessResult =
  | { ok: true }
  | { ok: false; status: 403; code: string; error: string };

/** Apenas owner_system pode cruzar tenants em host com slug. */
export function canBypassPortalTenant(user?: PortalTenantUser | null): boolean {
  return user?.role === 'owner_system';
}

/**
 * Verifica se o utilizador autenticado pode operar no tenant forçado pelo host.
 * Sem portalTenant → ok (main / role portal sem slug).
 * Sem user → ok (rotas públicas; auth trata 401 depois).
 */
export function checkPortalTenantAccess(
  portalTenant: PortalTenantResolved | undefined | null,
  user: PortalTenantUser | undefined | null,
  reqSubscriberId?: number
): PortalTenantAccessResult {
  if (!portalTenant) return { ok: true };
  if (!user) return { ok: true };
  if (canBypassPortalTenant(user)) return { ok: true };

  if (portalTenant.role === 'publisher') {
    const pid = user.publisherId != null ? Number(user.publisherId) : NaN;
    if (!Number.isFinite(pid) || pid !== Number(portalTenant.publisherId)) {
      return {
        ok: false,
        status: 403,
        code: 'TENANT_HOST_MISMATCH',
        error: 'Acesso negado: o utilizador não pertence a esta organização (portal).',
      };
    }
    return { ok: true };
  }

  const subId =
    reqSubscriberId ??
    user.subscriberId ??
    user.clientId;
  const sid = subId != null ? Number(subId) : NaN;
  if (!Number.isFinite(sid) || sid !== Number(portalTenant.subscriberId)) {
    return {
      ok: false,
      status: 403,
      code: 'TENANT_HOST_MISMATCH',
      error: 'Acesso negado: o utilizador não pertence a este anunciante (portal).',
    };
  }
  return { ok: true };
}

/**
 * Garante que o id de recurso pedido coincide com o tenant do host (quando há slug).
 */
export function assertResourceMatchesPortalTenant(
  portalTenant: PortalTenantResolved | undefined | null,
  resource: { publisherId?: number; subscriberId?: number }
): PortalTenantAccessResult {
  if (!portalTenant) return { ok: true };

  if (portalTenant.role === 'publisher' && resource.publisherId != null) {
    if (Number(resource.publisherId) !== Number(portalTenant.publisherId)) {
      return {
        ok: false,
        status: 403,
        code: 'TENANT_HOST_MISMATCH',
        error: 'Acesso negado: recurso fora do tenant do host.',
      };
    }
  }

  if (portalTenant.role === 'subscriber' && resource.subscriberId != null) {
    if (Number(resource.subscriberId) !== Number(portalTenant.subscriberId)) {
      return {
        ok: false,
        status: 403,
        code: 'TENANT_HOST_MISMATCH',
        error: 'Acesso negado: recurso fora do tenant do host.',
      };
    }
  }

  return { ok: true };
}
