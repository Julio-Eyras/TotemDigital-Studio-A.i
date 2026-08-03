import {
  getInstallationProfileFromEnv,
  InstallationProfile,
  isSinglePublisherInstallation,
} from '../policy/installationPolicy';
import {
  resetInstallationProfileCache,
  resolveInstallationProfile,
} from '../services/installationProfileService';
import { resetCompactOwnerPublisherCache } from '../utils/compactOwnerPublisher';

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
  executeRaw?: (sql: string, params?: unknown[]) => Promise<unknown>;
}): Promise<InstallationProfile> {
  resetInstallationProfileCache();
  runtimeProfile = await resolveInstallationProfile(db);
  resetCompactOwnerPublisherCache();

  // Heal + persist lite antigo (subscribers:false) no arranque, se BD permitir escrita
  if (db?.executeRaw) {
    try {
      const { getInstallationModulesAdminView } = await import(
        '../services/installationModulesService'
      );
      await getInstallationModulesAdminView(db as any);
    } catch {
      /* ignore — capabilities em memória ainda passam pelo heal no merge */
    }
  }

  return runtimeProfile;
}

export function resetInstallationRuntimeForTests(): void {
  runtimeProfile = getInstallationProfileFromEnv();
  resetCompactOwnerPublisherCache();
}
