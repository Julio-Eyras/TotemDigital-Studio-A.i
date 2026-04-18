import { registerCompactRoutes } from '../../../startup/registerCompactRoutes';

describe('registerCompactRoutes', () => {
  it('deve registrar somente endpoints essenciais do modo compacto', () => {
    const use = jest.fn();
    const app = { use } as any;

    registerCompactRoutes(app);

    const registeredPaths = use.mock.calls.map((call) => call[0]);

    expect(registeredPaths).toEqual(
      expect.arrayContaining([
        '/api/auth',
        '/api/subscribers',
        '/api/locals',
        '/api/totems',
        '/api/dispatcher-totem',
        '/api/dispatcher-debug',
        '/api/players',
        '/api/media',
        '/api/playlists',
        '/api/campaigns',
        '/api/settings',
        '/api/dashboard',
        '/api/alerts',
        '/api/logs',
        '/api/playlist-engine',
        '/api/health',
      ])
    );

    const excluded = [
      '/api/publishers',
      '/api/billing',
      '/api/users',
      '/api/smart-tvs',
      '/api/qrcodes',
      '/api/notifications',
    ];
    for (const path of excluded) {
      expect(registeredPaths).not.toContain(path);
    }
  });
});

