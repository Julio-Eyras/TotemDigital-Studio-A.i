import { registerCompactProParityRoutes } from '../../../startup/registerCompactProParityRoutes';

describe('registerCompactProParityRoutes', () => {
  it('regista rotas Pro adicionais sem colidir com a base compacta', () => {
    const use = jest.fn();
    const app = { use } as any;

    registerCompactProParityRoutes(app);

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
      ])
    );
  });
});
