/**
 * Unit tests for multi-agency activation bootstrap + hot-reload workers.
 */
import {
  ensureSystemOwnerPublisherIfEmpty,
  ensureDemoSecondAgencyIfNeeded,
  setMultiAgencyMode,
  saveInstallationModules,
} from '../../../services/installationModulesService';

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn().mockResolvedValue(undefined),
  logInfo: jest.fn().mockResolvedValue(undefined),
  logWarn: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../services/installationProfileService', () => ({
  resolveInstallationProfile: jest.fn().mockResolvedValue('single_publisher'),
  resolveInstallationCapabilities: jest.fn().mockResolvedValue({
    multiAgency: false,
    bullExportQueues: false,
    playlistMixWorker: false,
    playlistEngineWorker: false,
    alertCron: false,
    stripeSubscriptions: false,
    modules: {
      multi_agency: false,
      billing: false,
      playlists_advanced: false,
      subscribers: false,
      dispatcher_admin: false,
    },
  }),
  resetInstallationProfileCache: jest.fn(),
}));

jest.mock('../../../services/totemSimpleModeService', () => ({
  resolveInstallationSimpleTotemMode: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../config/installationRuntime', () => ({
  warmInstallationRuntime: jest.fn().mockResolvedValue('multi_agency'),
}));

jest.mock('../../../config/env', () => ({
  config: { redis: { enabled: true } },
}));

jest.mock('../../../startup/operationalWorkersLifecycle', () => ({
  reconcileWorkersFromCapabilities: async () => ({
    ok: true,
    changed: true,
    applied: {
      redisEnabled: true,
      enableBullQueues: true,
      enableBillingWorkers: true,
      enablePlaylistMix: true,
      enablePlaylistEngine: true,
      enableAlertCron: true,
      enableSubscriberAccessWorker: true,
    },
  }),
}));

function makeDb(opts?: {
  publisherCount?: number;
  modulesJson?: string;
  profile?: string;
}): {
  inserted: unknown[][];
  findFirst: jest.Mock;
  executeRaw: jest.Mock;
} {
  const publisherCount = opts?.publisherCount ?? 1;
  const inserted: unknown[][] = [];

  return {
    inserted,
    findFirst: jest.fn(async (sql: string) => {
      if (sql.includes('COUNT(*)') && sql.includes('publishers')) {
        return { c: publisherCount };
      }
      if (sql.includes('COUNT(*)') && sql.includes('totems')) {
        return { c: 0 };
      }
      if (sql.includes('is_system_owner')) {
        return { publisher_id: 99 };
      }
      return null;
    }),
    executeRaw: jest.fn(async (_sql: string, params?: unknown[]) => {
      inserted.push(params || []);
      return undefined;
    }),
  };
}

describe('ensureDemoSecondAgencyIfNeeded', () => {
  beforeEach(async () => {
    const profileSvc = await import('../../../services/installationProfileService');
    (profileSvc.resolveInstallationProfile as jest.Mock).mockResolvedValue('single_publisher');
    (profileSvc.resolveInstallationCapabilities as jest.Mock).mockResolvedValue({
      multiAgency: false,
      bullExportQueues: false,
      playlistMixWorker: false,
      playlistEngineWorker: false,
      alertCron: false,
      stripeSubscriptions: false,
      modules: {
        multi_agency: false,
        billing: false,
        playlists_advanced: false,
        subscribers: false,
        dispatcher_admin: false,
      },
    });
    const simpleSvc = await import('../../../services/totemSimpleModeService');
    (simpleSvc.resolveInstallationSimpleTotemMode as jest.Mock).mockResolvedValue(true);
    const runtime = await import('../../../config/installationRuntime');
    (runtime.warmInstallationRuntime as jest.Mock).mockResolvedValue('multi_agency');
  });

  it('não cria se já existirem 2+ organizações', async () => {
    const db = makeDb({ publisherCount: 2 });
    const result = await ensureDemoSecondAgencyIfNeeded(db as any);
    expect(result.created).toBe(false);
    expect(db.executeRaw).not.toHaveBeenCalled();
  });

  it('cria 2ª agência + anunciante quando só existe owner', async () => {
    const db = makeDb({ publisherCount: 1 });
    let inserts = 0;
    db.findFirst = jest.fn(async (sql: string) => {
      if (sql.includes('portal.seed_second_agency')) return { setting_value: 'true' };
      if (sql.includes('COUNT(*)') && sql.includes('publishers')) return { c: 1 };
      if (sql.includes('UNION ALL') || sql.includes('portal_slug = $1\n      UNION')) return null;
      if (sql.includes('FROM publishers WHERE portal_slug')) return { publisher_id: 7 };
      if (sql.includes('FROM subscribers WHERE portal_slug = $1 OR email')) return null;
      if (sql.includes('FROM subscribers WHERE portal_slug')) return { subscriber_id: 3 };
      return null;
    });
    db.executeRaw = jest.fn(async () => {
      inserts += 1;
    });
    const result = await ensureDemoSecondAgencyIfNeeded(db as any);
    expect(result.created).toBe(true);
    expect(result.publisherId).toBe(7);
    expect(result.subscriberId).toBe(3);
    expect(inserts).toBeGreaterThanOrEqual(1);
  });
});

