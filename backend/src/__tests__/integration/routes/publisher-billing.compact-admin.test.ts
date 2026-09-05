import express from 'express';
import request from 'supertest';

import * as express from 'express';

const mockGetBillingById = jest.fn();

jest.mock('../../../config/featureFlags', () => ({
  TOTEMDIGITAL_COMPACT: true,
}));

jest.mock('../../../middleware/auth.middleware', () => {
  const authFn = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const h = String(req.headers.authorization || '');
    if (!h.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = h.slice(7);
    if (token === 'owner') {
      req.user = { id: 1, role: 'owner_system', publisherId: 1, userType: 'system_user' };
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
  publisherId: 1,
  billingType: 'revenue_share',
  amount: 100,
  currency: 'BRL',
  direction: 'incoming',
  description: 'Repasse',
  dueDate: '2026-06-01',
  status: 'pending',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('publisher-billing modo compacto — gestor com revenue share', () => {
  beforeEach(() => {
    delete (global as any).publisherBillingServiceInstance;
    mockGetBillingById.mockReset();
    mockGetBillingById.mockResolvedValue(minimalBilling);
  });

  it('permite owner_system aceder faturamento da organização (sem guard legacy)', async () => {
    const router = (await import('../../../routes/publisher-billing')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/publisher-billing', router);

    const res = await request(app)
      .get('/api/publisher-billing/1')
      .set('Authorization', 'Bearer owner');

    expect(res.status).toBe(200);
    expect(mockGetBillingById).toHaveBeenCalled();
  });
});
