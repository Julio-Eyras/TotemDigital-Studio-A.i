import {
  buildInstallationCapabilities,
  getInstallationProfileFromEnv,
  isSinglePublisherInstallation,
} from '../../../policy/installationPolicy';

jest.mock('../../../config/featureFlags', () => ({
  get TOTEMDIGITAL_COMPACT(): boolean {
    return process.env.TOTEMDIGITAL_COMPACT === 'true';
  },
}));

describe('installationPolicy', () => {
  const originalEnv = process.env.TOTEMDIGITAL_COMPACT;
  const originalDt = process.env.DIRECT_TOTEM_MODE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TOTEMDIGITAL_COMPACT;
    } else {
      process.env.TOTEMDIGITAL_COMPACT = originalEnv;
    }
    if (originalDt === undefined) {
      delete process.env.DIRECT_TOTEM_MODE;
    } else {
      process.env.DIRECT_TOTEM_MODE = originalDt;
    }
  });

  it('single_publisher quando TOTEMDIGITAL_COMPACT=true', () => {
    process.env.TOTEMDIGITAL_COMPACT = 'true';
    delete process.env.DIRECT_TOTEM_MODE;
    expect(getInstallationProfileFromEnv()).toBe('single_publisher');
    expect(isSinglePublisherInstallation()).toBe(true);
    const caps = buildInstallationCapabilities();
    expect(caps.bullExportQueues).toBe(false);
    expect(caps.subscriberPortal).toBe(false);
    expect(caps.smartDisplayFx).toBe(false);
    expect(caps.simpleTotemMode).toBe(true);
    expect(caps.directTotemMode).toBe(true);
    expect(caps.modules.core_publish).toBe(true);
    expect(caps.modules.multi_agency).toBe(false);
    expect(caps.playlistMixWorker).toBe(false);
    expect(caps.playlistEngineWorker).toBe(false);
    expect(caps.stripeSubscriptions).toBe(false);
  });

  it('multi_agency quando TOTEMDIGITAL_COMPACT não está ativo', () => {
    delete process.env.TOTEMDIGITAL_COMPACT;
    delete process.env.DIRECT_TOTEM_MODE;
    expect(getInstallationProfileFromEnv()).toBe('multi_agency');
    const caps = buildInstallationCapabilities();
    expect(caps.bullExportQueues).toBe(true);
    expect(caps.smartDisplayFx).toBe(true);
    expect(caps.directTotemMode).toBe(false);
    expect(caps.modules.multi_agency).toBe(true);
    expect(caps.playlistMixWorker).toBe(true);
    expect(caps.playlistEngineWorker).toBe(true);
    expect(caps.stripeSubscriptions).toBe(true);
  });

  it('buildOperationalWorkerFlags reflecte modules', () => {
    const { buildOperationalWorkerFlags } = require('../../../policy/installationPolicy');
    process.env.TOTEMDIGITAL_COMPACT = 'true';
    delete process.env.DIRECT_TOTEM_MODE;
    const studio = buildOperationalWorkerFlags(buildInstallationCapabilities());
    expect(studio.enableBullQueues).toBe(false);
    expect(studio.enablePlaylistMix).toBe(false);
    expect(studio.enableBillingWorkers).toBe(false);

    delete process.env.TOTEMDIGITAL_COMPACT;
    const pro = buildOperationalWorkerFlags(buildInstallationCapabilities());
    expect(pro.enableBullQueues).toBe(true);
    expect(pro.enablePlaylistMix).toBe(true);
    expect(pro.enableBillingWorkers).toBe(true);
  });
});
