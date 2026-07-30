import { TOTEMDIGITAL_COMPACT } from '../config/featureFlags';
import {
  InstallationModuleFlags,
  buildDefaultInstallationModules,
  mergeInstallationModules,
} from './installationModules';

export type InstallationProfile = 'single_publisher' | 'multi_agency';

export interface InstallationCapabilities {
  profile: InstallationProfile;
  /** Alias histórico: modo mono / Studio */
  totemDigitalCompact: boolean;
  multiAgency: boolean;
  publisherBillingForAdmins: boolean;
  stripeSubscriptions: boolean;
  playlistMixWorker: boolean;
  playlistEngineWorker: boolean;
  alertCron: boolean;
  bullExportQueues: boolean;
  subdomainTenancy: boolean;
  subscriberPortal: boolean;
  smartDisplayFx: boolean;
  simpleTotemMode: boolean;
  /** Branch direc-totem: menu Publicar em Totem, uma organização. */
  directTotemMode: boolean;
  /**
   * Complementos de produto (instalação). Distinto de flag_smart_* (permissão de utilizador).
   * Fase A: expostos para UI admin; Fase B: gates de menu/API.
   */
  modules: InstallationModuleFlags;
}

/** Perfil derivado do ambiente (build/deploy). DB pode refinir via installationProfileService. */
export function getInstallationProfileFromEnv(): InstallationProfile {
  const compact =
    process.env.TOTEMDIGITAL_COMPACT === 'true' || TOTEMDIGITAL_COMPACT;
  return compact ? 'single_publisher' : 'multi_agency';
}

export function isSinglePublisherInstallation(profile?: InstallationProfile): boolean {
  return (profile ?? getInstallationProfileFromEnv()) === 'single_publisher';
}

export function buildInstallationCapabilities(
  profile: InstallationProfile = getInstallationProfileFromEnv(),
  simpleTotemMode?: boolean,
  moduleOverrides?: Partial<Record<string, boolean>> | null
): InstallationCapabilities {
  const single = profile === 'single_publisher';
  const simple =
    simpleTotemMode ??
    (process.env.SIMPLE_TOTEM_MODE_DEFAULT === 'true' ||
      (process.env.SIMPLE_TOTEM_MODE_DEFAULT !== 'false' && single));
  const base = {
    profile,
    totemDigitalCompact: single,
    multiAgency: !single,
    publisherBillingForAdmins: true,
    stripeSubscriptions: true,
    playlistMixWorker: true,
    playlistEngineWorker: true,
    alertCron: true,
    bullExportQueues: !single,
    subdomainTenancy: !single,
    subscriberPortal: !single,
    /** Studio/mono: menu oculto; rotas API mantidas para evolução futura. */
    smartDisplayFx: !single,
    simpleTotemMode: simple,
    directTotemMode: process.env.DIRECT_TOTEM_MODE !== 'false',
  };

  const defaults = buildDefaultInstallationModules({
    multiAgency: base.multiAgency,
    directTotemMode: base.directTotemMode,
    simpleTotemMode: base.simpleTotemMode,
    smartDisplayFx: base.smartDisplayFx,
    subscriberPortal: base.subscriberPortal,
  });

  const modules = mergeInstallationModules(defaults, moduleOverrides);

  return {
    ...base,
    modules,
  };
}
