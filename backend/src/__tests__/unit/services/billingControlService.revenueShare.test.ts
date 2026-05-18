const findFirst = jest.fn();
const findMany = jest.fn();

jest.mock('../../../config/database', () => ({
  getDatabase: () => ({ findFirst, findMany }),
}));

jest.mock('../../../services/subscriberBillingService', () => ({
  SubscriberBillingService: jest.fn().mockImplementation(() => ({
    getBillingStats: jest.fn().mockResolvedValue({
      total: 0,
      pending: 0,
      paid: 0,
      overdue: 0,
      dueSoon: 0,
      pendingAmount: 0,
      overdueAmount: 0,
      dueSoonAmount: 0,
      paidAmount: 0,
      totalAmount: 0,
    }),
  })),
}));

jest.mock('../../../services/publisherBillingService', () => ({
  PublisherBillingService: jest.fn().mockImplementation(() => ({
    getBillingStats: jest.fn().mockResolvedValue({
      total: 0,
      pending: 0,
      paid: 0,
      overdue: 0,
      dueSoon: 0,
      pendingAmount: 0,
      overdueAmount: 0,
      dueSoonAmount: 0,
      totalOutgoing: 0,
      totalIncoming: 0,
    }),
  })),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
}));

describe('BillingControlService.getDashboard revenueShare', () => {
  beforeEach(() => {
    findFirst.mockReset();
    findMany.mockReset();
    findMany.mockResolvedValue([]);
    delete (global as any).subscriberBillingServiceInstance;
    delete (global as any).publisherBillingServiceInstance;

    findFirst.mockImplementation((sql: string) => {
      const q = String(sql);
      if (q.includes('pending_payout_count')) {
        return Promise.resolve({
          pending_payout_count: 2,
          pending_payout_amount: '1500',
          revenue_share_total_count: 5,
        });
      }
      if (q.includes('sourceSubscriberBillingId')) {
        return Promise.resolve({ c: 3 });
      }
      if (q.includes('subscription_active')) {
        return Promise.resolve({ active: 1, subscription_active: 1, expiring_soon: 0 });
      }
      if (q.includes('FROM subscriber_contracts')) {
        return Promise.resolve({
          total: 1,
          active: 1,
          expired: 0,
          expiring_soon: 0,
          without_end_date: 0,
        });
      }
      return Promise.resolve({});
    });
  });

  it('inclui KPIs de repasse e contratos de exibidor', async () => {
    const { getBillingControlService } = require('../../../services/billingControlService');
    const dash = await getBillingControlService().getDashboard({ dueSoonDays: 30 });

    expect(dash.revenueShare.pendingPayoutCount).toBe(2);
    expect(dash.revenueShare.pendingPayoutAmount).toBe(1500);
    expect(dash.revenueShare.campaignsAwaitingPayout).toBe(3);
    expect(dash.publisherContracts.subscriptionActive).toBe(1);
  });
});
