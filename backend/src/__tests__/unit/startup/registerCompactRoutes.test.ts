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
        '/api/users',
        '/api/locals',
        '/api/smart-tvs',
        '/api/totems',
        '/api/dispatcher-totem',
        '/api/dispatcher-debug',
        '/api/players',
        '/api/media',
        '/api/playlists',
        '/api/campaigns',
        '/api/qrcodes',
        '/api/qr-codes',
        '/api/settings',
        '/api/dashboard',
        '/api/health',
        '/api/notifications',
      ])
    );

    expect(registeredPaths).not.toEqual(
      expect.arrayContaining(['/api/subscribers', '/api/publishers', '/api/billing'])
    );
  });
});

