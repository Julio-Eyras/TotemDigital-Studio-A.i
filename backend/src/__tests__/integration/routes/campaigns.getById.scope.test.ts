import express from 'express';
import request from 'supertest';

import * as express from 'express';

const mockGetCampaignById = jest.fn();

jest.mock('../../../middleware/operatorProtection.middleware', () => ({
  blockClientDataAccess: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../../middleware/subscriberIsolation.middleware', () => ({
  subscriberIsolationMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../../middleware/auth.middleware', () => ({
  authenticateToken: (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
  },
  authorizeRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../../services/campaignService', () => ({
  getCampaignService: () => ({
    getCampaignById: (...args: unknown[]) => mockGetCampaignById(...args),
  }),
}));

jest.mock('../../../middleware/validation.middleware', () => ({
  validateRequest: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../../validators/common.validators', () => ({
  paginationValidators: [],
  searchValidators: [],
  sortValidators: [],
  dateRangeValidators: [],
  idParamValidatorDefault: [],
}));

jest.mock('../../../validators/campaign.validators', () => ({
  createCampaignValidators: [],
  updateCampaignValidators: [],
  campaignFilterValidators: [],
  reorderCampaignMediasValidators: [],
  reorderCampaignPlaylistsValidators: [],
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
  logInfo: jest.fn(async () => undefined),
  logDebug: jest.fn(async () => undefined),
  sanitizeForLogging: (x: unknown) => x,
}));

describe('GET /api/campaigns/:id — escopo subscriber', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/campaigns')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/campaigns', router);
    return app;
  };

  beforeEach(() => {
    mockGetCampaignById.mockReset();
    mockGetCampaignById.mockResolvedValue({
      campaign_id: 1,
      title: 'Teste',
      subscriber_id: 10,
      subscriberId: 10,
    });
  });

  it('permite subscriber_user no próprio assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/campaigns/1').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.subscriberId ?? res.body?.data?.subscriber_id).toBe(10);
  });

  it('bloqueia subscriber_user de outro assinante (IDOR)', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/campaigns/1').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
  });

  it('admin pode ler campanha de qualquer assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/campaigns/1').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('404 quando campanha não existe', async () => {
    mockGetCampaignById.mockResolvedValue(null);
    const app = await makeApp();
    const res = await request(app).get('/api/campaigns/999').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(404);
  });
});
