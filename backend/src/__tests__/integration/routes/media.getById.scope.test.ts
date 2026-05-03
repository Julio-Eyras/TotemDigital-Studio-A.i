import express from 'express';
import request from 'supertest';

const mockGetSubscriberIdForMedia = jest.fn();
const mockGetMediaById = jest.fn();

jest.mock('../../../middleware/operatorProtection.middleware', () => ({
  blockClientDataAccess: (_req: any, _res: any, next: any) => next(),
}));

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
  return { authMiddleware: authFn, authenticateToken: authFn };
});

jest.mock('../../../services/mediaService', () => ({
  getMediaService: () => ({
    getSubscriberIdForMedia: (...a: unknown[]) => mockGetSubscriberIdForMedia(...a),
    getMediaById: (...a: unknown[]) => mockGetMediaById(...a),
  }),
}));

jest.mock('../../../middleware/validation.middleware', () => ({
  validateRequest: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../validators/common.validators', () => ({
  paginationValidators: [],
  searchValidators: [],
  sortValidators: [],
  dateRangeValidators: [],
  idParamValidatorDefault: [],
}));

jest.mock('../../../validators/media.validators', () => ({
  mediaFilterValidators: [],
  updateMediaValidators: [],
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
  logDebug: jest.fn(async () => undefined),
  logWarnSync: jest.fn(),
  sanitizeForLogging: (x: unknown) => x,
}));

jest.mock('../../../config/mediaConfig', () => ({
  getMediaConfig: () => ({ maxSize: 1e9 }),
  getAllowedMimeTypes: () => ['image/jpeg'],
  getStoragePath: () => '/tmp',
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: () => true,
  mkdirSync: jest.fn(),
  accessSync: jest.fn(),
  constants: { W_OK: 2 },
}));

describe('GET /api/media/:id — escopo', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/media')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/media', router);
    return app;
  };

  beforeEach(() => {
    mockGetSubscriberIdForMedia.mockReset();
    mockGetMediaById.mockReset();
    mockGetSubscriberIdForMedia.mockResolvedValue(10);
    mockGetMediaById.mockResolvedValue({ id: 1, subscriberId: 10, name: 'f' });
  });

  it('permite subscriber_user no assinante da mídia', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/media/1').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
    expect(mockGetMediaById).toHaveBeenCalledWith(1, undefined, true);
  });

  it('bloqueia subscriber_user de outro assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/media/1').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
    expect(mockGetMediaById).not.toHaveBeenCalled();
  });

  it('admin ignora escopo', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/media/1').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
    expect(mockGetMediaById).toHaveBeenCalled();
  });

  it('404 quando mídia não existe', async () => {
    mockGetSubscriberIdForMedia.mockResolvedValue(null);
    const app = await makeApp();
    const res = await request(app).get('/api/media/999').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(404);
  });
});
