import express from 'express';
import request from 'supertest';

const mockGetBillingById = jest.fn();

jest.mock('../../../middleware/subscriberIsolation.middleware', () => ({
  subscriberIsolationMiddleware: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../middleware/auth.middleware', () => {
  const authFn = (req: any, res: any, next: any) => {
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
      req.user = { id: 3, role: 'admin' };
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
  return {
    authMiddleware: authFn,
    authorizeRole: () => (_req: any, _res: any, next: any) => next(),
  };
});

jest.mock('../../../middleware/validation.middleware', () => ({
  validateRequest: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../services/subscriberBillingService', () => ({
  SubscriberBillingService: function MockSubscriberBillingService(this: any) {
    this.getBillingById = mockGetBillingById;
  },
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
}));

const minimalBilling = {
  billingId: 1,
  subscriberId: 10,
  billingType: 'campaign',
  amount: 100,
  currency: 'BRL',
  description: 'Teste',
  dueDate: '2026-01-01',
  status: 'pending',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('GET /api/subscriber-billing/:id — escopo', () => {
  const makeApp = async () => {
    delete (global as any).subscriberBillingServiceInstance;
    const router = (await import('../../../routes/subscriber-billing')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/subscriber-billing', router);
    return app;
  };

  beforeEach(() => {
    delete (global as any).subscriberBillingServiceInstance;
    mockGetBillingById.mockReset();
    mockGetBillingById.mockResolvedValue(minimalBilling);
  });

  it('permite subscriber_user na fatura do próprio assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/subscriber-billing/1').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data?.subscriberId).toBe(10);
    expect(mockGetBillingById).toHaveBeenCalledWith(1);
  });

  it('bloqueia subscriber_user de outro assinante (IDOR)', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/subscriber-billing/1').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('admin pode ler qualquer fatura', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/subscriber-billing/1').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
