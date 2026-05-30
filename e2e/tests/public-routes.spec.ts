import { test, expect } from '../fixtures/auth.fixture';
import { PUBLIC_ROUTES } from '../helpers/routes';

test.describe('Rotas públicas', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.path} acessível sem autenticação`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page).toHaveURL(new RegExp(route.path.replace('/', '\\/')));
      await expect(page.getByText(route.heading).first()).toBeVisible({ timeout: 15_000 });
    });
  }

  test('rota protegida redireciona para login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login', { timeout: 15_000 });
    await expect(page.getByLabel('Nome de Usuário')).toBeVisible();
  });
});
