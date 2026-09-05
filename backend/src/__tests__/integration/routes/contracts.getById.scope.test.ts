import express from 'express';
import request from 'supertest';

import * as express from 'express';

const mockGetContractById = jest.fn();
const mockGetSubscriberIdForContract = jest.fn();
const mockGetContractPublishers = jest.fn();
const mockPublisherGetContractById = jest.fn();

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
    } else if (token === 'sub99') {
      req.user = { id: 2, role: 'subscriber_user', subscriberId: 99, userType: 'subscriber_user' };
    } else if (token === 'admin') {
      req.user = { id: 3, role: 'admin_sql' };
    } else if (token === 'pub10') {
      req.user = { id: 4, role: 'publisher_user', publisherId: 10 };
    } else if (token === 'pub99') {
      req.user = { id: 5, role: 'publisher_user', publisherId: 99 };
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

jest.mock('../../../services/contractService', () => ({
  getContractService: () => ({
    getContractById: (...a: unknown[]) => mockGetContractById(...a),
    getSubscriberIdForContract: (...a: unknown[]) => mockGetSubscriberIdForContract(...a),
    getContractPublishers: (...a: unknown[]) => mockGetContractPublishers(...a),
  }),
}));

jest.mock('../../../services/publisherContractService', () => ({
  getPublisherContractService: () => ({
    getAllContracts: jest.fn(),
    getContractById: (...a: unknown[]) => mockPublisherGetContractById(...a),
    createContract: jest.fn(),
    updateContract: jest.fn(),
    deleteContract: jest.fn(),
  }),
}));

jest.mock('../../../validators/common.validators', () => ({
  paginationValidators: [],
  searchValidators: [],
  idParamValidatorDefault: [],
}));

jest.mock('../../../validators/contract.validators', () => ({
  createSubscriberContractValidators: [],
  updateSubscriberContractValidators: [],
  createPublisherContractValidators: [],
  updatePublisherContractValidators: [],
  contractFilterValidators: [],
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
}));

describe('GET /api/contracts/:id — escopo', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/contracts')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/contracts', router);
    return app;
  };

  beforeEach(() => {
    mockGetContractById.mockReset();
    mockGetContractById.mockResolvedValue({
      contract_id: 1,
      subscriber_id: 10,
      title: 'C',
    });
  });

  it('permite subscriber_user no assinante do contrato', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/contracts/1').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
    expect(mockGetContractById).toHaveBeenCalledWith(1);
  });

  it('bloqueia subscriber_user de outro assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/contracts/1').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
  });

  it('admin_sql pode ler qualquer contrato', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/contracts/1').set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/contracts/:id/publishers — escopo', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/contracts')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/contracts', router);
    return app;
  };

  beforeEach(() => {
    mockGetSubscriberIdForContract.mockReset();
    mockGetContractPublishers.mockReset();
    mockGetSubscriberIdForContract.mockResolvedValue(10);
    mockGetContractPublishers.mockResolvedValue([]);
  });

  it('bloqueia outro assinante antes de listar publishers', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/contracts/5/publishers').set('Authorization', 'Bearer sub99');
    expect(res.status).toBe(403);
    expect(mockGetContractPublishers).not.toHaveBeenCalled();
  });

  it('permite no próprio assinante', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/contracts/5/publishers').set('Authorization', 'Bearer sub10');
    expect(res.status).toBe(200);
    expect(mockGetContractPublishers).toHaveBeenCalledWith(5);
  });
});

describe('GET /api/contracts/publisher-contracts/:id — escopo', () => {
  const makeApp = async () => {
    const router = (await import('../../../routes/contracts')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/contracts', router);
    return app;
  };

  beforeEach(() => {
    mockPublisherGetContractById.mockReset();
    mockPublisherGetContractById.mockResolvedValue({
      contract_id: 1,
      publisher_id: 10,
      title: 'PC',
    });
  });

  it('permite publisher no próprio publisher_id', async () => {
    const app = await makeApp();
    const res = await request(app)
      .get('/api/contracts/publisher-contracts/1')
      .set('Authorization', 'Bearer pub10');
    expect(res.status).toBe(200);
    expect(mockPublisherGetContractById).toHaveBeenCalledWith(1);
  });

  it('bloqueia publisher de outro publisher_id', async () => {
    const app = await makeApp();
    const res = await request(app)
      .get('/api/contracts/publisher-contracts/1')
      .set('Authorization', 'Bearer pub99');
    expect(res.status).toBe(403);
  });

  it('admin_sql pode ler qualquer publisher contract', async () => {
    const app = await makeApp();
    const res = await request(app)
      .get('/api/contracts/publisher-contracts/1')
      .set('Authorization', 'Bearer admin');
    expect(res.status).toBe(200);
  });
});
