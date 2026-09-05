import express from 'express';
import request from 'supertest';

import * as express from 'express';

const mockDispatch = jest.fn();
const mockIsSimpleMode = jest.fn();

jest.mock('../../../middleware/auth.middleware', () => ({
  authMiddleware: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const h = String(req.headers.authorization || '');
    if (!h.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = h.slice(7);
    if (token === 'sub10') {
      req.user = { id: 1, role: 'subscriber_user', subscriberId: 10 };
    } else if (token === 'admin') {
      req.user = { id: 2, role: 'admin' };
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  },
  authorizeRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../../services/dispatcherTotemService', () => ({
  getDispatcherTotemService: () => ({
    dispatch: (...args: unknown[]) => mockDispatch(...args),
  }),
}));

jest.mock('../../../services/totemSimpleModeService', () => ({
  isTotemSimpleModeEnabled: (...args: unknown[]) => mockIsSimpleMode(...args),
}));

jest.mock('../../../validators/common.validators', () => ({
  idParamValidator: () => [],
}));

jest.mock('../../../config/installationRuntime', () => ({
  isStudioRuntime: () => true,
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
}));

describe('GET /api/dispatcher-totem/:totemId/dispatch — escopo', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/dispatcher-totem')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/dispatcher-totem', router);
    return app;
  };

  beforeEach(() => {
    mockDispatch.mockReset();
    mockIsSimpleMode.mockReset();
    mockDispatch.mockResolvedValue({
      success: true,
      plan: { metadata: { simpleMode: true } },
      fromCache: false,
      executionTimeMs: 1,
    });
    mockIsSimpleMode.mockResolvedValue(true);
  });

  it('subscriber sem acesso ao totem recebe 403', async () => {
    jest.doMock('../../../config/database', () => ({
      getDatabase: () => ({
        findFirst: jest.fn().mockResolvedValue(null),
      }),
    }));
    jest.doMock('../../../services/subscriberService', () => ({
      getSubscriberService: () => ({
        validateTotemAccess: jest.fn().mockResolvedValue(false),
      }),
    }));

    const { assertDispatcherTotemScope } = await import(
      '../../../middleware/dispatcherTotemScope.middleware'
    );
    const req: Partial<express.Request> & Record<string, unknown> = {
      params: { totemId: '99' },
      user: { role: 'subscriber_user', subscriberId: 10 },
    };
    const res: Partial<express.Response> & Record<string, unknown> = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: unknown) {
        this.body = body;
      },
    };
    const next = jest.fn();
    await assertDispatcherTotemScope(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('admin passa escopo e recebe simpleMode no JSON', async () => {
    const app = await makeApp();
    const res = await request(app)
      .get('/api/dispatcher-totem/5/dispatch')
      .set('Authorization', 'Bearer admin');

    expect(res.status).toBe(200);
    expect(res.body.simpleMode).toBe(true);
    expect(res.body.planSimpleMode).toBe(true);
  });
});
