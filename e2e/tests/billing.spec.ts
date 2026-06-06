import { test, expect } from '../fixtures/auth.fixture';

test.describe('Faturamento Studio', () => {
  test('rota /billing acessível para admin', async ({ adminPage }) => {
    await adminPage.goto('/billing');
    await adminPage.waitForLoadState('domcontentloaded');
    await expect(adminPage).toHaveURL(/\/billing/);
    await expect(adminPage.locator('#root')).toBeVisible();
  });

  test('contratos da organização acessíveis', async ({ adminPage }) => {
    await adminPage.goto('/publisher-contracts');
    await adminPage.waitForLoadState('domcontentloaded');
    await expect(adminPage).toHaveURL(/\/publisher-contracts/);
    await expect(adminPage.getByText(/Contrato/i).first()).toBeVisible({ timeout: 25_000 });
  });
});
