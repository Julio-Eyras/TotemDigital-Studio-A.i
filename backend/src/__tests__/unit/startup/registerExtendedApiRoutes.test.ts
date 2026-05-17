import { registerExtendedApiRoutes } from '../../../startup/registerExtendedApiRoutes';

describe('registerExtendedApiRoutes', () => {
  it('regista rotas estendidas (paridade Pro/Studio) sem colidir com a base compacta', () => {
    const use = jest.fn();
    const app = { use } as any;

    registerExtendedApiRoutes(app);

    const registeredPaths = use.mock.calls.map((call) => call[0]);

    expect(registeredPaths).toEqual(
      expect.arrayContaining([
        '/api/playlist-mix',
        '/api/analytics',
        '/api/reports',
        '/api/ai',
        '/api/smart-playlist',
        '/api/export-queries',
        '/api/network',
        '/api/roles',
        '/api/users',
        '/api/backups',
        '/api/qrcodes',
        '/api/notifications',
      ])
    );
  });
});
