import {
  getInstallationProfileFromEnv,
  InstallationProfile,
  isSinglePublisherInstallation,
} from '../policy/installationPolicy';
import { resolveInstallationProfile } from '../services/installationProfileService';

let runtimeProfile: InstallationProfile = getInstallationProfileFromEnv();

/** Perfil efetivo após warm-up (env + system_settings). */
export function getRuntimeInstallationProfile(): InstallationProfile {
  return runtimeProfile;
}

export function isStudioRuntime(): boolean {
  return isSinglePublisherInstallation(runtimeProfile);
}

export async function warmInstallationRuntime(db?: {
  findFirst: (sql: string, params?: unknown[]) => Promise<{ setting_value?: string } | null>;
}): Promise<InstallationProfile> {
  runtimeProfile = await resolveInstallationProfile(db);
  return runtimeProfile;
}

export function resetInstallationRuntimeForTests(): void {
  runtimeProfile = getInstallationProfileFromEnv();
}
