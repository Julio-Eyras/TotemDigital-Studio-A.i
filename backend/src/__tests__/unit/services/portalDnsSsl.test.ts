import {
  buildPortalWildcardDnsPlan,
  syncCloudflarePortalDns,
} from '../../../services/portalDnsCloudflareService';
import { buildPortalWildcardSslPlan } from '../../../services/portalSslService';

describe('portalDnsCloudflareService', () => {
  it('planeia 4 registos A sem proxy', () => {
    const plan = buildPortalWildcardDnsPlan('totemdigital.app.br', '203.0.113.10');
    expect(plan).toHaveLength(4);
    expect(plan.map((p) => p.name)).toEqual([
      '*.publisher.totemdigital.app.br',
      '*.subscriber.totemdigital.app.br',
      'publisher.totemdigital.app.br',
      'subscriber.totemdigital.app.br',
    ]);
    expect(plan.every((p) => p.proxied === false)).toBe(true);
  });

  it('dry-run não chama API', async () => {
    const fetchImpl = jest.fn();
    const result = await syncCloudflarePortalDns({
      baseDomain: 'example.test',
      zoneId: 'zone',
      targetIpv4: '1.2.3.4',
      dryRun: true,
      fetchImpl: fetchImpl as any,
    });
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.planned).toHaveLength(4);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('portalSslService plan', () => {
  it('monta SANs wildcard dns-01', () => {
    const plan = buildPortalWildcardSslPlan({
      baseDomain: 'totemdigital.app.br',
      email: 'ops@example.com',
    });
    expect(plan.challenge).toBe('dns-01');
    expect(plan.domains).toContain('*.publisher.totemdigital.app.br');
    expect(plan.domains).toContain('totemdigital.app.br');
    expect(plan.email).toBe('ops@example.com');
  });
});
