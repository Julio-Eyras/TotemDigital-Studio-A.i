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

export function isSimpleTotemMode(): boolean {
  return getInstallationCapabilities().simpleTotemMode;
}
