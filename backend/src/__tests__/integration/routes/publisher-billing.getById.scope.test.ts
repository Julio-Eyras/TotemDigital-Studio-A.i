import express from 'express';
import request from 'supertest';

import * as express from 'express';

const mockGetBillingById = jest.fn();

jest.mock('../../../config/featureFlags', () => ({
  TOTEMDIGITAL_COMPACT: false,
}));

jest.mock('../../../middleware/auth.middleware', () => {
  const authFn = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const h = String(req.headers.authorization || '');
    if (!h.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = h.slice(7);
    if (token === 'pub10') {
      req.user = { id: 1, role: 'publisher_user', publisherId: 10, userType: 'publisher_user' };
    } else if (token === 'pub99') {
      req.user = { id: 2, role: 'publisher_user', publisherId: 99, userType: 'publisher_user' };
    } else if (token === 'admin') {
      req.user = { id: 3, role: 'admin_sql' };
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
  return {
    authMiddleware: authFn,
    authorizeRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  };
});

jest.mock('../../../middleware/validation.middleware', () => ({
  validateRequest: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../../services/publisherBillingService', () => ({
  PublisherBillingService: function MockPublisherBillingService(this: any) {
    this.getBillingById = mockGetBillingById;
  },
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
}));

const minimalBilling = {
  billingId: 1,
  publisherId: 10,
  billingType: 'revenue_share',
  amount: 50,
  currency: 'BRL',
  direction: 'incoming',
  description: 'Teste',
  dueDate: '2026-01-01',
  status: 'pending',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('GET /api/publisher-billing/:id — escopo publisher', () => {
  const makeApp = async () => {
    delete (global as any).publisherBillingServiceInstance;
    const router = (await import('../../../routes/publisher-billing')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/publisher-billing', router);
    return app;
  };

  beforeEach(() => {
    delete (global as any).publisherBillingServiceInstance;
    mockGetBillingById.mockReset();
    mockGetBillingById.mockResolvedValue(minimalBilling);
  });

  it('permite publisher_user na fatura do próprio publisher', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/publisher-billing/1').set('Authorization', 'Bearer pub10');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockGetBillingById).toHaveBeenCalledWith(1);
  });

  it('bloqueia publisher_user de outro publisher (IDOR)', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/publisher-billing/1').set('Authorization', 'Bearer pub99');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('admin_sql pode ler qualquer fatura', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/publisher-billing/1').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
