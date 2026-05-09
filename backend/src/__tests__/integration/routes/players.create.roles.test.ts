import express from 'express';
import request from 'supertest';

describe('POST /api/players — política de criação (compact)', () => {
  it('retorna 403 para publisher_user quando TOTEMDIGITAL_COMPACT=true', async () => {
    jest.resetModules();

    jest.doMock('../../../config/featureFlags', () => ({
      TOTEMDIGITAL_COMPACT: true,
    }));

    jest.doMock('../../../services/playerService', () => ({
      getPlayerService: () => ({
        createPlayer: jest.fn(),
      }),
    }));

    jest.doMock('../../../middleware/auth.middleware', () => {
      const actual = jest.requireActual(
        '../../../middleware/auth.middleware'
      ) as typeof import('../../../middleware/auth.middleware');
      return {
        authMiddleware: (req: any, _res: any, next: any) => {
          req.user = { id: 1, role: 'publisher_user', publisherId: 10 };
          next();
        },
        authorizeRole: actual.authorizeRole,
      };
    });

    jest.doMock('../../../utils/loggerHelper', () => ({
      logError: jest.fn(async () => undefined),
    }));

    const { default: router } = await import('../../../routes/players');
    const app = express();
    app.use(express.json());
    app.use('/api/players', router);

    const res = await request(app).post('/api/players').send({
      name: 'Totem-X',
    });

    expect(res.status).toBe(403);
    expect(String(res.body?.error || '')).toContain('Acesso negado');
  });
});
