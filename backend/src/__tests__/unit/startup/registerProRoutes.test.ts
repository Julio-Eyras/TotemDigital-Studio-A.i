import { registerProRoutes } from '../../../startup/registerProRoutes';

jest.mock('../../../config/logger', () => ({
  getLogger: jest.fn().mockResolvedValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('registerProRoutes', () => {
  it('deve registrar endpoints Pro e middlewares de depreciação', () => {
    const use = jest.fn();
    const app = { use } as any;

    registerProRoutes(app);

    const registeredPaths = use.mock.calls.map((call) => call[0]);

    expect(registeredPaths).toEqual(
      expect.arrayContaining([
        '/api/clients',
        '/api/subscribers',
        '/api/publishers',
        '/api/subscriber-access',
        '/api/contracts',
        '/api/playlist-mix',
        '/api/billing',
        '/api/subscriber-billing',
        '/api/publisher-billing',
        '/api/plans',
        '/api/users',
        '/api/subscriptions',
        '/api/reports',
        '/api/ai',
        '/api/smart-playlist',
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

    const billingCall = use.mock.calls.find((call) => call[0] === '/api/billing');
    expect(billingCall).toBeDefined();
    const billingDeprecationMiddleware = billingCall?.[3] as Function;
    const resBilling = { setHeader: jest.fn() } as any;
    const nextBilling = jest.fn();
    billingDeprecationMiddleware({}, resBilling, nextBilling);
    expect(resBilling.setHeader).toHaveBeenCalledWith('X-Deprecated-Route', 'true');
    expect(nextBilling).toHaveBeenCalled();
  });
});

