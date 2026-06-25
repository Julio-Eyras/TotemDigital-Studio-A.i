import { BillingEnforcementService, BillingOverduePublishError } from '../../../services/billingEnforcementService';

jest.mock('../../../config/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../../services/settingsService', () => ({
  SettingsService: jest.fn().mockImplementation(() => ({
    getSetting: jest.fn(async (key: string) => {
      if (key === 'financial.block_publish_on_overdue') {
        return { value: 'true' };
      }
      if (key === 'financial.admin_override_overdue_block') {
        return { value: 'true' };
      }
      if (key === 'financial.block_publish_overdue_grace_days') {
        return { value: '0' };
      }
      return null;
    }),
  })),
}));

describe('BillingEnforcementService', () => {
  const findMany = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const { getDatabase } = require('../../../config/database');
    getDatabase.mockReturnValue({ findMany });
  });

  it('bloqueia publicação quando há prestação além da tolerância', async () => {
    findMany.mockResolvedValue([
      {
        billing_id: 10,
        description: 'Mensalidade demo',
        amount: 1548,
        currency: 'BRL',
        due_date: '2026-06-14',
        days_overdue: 9,
      },
    ]);

    const service = new BillingEnforcementService();

    await expect(service.assertSubscriberCanPublish(1, 'gerente_marketing')).rejects.toBeInstanceOf(
      BillingOverduePublishError
    );
  });

  it('não bloqueia dentro da tolerância (grace days)', async () => {
    const { SettingsService } = require('../../../services/settingsService');
    SettingsService.mockImplementation(() => ({
      getSetting: jest.fn(async (key: string) => {
        if (key === 'financial.block_publish_overdue_grace_days') return { value: '10' };
        if (key === 'financial.block_publish_on_overdue') return { value: 'true' };
        if (key === 'financial.admin_override_overdue_block') return { value: 'true' };
        return null;
      }),
    }));

    findMany.mockResolvedValue([]);

    const service = new BillingEnforcementService();
    await expect(service.assertSubscriberCanPublish(1, 'gerente_marketing')).resolves.toBeUndefined();
  });

  it('permite override para admin com prestação vencida', async () => {
    findMany.mockResolvedValue([
      {
        billing_id: 10,
        description: 'Mensalidade demo',
        amount: 1548,
        currency: 'BRL',
        due_date: '2026-06-14',
        days_overdue: 9,
      },
    ]);

    const service = new BillingEnforcementService();

    await expect(service.assertSubscriberCanPublish(1, 'admin')).resolves.toBeUndefined();
  });
});
