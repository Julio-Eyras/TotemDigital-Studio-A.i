import { registerExtendedApiRoutes } from '../../../startup/registerExtendedApiRoutes';

describe('registerExtendedApiRoutes', () => {
  it('regista rotas estendidas incluindo qrcodes e notifications', () => {
    const use = jest.fn();
    const app = { use } as any;

    registerExtendedApiRoutes(app);

    const paths = use.mock.calls.map((call) => call[0]);

    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/playlist-mix',
        '/api/qrcodes',
        '/api/notifications',
        '/api/users',
      ])
    );
  });
});
