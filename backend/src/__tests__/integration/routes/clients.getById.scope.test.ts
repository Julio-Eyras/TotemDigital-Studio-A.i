import express from 'express';
import request from 'supertest';

import * as express from 'express';

const mockGetClientById = jest.fn();
const mockUpdateClient = jest.fn();
const mockDeleteClient = jest.fn();

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
      req.user = { id: 3, role: 'admin' };
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
  return { authMiddleware: authFn };
});

jest.mock('../../../services/clientService', () => ({
  getClientService: () => ({
    getClientById: (...a: unknown[]) => mockGetClientById(...a),
    updateClient: (...a: unknown[]) => mockUpdateClient(...a),
    deleteClient: (...a: unknown[]) => mockDeleteClient(...a),
  }),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
}));

const minimalClient = {
  client_id: 10,
  subscriber_id: 10,
  name: 'Cliente',
  email: null,
  phone: null,
  address: null,
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('GET /api/clients/:id — escopo', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/clients')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/clients', router);
    return app;
  };

  beforeEach(() => {
    mockGetClientById.mockReset();
    mockGetClientById.mockResolvedValue(minimalClient);
  });

  it('permite subscriber_user no próprio subscriber_id', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/clients/10').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
    expect(mockGetClientById).toHaveBeenCalledWith(10);
  });

  it('bloqueia subscriber_user de outro assinante (IDOR)', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/clients/10').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
    expect(mockGetClientById).not.toHaveBeenCalled();
  });

  it('admin pode ler', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/clients/10').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
    expect(mockGetClientById).toHaveBeenCalledWith(10);
  });
});

describe('PUT /api/clients/:id — escopo', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/clients')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/clients', router);
    return app;
  };

  beforeEach(() => {
    mockUpdateClient.mockReset();
    mockUpdateClient.mockResolvedValue({ ...minimalClient, name: 'Atualizado' });
  });

  it('permite atualizar no próprio subscriber_id', async () => {
    const app = await makeApp();
    const res = await request(app)
      .put('/api/clients/10')
      .set('Authorization', 'Bearer sub10')
      .send({ name: 'Atualizado' });
    expect(res.status).toBe(200);
    expect(mockUpdateClient).toHaveBeenCalled();
  });

  it('bloqueia outro assinante antes de atualizar', async () => {
    const app = await makeApp();
    const res = await request(app)
      .put('/api/clients/10')
      .set('Authorization', 'Bearer sub99')
      .send({ name: 'X' });
    expect(res.status).toBe(403);
    expect(mockUpdateClient).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/clients/:id — escopo', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/clients')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/clients', router);
    return app;
  };

  beforeEach(() => {
    mockDeleteClient.mockReset();
    mockDeleteClient.mockResolvedValue(undefined);
  });

  it('permite eliminar no próprio subscriber_id', async () => {
    const app = await makeApp();
    const res = await request(app).delete('/api/clients/10').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(204);
    expect(mockDeleteClient).toHaveBeenCalledWith(10);
  });

  it('bloqueia outro assinante antes de eliminar', async () => {
    const app = await makeApp();
    const res = await request(app).delete('/api/clients/10').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
    expect(mockDeleteClient).not.toHaveBeenCalled();
  });
});
