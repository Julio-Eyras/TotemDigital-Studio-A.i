import {
  assertResourceMatchesPortalTenant,
  checkPortalTenantAccess,
} from '../../../utils/portalTenantAccess';

describe('portalTenantAccess', () => {
  const pubTenant = {
    role: 'publisher' as const,
    slug: 'acme',
    publisherId: 10,
  };
  const subTenant = {
    role: 'subscriber' as const,
    slug: 'loja',
    subscriberId: 20,
  };

  it('sem portalTenant → ok', () => {
    expect(checkPortalTenantAccess(undefined, { role: 'admin', publisherId: 1 })).toEqual({
      ok: true,
    });
  });

  it('sem user → ok (rota pública / pré-auth)', () => {
    expect(checkPortalTenantAccess(pubTenant, null)).toEqual({ ok: true });
  });

  it('owner_system bypass', () => {
    expect(
      checkPortalTenantAccess(pubTenant, { role: 'owner_system', publisherId: 99 })
    ).toEqual({ ok: true });
  });

  it('publisher match / mismatch', () => {
    expect(
      checkPortalTenantAccess(pubTenant, {
        role: 'publisher',
        userType: 'publisher_user',
        publisherId: 10,
      })
    ).toEqual({ ok: true });

    const bad = checkPortalTenantAccess(pubTenant, {
      role: 'publisher',
      userType: 'publisher_user',
      publisherId: 11,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe('TENANT_HOST_MISMATCH');
  });

  it('subscriber match / mismatch (incl. clientId)', () => {
    expect(
      checkPortalTenantAccess(subTenant, {
        role: 'subscriber_user',
        userType: 'subscriber_user',
        subscriberId: 20,
      })
    ).toEqual({ ok: true });

    expect(
      checkPortalTenantAccess(subTenant, {
        role: 'client',
        clientId: 20,
      })
    ).toEqual({ ok: true });

    const bad = checkPortalTenantAccess(subTenant, {
      role: 'subscriber_user',
      subscriberId: 21,
    });
    expect(bad.ok).toBe(false);
  });

  it('assertResourceMatchesPortalTenant', () => {
    expect(assertResourceMatchesPortalTenant(pubTenant, { publisherId: 10 })).toEqual({
      ok: true,
    });
    const bad = assertResourceMatchesPortalTenant(pubTenant, { publisherId: 99 });
    expect(bad.ok).toBe(false);
    expect(assertResourceMatchesPortalTenant(subTenant, { subscriberId: 20 })).toEqual({
      ok: true,
    });
  });
});
