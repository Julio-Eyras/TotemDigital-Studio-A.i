/**
 * @jest-environment node
 */
import {
  applyMultiAgencyMasterSwitch,
  applyMultiAgencyMode,
  buildCoreOperationPreset,
  buildMultiAgencyLitePreset,
  resolveMultiAgencyMode,
} from '../../../policy/installationModules';

describe('multi-agency master switch helpers', () => {
  it('OFF → núcleo com commercial off', () => {
    const core = buildCoreOperationPreset();
    expect(core.multi_agency).toBe(false);
    expect(core.direct_totem_mode).toBe(true);
    expect(core.billing).toBe(false);
    expect(core.playlists_advanced).toBe(false);
  });

  it('ON preserva portal/FX avançados', () => {
    const on = applyMultiAgencyMasterSwitch(true, {
      ...buildCoreOperationPreset(),
      subscriber_portal: true,
      smart_display_fx: true,
    });
    expect(on.multi_agency).toBe(true);
    expect(on.billing).toBe(true);
    expect(on.subscriber_portal).toBe(true);
    expect(on.smart_display_fx).toBe(true);
    expect(on.direct_totem_mode).toBe(false);
  });

  it('lite liga multi_agency com anunciantes, sem billing/ERP', () => {
    const lite = buildMultiAgencyLitePreset();
    expect(lite.multi_agency).toBe(true);
    expect(lite.direct_totem_mode).toBe(false);
    expect(lite.core_publish).toBe(true);
    expect(lite.subscribers).toBe(true);
    expect(lite.quick_publish).toBe(true);
    expect(lite.campaigns).toBe(true);
    expect(lite.devices).toBe(true);
    expect(lite.billing).toBe(false);
    expect(lite.contracts).toBe(false);
    expect(lite.plans).toBe(false);
    expect(lite.ota).toBe(false);
    expect(resolveMultiAgencyMode(lite)).toBe('lite');
  });

  it('applyMultiAgencyMode cobre off/lite/full', () => {
    expect(applyMultiAgencyMode('off').multi_agency).toBe(false);
    expect(applyMultiAgencyMode('lite').subscribers).toBe(true);
    expect(applyMultiAgencyMode('lite').billing).toBe(false);
    expect(applyMultiAgencyMode('full').billing).toBe(true);
  });
});
