import { getInstallationCapabilities } from './installationCapabilities';

/** Modo Publicar em Totem — branch SmartSignage-direc-totem */
export function isDirectTotemMode(): boolean {
  return getInstallationCapabilities().directTotemMode;
}

export function getAppHomePath(): string {
  return isDirectTotemMode() ? '/publish-totem' : '/dashboard';
}
