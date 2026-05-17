import {
  getRuntimeInstallationProfile,
  isStudioRuntime,
  resetInstallationRuntimeForTests,
  warmInstallationRuntime,
} from '../../../config/installationRuntime';
import { resetInstallationProfileCache } from '../../../services/installationProfileService';

describe('installationRuntime', () => {
  const originalEnv = process.env.TOTEMDIGITAL_COMPACT;

  afterEach(() => {
    resetInstallationRuntimeForTests();
    resetInstallationProfileCache();
    if (originalEnv === undefined) delete process.env.TOTEMDIGITAL_COMPACT;
    else process.env.TOTEMDIGITAL_COMPACT = originalEnv;
  });

  it('isStudioRuntime segue env por defeito', () => {
    process.env.TOTEMDIGITAL_COMPACT = 'true';
    resetInstallationRuntimeForTests();
    expect(isStudioRuntime()).toBe(true);
    expect(getRuntimeInstallationProfile()).toBe('single_publisher');
  });

  it('warmInstallationRuntime lê installation.profile da BD', async () => {
    process.env.TOTEMDIGITAL_COMPACT = 'false';
    resetInstallationRuntimeForTests();
    const db = {
      findFirst: jest.fn().mockResolvedValue({ setting_value: 'single_publisher' }),
    };
    await warmInstallationRuntime(db as any);
    expect(isStudioRuntime()).toBe(true);
  });
});
