import express from 'express';
import request from 'supertest';

const mockGetUpdateHistory = jest.fn();
const mockGetUpdateStats = jest.fn();
const mockActivateUpdate = jest.fn();
const mockPauseUpdate = jest.fn();

jest.mock('../../../services/otaUpdateService', () => ({
  getOTAUpdateService: () => ({
    getUpdateHistory: mockGetUpdateHistory,
    getUpdateStats: mockGetUpdateStats,
    activateUpdate: mockActivateUpdate,
    pauseUpdate: mockPauseUpdate,
  }),
}));

jest.mock('../../../middleware/validation.middleware', () => ({
  validateRequest: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
}));

jest.mock('../../../middleware/auth.middleware', () => {
  const actual = jest.requireActual('../../../middleware/auth.middleware');
  const authFn = (req: any, res: any, next: any) => {
    const h = String(req.headers.authorization || '');
    if (!h.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' });
    }
    const token = h.slice(7);
    const users: Record<string, { id: number; role: string }> = {
      admin: { id: 1, role: 'admin' },
      operator: { id: 2, role: 'operator' },
      subscriber: { id: 3, role: 'subscriber_user' },
      owner: { id: 4, role: 'owner_system' },
    };
    const user = users[token];
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = user;
    next();
  };
  return {
    ...actual,
    authMiddleware: authFn,
  };
});

const sampleUpdate = {
  id: 1,
  version: '1.0.0',
  platform: 'android' as const,
  filePath: '/tmp/a.apk',
  fileSize: 100,
  checksum: 'x',
  isMandatory: false,
  rolloutPercentage: 100,
  status: 'active' as const,
  createdAt: new Date('2026-01-01'),
};

async function buildApp() {
  const router = (await import('../../../routes/ota-updates')).default;
  const app = express();
  app.use(express.json());
  app.use('/api/ota-updates', router);
  return app;
}

describe('GET /api/ota-updates (auth e roles)', () => {
  beforeEach(() => {
    mockGetUpdateHistory.mockReset();
    mockGetUpdateHistory.mockResolvedValue([sampleUpdate]);
  });

  it('401 sem Authorization', async () => {
    const app = await buildApp();
    const res = await request(app).get('/api/ota-updates');
    expect(res.status).toBe(401);
    expect(mockGetUpdateHistory).not.toHaveBeenCalled();
  });

  it('403 para subscriber_user', async () => {
    const app = await buildApp();
    const res = await request(app)
      .get('/api/ota-updates')
      .set('Authorization', 'Bearer subscriber');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('200 para admin com lista filtrável', async () => {
    const app = await buildApp();
    const res = await request(app)
      .get('/api/ota-updates?platform=android&status=active')
      .set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(mockGetUpdateHistory).toHaveBeenCalled();
  });

  it('200 para operator', async () => {
    const app = await buildApp();
    const res = await request(app)
      .get('/api/ota-updates')
      .set('Authorization', 'Bearer operator');
    expect(res.status).toBe(200);
  });

  it('200 para owner_system (bypass)', async () => {
    const app = await buildApp();
    const res = await request(app)
      .get('/api/ota-updates')
      .set('Authorization', 'Bearer owner');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/ota-updates/:id/activate (roles)', () => {
  beforeEach(() => {
    mockActivateUpdate.mockReset();
    mockActivateUpdate.mockResolvedValue(undefined);
  });

  it('403 para operator (apenas admin na rota POST activate)', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/api/ota-updates/1/activate')
      .set('Authorization', 'Bearer operator');
    expect(res.status).toBe(403);
    expect(mockActivateUpdate).not.toHaveBeenCalled();
  });

  it('200 para admin', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/api/ota-updates/1/activate')
      .set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
    expect(mockActivateUpdate).toHaveBeenCalledWith(1, 1);
  });
});

describe('GET /api/ota-updates/stats', () => {
  beforeEach(() => {
    mockGetUpdateStats.mockReset();
    mockGetUpdateStats.mockResolvedValue({ updates: { active: 1 }, totems: {} });
  });

  it('403 para subscriber_user', async () => {
    const app = await buildApp();
    const res = await request(app)
      .get('/api/ota-updates/stats')
      .set('Authorization', 'Bearer subscriber');
    expect(res.status).toBe(403);
  });

  it('200 para admin', async () => {
    const app = await buildApp();
    const res = await request(app)
      .get('/api/ota-updates/stats')
      .set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
    expect(res.body.data.updates.active).toBe(1);
  });
});
