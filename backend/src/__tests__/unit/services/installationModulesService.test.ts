/**
 * Unit tests for multi-agency activation bootstrap + restart detection.
 */
import {
  ensureSystemOwnerPublisherIfEmpty,
  setMultiAgencyMode,
  saveInstallationModules,
} from '../../../services/installationModulesService';

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../services/installationProfileService', () => ({
  resolveInstallationProfile: jest.fn().mockResolvedValue('single_publisher'),
  resetInstallationProfileCache: jest.fn(),
}));

jest.mock('../../../services/totemSimpleModeService', () => ({
  resolveInstallationSimpleTotemMode: jest.fn().mockResolvedValue(true),
}));

function makeDb(opts?: {
  publisherCount?: number;
  modulesJson?: string;
  profile?: string;
}) {
  const publisherCount = opts?.publisherCount ?? 1;
  const modulesJson = opts?.modulesJson ?? '{}';
  const profile = opts?.profile ?? 'single_publisher';
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
      if (sql.includes("setting_key = $1") || sql.includes("installation.modules")) {
        if (sql.includes('installation.modules') || (arguments as any)) {
          // handled below by params
        }
      }
      if (sql.includes('system_settings')) {
        // Called with params; we inspect in mockImplementation below
        return null;
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
  it('ao activar com publishers existentes não faz seed e pede restart', async () => {
    const db = makeDb({ publisherCount: 1 });
    // Module/profile lookups
    db.findFirst = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('COUNT(*)') && sql.includes('publishers')) return { c: 1 };
      if (sql.includes('system_settings') && params?.[0] === 'installation.modules') {
        return { setting_value: '{}' };
      }
      if (sql.includes('system_settings') && params?.[0] === 'installation.profile') {
        return { setting_value: 'single_publisher' };
      }
      if (sql.includes('system_settings')) return null;
      return null;
    });

    const result = await setMultiAgencyMode(db as any, true, 1);
    expect(result.enabled).toBe(true);
    expect(result.requiresBackendRestart).toBe(true);
    expect(result.modules.multi_agency).toBe(true);
    expect(result.modules.direct_totem_mode).toBe(false);
    expect(result.bootstrap?.created).toBe(false);
    expect(db.executeRaw).toHaveBeenCalled();
  });

  it('ao desactivar restaura Direct Totem e pede restart', async () => {
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
    expect(result.requiresBackendRestart).toBe(true);
  });
});

describe('saveInstallationModules', () => {
  it('devolve requiresBackendRestart quando billing muda', async () => {
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
    expect(result.requiresBackendRestart).toBe(true);
    expect(result.profile).toBe('multi_agency');
  });
});
