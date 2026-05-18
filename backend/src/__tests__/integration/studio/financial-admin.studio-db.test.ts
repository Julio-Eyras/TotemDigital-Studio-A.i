/**
 * Integração com Postgres real (job CI validate-v6-studio).
 * Ativar com STUDIO_FINANCE_DB_TEST=1 e DATABASE_URL apontando para DB com schema + carga v6.
 */

import { initializeDatabase, closeDatabase } from '../../../config/database';

const runDbIntegration = process.env.STUDIO_FINANCE_DB_TEST === '1';

(runDbIntegration ? describe : describe.skip)('Studio financial (Postgres + seeds v6)', () => {
  beforeAll(async () => {
    process.env.TOTEMDIGITAL_COMPACT = 'true';
    await initializeDatabase();
  }, 30000);

  afterAll(async () => {
    await closeDatabase();
  });

  it('issueRevenueSharePayouts retorna estrutura válida', async () => {
    const { FinancialAdminService } = await import('../../../services/financialAdminService');
    const svc = new FinancialAdminService();
    const result = await svc.issueRevenueSharePayouts({ sinceDays: 90 });

    expect(result).toEqual(
      expect.objectContaining({
        created: expect.any(Number),
        skipped: expect.any(Number),
        errors: expect.any(Array),
        invoices: expect.any(Array),
      })
    );
  });

  it('dashboard de faturamento expõe KPIs de repasse', async () => {
    const { BillingControlService } = await import('../../../services/billingControlService');
    const dashboard = await new BillingControlService().getDashboard();

    expect(dashboard.revenueShare).toEqual(
      expect.objectContaining({
        pendingPayoutCount: expect.any(Number),
        campaignsAwaitingPayout: expect.any(Number),
      })
    );
  });

  it('colunas financeiras de publisher_billing existem', async () => {
    const { getDatabase } = await import('../../../config/database');
    const row = await getDatabase().findFirst(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'publisher_billing'
        AND column_name IN ('contract_id', 'period_start', 'period_end')
      LIMIT 1
    `);
    expect(row?.column_name).toBeTruthy();
  });
});
