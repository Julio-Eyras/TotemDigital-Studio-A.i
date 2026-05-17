import { TOTEMDIGITAL_COMPACT } from '../config/featureFlags';

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
}

/** Perfil derivado do ambiente (build/deploy). DB pode refinir via installationProfileService. */
export function getInstallationProfileFromEnv(): InstallationProfile {
  return TOTEMDIGITAL_COMPACT ? 'single_publisher' : 'multi_agency';
}

export function isSinglePublisherInstallation(profile?: InstallationProfile): boolean {
  return (profile ?? getInstallationProfileFromEnv()) === 'single_publisher';
}

export function buildInstallationCapabilities(
  profile: InstallationProfile = getInstallationProfileFromEnv()
): InstallationCapabilities {
  const single = profile === 'single_publisher';
  return {
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
    smartDisplayFx: !single,
  };
}
