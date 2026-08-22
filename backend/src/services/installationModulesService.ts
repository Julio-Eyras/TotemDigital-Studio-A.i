import {
  INSTALLATION_MODULE_CATALOG,
  InstallationModuleFlags,
  InstallationModuleId,
  MULTI_AGENCY_PRESET_MODULE_IDS,
  applyMultiAgencyMode,
  resolveMultiAgencyMode,
  mergeInstallationModules,
  validateInstallationModuleDependencies,
  buildDefaultInstallationModules,
  healStaleMultiAgencyLiteModules,
} from '../policy/installationModules';
import {
  buildInstallationCapabilities,
  InstallationCapabilities,
} from '../policy/installationPolicy';
import {
  resolveInstallationProfile,
  resetInstallationProfileCache,
  resolveInstallationCapabilities,
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
  multiAgencyMode: 'off' | 'lite' | 'full';
  multiAgencyPresetIds: InstallationModuleId[];
}> {
  const profile = await resolveInstallationProfile(db as any);
  const simpleTotemMode = await resolveInstallationSimpleTotemMode(db as any);
  const overrides = await loadInstallationModuleOverrides(db);
  let capabilities = buildInstallationCapabilities(profile, simpleTotemMode, overrides);

  // Persistência: lite antigo com subscribers:false → gravar preset correcto
  const liteNeedsPersist =
    resolveMultiAgencyMode(capabilities.modules) === 'lite' &&
    overrides != null &&
    (overrides.subscribers === false ||
      overrides.quick_publish === false ||
      overrides.campaigns === false ||
      overrides.devices === false);
  if (liteNeedsPersist && db.executeRaw) {
    try {
      const healed = healStaleMultiAgencyLiteModules(capabilities.modules);
      await persistModulesFlags(db, healed);
      capabilities = buildInstallationCapabilities(profile, simpleTotemMode, healed);
    } catch (error) {
      await logError('Falha ao persistir heal do preset multi-lite', error);
    }
  }

  const defaults = buildDefaultInstallationModules({
    multiAgency: profile === 'multi_agency',
    directTotemMode: capabilities.directTotemMode,
    simpleTotemMode,
    smartDisplayFx: capabilities.smartDisplayFx,
    subscriberPortal: capabilities.subscriberPortal,
  });
  return {
    catalog: INSTALLATION_MODULE_CATALOG,
    modules: capabilities.modules,
    defaults,
    overrides,
    capabilities,
    multiAgencyEnabled: capabilities.modules.multi_agency === true,
    multiAgencyMode: resolveMultiAgencyMode(capabilities.modules),
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
  await resolveInstallationCapabilities(db as any);
  return flags;
}

export async function saveInstallationModules(
  db: DbLike,
  nextFlags: Partial<Record<InstallationModuleId, boolean>>,
  _updatedBy?: number
): Promise<{
  modules: InstallationModuleFlags;
  profile: 'single_publisher' | 'multi_agency';
  requiresBackendRestart: boolean;
  workersReconciled: boolean;
  workersReconcileError?: string;
}> {
  if (!db.executeRaw) {
    throw new Error('Base de dados sem suporte a escrita');
  }

  const view = await getInstallationModulesAdminView(db);
  const previous = view.modules;
  const merged = mergeInstallationModules(view.modules, {
    ...nextFlags,
  });
  if (!merged.multi_agency) {
    merged.subscriber_portal = false;
  }
  const modules = await persistModulesFlags(db, merged);

  const profile = modules.multi_agency ? 'multi_agency' : 'single_publisher';
  if (Boolean(previous.multi_agency) !== Boolean(modules.multi_agency)) {
    await upsertSystemSetting(
      db,
      INSTALLATION_PROFILE_SETTING_KEY,
      profile,
      'string',
      'Perfil de instalação: single_publisher (Studio/mono) ou multi_agency (Pro)'
    );
    resetInstallationProfileCache();
    await resolveInstallationCapabilities(db as any);
  }

  const workersTouch = workersAffectingModulesChanged(previous, modules);
  let workersReconciled = false;
  let workersReconcileError: string | undefined;
  let requiresBackendRestart = false;

  if (workersTouch) {
    const hot = await applyWorkersHotReload(db);
    workersReconciled = hot.ok;
    workersReconcileError = hot.error;
    requiresBackendRestart = !hot.ok;
  }

  return { modules, profile, requiresBackendRestart, workersReconciled, workersReconcileError };
}

function workersAffectingModulesChanged(
  previous: InstallationModuleFlags,
  next: InstallationModuleFlags
): boolean {
  const keys: InstallationModuleId[] = [
    'multi_agency',
    'playlists_advanced',
    'billing',
    'subscribers',
    'dispatcher_admin',
  ];
  return keys.some((k) => Boolean(previous[k]) !== Boolean(next[k]));
}

async function applyWorkersHotReload(db: DbLike): Promise<{ ok: boolean; error?: string }> {
  try {
    const { warmInstallationRuntime } = await import('../config/installationRuntime');
    await warmInstallationRuntime(db as any);
    const { resolveInstallationCapabilities } = await import('./installationProfileService');
    const caps = await resolveInstallationCapabilities(db as any);
    const { config } = await import('../config/env');
    const { reconcileWorkersFromCapabilities } = await import(
      '../startup/operationalWorkersLifecycle'
    );
    const result = await reconcileWorkersFromCapabilities(
      caps,
      Boolean(config.redis?.enabled),
      'Hot-reload workers'
    );
    return { ok: result?.ok === true, error: result?.error };
  } catch (error: any) {
    await logError('Hot-reload de workers falhou', error);
    return { ok: false, error: error?.message || 'Falha no hot-reload' };
  }
}

/**
 * Se não existir nenhuma organização activa, cria a organização owner do sistema.
 * Não cria 2ª agência — só bootstrap mínimo para instalação vazia.
 */
export async function ensureSystemOwnerPublisherIfEmpty(db: DbLike): Promise<{
  created: boolean;
  publisherId?: number;
  detail: string;
}> {
  try {
    const row = await db.findFirst(
      `SELECT COUNT(*)::int AS c FROM publishers WHERE COALESCE(is_active, true) = true`
    );
    const count = Number(row?.c ?? 0);
    if (count > 0) {
      return {
        created: false,
        detail: `${count} organização(ões) já activa(s) — sem seed.`,
      };
    }
  } catch {
    return { created: false, detail: 'Não foi possível contar publishers — seed ignorado.' };
  }

  if (!db.executeRaw) {
    return { created: false, detail: 'Base sem escrita — seed ignorado.' };
  }

  const name = (process.env.SYSTEM_OWNER_NAME || 'Totem Digital').trim();
  const email = (process.env.SYSTEM_OWNER_EMAIL || 'contato@totemdigital.local').trim();

  try {
    await db.executeRaw(
      `
      INSERT INTO publishers (
        name, contact_name, email, category_segment, description,
        is_subscriber, is_publisher, client_type, is_active, is_system_owner, portal_slug
      ) VALUES (
        $1, $2, $3, 'Totens', 'Organização owner criada ao activar multi-agência (instalação vazia)',
        false, true, 'publisher', true, true, 'org-owner'
      )
    `,
      [name, `Contato ${name}`, email]
    );
    const created = await db.findFirst(
      `SELECT publisher_id FROM publishers WHERE is_system_owner = true ORDER BY publisher_id ASC LIMIT 1`
    );
    const publisherId = created?.publisher_id ? Number(created.publisher_id) : undefined;
    return {
      created: true,
      publisherId,
      detail: `Organização owner «${name}» criada (publisher_id=${publisherId ?? '?'}).`,
    };
  } catch (error) {
    await logError('Falha ao criar organização owner no bootstrap multi-agência', error);
    return { created: false, detail: 'Falha ao criar organização owner — crie manualmente.' };
  }
}

/**
 * Com multi-agência ON e exactamente 1 org (owner): cria 2ª agência + anunciante demo
 * (idempotente — não duplica se já existirem ≥2 publishers ou slug ocupado).
 */
export async function ensureDemoSecondAgencyIfNeeded(db: DbLike): Promise<{
  created: boolean;
  publisherId?: number;
  subscriberId?: number;
  detail: string;
}> {
  try {
    const seedFlag = await db.findFirst(
      `SELECT setting_value FROM system_settings WHERE setting_key = $1 LIMIT 1`,
      ['portal.seed_second_agency']
    );
    const flagRaw = String(seedFlag?.setting_value ?? 'true').toLowerCase();
    if (flagRaw === 'false' || flagRaw === '0') {
      return { created: false, detail: 'portal.seed_second_agency=false — seed 2ª agência desligado.' };
    }
  } catch {
    /* default true */
  }

  let count = 0;
  try {
    const row = await db.findFirst(
      `SELECT COUNT(*)::int AS c FROM publishers WHERE COALESCE(is_active, true) = true`
    );
    count = Number(row?.c ?? 0);
  } catch {
    return { created: false, detail: 'Não foi possível contar publishers.' };
  }

  if (count === 0) {
    return { created: false, detail: 'Sem organização owner — seed 2ª agência adiado.' };
  }
  if (count >= 2) {
    return {
      created: false,
      detail: `${count} organizações activas — 2ª agência demo não necessária.`,
    };
  }

  if (!db.executeRaw) {
    return { created: false, detail: 'Base sem escrita — seed 2ª agência ignorado.' };
  }

  const agencyName = (process.env.DEMO_SECOND_AGENCY_NAME || 'Agência Demo 2').trim();
  const agencySlug = (process.env.DEMO_SECOND_AGENCY_SLUG || 'agencia-demo-2').trim().toLowerCase();
  const agencyEmail =
    (process.env.DEMO_SECOND_AGENCY_EMAIL || 'agencia2@totemdigital.local').trim().toLowerCase();
  const subName = (process.env.DEMO_SUBSCRIBER_NAME || 'Anunciante Demo').trim();
  const subSlug = (process.env.DEMO_SUBSCRIBER_SLUG || 'anunciante-demo').trim().toLowerCase();
  const subEmail =
    (process.env.DEMO_SUBSCRIBER_EMAIL || 'anunciante@totemdigital.local').trim().toLowerCase();

  try {
    const slugTaken = await db.findFirst(
      `
      SELECT publisher_id FROM publishers WHERE portal_slug = $1
      UNION ALL
      SELECT subscriber_id FROM subscribers WHERE portal_slug = $1
      LIMIT 1
    `,
      [agencySlug]
    );
    if (slugTaken) {
      return {
        created: false,
        detail: `Slug «${agencySlug}» já em uso — seed 2ª agência ignorado.`,
      };
    }

    await db.executeRaw(
      `
      INSERT INTO publishers (
        name, contact_name, email, category_segment, description,
        is_subscriber, is_publisher, client_type, is_active, is_system_owner, portal_slug
      ) VALUES (
        $1, $2, $3, 'Agências', 'Segunda organização demo (multi-agência)',
        false, true, 'publisher', true, false, $4
      )
    `,
      [agencyName, `Contato ${agencyName}`, agencyEmail, agencySlug]
    );

    const pub = await db.findFirst(
      `SELECT publisher_id FROM publishers WHERE portal_slug = $1 LIMIT 1`,
      [agencySlug]
    );
    const publisherId = pub?.publisher_id ? Number(pub.publisher_id) : undefined;

    let subscriberId: number | undefined;
    try {
      const subExists = await db.findFirst(
        `SELECT subscriber_id FROM subscribers WHERE portal_slug = $1 OR email = $2 LIMIT 1`,
        [subSlug, subEmail]
      );
      if (!subExists) {
        await db.executeRaw(
          `
          INSERT INTO subscribers (
            name, contact_name, email, category_segment, description,
            portal_slug, is_active, created_at, updated_at
          ) VALUES (
            $1, $2, $3, 'Demo', 'Anunciante demo criado com a 2ª agência',
            $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `,
          [subName, `Contato ${subName}`, subEmail, subSlug]
        );
        const sub = await db.findFirst(
          `SELECT subscriber_id FROM subscribers WHERE portal_slug = $1 LIMIT 1`,
          [subSlug]
        );
        subscriberId = sub?.subscriber_id ? Number(sub.subscriber_id) : undefined;
      } else {
        subscriberId = Number(subExists.subscriber_id);
      }

      // Multi Lite: conceder SPA directo do anunciante demo → orgs (owner + 2ª agência)
      if (subscriberId) {
        const owner = await db.findFirst(
          `SELECT publisher_id FROM publishers WHERE is_system_owner = true ORDER BY publisher_id ASC LIMIT 1`
        );
        const ownerId = owner?.publisher_id ? Number(owner.publisher_id) : undefined;
        const targets = [ownerId, publisherId].filter(
          (id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0
        );
        for (const pubId of [...new Set(targets)]) {
          try {
            const existingSpa = await db.findFirst(
              `
              SELECT access_id FROM subscriber_publisher_access
              WHERE subscriber_id = $1 AND publisher_id = $2
              ORDER BY access_id DESC LIMIT 1
            `,
              [subscriberId, pubId]
            );
            if (existingSpa?.access_id) {
              await db.executeRaw(
                `
                UPDATE subscriber_publisher_access SET
                  is_active = true,
                  revoked_at = NULL,
                  access_type = 'override',
                  contract_id = NULL,
                  plan_id = NULL,
                  notes = COALESCE(notes, 'Seed demo multi-agência (SPA directo Lite)'),
                  updated_at = CURRENT_TIMESTAMP
                WHERE access_id = $1
              `,
                [Number(existingSpa.access_id)]
              );
            } else {
              await db.executeRaw(
                `
                INSERT INTO subscriber_publisher_access (
                  subscriber_id, publisher_id, contract_id, plan_id, access_type,
                  granted_by, notes, is_active
                ) VALUES (
                  $1, $2, NULL, NULL, 'override', NULL,
                  'Seed demo multi-agência (SPA directo Lite)', true
                )
              `,
                [subscriberId, pubId]
              );
            }
          } catch (spaErr) {
            await logError('Seed SPA demo falhou', spaErr, { subscriberId, pubId });
          }
        }
      }
    } catch (subErr) {
      await logError('Seed anunciante demo falhou (agência já criada)', subErr);
    }

    return {
      created: true,
      publisherId,
      subscriberId,
      detail: `2ª agência «${agencyName}» (slug=${agencySlug}, id=${publisherId ?? '?'})${
        subscriberId ? ` + anunciante demo id=${subscriberId}` : ''
      }.`,
    };
  } catch (error) {
    await logError('Falha ao criar 2ª agência demo', error);
    return { created: false, detail: 'Falha ao criar 2ª agência demo — crie manualmente.' };
  }
}

/**
 * Master switch: aplica preset atómico e sincroniza installation.profile.
 * Não apaga dados — apenas esconde superfícies (menu/API).
 */
export async function setMultiAgencyMode(
  db: DbLike,
  enabledOrMode: boolean | 'off' | 'lite' | 'full',
  _updatedBy?: number
): Promise<{
  enabled: boolean;
  mode: 'off' | 'lite' | 'full';
  modules: InstallationModuleFlags;
  profile: 'single_publisher' | 'multi_agency';
  requiresBackendRestart: boolean;
  workersReconciled: boolean;
  workersReconcileError?: string;
  bootstrap?: {
    created: boolean;
    publisherId?: number;
    detail: string;
  };
  secondAgency?: {
    created: boolean;
    publisherId?: number;
    subscriberId?: number;
    detail: string;
  };
  message: string;
}> {
  if (!db.executeRaw) {
    throw new Error('Base de dados sem suporte a escrita');
  }

  const mode: 'off' | 'lite' | 'full' =
    typeof enabledOrMode === 'string'
      ? enabledOrMode
      : enabledOrMode
        ? 'full'
        : 'off';

  const view = await getInstallationModulesAdminView(db);
  const previous = view.modules;
  const next = applyMultiAgencyMode(mode, previous);
  const modules = await persistModulesFlags(db, next);

  const profile = mode === 'off' ? 'single_publisher' : 'multi_agency';
  await upsertSystemSetting(
    db,
    INSTALLATION_PROFILE_SETTING_KEY,
    profile,
    'string',
    'Perfil de instalação: single_publisher (Studio/mono) ou multi_agency (Pro/lite)'
  );
  resetInstallationProfileCache();
  await resolveInstallationCapabilities(db as any);

  let bootstrap: { created: boolean; publisherId?: number; detail: string } | undefined;
  let secondAgency:
    | { created: boolean; publisherId?: number; subscriberId?: number; detail: string }
    | undefined;
  if (mode !== 'off') {
    bootstrap = await ensureSystemOwnerPublisherIfEmpty(db);
    secondAgency = await ensureDemoSecondAgencyIfNeeded(db);
  }

  const workersTouch = workersAffectingModulesChanged(previous, modules);
  let workersReconciled = false;
  let workersReconcileError: string | undefined;
  let requiresBackendRestart = false;

  if (workersTouch) {
    const hot = await applyWorkersHotReload(db);
    workersReconciled = hot.ok;
    workersReconcileError = hot.error;
    requiresBackendRestart = !hot.ok;
  }

  const bootstrapHint =
    bootstrap?.created === true
      ? ` ${bootstrap.detail}`
      : '';
  const secondHint =
    secondAgency?.created === true
      ? ` ${secondAgency.detail}`
      : secondAgency?.detail
        ? ` (${secondAgency.detail})`
        : '';

  const workersHint = workersTouch
    ? workersReconciled
      ? ' Workers (Bull/billing/playlists) aplicados em runtime — sem precisar reiniciar o backend.'
      : ' Hot-reload de workers falhou — reinicie o backend para aplicar filas/workers.'
    : '';

  return {
    enabled: modules.multi_agency === true,
    mode,
    modules,
    profile,
    requiresBackendRestart,
    workersReconciled,
    workersReconcileError,
    bootstrap,
    secondAgency,
    message:
      mode === 'full'
        ? `Modo multi-agência Pro activado. Dados anteriores permanecem; superfícies comerciais disponíveis.${bootstrapHint}${secondHint}${workersHint}`
        : mode === 'lite'
          ? `Modo multi-agência lite activado (orgs + anunciantes + publicar/mídias; sem billing/planos/contratos/OTA).${bootstrapHint}${secondHint}${workersHint}`
          : `Modo multi-agência desactivado. Dados comerciais não foram apagados. Direct Totem voltou a ser o modo de operação.${workersHint}`,
  };
}

export type MultiAgencyChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  severity: 'info' | 'warning' | 'blocking';
  detail?: string;
};

/**
 * Checklist de activação (não bloqueia o switch; informa riscos).
 */
export async function getMultiAgencyActivationChecklist(db: DbLike): Promise<{
  canEnableSafely: boolean;
  items: MultiAgencyChecklistItem[];
}> {
  const items: MultiAgencyChecklistItem[] = [];

  let publisherCount = 0;
  let totemCount = 0;
  try {
    const pub = await db.findFirst(
      `SELECT COUNT(*)::int AS c FROM publishers WHERE COALESCE(is_active, true) = true`
    );
    publisherCount = Number(pub?.c ?? 0);
  } catch {
    publisherCount = 0;
  }
  try {
    const tot = await db.findFirst(
      `SELECT COUNT(*)::int AS c FROM totems WHERE COALESCE(is_active, true) = true`
    );
    totemCount = Number(tot?.c ?? 0);
  } catch {
    totemCount = 0;
  }

  items.push({
    id: 'organization',
    label: 'Existe pelo menos uma organização activa',
    ok: publisherCount > 0,
    severity: publisherCount > 0 ? 'info' : 'warning',
    detail:
      publisherCount > 0
        ? `${publisherCount} organização(ões) activa(s)`
        : 'Crie/ative uma organização antes de operar multi-agência.',
  });

  items.push({
    id: 'totems',
    label: 'Há totems activos na instalação',
    ok: totemCount > 0,
    severity: 'info',
    detail: totemCount > 0 ? `${totemCount} totem(ns) activo(s)` : 'Opcional — pode activar o modo sem totems.',
  });

  const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;
  items.push({
    id: 'redis',
    label: 'Redis configurado (filas Bull / export)',
    ok: Boolean(redisUrl),
    severity: redisUrl ? 'info' : 'warning',
    detail: redisUrl
      ? 'Redis detectado no ambiente.'
      : 'Sem Redis, exports em fila podem não arrancar após activar multi-agência. Reinicie o backend depois.',
  });

  items.push({
    id: 'portal_dns',
    label: 'Portal anunciante / DNS parametrizável',
    ok: true,
    severity: 'info',
    detail: await (async () => {
      try {
        const { getPortalSettings } = await import('./portalHostService');
        const portal = await getPortalSettings(db);
        if (portal.dnsMode === 'off') {
          return 'portal.dns_mode=off. Em Complementos → Portal DNS, defina domínio e modo (wildcard ou dnsmasq).';
        }
        if (portal.dnsMode === 'public_wildcard' && !portal.baseDomain) {
          return 'Modo public_wildcard sem portal.base_domain — configure o domínio base.';
        }
        return `Modo ${portal.dnsMode}${portal.baseDomain ? ` · base ${portal.baseDomain}` : ''}. Slugs em organização/anunciante; sync via POST /api/installation/portal/sync.`;
      } catch {
        return 'Portal fora do botão principal — configure em Opções avançadas / Portal DNS após Nginx.';
      }
    })(),
  });

  items.push({
    id: 'data_safety',
    label: 'Desactivar não apaga dados',
    ok: true,
    severity: 'info',
    detail: 'Ao desligar, dados comerciais ficam preservados e inacessíveis até reactivar.',
  });

  items.push({
    id: 'workers_restart',
    label: 'Workers aplicados em runtime (hot-reload)',
    ok: true,
    severity: 'info',
    detail:
      'Ao activar/desactivar, Bull/billing/playlists tentam ligar/desligar sem reiniciar o processo. Só peça restart se o hot-reload falhar.',
  });

  const canEnableSafely = items.filter((i) => i.severity === 'blocking').every((i) => i.ok);
  return { canEnableSafely, items };
}
