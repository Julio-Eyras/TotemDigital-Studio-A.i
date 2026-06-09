import express from 'express';
import request from 'supertest';

const mockGetLayout = jest.fn();
const mockSaveLayout = jest.fn();
const mockRenderToMedia = jest.fn();
const mockPreviewHtml = jest.fn();
const mockRenderToMediaHtml = jest.fn();
const mockSuggestCopy = jest.fn();
const mockCheckAIStatus = jest.fn();

jest.mock('../../../middleware/auth.middleware', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
  authorizeRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../middleware/operatorProtection.middleware', () => ({
  blockClientDataAccess: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../middleware/subscriberParamAccess.middleware', () => ({
  assertSubscriberParamAccess: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../services/publishBoardService', () => ({
  getPublishBoardService: () => ({
    getLayout: (...args: unknown[]) => mockGetLayout(...args),
    saveLayout: (...args: unknown[]) => mockSaveLayout(...args),
    renderToMedia: (...args: unknown[]) => mockRenderToMedia(...args),
    previewHtml: (...args: unknown[]) => mockPreviewHtml(...args),
    renderToMediaHtml: (...args: unknown[]) => mockRenderToMediaHtml(...args),
  }),
}));

jest.mock('../../../services/publishBriefAiService', () => ({
  getPublishBriefAiService: () => ({
    suggestCopy: (...args: unknown[]) => mockSuggestCopy(...args),
  }),
}));

jest.mock('../../../utils/globalInstances', () => ({
  getAIServiceInstance: () => ({
    checkAIStatus: (...args: unknown[]) => mockCheckAIStatus(...args),
  }),
}));

const mockAutoPublishRun = jest.fn();

jest.mock('../../../services/autoPublishOrchestratorService', () => ({
  getAutoPublishOrchestratorService: () => ({
    run: (...args: unknown[]) => mockAutoPublishRun(...args),
  }),
}));

import publishBoardRoutes from '../../../routes/publish-board';

