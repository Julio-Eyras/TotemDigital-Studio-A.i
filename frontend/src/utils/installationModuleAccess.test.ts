import { resolveModuleForPath } from './installationModuleAccess';

jest.mock('../config/installationCapabilities', () => ({
  getInstallationCapabilities: () => ({
    modules: {
      campaigns: false,
      billing: true,
      core_publish: true,
      organization: true,
    },
  }),
}));

describe('installationModuleAccess', () => {
  it('mapeia /campaigns → campaigns', () => {
    expect(resolveModuleForPath('/campaigns')).toBe('campaigns');
    expect(resolveModuleForPath('/campaigns/1')).toBe('campaigns');
  });

  it('núcleo e complementos admin sem módulo complementar', () => {
    expect(resolveModuleForPath('/media')).toBeNull();
    expect(resolveModuleForPath('/publish-totem')).toBeNull();
    expect(resolveModuleForPath('/settings/system-modules')).toBeNull();
  });
});
