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

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TOTEMDIGITAL_COMPACT;
    } else {
      process.env.TOTEMDIGITAL_COMPACT = originalEnv;
    }
  });

  it('single_publisher quando TOTEMDIGITAL_COMPACT=true', () => {
    process.env.TOTEMDIGITAL_COMPACT = 'true';
    expect(getInstallationProfileFromEnv()).toBe('single_publisher');
    expect(isSinglePublisherInstallation()).toBe(true);
    const caps = buildInstallationCapabilities();
    expect(caps.bullExportQueues).toBe(false);
    expect(caps.subscriberPortal).toBe(false);
    expect(caps.smartDisplayFx).toBe(false);
  });

  it('multi_agency quando TOTEMDIGITAL_COMPACT não está ativo', () => {
    delete process.env.TOTEMDIGITAL_COMPACT;
    expect(getInstallationProfileFromEnv()).toBe('multi_agency');
    const caps = buildInstallationCapabilities();
    expect(caps.bullExportQueues).toBe(true);
    expect(caps.smartDisplayFx).toBe(true);
  });
});
