import express from 'express';
import request from 'supertest';
import * as reportsService from '../../../services/reportsService';

const mockGetReportById = jest.fn();

jest.mock('../../../middleware/operatorProtection.middleware', () => ({
  blockClientDataAccess: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../middleware/auth.middleware', () => {
  const authFn = (req: any, res: any, next: any) => {
    const h = String(req.headers.authorization || '');
    if (!h.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = h.slice(7);
    if (token === 'sub10') {
      req.user = { id: 1, role: 'subscriber_user', subscriberId: 10, userId: 1, userType: 'subscriber_user' };
    } else if (token === 'sub99') {
      req.user = { id: 2, role: 'subscriber_user', subscriberId: 99, userId: 2, userType: 'subscriber_user' };
    } else if (token === 'admin') {
      req.user = { id: 3, role: 'admin_sql', userId: 3 };
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
  return { authenticateToken: authFn, authorizeRole: () => (_req: any, _res: any, next: any) => next() };
});

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
  logWarn: jest.fn(async () => undefined),
}));

const sampleReport = (filters: { subscriberId?: number } | null, createdBy: number) => ({
  id: 1,
  type: 'subscriber',
  title: 'R',
  status: 'completed' as const,
  format: 'pdf',
  metadata: {
    filters: filters || {},
    recordCount: 0,
    generationTime: 0,
  },
  createdAt: new Date().toISOString(),
  createdBy,
});

describe('GET /api/reports/:id — escopo', () => {
  let spy: jest.SpyInstance;

  const makeApp = async () => {
    const router = (await import('../../../routes/reports')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/reports', router);
    return app;
  };

  beforeEach(() => {
    mockGetReportById.mockReset();
    spy = jest.spyOn(reportsService, 'getReportsService').mockReturnValue({
      getReportById: mockGetReportById,
    } as any);
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('permite subscriber_user quando filters.subscriberId é o próprio assinante', async () => {
    mockGetReportById.mockResolvedValue(sampleReport({ subscriberId: 10 }, 999));
    const app = await makeApp();
    const res = await request(app).get('/api/reports/1').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
  });

  it('bloqueia subscriber_user quando filters.subscriberId é de outro assinante', async () => {
    mockGetReportById.mockResolvedValue(sampleReport({ subscriberId: 10 }, 999));
    const app = await makeApp();
    const res = await request(app).get('/api/reports/1').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
  });

  it('permite quando não há filtro de assinante mas createdBy coincide com o utilizador', async () => {
    mockGetReportById.mockResolvedValue(sampleReport(null, 2));
    const app = await makeApp();
    const res = await request(app).get('/api/reports/1').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(200);
  });

  it('admin_sql ignora filtros', async () => {
    mockGetReportById.mockResolvedValue(sampleReport({ subscriberId: 10 }, 1));
    const app = await makeApp();
    const res = await request(app).get('/api/reports/1').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
  });
});
