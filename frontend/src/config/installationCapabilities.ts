import {
  defaultInstallationCapabilities,
  InstallationCapabilities,
} from '../types/installationCapabilities';

let snapshot: InstallationCapabilities = defaultInstallationCapabilities();

export function setInstallationCapabilities(caps: InstallationCapabilities): void {
  snapshot = caps;
}

export function getInstallationCapabilities(): InstallationCapabilities {
  return snapshot;
}

export function isStudioInstallation(): boolean {
  return snapshot.profile === 'single_publisher' || snapshot.totemDigitalCompact;
}