describe('ensureSystemOwnerPublisherIfEmpty', () => {
  it('não cria publisher se já existir organização', async () => {
    const db = makeDb({ publisherCount: 2 });
    const result = await ensureSystemOwnerPublisherIfEmpty(db as any);
    expect(result.created).toBe(false);
    expect(db.executeRaw).not.toHaveBeenCalled();
  });

  it('cria organização owner se instalação vazia', async () => {
    const db = makeDb({ publisherCount: 0 });
    db.findFirst = jest.fn(async (sql: string) => {
      if (sql.includes('COUNT(*)')) return { c: 0 };
      if (sql.includes('is_system_owner')) return { publisher_id: 42 };
      return null;
    });
    const result = await ensureSystemOwnerPublisherIfEmpty(db as any);
    expect(result.created).toBe(true);
    expect(result.publisherId).toBe(42);
    expect(db.executeRaw).toHaveBeenCalled();
  });
});

describe('setMultiAgencyMode', () => {
  it('ao activar com publishers existentes não faz seed e reconcilia workers', async () => {
    const db = makeDb({ publisherCount: 1 });
    db.findFirst = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('COUNT(*)') && sql.includes('publishers')) return { c: 1 };
      if (sql.includes('system_settings') && params?.[0] === 'installation.modules') {
        return {
          setting_value: JSON.stringify({
            multi_agency: false,
            billing: false,
            playlists_advanced: false,
            subscribers: false,
            dispatcher_admin: true,
            direct_totem_mode: true,
            simple_totem_mode: true,
          }),
        };
      }
      if (sql.includes('system_settings') && params?.[0] === 'installation.profile') {
        return { setting_value: 'single_publisher' };
      }
      if (sql.includes('system_settings')) return null;
      return null;
    });

    const result = await setMultiAgencyMode(db as any, true, 1);
    expect(result.enabled).toBe(true);
    expect(result.mode).toBe('full');
    expect(result.modules.multi_agency).toBe(true);
    expect(result.modules.direct_totem_mode).toBe(false);
    expect(result.bootstrap?.created).toBe(false);
    expect(result.workersReconciled).toBe(true);
    expect(result.requiresBackendRestart).toBe(false);
    expect(db.executeRaw).toHaveBeenCalled();
  });

  it('ao desactivar restaura Direct Totem e reconcilia workers', async () => {
    const db = makeDb({ publisherCount: 1 });
    db.findFirst = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('system_settings') && params?.[0] === 'installation.modules') {
        return {
          setting_value: JSON.stringify({
            multi_agency: true,
            billing: true,
            playlists_advanced: true,
            subscribers: true,
            dispatcher_admin: true,
            direct_totem_mode: false,
            simple_totem_mode: false,
          }),
        };
      }
      if (sql.includes('system_settings') && params?.[0] === 'installation.profile') {
        return { setting_value: 'multi_agency' };
      }
      return null;
    });

    // Force profile resolution mock already single - override for this test
    const profileSvc = await import('../../../services/installationProfileService');
    (profileSvc.resolveInstallationProfile as jest.Mock).mockResolvedValueOnce('multi_agency');
    const simpleSvc = await import('../../../services/totemSimpleModeService');
    (simpleSvc.resolveInstallationSimpleTotemMode as jest.Mock).mockResolvedValueOnce(false);

    const result = await setMultiAgencyMode(db as any, false, 1);
    expect(result.enabled).toBe(false);
    expect(result.modules.direct_totem_mode).toBe(true);
    expect(result.workersReconciled).toBe(true);
    expect(result.requiresBackendRestart).toBe(false);
  });
});

describe('saveInstallationModules', () => {
  it('devolve workersReconciled quando billing muda', async () => {
    const db = makeDb();
    db.findFirst = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('system_settings') && params?.[0] === 'installation.modules') {
        return {
          setting_value: JSON.stringify({
            multi_agency: true,
            billing: false,
            playlists_advanced: true,
            subscribers: true,
            dispatcher_admin: true,
            direct_totem_mode: false,
            simple_totem_mode: false,
          }),
        };
      }
      if (sql.includes('system_settings') && params?.[0] === 'installation.profile') {
        return { setting_value: 'multi_agency' };
      }
      return null;
    });
    const profileSvc = await import('../../../services/installationProfileService');
    (profileSvc.resolveInstallationProfile as jest.Mock).mockResolvedValueOnce('multi_agency');
    const simpleSvc = await import('../../../services/totemSimpleModeService');
    (simpleSvc.resolveInstallationSimpleTotemMode as jest.Mock).mockResolvedValueOnce(false);

    const result = await saveInstallationModules(db as any, { billing: true }, 1);
    expect(result.modules.billing).toBe(true);
    expect(result.workersReconciled).toBe(true);
    expect(result.requiresBackendRestart).toBe(false);
    expect(result.profile).toBe('multi_agency');
    expect(result.requiresBackendRestart).toBe(false);
    expect(result.profile).toBe('multi_agency');
  });
});
