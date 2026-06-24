export type InstallationProfile = 'single_publisher' | 'multi_agency';

export interface InstallationCapabilities {
  profile: InstallationProfile;
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
}

export interface DashboardUiContextResponse {
  disableDirectCampaignTotem: boolean;
  totemDigitalCompact: boolean;
  installationProfile?: InstallationProfile;
  directCampaignTotemHint?: string;
  capabilities: InstallationCapabilities;
}

export function defaultInstallationCapabilities(): InstallationCapabilities {
  const compact = process.env.REACT_APP_TOTEMDIGITAL_COMPACT === 'true';
  return {
    profile: compact ? 'single_publisher' : 'multi_agency',
    totemDigitalCompact: compact,
    multiAgency: !compact,
    publisherBillingForAdmins: true,
    stripeSubscriptions: true,
    playlistMixWorker: true,
    playlistEngineWorker: true,
    alertCron: true,
    bullExportQueues: !compact,
    subdomainTenancy: !compact,
    subscriberPortal: !compact,
    smartDisplayFx: !compact,
    simpleTotemMode: compact,
  };
}
