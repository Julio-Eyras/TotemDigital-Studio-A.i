export type InstallationProfile = 'single_publisher' | 'multi_agency';

export type InstallationModuleId =
  | 'core_publish'
  | 'organization'
  | 'multi_agency'
  | 'subscribers'
  | 'campaigns'
  | 'playlists_advanced'
  | 'quick_publish'
  | 'contracts'
  | 'billing'
  | 'plans'
  | 'commercial_reports'
  | 'devices'
  | 'ota'
  | 'dispatcher_admin'
  | 'smart_display_fx'
  | 'analytics'
  | 'subscriber_portal'
  | 'direct_totem_mode'
  | 'simple_totem_mode';

export type InstallationModuleFlags = Record<InstallationModuleId, boolean>;

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
  directTotemMode: boolean;
  /** Complementos de produto (instalação). Distinto de flag_smart_*. */
  modules: InstallationModuleFlags;
}

export interface DashboardUiContextResponse {
  disableDirectCampaignTotem: boolean;
  totemDigitalCompact: boolean;
  installationProfile?: InstallationProfile;
  directCampaignTotemHint?: string;
  capabilities: InstallationCapabilities;
}

function defaultModules(compact: boolean, directTotem: boolean): InstallationModuleFlags {
  const dt = directTotem;
  return {
    core_publish: true,
    organization: true,
    direct_totem_mode: dt,
    simple_totem_mode: compact,
    multi_agency: !compact,
    subscribers: !dt,
    subscriber_portal: !compact,
    campaigns: !dt && !compact,
    playlists_advanced: !dt,
    quick_publish: !dt,
    contracts: !dt,
    plans: !dt,
    billing: !dt,
    commercial_reports: !dt && !compact,
    devices: !dt,
    ota: !dt,
    dispatcher_admin: true,
    smart_display_fx: !compact,
    analytics: !dt,
  };
}

export function defaultInstallationCapabilities(): InstallationCapabilities {
  const compact = process.env.REACT_APP_TOTEMDIGITAL_COMPACT === 'true';
  const directTotem = process.env.REACT_APP_DIRECT_TOTEM_MODE !== 'false';
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
    directTotemMode: directTotem,
    modules: defaultModules(compact, directTotem),
  };
}

export function isInstallationModuleEnabled(
  caps: InstallationCapabilities | undefined,
  moduleId: InstallationModuleId
): boolean {
  return caps?.modules?.[moduleId] === true;
}
