import express from 'express';
import request from 'supertest';

import * as express from 'express';

const mockIssueContractInvoices = jest.fn();

jest.mock('../../../middleware/auth.middleware', () => {
  const authFn = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const h = String(req.headers.authorization || '');
    if (!h.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = h.slice(7);
    if (token === 'admin') {
      req.user = { id: 1, role: 'admin', publisherId: 1, userType: 'system_user' };
    } else if (token === 'subscriber') {
      req.user = { id: 2, role: 'subscriber_user', publisherId: null, userType: 'subscriber_user' };
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
  const authorizeRole =
    (roles: string[]) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      next();
    };
  return { authMiddleware: authFn, authorizeRole, AuthenticatedRequest: {} };
});

jest.mock('../../../services/financialAdminService', () => ({
  getFinancialAdminService: () => ({
    issueContractInvoices: mockIssueContractInvoices,
  }),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
}));

describe('POST /api/financial-admin/issue-invoices', () => {
  beforeEach(async () => {
    mockIssueContractInvoices.mockReset();
    mockIssueContractInvoices.mockResolvedValue({
      created: 0,
      skipped: 0,
      errors: [],
      invoices: [],
    });
    jest.resetModules();
  });

  const buildApp = async () => {
    const router = (await import('../../../routes/financial-admin')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/financial-admin', router);
    return app;
  };

  it('repassa publisherId e publisherContractId ao serviço', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/api/financial-admin/issue-invoices')
      .set('Authorization', 'Bearer admin')
      .send({ publisherId: 3, publisherContractId: 12, dueInDays: 15 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockIssueContractInvoices).toHaveBeenCalledWith(
      expect.objectContaining({
        publisherId: 3,
        publisherContractId: 12,
        dueInDays: 15,
        includeRevenueSharePayouts: false,
      })
    );
  });

  it('rejeita publisherId inválido', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/api/financial-admin/issue-invoices')
      .set('Authorization', 'Bearer admin')
      .send({ publisherId: 'x' });

    expect(res.status).toBe(400);
    expect(mockIssueContractInvoices).not.toHaveBeenCalled();
  });

  it('nega emissão para role sem permissão financeira', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/api/financial-admin/issue-invoices')
      .set('Authorization', 'Bearer subscriber')
      .send({});

    expect(res.status).toBe(403);
    expect(mockIssueContractInvoices).not.toHaveBeenCalled();
  });
});
