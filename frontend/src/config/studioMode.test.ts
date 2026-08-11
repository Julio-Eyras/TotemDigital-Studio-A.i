/**
 * isStudioMode: capabilities da instalação prevalecem sobre o flag de build.
 */

jest.mock('./featureFlags', () => ({
  TOTEMDIGITAL_COMPACT: true,
}));

jest.mock('./installationCapabilities', () => ({
  getInstallationCapabilities: jest.fn(),
}));

import { getInstallationCapabilities } from './installationCapabilities';
import { isStudioMode, isMultiAgencyMode } from './studioMode';

describe('isStudioMode', () => {
  beforeEach(() => {
    getInstallationCapabilities.mockReset();
  });

  it('retorna false em Multi-Agência mesmo com build compacto', () => {
    getInstallationCapabilities.mockReturnValue({
      profile: 'multi_agency',
      multiAgency: true,
      totemDigitalCompact: false,
    });
    expect(isStudioMode()).toBe(false);
    expect(isMultiAgencyMode()).toBe(true);
  });

  it('retorna true em single_publisher / Direct', () => {
    getInstallationCapabilities.mockReturnValue({
      profile: 'single_publisher',
      multiAgency: false,
      totemDigitalCompact: true,
      directTotemMode: true,
    });
    expect(isStudioMode()).toBe(true);
    expect(isMultiAgencyMode()).toBe(false);
  });

  it('trata Direct Totem como instalação única mesmo com perfil multi residual', () => {
    getInstallationCapabilities.mockReturnValue({
      profile: 'multi_agency',
      multiAgency: false,
      totemDigitalCompact: false,
      directTotemMode: true,
    });
    expect(isStudioMode()).toBe(true);
    expect(isMultiAgencyMode()).toBe(false);
  });

  it('trata profile single_publisher como studio', () => {
    getInstallationCapabilities.mockReturnValue({
      profile: 'single_publisher',
      multiAgency: false,
      totemDigitalCompact: false,
    });
    expect(isStudioMode()).toBe(true);
  });
});
