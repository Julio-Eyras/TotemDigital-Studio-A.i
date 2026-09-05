import express from 'express';
import request from 'supertest';

import * as express from 'express';

const mockGetSmartPlaylistById = jest.fn();

jest.mock('../../../middleware/operatorProtection.middleware', () => ({
  blockClientDataAccess: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../../middleware/auth.middleware', () => {
  const authFn = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const h = String(req.headers.authorization || '');
    if (!h.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = h.slice(7);
    if (token === 'sub10') {
      req.user = { id: 1, role: 'subscriber_user', subscriberId: 10, userType: 'subscriber_user' };
    } else if (token === 'sub99') {
      req.user = { id: 2, role: 'subscriber_user', subscriberId: 99, userType: 'subscriber_user' };
    } else if (token === 'admin') {
      req.user = { id: 3, role: 'admin_sql' };
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
  return { authenticateToken: authFn, authorizeRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next() };
});

jest.mock('../../../services/smartPlaylistService', () => ({
  getSmartPlaylistService: () => ({
    getSmartPlaylistById: (...a: unknown[]) => mockGetSmartPlaylistById(...a),
  }),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
  logDebug: jest.fn(async () => undefined),
}));

describe('GET /api/smart-playlist/:id — escopo', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/smart-playlist')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/smart-playlist', router);
    return app;
  };

  beforeEach(() => {
    mockGetSmartPlaylistById.mockReset();
    mockGetSmartPlaylistById.mockResolvedValue({
      id: 1,
      smart_playlist_id: 1,
      subscriberId: 10,
      name: 'S',
    });
  });

  it('permite subscriber_user do assinante da playlist', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/smart-playlist/1').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
  });

  it('bloqueia subscriber_user de outro assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/smart-playlist/1').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
  });

  it('admin_sql pode ler qualquer smart playlist', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/smart-playlist/1').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
  });
});
