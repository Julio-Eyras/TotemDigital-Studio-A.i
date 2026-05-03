const mockFindFirst = jest.fn();

jest.mock('../../../config/database', () => ({
  getDatabase: jest.fn(() => ({ findFirst: (...args: unknown[]) => mockFindFirst(...args) })),
}));

jest.mock('../../../config/featureFlags', () => ({
  DISABLE_DIRECT_CAMPAIGN_TOTEM: false,
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
}));

describe('CampaignEligibilityService', () => {
  beforeEach(() => {
    jest.resetModules();
    mockFindFirst.mockReset();
  });

  it('isCampaignActiveForTotem retorna true quando a query encontra linha', async () => {
    mockFindFirst.mockResolvedValue({ ok: 1 });
    const { getCampaignEligibilityService } = await import('../../../services/campaignEligibilityService');
    const ok = await getCampaignEligibilityService().isCampaignActiveForTotem(10, 20);
    expect(ok).toBe(true);
    expect(mockFindFirst).toHaveBeenCalled();
    const sql = String(mockFindFirst.mock.calls[0]?.[0] || '');
    expect(sql).toContain('campaign_totems');
  });

  it('isCampaignActiveForTotem retorna false quando a query não encontra', async () => {
    mockFindFirst.mockResolvedValue(null);
    const { getCampaignEligibilityService } = await import('../../../services/campaignEligibilityService');
    const ok = await getCampaignEligibilityService().isCampaignActiveForTotem(1, 2);
    expect(ok).toBe(false);
  });
});
