const mockSchedule = jest.fn(() => ({ stop: jest.fn() }));

jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: mockSchedule },
}));

jest.mock('../../../config/env', () => ({
  financialConfig: {
    workerEnabled: true,
    cronIssueInvoices: '30 2 * * *',
    cronMarkOverdue: '30 3 * * *',
    cronSendReminders: '0 9 * * *',
    cronEnforceOverdueBlocks: '15 4 * * *',
    autoRevenueSharePayouts: true,
    revenueShareSinceDays: 60,
    cronRevenueSharePayouts: '0 4 * * *',
  },
}));

jest.mock('../../../services/financialAdminService', () => ({
  getFinancialAdminService: () => ({
    issueContractInvoices: jest.fn(),
    issueRevenueSharePayouts: jest.fn(),
  }),
}));

jest.mock('../../../services/financialNotificationService', () => ({
  getFinancialNotificationService: () => ({
    sendPendingInvoiceReminders: jest.fn(),
  }),
}));

jest.mock('../../../services/financialIntegrationConfigService', () => ({
  resolveFinancialWorkerEnabled: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../config/database', () => ({
  getDatabase: () => ({
    executeRaw: jest.fn().mockResolvedValue({ rowCount: 0 }),
  }),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

describe('FinancialBillingWorker', () => {
  beforeEach(() => {
    jest.resetModules();
    mockSchedule.mockClear();
    mockSchedule.mockImplementation(() => ({ stop: jest.fn() }));
  });

  it('regista emissão, vencidas, lembretes, bloqueio e cron dedicado de revenue share', () => {
    const { FinancialBillingWorker } = require('../../../workers/financialBillingWorker');
    const worker = new FinancialBillingWorker();
    worker.start();

    expect(mockSchedule).toHaveBeenCalledTimes(5);
    expect(mockSchedule.mock.calls.map((c: string[]) => c[0])).toEqual(
      expect.arrayContaining([
        '30 2 * * *',
        '30 3 * * *',
        '0 9 * * *',
        '0 4 * * *',
        '15 4 * * *',
      ])
    );

    worker.stop();
  });
});
