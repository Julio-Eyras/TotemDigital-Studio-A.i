import express from 'express';
import request from 'supertest';

const mockAccessService = {
  removePlanPublisherAccess: jest.fn(),
};

const mockReconcileService = {
  reconcilePlan: jest.fn(),
};

jest.mock('../../../middleware/auth.middleware', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 1, userId: 1, username: 'admin_sql', email: 'admin@example.com', role: 'admin_sql' };
    next();
  },
  authorizeRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../../services/subscriberAccessService', () => ({
  getSubscriberAccessServiceInstance: () => mockAccessService,
}));

jest.mock('../../../services/reconcileService', () => ({
  getReconcileService: () => mockReconcileService,
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
  logInfo: jest.fn(async () => undefined),
}));

jest.mock('../../../config/database', () => ({
  getDatabase: jest.fn(() => ({})),
}));

jest.mock('../../../config/featureFlags', () => ({
  TOTEMDIGITAL_COMPACT: true,
}));

jest.mock('../../../utils/compactOwnerPublisher', () => ({
  resolveCompactOwnerPublisherId: jest.fn(async () => 7),
}));

describe('DELETE /api/subscriber-access/plan-publisher/:planId/:publisherId (compact)', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/subscriber-access')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/subscriber-access', router);
    return app;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const compactOwnerModule = await import('../../../utils/compactOwnerPublisher');
    (compactOwnerModule.resolveCompactOwnerPublisherId as jest.Mock).mockResolvedValue(7);
    mockAccessService.removePlanPublisherAccess.mockResolvedValue(undefined);
    mockReconcileService.reconcilePlan.mockResolvedValue(undefined);
  });

  it('bloqueia remoção quando publisher_id é diferente do owner no compact', async () => {
    const app = await makeApp();

    const res = await request(app)
      .delete('/api/subscriber-access/plan-publisher/10/99')
      .send();

    expect(res.status).toBe(400);
    expect(String(res.body?.error || '')).toContain('Modo compacto');
    expect(mockAccessService.removePlanPublisherAccess).not.toHaveBeenCalled();
  });

  it('permite remoção quando publisher_id é o owner no compact', async () => {
    const app = await makeApp();

    const res = await request(app)
      .delete('/api/subscriber-access/plan-publisher/10/7')
      .send();

    expect(res.status).toBe(200);
    expect(mockAccessService.removePlanPublisherAccess).toHaveBeenCalledWith(10, 7);
    expect(mockReconcileService.reconcilePlan).toHaveBeenCalledWith(10);
  });
});
