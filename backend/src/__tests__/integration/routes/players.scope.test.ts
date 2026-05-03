import express from 'express';
import request from 'supertest';

const mockGetPlayerById = jest.fn();
const mockUpdatePlayer = jest.fn();
const mockDeletePlayer = jest.fn();
const mockAssignPlaylist = jest.fn();
const mockGetPlayerStatus = jest.fn();

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
  return { authMiddleware: authFn };
});

jest.mock('../../../services/playerService', () => ({
  getPlayerService: () => ({
    getPlayerById: (...a: unknown[]) => mockGetPlayerById(...a),
    updatePlayer: (...a: unknown[]) => mockUpdatePlayer(...a),
    deletePlayer: (...a: unknown[]) => mockDeletePlayer(...a),
    assignPlaylist: (...a: unknown[]) => mockAssignPlaylist(...a),
    getPlayerStatus: (...a: unknown[]) => mockGetPlayerStatus(...a),
  }),
}));

jest.mock('../../../utils/totemReadAccess', () => ({
  assertTotemReadAccess: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
}));

import { assertTotemReadAccess } from '../../../utils/totemReadAccess';

const minimalPlayer = { id: 5, name: 'P', totem_id: 5 };

function totem403() {
  const e: any = new Error('Acesso negado');
  e.statusCode = 403;
  return Promise.reject(e);
}

describe('GET /api/players/:id — escopo totem', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/players')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/players', router);
    return app;
  };

  beforeEach(() => {
    (assertTotemReadAccess as jest.Mock).mockClear();
    (assertTotemReadAccess as jest.Mock).mockResolvedValue(undefined);
    mockGetPlayerById.mockReset();
    mockGetPlayerById.mockResolvedValue(minimalPlayer);
  });

  it('permite após assertTotemReadAccess', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/players/5').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
    expect(assertTotemReadAccess).toHaveBeenCalledWith(expect.anything(), 5);
    expect(mockGetPlayerById).toHaveBeenCalledWith(5);
  });

  it('bloqueia quando assertTotemReadAccess nega (403)', async () => {
    (assertTotemReadAccess as jest.Mock).mockImplementationOnce(totem403);
    const app = await makeApp();
    const res = await request(app).get('/api/players/5').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(403);
    expect(mockGetPlayerById).not.toHaveBeenCalled();
  });
});

describe('PUT /api/players/:id — escopo totem', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/players')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/players', router);
    return app;
  };

  beforeEach(() => {
    (assertTotemReadAccess as jest.Mock).mockClear();
    (assertTotemReadAccess as jest.Mock).mockResolvedValue(undefined);
    mockUpdatePlayer.mockReset();
    mockUpdatePlayer.mockResolvedValue(minimalPlayer);
  });

  it('permite após assertTotemReadAccess', async () => {
    const app = await makeApp();
    const res = await request(app)
      .put('/api/players/5')
      .set('Authorization', 'Bearer sub10')
      .send({ name: 'N' });
    expect(res.status).toBe(200);
    expect(mockUpdatePlayer).toHaveBeenCalled();
  });

  it('bloqueia quando assertTotemReadAccess nega', async () => {
    (assertTotemReadAccess as jest.Mock).mockImplementationOnce(totem403);
    const app = await makeApp();
    const res = await request(app).put('/api/players/5').set('Authorization', 'Bearer sub10').send({ name: 'N' });
    expect(res.status).toBe(403);
    expect(mockUpdatePlayer).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/players/:id — escopo totem', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/players')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/players', router);
    return app;
  };

  beforeEach(() => {
    (assertTotemReadAccess as jest.Mock).mockResolvedValue(undefined);
    mockDeletePlayer.mockReset();
    mockDeletePlayer.mockResolvedValue(undefined);
  });

  it('permite após assertTotemReadAccess', async () => {
    const app = await makeApp();
    const res = await request(app).delete('/api/players/5').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(204);
    expect(mockDeletePlayer).toHaveBeenCalledWith(5);
  });

  it('bloqueia quando assertTotemReadAccess nega', async () => {
    (assertTotemReadAccess as jest.Mock).mockImplementationOnce(totem403);
    const app = await makeApp();
    const res = await request(app).delete('/api/players/5').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(403);
    expect(mockDeletePlayer).not.toHaveBeenCalled();
  });
});

describe('POST /api/players/:id/playlist — escopo totem', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/players')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/players', router);
    return app;
  };

  beforeEach(() => {
    (assertTotemReadAccess as jest.Mock).mockResolvedValue(undefined);
    mockAssignPlaylist.mockReset();
    mockAssignPlaylist.mockResolvedValue(undefined);
  });

  it('permite após assertTotemReadAccess', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/players/5/playlist')
      .set('Authorization', 'Bearer sub10')
      .send({ playlistId: 2 });
    expect(res.status).toBe(200);
    expect(mockAssignPlaylist).toHaveBeenCalledWith(5, 2);
  });

  it('bloqueia quando assertTotemReadAccess nega', async () => {
    (assertTotemReadAccess as jest.Mock).mockImplementationOnce(totem403);
    const app = await makeApp();
    const res = await request(app)
      .post('/api/players/5/playlist')
      .set('Authorization', 'Bearer sub10')
      .send({ playlistId: 2 });
    expect(res.status).toBe(403);
    expect(mockAssignPlaylist).not.toHaveBeenCalled();
  });
});

describe('GET /api/players/:id/status — escopo totem', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/players')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/players', router);
    return app;
  };

  beforeEach(() => {
    (assertTotemReadAccess as jest.Mock).mockResolvedValue(undefined);
    mockGetPlayerStatus.mockReset();
    mockGetPlayerStatus.mockResolvedValue({ online: true });
  });

  it('permite após assertTotemReadAccess', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/players/5/status').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
    expect(mockGetPlayerStatus).toHaveBeenCalledWith(5);
  });

  it('bloqueia quando assertTotemReadAccess nega', async () => {
    (assertTotemReadAccess as jest.Mock).mockImplementationOnce(totem403);
    const app = await makeApp();
    const res = await request(app).get('/api/players/5/status').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(403);
    expect(mockGetPlayerStatus).not.toHaveBeenCalled();
  });
});
