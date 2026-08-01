import {
  INSTALLATION_MODULE_CATALOG,
  InstallationModuleFlags,
  InstallationModuleId,
  MULTI_AGENCY_PRESET_MODULE_IDS,
  applyMultiAgencyMasterSwitch,
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
export const INSTALLATION_PROFILE_SETTING_KEY = 'installation.profile';

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

async function upsertSystemSetting(
  db: DbLike,
  key: string,
  value: string,
  settingType: string,
  description: string
): Promise<void> {
  if (!db.executeRaw) {
    throw new Error('Base de dados sem suporte a escrita');
  }
  await db.executeRaw(
    `
    INSERT INTO system_settings (
      setting_key, setting_value, setting_type, category, description,
      is_public, is_editable, default_value, updated_at
    ) VALUES (
      $1, $2, $3, 'system', $4,
      false, true, $5, CURRENT_TIMESTAMP
    )
    ON CONFLICT (setting_key) DO UPDATE SET
      setting_value = EXCLUDED.setting_value,
      setting_type = EXCLUDED.setting_type,
      description = EXCLUDED.description,
      updated_at = CURRENT_TIMESTAMP
  `,
    [key, value, settingType, description, settingType === 'json' ? '{}' : value]
  );
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
  multiAgencyEnabled: boolean;
  multiAgencyPresetIds: InstallationModuleId[];
}> {
  const profile = await resolveInstallationProfile(db as any);
  const simpleTotemMode = await resolveInstallationSimpleTotemMode(db as any);
  const overrides = await loadInstallationModuleOverrides(db);
  const capabilities = buildInstallationCapabilities(profile, simpleTotemMode, overrides);
  const defaults = buildDefaultInstallationModules({
    multiAgency: profile === 'multi_agency',
    directTotemMode: process.env.DIRECT_TOTEM_MODE !== 'false',
    simpleTotemMode,
    smartDisplayFx: profile === 'multi_agency',
    subscriberPortal: profile === 'multi_agency',
  });
  return {
    catalog: INSTALLATION_MODULE_CATALOG,
    modules: capabilities.modules,
    defaults,
    overrides,
    capabilities,
    multiAgencyEnabled: capabilities.modules.multi_agency === true,
    multiAgencyPresetIds: MULTI_AGENCY_PRESET_MODULE_IDS,
  };
}

async function persistModulesFlags(
  db: DbLike,
  flags: InstallationModuleFlags
): Promise<InstallationModuleFlags> {
  const errors = validateInstallationModuleDependencies(flags);
  if (errors.length) {
    throw new Error(errors.join(' '));
  }

  await upsertSystemSetting(
    db,
    INSTALLATION_MODULES_SETTING_KEY,
    JSON.stringify(flags),
    'json',
    'Complementos de produto da instalação (JSON). Distinto de flag_smart_* por utilizador.'
  );

  resetInstallationProfileCache();
  return flags;
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
  const merged = mergeInstallationModules(view.modules, {
    ...nextFlags,
  });
  if (!merged.multi_agency) {
    merged.subscriber_portal = false;
  }
  return persistModulesFlags(db, merged);
}

/**
 * Master switch: aplica preset atómico e sincroniza installation.profile.
 * Não apaga dados — apenas esconde superfícies (menu/API).
 */
export async function setMultiAgencyMode(
  db: DbLike,
  enabled: boolean,
  _updatedBy?: number
): Promise<{
  enabled: boolean;
  modules: InstallationModuleFlags;
  profile: 'single_publisher' | 'multi_agency';
  requiresBackendRestart: boolean;
  message: string;
}> {
  if (!db.executeRaw) {
    throw new Error('Base de dados sem suporte a escrita');
  }

  const view = await getInstallationModulesAdminView(db);
  const previous = view.modules;
  const next = applyMultiAgencyMasterSwitch(enabled, previous);
  const modules = await persistModulesFlags(db, next);

  const profile = enabled ? 'multi_agency' : 'single_publisher';
  await upsertSystemSetting(
    db,
    INSTALLATION_PROFILE_SETTING_KEY,
    profile,
    'string',
    'Perfil de instalação: single_publisher (Studio/mono) ou multi_agency (Pro)'
  );
  resetInstallationProfileCache();

  const workersChanged = Boolean(previous.multi_agency) !== Boolean(modules.multi_agency);

  return {
    enabled: modules.multi_agency === true,
    modules,
    profile,
    requiresBackendRestart: workersChanged,
    message: enabled
      ? 'Modo multi-agência activado. Dados anteriores (se existirem) permanecem; o menu/API comerciais ficam disponíveis.'
      : 'Modo multi-agência desactivado. Dados comerciais não foram apagados — ficam inacessíveis até voltar a activar. Direct Totem voltou a ser o modo de operação.',
  };
}
