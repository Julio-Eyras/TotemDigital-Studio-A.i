import express from 'express';
import request from 'supertest';

import * as express from 'express';

const mockGetSubscriberIdForPlaylist = jest.fn();
const mockGetPlaylistById = jest.fn();
const mockGetPlaylistMedia = jest.fn();
const mockGetCampaignsByPlaylist = jest.fn();
const mockGetExposureByPlaylist = jest.fn();

jest.mock('../../../middleware/operatorProtection.middleware', () => ({
  blockClientDataAccess: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../../middleware/subscriberIsolation.middleware', () => ({
  subscriberIsolationMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
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
    } else if (token === 'sub99') {
      req.user = { id: 2, role: 'subscriber_user', subscriberId: 99, userType: 'subscriber_user' };
    } else if (token === 'admin') {
      req.user = { id: 3, role: 'admin_sql' };
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
  return {
    authMiddleware: authFn,
    authenticateToken: authFn,
    authorizeRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  };
});

jest.mock('../../../services/playlistService', () => ({
  getPlaylistService: () => ({
    getSubscriberIdForPlaylist: (...a: unknown[]) => mockGetSubscriberIdForPlaylist(...a),
    getPlaylistById: (...a: unknown[]) => mockGetPlaylistById(...a),
    getPlaylistMedia: (...a: unknown[]) => mockGetPlaylistMedia(...a),
    getCampaignsByPlaylist: (...a: unknown[]) => mockGetCampaignsByPlaylist(...a),
    getExposureByPlaylist: (...a: unknown[]) => mockGetExposureByPlaylist(...a),
  }),
}));

jest.mock('../../../validators/common.validators', () => ({
  paginationValidators: [],
  searchValidators: [],
  sortValidators: [],
  dateRangeValidators: [],
  idParamValidatorDefault: [],
}));

jest.mock('../../../validators/playlist.validators', () => ({
  createPlaylistValidators: [],
  updatePlaylistValidators: [],
  addMediaToPlaylistValidators: [],
  updatePlaylistItemDurationValidators: [],
  reorderPlaylistItemsValidators: [],
  playlistFilterValidators: [],
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
}));

describe('GET /api/playlists/:id — escopo', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/playlists')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/playlists', router);
    return app;
  };

  beforeEach(() => {
    mockGetSubscriberIdForPlaylist.mockReset();
    mockGetPlaylistById.mockReset();
    mockGetSubscriberIdForPlaylist.mockResolvedValue(10);
    mockGetPlaylistById.mockResolvedValue({
      playlist_id: 1,
      name: 'P',
      subscriber_id: 10,
    });
  });

  it('permite subscriber_user no assinante da playlist', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/playlists/1').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
    expect(mockGetPlaylistById).toHaveBeenCalledWith(1, undefined, true);
  });

  it('bloqueia subscriber_user de outro assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/playlists/1').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
    expect(mockGetPlaylistById).not.toHaveBeenCalled();
  });

  it('admin_sql pode ler qualquer playlist', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/playlists/1').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/playlists/:id/preview — escopo', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/playlists')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/playlists', router);
    return app;
  };

  beforeEach(() => {
    mockGetSubscriberIdForPlaylist.mockReset();
    mockGetPlaylistById.mockReset();
    mockGetPlaylistMedia.mockReset();
    mockGetSubscriberIdForPlaylist.mockResolvedValue(10);
    mockGetPlaylistById.mockResolvedValue({
      playlist_id: 1,
      name: 'P',
      subscriber_id: 10,
    });
    mockGetPlaylistMedia.mockResolvedValue([]);
  });

  it('bloqueia preview para outro assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/playlists/5/preview').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
    expect(mockGetPlaylistMedia).not.toHaveBeenCalled();
  });

  it('permite preview no próprio assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/playlists/5/preview').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
    expect(mockGetPlaylistMedia).toHaveBeenCalledWith(5);
  });
});

describe('GET /api/playlists/:id/campaigns — escopo', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/playlists')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/playlists', router);
    return app;
  };

  beforeEach(() => {
    mockGetSubscriberIdForPlaylist.mockReset();
    mockGetCampaignsByPlaylist.mockReset();
    mockGetSubscriberIdForPlaylist.mockResolvedValue(10);
    mockGetCampaignsByPlaylist.mockResolvedValue([]);
  });

  it('bloqueia outro assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/playlists/7/campaigns').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
    expect(mockGetCampaignsByPlaylist).not.toHaveBeenCalled();
  });

  it('permite no próprio assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/playlists/7/campaigns').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
    expect(mockGetCampaignsByPlaylist).toHaveBeenCalledWith(7, undefined, true);
  });
});

describe('GET /api/playlists/:id/exposure — escopo', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/playlists')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/playlists', router);
    return app;
  };

  beforeEach(() => {
    mockGetSubscriberIdForPlaylist.mockReset();
    mockGetExposureByPlaylist.mockReset();
    mockGetSubscriberIdForPlaylist.mockResolvedValue(10);
    mockGetExposureByPlaylist.mockResolvedValue({ rows: [], campaigns: [], publishers: [], totems: [], smartTvs: [], playlistItemSchedules: [] });
  });

  it('bloqueia outro assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/playlists/8/exposure').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
    expect(mockGetExposureByPlaylist).not.toHaveBeenCalled();
  });

  it('permite no próprio assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/playlists/8/exposure').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
    expect(mockGetExposureByPlaylist).toHaveBeenCalledWith(8, undefined, true);
  });
});

describe('GET /api/playlists/:id/media — escopo', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/playlists')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/playlists', router);
    return app;
  };

  beforeEach(() => {
    mockGetSubscriberIdForPlaylist.mockReset();
    mockGetPlaylistMedia.mockReset();
    mockGetSubscriberIdForPlaylist.mockResolvedValue(10);
    mockGetPlaylistMedia.mockResolvedValue([]);
  });

  it('bloqueia outro assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/playlists/9/media').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
    expect(mockGetPlaylistMedia).not.toHaveBeenCalled();
  });

  it('permite no próprio assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/playlists/9/media').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
    expect(mockGetPlaylistMedia).toHaveBeenCalledWith(9);
  });
});
