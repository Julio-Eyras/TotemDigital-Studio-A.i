import {
  INSTALLATION_MODULE_CATALOG,
  InstallationModuleFlags,
  InstallationModuleId,
  mergeInstallationModules,
  validateInstallationModuleDependencies,
  buildDefaultInstallationModules,
} from '../policy/installationModules';
import {
  buildInstallationCapabilities,
  InstallationCapabilities,
} from '../policy/installationPolicy';
import {
  resolveInstallationProfile,
  resetInstallationProfileCache,
} from './installationProfileService';
import { resolveInstallationSimpleTotemMode } from './totemSimpleModeService';
import { logError } from '../utils/loggerHelper';

export const INSTALLATION_MODULES_SETTING_KEY = 'installation.modules';

type DbLike = {
  findFirst: (sql: string, params?: unknown[]) => Promise<Record<string, unknown> | null>;
  executeRaw?: (sql: string, params?: unknown[]) => Promise<unknown>;
};

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
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

export async function loadInstallationModuleOverrides(
  db?: DbLike
): Promise<Partial<Record<string, boolean>> | null> {
  if (!db) return null;
  try {
    const row = await db.findFirst(
      `SELECT setting_value FROM system_settings WHERE setting_key = $1 LIMIT 1`,
      [INSTALLATION_MODULES_SETTING_KEY]
    );
    return parseModuleOverrides(row?.setting_value);
  } catch (error) {
    await logError('Erro ao ler installation.modules', error);
    return null;
  }
}

export async function getInstallationModulesAdminView(db: DbLike): Promise<{
  catalog: typeof INSTALLATION_MODULE_CATALOG;
  modules: InstallationModuleFlags;
  defaults: InstallationModuleFlags;
  overrides: Partial<Record<string, boolean>> | null;
  capabilities: InstallationCapabilities;
}> {
  const profile = await resolveInstallationProfile(db as any);
  const simpleTotemMode = await resolveInstallationSimpleTotemMode(db as any);
  const overrides = await loadInstallationModuleOverrides(db);
  const capabilities = buildInstallationCapabilities(profile, simpleTotemMode, overrides);
  const defaults = buildDefaultInstallationModules({
    multiAgency: capabilities.multiAgency,
    directTotemMode: capabilities.directTotemMode,
    simpleTotemMode: capabilities.simpleTotemMode,
    smartDisplayFx: capabilities.smartDisplayFx,
    subscriberPortal: capabilities.subscriberPortal,
  });
  return {
    catalog: INSTALLATION_MODULE_CATALOG,
    modules: capabilities.modules,
    defaults,
    overrides,
    capabilities,
  };
}

export async function saveInstallationModules(
  db: DbLike,
  nextFlags: Partial<Record<InstallationModuleId, boolean>>,
  _updatedBy?: number
): Promise<InstallationModuleFlags> {
  if (!db.executeRaw) {
    throw new Error('Base de dados sem suporte a escrita');
  }

  const view = await getInstallationModulesAdminView(db);
  const merged = mergeInstallationModules(view.defaults, {
    ...view.overrides,
    ...nextFlags,
  });
  const errors = validateInstallationModuleDependencies(merged);
  if (errors.length) {
    throw new Error(errors.join(' '));
  }

  const payload = JSON.stringify(merged);
  await db.executeRaw(
    `
    INSERT INTO system_settings (
      setting_key, setting_value, setting_type, category, description,
      is_public, is_editable, default_value, updated_at
    ) VALUES (
      $1, $2, 'json', 'system',
      'Complementos de produto da instalação (JSON). Distinto de flag_smart_* por utilizador.',
      false, true, '{}', CURRENT_TIMESTAMP
    )
    ON CONFLICT (setting_key) DO UPDATE SET
      setting_value = EXCLUDED.setting_value,
      setting_type = EXCLUDED.setting_type,
      updated_at = CURRENT_TIMESTAMP
  `,
    [INSTALLATION_MODULES_SETTING_KEY, payload]
  );

  resetInstallationProfileCache();
  return merged;
}
