import type { InstallationCapabilities } from '../types/installationCapabilities';

export type InstallationMode = 'off' | 'lite' | 'full';

const INSTALLATION_MODE_LABELS: Record<InstallationMode, string> = {
  off: 'Direct Totem',
  lite: 'Multi-agência Lite',
  full: 'Multi-agência Pro',
};

export function resolveInstallationMode(
  capabilities: InstallationCapabilities
): InstallationMode {
  const modules = capabilities.modules;
  if (!modules.multi_agency) return 'off';

  const isPro =
    modules.billing ||
    modules.plans ||
    modules.contracts ||
    modules.commercial_reports ||
    modules.ota ||
    modules.analytics ||
    modules.playlists_advanced;

  return isPro ? 'full' : 'lite';
}

export function getInstallationModeLabel(mode: InstallationMode): string {
  return INSTALLATION_MODE_LABELS[mode];
}

export function getInstallationModeOptionLabel(
  option: InstallationMode,
  activeMode: InstallationMode
): string {
  return `${getInstallationModeLabel(option)} (${option === activeMode ? 'On' : 'Off'})`;
}
