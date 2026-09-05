import express from 'express';
import request from 'supertest';

import * as express from 'express';

const mockCapabilities = {
  profile: 'single_publisher' as const,
  totemDigitalCompact: true,
  multiAgency: false,
  publisherBillingForAdmins: true,
  stripeSubscriptions: false,
  playlistMixWorker: true,
  playlistEngineWorker: true,
  alertCron: true,
  bullExportQueues: false,
  subdomainTenancy: false,
  subscriberPortal: true,
  smartDisplayFx: false,
  simpleTotemMode: true,
};

const mockResolveInstallationCapabilities = jest.fn().mockResolvedValue(mockCapabilities);

jest.mock('../../../middleware/auth.middleware', () => ({
  authMiddleware: (_req: express.Request, res: express.Response) =>
    res.status(401).json({ error: 'Unauthorized' }),
}));

jest.mock('../../../config/database-pg', () => ({
  createDatabaseWrapper: jest.fn(() => ({
    findFirst: jest.fn().mockResolvedValue(null),
  })),
}));

jest.mock('../../../services/installationProfileService', () => ({
  resolveInstallationCapabilities: (...args: unknown[]) =>
    mockResolveInstallationCapabilities(...args),
  resetInstallationProfileCache: jest.fn(),
}));

describe('GET /api/dashboard/ui-context (público)', () => {
  beforeEach(() => {
    mockResolveInstallationCapabilities.mockClear();
    mockResolveInstallationCapabilities.mockResolvedValue(mockCapabilities);
    jest.resetModules();
  });

  it('responde 200 sem Authorization (router isolado)', async () => {
    const router = (await import('../../../routes/dashboard')).default;
    const app = express();
    app.use('/api/dashboard', router);

    const res = await request(app).get('/api/dashboard/ui-context');
    expect(res.status).toBe(200);
    expect(res.body.capabilities).toBeDefined();
    expect(mockResolveInstallationCapabilities).toHaveBeenCalled();
    expect(res.body.totemDigitalCompact).toBe(true);
    expect(res.body.installationProfile).toBe('single_publisher');
  });

  it('stats continua exigindo autenticação', async () => {
    const router = (await import('../../../routes/dashboard')).default;
    const app = express();
    app.use('/api/dashboard', router);

    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });
});
