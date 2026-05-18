const findMany = jest.fn();
const getBillingById = jest.fn();
const updateBilling = jest.fn();
const issueRevenueSharePayouts = jest.fn().mockResolvedValue({
  created: 1,
  skipped: 0,
  errors: [],
  invoices: [{ billingId: 88, contractId: 5, invoiceNumber: 'REP-1' }],
});

jest.mock('../../../config/database', () => ({
  getDatabase: () => ({ findMany }),
}));

jest.mock('../../../config/env', () => ({
  financialConfig: {
    autoRevenueSharePayouts: true,
    revenueShareSinceDays: 90,
  },
}));

jest.mock('../../../services/subscriberBillingService', () => ({
  SubscriberBillingService: jest.fn(),
}));

jest.mock('../../../services/publisherBillingService', () => ({
  PublisherBillingService: jest.fn(),
}));

jest.mock('../../../services/financialNotificationService', () => ({
  getFinancialNotificationService: () => ({}),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logInfo: jest.fn(async () => undefined),
  logError: jest.fn(async () => undefined),
}));

describe('FinancialAdminService.recordSubscriberPayment', () => {
  beforeEach(() => {
    jest.resetModules();
    findMany.mockReset();
    getBillingById.mockReset();
    updateBilling.mockReset();
    issueRevenueSharePayouts.mockClear();
    (global as any).subscriberBillingServiceInstance = { getBillingById, updateBilling };
    (global as any).publisherBillingServiceInstance = {};
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('dispara repasse quando fatura de campanha é paga e autoRevenueShare ativo', async () => {
    const { FinancialAdminService } = require('../../../services/financialAdminService');
    jest
      .spyOn(FinancialAdminService.prototype, 'issueRevenueSharePayouts')
      .mockImplementation(issueRevenueSharePayouts);

    getBillingById.mockResolvedValueOnce({
      billingId: 10,
      status: 'pending',
      campaignId: 3,
      amount: 1000,
    });
    updateBilling.mockResolvedValueOnce({
      billingId: 10,
      status: 'paid',
      campaignId: 3,
    });
    findMany.mockResolvedValueOnce([{ publisher_id: 1 }]);

    const svc = new FinancialAdminService();
    const result = await svc.recordSubscriberPayment(10, { paymentMethod: 'pix' });

    expect(updateBilling).toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledWith(
      expect.stringContaining('campaign_publishers'),
      [3]
    );
    expect(issueRevenueSharePayouts).toHaveBeenCalledWith({ publisherId: 1, sinceDays: 90 });
    expect(result.billing.status).toBe('paid');
  });

  it('não dispara repasse sem campaignId', async () => {
    const { FinancialAdminService } = require('../../../services/financialAdminService');
    jest
      .spyOn(FinancialAdminService.prototype, 'issueRevenueSharePayouts')
      .mockImplementation(issueRevenueSharePayouts);

    getBillingById.mockResolvedValueOnce({
      billingId: 11,
      status: 'pending',
      campaignId: null,
    });
    updateBilling.mockResolvedValueOnce({ billingId: 11, status: 'paid' });

    const svc = new FinancialAdminService();
    const result = await svc.recordSubscriberPayment(11, { paymentMethod: 'pix' });

    expect(issueRevenueSharePayouts).not.toHaveBeenCalled();
    expect(result.revenueSharePayout).toBeUndefined();
  });
});
