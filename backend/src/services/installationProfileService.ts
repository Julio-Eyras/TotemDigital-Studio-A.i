import {
  buildInstallationCapabilities,
  getInstallationProfileFromEnv,
  InstallationCapabilities,
  InstallationProfile,
} from '../policy/installationPolicy';
import { setDirectTotemModeFromCapabilities } from '../config/directTotemMode';
import { resolveInstallationSimpleTotemMode } from './totemSimpleModeService';

let cachedProfile: InstallationProfile | undefined;
let cachedCapabilities: InstallationCapabilities | undefined;

const VALID_PROFILES = new Set<InstallationProfile>(['single_publisher', 'multi_agency']);

function parseProfile(raw: unknown): InstallationProfile | undefined {
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim() as InstallationProfile;
  return VALID_PROFILES.has(normalized) ? normalized : undefined;
}

function parseModuleOverrides(raw: unknown): Partial<Record<string, boolean>> | null {
  if (raw == null) return null;
  let value: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '{}') return null;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Partial<Record<string, boolean>> = {};
  for (const [k, v] of Object.entries(value as unknown as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return Object.keys(out).length ? out : null;
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

async function loadModuleOverrides(db?: {
  findFirst: (sql: string, params?: unknown[]) => Promise<{ setting_value?: string } | null>;
}): Promise<Partial<Record<string, boolean>> | null> {
  if (!db) return null;
  try {
    const row = await db.findFirst(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'installation.modules' LIMIT 1`
    );
    return parseModuleOverrides(row?.setting_value);
  } catch {
    return null;
  }
}

export async function resolveInstallationCapabilities(db?: {
  findFirst: (sql: string, params?: unknown[]) => Promise<{ setting_value?: string } | null>;
}): Promise<InstallationCapabilities> {
  if (cachedCapabilities) return cachedCapabilities;
  const profile = await resolveInstallationProfile(db);
  const simpleTotemMode = await resolveInstallationSimpleTotemMode(db);
  const moduleOverrides = await loadModuleOverrides(db);
  cachedCapabilities = buildInstallationCapabilities(profile, simpleTotemMode, moduleOverrides);
  setDirectTotemModeFromCapabilities(cachedCapabilities.directTotemMode);
  return cachedCapabilities;
}

/** Snapshot síncrono (após resolve); undefined se cache frio. */
export function peekInstallationCapabilities(): InstallationCapabilities | undefined {
  return cachedCapabilities;
}

export function resetInstallationProfileCache(): void {
  cachedProfile = undefined;
  cachedCapabilities = undefined;
  setDirectTotemModeFromCapabilities(undefined);
}
