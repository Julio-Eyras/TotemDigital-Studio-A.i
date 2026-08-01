import {
  buildPortalHost,
  detectPortalFromHostname,
  normalizePortalSlug,
  validatePortalSlug,
} from '../../../utils/portalHost';

describe('portalHost utils', () => {
  it('valida e normaliza slug', () => {
    expect(normalizePortalSlug(' Rede-X ')).toBe('rede-x');
    expect(validatePortalSlug('loja-abc')).toBe('loja-abc');
    expect(() => validatePortalSlug('www')).toThrow(/reservado/);
    expect(() => validatePortalSlug('-bad')).toThrow(/inválido/);
  });

  it('monta hosts público e local', () => {
    expect(
      buildPortalHost({
        slug: 'acme',
        role: 'publisher',
        baseDomain: 'totemdigital.app.br',
        dnsMode: 'public_wildcard',
      })
    ).toBe('acme.publisher.totemdigital.app.br');
    expect(
      buildPortalHost({
        slug: 'acme',
        role: 'subscriber',
        dnsMode: 'local_dnsmasq',
      })
    ).toBe('acme.subscriber.local');
  });

  it('detecta portal de papel e tenant', () => {
    expect(detectPortalFromHostname('publisher.totemdigital.app.br')).toEqual({
      subdomainType: 'publisher',
      rolePortal: true,
    });
    expect(detectPortalFromHostname('acme.subscriber.totemdigital.app.br')).toEqual({
      subdomainType: 'subscriber',
      tenantSlug: 'acme',
      rolePortal: false,
    });
    expect(detectPortalFromHostname('loja.publisher.local')).toEqual({
      subdomainType: 'publisher',
      tenantSlug: 'loja',
      rolePortal: false,
    });
  });
});
