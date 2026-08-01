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
  const dtFromEnv = process.env.DIRECT_TOTEM_MODE;
  const directTotemDefault =
    dtFromEnv === 'true' ? true : dtFromEnv === 'false' ? false : single;
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
    directTotemMode: directTotemDefault,
  };

  const defaults = buildDefaultInstallationModules({
    multiAgency: base.multiAgency,
    directTotemMode: base.directTotemMode,
    simpleTotemMode: base.simpleTotemMode,
    smartDisplayFx: base.smartDisplayFx,
    subscriberPortal: base.subscriberPortal,
  });

  const modules = mergeInstallationModules(defaults, moduleOverrides);

  // Fase B+: módulos sobrescrevem capabilities legadas (UI + workers no boot)
  return {
    ...base,
    multiAgency: modules.multi_agency,
    totemDigitalCompact: !modules.multi_agency,
    bullExportQueues: modules.multi_agency,
    playlistMixWorker: modules.playlists_advanced === true,
    playlistEngineWorker: modules.playlists_advanced === true,
    alertCron: modules.dispatcher_admin === true || modules.multi_agency === true,
    stripeSubscriptions: modules.billing === true,
    subdomainTenancy: modules.subscriber_portal || modules.multi_agency,
    subscriberPortal: modules.subscriber_portal,
    smartDisplayFx: modules.smart_display_fx,
    simpleTotemMode: modules.simple_totem_mode,
    directTotemMode: modules.direct_totem_mode,
    modules,
  };
}

/** Flags de arranque de workers derivadas das capabilities (Etapa E). */
export function buildOperationalWorkerFlags(caps: InstallationCapabilities): {
  enableBullQueues: boolean;
  enableBillingWorkers: boolean;
  enablePlaylistMix: boolean;
  enablePlaylistEngine: boolean;
  enableAlertCron: boolean;
  enableSubscriberAccessWorker: boolean;
} {
  return {
    enableBullQueues: caps.bullExportQueues === true,
    enableBillingWorkers: caps.stripeSubscriptions === true || caps.modules.billing === true,
    enablePlaylistMix: caps.playlistMixWorker === true,
    enablePlaylistEngine: caps.playlistEngineWorker === true,
    enableAlertCron: caps.alertCron === true,
    enableSubscriberAccessWorker: caps.modules.subscribers === true,
  };
}
