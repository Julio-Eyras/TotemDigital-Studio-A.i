import request from 'supertest';
import express from 'express';

import * as express from 'express';

jest.mock('../../../middleware/auth.middleware', () => ({
  authenticateToken: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
  authorizeRole: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

jest.mock('../../../services/publishTemplateService', () => ({
  getPublishTemplateService: () => ({
    listFeatured: jest.fn().mockResolvedValue([
      {
        templateId: 1,
        preset: 'menu',
        segment: 'restaurant',
        title: 'Cardápio digital',
        description: 'Test',
        headline: 'Headline',
        featured: true,
        featuredSort: 10,
        recommendedDurationMs: 12000,
        accentColor: '#ff9800',
        backgroundCss: 'linear-gradient(...)',
        preferredOrientation: 'portrait',
        iconKey: 'storefront',
      },
    ]),
    updateTemplate: jest.fn().mockResolvedValue({
      templateId: 1,
      preset: 'menu',
      title: 'Atualizado',
      featured: true,
      featuredSort: 5,
      recommendedDurationMs: 12000,
      preferredOrientation: 'portrait',
      iconKey: 'storefront',
    }),
  }),
}));

describe('GET /api/publish-templates/featured', () => {
  let app: express.Application;

  beforeAll(async () => {
    const router = (await import('../../../routes/publish-templates')).default;
    app = express();
    app.use(express.json());
    app.use('/api/publish-templates', router);
  });

  it('retorna templates em destaque', async () => {
    const res = await request(app).get('/api/publish-templates/featured');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].preset).toBe('menu');
  });
});

describe('PATCH /api/publish-templates/:id', () => {
  let app: express.Application;

  beforeAll(async () => {
    const router = (await import('../../../routes/publish-templates')).default;
    app = express();
    app.use(express.json());
    app.use('/api/publish-templates', router);
  });

  it('atualiza template', async () => {
    const res = await request(app)
      .patch('/api/publish-templates/1')
      .send({ title: 'Atualizado', featuredSort: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Atualizado');
  });
});
