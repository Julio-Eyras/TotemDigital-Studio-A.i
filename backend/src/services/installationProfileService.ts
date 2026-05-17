import {
  buildInstallationCapabilities,
  getInstallationProfileFromEnv,
  InstallationCapabilities,
  InstallationProfile,
} from '../policy/installationPolicy';

let cachedProfile: InstallationProfile | undefined;
let cachedCapabilities: InstallationCapabilities | undefined;

const VALID_PROFILES = new Set<InstallationProfile>(['single_publisher', 'multi_agency']);

function parseProfile(raw: unknown): InstallationProfile | undefined {
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim() as InstallationProfile;
  return VALID_PROFILES.has(normalized) ? normalized : undefined;
}

/**
 * Resolve perfil: env (TOTEMDIGITAL_COMPACT) + opcional override em system_settings.installation.profile
 */
export async function resolveInstallationProfile(db?: {
  findFirst: (sql: string, params?: unknown[]) => Promise<{ setting_value?: string } | null>;
}): Promise<InstallationProfile> {
  if (cachedProfile) return cachedProfile;

  const envProfile = getInstallationProfileFromEnv();
  if (!db) {
    cachedProfile = envProfile;
    return envProfile;
  }

  try {
    const row = await db.findFirst(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'installation.profile' LIMIT 1`
    );
    const fromDb = parseProfile(row?.setting_value);
    cachedProfile = fromDb ?? envProfile;
    return cachedProfile;
  } catch {
    cachedProfile = envProfile;
    return envProfile;
  }
}

export async function resolveInstallationCapabilities(db?: {
  findFirst: (sql: string, params?: unknown[]) => Promise<{ setting_value?: string } | null>;
}): Promise<InstallationCapabilities> {
  if (cachedCapabilities) return cachedCapabilities;
  const profile = await resolveInstallationProfile(db);
  cachedCapabilities = buildInstallationCapabilities(profile);
  return cachedCapabilities;
}

export function resetInstallationProfileCache(): void {
  cachedProfile = undefined;
  cachedCapabilities = undefined;
}
