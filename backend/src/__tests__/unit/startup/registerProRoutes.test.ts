import { registerProRoutes } from '../../../startup/registerProRoutes';

describe('registerProRoutes (alias registerExtendedApiRoutes)', () => {
  it('deve registrar rotas estendidas e middleware de depreciação em /api/clients', () => {
    const use = jest.fn();
    const app = { use } as any;

    registerProRoutes(app);

    const registeredPaths = use.mock.calls.map((call) => call[0]);

    expect(registeredPaths).toEqual(
      expect.arrayContaining([
        '/api/clients',
        '/api/playlist-mix',
        '/api/qrcodes',
        '/api/notifications',
        '/api/users',
        '/api/smartdisplayfx',
        '/api/backups',
      ])
    );

    const clientCall = use.mock.calls.find((call) => call[0] === '/api/clients');
    expect(clientCall).toBeDefined();
    const clientDeprecationMiddleware = clientCall?.[3] as Function;
    const resClients = { setHeader: jest.fn() } as any;
    const nextClients = jest.fn();
    clientDeprecationMiddleware({}, resClients, nextClients);
    expect(resClients.setHeader).toHaveBeenCalledWith('X-Deprecated-Route', 'true');
    expect(nextClients).toHaveBeenCalled();
  });
});
