import { test, expect } from '../fixtures/auth.fixture';

test.describe('Configurações e administração', () => {
  test('rota /settings acessível para admin', async ({ adminPage }) => {
    await adminPage.goto('/settings');
    await adminPage.waitForLoadState('domcontentloaded');
    await expect(adminPage).toHaveURL(/\/settings/);
    await expect(adminPage.locator('#root')).toBeVisible();
  });

  test('utilizadores — gestão de users', async ({ adminPage }) => {
    await adminPage.goto('/users');
    await expect(adminPage.getByText(/Usuários|Users/i).first()).toBeVisible();
  });

  test('contratos — tabs anunciante e organização', async ({ adminPage }) => {
    await adminPage.goto('/contracts');
    await adminPage.waitForLoadState('domcontentloaded');
    await expect(adminPage.getByText(/Contrato|Anunciante|Organização/i).first()).toBeVisible({
      timeout: 25_000,
    });
  });
});
