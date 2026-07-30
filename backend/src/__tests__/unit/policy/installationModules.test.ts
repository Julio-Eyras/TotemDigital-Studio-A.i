import {
  buildDefaultInstallationModules,
  mergeInstallationModules,
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
});
