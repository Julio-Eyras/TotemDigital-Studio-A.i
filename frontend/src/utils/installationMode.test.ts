import { defaultInstallationCapabilities } from '../types/installationCapabilities';
import {
  getInstallationModeOptionLabel,
  resolveInstallationMode,
} from './installationMode';

describe('installationMode', () => {
  it('identifica Direct Totem quando multi-agência está desligado', () => {
    const capabilities = defaultInstallationCapabilities();
    capabilities.modules.multi_agency = false;

    expect(resolveInstallationMode(capabilities)).toBe('off');
    expect(getInstallationModeOptionLabel('off', 'off')).toBe('Direct Totem (On)');
    expect(getInstallationModeOptionLabel('lite', 'off')).toBe('Multi-agência Lite (Off)');
  });

  it('distingue os modos Lite e Pro pelos módulos avançados', () => {
    const capabilities = defaultInstallationCapabilities();
    capabilities.modules.multi_agency = true;
    capabilities.modules.billing = false;
    capabilities.modules.plans = false;
    capabilities.modules.contracts = false;
    capabilities.modules.commercial_reports = false;
    capabilities.modules.ota = false;
    capabilities.modules.analytics = false;
    capabilities.modules.playlists_advanced = false;

    expect(resolveInstallationMode(capabilities)).toBe('lite');

    capabilities.modules.billing = true;
    expect(resolveInstallationMode(capabilities)).toBe('full');
    expect(getInstallationModeOptionLabel('full', 'full')).toBe('Multi-agência Pro (On)');
  });
});
