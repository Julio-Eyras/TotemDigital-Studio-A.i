import express from 'express';
import request from 'supertest';

jest.mock('../../../middleware/auth.middleware', () => ({
  authMiddleware: (_req: any, res: any) =>
    res.status(401).json({ error: 'Unauthorized' }),
}));

jest.mock('../../../services/installationProfileService', () => ({
  resolveInstallationCapabilities: jest.fn().mockResolvedValue({
    profile: 'single_publisher',
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
  }),
}));

describe('GET /api/dashboard/ui-context (público)', () => {
  it('responde 200 sem Authorization (router isolado)', async () => {
    const router = (await import('../../../routes/dashboard')).default;
    const app = express();
    app.use('/api/dashboard', router);

    const res = await request(app).get('/api/dashboard/ui-context');
    expect(res.status).toBe(200);
    expect(res.body.capabilities).toBeDefined();
    expect(res.body.totemDigitalCompact).toBe(true);
  });

  it('stats continua exigindo autenticação', async () => {
    const router = (await import('../../../routes/dashboard')).default;
    const app = express();
    app.use('/api/dashboard', router);

    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });
});
