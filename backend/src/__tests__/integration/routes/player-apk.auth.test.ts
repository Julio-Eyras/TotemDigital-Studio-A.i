import express from 'express';
import request from 'supertest';

import * as express from 'express';

const mockFindFirst = jest.fn();
const mockFindMany = jest.fn();
const mockExecuteRaw = jest.fn();

jest.mock('../../../config/database', () => ({
  getDatabase: () => ({
    findFirst: mockFindFirst,
    findMany: mockFindMany,
    executeRaw: mockExecuteRaw,
  }),
}));

jest.mock('../../../services/otaUpdateService', () => ({
  getOTAUpdateService: () => ({
    createUpdate: jest.fn(),
    activateUpdate: jest.fn(),
  }),
}));

jest.mock('../../../middleware/validation.middleware', () => ({
  validateRequest: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
  logInfo: jest.fn(async () => undefined),
}));

jest.mock('../../../middleware/auth.middleware', () => {
  const actual = jest.requireActual('../../../middleware/auth.middleware');
  const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = String(req.headers.authorization || '').replace('Bearer ', '');
    const users: Record<string, { id: number; role: string }> = {
      admin: { id: 1, role: 'admin' },
      operator: { id: 2, role: 'operator' },
      subscriber: { id: 3, role: 'subscriber_user' },
    };
    if (!users[token]) return res.status(401).json({ error: 'Unauthorized' });
    req.user = users[token];
    return next();
  };
  return { ...actual, authMiddleware };
});

async function buildApp() {
  const router = (await import('../../../routes/player-apk')).default;
  const app = express();
  app.use(express.json());
  app.use('/api/player-apk', router);
  return app;
}

describe('central APK', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockFindMany.mockReset();
    mockExecuteRaw.mockReset();
  });

  it('exige autenticação', async () => {
    const response = await request(await buildApp()).get('/api/player-apk/documents');
    expect(response.status).toBe(401);
  });

  it('permite documentação, mas restringe release para subscriber', async () => {
    const app = await buildApp();
    const documents = await request(app)
      .get('/api/player-apk/documents')
      .set('Authorization', 'Bearer subscriber');
    const release = await request(app)
      .get('/api/player-apk/designated')
      .set('Authorization', 'Bearer subscriber');

    expect(documents.status).toBe(200);
    expect(documents.body.data).toHaveLength(6);
    expect(release.status).toBe(403);
  });

  it('retorna a versão designada para operador', async () => {
    mockFindFirst.mockResolvedValue({
      id: 7,
      version: '2.08',
      version_code: 108,
      platform: 'android',
      file_size: 123,
      checksum: 'abc',
      channel: 'production',
    });

    const response = await request(await buildApp())
      .get('/api/player-apk/designated')
      .set('Authorization', 'Bearer operator');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: 7,
      version: '2.08',
      versionCode: 108,
      channel: 'production',
    });
    expect(response.body).toHaveProperty('installer');
    if (response.body.installer) {
      expect(response.body.installer).toMatchObject({
        downloadUrl: '/api/player-apk/download?kind=installer',
      });
      expect(String(response.body.installer.filename)).toMatch(/^Instala-Player-TotemDigital/);
    }
  });

  it('permite designação somente para administrador', async () => {
    mockExecuteRaw.mockResolvedValue({ rows: [{ designated_update_id: 7 }] });
    const app = await buildApp();
    const denied = await request(app)
      .post('/api/player-apk/designate')
      .set('Authorization', 'Bearer operator')
      .send({ updateId: 7 });
    const allowed = await request(app)
      .post('/api/player-apk/designate')
      .set('Authorization', 'Bearer admin')
      .send({ updateId: 7 });

    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it('não rebenta com schema em falta — devolve data null', async () => {
    mockFindFirst.mockRejectedValueOnce(Object.assign(new Error('relation does not exist'), { code: '42P01' }));

    const response = await request(await buildApp())
      .get('/api/player-apk/designated')
      .set('Authorization', 'Bearer operator');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, schemaReady: false, data: null });
    expect(response.body).toHaveProperty('installer');
  });

  it('serve o instalador com kind=installer e restringe subscriber', async () => {
    const app = await buildApp();
    const denied = await request(app)
      .get('/api/player-apk/download?kind=installer')
      .set('Authorization', 'Bearer subscriber');
    const allowed = await request(app)
      .get('/api/player-apk/download?kind=installer')
      .set('Authorization', 'Bearer operator');

    expect(denied.status).toBe(403);
    expect([200, 404]).toContain(allowed.status);
    if (allowed.status === 200) {
      expect(String(allowed.headers['content-disposition'] || '')).toMatch(/Instala-Player-TotemDigital/);
    }
  });

  it('lista candidatos Android para administrador', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 9, version: '2.12', version_code: 112, status: 'draft', file_size: 10 },
    ]);

    const response = await request(await buildApp())
      .get('/api/player-apk/candidates')
      .set('Authorization', 'Bearer admin');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      expect.objectContaining({ id: 9, version: '2.12', versionCode: 112 }),
    ]);
  });
});
