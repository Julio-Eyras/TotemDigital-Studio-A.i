import express from 'express';
import request from 'supertest';

const mockDispatchBatch = jest.fn();

jest.mock('../../../middleware/auth.middleware', () => {
  const authFn = (req: any, res: any, next: any) => {
    const h = String(req.headers.authorization || '');
    if (!h.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: 1, role: 'admin' };
    next();
  };
  return { authMiddleware: authFn, authenticateToken: authFn, authorizeRole: () => (_req: any, _res: any, next: any) => next() };
});

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
  logDebug: jest.fn(async () => undefined),
  logWarnSync: jest.fn(),
  sanitizeForLogging: (x: unknown) => x,
}));

jest.mock('../../../services/dispatcherTotemService', () => ({
  getDispatcherTotemService: () => ({
    dispatchBatch: (...args: unknown[]) => mockDispatchBatch(...args),
  }),
}));

describe('POST /api/dispatcher-totem/:totemId/dispatch-batch', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/dispatcher-totem')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/dispatcher-totem', router);
    return app;
  };

  beforeEach(() => {
    mockDispatchBatch.mockReset();
  });

  it('401 sem Authorization', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/dispatcher-totem/1/dispatch-batch')
      .send({ timestamps: ['2026-05-03T12:00:00.000Z'] });
    expect(res.status).toBe(401);
    expect(mockDispatchBatch).not.toHaveBeenCalled();
  });

  it('400 quando totemId não é inteiro válido', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/dispatcher-totem/x/dispatch-batch')
      .set('Authorization', 'Bearer admin')
      .send({ timestamps: ['2026-05-03T12:00:00.000Z'] });
    expect(res.status).toBe(400);
    expect(mockDispatchBatch).not.toHaveBeenCalled();
  });

  it('400 quando timestamps está vazio', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/dispatcher-totem/1/dispatch-batch')
      .set('Authorization', 'Bearer admin')
      .send({ timestamps: [] });
    expect(res.status).toBe(400);
    expect(mockDispatchBatch).not.toHaveBeenCalled();
  });

  it('400 quando timestamps tem mais de 48 entradas', async () => {
    const app = await makeApp();
    const timestamps = Array.from({ length: 49 }, (_, i) =>
      new Date(Date.UTC(2026, 0, 1, i % 24, 0, 0)).toISOString()
    );
    const res = await request(app)
      .post('/api/dispatcher-totem/1/dispatch-batch')
      .set('Authorization', 'Bearer admin')
      .send({ timestamps });
    expect(res.status).toBe(400);
    expect(mockDispatchBatch).not.toHaveBeenCalled();
  });

  it('400 quando um timestamp não é ISO8601', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/dispatcher-totem/1/dispatch-batch')
      .set('Authorization', 'Bearer admin')
      .send({ timestamps: ['2026-05-03T12:00:00.000Z', 'não-é-data'] });
    expect(res.status).toBe(400);
    expect(mockDispatchBatch).not.toHaveBeenCalled();
  });

  it('200 e mapeia results a partir do serviço', async () => {
    mockDispatchBatch.mockResolvedValue([
      {
        timestamp: '2026-05-03T10:00:00.000Z',
        success: true,
        plan: { playlistId: 42, playlistName: 'P', mediaItems: [], totalDuration: 0 },
        fromCache: true,
        executionTimeMs: 3,
      },
      {
        timestamp: '2026-05-03T11:00:00.000Z',
        success: false,
        error: 'falhou',
      },
    ]);

    const app = await makeApp();
    const ts0 = '2026-05-03T10:00:00.000Z';
    const ts1 = '2026-05-03T11:00:00.000Z';
    const res = await request(app)
      .post('/api/dispatcher-totem/7/dispatch-batch')
      .set('Authorization', 'Bearer admin')
      .send({ timestamps: [ts0, ts1], timezone: 'America/Sao_Paulo', skipCache: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0]).toMatchObject({
      timestamp: '2026-05-03T10:00:00.000Z',
      success: true,
      data: expect.objectContaining({ playlistId: 42 }),
      fromCache: true,
      executionTimeMs: 3,
    });
    expect(res.body.results[1]).toMatchObject({
      success: false,
      error: 'falhou',
    });

    expect(mockDispatchBatch).toHaveBeenCalledTimes(1);
    const [totemId, dates, opts, tz] = mockDispatchBatch.mock.calls[0];
    expect(totemId).toBe(7);
    expect(dates).toHaveLength(2);
    expect(new Date(ts0).getTime()).toBe(dates[0].getTime());
    expect(new Date(ts1).getTime()).toBe(dates[1].getTime());
    expect(opts).toEqual({ skipCache: true, includeCandidates: false });
    expect(tz).toBe('America/Sao_Paulo');
  });

  it('500 quando dispatchBatch lança', async () => {
    mockDispatchBatch.mockRejectedValue(new Error('db down'));
    const app = await makeApp();
    const res = await request(app)
      .post('/api/dispatcher-totem/1/dispatch-batch')
      .set('Authorization', 'Bearer admin')
      .send({ timestamps: ['2026-05-03T12:00:00.000Z'] });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('db down');
  });
});
