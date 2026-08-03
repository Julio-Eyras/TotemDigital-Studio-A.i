import {
  applyMultiAgencyMasterSwitch,
  applyMultiAgencyMode,
  buildDefaultInstallationModules,
  buildCoreOperationPreset,
  buildMultiAgencyOperationPreset,
  buildMultiAgencyLitePreset,
  healStaleMultiAgencyLiteModules,
  mergeInstallationModules,
  resolveMultiAgencyMode,
  validateInstallationModuleDependencies,
} from '../../../policy/installationModules';

describe('installationModules', () => {
  it('núcleo fica sempre ligado após merge', () => {
    const defaults = buildDefaultInstallationModules({
      multiAgency: false,
      directTotemMode: true,
      simpleTotemMode: true,
      smartDisplayFx: false,
      subscriberPortal: false,
    });
    const merged = mergeInstallationModules(defaults, {
      core_publish: false,
      organization: false,
      billing: true,
      plans: true,
    });
    expect(merged.core_publish).toBe(true);
    expect(merged.organization).toBe(true);
    expect(merged.billing).toBe(true);
  });

  it('valida dependências de billing → plans', () => {
    const flags = buildDefaultInstallationModules({
      multiAgency: false,
      directTotemMode: false,
      simpleTotemMode: false,
      smartDisplayFx: false,
      subscriberPortal: false,
    });
    flags.billing = true;
    flags.plans = false;
    const errors = validateInstallationModuleDependencies(flags);
    expect(errors.some((e) => e.includes('Financeiro'))).toBe(true);
  });

  it('preset multi-agência ON liga pacote e desliga Direct Totem', () => {
    const on = buildMultiAgencyOperationPreset();
    expect(on.multi_agency).toBe(true);
    expect(on.direct_totem_mode).toBe(false);
    expect(on.subscribers).toBe(true);
    expect(on.billing).toBe(true);
    expect(on.subscriber_portal).toBe(false);
    expect(on.smart_display_fx).toBe(false);
  });

  it('preset lite liga anunciantes sem ERP Pro', () => {
    const lite = buildMultiAgencyLitePreset();
    expect(lite.multi_agency).toBe(true);
    expect(lite.subscribers).toBe(true);
    expect(lite.quick_publish).toBe(true);
    expect(lite.campaigns).toBe(true);
    expect(lite.billing).toBe(false);
    expect(lite.contracts).toBe(false);
    expect(lite.plans).toBe(false);
    expect(resolveMultiAgencyMode(lite)).toBe('lite');
  });

  it('heal corrige lite antigo sem anunciantes no merge', () => {
    const defaults = buildDefaultInstallationModules({
      multiAgency: true,
      directTotemMode: false,
      simpleTotemMode: false,
      smartDisplayFx: false,
      subscriberPortal: false,
    });
    const merged = mergeInstallationModules(defaults, {
      multi_agency: true,
      subscribers: false,
      quick_publish: true,
      campaigns: true,
      billing: false,
      plans: false,
      contracts: false,
      commercial_reports: false,
      ota: false,
      dispatcher_admin: false,
      analytics: false,
      playlists_advanced: false,
      direct_totem_mode: false,
    });
    expect(merged.subscribers).toBe(true);
    expect(merged.devices).toBe(true);
    expect(resolveMultiAgencyMode(merged)).toBe('lite');
  });

  it('healStaleMultiAgencyLiteModules não altera Pro', () => {
    const full = buildMultiAgencyOperationPreset();
    expect(healStaleMultiAgencyLiteModules(full)).toEqual(full);
  });

  it('preset núcleo OFF restaura Direct Totem', () => {
    const off = buildCoreOperationPreset();
    expect(off.multi_agency).toBe(false);
    expect(off.direct_totem_mode).toBe(true);
    expect(off.billing).toBe(false);
    expect(off.core_publish).toBe(true);
  });

  it('master switch preserva portal/FX avançados só no ON', () => {
    const current = buildMultiAgencyOperationPreset({
      subscriber_portal: true,
      smart_display_fx: true,
    });
    const stillOn = applyMultiAgencyMasterSwitch(true, current);
    expect(stillOn.subscriber_portal).toBe(true);
    expect(stillOn.smart_display_fx).toBe(true);
    const off = applyMultiAgencyMasterSwitch(false, current);
    expect(off.subscriber_portal).toBe(false);
    expect(off.smart_display_fx).toBe(false);
    expect(off.direct_totem_mode).toBe(true);
  });

  it('applyMultiAgencyMode lite usa preset com anunciantes', () => {
    const lite = applyMultiAgencyMode('lite');
    expect(lite.subscribers).toBe(true);
    expect(lite.billing).toBe(false);
  });
});
