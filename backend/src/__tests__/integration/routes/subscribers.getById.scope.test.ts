import express from 'express';
import request from 'supertest';

import * as express from 'express';

const mockGetSubscriberById = jest.fn();
const mockGetSubscriberContracts = jest.fn();

jest.mock('../../../middleware/contractValuesProtection.middleware', () => ({
  protectContractValues: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
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
      req.subscriberId = 10;
    } else if (token === 'sub99') {
      req.user = { id: 2, role: 'subscriber_user', subscriberId: 99, userType: 'subscriber_user' };
      req.subscriberId = 99;
    } else if (token === 'admin') {
      req.user = { id: 3, role: 'admin' };
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
  return { authMiddleware: authFn, authorizeRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next() };
});

jest.mock('../../../validators/common.validators', () => ({
  paginationValidators: [],
  searchValidators: [],
  sortValidators: [],
  dateRangeValidators: [],
  idParamValidatorDefault: [],
  nameValidators: [],
  emailValidators: [],
  phoneValidators: [],
}));

jest.mock('../../../validators/plan.validators', () => ({
  planLimitsValidators: [],
  storageValidators: [],
  totemAccessValidators: [],
}));

jest.mock('../../../services/subscriberService', () => ({
  getSubscriberService: () => ({
    getAllSubscribers: jest.fn(),
    getSubscriberById: (...a: unknown[]) => mockGetSubscriberById(...a),
    getLocalsBySubscriber: jest.fn(),
    getTotemsBySubscriber: jest.fn(),
    getTotemsBySubscriberContract: jest.fn(),
    getSmartTvsBySubscriber: jest.fn(),
    getSubscriberStats: jest.fn(),
    getSubscriberContracts: (...a: unknown[]) => mockGetSubscriberContracts(...a),
    getMaxLimits: jest.fn(),
    getCurrentResourceCount: jest.fn(),
    getCurrentStorage: jest.fn(),
    validateTotemAccess: jest.fn(),
    updateSubscriber: jest.fn(),
    deleteSubscriber: jest.fn(),
    createSubscriber: jest.fn(),
    createSubscriberWithContracts: jest.fn(),
  }),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
}));

const minimalSubscriber = {
  subscriber_id: 10,
  name: 'Sub',
  email: 'a@b.c',
};

describe('GET /api/subscribers/:id — escopo', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/subscribers')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/subscribers', router);
    return app;
  };

  beforeEach(() => {
    mockGetSubscriberById.mockReset();
    mockGetSubscriberById.mockResolvedValue(minimalSubscriber);
  });

  it('permite subscriber_user no próprio assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/subscribers/10').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
    expect(mockGetSubscriberById).toHaveBeenCalledWith(10);
  });

  it('bloqueia subscriber_user de outro assinante (IDOR)', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/subscribers/10').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
    expect(mockGetSubscriberById).not.toHaveBeenCalled();
  });

  it('admin pode ler', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/subscribers/10').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
    expect(mockGetSubscriberById).toHaveBeenCalledWith(10);
  });
});

describe('GET /api/subscribers/:id/contracts — escopo', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/subscribers')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/subscribers', router);
    return app;
  };

  beforeEach(() => {
    mockGetSubscriberContracts.mockReset();
    mockGetSubscriberContracts.mockResolvedValue([]);
  });

  it('permite subscriber_user nos próprios contratos', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/subscribers/10/contracts').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
    expect(mockGetSubscriberContracts).toHaveBeenCalledWith(10, true);
  });

  it('bloqueia outro assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/subscribers/10/contracts').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
    expect(mockGetSubscriberContracts).not.toHaveBeenCalled();
  });
});