describe('publish-board routes', () => {
  let app: express.Application;
  const subscriberId = 1;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/subscribers/:subscriberId/publish-board', publishBoardRoutes);
  });

  beforeEach(() => {
    mockGetLayout.mockImplementation(async (_sid: number, preset: string) => ({
      subscriberId: 1,
      preset,
      boardTitle: 'Promoção do dia',
      accentColor: '#e91e63',
      preferredOrientation: 'landscape',
      content: { headline: 'Oferta', offer: 'Combo', price: 'R$ 19,90', urgency: 'Hoje' },
      blockOrder: ['headline', 'offer', 'price', 'urgency'],
      productOrder: [],
      showPrices: true,
    }));
    mockSaveLayout.mockImplementation(async (layout: unknown) => layout);
    mockRenderToMedia.mockResolvedValue({ mediaId: 42, name: 'Promoção do dia — Promoção' });
    mockPreviewHtml.mockResolvedValue('<!DOCTYPE html><html><body>preview</body></html>');
    mockRenderToMediaHtml.mockResolvedValue({ mediaId: 99, name: 'Promo — HTML', mediaType: 'html' });
    mockSuggestCopy.mockResolvedValue({ content: { headline: 'Nova chamada' }, summary: 'Tom urgente' });
    mockCheckAIStatus.mockResolvedValue({
      enabled: true,
      provider: 'ollama',
      status: 'online',
      message: 'OK',
    });
  });

  describe('GET /:preset/layout', () => {
    it('retorna layout padrão do preset', async () => {
      const res = await request(app).get(
        `/api/subscribers/${subscriberId}/publish-board/promotion/layout`
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.preset).toBe('promotion');
      expect(mockGetLayout).toHaveBeenCalledWith(subscriberId, 'promotion');
    });

    it('rejeita preset inválido', async () => {
      const res = await request(app).get(
        `/api/subscribers/${subscriberId}/publish-board/invalid/layout`
      );
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /:preset/layout', () => {
    it('salva layout do quadro', async () => {
      const res = await request(app)
        .put(`/api/subscribers/${subscriberId}/publish-board/ad/layout`)
        .send({
          boardTitle: 'Anúncio indoor',
          content: { headline: 'Impacto', brand: 'Marca X' },
          blockOrder: ['headline', 'brand'],
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSaveLayout).toHaveBeenCalled();
      const saved = mockSaveLayout.mock.calls[0][0] as { preset: string; boardTitle: string };
      expect(saved.preset).toBe('ad');
      expect(saved.boardTitle).toBe('Anúncio indoor');
    });
  });

  describe('GET /ai-assist-status', () => {
    it('retorna disponibilidade do assistente de textos', async () => {
      const res = await request(app).get(
        `/api/subscribers/${subscriberId}/publish-board/ai-assist-status`
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.available).toBe(true);
      expect(mockCheckAIStatus).toHaveBeenCalled();
    });
  });

  describe('POST /:preset/preview-html', () => {
    it('retorna HTML de pré-visualização', async () => {
      const res = await request(app)
        .post(`/api/subscribers/${subscriberId}/publish-board/promotion/preview-html`)
        .send({ boardTitle: 'Promo' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.html).toContain('preview');
      expect(mockSaveLayout).toHaveBeenCalled();
      expect(mockPreviewHtml).toHaveBeenCalledWith(subscriberId, 'promotion');
    });
  });

  describe('POST /:preset/render-html', () => {
    it('gera mídia HTML animada', async () => {
      const res = await request(app).post(
        `/api/subscribers/${subscriberId}/publish-board/ad/render-html`
      );
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mediaId).toBe(99);
      expect(res.body.data.mediaType).toBe('html');
    });
  });

  describe('POST /:preset/suggest-copy', () => {
    it('sugere textos via IA', async () => {
      const res = await request(app)
        .post(`/api/subscribers/${subscriberId}/publish-board/promotion/suggest-copy`)
        .send({ segment: 'retail', content: { headline: 'Oferta' } });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content.headline).toBe('Nova chamada');
      expect(mockSuggestCopy).toHaveBeenCalled();
    });
  });

  describe('POST /:preset/auto-publish', () => {
    beforeEach(() => {
      mockAutoPublishRun.mockResolvedValue({
        mediaId: 77,
        mediaName: 'Promo — HTML',
        mediaType: 'html',
        aiApplied: false,
        publish: { success: true, message: 'Publicado' },
        message: 'Propaganda gerada e publicada. Publicado',
      });
    });

    it('orquestra gerar HTML e publicar', async () => {
      const res = await request(app)
        .post(`/api/subscribers/${subscriberId}/publish-board/promotion/auto-publish`)
        .send({
          contractId: 1,
          totemIds: [3],
          title: 'Promo auto',
          content: { headline: 'Oferta' },
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mediaId).toBe(77);
      expect(mockAutoPublishRun).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriberId: 1,
          contractId: 1,
          totemIds: [3],
          preset: 'promotion',
        })
      );
    });

    it('rejeita sem contrato', async () => {
      const res = await request(app)
        .post(`/api/subscribers/${subscriberId}/publish-board/promotion/auto-publish`)
        .send({ totemIds: [3] });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /:preset/render', () => {
    it('gera mídia e retorna mediaId', async () => {
      const res = await request(app).post(
        `/api/subscribers/${subscriberId}/publish-board/institutional/render`
      );
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mediaId).toBe(42);
      expect(mockRenderToMedia).toHaveBeenCalledWith(subscriberId, 'institutional', 1, true);
    });

    it('propaga erro de validação do serviço', async () => {
      mockRenderToMedia.mockRejectedValueOnce(
        new Error('Preencha ao menos um campo de texto do template antes de gerar a mídia')
      );
      const res = await request(app).post(
        `/api/subscribers/${subscriberId}/publish-board/announcement/render`
      );
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Preencha ao menos um campo/);
    });
  });
});
