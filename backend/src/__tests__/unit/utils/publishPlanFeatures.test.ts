import {
  subscriberHasAiTextAssist,
  subscriberHasPremiumAiVideo,
} from '../../../utils/publishPlanFeatures';

const mockGetActivePlans = jest.fn();

jest.mock('../../../services/subscriberService', () => ({
  getSubscriberService: () => ({
    getActivePlans: mockGetActivePlans,
  }),
}));

describe('publishPlanFeatures', () => {
  beforeEach(() => {
    mockGetActivePlans.mockReset();
  });

  describe('subscriberHasPremiumAiVideo', () => {
    it('retorna true para slug gold', async () => {
      mockGetActivePlans.mockResolvedValue([{ slug: 'gold', features: { tier: 'gold' } }]);
      await expect(subscriberHasPremiumAiVideo(1)).resolves.toBe(true);
    });

    it('retorna true quando features.ai_video é true', async () => {
      mockGetActivePlans.mockResolvedValue([{ slug: 'bronze', features: { ai_video: true } }]);
      await expect(subscriberHasPremiumAiVideo(1)).resolves.toBe(true);
    });

    it('retorna false quando features.ai_video é false', async () => {
      mockGetActivePlans.mockResolvedValue([{ slug: 'bronze', features: { ai_video: false } }]);
      await expect(subscriberHasPremiumAiVideo(1)).resolves.toBe(false);
    });

    it('retorna false para plano base sem flag', async () => {
      mockGetActivePlans.mockResolvedValue([{ slug: 'silver', features: { tier: 'silver' } }]);
      await expect(subscriberHasPremiumAiVideo(1)).resolves.toBe(false);
    });
  });

  describe('subscriberHasAiTextAssist', () => {
    it('retorna true sem planos (fallback legado)', async () => {
      mockGetActivePlans.mockResolvedValue([]);
      await expect(subscriberHasAiTextAssist(1)).resolves.toBe(true);
    });

    it('retorna false quando ai_text_assist é false', async () => {
      mockGetActivePlans.mockResolvedValue([{ slug: 'bronze', features: { ai_text_assist: false } }]);
      await expect(subscriberHasAiTextAssist(1)).resolves.toBe(false);
    });

    it('retorna true para plano com ai_text_assist true', async () => {
      mockGetActivePlans.mockResolvedValue([{ slug: 'bronze', features: { ai_text_assist: true } }]);
      await expect(subscriberHasAiTextAssist(1)).resolves.toBe(true);
    });
  });
});
