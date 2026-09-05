import express from 'express';
import request from 'supertest';
import * as qrcodeService from '../../../services/qrcodeService';

import * as express from 'express';

const mockGetQRCodeById = jest.fn();
const mockGetQRCodeScans = jest.fn();

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

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
}));

describe('GET /api/qrcodes/:id — escopo subscriber', () => {
  let getQRCodeServiceSpy: jest.SpyInstance;

  const makeApp = async () => {
    const router = (await import('../../../routes/qrcodes')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/qrcodes', router);
    return app;
  };

  beforeEach(() => {
    mockGetQRCodeById.mockReset();
    mockGetQRCodeScans.mockReset();
    mockGetQRCodeById.mockResolvedValue({
      id: 1,
      clientId: 10,
      title: 'Q',
    });
    getQRCodeServiceSpy = jest.spyOn(qrcodeService, 'getQRCodeService').mockReturnValue({
      getQRCodeById: mockGetQRCodeById,
      getQRCodeScans: mockGetQRCodeScans,
    } as any);
  });

  afterEach(() => {
    getQRCodeServiceSpy?.mockRestore();
  });

  it('permite subscriber_user do mesmo assinante (clientId = subscriber_id)', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/qrcodes/1').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('bloqueia subscriber_user de outro assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/qrcodes/1').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
  });

  it('admin_sql pode ler qualquer QR', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/qrcodes/1').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/qrcodes/:id/scans — escopo', () => {
  let getQRCodeServiceSpy: jest.SpyInstance;

  const makeApp = async () => {
    const router = (await import('../../../routes/qrcodes')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/qrcodes', router);
    return app;
  };

  beforeEach(() => {
    mockGetQRCodeById.mockReset();
    mockGetQRCodeScans.mockReset();
    mockGetQRCodeById.mockResolvedValue({ id: 2, clientId: 10 });
    mockGetQRCodeScans.mockResolvedValue({ scans: [], total: 0 });
    getQRCodeServiceSpy = jest.spyOn(qrcodeService, 'getQRCodeService').mockReturnValue({
      getQRCodeById: mockGetQRCodeById,
      getQRCodeScans: mockGetQRCodeScans,
    } as any);
  });

  afterEach(() => {
    getQRCodeServiceSpy?.mockRestore();
  });

  it('bloqueia scans para outro assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/qrcodes/2/scans').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
    expect(mockGetQRCodeScans).not.toHaveBeenCalled();
  });
});
