import { FinancialAdminService } from '../../../services/financialAdminService';

const findMany = jest.fn();
const findFirst = jest.fn();
const createBilling = jest.fn().mockResolvedValue({ billingId: 77 });

jest.mock('../../../config/database', () => ({
  getDatabase: () => ({ findMany, findFirst }),
}));

jest.mock('../../../services/publisherBillingService', () => ({
  PublisherBillingService: jest.fn().mockImplementation(() => ({
    createBilling,
  })),
}));

jest.mock('../../../services/subscriberBillingService', () => ({
  SubscriberBillingService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logInfo: jest.fn(async () => undefined),
  logError: jest.fn(async () => undefined),
}));

describe('FinancialAdminService.issueRevenueSharePayouts', () => {
  beforeEach(() => {
    findMany.mockReset();
    findFirst.mockReset();
    createBilling.mockClear();
    delete (global as any).publisherBillingServiceInstance;
    delete (global as any).subscriberBillingServiceInstance;
  });

  it('cria repasse outgoing para campanha paga', async () => {
    findMany.mockResolvedValueOnce([
      {
        billing_id: 10,
        campaign_id: 3,
        campaign_amount: '1000',
        paid_at: '2026-05-01',
        publisher_id: 1,
        contract_id: 5,
        share_pct: '30',
        minimum_payout_amount: null,
        campaign_title: 'Campanha Verão',
      },
    ]);
    findFirst.mockResolvedValueOnce(null);

    const svc = new FinancialAdminService();
    const result = await svc.issueRevenueSharePayouts({ publisherId: 1 });

    expect(result.created).toBe(1);
    expect(createBilling).toHaveBeenCalledWith(
      expect.objectContaining({
        publisherId: 1,
        contractId: 5,
        campaignId: 3,
        billingType: 'revenue_share',
        direction: 'outgoing',
        amount: 300,
        revenueSharePercentage: 30,
        paymentStatus: 'pending_payout',
      })
    );
  });

  it('ignora quando repasse já existe', async () => {
    findMany.mockResolvedValueOnce([
      {
        billing_id: 10,
        campaign_id: 3,
        campaign_amount: '500',
        paid_at: '2026-05-01',
        publisher_id: 1,
        contract_id: 5,
        share_pct: '20',
        minimum_payout_amount: null,
        campaign_title: 'C',
      },
    ]);
    findFirst.mockResolvedValueOnce({ billing_id: 99 });

    const svc = new FinancialAdminService();
    const result = await svc.issueRevenueSharePayouts({});

    expect(result.skipped).toBe(1);
    expect(createBilling).not.toHaveBeenCalled();
  });
});
