/**
 * @jest-environment node
 */
import {
  applyMultiAgencyMasterSwitch,
  buildCoreOperationPreset,
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
});
