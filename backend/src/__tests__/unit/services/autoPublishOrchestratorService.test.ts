import { AutoPublishOrchestratorService } from '../../../services/autoPublishOrchestratorService';

const mockGetLayout = jest.fn();
const mockSaveLayout = jest.fn();
const mockRenderToMediaHtml = jest.fn();
const mockSuggestCopy = jest.fn();
const mockPublish = jest.fn();
const mockHasAiText = jest.fn();

jest.mock('../../../services/publishBoardService', () => ({
  getPublishBoardService: () => ({
    getLayout: (...args: unknown[]) => mockGetLayout(...args),
    saveLayout: (...args: unknown[]) => mockSaveLayout(...args),
    renderToMediaHtml: (...args: unknown[]) => mockRenderToMediaHtml(...args),
  }),
}));

jest.mock('../../../services/publishBriefAiService', () => ({
  getPublishBriefAiService: () => ({
    suggestCopy: (...args: unknown[]) => mockSuggestCopy(...args),
  }),
}));

jest.mock('../../../services/quickPublishService', () => ({
  getQuickPublishService: () => ({
    publish: (...args: unknown[]) => mockPublish(...args),
  }),
}));

jest.mock('../../../utils/publishPlanFeatures', () => ({
  subscriberHasAiTextAssist: (...args: unknown[]) => mockHasAiText(...args),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn().mockResolvedValue(undefined),
}));

describe('AutoPublishOrchestratorService', () => {
  const service = new AutoPublishOrchestratorService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLayout.mockResolvedValue({
      subscriberId: 1,
      preset: 'promotion',
      boardTitle: 'Promoção',
      accentColor: '#e91e63',
      preferredOrientation: 'landscape',
      content: { headline: 'Oferta' },
      blockOrder: ['headline'],
      productOrder: [],
      showPrices: true,
    });
    mockSaveLayout.mockImplementation(async (l: unknown) => l);
    mockRenderToMediaHtml.mockResolvedValue({ mediaId: 88, name: 'Promo HTML', mediaType: 'html' });
    mockPublish.mockResolvedValue({
      success: true,
      playlistId: 10,
      campaignId: 20,
      publishedTotemIds: [5],
      regeneratedTotemIds: [5],
      message: 'Publicado',
    });
    mockHasAiText.mockResolvedValue(true);
    mockSuggestCopy.mockResolvedValue({ content: { headline: 'IA headline' } });
  });

  it('executa render + publish sem IA por padrão', async () => {
    const result = await service.run({
      subscriberId: 1,
      contractId: 2,
      totemIds: [5],
      preset: 'promotion',
      userId: 1,
      isAdmin: true,
      title: 'Promo teste',
    });

    expect(mockSuggestCopy).not.toHaveBeenCalled();
    expect(mockRenderToMediaHtml).toHaveBeenCalledWith(1, 'promotion', 1, true, undefined);
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ mediaIds: [88], contractId: 2, totemIds: [5] }),
      1
    );
    expect(result.mediaId).toBe(88);
    expect(result.aiApplied).toBe(false);
  });

  it('aplica IA quando useAi=true e continua se IA falhar', async () => {
    mockSuggestCopy.mockRejectedValue(new Error('IA offline'));

    const result = await service.run({
      subscriberId: 1,
      contractId: 2,
      totemIds: [5],
      preset: 'promotion',
      userId: 1,
      isAdmin: true,
      useAi: true,
      title: 'Promo IA',
    });

    expect(mockSuggestCopy).toHaveBeenCalled();
    expect(result.aiApplied).toBe(false);
    expect(result.aiWarning).toMatch(/IA/i);
    expect(mockPublish).toHaveBeenCalled();
  });

  it('não chama IA para preset menu', async () => {
    mockGetLayout.mockResolvedValue({
      subscriberId: 1,
      preset: 'menu',
      boardTitle: 'Cardápio',
      accentColor: '#ff9800',
      preferredOrientation: 'portrait',
      content: {},
      blockOrder: [],
      productOrder: [1],
      showPrices: true,
    });

    await service.run({
      subscriberId: 1,
      contractId: 2,
      totemIds: [5],
      preset: 'menu',
      userId: 1,
      isAdmin: true,
      useAi: true,
      title: 'Cardápio',
    });

    expect(mockSuggestCopy).not.toHaveBeenCalled();
    expect(mockRenderToMediaHtml).toHaveBeenCalledWith(1, 'menu', 1, true, undefined);
  });
});
