import { TOTEMDIGITAL_COMPACT } from './featureFlags';
import { getInstallationCapabilities } from './installationCapabilities';

/**
 * Modo Studio / single_publisher: preferir capabilities da API; fallback env de build.
 */
export function isStudioMode(): boolean {
  return getInstallationCapabilities().totemDigitalCompact || TOTEMDIGITAL_COMPACT;
}

export function isMultiAgencyMode(): boolean {
  return getInstallationCapabilities().multiAgency && !isStudioMode();
}
