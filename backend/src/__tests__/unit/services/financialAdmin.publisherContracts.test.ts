import { FinancialAdminService } from '../../../services/financialAdminService';

const findMany = jest.fn();
const findFirst = jest.fn();
const createBilling = jest.fn().mockResolvedValue({ billingId: 99 });

jest.mock('../../../config/database', () => ({
  getDatabase: () => ({ findMany, findFirst }),
}));

jest.mock('../../../services/publisherBillingService', () => ({
  PublisherBillingService: jest.fn().mockImplementation(() => ({
    createBilling,
  })),
}));

jest.mock('../../../services/subscriberBillingService', () => ({
  SubscriberBillingService: jest.fn().mockImplementation(() => ({
    createBilling: jest.fn(),
  })),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logInfo: jest.fn(async () => undefined),
  logError: jest.fn(async () => undefined),
}));

describe('FinancialAdminService.issuePublisherContractInvoices', () => {
  beforeEach(() => {
    findMany.mockReset();
    findFirst.mockReset();
    createBilling.mockClear();
    delete (global as any).publisherBillingServiceInstance;
    delete (global as any).subscriberBillingServiceInstance;
  });

  it('emite fatura incoming para contrato de exibidor com subscription_amount', async () => {
    findMany.mockResolvedValueOnce([
      {
        contract_id: 5,
        publisher_id: 1,
        title: 'Contrato Studio',
        start_date: '2026-01-01',
        subscription_amount: '500',
        currency: 'BRL',
        billing_interval: 'four_month',
      },
    ]);
    findFirst.mockResolvedValueOnce(null);

    const svc = new FinancialAdminService();
    const result = await svc.issuePublisherContractInvoices({ publisherId: 1 });

    expect(result.created).toBe(1);
    expect(createBilling).toHaveBeenCalledWith(
      expect.objectContaining({
        publisherId: 1,
        contractId: 5,
        direction: 'incoming',
        billingType: 'subscription',
        amount: 500,
      })
    );
  });

  it('filtra por publisherContractId', async () => {
    findMany.mockResolvedValueOnce([]);
    findFirst.mockResolvedValue(null);

    const svc = new FinancialAdminService();
    await svc.issuePublisherContractInvoices({ publisherContractId: 99 });

    expect(findMany).toHaveBeenCalledWith(
      expect.stringContaining('pc.contract_id = $'),
      [99]
    );
  });

  it('ignora período já faturado', async () => {
    findMany.mockResolvedValueOnce([
      {
        contract_id: 5,
        publisher_id: 1,
        title: 'C',
        start_date: '2026-01-01',
        subscription_amount: '100',
        currency: 'BRL',
        billing_interval: 'month',
      },
    ]);
    findFirst.mockResolvedValueOnce({ billing_id: 1 });

    const svc = new FinancialAdminService();
    const result = await svc.issuePublisherContractInvoices({});

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(createBilling).not.toHaveBeenCalled();
  });
});
